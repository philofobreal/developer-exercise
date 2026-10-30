const entries = [
    { code: 'binding-input', category: 'data', meaning: 'a sor egy korábban deklarált kötés értékét olvassa', adr: 'ADR-008' },
    { code: 'read-after-write', category: 'data', meaning: 'olvasás egy kötés írása után', adr: 'ADR-013' },
    { code: 'write-after-read', category: 'data', meaning: 'írás egy kötés olvasása után', adr: 'ADR-013' },
    { code: 'write-after-write', category: 'data', meaning: 'két írás ugyanarra a kötésre', adr: 'ADR-013' },
    { code: 'object-read-after-write', category: 'data', meaning: 'saját objektum mezőjének olvasása az írása után', adr: 'ADR-025' },
    { code: 'object-write-after-read', category: 'data', meaning: 'saját objektum mezőjének írása az olvasása után', adr: 'ADR-025' },
    { code: 'object-write-after-write', category: 'data', meaning: 'két írás ugyanarra a saját objektummezőre', adr: 'ADR-025' },
    { code: 'effectful-or-unknown-initializer', category: 'effect', meaning: 'a deklaráció kezdőértéke kódot futtat vagy ismeretlen', adr: 'ADR-008' },
    { code: 'block-contains-barrier', category: 'effect', meaning: 'a blokk egy sorrendhez kötő utasítást tartalmaz', adr: 'ADR-025' },
    { code: 'branch-contains-barrier', category: 'effect', meaning: 'az elágazás feltétele vagy ága sorrendhez kötő', adr: 'ADR-028' },
    { code: 'class-evaluates-code', category: 'effect', meaning: 'az osztálydefiníció kiértékeléskor kódot futtat', adr: 'ADR-012' },
    { code: 'class-evaluation-order', category: 'effect', meaning: 'osztálytagok ugyanabban a kiértékelési fázisban', adr: 'ADR-012' },
    { code: 'may-throw', category: 'effect', meaning: 'két esetleg kivételt dobó művelet', adr: 'ADR-028' },
    { code: 'external-call-order', category: 'effect', meaning: 'két, a programon kívüli kódot hívó művelet (nyomkövetés, külső állapot)', adr: 'ADR-040' },
    { code: 'reflected-key-order', category: 'policy', meaning: 'a program felsorolja a kulcsokat, ezért a létrehozás sorrendje megfigyelhető', adr: 'ADR-010' },
    { code: 'script-global-order', category: 'policy', meaning: 'szkriptszintű globális kötések létrehozási sorrendje', adr: 'ADR-010' },
    { code: 'block-open', category: 'structure', meaning: 'a sor a blokk nyitó sora után áll', adr: 'ADR-014' },
    { code: 'block-close', category: 'structure', meaning: 'a sor a blokk záró sora előtt áll', adr: 'ADR-014' },
    { code: 'clause-boundary', category: 'structure', meaning: 'klauzulalánc határa (`} else {`, `case`)', adr: 'ADR-013' },
    { code: 'clause-segment', category: 'structure', meaning: 'a klauzula sorai a határa után', adr: 'ADR-013' },
    { code: 'clause-separator', category: 'structure', meaning: 'a következő klauzula a határ után', adr: 'ADR-013' },
    { code: 'overload-group', category: 'structure', meaning: 'TS overload-szignatúrák és megvalósításuk egymás mellett', adr: 'ADR-009' },
    { code: 'continued-row', category: 'unit', meaning: 'egy többsoros utasítás folytató sora', adr: 'ADR-009' },
    { code: 'sealed-unit', category: 'unit', meaning: 'lezárt többsoros egység a v2-projekcióban', adr: 'ADR-009' },
    { code: 'declaration-shape', category: 'conservative', meaning: 'nem elemzett deklarációalak', adr: 'ADR-008' },
    { code: 'erased-declaration-shape', category: 'conservative', meaning: 'nem elemzett törlődő TS deklarációalak', adr: 'ADR-013' },
    { code: 'function-declaration-not-hoistable', category: 'conservative', meaning: 'blokkszintű függvénydeklaráció', adr: 'ADR-008' },
    { code: 'shared-or-continued-rows', category: 'conservative', meaning: 'a deklaráció sorai más utasítással közösek', adr: 'ADR-009' },
    { code: 'source-order', category: 'conservative', meaning: 'elemzés nélküli forrássorrend (például `eval`, `with`)', adr: 'ADR-011' },
    { code: 'type-member-barrier', category: 'conservative', meaning: 'nem osztályozott típustag', adr: 'ADR-007' },
    { code: 'unclassified-member', category: 'conservative', meaning: 'kiértékelési fázis nélküli osztálytag', adr: 'ADR-012' },
    { code: 'opaque-row', category: 'conservative', meaning: 'elemzésből kimaradt sor (például többsoros megjegyzés)', adr: 'ADR-011' },
    { code: 'shared-boundary-lock', category: 'conservative', meaning: 'közös határsor rögzítése a v2-projekcióban', adr: 'ADR-011' },
    { code: 'module-import', category: 'effect', meaning: 'modulimport: a modul betöltése kódot futtathat', adr: 'ADR-013' },
    { code: 'adapter-unspecified', category: 'unknown', meaning: 'az adapter nem adott okot (nem fordulhat elő)', adr: 'ADR-014' },
    { code: 'projection-unspecified', category: 'unknown', meaning: 'a projekció nem talált okot (nem fordulhat elő)', adr: 'ADR-014' },
];
/** Any other statement is an ordering barrier named by its TypeScript syntax kind (ADR-008),
 * e.g. `ExpressionStatement`: the only PascalCase codes, as every fixed code is kebab-case. */
const statementBarrier = { code: '<szintaxisfajta>', category: 'effect', meaning: 'sorrendhez kötő utasítás, a szintaxisfajtája szerint', adr: 'ADR-008' };
export const REASON_CODES = entries;
const byCode = new Map(entries.map(entry => [entry.code, entry]));
/** The entry of `code`, or undefined when it is not registered. */
export function reasonCode(code) {
    return byCode.get(code) ?? (/^[A-Z][A-Za-z]*$/.test(code) ? { ...statementBarrier, code } : undefined);
}
/** The category of `code`, the only place the analysis learns it: `unknown` for an unregistered
 * code, which the register's test rejects wherever it is emitted. */
export function categoryOf(code) {
    return reasonCode(code)?.category ?? 'unknown';
}
//# sourceMappingURL=reason-codes.js.map