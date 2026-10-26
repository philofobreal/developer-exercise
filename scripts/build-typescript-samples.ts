/** Reproducible public fixtures; production evaluation never imports or executes these sources. */
import {readFile, writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise, validateSubmission} from '../dist/index.js';
interface Example {id: string; title: string; description: string; authored?: boolean;}
const root = 'public/samples/typescript/';
const examples: Example[] = JSON.parse(await readFile(root + 'suite.json', 'utf8'));
const escape = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const items: string[] = [];
for (const example of examples) {
 if (!/^[a-z0-9-]+$/.test(example.id)) throw Error('Unsafe example ID');
 const source = await readFile(root + example.id + '.ts', 'utf8');
 const model = generateCodeLineExercise({source, language: 'typescript', title: example.title, description: example.description}, ts);
 model.id = 'ts-sample-' + example.id;
 if (example.authored) {
  model.lines[1]!.fixed = true;
  model.profiles = [{id: 'a-before-c', edges: [{before: 1, after: 3}]}, {id: 'c-before-a', edges: [{before: 3, after: 1}]}];
  model.authoring = {...model.authoring, note: 'Explicit szerzői példa: a középső sor fixed, a két profil OR-kapcsolatú. Ezeket a forrás önmagában nem állítja elő.'};
 }
 const compiled = compileCodeLineExercise(model);
 if ('status' in compiled || !validateSubmission(compiled.compiled, {exerciseId: model.id, revision: model.revision, lines: model.lines.map(line => line.code)}).accepted) throw Error('Invalid example ' + example.id);
 await writeFile(root + example.id + '.model.json', JSON.stringify(model, null, 2) + '\n');
 if (example.id === '01-user-account') {
  if (model.lines.length !== 13) throw Error('UserAccount authored fixture changed');
  const valuesOnly = structuredClone(model);
  valuesOnly.id += '-values-only'; valuesOnly.title = 'UserAccount – csak name/id érték szerinti szerzői feladat';
  valuesOnly.description = 'Csak a user.name és user.id értékét őrizd meg. Az interface mezők, class mezők és a két független this-értékadás cserélhető; a kulcssorrend nem része ennek a feladatnak.';
  const dependencies = [[], [1], [1], [2,3], [4], [5], [5], [6,7], [8], [8], [9,10], [11], [12]];
  valuesOnly.lines.forEach((line, index) => {line.dependencies = dependencies[index]!;});
  valuesOnly.authoring = {...model.authoring, strategy: 'manual-value-contract', semanticEquivalenceProven: false, note: 'Kézzel szűkített oktatási szerződés: csak a name/id érték számít, az Object.keys és a létrehozási sorrend nem. Kizárólag ehhez a mellékhatásmentes, öröklés/setter nélküli mintához készült; nem általános TS ekvivalencia. A függőségfrissítés visszaállítja a konzervatív generált szabályokat.'};
  delete valuesOnly.authoring.dependencyPolicy;
  // Hand-written dependencies are the author's rules, not the generated ones (ADR-014).
  valuesOnly.authoring.provenance = valuesOnly.lines.flatMap(line => line.dependencies.map(before => ({before, after: line.id, category: 'author' as const, code: 'manual-value-contract'})));
  const variant = compileCodeLineExercise(valuesOnly);
  if ('status' in variant || !validateSubmission(variant.compiled, {exerciseId: valuesOnly.id, revision: 1, lines: valuesOnly.lines.map(line => line.code)}).accepted) throw Error('Invalid values-only exercise');
  await writeFile(root + '01-user-account.values-only.model.json', JSON.stringify(valuesOnly, null, 2) + '\n');
 }
 items.push(`<tr><th scope="row">${escape(example.title)}</th><td>${escape(example.description)}</td><td><a href="./${example.id}.ts" download>TS forrás</a> · <a href="./${example.id}.model.json" download>JSON modell</a>${example.id==='01-user-account'?' · <a href="./01-user-account.legacy.json" download>Beküldött soros modell</a> · <a href="./01-user-account.values-only.model.json" download>Kézi name/id érték szerinti modell</a>':''}</td></tr>`);
}
await writeFile(root + 'index.html', `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TypeScript sorrendezési példatár</title><link rel="stylesheet" href="./catalog.css"></head>
<body><main><a href="../../">Vissza a feladatműhelyhez</a><h1>TypeScript sorrendezési példatár</h1>
<p>${examples.length} letölthető forrás és importálható v2 modell. A JSON-t az <strong>Adatmodell → JSON betöltése</strong>, a forrást a <strong>Referenciaforrás → Forrásfájl betöltése</strong> művelettel nyisd meg. A forrás alkalmazása új modellt generál; az explicit fixed/profil beállítások a JSON-ban vannak.</p>
<p>A beküldött UserAccount program szintaktikailag helyes. Az interface adatmezőinek sorrendje szabad, de a class mezők és this-értékadások megfigyelhető futásidejű sorrendet is adnak. A generátor syntax auditot és korlátozott sorrendelemzést végez, teljes projekt-/típusellenőrzést nem.</p>
<p>A <code>dependencyHints</code> és a <code>sourceLine</code> tájékoztató; a <code>dependencies</code>, <code>edges</code>, <code>profiles</code>, scope és fixed szabályok döntenek. A cím/leírás nem validátorszabály. Az összes generált sor alapból mozgatható; rögzítéshez a JSON fixed mezője kell.</p>
<div class="table-wrap"><table><thead><tr><th>Példa</th><th>Mit ellenőriz?</th><th>Letöltés</th></tr></thead><tbody>${items.join('\n')}</tbody></table></div>
<p><a href="./suite.json">Gépi esetlista, megengedett/tiltott felcserélésekkel</a>. Ez véges regressziós mátrix, nem a teljes TypeScript és minden programkombináció bizonyítása. A programok kizárólag a tesztekben, rögzített fixture-ként futnak; a tanulói kiértékelés nem futtat kódot.</p>
</main></body></html>\n`);
console.log(`TypeScript public catalog built: ${examples.length} audited source/model pairs.`);
