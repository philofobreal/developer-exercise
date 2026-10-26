/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import {statementOrdering, type OrderingOptions} from './statement-ordering.js';
import {typeMemberOrdering} from './type-member-ordering.js';
import {combineOrderingRelations, type OrderingRelations} from './ordering-relations.js';
import type {StructureBlock} from './code-line-projection.js';

/** Brace-delimited blocks as 0-based row intervals. A block of an if/else, try,
 * catch or finally clause is marked `clause`: its boundary row may be shared with
 * the next clause (`} else {`), which the projection represents as a separator. */
export function jsTsStructure(file: ts.SourceFile, compiler: typeof ts): StructureBlock[] {
 const result: StructureBlock[] = [];
 const visit = (node: ts.Node): void => {
  const eligible = compiler.isBlock(node) || compiler.isModuleBlock(node) || compiler.isClassLike(node) || compiler.isInterfaceDeclaration(node) || compiler.isTypeLiteralNode(node) || compiler.isObjectLiteralExpression(node) || compiler.isEnumDeclaration(node);
  if (eligible) {
   const children = node.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
   if (open && close) {
    const clause = compiler.isBlock(node) && (compiler.isIfStatement(node.parent) || compiler.isTryStatement(node.parent) || compiler.isCatchClause(node.parent));
    result.push({start: file.getLineAndCharacterOfPosition(open.getStart(file)).line, end: file.getLineAndCharacterOfPosition(close.getStart(file)).line, kind: compiler.isBlock(node) && compiler.isFunctionLike(node.parent) ? 'function' : 'block', ...(clause ? {clause: true} : {})});
   }
  }
  compiler.forEachChild(node, visit);
 };
 visit(file);
 return result;
}

/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module. */
export function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts, options: OrderingOptions = {}): OrderingRelations {
 const statements = statementOrdering(file, compiler, file.fileName.endsWith('.ts') ? options : {}), members = typeMemberOrdering(file, compiler);
 return combineOrderingRelations([
  {entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({first, last}) => ({first, last})), note: ''},
  {entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note}
 ]);
}
