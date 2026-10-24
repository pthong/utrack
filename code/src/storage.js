'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const OBJECT_COLUMNS = ['id', 'name', 'createdAt', 'groupIds'];
const GROUP_COLUMNS = ['id', 'name', 'createdAt', 'deletedAt'];

function encodeCsv(rows, columns) {
  return '\uFEFF' + [columns, ...rows.map(row => columns.map(key => Array.isArray(row[key]) ? JSON.stringify(row[key]) : row[key] ?? ''))]
    .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
}
function decodeCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value !== '')) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Het CSV-bestand bevat een onafgesloten aanhalingsteken.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const columns = rows.shift() || [];
  return rows.map(values => Object.fromEntries(columns.map((column, index) => [column, values[index] || ''])));
}
function writeFileAtomically(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + '.tmp-' + randomUUID();
  try { fs.writeFileSync(temporaryPath, content, 'utf8'); fs.renameSync(temporaryPath, filePath); }
  finally { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); }
}
function requireText(value, label, max = 10000) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is verplicht.`);
  if (value.length > max) throw new Error(`${label} is te lang (maximaal ${max} tekens).`);
  return value.trim();
}
function optionalText(value, max = 10000) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('Ongeldige tekst of te veel tekens.');
  return value.trim();
}
function parseOptionalPoints(value) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Punten moeten een geldig getal zijn.');
  const text = String(value).trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) throw new Error('Punten moeten een geldig getal zijn.');
  return Number(text);
}
function slugifySubject(subject) {
  return subject.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90).replace(/-$/, '') || 'notitie';
}
const UUID_PATTERN = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const UUID_REGEX = new RegExp(`^${UUID_PATTERN}$`, 'i');
const NOTE_FILE_REGEX = new RegExp(`^(\\d{2}-\\d{2}-\\d{2})--(.+)--(${UUID_PATTERN})\\.md$`, 'i');
function createStorageName(date, name, id) {
  return `${date.slice(2, 10)}--${slugifySubject(name)}--${id}`;
}
function getFolderEntityId(folderName) {
  return UUID_REGEX.test(folderName) ? folderName : folderName.match(new RegExp(`--(${UUID_PATTERN})$`, 'i'))?.[1];
}
function parseNoteContent(content) {
  const metadata = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n(?:\r?\n)?/);
  const lines = metadata?.[1].split(/\r?\n/) || [];
  const dateLine = lines.find(line => /^date: /.test(line));
  const pointsLine = lines.find(line => /^points: /.test(line));
  const sourceLine = lines.find(line => line === 'created_via: notities-voor-alle-onderwerpen');
  const batchIdLine = lines.find(line => line.startsWith('batch_id: '));
  const categoryIdLine = lines.find(line => line.startsWith('category_id: '));
  const categoryNameLine = lines.find(line => line.startsWith('category_name: '));
  const source = sourceLine && categoryIdLine && categoryNameLine ? {
    kind: 'category-batch', categoryId: categoryIdLine.slice(13).trim(), categoryName: JSON.parse(categoryNameLine.slice(15))
  } : null;
  if (source && batchIdLine) source.batchId = batchIdLine.slice(10).trim();
  const hasMetadata = Boolean(dateLine || pointsLine || source);
  const noteContent = hasMetadata ? content.slice(metadata[0].length) : content;
  const heading = noteContent.match(/^# (.+)\r?\n/);
  return { source, subject: heading?.[1], date: dateLine?.slice(6).trim(), points: pointsLine ? parseOptionalPoints(pointsLine.slice(8)) : null,
    body: heading ? noteContent.slice(heading[0].length).replace(/^\r?\n/, '') : noteContent };
}
class UTrackStorage {
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
    fs.mkdirSync(this.rootPath, { recursive: true });
    for (const [name, columns] of [['onderwerpen.csv', OBJECT_COLUMNS], ['categorieen.csv', GROUP_COLUMNS]]) {
      const file = this.filePath(name);
      const rows = this.readCsv(file);
      const content = encodeCsv(rows, columns);
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) writeFileAtomically(file, content);
    }
    this.synchronizeGroupObjectFiles();
  }
  filePath(...parts) { return path.join(this.rootPath, ...parts); }
  readCsv(filePath) { return fs.existsSync(filePath) ? decodeCsv(fs.readFileSync(filePath, 'utf8')) : []; }
  readObjects() {
    return this.validateRows(this.readCsv(this.filePath('onderwerpen.csv'))).map(object => {
      const groupIds = JSON.parse(object.groupIds || '[]');
      if (!Array.isArray(groupIds)) throw new Error('Ongeldige categoriekoppelingen in onderwerpen.csv.');
      return { ...object, groupIds };
    });
  }
  readAllGroups() { return this.validateRows(this.readCsv(this.filePath('categorieen.csv'))); }
  readGroups() { return this.readAllGroups().filter(group => !group.deletedAt); }
  validateRows(rows) {
    if (rows.some(row => !/^[a-f0-9-]{36}$/.test(row.id))) throw new Error('Een CSV-bestand bevat een ongeldig ID.');
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Een CSV-bestand bevat dubbele IDs.');
    return rows;
  }
  requireGroup(groupId) {
    const group = this.readAllGroups().find(item => item.id === groupId);
    if (!group) throw new Error('Deze categorie bestaat niet meer.');
    return group;
  }
  entityFolder(parentFolder, entity) {
    const destination = path.join(parentFolder, createStorageName(entity.createdAt, entity.name, entity.id));
    if (!fs.existsSync(destination) && fs.existsSync(parentFolder)) {
      const previous = fs.readdirSync(parentFolder, { withFileTypes: true }).filter(entry => entry.isDirectory() && getFolderEntityId(entry.name) === entity.id);
      if (previous.length > 1) throw new Error(`Meerdere mappen gevonden voor ${entity.name}.`);
      if (previous.length === 1) fs.renameSync(path.join(parentFolder, previous[0].name), destination);
    }
    return destination;
  }
  groupPath(groupId) { return this.entityFolder(this.filePath('categorieen'), this.requireGroup(groupId)); }
  objectPath(objectId) {
    const object = this.readObjects().find(item => item.id === objectId);
    if (!object) throw new Error('Onbekend onderwerp.');
    return this.entityFolder(this.filePath('onderwerpen'), object);
  }
  synchronizeGroupObjectFiles() {
    const objects = this.readObjects();
    for (const group of this.readAllGroups()) {
      const folder = this.entityFolder(this.filePath('categorieen'), group);
      const content = encodeCsv(group.deletedAt ? [] : objects.filter(object => object.groupIds.includes(group.id)), OBJECT_COLUMNS);
      const file = path.join(folder, 'onderwerpen.csv');
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) writeFileAtomically(file, content);
      fs.mkdirSync(path.join(folder, 'notities'), { recursive: true });
      for (const object of objects) this.entityFolder(path.join(folder, 'onderwerpen'), object);
    }
    for (const object of objects) fs.mkdirSync(path.join(this.entityFolder(this.filePath('onderwerpen'), object), 'notities'), { recursive: true });
  }
  saveObject(input) {
    const objects = this.readObjects();
    const existing = input.id ? objects.find(object => object.id === input.id) : null;
    if (input.id && !existing) throw new Error('Dit onderwerp bestaat niet meer.');
    if (!Array.isArray(input.groupIds)) throw new Error('Kies geldige categorieën.');
    const groupIds = [...new Set(input.groupIds)];
    groupIds.forEach(id => { if (this.requireGroup(id).deletedAt) throw new Error('Dit onderwerp kan niet aan een verwijderde categorie worden gekoppeld.'); });
    const object = {
      id: existing?.id || randomUUID(), name: requireText(input.name, 'Naam', 200),
      createdAt: existing?.createdAt || new Date().toISOString(), groupIds
    };
    const updated = existing ? objects.map(item => item.id === object.id ? object : item) : [...objects, object];
    writeFileAtomically(this.filePath('onderwerpen.csv'), encodeCsv(updated, OBJECT_COLUMNS));
    this.synchronizeGroupObjectFiles();
    return object;
  }
  saveGroup(input) {
    const groups = this.readAllGroups();
    const existing = input.id ? groups.find(group => group.id === input.id && !group.deletedAt) : null;
    if (input.id && !existing) throw new Error('Deze categorie bestaat niet meer.');
    const group = { id: existing?.id || randomUUID(), name: requireText(input.name, 'Categorienaam', 200),
      createdAt: existing?.createdAt || new Date().toISOString() };
    writeFileAtomically(this.filePath('categorieen.csv'), encodeCsv(existing ? groups.map(item => item.id === group.id ? group : item) : [...groups, group], GROUP_COLUMNS));
    this.synchronizeGroupObjectFiles();
    return group;
  }
  reorderGroups(groupIds) {
    const allGroups = this.readAllGroups();
    const groups = allGroups.filter(group => !group.deletedAt);
    if (!Array.isArray(groupIds) || groupIds.length !== groups.length || new Set(groupIds).size !== groups.length) throw new Error('De categorievolgorde is ongeldig. Vernieuw de gegevens en probeer opnieuw.');
    const byId = new Map(groups.map(group => [group.id, group]));
    if (groupIds.some(id => !byId.has(id))) throw new Error('Een categorie bestaat niet meer. Vernieuw de gegevens en probeer opnieuw.');
    const orderedGroups = groupIds.map(id => byId.get(id));
    writeFileAtomically(this.filePath('categorieen.csv'), encodeCsv([...orderedGroups, ...allGroups.filter(group => group.deletedAt)], GROUP_COLUMNS));
    return orderedGroups;
  }
  deleteGroup(groupId) {
    const groups = this.readAllGroups();
    const group = groups.find(item => item.id === groupId && !item.deletedAt);
    if (!group) throw new Error('Deze categorie bestaat niet meer.');
    const objects = this.readObjects().map(object => ({ ...object, groupIds: object.groupIds.filter(id => id !== groupId) }));
    // Keep the folder and its Markdown notes readable after removing the group.
    writeFileAtomically(this.filePath('onderwerpen.csv'), encodeCsv(objects, OBJECT_COLUMNS));
    writeFileAtomically(this.filePath('categorieen.csv'), encodeCsv(groups.map(item => item.id === groupId ? { ...item, deletedAt: new Date().toISOString() } : item), GROUP_COLUMNS));
    writeFileAtomically(path.join(this.groupPath(groupId), 'onderwerpen.csv'), encodeCsv([], OBJECT_COLUMNS));
    this.synchronizeGroupObjectFiles();
  }
  resolveNoteFolder(owner) {
    if (owner.kind === 'object') {
      const object = this.readObjects().find(object => object.id === owner.id);
      if (!object) throw new Error('Onbekend onderwerp.');
      if (owner.groupId) {
        this.requireGroup(owner.groupId);
        // Existing notes stay readable when an object is removed from a group.
        return path.join(this.entityFolder(path.join(this.groupPath(owner.groupId), 'onderwerpen'), object), 'notities');
      }
      return path.join(this.objectPath(owner.id), 'notities');
    }
    if (owner.kind === 'group') return path.join(this.groupPath(owner.id), 'notities');
    throw new Error('Onbekende bestemming voor notitie.');
  }
  listNotes(owner) { return this.readNotesFromFolder(owner, this.resolveNoteFolder(owner)); }
  readNotesFromFolder(owner, folder) {
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter(name => NOTE_FILE_REGEX.test(name) || /^\d{4}-\d{2}-\d{2}--.+\.md$/.test(name)).map(originalFileName => {
      let fileName = originalFileName;
      let notePath = path.join(folder, fileName);
      const content = fs.readFileSync(notePath, 'utf8');
      const modifiedAt = fs.statSync(notePath).mtimeMs;
      const parsed = parseNoteContent(content);
      const match = fileName.match(NOTE_FILE_REGEX);
      const id = match?.[3] || randomUUID();
      const date = parsed.date || (match ? `20${match[1]}` : fileName.slice(0, 10));
      const subject = parsed.subject || (match ? match[2] : fileName.slice(12, -3));
      if (!match) {
        fileName = createStorageName(date, subject, id) + '.md';
        fs.renameSync(notePath, path.join(folder, fileName));
      }
      return { id, fileName, modifiedAt, date, subject, points: parsed.points, source: parsed.source, body: parsed.body, owner };
    }).sort((a, b) => b.date.localeCompare(a.date) || b.modifiedAt - a.modifiedAt);
  }
  saveNote(input) {
    const folder = this.resolveNoteFolder(input.owner);
    const subject = requireText(input.subject, 'Onderwerp', 200).replace(/[\r\n]/g, ' ');
    const body = typeof input.body === 'string' && input.body.length <= 2000000 ? input.body : null;
    if (body === null) throw new Error('Notitie is te groot of ongeldig.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('Kies een geldige datum.');
    const notes = this.listNotes(input.owner);
    const existing = input.fileName ? notes.find(note => note.fileName === input.fileName) : null;
    if (input.fileName && !existing) throw new Error('Deze notitie bestaat niet meer.');
    if (input.id && (!UUID_REGEX.test(input.id) || (existing && input.id !== existing.id))) throw new Error('Ongeldig notitie-ID.');
    const id = existing?.id || input.id || randomUUID();
    if (!existing && notes.some(note => note.id === id)) throw new Error('Er bestaat al een notitie met dit ID.');
    const points = input.points === undefined && existing ? existing.points : parseOptionalPoints(input.points);
    let source = existing?.source || null;
    if (!existing && input.source) {
      if (input.source.kind !== 'category-batch' || input.owner.kind !== 'object') throw new Error('Ongeldige herkomst van de notitie.');
      const category = this.requireGroup(input.source.categoryId);
      const object = this.readObjects().find(item => item.id === input.owner.id);
      if (category.deletedAt || !object?.groupIds.includes(category.id)) throw new Error('Dit onderwerp hoort niet bij deze categorie.');
      source = { kind: 'category-batch', categoryId: category.id, categoryName: category.name };
    }
    if (input.source?.batchId && source) {
      if (!UUID_REGEX.test(input.source.batchId) || (source.batchId && source.batchId !== input.source.batchId)) throw new Error('Ongeldig notitiecluster.');
      source = { ...source, batchId: input.source.batchId };
    }
    const fileName = createStorageName(input.date, subject, id) + '.md';
    const originMetadata = source ? `created_via: notities-voor-alle-onderwerpen\ncategory_id: ${source.categoryId}\ncategory_name: ${JSON.stringify(source.categoryName)}\n${source.batchId ? `batch_id: ${source.batchId}\n` : ''}` : '';
    const metadata = `---\ndate: ${input.date}\n${points === null ? '' : `points: ${points}\n`}${originMetadata}---\n\n`;
    writeFileAtomically(path.join(folder, fileName), `${metadata}# ${subject}\n\n${body}`);
    if (existing && existing.fileName !== fileName) fs.unlinkSync(path.join(folder, existing.fileName));
    return { id, fileName, subject, body, points, source, date: input.date, owner: input.owner };
  }
  deleteNote(input) {
    if (!this.listNotes(input.owner).some(note => note.fileName === input.fileName)) throw new Error('Deze notitie bestaat niet meer.');
    fs.unlinkSync(path.join(this.resolveNoteFolder(input.owner), input.fileName));
  }
  getSnapshot() {
    const objects = this.readObjects(), allGroups = this.readAllGroups();
    const groups = allGroups.filter(group => !group.deletedAt), archivedGroups = allGroups.filter(group => group.deletedAt);
    const notes = objects.flatMap(object => this.readNotesFromFolder({ kind: 'object', id: object.id }, path.join(this.entityFolder(this.filePath('onderwerpen'), object), 'notities')));
    const objectsById = new Map(objects.map(object => [object.id, object]));
    for (const group of allGroups) {
      const groupFolder = this.entityFolder(this.filePath('categorieen'), group);
      notes.push(...this.readNotesFromFolder({ kind: 'group', id: group.id }, path.join(groupFolder, 'notities')));
      const contextFolder = path.join(groupFolder, 'onderwerpen');
      if (!fs.existsSync(contextFolder)) continue;
      for (const folderName of fs.readdirSync(contextFolder)) {
        const object = objectsById.get(getFolderEntityId(folderName));
        if (!object) continue;
        notes.push(...this.readNotesFromFolder({ kind: 'object', id: object.id, groupId: group.id }, path.join(this.entityFolder(contextFolder, object), 'notities')));
      }
    }
    return { rootPath: this.rootPath, objects, groups, archivedGroups, notes };
  }
}
module.exports = { UTrackStorage, encodeCsv, decodeCsv, slugifySubject, createStorageName };
