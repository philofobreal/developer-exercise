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
 * rule decides it), the class-field mode (ADR-012 holds in both modes; ADR-075: `define` when the author
 * chose it) and, when the author chose it, the `valid` input contract (ADR-050) and ignored key order (ADR-055). */
export function jsTsEnvironment(file: ts.SourceFile, compiler: typeof ts, options: OrderingOptions = {}): AnalysisEnvironment {
 return {typescript: compiler.version, ...(file.fileName.endsWith('.ts') ? {importEmit: options.imports ?? 'verbatim'} : {}), sourceKind: compiler.isExternalModule(file) ? 'module' : 'script', classFields: options.classFields === 'define' ? 'define' : 'either', ...(options.inputs === 'valid' ? {inputs: 'valid'} : {}), ...(options.keyOrder === 'ignored' ? {keyOrder: 'ignored'} : {})};
}

/** ADR-060: the source text the key-observation patterns are matched against. Occurrences that
 * cannot reach a built-in or the global object are blanked (newlines kept):
 *  - comments;
 *  - the program's own declared names: variables, parameters, functions, classes, class and
 *    object-literal members, type members, enum members;
 *  - references to its own variables named like a property-only API (`keys`, `entries`, …): no
 *    global has such a name, so a bare reference is the program's own (unless `with` is used);
 *  - properties of the program's own instances: `this.x` inside its class bodies, and `v.x` where
 *    `const v = new C(…)` of a class in the file without heritage or a constructor `return`, used
 *    in the declaring block — unless a method may be rebound (`call`, `apply`, `bind`, `Reflect`,
 *    `prototype`, a method read without a call, or an unspelled name).
 * Everything else stays textual, strings included. */
const PROPERTY_ONLY = new Set(['keys', 'values', 'entries', 'stringify', 'assign', 'getOwnPropertyNames', 'ownKeys', 'getOwnPropertyDescriptors']);
const REBINDING = /\.(?:call|apply|bind)\b|\bReflect\b|\.prototype\b|setPrototypeOf|__proto__|\bwith\s*\(/;
export function keyObservationText(file: ts.SourceFile, compiler: typeof ts, reached = unspelledNames(file, compiler)): string {
 const text = file.text, S = compiler.SyntaxKind, blank: [number, number][] = [];
 const name = (node: ts.Node | undefined): void => {if (node && (compiler.isIdentifier(node) || compiler.isPrivateIdentifier(node) || compiler.isStringLiteral(node))) blank.push([node.getStart(file), node.end]);};
 let withStatement = false;
 const methods = new Set<string>(), declared = new Map<string, number>(), instances = new Map<string, ts.Node>();
 const classes = new Map<string, ts.ClassDeclaration>();
 const survey = (node: ts.Node): void => {
  if (compiler.isWithStatement(node)) withStatement = true;
  if (compiler.isClassDeclaration(node) && node.name) classes.set(node.name.text, node);
  if ((compiler.isMethodDeclaration(node) || compiler.isGetAccessorDeclaration(node) || compiler.isSetAccessorDeclaration(node)) && compiler.isClassLike(node.parent) && compiler.isIdentifier(node.name)) methods.add(node.name.text);
  if ((compiler.isVariableDeclaration(node) || compiler.isParameter(node) || compiler.isFunctionDeclaration(node) || compiler.isClassDeclaration(node) || compiler.isBindingElement(node)) && node.name && compiler.isIdentifier(node.name)) declared.set(node.name.text, (declared.get(node.name.text) ?? 0) + 1);
  compiler.forEachChild(node, survey);
 };
 survey(file);
 // A method read without being called may be rebound to any receiver.
 let extracted = false;
 const reads = (node: ts.Node): void => {
  if (compiler.isPropertyAccessExpression(node) && methods.has(node.name.text) && !(compiler.isCallExpression(node.parent) && node.parent.expression === node)) extracted = true;
  if (compiler.isBindingElement(node) && methods.has((node.propertyName ?? node.name).getText(file))) extracted = true;
  compiler.forEachChild(node, reads);
 };
 reads(file);
 const rebindable = extracted || REBINDING.test(text) || reached === 'any' || reached.some(item => item === 'call' || item === 'apply' || item === 'bind' || item === 'prototype');
 // `const v = new C(…)`: v is declared once in the file, C is a class of the file that returns its own instance.
 const ownClass = (expression: ts.Expression): boolean => {
  if (!compiler.isIdentifier(expression)) return false;
  const declaration = classes.get(expression.text);
  if (!declaration || declaration.heritageClauses?.length || (declared.get(expression.text) ?? 0) !== 1) return false;
  let returns = false;
  const visit = (node: ts.Node): void => {if (compiler.isReturnStatement(node) && node.expression) returns = true; else if (!compiler.isFunctionLike(node) || compiler.isConstructorDeclaration(node)) compiler.forEachChild(node, visit);};
  for (const member of declaration.members) if (compiler.isConstructorDeclaration(member) && member.body) visit(member.body);
  return !returns;
 };
 const scan = (node: ts.Node): void => {
  if (compiler.isVariableStatement(node) && node.declarationList.flags & compiler.NodeFlags.Const) for (const declaration of node.declarationList.declarations) {
   if (compiler.isIdentifier(declaration.name) && declared.get(declaration.name.text) === 1 && declaration.initializer && compiler.isNewExpression(declaration.initializer) && ownClass(declaration.initializer.expression)) instances.set(declaration.name.text, node.parent);
  }
  compiler.forEachChild(node, scan);
 };
 scan(file);
 const inClassBody = (node: ts.Node): boolean => {
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
   if (compiler.isArrowFunction(at)) continue;
   if (compiler.isClassLike(at)) return true;
   if (compiler.isFunctionLike(at) || compiler.isClassStaticBlockDeclaration(at)) return !!at.parent && compiler.isClassLike(at.parent);
   if (compiler.isSourceFile(at)) return false;
  }
  return false;
 };
 const within = (node: ts.Node, scope: ts.Node): boolean => {for (let at: ts.Node | undefined = node; at; at = at.parent) if (at === scope) return true; return false;};
 const comments = new Set<number>();
 const visit = (node: ts.Node): void => {
  for (const range of [...compiler.getLeadingCommentRanges(text, node.pos) ?? [], ...compiler.getTrailingCommentRanges(text, node.end) ?? []]) if (!comments.has(range.pos)) {comments.add(range.pos); blank.push([range.pos, range.end]);}
  if (compiler.isVariableDeclaration(node) || compiler.isParameter(node) || compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isClassDeclaration(node) || compiler.isClassExpression(node) || compiler.isInterfaceDeclaration(node) || compiler.isTypeAliasDeclaration(node) || compiler.isEnumDeclaration(node) || compiler.isEnumMember(node) || compiler.isPropertySignature(node) || compiler.isMethodSignature(node)) name(node.name);
  else if (compiler.isPropertyDeclaration(node) || compiler.isMethodDeclaration(node) || compiler.isGetAccessorDeclaration(node) || compiler.isSetAccessorDeclaration(node) || compiler.isPropertyAssignment(node)) name(node.name);
  else if (compiler.isBindingElement(node) && node.propertyName) name(node.name);
  else if (compiler.isIdentifier(node) && PROPERTY_ONLY.has(node.text) && !withStatement) {
   const parent = node.parent;
   const property = compiler.isPropertyAccessExpression(parent) && parent.name === node || compiler.isBindingElement(parent) && (parent.propertyName === node || !parent.propertyName) || compiler.isPropertyAssignment(parent) && parent.name === node || compiler.isQualifiedName(parent);
   if (!property) name(node);
  }
  if (compiler.isPropertyAccessExpression(node) && !rebindable) {
   const receiver = node.expression;
   if (receiver.kind === S.ThisKeyword && inClassBody(node)) name(node.name);
   else if (compiler.isIdentifier(receiver) && instances.has(receiver.text) && within(node, instances.get(receiver.text)!)) name(node.name);
  }
  compiler.forEachChild(node, visit);
 };
 visit(file);
 blank.push(...(compiler.getLeadingCommentRanges(text, file.endOfFileToken.pos) ?? []).map(range => [range.pos, range.end] as [number, number]));
 let out = text;
 for (const [start, end] of blank.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + out.slice(start, end).replace(/[^\n]/g, ' ') + out.slice(end);
 return out;
}

/** Names through which a program can list non-enumerable or global keys in creation order. */
const keyReflection = /\b(?:getOwnPropertyNames|ownKeys|getOwnPropertyDescriptors|Reflect|globalThis|window|self|frames|global|Function|eval)\b/;
/** ADR-020: whether the program itself may observe the creation order of method,
 * accessor or top-level function keys: it names a reflection API or the global
 * object (also inside strings, which only makes it stricter), or uses `this` at
 * script level, where it is the global object. Names the program reaches without spelling them out
 * count as named (ADR-052, ADR-053). */
export function observesKeyOrder(file: ts.SourceFile, compiler: typeof ts, reached = unspelledNames(file, compiler), text = keyObservationText(file, compiler, reached)): boolean {
 if (namesMatch(file, reached, keyReflection, text)) return true;
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
export function enumeratesKeys(file: ts.SourceFile, compiler: typeof ts, reached = unspelledNames(file, compiler), text = keyObservationText(file, compiler, reached)): boolean {
 return observesKeyOrder(file, compiler, reached, text) || namesMatch(file, reached, keyEnumeration, text);
}

/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module.
 * `options.inputs` is the input contract (ADR-050) of either language. `options.keyOrder` (ADR-055):
 * when the author declares key order `ignored`, no constraint protects the creation order of keys. */
export function jsTsOrderingRelations(file: ts.SourceFile, compiler: typeof ts, options: OrderingOptions = {}): OrderingRelations {
 const observed = options.keyOrder !== 'ignored', reached = unspelledNames(file, compiler), text = observed ? keyObservationText(file, compiler, reached) : '';
 const reflectedKeys = observed && observesKeyOrder(file, compiler, reached, text), enumeratedKeys = observed && enumeratesKeys(file, compiler, reached, text);
 const {imports, inputs, classFields} = options;
 const statements = statementOrdering(file, compiler, {...(file.fileName.endsWith('.ts') && imports ? {imports} : {}), ...(inputs ? {inputs} : {}), reflectedKeys, enumeratedKeys}), members = typeMemberOrdering(file, compiler, {reflectedKeys, enumeratedKeys, ...(classFields === 'define' ? {classFields} : {})});
 const unavailable = statements.inputsUnavailable ? 'Az érvényes bemenet szerződése nem alkalmazható: a program módosíthatja az olvasást (Proxy, prototípus, eval, képzett név), ezért szigorú.' : '';
 return combineOrderingRelations([
  {entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({first, last, header}) => ({first, last, ...(header ? {header} : {})})), note: unavailable},
  {entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note}
 ]);
}
