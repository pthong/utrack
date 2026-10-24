'use strict';
(() => {
  const select = selector => document.querySelector(selector);
  const defaults = { background: '#f7f8f5', surface: '#ffffff', text: '#26302e', muted: '#78817f', border: '#e6e9e5', accent: '#53684e', highlight: '#edf1e9', danger: '#a43b3b' };
  const dark = { background: '#171b1c', surface: '#222829', text: '#edf0ed', muted: '#abb7b1', border: '#3c4744', accent: '#b2cda2', highlight: '#303e35', danger: '#ffaaa3' };
  const colorLabels = { background: 'Achtergrond', surface: 'Panelen en velden', text: 'Tekst', muted: 'Secundaire tekst', border: 'Randen', accent: 'Accent', highlight: 'Selectie en markering', danger: 'Fouten en verwijderen' };
  let preferences = { theme: 'light', colors: { ...defaults }, texts: {} }, draft, isSaving = false;
  const textCatalog = new Set(window.uTrackDefaultTexts || []);
  const originalNodes = new WeakMap(), originalAttributes = new WeakMap();
  const dialog = select('#settings-dialog');
  const encode = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  function translateStandardText(value) {
    const trimmed = value.trim();
    if (Object.hasOwn(preferences.texts, trimmed)) return value.replace(trimmed, () => preferences.texts[trimmed]);
    const keys = Object.keys(preferences.texts).filter(key => key.length >= 2).sort((a,b) => b.length-a.length);
    if (!keys.length) return value;
    const escaped = keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    return value.replace(pattern, match => preferences.texts[match]);
  }
  window.translateStandardText = translateStandardText;
  function containsUserText(element) {
    return element.closest('script,style,textarea,input,#settings-texts,#settings-text-search,#group-list,.row-title,.row-description,.mini-note p,.mini-note-title>span:last-child,.pending-object-name,.note-owner-name,.chips,.batch-note-object-header,.note-preview,#filename-preview,#settings-error') ||
      (element.closest('#page-title,#breadcrumb') && state.groupId) ||
      (element.matches('#detail h2') && !element.closest('.detail-empty')) ||
      (element.closest('[data-command]') && Number(element.closest('[data-command]').dataset.command) >= shortcuts.length);
  }
  function applyStandardTexts() {
    observer.disconnect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || containsUserText(parent) || parent.closest('kbd')) continue;
      let record = originalNodes.get(node);
      if (!record || node.nodeValue !== record.translated) record = { original: node.nodeValue };
      const text = record.original.trim();
      if (text && /[a-zA-ZÀ-ÿ]{2}/.test(text) && text.length < 4000) textCatalog.add(text);
      record.translated = translateStandardText(record.original);
      if (node.nodeValue !== record.translated) node.nodeValue = record.translated;
      originalNodes.set(node, record);
    }
    for (const element of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
      if (element.closest('#settings-texts,#settings-text-search,#group-list,[data-remove-group-object],[data-remove-pending],[data-remove-batch-object]') || element.id === 'open-folder') continue;
      let records = originalAttributes.get(element) || {};
      for (const attr of ['placeholder', 'aria-label', 'title']) {
        if (!element.hasAttribute(attr)) continue;
        const current = element.getAttribute(attr);
        let record = records[attr];
        if (!record || current !== record.translated) record = { original: current };
        if (record.original.length < 4000) textCatalog.add(record.original);
        record.translated = translateStandardText(record.original);
        if (current !== record.translated) element.setAttribute(attr, record.translated);
        records[attr] = record;
      }
      originalAttributes.set(element, records);
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder','aria-label','title'] });
  }
  const observer = new MutationObserver(applyStandardTexts);
  function applyTheme(settings) {
    const palette = settings.theme === 'dark' ? dark : settings.colors;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.colorScheme = settings.theme === 'dark' ? 'dark' : 'light';
    for (const [name, value] of Object.entries(palette)) document.documentElement.style.setProperty(`--theme-${name}`, value);
  }
  function renderColors() {
    select('#settings-colors').classList.toggle('hidden', draft.theme !== 'custom');
    select('#settings-colors').innerHTML = Object.entries(colorLabels).map(([key,label]) => `<label class="settings-color">${label}<input type="color" data-color="${key}" value="${draft.colors[key]}"></label>`).join('');
  }
  function renderTextFields() {
    const query = select('#settings-text-search').value.toLocaleLowerCase('nl');
    const texts = [...new Set([...textCatalog, ...Object.keys(draft.texts)])].sort((a,b)=>a.localeCompare(b,'nl')).filter(text=>`${text} ${draft.texts[text] || ''}`.toLocaleLowerCase('nl').includes(query));
    select('#settings-texts').innerHTML = texts.map((text,index) => `<label class="settings-text-field" for="setting-text-${index}"><span>${encode(text)}</span><input id="setting-text-${index}" data-standard-text="${encode(text)}" value="${encode(Object.hasOwn(draft.texts,text) ? draft.texts[text] : text)}" maxlength="4000"><button type="button" data-reset-text="${encode(text)}" title="Deze tekst herstellen" aria-label="Deze tekst herstellen">↺</button></label>`).join('') || '<p>Geen teksten gevonden.</p>';
  }
  window.openSettings = function openSettings() {
    if (document.querySelector('dialog[open]')) return;
    draft = structuredClone(preferences);
    select('#settings-path').value = state.data.rootPath || '';
    select('#settings-theme').value = draft.theme;
    select('#settings-text-search').value = '';
    select('#settings-error').textContent = '';
    renderColors();renderTextFields();dialog.showModal();select('#settings-theme').focus();
  };
  function closeSettings() { if (!isSaving) dialog.close(); }
  dialog.addEventListener('close',()=> { applyTheme(preferences); select('#settings-button').focus(); });
  dialog.addEventListener('cancel', event=> { if(isSaving) event.preventDefault(); });
  select('#settings-button').addEventListener('click',window.openSettings);
  select('#settings-cancel').addEventListener('click',closeSettings);
  select('#settings-theme').addEventListener('change',event=> { draft.theme=event.target.value;renderColors();applyTheme(draft); });
  select('#settings-colors').addEventListener('input',event=> { if(event.target.dataset.color) { draft.colors[event.target.dataset.color]=event.target.value;applyTheme(draft); } });
  select('#settings-reset-theme').addEventListener('click',()=> { draft.theme='light';draft.colors={...defaults};select('#settings-theme').value='light';renderColors();applyTheme(draft); });
  select('#settings-text-search').addEventListener('input',renderTextFields);
  select('#settings-texts').addEventListener('input',event=> {
    const key=event.target.dataset.standardText;if(key===undefined)return;
    if(event.target.value===key) delete draft.texts[key];else Object.defineProperty(draft.texts,key,{value:event.target.value,enumerable:true,writable:true,configurable:true});
  });
  select('#settings-texts').addEventListener('click',event=> { const button=event.target.closest('[data-reset-text]');if(button){delete draft.texts[button.dataset.resetText];renderTextFields();} });
  select('#settings-reset-texts').addEventListener('click',()=> {draft.texts={};renderTextFields();});
  select('#settings-choose-folder').addEventListener('click',async()=> {
    select('#settings-error').textContent='';
    try {await chooseDataFolder();select('#settings-path').value=state.data.rootPath;}catch(error){select('#settings-error').textContent=error.message;}
  });
  dialog.addEventListener('keydown',event=> {
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();select('#settings-form').requestSubmit();}
    if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='d'){event.preventDefault();select('#settings-choose-folder').click();}
  });
  select('#settings-form').addEventListener('submit',async event=> {
    event.preventDefault();if(isSaving)return;isSaving=true;
    const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
    try {preferences=await api.savePreferences(draft);applyTheme(preferences);applyStandardTexts();dialog.close();showToast('Instellingen opgeslagen.');}
    catch(error){select('#settings-error').textContent=error.message;}
    finally{isSaving=false;buttons.forEach(button=>button.disabled=false);}
  });
  const ready=api.loadPreferences().then(value=> {preferences={...preferences,...value,colors:{...defaults,...value.colors}};applyTheme(preferences);applyStandardTexts();}).catch(error=>showToast(error.message,true));
  window.uTrackSettingsReady=ready;
})();
