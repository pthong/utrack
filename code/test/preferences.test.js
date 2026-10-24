'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DEFAULT_COLORS, validateAppearance, readPreferences, writePreferences } = require('../src/preferences');
test('uiterlijk en gegevensmap blijven onafhankelijk bewaard',t=> {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'u-track-preferences-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 writePreferences(root,{dataFolder:'/tmp/voorbeeld'});
 const appearance=validateAppearance({theme:'custom',colors:{...DEFAULT_COLORS,accent:'#123456'},texts:{'Alle onderwerpen':'Mijn onderwerpen',Opslaan:''}});
 writePreferences(root,appearance);writePreferences(root,{dataFolder:'/tmp/anders'});
 assert.deepEqual(readPreferences(root),{...appearance,dataFolder:'/tmp/anders'});
 assert.equal(readPreferences(root).texts.Opslaan,'');
});
test('ongeldige thema’s, kleuren en tekstwaarden worden geweigerd',()=> {
 assert.throws(()=>validateAppearance({theme:'onbekend'}));
 assert.throws(()=>validateAppearance({theme:'custom',colors:{accent:'red; display:none'}}));
 assert.throws(()=>validateAppearance({theme:'light',texts:{Opslaan:{html:'test'}}}));
 assert.throws(()=>validateAppearance({theme:'light',texts:[]}));
 assert.deepEqual(validateAppearance({theme:'dark',texts:{Opslaan:'Opslaan'}}).texts,{});
});
