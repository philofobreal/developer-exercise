/** Which loops over a list's own objects are shown to end (ADR-046, ADR-064). Author-only: it reads
 * the reference source and never runs for learner submissions.
 *
 * The object effect analysis (object-footprints.ts) orders a loop not shown to end like a possible
 * throw (`mayHang`). This module hides the termination arguments: the shapes it recognises, the
 * field-type argument behind a monotone `while`, and how calls are followed. The analysis gives
 * it the loop and what it knows about the receiver; the answer is one boolean.
 */
import type ts from 'typescript';
type Compiler = typeof ts;

/** What the effect analysis knows about the objects of the list: the methods of every analysable
 * class by name, and the one own object an identifier stands for. `receiver` returns undefined when
 * the identifier is not exactly one own object; a plain object or array literal has no members. */
export interface LoopObjects {
 methods: ReadonlyMap<string, readonly ts.MethodDeclaration[]>;
 receiver(name: ts.Identifier): {methods: ReadonlyMap<string, ts.MethodDeclaration>; accessors: ReadonlySet<string>; parameterFields: readonly string[]} | undefined;
}

/** Whether the loop is shown to end: a counting `for` (ADR-046) or a monotone `while` (ADR-064). */
export function loopEnds(statement: ts.IterationStatement, file: ts.SourceFile, compiler: Compiler, objects: LoopObjects): boolean {
 return counted(statement, compiler) || monotone(statement, file, compiler, objects);
}

/** v36 (ADR-070): the loop's body runs at most once. Its last statement is a `break` that leaves
 * this loop (unlabelled, or naming the loop's own label), and no `continue` in the body returns to
 * it: an unlabelled one outside nested loops, or one naming the label (conservatively at any depth). */
export function atMostOnce(statement: ts.IterationStatement, compiler: Compiler): boolean {
 const label = compiler.isLabeledStatement(statement.parent) ? statement.parent.label.text : undefined, body = statement.statement;
 const last = compiler.isBlock(body) ? body.statements.at(-1) : body;
 if (!last || !compiler.isBreakStatement(last) || last.label && last.label.text !== label) return false;
 let again = false;
 const visit = (node: ts.Node, nested: boolean): void => {
  if (again || compiler.isFunctionLike(node) || compiler.isClassLike(node)) return;
  if (compiler.isContinueStatement(node) && (node.label ? node.label.text === label : !nested)) again = true;
  compiler.forEachChild(node, child => visit(child, nested || compiler.isIterationStatement(child, false)));
 };
 visit(body, false);
 return !again;
}

/** Identifiers assigned anywhere in `root`, nested functions included (they may run in it). */
export function assignedNames(root: ts.Node, compiler: Compiler): Set<string> {
 const S = compiler.SyntaxKind, names = new Set<string>();
 const visit = (node: ts.Node): void => {
  if (compiler.isBinaryExpression(node) && node.operatorToken.kind >= S.FirstAssignment && node.operatorToken.kind <= S.LastAssignment && compiler.isIdentifier(unwrap(node.left, compiler))) names.add((unwrap(node.left, compiler) as ts.Identifier).text);
  if ((compiler.isPrefixUnaryExpression(node) || compiler.isPostfixUnaryExpression(node)) && (node.operator === S.PlusPlusToken || node.operator === S.MinusMinusToken) && compiler.isIdentifier(node.operand)) names.add(node.operand.text);
  compiler.forEachChild(node, visit);
 };
 visit(root);
 return names;
}

const unwrap = (expr: ts.Expression, compiler: Compiler): ts.Expression => compiler.isParenthesizedExpression(expr) || compiler.isAsExpression(expr) || compiler.isSatisfiesExpression(expr) || compiler.isNonNullExpression(expr) || compiler.isTypeAssertionExpression(expr) ? unwrap(expr.expression, compiler) : expr;
const nameOf = (name: ts.Node, compiler: Compiler): string | undefined => compiler.isIdentifier(name) || compiler.isPrivateIdentifier(name) || compiler.isStringLiteral(name) ? name.text : undefined;

/** ADR-046: `for (let i = <number>; i < <number>; i++)` (or `<=`, or the descending `>`, `>=`
 * with `i--`) whose body does not assign `i`: it ends. */
function counted(statement: ts.IterationStatement, compiler: Compiler): boolean {
 const S = compiler.SyntaxKind, at = (expr: ts.Expression): ts.Expression => unwrap(expr, compiler);
 if (!compiler.isForStatement(statement)) return false;
 const head = statement.initializer, test = statement.condition && at(statement.condition), step = statement.incrementor && at(statement.incrementor);
 if (!head || !compiler.isVariableDeclarationList(head) || head.declarations.length !== 1 || !test || !step || !compiler.isBinaryExpression(test)) return false;
 const declaration = head.declarations[0]!, name = compiler.isIdentifier(declaration.name) ? declaration.name.text : undefined;
 const numeric = (expr: ts.Expression | undefined): boolean => !!expr && (compiler.isNumericLiteral(at(expr)) || compiler.isPrefixUnaryExpression(at(expr)) && (at(expr) as ts.PrefixUnaryExpression).operator === S.MinusToken && compiler.isNumericLiteral((at(expr) as ts.PrefixUnaryExpression).operand));
 if (!name || !numeric(declaration.initializer) || !compiler.isIdentifier(at(test.left)) || (at(test.left) as ts.Identifier).text !== name || !numeric(test.right)) return false;
 const operator = test.operatorToken.kind, up = operator === S.LessThanToken || operator === S.LessThanEqualsToken, down = operator === S.GreaterThanToken || operator === S.GreaterThanEqualsToken;
 const stepOperator = (compiler.isPrefixUnaryExpression(step) || compiler.isPostfixUnaryExpression(step)) && compiler.isIdentifier(step.operand) && step.operand.text === name ? step.operator : undefined;
 return (up && stepOperator === S.PlusPlusToken || down && stepOperator === S.MinusMinusToken) && !assignedNames(statement.statement, compiler).has(name);
}

/** ADR-064: `while (x.f < K)` (`<=`, or `K > x.f`, `K >= x.f`; also do…while) over an own object x
 * ends when the field only grows by positive steps and every iteration grows it:
 *  - in the whole file every write of a property named f keeps it a number (a numeric literal, a
 *    positive step `.f = .f + c`, `.f += c`, `.f++`, or arithmetic other than `+`), every
 *    declaration of f is a numeric literal or none, no parameter property, getter or setter is named
 *    f and nothing is written through a computed key, so f is always a number (or undefined, when
 *    the test is false at once);
 *  - inside the loop and every method it may call (by name, transitively) every write of f is a
 *    positive step;
 *  - the loop body, before any statement that may leave the iteration early (`continue`, `break`,
 *    `return`, `throw`, or any compound statement), increments x.f directly or calls a method of
 *    x's class whose leading plain statements increment this.f.
 * K is a numeric literal. A thrown exception ends the loop too, so only a cycle would hang. */
function monotone(statement: ts.IterationStatement, file: ts.SourceFile, compiler: Compiler, objects: LoopObjects): boolean {
 const S = compiler.SyntaxKind, at = (expr: ts.Expression): ts.Expression => unwrap(expr, compiler), named = (node: ts.Node): string | undefined => nameOf(node, compiler);
 if (!compiler.isWhileStatement(statement) && !compiler.isDoStatement(statement)) return false;
 const test = at(statement.expression);
 if (!compiler.isBinaryExpression(test)) return false;
 const operator = test.operatorToken.kind, numeric = (expr: ts.Expression): boolean => compiler.isNumericLiteral(at(expr));
 const bound = operator === S.LessThanToken || operator === S.LessThanEqualsToken ? {access: at(test.left), limit: test.right} : operator === S.GreaterThanToken || operator === S.GreaterThanEqualsToken ? {access: at(test.right), limit: test.left} : undefined;
 if (!bound || !numeric(bound.limit) || !compiler.isPropertyAccessExpression(bound.access) || bound.access.questionDotToken || !compiler.isIdentifier(bound.access.expression)) return false;
 const access = bound.access as ts.PropertyAccessExpression, field = named(access.name), receiver = (access.expression as ts.Identifier).text;
 if (field === undefined) return false;
 const own = objects.receiver(access.expression as ts.Identifier);
 if (!own || own.accessors.has(field) || own.parameterFields.includes(field)) return false;
 // A positive step of `target.field`: `t.f = t.f + c`, `t.f = c + t.f`, `t.f += c`, `t.f++`, `++t.f`.
 const step = (node: ts.Node, target: (expr: ts.Expression) => boolean): boolean => {
  const positive = (expr: ts.Expression): boolean => numeric(expr) && Number((at(expr) as ts.NumericLiteral).text) > 0;
  const mine = (expr: ts.Expression): boolean => compiler.isPropertyAccessExpression(at(expr)) && named((at(expr) as ts.PropertyAccessExpression).name) === field && target((at(expr) as ts.PropertyAccessExpression).expression);
  if ((compiler.isPrefixUnaryExpression(node) || compiler.isPostfixUnaryExpression(node)) && node.operator === S.PlusPlusToken) return mine(node.operand);
  if (!compiler.isBinaryExpression(node) || !mine(node.left)) return false;
  if (node.operatorToken.kind === S.PlusEqualsToken) return positive(node.right);
  if (node.operatorToken.kind !== S.EqualsToken) return false;
  const right = at(node.right);
  return compiler.isBinaryExpression(right) && right.operatorToken.kind === S.PlusToken && (mine(right.left) && positive(right.right) || positive(right.left) && mine(right.right));
 };
 // Outside the loop a write may also reset or shrink the field, as long as it stays a number: a
 // numeric literal, `--`, `-=`, `*=`, `/=`, `%=`, `**=`, or `=` with such an arithmetic right side
 // (a BigInt there would make the loop's step throw, which ends it).
 const arithmetic = new Set([S.MinusToken, S.AsteriskToken, S.SlashToken, S.PercentToken, S.AsteriskAsteriskToken]);
 const keepsNumber = (node: ts.Node): boolean => {
  if (compiler.isPrefixUnaryExpression(node) || compiler.isPostfixUnaryExpression(node)) return true;
  if (!compiler.isBinaryExpression(node)) return false;
  const kind = node.operatorToken.kind;
  if (kind === S.MinusEqualsToken || kind === S.AsteriskEqualsToken || kind === S.SlashEqualsToken || kind === S.PercentEqualsToken || kind === S.AsteriskAsteriskEqualsToken) return true;
  const right = at(node.right);
  return kind === S.EqualsToken && (numeric(right) || compiler.isPrefixUnaryExpression(right) && right.operator === S.MinusToken && numeric(right.operand) || compiler.isBinaryExpression(right) && arithmetic.has(right.operatorToken.kind));
 };
 // Every write of a property named `field` in the file keeps it a number; inside the loop it only grows.
 let numericField = true;
 const writes = (node: ts.Node, insideLoop: boolean): void => {
  if (!numericField) return;
  if ((compiler.isPropertyDeclaration(node) || compiler.isPropertyAssignment(node)) && named(node.name) === field && node.initializer && !numeric(node.initializer)) numericField = false;
  if (compiler.isParameter(node) && compiler.isIdentifier(node.name) && node.name.text === field && (compiler.getModifiers(node) ?? []).length) numericField = false;
  if (compiler.isShorthandPropertyAssignment(node) && node.name.text === field) numericField = false;
  const target = compiler.isBinaryExpression(node) && node.operatorToken.kind >= S.FirstAssignment && node.operatorToken.kind <= S.LastAssignment ? at(node.left) : (compiler.isPrefixUnaryExpression(node) || compiler.isPostfixUnaryExpression(node)) && (node.operator === S.PlusPlusToken || node.operator === S.MinusMinusToken) ? at(node.operand) : undefined;
  if (target && (compiler.isElementAccessExpression(target) || compiler.isObjectLiteralExpression(target) || compiler.isArrayLiteralExpression(target))) numericField = false;
  if (target && compiler.isPropertyAccessExpression(target) && named(target.name) === field && !step(node, () => true) && (insideLoop || !keepsNumber(node))) numericField = false;
  compiler.forEachChild(node, child => writes(child, insideLoop));
 };
 writes(file, false);
 // Inside the loop, and inside every method it may call (any class, by name, transitively), no reset either.
 const called = new Set<string>(), pending: ts.Node[] = [statement.statement];
 while (pending.length) {
  const root = pending.pop()!;
  writes(root, true);
  const visit = (node: ts.Node): void => {
   if (compiler.isCallExpression(node) && compiler.isPropertyAccessExpression(at(node.expression))) {
    const name = named((at(node.expression) as ts.PropertyAccessExpression).name);
    if (name !== undefined && !called.has(name)) {called.add(name); for (const method of objects.methods.get(name) ?? []) if (method.body) pending.push(method.body);}
   }
   compiler.forEachChild(node, visit);
  };
  visit(root);
 }
 if (!numericField) return false;
 const plain = (item: ts.Statement): boolean => compiler.isExpressionStatement(item) || compiler.isVariableStatement(item);
 const grows = (items: readonly ts.Statement[], target: (expr: ts.Expression) => boolean, calls: boolean): boolean => {
  for (const item of items) {
   if (!plain(item)) return false;
   const expr = compiler.isExpressionStatement(item) ? at(item.expression) : undefined;
   if (expr && step(expr, target)) return true;
   if (calls && expr && compiler.isCallExpression(expr) && !expr.questionDotToken && compiler.isPropertyAccessExpression(at(expr.expression)) && target((at(expr.expression) as ts.PropertyAccessExpression).expression)) {
    const method = own.methods.get(named((at(expr.expression) as ts.PropertyAccessExpression).name) ?? '');
    if (method?.body && grows(method.body.statements, node => at(node).kind === S.ThisKeyword, false)) return true;
   }
  }
  return false;
 };
 const body = compiler.isBlock(statement.statement) ? statement.statement.statements : [statement.statement];
 return grows(body, node => compiler.isIdentifier(at(node)) && (at(node) as ts.Identifier).text === receiver, true);
}
