/** Reason codes of the generated ordering constraints (plan phase 3, ADR-038). This is the one
 * register of every `code` the JS/TS analysis writes into `authoring.provenance`: its category,
 * what it means and the ADR that introduced it. The analysis names only codes; the projection
 * and the barrier commutation rule ask `categoryOf`, and `ReasonCodeName` makes the compiler
 * reject an unregistered literal code. Tests require evidence for every entry: an arrangement that breaks
 * only this kind of constraint and is rejected, with the oracle confirming a different
 * behaviour, or, for a conservative code, at least one occurrence (reason-codes.test.mjs).
 *
 * Freedoms are not coded: a position-free row simply has no constraint, and the pinned corpus
 * acceptance counts are their positive evidence. */
import type ts from 'typescript';
import type { ConstraintCategory } from '../../dist/index.js';
export interface ReasonCodeEntry {
    readonly code: string;
    readonly category: ConstraintCategory;
    /** What the constraint protects, in Hungarian, for authors and reviews. */
    readonly meaning: string;
    readonly adr: string;
}
declare const entries: readonly [{
    readonly code: "binding-input";
    readonly category: "data";
    readonly meaning: "a sor egy korábban deklarált kötés értékét olvassa";
    readonly adr: "ADR-008";
}, {
    readonly code: "read-after-write";
    readonly category: "data";
    readonly meaning: "olvasás egy kötés írása után";
    readonly adr: "ADR-013";
}, {
    readonly code: "write-after-read";
    readonly category: "data";
    readonly meaning: "írás egy kötés olvasása után";
    readonly adr: "ADR-013";
}, {
    readonly code: "write-after-write";
    readonly category: "data";
    readonly meaning: "két írás ugyanarra a kötésre";
    readonly adr: "ADR-013";
}, {
    readonly code: "object-read-after-write";
    readonly category: "data";
    readonly meaning: "saját objektum mezőjének olvasása az írása után";
    readonly adr: "ADR-025";
}, {
    readonly code: "object-write-after-read";
    readonly category: "data";
    readonly meaning: "saját objektum mezőjének írása az olvasása után";
    readonly adr: "ADR-025";
}, {
    readonly code: "object-write-after-write";
    readonly category: "data";
    readonly meaning: "két írás ugyanarra a saját objektummezőre";
    readonly adr: "ADR-025";
}, {
    readonly code: "effectful-or-unknown-initializer";
    readonly category: "effect";
    readonly meaning: "a deklaráció kezdőértéke kódot futtat vagy ismeretlen";
    readonly adr: "ADR-008";
}, {
    readonly code: "block-contains-barrier";
    readonly category: "effect";
    readonly meaning: "a blokk egy sorrendhez kötő utasítást tartalmaz";
    readonly adr: "ADR-025";
}, {
    readonly code: "branch-contains-barrier";
    readonly category: "effect";
    readonly meaning: "az elágazás feltétele vagy ága sorrendhez kötő";
    readonly adr: "ADR-028";
}, {
    readonly code: "class-evaluates-code";
    readonly category: "effect";
    readonly meaning: "az osztálydefiníció kiértékeléskor kódot futtat";
    readonly adr: "ADR-012";
}, {
    readonly code: "class-evaluation-order";
    readonly category: "effect";
    readonly meaning: "osztálytagok ugyanabban a kiértékelési fázisban";
    readonly adr: "ADR-012";
}, {
    readonly code: "may-throw";
    readonly category: "effect";
    readonly meaning: "két esetleg kivételt dobó művelet";
    readonly adr: "ADR-028";
}, {
    readonly code: "external-call-order";
    readonly category: "effect";
    readonly meaning: "programon kívüli kódot hívó művelet egy másikkal, vagy egy általa írható kötés olvasásával";
    readonly adr: "ADR-040";
}, {
    readonly code: "reflected-key-order";
    readonly category: "policy";
    readonly meaning: "a program felsorolja a kulcsokat, ezért a létrehozás sorrendje megfigyelhető";
    readonly adr: "ADR-010";
}, {
    readonly code: "script-global-order";
    readonly category: "policy";
    readonly meaning: "szkriptszintű globális kötések létrehozási sorrendje";
    readonly adr: "ADR-010";
}, {
    readonly code: "block-open";
    readonly category: "structure";
    readonly meaning: "a sor a blokk nyitó sora után áll";
    readonly adr: "ADR-014";
}, {
    readonly code: "block-close";
    readonly category: "structure";
    readonly meaning: "a sor a blokk záró sora előtt áll";
    readonly adr: "ADR-014";
}, {
    readonly code: "clause-boundary";
    readonly category: "structure";
    readonly meaning: "klauzulalánc határa (`} else {`, `case`)";
    readonly adr: "ADR-013";
}, {
    readonly code: "clause-segment";
    readonly category: "structure";
    readonly meaning: "a klauzula sorai a határa után";
    readonly adr: "ADR-013";
}, {
    readonly code: "clause-separator";
    readonly category: "structure";
    readonly meaning: "a következő klauzula a határ után";
    readonly adr: "ADR-013";
}, {
    readonly code: "overload-group";
    readonly category: "structure";
    readonly meaning: "TS overload-szignatúrák és megvalósításuk egymás mellett";
    readonly adr: "ADR-009";
}, {
    readonly code: "continued-row";
    readonly category: "unit";
    readonly meaning: "egy többsoros utasítás folytató sora";
    readonly adr: "ADR-009";
}, {
    readonly code: "sealed-unit";
    readonly category: "unit";
    readonly meaning: "lezárt többsoros egység a v2-projekcióban";
    readonly adr: "ADR-009";
}, {
    readonly code: "declaration-shape";
    readonly category: "conservative";
    readonly meaning: "nem elemzett deklarációalak";
    readonly adr: "ADR-008";
}, {
    readonly code: "erased-declaration-shape";
    readonly category: "conservative";
    readonly meaning: "nem elemzett törlődő TS deklarációalak";
    readonly adr: "ADR-013";
}, {
    readonly code: "function-declaration-not-hoistable";
    readonly category: "conservative";
    readonly meaning: "blokkszintű függvénydeklaráció";
    readonly adr: "ADR-008";
}, {
    readonly code: "shared-or-continued-rows";
    readonly category: "conservative";
    readonly meaning: "a deklaráció sorai más utasítással közösek";
    readonly adr: "ADR-009";
}, {
    readonly code: "source-order";
    readonly category: "conservative";
    readonly meaning: "elemzés nélküli forrássorrend (például `eval`, `with`)";
    readonly adr: "ADR-011";
}, {
    readonly code: "type-member-barrier";
    readonly category: "conservative";
    readonly meaning: "nem osztályozott típustag";
    readonly adr: "ADR-007";
}, {
    readonly code: "unclassified-member";
    readonly category: "conservative";
    readonly meaning: "kiértékelési fázis nélküli osztálytag";
    readonly adr: "ADR-012";
}, {
    readonly code: "opaque-row";
    readonly category: "conservative";
    readonly meaning: "elemzésből kimaradt sor (például többsoros megjegyzés)";
    readonly adr: "ADR-011";
}, {
    readonly code: "shared-boundary-lock";
    readonly category: "conservative";
    readonly meaning: "közös határsor rögzítése a v2-projekcióban";
    readonly adr: "ADR-011";
}, {
    readonly code: "module-import";
    readonly category: "effect";
    readonly meaning: "modulimport: a modul betöltése kódot futtathat";
    readonly adr: "ADR-013";
}, {
    readonly code: "adapter-unspecified";
    readonly category: "unknown";
    readonly meaning: "az adapter nem adott okot (nem fordulhat elő)";
    readonly adr: "ADR-014";
}, {
    readonly code: "projection-unspecified";
    readonly category: "unknown";
    readonly meaning: "a projekció nem talált okot (nem fordulhat elő)";
    readonly adr: "ADR-014";
}];
export type SyntaxKindName = keyof typeof ts.SyntaxKind;
export type ReasonCodeName = (typeof entries)[number]['code'] | SyntaxKindName;
export declare const REASON_CODES: readonly ReasonCodeEntry[];
/** The entry of `code`, or undefined when it is not registered. */
export declare function reasonCode(code: string): ReasonCodeEntry | undefined;
/** The category of `code`, the only place the analysis learns it: `unknown` for an unregistered
 * code, which the register's test rejects wherever it is emitted. */
export declare function categoryOf(code: string): ConstraintCategory;
export {};
