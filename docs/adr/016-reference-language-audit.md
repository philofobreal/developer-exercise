# ADR-016 – A referencia nyelvi auditja

Állapot: implementálva (a Semantic Ordering Precision epic R1 munkacsomagja, a kritikai felülvizsgálat 4.1 pontja alapján). A befogadás, a validátor és a sorrendi szabályok változatlanok; a tanulói beküldést továbbra sem elemezzük és nem futtatjuk.

## Kontextus

A referencia eddig csak szintaktikai auditon ment át (`audit.mjs`: parserdiagnosztika és exact whitespace). A kötéselemző (`bindingChecker`) `noLib` és `noResolve` beállítással dolgozik. Ez elég a kötések azonosításához, de nem ellenőrzi, hogy a referencia nyelvileg helyes-e (típushiba, újradeklarálás). Azt sem mondja meg, hogy hiányzó projektkontextus miatt mi nem ellenőrizhető.

## Döntés

Új, típusos és böngészőbiztos modul: [reference-audit.ts](../../src/author/reference-audit.ts), `createReferenceAuditor(ts, library?)`.

**Működés:**

- egyetlen fájlból álló TypeScript `Program`-ot épít, a szabványos könyvtárral (`lib.es2022.full.d.ts` és a hivatkozott lib-fájlok);
- a lib-fájlokat egy porton kapja, csak `lib.*.d.ts` alakú alapnévre kérve; tetszőleges útvonalat nem olvas (teszt);
- a beolvasott lib-fájlokat auditoronként gyorsítótárazza. A CopyField esetén hidegen kb. 300 ms, melegen kb. 45 ms.

**Rögzített konfiguráció** (az eredmény `assumptions` listája):

- `single-file`, `target:es2022`, `module:esnext`, `non-strict`;
- dekorátoros fájlnál `experimental-decorators`, mert a keretrendszerek, például az Angular, így fordítanak;
- JavaScriptnél `javascript-binding-only`: csak kötés- és nyelvtani hibát vizsgál, `checkJs` nélkül, mert a típus nélküli kód következtetési zajt adna.

**Az eredmény (`semantics`):**

| Érték | Jelentés |
| --- | --- |
| `ok` | ebben az egyfájlos kontextusban nincs diagnosztika |
| `errors` | biztos nyelvi hiba (típushiba, újradeklarálás…), sorral és kóddal |
| `unverifiable` | csak olyan diagnosztika van, amelyet a hiányzó projektkontextus magyaráz (feloldatlan modul, deklarálatlan globális, hiányzó típusdefiníció). A referencia lehet helyes, de ez innen nem ellenőrizhető. A feloldatlan modulokat név szerint is listázza |
| `not-run` | nincs szabványos könyvtár (statikus Pages-demó); soha nem `ok` |

Ha biztos hiba és hiányzó kontextus is van, az `errors` az erősebb.

**Hol fut és hogyan kezeljük:**

- **Szerver:** a katalógus a telepített TypeScript könyvtárát adja a porton. Az auditot minden befogadáskor futtatja: a szerzői draftnál és a megbízható példák betöltésénél is.
- **Pages:** könyvtár nélkül fut, tehát `not-run`.
- **Az eredmény a befogadási válasz része** (`audit`), és nem kerül a modellbe. Így egy importált modell nem hozhat magával hamis „ok” auditot, és a forrás vagy a környezet minden változása után az audit magától újrafut.
- **A befogadást nem tiltja:** egy típushibás vagy nem ellenőrizhető referencia továbbra is befogadható. A minősítést a modellminősítés (V1) adja; a szerzői felület (D2) megjeleníti.

## Következmények és korlátok

- **Több fájl:** többfájlos projektkontextust (saját `tsconfig`, `node_modules`, path mapping) a szerző jelenleg nem adhat meg. Ezért egy valódi projektből származó fájl jellemzően `unverifiable`. A CopyField 11 feloldatlan importtal ilyen. Ez helyes, nem hiba: a rendszer nem állítja, hogy ellenőrizte.
- **Strict mód:** a `non-strict` beállítás miatt a strict módú hibák (például implicit `any`) nem jelennek meg; ezek nem nyelvi helyességi hibák.
- **Környezet:** az `importEmit` ([ADR-015](015-evidence-binding-and-analysis-environment.md)) feltevés, nem a projekt beállítása. Ezért az audit nem kapcsol `verbatimModuleSyntax`-ot.
- **Szintaktikai kapu:** a szintaktikai audit (`audit.mjs`) változatlanul befogadási feltétel.
