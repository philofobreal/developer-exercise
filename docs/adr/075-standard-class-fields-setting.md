# ADR-075 – Szerzői beállítás: csak szabványos osztálymezők (v41)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v41`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-23 tétele, a felhasználó döntése alapján. Kiegészíti az [ADR-012](012-class-evaluation-phases-and-accessor-pairs.md) mezőmód-függetlenségét, az [ADR-073](073-base-chain-fields-and-defaults.md) és az [ADR-074](074-inherit-campaign-kind.md) ősláncfeltételét, és az [ADR-055](055-key-order-setting.md) szerzői beállításának mintáját követi.

## Kontextus

Az elemzés eddig mindig mindkét mezőmódot ígérte (`classFields: 'either'`):
- **`[[Define]]`:** a szabványos JavaScript (natív osztálymezők), és a TypeScript `useDefineForClassFields: true` beállítással (ez az ES2022+ cél alapértéke);
- **`[[Set]]`:** az ES2015-re fordított JavaScript, és a TypeScript `useDefineForClassFields: false` beállítással.

`[[Set]]` módban a mező létrehozása értékadás, és lefuttatja az ős azonos nevű setterét. Az ADR-073/074 ezért köti az ilyen nevű mezőket. Ennek az ára az ADR-074 szerint az `inherit` JS-ben 101 sorrend, amely szabványos JavaScriptben egyenértékű, mégis elutasított.

A felhasználó a szerzői beállítást választotta: egy feladat kimondhatja, hogy csak a szabványos módban fut. Cserébe a régebbi célra lefordított kódra nem ígér semmit.

## Döntés

1. **Új szerzői beállítás: `classFields`**, mindkét nyelvre.
   - `either` (alapértelmezett): mindkét mezőmód. A szabályok változatlanok.
   - `define`: csak a szabványos `[[Define]]` mód.
2. **A generátor ([type-member-ordering.ts](../../src/author/type-member-ordering.ts)):** `define` módban az őslánc accessorainak nevei nem számítanak.
   - A laza mező (ADR-029, ADR-068) és a másoló mező (ADR-073) feltétele csak a `__proto__` nevet és a többi meglévő feltételt tartja meg.
   - Más szabály nem függ a mezőmódtól: az objektummodell (ADR-025) öröklő osztályt eleve nem modellez, és a saját accessorral azonos nevű mezőt mindkét módban ismeretlennek veszi.
3. **A beállítás a modell része.** Az elemzés környezete rögzíti (`environment.classFields`: `either` vagy `define`), ezért:
   - az ellenőrzőkapu (ADR-017) és a frissítés (ADR-018) ugyanezzel generál újra;
   - a JSON-séma és a `AnalysisEnvironment` típusa `either | define`.
4. **A felület ([view.ts](../../src/workbench/view.ts), [author-workspace.ts](../../src/workbench/author-workspace.ts)):**
   - a Forrás lépés „Osztálymezők létrehozása” választója, magyarázattal arról, mikor ne válaszd;
   - a Szabályok lépés elemzési beállításai között: „Osztálymezők: mindkét mód / csak szabványos”;
   - a kérés csak a `define` értéket küldi; egy betöltött modell visszaállítja a választót.
5. **Az orákulum ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs)) függetlenül valósítja meg:** egy `define` fixture minden környezetben csak a `useDefineForClassFields: true` kibocsátást futtatja, az `es2015`-ben is. A kampány kapcsolója: `--class-fields=either|define`.

## Helyességi érv

- **`[[Define]]` módban** a mező inicializálója `CreateDataPropertyOrThrow(this, f, v)`. Ez a prototípusláncot nem nézi, settert nem futtat, és a saját adattulajdonság elfedi az ős accessorát.
- A laza mező tehát kódot nem futtat (ha az inicializálója inert), és csak a kulcsát hozza létre. Ennek sorrendjét a meglévő feltételek védik (`enumeratedKeys`, ADR-029).
- **A másoló mező** forrása `[[Define]]` után saját adattulajdonság, így az olvasása nem futtat gettert. A forrásnév fájlszintű tiltásai (prototípus-módosítás, reflexió) maradnak.
- **A beállítás szűkíti az ígéretet, nem a futást.** `define` módban a modell csak arra a futásra ígér egyenértékűséget, amelyben a mezőket definiálják. Ha a kódot `[[Set]]` módban futtatják, az elfogadott csere eltérhet. Ezt a beállítás magyarázata kimondja, és a negatív próba mutatja.

## Mérés

**Kampány, 12 mag, `inherit` és `class`, környezetváltozatokkal** (`strict`, `es2015`, `sloppy`), v41:

| Csoport | `either` elfogadott | `either` rés | `define` elfogadott | `define` rés | Hibás elfogadás |
| --- | --- | --- | --- | --- | --- |
| `inherit` JS | 358 | 105 | 487 | 56 | 0 / 0 |
| `inherit` TS | 374 | 77 | 474 | 58 | 0 / 0 |
| `class` JS | 884 | 0 | 884 | 0 | 0 / 0 |
| `class` TS | 933 | 19 | 933 | 19 | 0 / 0 |

- **A JavaScript:** `define` módban a v40 által visszavont mind a 129 sorrend elfogadott. A 101, szabványos JS-ben eddig is egyenértékű sorrend mellett a 28 ES2015-ös eltérés is egyenértékű, mert az orákulum ott is a `[[Define]]` kibocsátást futtatja.
- **A TypeScript:** 100 sorrenddel több elfogadott, mert ott az ADR-073 óta ugyanez a feltétel kötött.
- **Az alapértelmezés változatlan:** az `either` számai azonosak a v40-ével, a gyors alapértékben csak a szabályverzió címkéje változott.
- **A maradék rés** (`define`: JS 56, TS 58) az NY-22 (a) és (c) oka: a `record(…) ?? n` kezdőértékű mező és a duplikált accessorok.

## Bizonyíték

[class-field-mode-setting.test.mjs](../../tests/class-field-mode-setting.test.mjs):
- **a szabályverzió** v41, a formális szerződésben az ADR-075-höz kötve;
- **alapértelmezés (mindkét nyelv):** az ős settere köti a két laza mezőt;
- **`define` (mindkét nyelv):** a csere elfogadott, mindhárom környezetben 0 hibás elfogadás;
- **negatív próba:** a `define`-ban elfogadott csere a beállítás nélküli orákulumban hibás elfogadás, vagyis az orákulum ténylegesen a beállítás szerint fut;
- **a modell része:** a környezet rögzíti; az ellenőrzőkapu újragenerálása egyezik; a hamisan `either`-re írt környezet eltér; a frissítés megtartja; ismeretlen érték elutasítva;
- **a kérés és a visszaállítás:** a kérés csak a `define` értéket küldi, a befogadott modell visszaállítja.

[browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) (`class_fields_setting`), Node- és Pages-szerverrel:
- mindkét módban a csere „Hibás”;
- `define`-nal „Elfogadva”, és a modell elemzéssel igazolt;
- a Szabályok lépés „csak szabványos”-t mutat, és a Forrás lépés választója megőrzi az értéket.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a mezőmód tudása a tagrendezésé (egyetlen feltétel: `inherited`);
  - a beállítás érvényessége a generátor bejáratáé;
  - a rögzítése az elemzési környezeté;
  - a választó és a kiírás a megjelenítésé.

  Az interfész egy opcionális mezővel bővül (`OrderingOptions.classFields`, `AuthorDraft.classFields`), ugyanazon az úton, mint az `inputs` és a `keyOrder`. A hívók közül csak a szerzői kérés küldi.
- **Design twice:**
  - *JavaScriptre automatikusan `define`:* elvetve. Az ES2015-ös lefordításban hibás elfogadást adna (ADR-074), és a generátor nem tudja, hova fordítják a kódot.
  - *A TypeScript `tsconfig` beolvasása:* elvetve. A generátor csak a forrást kapja, a build beállítása szerzői tudás, ugyanúgy, mint az importok kibocsátása (ADR-013).
  - *Csak JavaScriptre:* elvetve. A TypeScriptben ugyanaz a két mód létezik (`useDefineForClassFields`), és egy nyelvi elágazás nehezebben érthető.
- **Mélység:** a generátorban egyetlen feltétel változott. A többi módosítás a beállítás meglévő útja (validálás, környezet, séma, kérés, választó, orákulum).
