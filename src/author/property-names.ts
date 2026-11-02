/** The property names a program reaches without spelling them out, and then uses (ADR-052, policy
 * v27; ADR-053, policy v28). Author-only: it reads the reference source and never runs for learner
 * submissions.
 *
 * The key-order rules (ADR-020, ADR-029) and the input contract (ADR-050) recognise reflection, key
 * listing and read-changing APIs by their names in the source text. A program can reach them without
 * the name appearing: it reads a property by a name computed at run time (`Object['ke' + 'ys']`),
 * reads `constructor` (the way to `Function`, so to code built from a string) or hands a string to a
 * timer.
 *
 * Such a read only yields a value; code runs when the value is called, or once it goes where this
 * analysis does not follow it (an argument, a store into something not the program's own literal, a
 * throw). This module hides that analysis:
 * - which name a computed key has: literals, literal choices, concatenations and numbers fold to a
 *   known set of names, which the callers' name rules then judge as if spelled; anything else is
 *   any name;
 * - which uses of a read value keep it harmless: comparing, computing with, converting, testing,
 *   keying by it, reading from it, calling a spelled method on it, keeping it in the program's own
 *   array or object literal, returning it to a call whose result is used the same way.
 * Names are followed by name, not by scope, which only makes the answer stricter.
 */
import type ts from 'typescript';
type Compiler = typeof ts;

/** The names reached and used without being spelled out, or `'any'` when one cannot be known. */
export type UnspelledNames = 'any' | readonly string[];

/** Timers that compile a string argument as code. */
const TIMERS = new Set(['setTimeout', 'setInterval', 'setImmediate']);
/** Methods that call or wrap their receiver itself rather than a spelled function. */
const INVOKERS = new Set(['call', 'apply', 'bind']);
/** Method names the language itself calls, without a spelled call: proxy traps, iteration,
 * thenables, conversion and serialisation. Their results reach code this analysis does not see. */
const IMPLICIT = new Set(['get', 'set', 'has', 'apply', 'construct', 'ownKeys', 'getOwnPropertyDescriptor', 'defineProperty', 'deleteProperty', 'getPrototypeOf', 'setPrototypeOf', 'isExtensible', 'preventExtensions', 'next', 'return', 'throw', 'then', 'toString', 'valueOf', 'toJSON', 'toLocaleString', 'handleEvent']);
/** Array methods that call a function with the elements. */
const CALLBACKS = new Set(['map', 'filter', 'forEach', 'reduce', 'reduceRight', 'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'flatMap', 'sort', 'toSorted']);
/** A statically known value set grows no larger than this; beyond it the value is unknown. */
const LIMIT = 64;
const SOME_NUMBER = Symbol('number');
/** The result of an operation on known values that is itself not known. */
const UNKNOWN = Symbol('unknown');
type Value = string | number | bigint | boolean | null | undefined | typeof SOME_NUMBER;
/** The values an expression may have, or `null` when they are not known. */
type Values = ReadonlySet<Value> | null;
/** How much is known about a value that holds what an unspelled read yielded:
 * `value` is the read value itself; `array` and `object` are the program's own literals holding it;
 * `unknown` is anything reached from those. */
type Holder = 'value' | 'array' | 'object' | 'unknown';
interface Taint {readonly names: UnspelledNames; readonly holder: Holder;}

const typeofNames = ['undefined', 'object', 'boolean', 'number', 'string', 'function', 'symbol', 'bigint'];

export function unspelledNames(file: ts.SourceFile, compiler: Compiler): UnspelledNames {
 const k = compiler.SyntaxKind;
 const numeric = new Set<ts.SyntaxKind>([k.MinusToken, k.AsteriskToken, k.SlashToken, k.PercentToken, k.AsteriskAsteriskToken, k.AmpersandToken, k.BarToken, k.CaretToken, k.LessThanLessThanToken, k.GreaterThanGreaterThanToken, k.GreaterThanGreaterThanGreaterThanToken]);
 const numericAssignment = new Set<ts.SyntaxKind>([k.MinusEqualsToken, k.AsteriskEqualsToken, k.SlashEqualsToken, k.PercentEqualsToken, k.AsteriskAsteriskEqualsToken, k.AmpersandEqualsToken, k.BarEqualsToken, k.CaretEqualsToken, k.LessThanLessThanEqualsToken, k.GreaterThanGreaterThanEqualsToken, k.GreaterThanGreaterThanGreaterThanEqualsToken]);
 /** Operators whose operands are only compared, converted or computed with. */
 const consuming = new Set<ts.SyntaxKind>([...numeric, k.PlusToken, k.LessThanToken, k.GreaterThanToken, k.LessThanEqualsToken, k.GreaterThanEqualsToken, k.EqualsEqualsToken, k.EqualsEqualsEqualsToken, k.ExclamationEqualsToken, k.ExclamationEqualsEqualsToken, k.InKeyword, k.InstanceOfKeyword]);
 const assignment = (operator: ts.SyntaxKind): boolean => operator >= k.FirstAssignment && operator <= k.LastAssignment;
 const transparent = (node: ts.Node): node is ts.ParenthesizedExpression | ts.AsExpression | ts.SatisfiesExpression | ts.NonNullExpression | ts.TypeAssertion =>
  compiler.isParenthesizedExpression(node) || compiler.isAsExpression(node) || compiler.isSatisfiesExpression(node) || compiler.isNonNullExpression(node) || compiler.isTypeAssertionExpression(node);

 // ---- What the file gives each name, and where it reads each name and calls each function. ----
 const values = new Map<string, (ts.Expression | 'number' | 'undefined' | null)[]>();
 const reads = new Map<string, ts.Identifier[]>();
 const members = new Map<string, ts.PropertyAccessExpression[]>();
 const give = (name: string, value: ts.Expression | 'number' | 'undefined' | null): void => {const list = values.get(name) ?? []; list.push(value); values.set(name, list);};
 const bound = (node: ts.Node): string[] => compiler.isIdentifier(node) ? [node.text] : compiler.isShorthandPropertyAssignment(node) ? [node.name.text] : compiler.isPropertyAccessExpression(node) || compiler.isElementAccessExpression(node) ? [] : (() => {const all: string[] = []; compiler.forEachChild(node, child => {if (!compiler.isComputedPropertyName(child) && !(compiler.isBindingElement(node) && child === node.propertyName) && !(compiler.isPropertyAssignment(node) && child === node.name)) all.push(...bound(child));}); return all;})();
 const unknown = (target: ts.Node): void => {for (const name of bound(target)) give(name, null);};
 /** The pattern contains a target that is not a plain name: a property or element write. */
 const storesInto = (target: ts.Node): boolean => compiler.isPropertyAccessExpression(target) || compiler.isElementAccessExpression(target) || (!compiler.isIdentifier(target) && !compiler.isComputedPropertyName(target) && !!compiler.forEachChild(target, child => child !== (target as ts.BindingElement).propertyName && child !== (compiler.isPropertyAssignment(target) ? target.name : undefined) && storesInto(child) || undefined));
 const declarationName = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (compiler.isPropertyAccessExpression(parent)) return parent.name === node;
  if (compiler.isQualifiedName(parent)) return true;
  if (compiler.isBindingElement(parent)) return parent.name === node || parent.propertyName === node;
  if (compiler.isPropertyAssignment(parent)) return parent.name === node;
  if (compiler.isLabeledStatement(parent) || compiler.isBreakOrContinueStatement(parent)) return true;
  return (compiler.isVariableDeclaration(parent) || compiler.isParameter(parent) || compiler.isFunctionLike(parent) || compiler.isClassLike(parent) || compiler.isEnumDeclaration(parent) || compiler.isEnumMember(parent) || compiler.isPropertyDeclaration(parent) || compiler.isPropertySignature(parent) || compiler.isInterfaceDeclaration(parent) || compiler.isTypeAliasDeclaration(parent) || compiler.isModuleDeclaration(parent) || compiler.isTypeParameterDeclaration(parent) || compiler.isImportClause(parent) || compiler.isImportSpecifier(parent) || compiler.isExportSpecifier(parent) || compiler.isNamespaceImport(parent) || compiler.isImportEqualsDeclaration(parent) || compiler.isNamespaceExport(parent)) && (parent as ts.NamedDeclaration).name === node;
 };
 /** A property of an object literal that is the target of a destructuring assignment. */
 const destructuringTarget = (node: ts.Node): boolean => {
  let current: ts.Node = node;
  while (compiler.isPropertyAssignment(current) || compiler.isShorthandPropertyAssignment(current) || compiler.isObjectLiteralExpression(current) || compiler.isArrayLiteralExpression(current) || compiler.isSpreadAssignment(current) || compiler.isSpreadElement(current)) {
   const parent: ts.Node = current.parent;
   if (compiler.isBinaryExpression(parent) && parent.left === current && assignment(parent.operatorToken.kind)) return true;
   if ((compiler.isForOfStatement(parent) || compiler.isForInStatement(parent)) && parent.initializer === current) return true;
   current = parent;
  }
  return false;
 };
 const candidates: ts.Expression[] = [], computedBindings: ts.ComputedPropertyName[] = [], assignedKeys: ts.Expression[] = [];
 let timer = false;
 const visit = (node: ts.Node): void => {
  if (compiler.isTypeNode(node)) return;
  if (compiler.isIdentifier(node) && !declarationName(node)) {const list = reads.get(node.text) ?? []; list.push(node); reads.set(node.text, list);}
  if (compiler.isPropertyAccessExpression(node) && compiler.isIdentifier(node.name)) {const list = members.get(node.name.text) ?? []; list.push(node); members.set(node.name.text, list);}
  if (compiler.isVariableDeclaration(node)) {
   const loopHead = compiler.isVariableDeclarationList(node.parent) && (compiler.isForOfStatement(node.parent.parent) || compiler.isForInStatement(node.parent.parent));
   if (compiler.isIdentifier(node.name) && !loopHead) {
    give(node.name.text, node.initializer ?? 'undefined');
    // A `var` reads as undefined before its initializer runs.
    if (node.initializer && compiler.isVariableDeclarationList(node.parent) && !(node.parent.flags & (compiler.NodeFlags.Let | compiler.NodeFlags.Const))) give(node.name.text, 'undefined');
   } else unknown(node.name);
  } else if (compiler.isParameter(node) || compiler.isBindingElement(node) && !compiler.isVariableDeclaration(node.parent.parent)) unknown(node.name);
  else if ((compiler.isFunctionDeclaration(node) || compiler.isClassDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isClassExpression(node) || compiler.isEnumDeclaration(node) || compiler.isModuleDeclaration(node) || compiler.isImportClause(node) || compiler.isImportSpecifier(node) || compiler.isNamespaceImport(node) || compiler.isImportEqualsDeclaration(node)) && node.name && compiler.isIdentifier(node.name)) give(node.name.text, null);
  else if (compiler.isBinaryExpression(node) && assignment(node.operatorToken.kind)) {
   const operator = node.operatorToken.kind;
   if (!compiler.isIdentifier(node.left)) unknown(node.left);
   else if (operator === k.EqualsToken) give(node.left.text, node.right);
   else if (numericAssignment.has(operator)) give(node.left.text, 'number');
   else give(node.left.text, operator === k.PlusEqualsToken ? node : null);
  } else if ((compiler.isPrefixUnaryExpression(node) || compiler.isPostfixUnaryExpression(node)) && (node.operator === k.PlusPlusToken || node.operator === k.MinusMinusToken) && compiler.isIdentifier(node.operand)) give(node.operand.text, 'number');
  else if ((compiler.isForOfStatement(node) || compiler.isForInStatement(node)) && !compiler.isVariableDeclarationList(node.initializer)) unknown(node.initializer);
  else if (compiler.isCatchClause(node) && node.variableDeclaration) unknown(node.variableDeclaration.name);
  // Values read by a name the source may not spell out, and timers that run a string.
  if (compiler.isElementAccessExpression(node) || compiler.isPropertyAccessExpression(node) && node.name.text === 'constructor') candidates.push(node);
  else if (compiler.isComputedPropertyName(node) && compiler.isBindingElement(node.parent)) computedBindings.push(node);
  else if (compiler.isComputedPropertyName(node) && compiler.isPropertyAssignment(node.parent) && destructuringTarget(node.parent)) assignedKeys.push(node.expression);
  else if (compiler.isCallExpression(node) && compiler.isIdentifier(node.expression) && TIMERS.has(node.expression.text) && !(node.arguments[0] && (compiler.isArrowFunction(node.arguments[0]) || compiler.isFunctionExpression(node.arguments[0])))) timer = true;
  compiler.forEachChild(node, visit);
 };
 visit(file);
 if (timer) return 'any';

 // ---- Constant folding: the least fixed point of the values each name may hold. ----
 const known = new Map<string, Values>();
 const unite = (a: Values, b: Values): Values => {
  if (!a || !b) return null;
  const all = new Set<Value>([...a, ...b]);
  return all.size > LIMIT ? null : all;
 };
 const combine = (a: Values, b: Values, operation: (x: Value, y: Value) => Value | typeof UNKNOWN): Values => {
  if (!a || !b) return null;
  const all = new Set<Value>();
  for (const x of a) for (const y of b) {
   const value = operation(x, y);
   if (value === UNKNOWN) return null;
   all.add(value);
   if (all.size > LIMIT) return null;
  }
  return all;
 };
 /** `+` on two known values: a string next to an unknown number, or a BigInt next to anything
  * else, has no known result. */
 const plus = (x: Value, y: Value): Value | typeof UNKNOWN => {
  if (x === SOME_NUMBER || y === SOME_NUMBER) return typeof x === 'string' || typeof y === 'string' || typeof x === 'bigint' || typeof y === 'bigint' ? UNKNOWN : SOME_NUMBER;
  if (typeof x === 'bigint' || typeof y === 'bigint') return UNKNOWN;
  return (x as string) + (y as string);
 };
 const fold = (expression: ts.Expression | 'number' | 'undefined' | null): Values => {
  if (expression === 'number') return new Set([SOME_NUMBER]);
  if (expression === 'undefined') return new Set([undefined]);
  if (!expression) return null;
  if (transparent(expression)) return fold(expression.expression);
  if (compiler.isNumericLiteral(expression)) return new Set([Number(expression.text)]);
  if (compiler.isBigIntLiteral(expression)) return new Set([SOME_NUMBER]);
  if (compiler.isStringLiteral(expression) || compiler.isNoSubstitutionTemplateLiteral(expression)) return new Set([expression.text]);
  if (expression.kind === k.TrueKeyword || expression.kind === k.FalseKeyword) return new Set([true, false]);
  if (expression.kind === k.NullKeyword) return new Set([null]);
  if (compiler.isTemplateExpression(expression)) {
   let all: Values = new Set([expression.head.text]);
   for (const span of expression.templateSpans) {
    const part = fold(span.expression);
    if (part && [...part].some(value => value === SOME_NUMBER)) return null;
    all = combine(combine(all, part, (x, y) => String(x) + String(y)), new Set([span.literal.text]), (x, y) => String(x) + String(y));
   }
   return all;
  }
  if (compiler.isConditionalExpression(expression)) return unite(fold(expression.whenTrue), fold(expression.whenFalse));
  if (compiler.isTypeOfExpression(expression)) return new Set(typeofNames);
  if (compiler.isPrefixUnaryExpression(expression)) return expression.operator === k.ExclamationToken ? new Set([true, false]) : new Set([SOME_NUMBER]);
  if (compiler.isPostfixUnaryExpression(expression)) return new Set([SOME_NUMBER]);
  if (compiler.isIdentifier(expression)) return expression.text === 'undefined' && !values.has('undefined') ? new Set([undefined]) : values.has(expression.text) ? known.get(expression.text) ?? null : null;
  if (compiler.isBinaryExpression(expression)) {
   const operator = expression.operatorToken.kind;
   if (numeric.has(operator) || numericAssignment.has(operator)) return new Set([SOME_NUMBER]);
   if (operator === k.EqualsToken || operator === k.CommaToken) return fold(expression.right);
   if (operator === k.PlusToken || operator === k.PlusEqualsToken) return combine(fold(expression.left), fold(expression.right), plus);
   if (operator === k.BarBarToken || operator === k.AmpersandAmpersandToken || operator === k.QuestionQuestionToken) return unite(fold(expression.left), fold(expression.right));
  }
  return null;
 };
 for (const name of values.keys()) known.set(name, new Set());
 for (let changed = true, round = 0; changed; round++) {
  changed = false;
  for (const [name, list] of values) {
   const before = known.get(name);
   if (before === null) continue;
   const after = round > 2 * LIMIT ? null : list.reduce<Values>((all, value) => unite(all, fold(value)), new Set());
   if (after === null || after.size !== before!.size) {known.set(name, after); changed = true;}
  }
 }
 /** The property names a key may select, or `'any'`. Reaching `constructor` reaches `Function`. */
 const namesOf = (key: ts.Expression): UnspelledNames => {
  const all = fold(key);
  if (!all) return 'any';
  const names = [...all].filter(value => value !== SOME_NUMBER).map(value => String(value));
  return names.includes('constructor') ? 'any' : names;
 };

 // ---- Escape analysis. ----
 const reached = new Set<string>();
 let any = false;
 const use = (names: UnspelledNames): void => {if (names === 'any') any = true; else for (const name of names) reached.add(name);};
 const pending: {node: ts.Expression; taint: Taint}[] = [];
 const taintedNames = new Set<string>(), returned = new Set<string>();
 /** The names a target binds now hold the value; a property or element target is a store. */
 const bind = (target: ts.Node, taint: Taint): boolean => {
  if (storesInto(target)) return true;
  const holder: Holder = compiler.isIdentifier(target) ? taint.holder : 'unknown';
  for (const name of bound(target)) {
   const key = name + '\u0000' + holder + '\u0000' + JSON.stringify(taint.names);
   if (taintedNames.has(key)) continue;
   taintedNames.add(key);
   for (const read of reads.get(name) ?? []) pending.push({node: read, taint: {names: taint.names, holder}});
  }
  return false;
 };
 /** A return (the statement, or the arrow function whose body is the value) hands the value to
  * every call of the function; any other use of the function escapes. */
 const returns = (node: ts.Node, taint: Taint): boolean => {
  let fn: ts.Node | undefined = node;
  while (fn && !compiler.isFunctionLike(fn)) fn = fn.parent;
  if (!fn) return true;
  const named = compiler.isFunctionDeclaration(fn) && fn.name ? {name: fn.name.text, member: false}
   : (compiler.isFunctionExpression(fn) || compiler.isArrowFunction(fn)) && compiler.isVariableDeclaration(fn.parent) && compiler.isIdentifier(fn.parent.name) ? {name: fn.parent.name.text, member: false}
   // A class method is called by its spelled name, unless the language calls it; an object literal's
   // methods leave with the object (a proxy handler, an iterator), so they are not followed.
   : compiler.isMethodDeclaration(fn) && compiler.isClassLike(fn.parent) && compiler.isIdentifier(fn.name) && !IMPLICIT.has(fn.name.text) ? {name: fn.name.text, member: true} : null;
  if (!named || (fn as ts.FunctionLikeDeclaration).asteriskToken) return true;
  const key = named.name + '\u0000' + named.member + '\u0000' + taint.holder + '\u0000' + JSON.stringify(taint.names);
  if (returned.has(key)) return false;
  returned.add(key);
  const uses: ts.Expression[] = named.member ? members.get(named.name) ?? [] : reads.get(named.name) ?? [];
  for (const site of uses) {
   const call = site.parent;
   if (!compiler.isCallExpression(call) || call.expression !== site) return true;
   const result = compiler.isAwaitExpression(call.parent) ? call.parent : call;
   pending.push({node: result, taint: {names: taint.names, holder: taint.holder}});
  }
  return false;
 };
 /** Follows a value up from `node`; true when it escapes. */
 const escapesFrom = (node: ts.Expression, taint: Taint): boolean => {
  const parent = node.parent;
  if (transparent(parent)) return escapesFrom(parent, taint);
  if (compiler.isConditionalExpression(parent)) return parent.condition !== node && escapesFrom(parent, taint);
  if (compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent) || compiler.isTypeOfExpression(parent) || compiler.isVoidExpression(parent) || compiler.isDeleteExpression(parent)) return false;
  if (compiler.isTemplateSpan(parent) || compiler.isExpressionStatement(parent) || compiler.isCaseClause(parent)) return false;
  if ((compiler.isIfStatement(parent) || compiler.isWhileStatement(parent) || compiler.isDoStatement(parent) || compiler.isSwitchStatement(parent)) && parent.expression === node || compiler.isForStatement(parent) && parent.condition === node) return false;
  if (compiler.isElementAccessExpression(parent) && parent.argumentExpression === node) return false;
  if (compiler.isPropertyAccessExpression(parent) || compiler.isElementAccessExpression(parent)) {
   const own = taint.holder === 'array' || taint.holder === 'object';
   // Writing into the program's own literal runs nothing; into anything else it may change a built-in.
   if (writeTarget(parent)) return !own;
   const callee = compiler.isCallExpression(parent.parent) && parent.parent.expression === parent;
   if (!callee) return escapesFrom(parent, {names: taint.names, holder: 'unknown'});
   if (compiler.isElementAccessExpression(parent) || INVOKERS.has(parent.name.text)) return true;
   // A spelled method of the value itself, or of the program's own array; its result may be the value.
   if (taint.holder === 'value' || taint.holder === 'array' && !CALLBACKS.has(parent.name.text)) return escapesFrom(parent.parent as ts.CallExpression, {names: taint.names, holder: taint.holder === 'value' ? 'value' : 'unknown'});
   return true;
  }
  if (compiler.isArrayLiteralExpression(parent) || compiler.isSpreadElement(parent) && compiler.isArrayLiteralExpression(parent.parent)) return escapesFrom(compiler.isSpreadElement(parent) ? parent.parent as ts.ArrayLiteralExpression : parent, {names: taint.names, holder: 'array'});
  if ((compiler.isPropertyAssignment(parent) && parent.initializer === node || compiler.isShorthandPropertyAssignment(parent) || compiler.isSpreadAssignment(parent)) && compiler.isObjectLiteralExpression(parent.parent)) return destructuringTarget(parent) ? false : escapesFrom(parent.parent, {names: taint.names, holder: 'object'});
  if (compiler.isBinaryExpression(parent)) {
   const operator = parent.operatorToken.kind;
   if (consuming.has(operator)) return false;
   if (operator === k.CommaToken) return parent.right === node && escapesFrom(parent, taint);
   if (operator === k.AmpersandAmpersandToken || operator === k.BarBarToken || operator === k.QuestionQuestionToken) return escapesFrom(parent, taint);
   if (assignment(operator) && parent.left === node) return false;
   if (operator === k.EqualsToken || operator === k.BarBarEqualsToken || operator === k.AmpersandAmpersandEqualsToken || operator === k.QuestionQuestionEqualsToken) return bind(parent.left, taint) || escapesFrom(parent, taint);
   return !assignment(operator);
  }
  if (compiler.isVariableDeclaration(parent) && parent.initializer === node) return bind(parent.name, taint);
  if ((compiler.isForOfStatement(parent) || compiler.isForInStatement(parent)) && parent.expression === node) return compiler.isVariableDeclarationList(parent.initializer) ? parent.initializer.declarations.some(declaration => bind(declaration.name, {names: taint.names, holder: 'unknown'})) : bind(parent.initializer, {names: taint.names, holder: 'unknown'});
  if (compiler.isReturnStatement(parent) || compiler.isArrowFunction(parent) && parent.body === node) return returns(parent, taint);
  return true;
 };
 /** The access is written: assigned, incremented or a destructuring target. */
 const writeTarget = (node: ts.Node): boolean => {
  const parent = node.parent;
  if (compiler.isBinaryExpression(parent) && parent.left === node && assignment(parent.operatorToken.kind)) return true;
  if ((compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent)) && (parent.operator === k.PlusPlusToken || parent.operator === k.MinusMinusToken)) return true;
  return destructuringTarget(parent) || (compiler.isForOfStatement(parent) || compiler.isForInStatement(parent)) && parent.initializer === node;
 };

 // A computed key in a destructuring assignment target: rare, so it counts as used.
 for (const key of assignedKeys) use(namesOf(key));
 for (const key of computedBindings) pending.push(...bound((key.parent as ts.BindingElement).name).flatMap(name => (reads.get(name) ?? []).map(read => ({node: read as ts.Expression, taint: {names: namesOf(key.expression), holder: 'unknown' as Holder}}))));
 for (const candidate of candidates) {
  if (compiler.isElementAccessExpression(candidate) && compiler.isBinaryExpression(candidate.parent) && candidate.parent.left === candidate && candidate.parent.operatorToken.kind === k.EqualsToken) continue;
  pending.push({node: candidate, taint: {names: compiler.isElementAccessExpression(candidate) ? namesOf(candidate.argumentExpression) : 'any', holder: 'value'}});
 }
 while (pending.length && !any) {
  const {node, taint} = pending.pop()!;
  if (taint.names !== 'any' && taint.names.length === 0) continue;
  if (escapesFrom(node, taint)) use(taint.names);
 }
 return any ? 'any' : [...reached].sort();
}

/** Whether `pattern` matches the source text or a name the program reaches unspelled. */
export function namesMatch(file: ts.SourceFile, reached: UnspelledNames, pattern: RegExp): boolean {
 return pattern.test(file.text) || reached === 'any' || reached.some(name => pattern.test(name) || pattern.test('.' + name));
}
