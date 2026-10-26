/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import {statementOrdering} from './statement-ordering.js';
import {typeMemberOrdering} from './type-member-ordering.js';
import {combineOrderingRelations, type OrderingRelations} from './ordering-relations.js';

export function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts): OrderingRelations {
 const statements = statementOrdering(file, compiler), members = typeMemberOrdering(file, compiler);
 return combineOrderingRelations([
  {entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({first, last}) => ({first, last})), note: ''},
  {entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note}
 ]);
}
