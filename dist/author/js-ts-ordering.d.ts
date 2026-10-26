/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import { type OrderingOptions } from './statement-ordering.js';
import { type OrderingRelations } from './ordering-relations.js';
import type { StructureBlock } from './code-line-projection.js';
/** Brace-delimited blocks as 0-based row intervals. A block of an if/else, try,
 * catch or finally clause is marked `clause`: its boundary row may be shared with
 * the next clause (`} else {`), which the projection represents as a separator. */
export declare function jsTsStructure(file: ts.SourceFile, compiler: typeof ts): StructureBlock[];
/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module. */
export declare function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts, options?: OrderingOptions): OrderingRelations;
