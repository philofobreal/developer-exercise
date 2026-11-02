/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import { type OrderingOptions } from './statement-ordering.js';
import { type OrderingRelations } from './ordering-relations.js';
import type { StructureBlock } from './code-line-projection.js';
import type { AnalysisEnvironment } from '../../dist/index.js';
/** Brace-delimited blocks (a switch body included) as 0-based row intervals. A block of an if/else, try,
 * catch or finally clause is marked `clause`: its boundary row may be shared with
 * the next clause (`} else {`), which the projection represents as a separator. */
export declare function jsTsStructure(file: ts.SourceFile, compiler: typeof ts): StructureBlock[];
/** The emit and runtime assumptions behind the JS/TS analysis (ADR-015): the compiler that
 * analysed it, the TypeScript import emit, script or module semantics (as the global-order
 * rule decides it), class-field-mode independence (ADR-012 holds in both modes) and, when the
 * author chose it, the `valid` input contract (ADR-050) and ignored key order (ADR-055). */
export declare function jsTsEnvironment(file: ts.SourceFile, compiler: typeof ts, options?: OrderingOptions): AnalysisEnvironment;
/** ADR-020: whether the program itself may observe the creation order of method,
 * accessor or top-level function keys: it names a reflection API or the global
 * object (also inside strings, which only makes it stricter), or uses `this` at
 * script level, where it is the global object. Names the program reaches without spelling them out
 * count as named (ADR-052, ADR-053). */
export declare function observesKeyOrder(file: ts.SourceFile, compiler: typeof ts, reached?: import("./property-names.js").UnspelledNames): boolean;
/** ADR-029: whether the program itself may observe the creation order of instance fields. */
export declare function enumeratesKeys(file: ts.SourceFile, compiler: typeof ts, reached?: import("./property-names.js").UnspelledNames): boolean;
/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module.
 * `options.inputs` is the input contract (ADR-050) of either language. `options.keyOrder` (ADR-055):
 * when the author declares key order `ignored`, no constraint protects the creation order of keys. */
export declare function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts, options?: OrderingOptions): OrderingRelations;
