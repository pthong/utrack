'use strict';
const $ = selector => document.querySelector(selector);
const api = window.uTrack;
function confirmStandardText(message) { return window.confirm(window.translateStandardText ? window.translateStandardText(message) : message); }
const developmentMode = new URLSearchParams(window.location.search).get('dev') === '1';
if (developmentMode) { document.title = 'u-track Dev'; $('.topbar-right').textContent = 'Ontwikkelomgeving · aparte testgegevens'; }
const state = { data: { objects: [], groups: [], notes: [] }, groupId: null, view: 'objects', selectedId: null, noteGroupId: '', query: '', results: [], editor: null, saving: false };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const findObject = id => state.data.objects.find(object => object.id === id);
const findGroup = id => state.data.groups.find(group => group.id === id);
const selectedObject = () => findObject(state.selectedId);
const activeGroup = () => findGroup(state.groupId);
const findNoteGroup = id => findGroup(id) || state.data.archivedGroups?.find(group => group.id === id);
const ownerName = owner => owner.kind === 'group' ? findNoteGroup(owner.id)?.name : findObject(owner.id)?.name;
function noteOwnerIcon(owner, compact = false) {
  const category = owner.kind === 'group';
  const label = category ? 'Categorienotitie' : 'Onderwerpnotitie';
  const marker = category ? '<circle cx="16" cy="16" r="4" />' : '<path d="m16 11 5 5-5 5-5-5Z" />';
  return `<span class="note-owner-icon ${compact ? 'compact' : 'object-icon'}" role="img" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5V3h10l4 4v3M14 3v5h5M8 11h3M8 15h1" />${marker}</svg></span>`;
}
const ownerContext = owner => owner.kind === 'group' ? (findNoteGroup(owner.id)?.deletedAt ? 'Verwijderde categorie' : '') : owner.groupId ? `In ${findNoteGroup(owner.groupId)?.name || 'categorie'}${findNoteGroup(owner.groupId)?.deletedAt ? ' (verwijderde categorie)' : ''}` : '';
const notePointsBadge = note => note.points === null || note.points === undefined ? '' : `<span class="note-points-badge">${escapeHtml(note.points.toLocaleString('nl-NL', { maximumFractionDigits: 20, useGrouping: false }))} ${note.points === 1 ? 'punt' : 'punten'}</span>`;
const compareNotesNewestFirst = (a, b) => b.date.localeCompare(a.date) || (b.modifiedAt || 0) - (a.modifiedAt || 0);
const sameOwner = (a, b) => a.kind === b.kind && a.id === b.id && (a.groupId || '') === (b.groupId || '');
let toastTimer, previousFocus, groupMembershipSaving = false, groupDeletionSaving = false;
function showToast(message, error = false) {
  clearTimeout(toastTimer); $('#toast').textContent = window.translateStandardText ? window.translateStandardText(message) : message; $('#toast').className = `toast${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => $('#toast').classList.add('hidden'), error ? 8500 : 3200);
}
async function runAction(action) { try { await action(); } catch (error) { showToast(error.message, true); } }
async function refreshData(message = '') {
  state.data = await api.loadData();
  if (state.selectedId && !findObject(state.selectedId)) state.selectedId = null;
  if (state.groupId && !findGroup(state.groupId)) state.groupId = null;
  renderApplication();
  if (message) showToast(message);
}
function navigateToCollection(groupId = null, view = 'objects') {
  state.groupId = groupId; state.view = view; state.selectedId = null; state.query = ''; state.noteGroupId = ''; $('#search').value = '';
  renderApplication();
}
function selectObject(id, contextGroup = state.groupId) {
  state.selectedId = id; state.noteGroupId = contextGroup || '';
  renderCollection(); renderDetail();
  const selectedRow = document.querySelector('[aria-pressed="true"]');
  selectedRow?.focus({ preventScroll: true });
}
function getUnclusteredResults() {
  const query = normalizeSearch(state.query.trim());
  if (state.view === 'groups') return state.data.groups.filter(group => !query || query.split(/\s+/).every(term => normalizeSearch(group.name).includes(term))).map(group => ({ kind: 'group', item: group }));
  if (state.view === 'notes') {
    const objectIds = new Set(state.data.objects.filter(object => object.groupIds.includes(state.groupId)).map(object => object.id));
    const terms = query.split(/\s+/).filter(Boolean);
    return state.data.notes.filter(note => !state.groupId || (note.owner.kind === 'group' && note.owner.id === state.groupId) || (note.owner.kind === 'object' && objectIds.has(note.owner.id)))
      .filter(note => terms.every(term => normalizeSearch([note.subject, note.body, note.date, ownerName(note.owner), ownerContext(note.owner)].join(' ')).includes(term)))
      .sort(compareNotesNewestFirst).map(note => ({ kind: 'note', item: note }));
  }
  if (query) {
    const terms = query.split(/\s+/);
    const matches = text => terms.every(term => normalizeSearch(text).includes(term));
    return [
      ...state.data.objects.filter(object => matches([object.name, ...object.groupIds.map(id => findGroup(id)?.name)].join(' '))).map(object => ({ kind: 'object', item: object })),
      ...state.data.groups.filter(group => matches(group.name)).map(group => ({ kind: 'group', item: group })),
      ...state.data.notes.filter(note => matches([note.subject, note.body, note.date, ownerName(note.owner), ownerContext(note.owner)].join(' '))).sort(compareNotesNewestFirst).map(note => ({ kind: 'note', item: note }))
    ];
  }
  return state.data.objects.filter(object => !state.groupId || object.groupIds.includes(state.groupId))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl')).map(object => ({ kind: 'object', item: object }));
}
function noteClusterKey(note) {
  if (note.source?.kind !== 'category-batch') return null;
  return JSON.stringify([note.source.categoryId, note.source.batchId || [note.date, note.subject]]);
}
function getFilteredResults() {
  const results = getUnclusteredResults(), seen = new Set();
  return results.flatMap(result => {
    if (result.kind !== 'note') return [result];
    const key = noteClusterKey(result.item);
    if (!key) return [result];
    if (seen.has(key)) return [];
    seen.add(key);
    const notes = state.data.notes.filter(note => noteClusterKey(note) === key).sort(compareNotesNewestFirst);
    return [{ kind: 'note-cluster', item: { ...notes[0], notes } }];
  });
}
function renderApplication() {
  $('#group-count').textContent = state.data.groups.length;
  $('#object-count').textContent = state.data.objects.length; $('#note-count').textContent = state.data.notes.length;
  $('#all-objects').classList.toggle('active', !state.groupId && state.view === 'objects');
  $('#all-notes').classList.toggle('active', !state.groupId && state.view === 'notes');
  $('#all-groups').classList.toggle('active', !state.groupId && state.view === 'groups');
  $('#group-list').innerHTML = state.data.groups.map(group => `<button class="nav-item ${state.groupId === group.id ? 'active' : ''}" data-group="${escapeHtml(group.id)}" draggable="true" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Sleep om te verplaatsen · Alt ↑ / ↓"><span><span class="group-dot">○</span>${escapeHtml(group.name)}</span><span class="count">${state.data.objects.filter(object => object.groupIds.includes(group.id)).length}</span><span class="group-drag-handle" aria-hidden="true">⠿</span></button>`).join('');
  const title = activeGroup()?.name || ({ objects: 'Onderwerpen', notes: 'Notities', groups: 'Categorieën' }[state.view]);
  $('#page-title').textContent = title;
  $('#eyebrow').textContent = state.groupId ? 'CATEGORIE' : 'JOUW BIBLIOTHEEK';
  $('#page-description').textContent = (state.groupId ? 'Onderwerpen en notities die bij elkaar horen.' : state.view === 'objects' ? 'Onderwerpen, personen en hun verhalen. Bij elkaar.' : state.view === 'groups' ? 'Al je categorieën bij elkaar. Open een categorie om de onderwerpen te bekijken.' : 'Alle gedachten en afspraken, op één plek.');
  $('#breadcrumb').innerHTML = `${state.groupId ? 'Categorieën' : 'Bibliotheek'} <span>/</span> ${escapeHtml(title)}`;
  $('#edit-group').classList.toggle('hidden', !state.groupId);
  $('#objects-tab').classList.toggle('active', state.view === 'objects'); $('#notes-tab').classList.toggle('active', state.view === 'notes');
  $('#groups-tab').classList.toggle('active', state.view === 'groups');
  $('#groups-tab').classList.toggle('hidden', Boolean(state.groupId));
  $('#new-group').classList.toggle('hidden', state.view !== 'groups');
  $('#new-object').classList.toggle('hidden', state.view === 'groups');
  $('#search').placeholder = state.view === 'groups' ? 'Zoek categorieën op naam…' : state.view === 'notes' ? (state.groupId ? 'Zoek in notities van deze categorie…' : 'Zoek in alle notities…') : 'Zoek in onderwerpen, categorieën en alle notities…';
  $('#open-folder').title = state.data.rootPath || 'Gegevensmap';
  renderCollection(); renderDetail();
}
function renderCollection() {
  state.results = getFilteredResults();
  $('#list-caption').innerHTML = state.view === 'groups' ? '<span>CATEGORIEËN</span><span>ONDERWERPEN</span>' : state.query ? (state.view === 'notes' ? `<span>ZOEKRESULTATEN · ${state.groupId ? 'NOTITIES VAN DEZE CATEGORIE' : 'ALLE NOTITIES'}</span>` : '<span>ZOEKRESULTATEN · HELE BIBLIOTHEEK</span>') : state.view === 'objects' ? '<span>NAAM</span>' : '<span>ONDERWERP</span><span>DATUM</span>';
  $('#result-count').textContent = `${state.results.length} ${state.query ? 'resultaten' : state.view === 'objects' ? 'onderwerpen' : state.view === 'groups' ? 'categorieën' : 'notities'}`;
  if (state.view === 'notes' && state.results.some(result => result.kind === 'note-cluster')) {
    const clusters = state.results.filter(result => result.kind === 'note-cluster').length;
    const individual = state.results.length - clusters;
    $('#result-count').textContent = `${clusters} ${clusters === 1 ? 'cluster' : 'clusters'}${individual ? ` · ${individual} losse ${individual === 1 ? 'notitie' : 'notities'}` : ''}`;
  }
  if (!state.results.length && state.view === 'groups') {
    $('#collection-content').innerHTML = `<div class="empty"><div class="empty-symbol">○</div><h2>${state.query ? 'Geen categorieën gevonden' : 'Je eerste categorie begint hier'}</h2><p>${state.query ? 'Probeer een andere naam.' : 'Maak een categorie aan om onderwerpen bij elkaar te houden.'}</p><button class="button primary" data-action="new-group">+ Categorie toevoegen <kbd>Ctrl ⇧ G</kbd></button></div>`;
    return;
  }
  if (!state.results.length) {
    $('#collection-content').innerHTML = `<div class="empty"><div class="empty-symbol">${state.query ? '⌕' : state.view === 'objects' ? '▦' : '▤'}</div><h2>${state.query ? 'Even verder zoeken' : state.view === 'objects' ? 'Ruimte voor je eerste onderwerp' : 'Begin met een gedachte'}</h2><p>${state.query ? 'Geen resultaten. Probeer een andere naam, een onderwerp of een woord uit een notitie.' : state.view === 'objects' ? 'Voeg een voorwerp, persoon of ander onderwerp toe. Geef het een plek in één of meer categorieën.' : 'Schrijf een notitie bij een onderwerp of categorie. Je vindt ze hier allemaal terug.'}</p>${state.query ? '' : `<button class="button primary" data-action="${state.view === 'objects' ? 'new-object' : 'new-note'}">+ ${state.view === 'objects' ? 'Onderwerp toevoegen' : 'Notitie schrijven'} <kbd>${state.view === 'objects' ? 'Ctrl N' : 'Ctrl ⇧ N'}</kbd></button>`}</div>`;
    return;
  }
  $('#collection-content').innerHTML = state.results.map((result, index) => {
    const item = result.item;
    if (result.kind === 'object') {
      const groups = item.groupIds.map(id => findGroup(id)?.name).filter(Boolean).join(' · ');
      const inCurrentGroup = state.groupId && item.groupIds.includes(state.groupId);
      return `<div class="object-list-item"><button class="object-row ${state.selectedId === item.id ? 'selected' : ''}" data-result="${index}" aria-pressed="${state.selectedId === item.id}"><span class="object-icon">◇</span><span class="row-main"><span class="row-title">${escapeHtml(item.name)}</span>${groups ? `<span class="row-description">${escapeHtml(groups)}</span>` : ''}</span><span class="row-meta">›</span></button>${inCurrentGroup ? `<button class="remove-from-group-row" data-remove-group-object="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} uit deze categorie verwijderen" title="Uit categorie verwijderen; onderwerp en notities blijven bewaard">Uit categorie <span aria-hidden="true">×</span></button>` : ''}</div>`;
    }
    if (result.kind === 'note-cluster') return `<button class="object-row note-cluster-row" data-result="${index}"><span class="object-icon" aria-label="Notitiecluster">▤</span><span class="row-main"><span class="row-title">${escapeHtml(item.subject)}</span><span class="row-description">${escapeHtml(findNoteGroup(item.source.categoryId)?.name || item.source.categoryName)} · ${item.notes.length} onderwerpen</span><span class="row-description">${escapeHtml(item.notes.map(note => ownerName(note.owner)).join(' · '))}</span></span><span class="row-meta"><span class="pill">Samen bewerken</span>${escapeHtml(item.date)}</span></button>`;
    if (result.kind === 'group') return `<button class="object-row" data-result="${index}"><span class="object-icon">○</span><span class="row-main"><span class="row-title">${escapeHtml(item.name)}</span><span class="row-description">Open categorie</span></span><span class="row-meta"><span class="count">${state.data.objects.filter(object => object.groupIds.includes(item.id)).length}</span> ›</span></button>`;
    return `<button class="object-row" data-result="${index}">${noteOwnerIcon(item.owner)}<span class="row-main"><span class="row-title">${escapeHtml(item.subject)}</span><span class="row-description">${escapeHtml([ownerName(item.owner), ownerContext(item.owner)].filter(Boolean).join(' · '))}</span><span class="row-description">${escapeHtml(item.body.slice(0, 130).replace(/\n/g, ' '))}</span></span><span class="row-meta">${notePointsBadge(item)}${escapeHtml(item.date)}</span></button>`;
  }).join('');
}
function renderDetail() {
  if (state.view === 'groups') {
    $('#detail').innerHTML = '<div class="detail-empty"><div class="empty-symbol">○</div><h3>Alle categorieën bij elkaar</h3><p>Open een categorie om de onderwerpen en categorienotities te bekijken. De volgorde volgt de categorieën in de zijbalk.</p><button class="button" data-action="new-group">+ Categorie toevoegen <kbd>Ctrl ⇧ G</kbd></button></div>';
    return;
  }
  if (state.view === 'notes' && !state.groupId && !selectedObject()) {
    $('#detail').innerHTML = `<div class="detail-empty"><div class="empty-symbol">▤</div><h3>Alle notities bij elkaar</h3><p>Bekijk de notities van alle onderwerpen en categorieën. Bij elke notitie staat waar deze bij hoort.</p><p class="field-hint">Open een notitie om deze te lezen of te bewerken.</p><button class="button" data-action="new-note">+ Notitie schrijven <kbd>Ctrl ⇧ N</kbd></button></div>`;
    return;
  }
  const object = selectedObject(), group = activeGroup();
  if (!object && !group) {
    $('#detail').innerHTML = `<div class="detail-empty"><div class="empty-symbol">◇</div><h3>Een plek voor elk detail</h3><p>Selecteer een onderwerp om de categorieën en notities te bekijken.</p><div class="hint">Ook een persoon is een onderwerp.<br>Voeg een naam toe en houd alle bijbehorende notities bij elkaar.</div></div>`;
    return;
  }
  const item = object || group;
  const owner = object ? { kind: 'object', id: object.id, ...(state.noteGroupId ? { groupId: state.noteGroupId } : {}) } : { kind: 'group', id: group.id };
  const notes = state.data.notes.filter(note => object
    ? note.owner.kind === 'object' && note.owner.id === object.id
    : sameOwner(note.owner, owner)).sort(compareNotesNewestFirst);
  $('#detail').innerHTML = `<div class="detail-top"><div class="object-icon">${object ? '◇' : '○'}</div><button class="icon-button" data-action="edit-selected" title="Bewerken · Ctrl E" aria-label="Bewerken (Ctrl E)">✎</button></div><div class="eyebrow">${object ? 'ONDERWERP' : 'CATEGORIE'}</div><h2>${escapeHtml(item.name)}</h2>
    ${object ? `<section class="detail-section"><div class="section-heading"><h3>Categorieën</h3><button data-action="edit-memberships" title="Categorieën wijzigen · Ctrl Shift M" class="icon-button" aria-label="Categorieën wijzigen (Ctrl Shift M)">+</button></div><div class="chips">${object.groupIds.length ? object.groupIds.map(id => `<button data-group="${escapeHtml(id)}">○ ${escapeHtml(findGroup(id)?.name || 'Onbekende categorie')}</button>`).join('') : '<span class="field-hint">Dit onderwerp staat nog niet in een categorie.</span>'}</div><span class="field-hint"><kbd>Ctrl ⇧ M</kbd> categorieën wijzigen</span>${group && object.groupIds.includes(group.id) ? `<button class="button remove-from-group-detail" data-remove-group-object="${escapeHtml(object.id)}">Uit deze categorie verwijderen <kbd>Ctrl ⇧ Del</kbd></button>` : ''}</section>` : `<span class="field-hint">${state.data.objects.filter(object => object.groupIds.includes(group.id)).length} onderwerpen in deze categorie</span><button class="button" data-action="group-object-notes">Notities voor alle onderwerpen <kbd>Ctrl Alt N</kbd></button>`}
    <section class="detail-section"><div class="section-heading"><h3>${object ? 'Notities bij dit onderwerp' : 'Categorienotities'}</h3><span class="count">${notes.length}</span></div>

    ${notes.length ? notes.map(note => `<button class="mini-note" data-note="${state.data.notes.indexOf(note)}"><strong class="mini-note-title">${noteOwnerIcon(note.owner, true)}<span>${escapeHtml(note.subject)}</span></strong>${notePointsBadge(note)}<small>${escapeHtml([note.date, ownerContext(note.owner)].filter(Boolean).join(' · '))}</small><p>${escapeHtml(note.body)}</p></button>`).join('') : '<p class="field-hint">Nog geen notities toegevoegd.<br>Leg een gedachte, afspraak of update vast.</p>'}
    <button class="button" data-action="new-note">+ Notitie schrijven <kbd>Ctrl ⇧ N</kbd></button></section><div class="detail-section"><span class="field-hint">Toegevoegd op ${escapeHtml(item.createdAt.slice(0, 10))}<br>Opgeslagen als CSV & Markdown.</span>${!object && group ? '<button class="button danger" data-action="delete-group">Categorie verwijderen <kbd>Ctrl Alt Del</kbd></button><span class="field-hint">Onderwerpen en notities blijven bewaard.</span>' : ''}</div>`;
}
function openEditor(title, description, fields, editor, note = false) {
  if ($('#editor-dialog').open) return;
  previousFocus = document.activeElement;
  state.editor = editor;
  $('#save-editor').innerHTML = 'Opslaan <kbd>Ctrl ↵</kbd>';
  $('#dialog-hint').innerHTML = '<kbd>Esc</kbd> annuleren';
  $('#editor-dialog').classList.toggle('note-dialog', note);
  $('#editor-content').innerHTML = `<div class="dialog-heading"><div class="eyebrow">${note ? 'MARKDOWN-NOTITIE' : 'U-TRACK'}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="form-fields">${fields}<div id="form-error" class="error-inline" role="alert"></div></div>`;
  $('#save-editor').disabled = false;
  $('#editor-dialog').showModal();
  requestAnimationFrame(() => $('#editor-content input, #editor-content select, #editor-content textarea')?.focus());
}
function closeEditor() {
  if (state.saving) return;
  if (state.editor && readEditorSignature() !== state.editor.original && !confirmStandardText('Je hebt niet-opgeslagen wijzigingen. Toch sluiten?')) return;
  $('#editor-dialog').close(); state.editor = null; previousFocus?.focus();
}
function readEditorSignature() { return JSON.stringify({ fields: [...new FormData($('#editor-form')).entries()], objects: state.editor?.pendingObjects || [] }); }
function rememberEditorValues() { state.editor.original = readEditorSignature(); }
function openObjectEditor(object = null) {
  if (!object && activeGroup()) { openAddObjectsToGroup(); return; }
  const selectedGroups = object?.groupIds || (state.groupId ? [state.groupId] : []);
  openEditor(object ? 'Onderwerp bewerken' : 'Onderwerp toevoegen', 'Geef het onderwerp een naam en kies eventueel één of meer categorieën.',
    `<label class="field">Naam<input name="name" required maxlength="200" value="${escapeHtml(object?.name || '')}" placeholder="Bijvoorbeeld: Camera of Noor de Vries"></label><div class="field">Categorieën<span class="field-hint">Selecteer één of meer categorieën. Je selectie blijft behouden tijdens het zoeken.</span><div class="note-owner-search object-group-search"><span aria-hidden="true">⌕</span><input id="object-group-search" type="search" aria-label="Categorieën zoeken" placeholder="Zoek categorieën op naam…" autocomplete="off"><kbd>Ctrl F</kbd></div><div id="object-group-count" class="field-hint" role="status" aria-live="polite"></div><div id="object-group-options" class="checkboxes">${state.data.groups.length ? state.data.groups.map(group => `<label class="check-label" data-object-group-name="${escapeHtml(group.name)}"><input type="checkbox" name="groupIds" value="${escapeHtml(group.id)}" ${selectedGroups.includes(group.id) ? 'checked' : ''}>${escapeHtml(group.name)}</label>`).join('') : '<span class="field-hint">Maak eerst een categorie aan met Ctrl Shift G. Je kunt het onderwerp nu al opslaan.</span>'}</div><p id="object-group-empty" class="field-hint hidden">Geen categorieën gevonden. Probeer een andere naam.</p></div>`, { kind: 'object', item: object });
  $('#object-group-search').addEventListener('input', filterObjectGroups);
  $('#object-group-options').addEventListener('change', filterObjectGroups);
  $('#object-group-search').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); }
    if (event.key === 'Escape' && event.target.value) { event.preventDefault(); event.stopPropagation(); event.target.value = ''; filterObjectGroups(); }
  });
  filterObjectGroups();
  rememberEditorValues();
}
function filterObjectGroups() {
  const terms = normalizeSearch($('#object-group-search').value).trim().split(/\s+/).filter(Boolean);
  const options = [...document.querySelectorAll('[data-object-group-name]')];
  let visible = 0;
  for (const option of options) {
    const matches = terms.every(term => normalizeSearch(option.dataset.objectGroupName).includes(term));
    option.classList.toggle('hidden', !matches); if (matches) visible++;
  }
  const selected = $('#editor-form').querySelectorAll('[name="groupIds"]:checked').length;
  $('#object-group-count').textContent = `${visible} van ${options.length} categorieën zichtbaar · ${selected} geselecteerd`;
  $('#object-group-empty').classList.toggle('hidden', visible > 0 || options.length === 0);
}
function openAddObjectsToGroup() {
  const group = activeGroup();
  if (!group) { showToast('Open eerst een categorie.'); return; }
  openEditor('Onderwerpen toevoegen', `Zoek bestaande onderwerpen of voeg nieuwe toe aan ${group.name}.`, groupObjectFields(), { kind: 'add-group-objects', groupId: group.id, pendingObjects: [], objectOptions: [], activeObjectOption: -1 });
  $('#save-editor').innerHTML = 'Onderwerpen toevoegen <kbd>Ctrl ↵</kbd>';
  initializeGroupObjectInput(); rememberEditorValues();
}
function openGroupEditor(group = null) {
  openEditor(group ? 'Categorie bewerken' : 'Categorie toevoegen', group ? 'Pas de naam van je categorie aan.' : 'Geef je categorie een naam en voeg meteen de eerste onderwerpen toe.', `<label class="field">Categorienaam<input name="name" required maxlength="200" value="${escapeHtml(group?.name || '')}" placeholder="Bijvoorbeeld: Werkplaats"></label>${group ? '' : groupObjectFields()}`, { kind: 'group', item: group, pendingObjects: [], objectOptions: [], activeObjectOption: -1 });
  if (!group) {
    $('#save-editor').innerHTML = 'Categorie aanmaken <kbd>Ctrl ↵</kbd>';
    initializeGroupObjectInput();
  }
  rememberEditorValues();
}
function groupObjectFields() {
  return `<section class="group-object-section"><div class="section-heading"><h3>Onderwerpen toevoegen</h3><span id="pending-object-count" class="count">0</span></div><p class="group-object-description">Typ een naam. Kies een bestaand onderwerp of voeg een nieuw onderwerp toe.</p><div id="group-object-composer"><div class="group-object-input-row"><input id="group-object-input" name="pendingObjectName" maxlength="200" placeholder="Naam van een onderwerp of persoon…" role="combobox" aria-label="Onderwerpen toevoegen" aria-autocomplete="list" aria-expanded="false" aria-controls="group-object-options" aria-describedby="group-object-hint" autocomplete="off"><button type="button" id="add-group-object" class="button" aria-label="Onderwerp toevoegen aan de lijst">Toevoegen <kbd>↵</kbd></button></div><div id="group-object-suggestions" class="group-object-suggestions hidden"><div class="suggestion-label">BESTAANDE ONDERWERPEN</div><div id="group-object-options" role="listbox" aria-label="Voorgestelde onderwerpen"></div></div></div><p id="group-object-hint" class="field-hint"><kbd>Enter</kbd> toevoegen · <kbd>↑</kbd> <kbd>↓</kbd> suggestie kiezen<br>Je kunt ook meerdere namen plakken, elk op een eigen regel.</p><div id="pending-group-objects" class="pending-group-objects"></div><p id="group-object-status" class="field-hint" role="status" aria-live="polite"></p></section>`;
}
function initializeGroupObjectInput() {
  const input = $('#group-object-input');
  input.addEventListener('input', () => renderGroupObjectSuggestions());
  input.addEventListener('keydown', handleGroupObjectKeydown);
  input.addEventListener('paste', handleGroupObjectPaste);
  $('#add-group-object').addEventListener('click', () => chooseGroupObject());
  renderPendingGroupObjects();
}
function renderPendingGroupObjects() {
  const objects = state.editor.pendingObjects;
  $('#pending-object-count').textContent = objects.length;
  $('#pending-group-objects').innerHTML = objects.length ? objects.map((object, index) => `<div class="pending-object"><span class="pending-object-icon">${object.id ? '◇' : '+'}</span><span class="pending-object-name">${escapeHtml(object.name)}<small>${object.id ? 'Bestaand onderwerp · wordt gekoppeld' : 'Nieuw onderwerp'}</small></span><button type="button" class="remove-pending-object" data-remove-pending="${index}" aria-label="${escapeHtml(object.name)} uit de lijst verwijderen" title="Uit lijst verwijderen">×</button></div>`).join('') : '<div class="pending-objects-empty">Nog geen onderwerpen toegevoegd. Je kunt ze ook later toevoegen.</div>';
}
function renderGroupObjectSuggestions(keepSelection = false) {
  const editor = state.editor, input = $('#group-object-input');
  const name = input.value.trim(), query = normalizeSearch(name);
  const linkedNames = new Set(editor.groupId ? state.data.objects.filter(object => object.groupIds.includes(editor.groupId)).map(object => normalizeSearch(object.name)) : []);
  const pendingNames = new Set(editor.pendingObjects.map(object => normalizeSearch(object.name)));
  const selectedNames = new Set([...linkedNames, ...pendingNames]);
  const candidates = [...state.data.objects, ...editor.pendingObjects.filter(object => !object.id)];
  const matches = query ? candidates.filter(object => normalizeSearch(object.name).includes(query))
    .sort((a, b) => Number(normalizeSearch(b.name) === query) - Number(normalizeSearch(a.name) === query) || a.name.localeCompare(b.name, 'nl')).slice(0, 6) : [];
  const exactMatches = matches.filter(object => normalizeSearch(object.name) === query);
  editor.objectOptions = matches.map(object => ({ id: object.id, name: object.name, status: linkedNames.has(normalizeSearch(object.name)) ? 'Al in deze categorie' : pendingNames.has(normalizeSearch(object.name)) ? 'Al in de lijst' : '' }));
  if (name && !exactMatches.length && !selectedNames.has(query)) editor.objectOptions.push({ name });
  if (!keepSelection) editor.activeObjectOption = exactMatches.length ? 0 : editor.objectOptions.length - 1;
  const options = editor.objectOptions;
  $('#group-object-suggestions').classList.toggle('hidden', !options.length);
  $('#group-object-suggestions .suggestion-label').textContent = matches.length ? 'GEVONDEN ONDERWERPEN' : 'NIEUW ONDERWERP';
  $('#group-object-options').innerHTML = options.map((object, index) => `<button type="button" tabindex="-1" role="option" id="group-object-option-${index}" aria-selected="${index === editor.activeObjectOption}" aria-disabled="${Boolean(object.status)}" class="group-object-option ${index === editor.activeObjectOption ? 'active' : ''} ${object.status ? 'already-added' : ''}" data-object-option="${index}"><span class="suggestion-icon">${object.id ? '◇' : '+'}</span><span><strong>${object.id || object.status ? escapeHtml(object.name) : `‘${escapeHtml(object.name)}’ aanmaken`}</strong><small>${object.status ? escapeHtml(object.status) : object.id ? 'Toevoegen als bestaand onderwerp' : 'Nieuw onderwerp toevoegen aan deze categorie'}</small></span>${object.status ? '<span class="already-added-mark" aria-hidden="true">✓</span>' : index === editor.activeObjectOption ? '<kbd>↵</kbd>' : ''}</button>`).join('');
  const selectedOption = $('#group-object-options [aria-selected="true"]');
  if (selectedOption) {
    const list = $('#group-object-options'), bounds = list.getBoundingClientRect(), selectedBounds = selectedOption.getBoundingClientRect();
    if (selectedBounds.bottom > bounds.bottom) list.scrollTop += selectedBounds.bottom - bounds.bottom;
    else if (selectedBounds.top < bounds.top) list.scrollTop -= bounds.top - selectedBounds.top;
  }
  input.setAttribute('aria-expanded', String(Boolean(options.length)));
  if (options.length) input.setAttribute('aria-activedescendant', `group-object-option-${editor.activeObjectOption}`);
  else input.removeAttribute('aria-activedescendant');
  $('#group-object-status').textContent = query && linkedNames.has(query) ? 'Dit onderwerp staat al in deze categorie.' : query && selectedNames.has(query) ? 'Dit onderwerp staat al in de lijst.' : '';
}
function addPendingGroupObject(object) {
  const editor = state.editor;
  if (editor.groupId && object.id && findObject(object.id)?.groupIds.includes(editor.groupId)) return;
  if (editor.pendingObjects.some(item => (object.id && item.id === object.id) || normalizeSearch(item.name) === normalizeSearch(object.name))) return;
  editor.pendingObjects.push(object);
  if (editor.kind === 'group-object-notes') {
    const index = editor.objects.length;
    editor.objects.push(object);
    $('.batch-note-list').insertAdjacentHTML('beforeend', renderBatchNoteObject(object, index, true));
    $('#batch-note-search').value = '';
    filterBatchNoteObjects(); updateGroupObjectNoteCount();
  }
  renderPendingGroupObjects();
}
function chooseGroupObject(index = state.editor.activeObjectOption) {
  const object = state.editor.objectOptions[index];
  if (object?.status) {
    $('#group-object-status').textContent = `${object.name}: ${object.status.toLowerCase()}.`;
    $('#group-object-input').focus(); return;
  }
  if (object) addPendingGroupObject(object);
  $('#group-object-input').value = '';
  renderGroupObjectSuggestions();
  $('#group-object-input').focus();
  if (object) $('#group-object-status').textContent = `${object.name} toegevoegd. Typ de volgende naam.`;
  if (object && state.editor.kind === 'group-object-notes') $(`#batch-note-${state.editor.objects.length - 1}`)?.focus();
}
function handleGroupObjectKeydown(event) {
  if (event.isComposing) return;
  const editor = state.editor;
  if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); chooseGroupObject(); }
  else if (['ArrowDown', 'ArrowUp'].includes(event.key) && editor.objectOptions.length) {
    event.preventDefault(); event.stopPropagation();
    editor.activeObjectOption = (editor.activeObjectOption + (event.key === 'ArrowDown' ? 1 : -1) + editor.objectOptions.length) % editor.objectOptions.length;
    renderGroupObjectSuggestions(true);
  } else if (event.key === 'Escape' && !$('#group-object-suggestions').classList.contains('hidden')) {
    event.preventDefault(); event.stopPropagation(); $('#group-object-suggestions').classList.add('hidden');
    event.target.setAttribute('aria-expanded', 'false'); event.target.removeAttribute('aria-activedescendant');
  }
}
function handleGroupObjectPaste(event) {
  const text = event.clipboardData.getData('text');
  if (!/[\r\n]/.test(text)) return;
  event.preventDefault();
  for (const name of text.split(/\r?\n|\r/).map(value => value.trim()).filter(Boolean)) {
    if (name.length > 200) { $('#group-object-status').textContent = 'Een naam is te lang (maximaal 200 tekens).'; continue; }
    const matches = state.data.objects.filter(object => normalizeSearch(object.name) === normalizeSearch(name));
    // Ambiguous names stay in the input so the user can choose the right object.
    if (matches.length > 1) { event.target.value = name; renderGroupObjectSuggestions(); $('#group-object-status').textContent = 'Meerdere onderwerpen met deze naam. Kies het juiste onderwerp.'; return; }
    addPendingGroupObject(matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : { name });
  }
  event.target.value = ''; renderGroupObjectSuggestions();
  $('#group-object-status').textContent = 'Namen toegevoegd. Controleer de lijst voordat je de categorie aanmaakt.';
}
function openNoteEditor(note = null) {
  if (note) { showNoteForm(note.owner, note); return; }
  const object = selectedObject(), group = activeGroup();
  if (object) { showNoteForm({ kind: 'object', id: object.id }); return; }
  if (group) { showNoteForm({ kind: 'group', id: group.id }); return; }
  const options = [...state.data.objects.map(object => ({ owner: { kind: 'object', id: object.id }, name: `${object.name} · Onderwerp` })), ...state.data.groups.map(group => ({ owner: { kind: 'group', id: group.id }, name: `${group.name} · Categorie` }))];
  if (!options.length) { showToast('Voeg eerst een onderwerp of categorie toe om een notitie te schrijven.'); return; }
  openEditor('Waar hoort je notitie bij?', 'Zoek een onderwerp of categorie en kies waar je notitie bij hoort.', `<label class="field" for="note-owner-search">Onderwerp of categorie zoeken</label><div class="note-owner-search"><span aria-hidden="true">⌕</span><input id="note-owner-search" type="search" placeholder="Typ een naam…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="note-owner-results" aria-describedby="note-owner-hint"></div><p id="note-owner-hint" class="field-hint"><kbd>↑</kbd> <kbd>↓</kbd> kiezen · <kbd>Enter</kbd> verder</p><div id="note-owner-count" class="list-caption" role="status" aria-live="polite"></div><div id="note-owner-results" class="note-owner-results" role="listbox" aria-label="Gevonden onderwerpen en categorieën"></div>`, { kind: 'choose-owner', options, filteredOwners: [], activeOwnerIndex: 0 });
  $('#note-owner-search').addEventListener('input', () => renderNoteOwnerResults());
  $('#note-owner-search').addEventListener('keydown', event => {
    if (event.isComposing) return;
    const editor = state.editor;
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && editor.filteredOwners.length) {
      event.preventDefault(); event.stopPropagation();
      editor.activeOwnerIndex = (editor.activeOwnerIndex + (event.key === 'ArrowDown' ? 1 : -1) + editor.filteredOwners.length) % editor.filteredOwners.length;
      renderNoteOwnerResults(true);
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault(); event.stopPropagation(); $('#editor-form').requestSubmit();
    }
  });
  $('#save-editor').innerHTML = 'Verder <kbd>Ctrl ↵</kbd>';
  renderNoteOwnerResults(); rememberEditorValues();
}
function renderNoteOwnerResults(keepSelection = false) {
  const editor = state.editor, query = normalizeSearch($('#note-owner-search').value).trim();
  editor.filteredOwners = editor.options.filter(option => query.split(/\s+/).every(term => normalizeSearch(option.name).includes(term)));
  if (!keepSelection) editor.activeOwnerIndex = 0;
  $('#note-owner-count').textContent = `${editor.filteredOwners.length} ${editor.filteredOwners.length === 1 ? 'resultaat' : 'resultaten'}`;
  $('#note-owner-results').innerHTML = editor.filteredOwners.length ? editor.filteredOwners.map((option, index) => {
    const isObject = option.owner.kind === 'object';
    const groups = isObject ? findObject(option.owner.id).groupIds.map(id => findGroup(id)?.name).filter(Boolean).join(' · ') : '';
    return `<button type="button" role="option" aria-selected="${index === editor.activeOwnerIndex}" id="note-owner-option-${index}" class="note-owner-option ${index === editor.activeOwnerIndex ? 'active' : ''}" data-note-owner="${index}"><span class="object-icon">${isObject ? '◇' : '○'}</span><span class="note-owner-name"><strong>${escapeHtml(ownerName(option.owner))}</strong><small>${isObject ? 'Onderwerp' : 'Categorie'}${groups ? ` · ${escapeHtml(groups)}` : ''}</small></span><span aria-hidden="true">›</span></button>`;
  }).join('') : '<div class="note-owner-empty">Geen onderwerpen of categorieën gevonden.<br>Probeer een andere naam.</div>';
  const active = $(`#note-owner-option-${editor.activeOwnerIndex}`);
  if (active) {
    $('#note-owner-search').setAttribute('aria-activedescendant', active.id);
    const list = $('#note-owner-results'), bounds = list.getBoundingClientRect(), activeBounds = active.getBoundingClientRect();
    if (activeBounds.bottom > bounds.bottom) list.scrollTop += activeBounds.bottom - bounds.bottom;
    else if (activeBounds.top < bounds.top) list.scrollTop -= bounds.top - activeBounds.top;
  } else $('#note-owner-search').removeAttribute('aria-activedescendant');
  $('#save-editor').disabled = !editor.filteredOwners.length;
  $('#form-error').textContent = '';
}
function chooseNoteOwner(index = state.editor.activeOwnerIndex) {
  const option = state.editor.filteredOwners[index];
  if (!option) { $('#form-error').textContent = 'Kies eerst een onderwerp of categorie uit de resultaten.'; return; }
  $('#editor-dialog').close(); state.editor = null; showNoteForm(option.owner);
}

function showNoteForm(owner, note = null) {
  const noteId = note?.id || crypto.randomUUID();
  openEditor(note ? 'Notitie bewerken' : 'Notitie schrijven', ownerName(owner), `<div class="field-row"><label class="field">Onderwerp<input name="subject" required maxlength="200" value="${escapeHtml(note?.subject || '')}" placeholder="Bijvoorbeeld: Eerste kennismaking"></label><label class="field">Datum<input name="date" required type="date" value="${escapeHtml(note?.date || today())}"></label><label class="field note-points-field">Punten <span class="optional-label">optioneel</span><input name="points" type="number" step="any" inputmode="decimal" placeholder="Geen" value="${escapeHtml(note?.points ?? '')}"></label></div><label class="field" id="body-label">Notitie<textarea name="body" class="note-body" placeholder="Schrijf je notitie… Markdown is welkom.">${escapeHtml(note?.body || '')}</textarea></label><div id="note-preview" class="note-preview hidden"></div><div class="editor-toolbar"><span class="field-hint" id="filename-preview"></span><button type="button" id="toggle-preview">Voorbeeld <kbd>Ctrl P</kbd></button></div>${note ? '<button type="button" id="delete-note" class="button danger">Notitie verwijderen</button>' : ''}`, { kind: 'note', owner, item: note, noteId }, true);
  $('#save-editor').innerHTML = 'Opslaan <kbd>Ctrl ↵</kbd>'; rememberEditorValues(); updateFilenamePreview();
}
function openGroupObjectNotesEditor(cluster = null) {
  if (!cluster?.notes) cluster = null;
  const group = cluster ? findNoteGroup(cluster.source.categoryId) : activeGroup();
  if (!group) { showToast('Open eerst een categorie.'); return; }
  const objects = state.data.objects.filter(object => cluster ? cluster.notes.some(note => note.owner.id === object.id) : object.groupIds.includes(group.id)).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  openEditor('Notities voor alle onderwerpen', `${group.name} · Eén onderwerp, een eigen notitie per onderwerp.`, `<div class="field-row"><label class="field">Onderwerp voor alle notities<input name="subject" required maxlength="200" placeholder="Bijvoorbeeld: Voortgangsoverleg"></label><label class="field">Datum<input name="date" type="date" required value="${today()}"></label></div><div class="batch-note-heading"><h3>Notities per onderwerp</h3><span id="batch-note-count" class="count">0 van ${objects.length} ingevuld</span></div><div class="batch-note-toolbar"><div class="note-owner-search"><span aria-hidden="true">⌕</span><input id="batch-note-search" type="search" aria-label="Onderwerpen in notitieformulier zoeken" placeholder="Zoek onderwerpen op naam…" autocomplete="off"><kbd>Ctrl F</kbd></div><button type="button" id="batch-toggle-add" class="button">+ Onderwerp toevoegen <kbd>Ctrl N</kbd></button></div><div id="batch-note-visible-count" class="field-hint" role="status" aria-live="polite"></div><details id="batch-inline-add" class="batch-inline-add"><summary>Onderwerp aan de categorie toevoegen</summary><p class="field-hint">Zoek een bestaand onderwerp of typ een nieuwe naam. Het onderwerp wordt bij opslaan aan de categorie toegevoegd.</p>${groupObjectFields()}</details><p class="field-hint">Voor elk onderwerp wordt een notitie opgeslagen. Lege tekstvelden krijgen een streepje (-), ook bij onderwerpen die door je zoekopdracht verborgen zijn.</p><div class="batch-note-list">${objects.map((object, index) => renderBatchNoteObject(object, index)).join('')}</div><div id="batch-note-no-results" class="note-owner-empty hidden"><p>Geen onderwerpen gevonden. Pas je zoekopdracht aan of voeg een onderwerp toe.</p><button type="button" class="button" data-action="batch-add-object">+ Onderwerp toevoegen</button></div>`, { kind: 'group-object-notes', groupId: group.id, objects, batchId: cluster?.source.batchId || crypto.randomUUID(), savedNotes: Object.fromEntries((cluster?.notes || []).map(note => [note.owner.id, note.fileName])), noteOwners: Object.fromEntries((cluster?.notes || []).map(note => [note.owner.id, note.owner])), pendingObjects: [], objectOptions: [], activeObjectOption: -1 }, true);
  $('#editor-dialog .eyebrow').textContent = 'NOTITIES PER ONDERWERP';
  $('#save-editor').innerHTML = 'Notities opslaan <kbd>Ctrl ↵</kbd>';
  $('#batch-note-search').addEventListener('input', filterBatchNoteObjects);
  $('#batch-note-search').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); }
    if (event.key === 'Escape' && event.target.value) { event.preventDefault(); event.stopPropagation(); event.target.value = ''; filterBatchNoteObjects(); }
  });
  $('#batch-toggle-add').addEventListener('click', openBatchAddObjectInput);
  initializeGroupObjectInput();
  if (cluster) {
    $('#editor-dialog h2').textContent = 'Notitiecluster bewerken';
    $('[name=subject]').value = cluster.subject;
    $('[name=date]').value = cluster.date;
    objects.forEach((object, index) => {
      const note = cluster.notes.find(note => note.owner.id === object.id);
      $(`#batch-note-${index}`).value = note.body;
      $(`#batch-points-${index}`).value = note.points ?? '';
    });
    if (group.deletedAt) { $('#batch-toggle-add').classList.add('hidden'); $('#batch-inline-add').classList.add('hidden'); }
  }
  filterBatchNoteObjects(); updateGroupObjectNoteCount(); rememberEditorValues();
}
function renderBatchNoteObject(object, index, added = false) {
  return `<div class="batch-note-object" data-batch-note-index="${index}"><div class="batch-note-object-header"><label for="batch-note-${index}"><span class="batch-note-icon" aria-hidden="true">◇</span>${escapeHtml(object.name)}${added ? '<small>Wordt aan categorie toegevoegd</small>' : ''}</label>${added ? `<button type="button" class="remove-pending-object" data-remove-batch-object="${index}" aria-label="${escapeHtml(object.name)} uit dit formulier verwijderen">×</button>` : ''}</div><div class="batch-note-entry-fields"><textarea id="batch-note-${index}" name="objectNote-${index}" rows="3" maxlength="2000000" placeholder="Notitie voor ${escapeHtml(object.name)}…"></textarea><label class="batch-note-points" for="batch-points-${index}">Punten <span class="optional-label">optioneel</span><input id="batch-points-${index}" name="objectPoints-${index}" type="number" step="any" inputmode="decimal" placeholder="Geen"></label></div></div>`;
}
function filterBatchNoteObjects() {
  const editor = state.editor;
  if (editor?.kind !== 'group-object-notes') return;
  const terms = normalizeSearch($('#batch-note-search').value).trim().split(/\s+/).filter(Boolean);
  let visible = 0;
  document.querySelectorAll('[data-batch-note-index]').forEach(card => {
    const object = editor.objects[Number(card.dataset.batchNoteIndex)];
    const matches = !object.excluded && terms.every(term => normalizeSearch(object.name).includes(term));
    card.classList.toggle('hidden', !matches); if (matches) visible++;
  });
  const total = editor.objects.filter(object => !object.excluded).length;
  $('#batch-note-visible-count').textContent = `${visible} van ${total} onderwerpen zichtbaar`;
  $('#batch-note-no-results').classList.toggle('hidden', visible > 0);
}
function openBatchAddObjectInput() {
  if (state.editor?.kind !== 'group-object-notes') return;
  $('#batch-inline-add').open = true;
  $('#group-object-input').value = $('#batch-note-search').value.trim();
  renderGroupObjectSuggestions(); $('#group-object-input').focus();
}
function removeBatchNoteObject(index) {
  const editor = state.editor, object = editor.objects[index];
  const textarea = $(`#batch-note-${index}`);
  if ((textarea.value.trim() || $(`#batch-points-${index}`).value !== '') && !confirmStandardText('Dit onderwerp uit het formulier verwijderen? De ingevulde notitietekst en punten vervallen.')) return;
  object.excluded = true;
  editor.pendingObjects = editor.pendingObjects.filter(item => item !== object);
  $(`[data-batch-note-index="${index}"]`).remove();
  renderPendingGroupObjects(); renderGroupObjectSuggestions();
  filterBatchNoteObjects(); updateGroupObjectNoteCount();
}
function updateGroupObjectNoteCount() {
  if (state.editor?.kind !== 'group-object-notes') return;
  const values = new FormData($('#editor-form'));
  const objects = state.editor.objects;
  const count = objects.filter((object, index) => !object.excluded && (String(values.get(`objectNote-${index}`) || '').trim() || String(values.get(`objectPoints-${index}`) || '').trim())).length;
  $('#batch-note-count').textContent = `${count} van ${objects.filter(object => !object.excluded).length} ingevuld`;
}
function updateFilenamePreview() {
  if (state.editor?.kind !== 'note') return;
  const form = new FormData($('#editor-form'));
  const slug = String(form.get('subject')).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90).replace(/-$/, '') || 'onderwerp';
  $('#filename-preview').textContent = `${String(form.get('date') || '').slice(2) || 'yy-mm-dd'}--${slug}--${state.editor.noteId}.md`;
}
function toggleMarkdownPreview() {
  if (state.editor?.kind !== 'note') return;
  const preview = $('#note-preview'), textarea = $('textarea[name="body"]');
  preview.classList.toggle('hidden'); $('#body-label').classList.toggle('hidden');
  preview.innerHTML = escapeHtml(textarea.value).replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h2>$1</h2>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
  $('#toggle-preview').innerHTML = `${preview.classList.contains('hidden') ? 'Voorbeeld' : 'Verder schrijven'} <kbd>Ctrl P</kbd>`;
}
async function saveEditor(event) {
  event.preventDefault(); if (state.saving) return;
  const invalidField = $('#editor-form :invalid');
  if (state.editor?.kind === 'group-object-notes' && invalidField?.closest('[data-batch-note-index]')?.classList.contains('hidden')) {
    $('#batch-note-search').value = ''; filterBatchNoteObjects();
  }
  if (!$('#editor-form').reportValidity()) return;
  const editor = state.editor, values = new FormData($('#editor-form'));
  if ((editor.kind === 'group-object-notes' || editor.kind === 'add-group-objects' || (editor.kind === 'group' && !editor.item)) && $('#group-object-input').value.trim()) chooseGroupObject();
  if (editor.kind === 'choose-owner') {
    chooseNoteOwner(); return;
  }
  state.saving = true; $('#save-editor').disabled = true;
  try {
    if (editor.kind === 'add-group-objects') {
      if (!editor.pendingObjects.length) throw new Error('Zoek een onderwerp of typ een nieuwe naam om toe te voegen.');
      for (const pending of editor.pendingObjects) {
        const existing = findObject(pending.id);
        const object = await api.saveObject(existing ? { ...existing, groupIds: [...new Set([...existing.groupIds, editor.groupId])] } : { id: pending.savedId, name: pending.name, groupIds: [editor.groupId] });
        pending.savedId = object.id;
      }
      state.groupId = editor.groupId; state.selectedId = null; state.view = 'objects'; state.query = ''; $('#search').value = '';
    } else if (editor.kind === 'object') {
      const object = await api.saveObject({ ...editor.item, name: values.get('name'), groupIds: values.getAll('groupIds') });
      state.selectedId = object.id; state.noteGroupId = state.groupId && object.groupIds.includes(state.groupId) ? state.groupId : '';
      if (state.groupId && !object.groupIds.includes(state.groupId)) { state.groupId = null; }
      state.view = 'objects'; state.query = ''; $('#search').value = '';
    } else if (editor.kind === 'group') {
      const group = await api.saveGroup({ id: editor.item?.id || editor.savedGroupId, name: values.get('name') });
      editor.savedGroupId = group.id;
      for (const pending of editor.pendingObjects) {
        const existing = findObject(pending.id);
        const object = await api.saveObject(existing ? { ...existing, groupIds: [...new Set([...existing.groupIds, group.id])] } : { id: pending.savedId, name: pending.name, groupIds: [group.id] });
        pending.savedId = object.id;
      }
      state.groupId = group.id; state.selectedId = null; state.view = 'objects'; state.query = ''; $('#search').value = '';
    } else if (editor.kind === 'group-object-notes') {
      const entries = editor.objects.map((object, index) => ({ object, body: String(values.get(`objectNote-${index}`) || '').trim() ? String(values.get(`objectNote-${index}`)) : '-', points: String(values.get(`objectPoints-${index}`) || '') })).filter(entry => !entry.object.excluded);
      if (!entries.length && !editor.pendingObjects.length) throw new Error('Voeg minstens één onderwerp toe.');
      for (const pending of editor.pendingObjects) {
        const existing = findObject(pending.id);
        const object = await api.saveObject(existing ? { ...existing, groupIds: [...new Set([...existing.groupIds, editor.groupId])] } : { id: pending.savedId, name: pending.name, groupIds: [editor.groupId] });
        pending.id = object.id; pending.savedId = object.id;
      }
      for (const { object, body, points } of entries) {
        const saved = await api.saveNote({ owner: editor.noteOwners?.[object.id] || { kind: 'object', id: object.id }, fileName: editor.savedNotes[object.id], source: { kind: 'category-batch', categoryId: editor.groupId, batchId: editor.batchId }, subject: values.get('subject'), date: values.get('date'), body, points });
        editor.savedNotes[object.id] = saved.fileName;
      }
    } else if (editor.kind === 'note') {
      const owner = { ...editor.owner };
      if (!editor.item && owner.kind === 'object') delete owner.groupId;
      await api.saveNote({ owner, id: editor.noteId, fileName: editor.item?.fileName, subject: values.get('subject'), date: values.get('date'), body: values.get('body'), points: values.get('points') });
      if (owner.kind === 'object') { state.selectedId = owner.id; state.noteGroupId = owner.groupId || ''; }
    }
    $('#editor-dialog').close(); state.editor = null;
    await refreshData(); $('#save-status').textContent = 'Opgeslagen · ' + new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    showToast('Opgeslagen in je gegevensmap.'); previousFocus?.isConnected ? previousFocus.focus() : $('#new-object').focus();
  } catch (error) {
    const savedCount = editor.kind === 'group-object-notes' ? Object.keys(editor.savedNotes).length : 0;
    $('#form-error').textContent = `${savedCount ? `${savedCount} notitie(s) opgeslagen. Probeer opnieuw om de overige notities op te slaan. ` : ''}${error.message}`;
  }
  finally { state.saving = false; $('#save-editor').disabled = false; }
}
async function deleteCurrentNote() {
  if (state.saving || state.editor?.kind !== 'note' || !state.editor.item) return;
  if (!confirmStandardText('Deze notitie definitief verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
  state.saving = true;
  try { await api.deleteNote({ owner: state.editor.owner, fileName: state.editor.item.fileName }); $('#editor-dialog').close(); state.editor = null; await refreshData('Notitie verwijderd.'); }
  finally { state.saving = false; }
}
async function removeObjectFromActiveGroup(objectId = state.selectedId) {
  if (groupMembershipSaving) return;
  const group = activeGroup(), object = findObject(objectId);
  if (!group || !object || !object.groupIds.includes(group.id)) { showToast('Selecteer een onderwerp in de categorie om het te verwijderen.'); return; }
  groupMembershipSaving = true;
  const previousIndex = state.results.findIndex(result => result.kind === 'object' && result.item.id === object.id);
  document.querySelectorAll('[data-remove-group-object]').forEach(button => button.disabled = true);
  try {
    await api.saveObject({ ...object, groupIds: object.groupIds.filter(id => id !== group.id) });
    if (state.selectedId === object.id) { state.selectedId = null; state.noteGroupId = ''; }
    await refreshData();
    const rows = [...document.querySelectorAll('[data-result]')];
    (rows[Math.min(Math.max(previousIndex, 0), rows.length - 1)] || $('#new-object')).focus();
    showToast(`${object.name} uit ${group.name} verwijderd. Onderwerp en notities blijven bewaard.`);
  } finally {
    groupMembershipSaving = false;
    document.querySelectorAll('[data-remove-group-object]').forEach(button => button.disabled = false);
  }
}
async function deleteActiveGroup() {
  const group = activeGroup();
  if (!group) { showToast('Selecteer eerst een categorie.'); return; }
  if (groupDeletionSaving || groupMembershipSaving || groupOrderSaving) return;
  if (!confirmStandardText(`Categorie “${group.name}” verwijderen? De onderwerpen en alle notities blijven bewaard. Alleen de categorie en de koppelingen naar deze categorie worden verwijderd.`)) return;
  groupDeletionSaving = true;
  const button = $('[data-action="delete-group"]'); if (button) button.disabled = true;
  try {
    await api.deleteGroup(group.id);
    state.groupId = null; state.selectedId = null; state.noteGroupId = ''; state.view = 'objects'; state.query = ''; $('#search').value = '';
    await refreshData(); $('#all-objects').focus();
    showToast(`${group.name} verwijderd. Onderwerpen en notities blijven bewaard.`);
  } finally { groupDeletionSaving = false; if (button?.isConnected) button.disabled = false; }
}
function openSelectedEditor() { if (selectedObject()) openObjectEditor(selectedObject()); else if (activeGroup()) openGroupEditor(activeGroup()); else showToast('Selecteer eerst een onderwerp of categorie.'); }
const shortcuts = [
  ['Instellingen', 'Ctrl ,', () => window.openSettings()],
  ['Onderwerp toevoegen', 'Ctrl N', () => openObjectEditor()],
  ['Categorie toevoegen', 'Ctrl Shift G', () => openGroupEditor()],
  ['Geselecteerde categorie verwijderen', 'Ctrl Alt Delete', () => runAction(deleteActiveGroup)],
  ['Notitie schrijven', 'Ctrl Shift N', () => openNoteEditor()],
  ['Notities voor alle onderwerpen in categorie', 'Ctrl Alt N', openGroupObjectNotesEditor],
  ['Selectie bewerken', 'Ctrl E', openSelectedEditor],
  ['Onderwerp uit huidige categorie verwijderen', 'Ctrl Shift Delete', () => runAction(() => removeObjectFromActiveGroup())],
  ['Categorieën van onderwerp wijzigen', 'Ctrl Shift M', () => selectedObject() ? openObjectEditor(selectedObject()) : showToast('Selecteer eerst een onderwerp.')],
  ['Alles doorzoeken', 'Ctrl F', () => $('#search').focus()],
  ['Onderwerpen', 'Alt 1', () => navigateToCollection()],
  ['Notities', 'Alt 2', () => navigateToCollection(null, 'notes')],
  ['Categorieën', 'Alt 3', () => navigateToCollection(null, 'groups')],
  ['Gegevens vernieuwen', 'Ctrl R', () => runAction(() => refreshData('Gegevens vernieuwd.'))],
  ['Gegevensmap tonen', 'Ctrl Shift O', () => runAction(() => api.openDataFolder())],
  ['Andere gegevensmap openen', 'Ctrl Shift D', () => runAction(chooseDataFolder)],
  ['Sneltoetsen tonen', 'F1', openHelp]
];
function openHelp() {
  $('#shortcut-list').innerHTML = [...shortcuts.map(([name, key]) => [name, key]), ['Categorie verplaatsen (focus op categorie)', 'Alt ↑ / ↓'], ['Opdrachten zoeken', 'Ctrl K'], ['Formulier opslaan / volgende stap', 'Ctrl Enter'], ['Markdown-voorbeeld', 'Ctrl P'], ['Volgende / vorige bediening', 'Tab / Shift Tab'], ['Vorig / volgend resultaat', '↑ / ↓'], ['Sluiten / zoekopdracht wissen', 'Esc']].map(([name, key]) => `<div class="shortcut-row"><span>${escapeHtml(name)}</span><kbd>${escapeHtml(key)}</kbd></div>`).join('');
  $('#help-dialog').showModal();
}
function openCommandPalette() { $('#command-search').value = ''; renderCommands(); $('#command-dialog').showModal(); $('#command-search').focus(); }
let filteredCommands = [];
function renderCommands() {
  const query = normalizeSearch($('#command-search').value);
  filteredCommands = [...shortcuts, ...state.data.groups.map(group => [`Categorie openen: ${group.name}`, '', () => navigateToCollection(group.id)])].filter(([name]) => normalizeSearch(name).includes(query));
  $('#command-results').innerHTML = filteredCommands.map(([name, key], index) => `<button class="command-row" data-command="${index}"><span>${escapeHtml(name)}</span>${key ? `<kbd>${escapeHtml(key)}</kbd>` : ''}</button>`).join('') || '<p class="empty">Geen opdrachten gevonden.</p>';
}
async function chooseDataFolder() {
  const data = await api.chooseDataFolder();
  if (data) { state.data = data; navigateToCollection(); showToast('Gegevensmap geopend.'); }
}
function activateResult(index) {
  const result = state.results[index]; if (!result) return;
  if (result.kind === 'object') selectObject(result.item.id);
  else if (result.kind === 'group') navigateToCollection(result.item.id);
  else if (result.kind === 'note-cluster') openGroupObjectNotesEditor(result.item);
  else openNoteEditor(result.item);
}
let draggedGroupId = null, groupOrderSaving = false, ignoreGroupClickUntil = 0;
function clearGroupDropIndicators() {
  document.querySelectorAll('#group-list .drop-before, #group-list .drop-after').forEach(row => row.classList.remove('drop-before', 'drop-after'));
}
async function saveGroupOrder(groupIds, focusedGroupId) {
  if (groupOrderSaving || groupIds.every((id, index) => id === state.data.groups[index]?.id)) return;
  groupOrderSaving = true; $('#group-list').setAttribute('aria-busy', 'true');
  const scrollPosition = $('#group-list').scrollTop;
  try {
    state.data.groups = await api.reorderGroups(groupIds);
    renderApplication();
    $('#group-list').scrollTop = scrollPosition;
    [...document.querySelectorAll('#group-list [data-group]')].find(row => row.dataset.group === focusedGroupId)?.focus({ preventScroll: true });
    showToast('Categorievolgorde opgeslagen.');
  } catch (error) { showToast(error.message, true); }
  finally { groupOrderSaving = false; $('#group-list').removeAttribute('aria-busy'); }
}
$('#group-list').addEventListener('dragstart', event => {
  const row = event.target.closest('[data-group]');
  if (!row || groupOrderSaving) { event.preventDefault(); return; }
  draggedGroupId = row.dataset.group;
  event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', draggedGroupId);
  row.classList.add('group-dragging');
});
$('#group-list').addEventListener('dragover', event => {
  const row = event.target.closest('[data-group]');
  if (!draggedGroupId || !row || groupOrderSaving) return;
  event.preventDefault(); event.dataTransfer.dropEffect = 'move'; clearGroupDropIndicators();
  if (row.dataset.group !== draggedGroupId) {
    const bounds = row.getBoundingClientRect();
    row.classList.add(event.clientY < bounds.top + bounds.height / 2 ? 'drop-before' : 'drop-after');
  }
  const list = $('#group-list'), bounds = list.getBoundingClientRect();
  if (event.clientY < bounds.top + 24) list.scrollTop -= 12;
  else if (event.clientY > bounds.bottom - 24) list.scrollTop += 12;
});
$('#group-list').addEventListener('dragleave', event => {
  if (!$('#group-list').contains(event.relatedTarget)) clearGroupDropIndicators();
});
$('#group-list').addEventListener('drop', event => {
  const row = event.target.closest('[data-group]');
  if (!draggedGroupId || !row || groupOrderSaving) return;
  event.preventDefault(); clearGroupDropIndicators();
  const sourceId = draggedGroupId, targetId = row.dataset.group;
  if (sourceId === targetId) return;
  const bounds = row.getBoundingClientRect(), after = event.clientY >= bounds.top + bounds.height / 2;
  const groupIds = state.data.groups.map(group => group.id).filter(id => id !== sourceId);
  groupIds.splice(groupIds.indexOf(targetId) + (after ? 1 : 0), 0, sourceId);
  ignoreGroupClickUntil = Date.now() + 300;
  void saveGroupOrder(groupIds, sourceId);
});
$('#group-list').addEventListener('dragend', () => {
  draggedGroupId = null; ignoreGroupClickUntil = Date.now() + 300;
  clearGroupDropIndicators();
  document.querySelectorAll('#group-list .group-dragging').forEach(row => row.classList.remove('group-dragging'));
});
$('#group-list').addEventListener('keydown', event => {
  const row = event.target.closest('[data-group]');
  if (!row || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  const groupIds = state.data.groups.map(group => group.id), index = groupIds.indexOf(row.dataset.group);
  const destination = index + (event.key === 'ArrowUp' ? -1 : 1);
  if (destination < 0 || destination >= groupIds.length) return;
  [groupIds[index], groupIds[destination]] = [groupIds[destination], groupIds[index]];
  void saveGroupOrder(groupIds, row.dataset.group);
});
$('#search').addEventListener('input', event => { state.query = event.target.value; renderCollection(); });
$('#command-search').addEventListener('input', renderCommands);
$('#editor-form').addEventListener('submit', saveEditor);
$('#editor-form').addEventListener('input', () => { updateFilenamePreview(); updateGroupObjectNoteCount(); });
$('#editor-dialog').addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
$('#cancel-editor').addEventListener('click', closeEditor);
$('#all-objects').addEventListener('click', () => navigateToCollection());
$('#all-notes').addEventListener('click', () => navigateToCollection(null, 'notes'));
$('#all-groups').addEventListener('click', () => navigateToCollection(null, 'groups'));
$('#groups-tab').addEventListener('click', () => navigateToCollection(null, 'groups'));
$('#new-group').addEventListener('click', () => openGroupEditor());
$('#objects-tab').addEventListener('click', () => { state.view = 'objects'; state.query = ''; $('#search').value = ''; renderApplication(); });
$('#notes-tab').addEventListener('click', () => navigateToCollection(state.groupId, 'notes'));
$('#new-object').addEventListener('click', () => openObjectEditor());
$('#add-group').addEventListener('click', () => openGroupEditor());
$('#add-group-small').addEventListener('click', () => openGroupEditor());
$('#edit-group').addEventListener('click', () => openGroupEditor(activeGroup()));
$('#help-button').addEventListener('click', openHelp);
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#command-button').addEventListener('click', openCommandPalette);
$('#refresh').addEventListener('click', () => runAction(() => refreshData('Gegevens vernieuwd.')));
$('#open-folder').addEventListener('click', () => runAction(() => api.openDataFolder()));

document.addEventListener('click', event => {
  const target = event.target.closest('button'); if (!target) return;
  if (target.dataset.removeGroupObject !== undefined) { void runAction(() => removeObjectFromActiveGroup(target.dataset.removeGroupObject)); return; }
  if (target.dataset.group && Date.now() >= ignoreGroupClickUntil) navigateToCollection(target.dataset.group);
  if (target.dataset.result !== undefined) activateResult(Number(target.dataset.result));
  if (target.dataset.note !== undefined) openNoteEditor(state.data.notes[Number(target.dataset.note)]);
  if (target.dataset.removeBatchObject !== undefined) removeBatchNoteObject(Number(target.dataset.removeBatchObject));
  if (target.dataset.noteOwner !== undefined) chooseNoteOwner(Number(target.dataset.noteOwner));
  if (target.dataset.objectOption !== undefined) chooseGroupObject(Number(target.dataset.objectOption));
  if (target.dataset.removePending !== undefined) {
    state.editor.pendingObjects.splice(Number(target.dataset.removePending), 1);
    renderPendingGroupObjects(); renderGroupObjectSuggestions(); $('#group-object-input').focus();
  }
  if (target.dataset.command !== undefined) { $('#command-dialog').close(); filteredCommands[Number(target.dataset.command)][2](); }
  const actions = { 'new-group': () => openGroupEditor(), 'new-object': () => openObjectEditor(), 'new-note': () => openNoteEditor(), 'group-object-notes': openGroupObjectNotesEditor, 'delete-group': () => runAction(deleteActiveGroup), 'batch-add-object': openBatchAddObjectInput, 'edit-selected': openSelectedEditor, 'edit-memberships': () => openObjectEditor(selectedObject()) };
  if (actions[target.dataset.action]) actions[target.dataset.action]();
  if (target.id === 'toggle-preview') toggleMarkdownPreview();
  if (target.id === 'delete-note') runAction(deleteCurrentNote);
});
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase(), modifier = event.ctrlKey || event.metaKey;
  const dialog = $('dialog[open]');
  if (dialog) {
    if (dialog.id === 'editor-dialog') {
      if (state.editor?.kind === 'object' && modifier && key === 'f') {
        event.preventDefault(); $('#object-group-search').focus(); $('#object-group-search').select(); return;
      }
      if (state.editor?.kind === 'group-object-notes' && modifier && ['f', 'n'].includes(key) && !event.shiftKey) {
        event.preventDefault();
        if (key === 'f') { $('#batch-note-search').focus(); $('#batch-note-search').select(); }
        else openBatchAddObjectInput();
        return;
      }
      if (modifier && event.key === 'Enter') { event.preventDefault(); $('#editor-form').requestSubmit(); }
      else if (modifier && key === 'p') { event.preventDefault(); toggleMarkdownPreview(); }
    }
    if (dialog.id === 'command-dialog' && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      const buttons = [...document.querySelectorAll('.command-row')], focused = buttons.indexOf(document.activeElement);
      if (buttons.length && event.key === 'Enter') { event.preventDefault(); (buttons[focused] || buttons[0]).click(); }
      else if (buttons.length) { event.preventDefault(); buttons[(focused + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus(); }
    }
    return;
  }
  if (event.key === 'F1') { event.preventDefault(); openHelp(); return; }
  if (modifier && key === 'k') { event.preventDefault(); openCommandPalette(); return; }
  if (modifier && key === 'f') { event.preventDefault(); $('#search').focus(); $('#search').select(); return; }
  const shortcutKey = `${modifier ? 'Ctrl ' : ''}${event.altKey ? 'Alt ' : ''}${event.shiftKey ? 'Shift ' : ''}${key.toUpperCase()}`;
  const shortcut = shortcuts.find(([, combination]) => combination.toUpperCase() === shortcutKey.toUpperCase());
  if (shortcut) { event.preventDefault(); shortcut[2](); return; }
  if (event.key === 'Escape') {
    if (state.query) { state.query = ''; $('#search').value = ''; renderCollection(); }
    else { state.selectedId = null; renderCollection(); renderDetail(); }
  }
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
  if (!typing && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    const rows = [...document.querySelectorAll('[data-result]')]; if (!rows.length) return;
    event.preventDefault(); const focused = rows.indexOf(document.activeElement), index = Math.max(0, Math.min(rows.length - 1, focused + (event.key === 'ArrowDown' ? 1 : -1)));
    rows[index].focus();
  }
});
window.addEventListener('beforeunload', event => {
  if (state.saving || (state.editor && readEditorSignature() !== state.editor.original)) {
    if (!confirmStandardText(state.saving ? 'Er wordt nog opgeslagen. Toch afsluiten?' : 'Je hebt niet-opgeslagen wijzigingen. Toch afsluiten?')) { event.preventDefault(); event.returnValue = ''; }
  }
});
if (api) refreshData().catch(error => { $('#save-status').textContent = error.message; $('#save-status').classList.add('error'); showToast(error.message, true); });
else { $('#save-status').textContent = 'Open deze applicatie via Electron om je bestanden te gebruiken.'; renderApplication(); }
