/** The JavaScript/TypeScript adapter's ordering capability (ADR-011): the TypeScript
 * compiler AST and the binding/effect analyses stay here; the projection receives
 * only language-independent OrderingRelations. Statement-list and class/type-member
 * analyses constrain disjoint rows; their conjunction is the adapter's answer. */
import type ts from 'typescript';
import {statementOrdering, type OrderingOptions} from './statement-ordering.js';
import {typeMemberOrdering} from './type-member-ordering.js';
import {namesMatch, unspelledNames} from './property-names.js';
import {combineOrderingRelations, type OrderingRelations} from './ordering-relations.js';
import type {StructureBlock} from './code-line-projection.js';
import type {AnalysisEnvironment} from '../../dist/index.js';

/** Brace-delimited blocks (a switch body included) as 0-based row intervals. A block of an if/else, try,
 * catch or finally clause is marked `clause`: its boundary row may be shared with
 * the next clause (`} else {`), which the projection represents as a separator. */
export function jsTsStructure(file: ts.SourceFile, compiler: typeof ts): StructureBlock[] {
 const result: StructureBlock[] = [];
 const visit = (node: ts.Node): void => {
  // ADR-047: a switch body is a block too, so its rows stay inside it without sealing the switch.
  const eligible = compiler.isBlock(node) || compiler.isCaseBlock(node) || compiler.isModuleBlock(node) || compiler.isClassLike(node) || compiler.isInterfaceDeclaration(node) || compiler.isTypeLiteralNode(node) || compiler.isObjectLiteralExpression(node) || compiler.isEnumDeclaration(node);
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

/** The emit and runtime assumptions behind the JS/TS analysis (ADR-015): the compiler that
 * analysed it, the TypeScript import emit, script or module semantics (as the global-order
 * rule decides it), class-field-mode independence (ADR-012 holds in both modes) and, when the
 * author chose it, the `valid` input contract (ADR-050) and ignored key order (ADR-055). */
export function jsTsEnvironment(file: ts.SourceFile, compiler: typeof ts, options: OrderingOptions = {}): AnalysisEnvironment {
 return {typescript: compiler.version, ...(file.fileName.endsWith('.ts') ? {importEmit: options.imports ?? 'verbatim'} : {}), sourceKind: compiler.isExternalModule(file) ? 'module' : 'script', classFields: 'either', ...(options.inputs === 'valid' ? {inputs: 'valid'} : {}), ...(options.keyOrder === 'ignored' ? {keyOrder: 'ignored'} : {})};
}

/** Names through which a program can list non-enumerable or global keys in creation order. */
const keyReflection = /\b(?:getOwnPropertyNames|ownKeys|getOwnPropertyDescriptors|Reflect|globalThis|window|self|frames|global|Function|eval)\b/;
/** ADR-020: whether the program itself may observe the creation order of method,
 * accessor or top-level function keys: it names a reflection API or the global
 * object (also inside strings, which only makes it stricter), or uses `this` at
 * script level, where it is the global object. Names the program reaches without spelling them out
 * count as named (ADR-052, ADR-053). */
export function observesKeyOrder(file: ts.SourceFile, compiler: typeof ts, reached = unspelledNames(file, compiler)): boolean {
 if (namesMatch(file, reached, keyReflection)) return true;
 let found = false;
 const visit = (node: ts.Node): void => {
  if (found || compiler.isClassLike(node) || compiler.isFunctionLike(node) && !compiler.isArrowFunction(node)) return;
  if (node.kind === compiler.SyntaxKind.ThisKeyword) {found = true; return;}
  compiler.forEachChild(node, visit);
 };
 if (!compiler.isExternalModule(file)) visit(file);
 return found;
}

/** Names and forms through which a program lists enumerable keys in creation order (also inside
 * strings, which only makes it stricter): key listing, serialisation, copying, printing, for…in
 * and any spread. */
const keyEnumeration = /\b(?:keys|values|entries|stringify|assign|structuredClone|console|inspect)\b|\.\.\.|\bfor\s*\([^)]*\bin\b/;
/** ADR-029: whether the program itself may observe the creation order of instance fields. */
export function enumeratesKeys(file: ts.SourceFile, compiler: typeof ts, reached = unspelledNames(file, compiler)): boolean {
 return observesKeyOrder(file, compiler, reached) || namesMatch(file, reached, keyEnumeration);
}

/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module.
 * `options.inputs` is the input contract (ADR-050) of either language. `options.keyOrder` (ADR-055):
 * when the author declares key order `ignored`, no constraint protects the creation order of keys. */
export function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts, options: OrderingOptions = {}): OrderingRelations {
 const observed = options.keyOrder !== 'ignored', reached = unspelledNames(file, compiler);
 const reflectedKeys = observed && observesKeyOrder(file, compiler, reached), enumeratedKeys = observed && enumeratesKeys(file, compiler, reached);
 const {imports, inputs} = options;
 const statements = statementOrdering(file, compiler, {...(file.fileName.endsWith('.ts') && imports ? {imports} : {}), ...(inputs ? {inputs} : {}), reflectedKeys, enumeratedKeys}), members = typeMemberOrdering(file, compiler, {reflectedKeys, enumeratedKeys});
 const unavailable = statements.inputsUnavailable ? 'Az érvényes bemenet szerződése nem alkalmazható: a program módosíthatja az olvasást (Proxy, prototípus, eval, képzett név), ezért szigorú.' : '';
 return combineOrderingRelations([
  {entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({first, last}) => ({first, last})), note: unavailable},
  {entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note}
 ]);
}
