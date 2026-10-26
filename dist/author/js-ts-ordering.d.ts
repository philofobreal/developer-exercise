/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import { type OrderingOptions } from './statement-ordering.js';
import { type OrderingRelations } from './ordering-relations.js';
import type { StructureBlock } from './code-line-projection.js';
import type { AnalysisEnvironment } from '../../dist/index.js';
/** Brace-delimited blocks as 0-based row intervals. A block of an if/else, try,
 * catch or finally clause is marked `clause`: its boundary row may be shared with
 * the next clause (`} else {`), which the projection represents as a separator. */
export declare function jsTsStructure(file: ts.SourceFile, compiler: typeof ts): StructureBlock[];
/** The emit and runtime assumptions behind the JS/TS analysis (ADR-015): the compiler that
 * analysed it, the TypeScript import emit, script or module semantics (as the global-order
 * rule decides it) and class-field-mode independence (ADR-012 holds in both modes). */
export declare function jsTsEnvironment(file: ts.SourceFile, compiler: typeof ts, options?: OrderingOptions): AnalysisEnvironment;
/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module. */
export declare function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts, options?: OrderingOptions): OrderingRelations;
