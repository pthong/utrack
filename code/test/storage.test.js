'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { UTrackStorage, encodeCsv, decodeCsv } = require('../src/storage');
function createStorage(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'objectenboek-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return new UTrackStorage(root); }
test('CSV behoudt Unicode, aanhalingstekens, komma’s en meerregelige tekst', () => {
  const rows = [{ name: 'Zoë, "Noor"', body: 'Regel één\nRegel twee\r\nEn drie', empty: '' }];
  assert.deepEqual(decodeCsv(encodeCsv(rows, ['name', 'body', 'empty'])), rows);
});
test('persoon is één object, gekoppeld aan meerdere groepen; projecties blijven actueel', t => {
  const storage = createStorage(t), a = storage.saveGroup({ name: 'Team A' }), b = storage.saveGroup({ name: 'Team B' });
  const person = storage.saveObject({ name: 'Noor', type: 'Persoon', description: 'Contact', groupIds: [a.id, b.id] });
  assert.equal(storage.readObjects().length, 1);
  for (const group of [a, b]) assert.equal(storage.readCsv(path.join(storage.groupPath(group.id), 'onderwerpen.csv'))[0].id, person.id);
  storage.saveObject({ ...person, name: 'Noor de Vries', groupIds: [b.id] });
  assert.equal(storage.readCsv(path.join(storage.groupPath(a.id), 'onderwerpen.csv')).length, 0);
  assert.equal(storage.readCsv(path.join(storage.groupPath(b.id), 'onderwerpen.csv'))[0].name, 'Noor de Vries');
  assert.ok(fs.existsSync(path.join(storage.objectPath(person.id), 'notities')));
});
test('object-, groeps- en contextnotities blijven gescheiden en herladen vanaf Markdown', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Project' });
  const object = storage.saveObject({ name: 'Sanne', type: 'Persoon', groupIds: [group.id] });
  const owners = [{ kind: 'object', id: object.id }, { kind: 'group', id: group.id }, { kind: 'object', id: object.id, groupId: group.id }];
  for (const owner of owners) storage.saveNote({ owner, subject: 'Één afspraak', date: '2026-10-24', body: '**Markdown**\n\nAfspraak om 10:00.' });
  let snapshot = new UTrackStorage(storage.rootPath).getSnapshot();
  assert.equal(snapshot.notes.length, 3);
  assert.ok(snapshot.notes.every(note => /^26-10-24--een-afspraak--[a-f0-9-]{36}\.md$/.test(note.fileName)));
  assert.equal(new Set(snapshot.notes.map(note => note.id)).size, 3);
  assert.ok(snapshot.notes.every(note => note.subject === 'Één afspraak'));
  storage.saveObject({ ...object, groupIds: [] });
  snapshot = storage.getSnapshot();
  assert.equal(snapshot.notes.length, 3, 'contextnotities blijven bewaard na ontkoppelen');
});
test('gelijke onderwerpen overschrijven niets; wijzigen, hernoemen en verwijderen werken', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Project' }), owner = { kind: 'group', id: group.id };
  const input = { owner, subject: 'Update', date: '2026-10-24', body: 'Eerste' };
  const first = storage.saveNote(input), second = storage.saveNote({ ...input, body: 'Tweede' });
  assert.notEqual(second.id, first.id);
  assert.equal(second.fileName, `26-10-24--update--${second.id}.md`);
  const changed = storage.saveNote({ ...first, subject: 'Ander onderwerp', body: 'Aangepast' });
  assert.equal(changed.fileName, `26-10-24--ander-onderwerp--${first.id}.md`);
  assert.equal(changed.id, first.id);
  assert.equal(storage.listNotes(owner).length, 2);
  assert.equal(storage.listNotes(owner).find(note => note.fileName === changed.fileName).body, 'Aangepast');
  storage.deleteNote(changed);
  assert.equal(storage.listNotes(owner).length, 1);
});
test('ongeldige IDs, paden, datums en groepskoppelingen worden geweigerd', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Project' }), owner = { kind: 'group', id: group.id };
  assert.throws(() => storage.saveObject({ name: 'Test', groupIds: ['../../tmp'] }));
  assert.throws(() => storage.saveNote({ owner, date: '2026-02-30', subject: 'Test', body: '' }));
  assert.throws(() => storage.saveNote({ owner, date: '2026-10-24', subject: 'Test', body: '', fileName: '../test.md' }));
  assert.throws(() => storage.deleteNote({ owner, fileName: '../test.md' }));
  assert.throws(() => storage.listNotes({ kind: 'object', id: '../test' }));
  fs.writeFileSync(storage.filePath('onderwerpen.csv'), encodeCsv([{ id: '../../tmp', name: 'Onveilig' }], ['id', 'name']));
  assert.throws(() => storage.getSnapshot());
});
test('handmatig toegevoegde Markdown en externe CSV-wijzigingen worden opnieuw gelezen', t => {
  const storage = createStorage(t), object = storage.saveObject({ name: 'Camera', groupIds: [] });
  fs.writeFileSync(path.join(storage.objectPath(object.id), 'notities', '2026-10-24--extern.md'), '# Extern\n\nZelf geschreven.');
  assert.equal(storage.getSnapshot().notes[0].body, 'Zelf geschreven.');
  const objects = storage.readObjects(); objects[0].name = 'Aangepast in CSV';
  fs.writeFileSync(storage.filePath('onderwerpen.csv'), encodeCsv(objects, ['id', 'name', 'createdAt', 'groupIds']));
  assert.equal(new UTrackStorage(storage.rootPath).getSnapshot().objects[0].name, 'Aangepast in CSV');
});

test('groepsvolgorde blijft bewaard en onvolledige of dubbele lijsten worden geweigerd', t => {
  const storage = createStorage(t);
  const groups = ['Eerste', 'Tweede', 'Derde'].map(name => storage.saveGroup({ name }));
  const order = [groups[2].id, groups[0].id, groups[1].id];
  assert.deepEqual(storage.reorderGroups(order).map(group => group.id), order);
  assert.deepEqual(new UTrackStorage(storage.rootPath).readGroups().map(group => group.id), order);
  assert.throws(() => storage.reorderGroups(order.slice(1)));
  assert.throws(() => storage.reorderGroups([order[0], order[0], order[2]]));
  assert.throws(() => storage.reorderGroups([order[0], order[1], 'onbekend']));
  assert.deepEqual(storage.readGroups().map(group => group.id), order);
});

test('groep verwijderen behoudt objecten, andere koppelingen en alle notities', t => {
  const storage = createStorage(t);
  const a = storage.saveGroup({ name: 'Weg' }), b = storage.saveGroup({ name: 'Blijft' });
  const object = storage.saveObject({ name: 'Camera', groupIds: [a.id, b.id] });
  const owners = [{ kind: 'object', id: object.id }, { kind: 'group', id: a.id }, { kind: 'object', id: object.id, groupId: a.id }];
  for (const owner of owners) storage.saveNote({ owner, subject: 'Bewaren', date: '2026-10-24', body: 'Blijft leesbaar.' });
  storage.deleteGroup(a.id);
  let data = new UTrackStorage(storage.rootPath).getSnapshot();
  assert.deepEqual(data.groups.map(group => group.id), [b.id]);
  assert.deepEqual(data.objects[0].groupIds, [b.id]);
  assert.equal(data.objects.length, 1);
  assert.equal(data.notes.length, 3);
  assert.ok(data.archivedGroups.some(group => group.id === a.id && group.deletedAt));
  assert.equal(storage.readCsv(path.join(storage.groupPath(a.id), 'onderwerpen.csv')).length, 0);
  assert.throws(() => storage.saveObject({ ...object, groupIds: [a.id] }));
  const c = storage.saveGroup({ name: 'Nieuw' });
  storage.reorderGroups([c.id, b.id]);
  data = storage.getSnapshot();
  assert.equal(data.notes.length, 3, 'nieuwe groep en gewijzigde volgorde behouden oude groepsnotities');
  const archivedNote = data.notes.find(note => note.owner.kind === 'group');
  storage.saveNote({ ...archivedNote, body: 'Ook nog te bewerken.' });
  assert.equal(storage.listNotes(archivedNote.owner)[0].body, 'Ook nog te bewerken.');
});

test('optionele punten blijven in Markdown bewaard; nul, decimalen en leeg zijn verschillend', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Scores' });
  const owner = { kind: 'group', id: group.id };
  const input = { owner, subject: 'Beoordeling', date: '2026-10-24', body: 'Tekst blijft intact.\n\n---\npoints: 99\n---' };
  let note = storage.saveNote({ ...input, points: 0 });
  let read = new UTrackStorage(storage.rootPath).listNotes(owner)[0];
  assert.equal(read.points, 0); assert.equal(read.body, input.body); assert.equal(read.subject, input.subject);
  assert.match(fs.readFileSync(path.join(storage.resolveNoteFolder(owner), note.fileName), 'utf8'), /^---\ndate: 2026-10-24\npoints: 0\n---\n\n# Beoordeling/);
  note = storage.saveNote({ ...note, points: '2,5' });
  assert.equal(storage.listNotes(owner)[0].points, 2.5);
  storage.saveNote({ owner, fileName: note.fileName, subject: input.subject, date: input.date, body: input.body });
  assert.equal(storage.listNotes(owner)[0].points, 2.5, 'ontbrekende eigenschap behoudt bestaande punten');
  note = storage.saveNote({ ...note, points: '' });
  read = storage.listNotes(owner)[0]; assert.equal(read.points, null); assert.equal(read.body, input.body);
  assert.match(fs.readFileSync(path.join(storage.resolveNoteFolder(owner), note.fileName), 'utf8'), /^---\ndate: 2026-10-24\n---\n\n# Beoordeling/); 
  for (const points of ['abc', Infinity, {}, '1e999']) assert.throws(() => storage.saveNote({ ...input, points }));
});

test('onderwerp- en categoriemappen volgen datum--naam--uid en hernoemen met hetzelfde ID', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Werkplaats' });
  const object = storage.saveObject({ name: 'Camera', groupIds: [group.id] });
  const other = storage.saveObject({ name: 'Camera', groupIds: [group.id] });
  const oldGroupFolder = storage.groupPath(group.id), oldObjectFolder = storage.objectPath(object.id);
  assert.equal(path.basename(oldGroupFolder), `${group.createdAt.slice(2, 10)}--werkplaats--${group.id}`);
  assert.equal(path.basename(oldObjectFolder), `${object.createdAt.slice(2, 10)}--camera--${object.id}`);
  assert.notEqual(storage.objectPath(other.id), oldObjectFolder);
  const owner = { kind: 'object', id: object.id };
  const note = storage.saveNote({ owner, subject: 'Controle', date: '2026-10-24', body: 'Blijft staan.', points: 3 });
  storage.saveNote({ owner: { ...owner, groupId: group.id }, subject: 'Context', date: '2026-10-24', body: 'Ook behouden.' });
  storage.saveGroup({ ...group, name: 'Nieuwe categorie' });
  storage.saveObject({ ...object, name: 'Nieuwe naam' });
  assert.ok(!fs.existsSync(oldGroupFolder)); assert.ok(!fs.existsSync(oldObjectFolder));
  assert.ok(storage.groupPath(group.id).endsWith(`--nieuwe-categorie--${group.id}`));
  assert.ok(storage.objectPath(object.id).endsWith(`--nieuwe-naam--${object.id}`));
  const snapshot = new UTrackStorage(storage.rootPath).getSnapshot();
  assert.equal(snapshot.notes.length, 2); assert.equal(snapshot.notes.find(item => item.id === note.id).points, 3);
  assert.equal(storage.listNotes(owner)[0].fileName, note.fileName);
  assert.ok(fs.existsSync(path.join(storage.groupPath(group.id), 'onderwerpen', path.basename(storage.objectPath(object.id)), 'notities')));
});
test('notitie-ID blijft gelijk bij wijzigen van datum en onderwerp; volledig jaartal blijft bewaard', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Categorie' });
  const owner = { kind: 'group', id: group.id };
  const first = storage.saveNote({ owner, subject: 'Eerste naam', date: '1999-12-31', body: 'Tekst.', points: 0 });
  assert.equal(first.fileName, `99-12-31--eerste-naam--${first.id}.md`);
  assert.equal(storage.listNotes(owner)[0].date, '1999-12-31');
  const changed = storage.saveNote({ ...first, date: '2026-10-24', subject: 'Nieuwe naam' });
  assert.equal(changed.id, first.id); assert.equal(changed.fileName, `26-10-24--nieuwe-naam--${first.id}.md`);
  assert.equal(storage.listNotes(owner).length, 1);
  assert.ok(!fs.existsSync(path.join(storage.resolveNoteFolder(owner), first.fileName)));
  assert.throws(() => storage.saveNote({ owner, id: first.id, subject: 'Kopie', date: '2026-10-24', body: '' }));
});

test('CSV-bestanden bevatten geen type of description, ook na opnieuw openen', t => {
  const storage = createStorage(t), group = storage.saveGroup({ name: 'Team', description: 'Oud' });
  storage.saveObject({ name: 'Noor', type: 'Persoon', description: 'Oud', groupIds: [group.id] });
  const subjectColumns = ['id', 'name', 'createdAt', 'groupIds'];
  const groupColumns = ['id', 'name', 'createdAt', 'deletedAt'];
  for (const [file, columns] of [[storage.filePath('onderwerpen.csv'), subjectColumns], [storage.filePath('categorieen.csv'), groupColumns], [path.join(storage.groupPath(group.id), 'onderwerpen.csv'), subjectColumns]]) {
    const rows = storage.readCsv(file);
    assert.deepEqual(Object.keys(rows[0]), columns);
    fs.writeFileSync(file, encodeCsv(rows.map(row => ({ ...row, type: 'Oud', description: 'Oud' })), [...columns, 'type', 'description']));
  }
  const reopened = new UTrackStorage(storage.rootPath);
  assert.equal(reopened.getSnapshot().objects.length, 1);
  for (const file of [storage.filePath('onderwerpen.csv'), storage.filePath('categorieen.csv'), path.join(storage.groupPath(group.id), 'onderwerpen.csv')]) {
    assert.ok(!Object.hasOwn(storage.readCsv(file)[0], 'type'));
    assert.ok(!Object.hasOwn(storage.readCsv(file)[0], 'description'));
  }
});

test('herkomst van categoriebatch staat in Markdown en blijft behouden bij individueel bewerken', t => {
 const storage=createStorage(t);
 const group=storage.saveGroup({name:'Team "A": ideeën'});
 const object=storage.saveObject({name:'Noor',groupIds:[group.id]});
 const owner={kind:'object',id:object.id};
 const note=storage.saveNote({owner,subject:'Overleg',date:'2026-10-25',body:'Afspraak',points:2,source:{kind:'category-batch',categoryId:group.id}});
 const file=path.join(storage.resolveNoteFolder(owner),note.fileName);
 const markdown=fs.readFileSync(file,'utf8');
 assert.match(markdown,/created_via: notities-voor-alle-onderwerpen/);
 assert.ok(markdown.includes('category_id: '+group.id));
 assert.ok(markdown.includes('category_name: '+JSON.stringify(group.name)));
 let reloaded=new UTrackStorage(storage.rootPath).listNotes(owner)[0];
 assert.deepEqual(reloaded.source,{kind:'category-batch',categoryId:group.id,categoryName:group.name});
 assert.equal(reloaded.body,'Afspraak');assert.equal(reloaded.points,2);
 storage.deleteGroup(group.id);
 storage.saveNote({owner,fileName:note.fileName,subject:'Gewijzigd',date:'2026-10-25',body:'Bijgewerkt'});
 reloaded=new UTrackStorage(storage.rootPath).listNotes(owner)[0];
 assert.deepEqual(reloaded.source,note.source);
 const individual=storage.saveNote({owner,subject:'Los',date:'2026-10-25',body:'Individueel'});
 assert.equal(individual.source,null);
 assert.doesNotMatch(fs.readFileSync(path.join(storage.resolveNoteFolder(owner),individual.fileName),'utf8'),/created_via:|category_id:|category_name:/);
 assert.throws(()=>storage.saveNote({owner,subject:'Ongeldig',date:'2026-10-25',body:'',source:{kind:'category-batch',categoryId:group.id}}));
});
