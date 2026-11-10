/** ADR-119 (U2): one concept, one word (docs/szotar.md). The interface sources never use a retired label again, and an
 *  action that opens a file chooser (import) or saves a file (export) ends with an ellipsis. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const sources=[...readdirSync(new URL('src/workbench/',root)).filter(name=>name.endsWith('.ts')).map(name=>`src/workbench/${name}`),'public/ui.js','src/author/preflight/rules-gate.ts'];
const text=Object.fromEntries(sources.map(file=>[file,readFileSync(new URL(file,root),'utf8')]));
/** retired label → the word that replaced it (docs/szotar.md) */
const RETIRED={
 'Forrás ellenőrzése':'Forrás vizsgálata','forrás ellenőrzése':'forrás vizsgálata','Minősítés és ellenőrzések':'Minősítés',
 'Helyi mentés':'Mentés a böngészőbe','Visszatöltés':'Mentett munka megnyitása','Fájl export':'Exportálás fájlba…','Fájl import':'Importálás fájlból…',
 'JSON betöltése':'JSON megnyitása…','Modell betöltése':'JSON alkalmazása','Rendezőből újratöltés':'Kód frissítése a rendezőből',
 'TS tesztfájl':'TypeScript minta (436 sor)','Minta kitöltés':'Mintamegoldás kitöltése','Visszaállítás':'Újrakezdés',
 'Forrásváltozás elvetése':'Változtatások elvetése','Változások elvetése':'Változtatások elvetése',
 // ADR-122: the stepper's one vocabulary.
 'Hibás forrás':'Hiba','Figyelmeztetéssel':'Figyelem',"'Figyelmeztetés'":"'Figyelem'",'Zárva':'Zárolt'
};

test('no retired label in the interface sources',()=>{
 const found=[];
 for(const [file,body] of Object.entries(text))for(const [old,word] of Object.entries(RETIRED))if(body.includes(old))found.push(`${file}: „${old}” → „${word}”`);
 assert.deepEqual(found,[]);
});

test('the row-rules button is „Sor szabályai”, never the step name „Szabályok”',()=>{
 assert.doesNotMatch(text['src/workbench/view.ts'],/tool\('data-rule-panel-toggle','Szabályok'/);
 assert.match(text['src/workbench/view.ts'],/tool\('data-rule-panel-toggle','Sor szabályai'/);
});

test('a file-opening or file-saving action ends with an ellipsis',()=>{
 const labels=[...text['src/workbench/view.ts'].matchAll(/tool\('(data-(?:import|export)-[a-z-]+)','([^']+)'/g)];
 assert.ok(labels.length>=4,'the import and export actions are found');
 for(const [,action,label] of labels)assert.ok(label.endsWith('…'),`${action}: „${label}” ends with …`);
});
