/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import { type OrderingRelations } from './ordering-relations.js';
export declare function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts): OrderingRelations;
