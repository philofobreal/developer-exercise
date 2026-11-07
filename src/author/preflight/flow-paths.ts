/** Facts and must-execute paths of one author reference (ADR-108, E3–E4). Author-only.
 *
 * One owner for the question the runtime-safety analyses ask: "if this statement runs, does it certainly
 * evaluate that node?" The answer is an allowlist of transparent constructs, joined over both branches of
 * an `if/else` and the first pass of a loop that certainly runs once; anything unknown is conditional.
 * A statement lets the flow continue to the next one only when it has no way out (`return`, `throw`,
 * `break`, `continue` outside nested functions): an early exit on some path makes what follows uncertain.
 * Symbols come from the compiler without a standard library, so this runs on Pages too. Every walk spends
 * one budget; once spent, the analyses stop and report `budget-exceeded`.
 */
import type ts from 'typescript';

export type Block = ts.Block | ts.SourceFile;
export interface ReferenceFacts {
 readonly compiler: typeof ts;
 readonly file: ts.SourceFile;
 readonly checker: ts.TypeChecker;
 lineOf(node: ts.Node): number;
 /** Counts one step; true once the budget is spent. */
 spend(): boolean;
 spent(): boolean;
 /** Identifiers that evaluate a value binding (reads and writes), by symbol. */
 readonly references: ReadonlyMap<ts.Symbol, readonly ts.Identifier[]>;
 isValueReference(id: ts.Identifier): boolean;
 symbolOf(id: ts.Identifier): ts.Symbol | undefined;
 /** The identifier is assigned (`=`, compound, `++`/`--`, a destructuring or `for…in/of` target). */
 isWrite(id: ts.Identifier): boolean;
 /** The block (source file or block) a statement belongs to. */
 blockOf(statement: ts.Node): Block | undefined;
 /** The unconditional abrupt statements before `statement` in `block` make it unreachable. */
 reachable(statement: ts.Node, block: Block): boolean;
 /** The statement can leave its enclosing flow on some path. */
 mayExit(statement: ts.Statement): boolean;
 /** Whether evaluating `parent` certainly evaluates `child`. */
 transparent(child: ts.Node, parent: ts.Node): boolean;
 /** Whether `node` is evaluated whenever `root` is (every step up to `root` is transparent). */
 transparentTo(node: ts.Node, root: ts.Node): boolean;
 /** The statement of `block` that certainly evaluates `node` when it runs, or undefined. */
 statementIn(node: ts.Node, block: Block): ts.Statement | undefined;
 /** Nodes satisfying `wanted` that a run of `statement` certainly evaluates (one per path), or undefined. */
 mustEvaluate(statement: ts.Statement, wanted: (node: ts.Node) => boolean): ts.Node[] | undefined;
}

export function referenceFacts(compiler: typeof ts, source: string, language: 'javascript' | 'typescript', budget = 400_000): ReferenceFacts {
 const S = compiler.SyntaxKind;
 const fileName = 'reference.' + (language === 'typescript' ? 'ts' : 'js');
 const file = compiler.createSourceFile(fileName, source, compiler.ScriptTarget.ES2022, true, language === 'typescript' ? compiler.ScriptKind.TS : compiler.ScriptKind.JS);
 const host: ts.CompilerHost = {
  getSourceFile: name => name === fileName ? file : undefined, getDefaultLibFileName: () => 'lib.d.ts', getDefaultLibLocation: () => '', writeFile: () => undefined,
  getCurrentDirectory: () => '', getDirectories: () => [], getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
  fileExists: name => name === fileName, readFile: () => undefined
 };
 const checker = compiler.createProgram([fileName], {noLib: true, noResolve: true, allowJs: true, types: [], target: compiler.ScriptTarget.ES2022}, host).getTypeChecker();
 let work = 0;
 const spend = (): boolean => ++work > budget;
 const lineOf = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

 const isTypePosition = (node: ts.Node): boolean => {for (let n: ts.Node | undefined = node.parent; n && n !== file; n = n.parent) {if (compiler.isTypeNode(n) && !compiler.isExpressionWithTypeArguments(n)) return true; if (compiler.isStatement(n)) return false;} return false;};
 const isValueReference = (id: ts.Identifier): boolean => {
  const p = id.parent;
  if (compiler.isPropertyAccessExpression(p) && p.name === id) return false;
  if ((compiler.isPropertyAssignment(p) || compiler.isMethodDeclaration(p) || compiler.isPropertyDeclaration(p) || compiler.isGetAccessor(p) || compiler.isSetAccessor(p) || compiler.isEnumMember(p) || compiler.isPropertySignature(p) || compiler.isMethodSignature(p)) && p.name === id) return false;
  if ((compiler.isVariableDeclaration(p) || compiler.isFunctionDeclaration(p) || compiler.isClassDeclaration(p) || compiler.isClassExpression(p) || compiler.isFunctionExpression(p) || compiler.isParameter(p) || compiler.isBindingElement(p) || compiler.isInterfaceDeclaration(p) || compiler.isTypeAliasDeclaration(p) || compiler.isEnumDeclaration(p) || compiler.isModuleDeclaration(p)) && (p as ts.NamedDeclaration).name === id) return false;
  if (compiler.isLabeledStatement(p) || compiler.isBreakOrContinueStatement(p) || compiler.isImportSpecifier(p) || compiler.isImportClause(p) || compiler.isNamespaceImport(p) || compiler.isExportSpecifier(p) || compiler.isQualifiedName(p) || compiler.isMetaProperty(p)) return false;
  return !isTypePosition(id);
 };
 const symbolOf = (id: ts.Identifier): ts.Symbol | undefined => compiler.isShorthandPropertyAssignment(id.parent) && id.parent.name === id ? checker.getShorthandAssignmentValueSymbol(id.parent) : checker.getSymbolAtLocation(id);
 const references = new Map<ts.Symbol, ts.Identifier[]>();
 const collect = (node: ts.Node): void => {
  if (compiler.isIdentifier(node) && isValueReference(node)) {const symbol = symbolOf(node); if (symbol) {const list = references.get(symbol) ?? []; list.push(node); references.set(symbol, list);}}
  compiler.forEachChild(node, collect);
 };
 collect(file);
 /** Inside an assignment target (`[a, b] = …`, `({a} = …)`, `for (a of …)`)? */
 const inTarget = (node: ts.Node): boolean => {
  let child = node;
  for (let p = node.parent; p; child = p, p = p.parent) {
   if (compiler.isBinaryExpression(p)) return p.left === child && p.operatorToken.kind >= S.FirstAssignment && p.operatorToken.kind <= S.LastAssignment;
   if (compiler.isForInStatement(p) || compiler.isForOfStatement(p)) return p.initializer === child;
   if (compiler.isPrefixUnaryExpression(p) || compiler.isPostfixUnaryExpression(p)) return p.operator === S.PlusPlusToken || p.operator === S.MinusMinusToken;
   if (!(compiler.isParenthesizedExpression(p) || compiler.isArrayLiteralExpression(p) || compiler.isObjectLiteralExpression(p) || compiler.isPropertyAssignment(p) || compiler.isShorthandPropertyAssignment(p) || compiler.isSpreadElement(p) || compiler.isSpreadAssignment(p) || compiler.isNonNullExpression(p) || compiler.isAsExpression(p))) return false;
   if (compiler.isPropertyAssignment(p) && p.name === child) return false;
  }
  return false;
 };
 const isWrite = (id: ts.Identifier): boolean => inTarget(id);

 const abrupt = (statement: ts.Node): boolean => compiler.isReturnStatement(statement) || compiler.isThrowStatement(statement) || compiler.isBreakStatement(statement) || compiler.isContinueStatement(statement);
 const blockOf = (statement: ts.Node): Block | undefined => compiler.isSourceFile(statement.parent) || compiler.isBlock(statement.parent) ? statement.parent : undefined;
 const reachable = (statement: ts.Node, block: Block): boolean => {for (const sibling of block.statements) {if (sibling === statement) return true; if (abrupt(sibling)) return false;} return false;};
 const exits = new Map<ts.Node, boolean>();
 const mayExit = (statement: ts.Statement): boolean => {
  const known = exits.get(statement);
  if (known !== undefined) return known;
  let found = false;
  const visit = (node: ts.Node): void => {if (found) return; if (spend()) {found = true; return;} if (abrupt(node)) {found = true; return;} if (compiler.isFunctionLike(node) || compiler.isClassLike(node)) return; compiler.forEachChild(node, visit);};
  visit(statement);
  exits.set(statement, found);
  return found;
 };
 /** No earlier sibling of `statement` in a nested block may leave the flow. */
 const clearBefore = (statement: ts.Node, block: ts.Block): boolean => {for (const sibling of block.statements) {if (sibling === statement) return true; if (mayExit(sibling)) return false;} return false;};
 const SHORT_CIRCUIT = new Set<ts.SyntaxKind>([S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken, S.AmpersandAmpersandEqualsToken, S.BarBarEqualsToken, S.QuestionQuestionEqualsToken]);
 const optional = (node: ts.Node): boolean => (node.flags & compiler.NodeFlags.OptionalChain) !== 0;
 const transparent = (child: ts.Node, parent: ts.Node): boolean => {
  switch (parent.kind) {
   case S.ExpressionStatement: case S.ReturnStatement: case S.ThrowStatement: case S.ParenthesizedExpression: case S.ArrayLiteralExpression:
   case S.ObjectLiteralExpression: case S.ShorthandPropertyAssignment: case S.SpreadElement: case S.SpreadAssignment: case S.TemplateExpression:
   case S.TemplateSpan: case S.TaggedTemplateExpression: case S.PrefixUnaryExpression: case S.PostfixUnaryExpression: case S.TypeOfExpression:
   case S.VoidExpression: case S.DeleteExpression: case S.AwaitExpression: case S.AsExpression: case S.SatisfiesExpression: case S.NonNullExpression:
   case S.TypeAssertionExpression: case S.VariableStatement: case S.VariableDeclarationList: case S.LabeledStatement: case S.NewExpression:
   case S.ExportAssignment: case S.HeritageClause: case S.ExpressionWithTypeArguments:
    return true;
   case S.CallExpression: case S.PropertyAccessExpression: case S.ElementAccessExpression:
    return !optional(parent) || child === (parent as ts.CallExpression | ts.PropertyAccessExpression | ts.ElementAccessExpression).expression;
   case S.PropertyAssignment: return child === (parent as ts.PropertyAssignment).initializer;
   case S.VariableDeclaration: return child === (parent as ts.VariableDeclaration).initializer;
   case S.BinaryExpression: return !SHORT_CIRCUIT.has((parent as ts.BinaryExpression).operatorToken.kind) || child === (parent as ts.BinaryExpression).left;
   case S.ConditionalExpression: return child === (parent as ts.ConditionalExpression).condition;
   case S.IfStatement: return child === (parent as ts.IfStatement).expression;
   case S.SwitchStatement: return child === (parent as ts.SwitchStatement).expression;
   case S.WhileStatement: return child === (parent as ts.WhileStatement).expression;
   case S.ForOfStatement: case S.ForInStatement: return child === (parent as ts.ForOfStatement).expression;
   case S.ForStatement: return child === (parent as ts.ForStatement).initializer;
   case S.ClassDeclaration: case S.ClassExpression: return compiler.isHeritageClause(child);
   case S.Block: return !compiler.isFunctionLike(parent.parent) && clearBefore(child, parent as ts.Block);
   default: return false;
  }
 };
 const transparentTo = (node: ts.Node, root: ts.Node): boolean => {
  for (let child = node, parent = node.parent; child !== root; child = parent, parent = parent.parent) if (!parent || spend() || !transparent(child, parent)) return false;
  return true;
 };
 const statementIn = (node: ts.Node, block: Block): ts.Statement | undefined => {
  let child = node;
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
   if (spend()) return undefined;
   if (parent === block) return reachable(child, block) ? child as ts.Statement : undefined;
   if (!transparent(child, parent)) return undefined;
  }
  return undefined;
 };
 const literallyTrue = (expression: ts.Expression | undefined): boolean => !expression || expression.kind === S.TrueKeyword;
 const mustEvaluate = (statement: ts.Statement, wanted: (node: ts.Node) => boolean): ts.Node[] | undefined => {
  let direct: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
   if (direct || spend()) return;
   if (wanted(node) && transparentTo(node, statement)) {direct = node; return;}
   if (compiler.isFunctionLike(node) && node !== statement) return;
   compiler.forEachChild(node, visit);
  };
  visit(statement);
  if (direct) return [direct];
  if (spend()) return undefined;
  if (compiler.isIfStatement(statement) && statement.elseStatement) {
   const then = mustEvaluate(statement.thenStatement, wanted), otherwise = then && mustEvaluate(statement.elseStatement, wanted);
   return then && otherwise ? [...then, ...otherwise] : undefined;
  }
  if (compiler.isBlock(statement)) {
   for (const inner of statement.statements) {const hit = mustEvaluate(inner, wanted); if (hit) return hit; if (mayExit(inner)) return undefined;}
   return undefined;
  }
  // A loop body that certainly runs once: `do … while`, and `while (true)` / `for (…;;…)`.
  if (compiler.isDoStatement(statement)) return mustEvaluate(statement.statement, wanted);
  if (compiler.isWhileStatement(statement) && literallyTrue(statement.expression)) return mustEvaluate(statement.statement, wanted);
  if (compiler.isForStatement(statement) && literallyTrue(statement.condition)) return mustEvaluate(statement.statement, wanted);
  if (compiler.isLabeledStatement(statement)) return mustEvaluate(statement.statement, wanted);
  return undefined;
 };
 return {compiler, file, checker, lineOf, spend, spent: () => work > budget, references, isValueReference, symbolOf, isWrite, blockOf, reachable, mayExit, transparent, transparentTo, statementIn, mustEvaluate};
}
