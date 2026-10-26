/** Author-only, scope-compositional statement ordering from conservative effect
 * summaries (ADR-008). It never runs for learner submissions.
 *
 * Each statement list (source file, block, module block) is split into units:
 *  - pure: evaluation has no observable effect and cannot throw; every binding
 *    it reads is initialised whenever it runs (same-context declaration with a
 *    protected edge, parameter, catch/loop binding, hoisted function, or a var);
 *    it may initialise its own binding;
 *  - position-free: no evaluation event at its position (hoisted function
 *    declaration in a function/script list, erased TypeScript declaration);
 *  - barrier: everything else (calls, property access, writes, loops, control
 *    transfer, unknown syntax, multi-row shapes without block delimiters);
 *  - opaque: comment and other non-statement rows.
 * For units i < j an edge i.last → j.first exists iff one is opaque, or neither
 * is position-free and at least one is a barrier, or (ADR-010) both create
 * global-object properties in a classic script (function and var declarations,
 * and the TypeScript enums, namespaces and import aliases emitted as var):
 * Object.keys(globalThis) reflects their creation order. The specification creates function bindings
 * before var bindings, V8 interleaves them in source order, so all such units
 * keep their mutual source order. Every evaluation-time read of
 * a binding whose initialisation has a TDZ/value position in the same function
 * context adds a protected edge from that declaration row. Pure units thus
 * commute; a barrier keeps its position relative to every ordered sibling.
 */
import type ts from 'typescript';
type Compiler = typeof ts;

export type UnitKind = 'pure' | 'local-write' | 'position-free' | 'barrier' | 'opaque';
/** Evidence for one unit: why it may move, or why it may not. */
export interface StatementUnit {first: number; last: number; kind: UnitKind; reason: string;}
export interface OrderingEntry {row: number; after: number[];}
export interface StatementOrdering {entries: OrderingEntry[]; protectedInputs: Map<number, Set<number>>; units: StatementUnit[];}
/** `readSet`/`writeSet`: bindings a pure or local-write unit reads or writes when it runs
 * (may-sets, unions over branches); two such units conflict on RAW, WAR or WAW. */
interface Summary extends StatementUnit {reads: Set<number>; start: number; global?: boolean; readSet: Set<ts.Symbol>; writeSet: Set<ts.Symbol>;}
interface Binding {row: number | null; primitiveInitializer: ts.Expression | null;}

/** Separate, browser-safe checker host: only the reference file is visible. */
export function bindingChecker(file: ts.SourceFile, compiler: Compiler): ts.TypeChecker {
 const options = {allowJs: true, noLib: true, noResolve: true, target: compiler.ScriptTarget.Latest};
 const host: ts.CompilerHost = {getSourceFile: name => name === file.fileName ? file : undefined, getDefaultLibFileName: () => '', writeFile: () => undefined, getCurrentDirectory: () => '', getDirectories: () => [], getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n', fileExists: name => name === file.fileName, readFile: name => name === file.fileName ? file.text : undefined};
 return compiler.createProgram([file.fileName], options, host).getTypeChecker();
}

/** How the reference's TypeScript is emitted (ADR-013). `verbatim` (the default, also
 * for an unknown build) keeps every import that is not `import type`, as under
 * verbatimModuleSyntax; `elide-unused` is TypeScript's default emit, which drops an
 * import none of whose bindings is used as a value. */
export type ImportEmit = 'verbatim' | 'elide-unused';
export interface OrderingOptions {imports?: ImportEmit;}

export function statementOrdering(file: ts.SourceFile, compiler: Compiler, options: OrderingOptions = {}): StatementOrdering {
 const empty: StatementOrdering = {entries: [], protectedInputs: new Map(), units: []};
 let dynamic = false;
 const scan = (node: ts.Node): void => {
  // with and direct eval change name resolution at run time: analyse nothing.
  if (compiler.isWithStatement(node) || compiler.isCallExpression(node) && compiler.isIdentifier(node.expression) && node.expression.text === 'eval') dynamic = true;
  compiler.forEachChild(node, scan);
 };
 scan(file);
 if (dynamic) return empty;
 const checker = bindingChecker(file, compiler), physical = file.text.split('\n');
 const entries = new Map<number, Set<number>>(), protectedInputs = new Map<number, Set<number>>(), units: StatementUnit[] = [];
 const line = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
 const end = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.end - 1).line;
 const S = compiler.SyntaxKind;
 const functionLike = (node: ts.Node): boolean => compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isArrowFunction(node) || compiler.isMethodDeclaration(node) || compiler.isConstructorDeclaration(node) || compiler.isGetAccessorDeclaration(node) || compiler.isSetAccessorDeclaration(node);
 const context = (node: ts.Node): ts.Node => {
  let current: ts.Node | undefined = node.parent;
  while (current && !compiler.isSourceFile(current) && !functionLike(current) && !compiler.isClassStaticBlockDeclaration(current) && !compiler.isPropertyDeclaration(current)) current = current.parent;
  return current ?? file;
 };
 const within = (outer: ts.Node, inner: ts.Node): boolean => inner.getStart(file) >= outer.getStart(file) && inner.end <= outer.end;
 const modifiers = (node: ts.Node): ts.SyntaxKind[] => (compiler.canHaveModifiers(node) ? compiler.getModifiers(node) ?? [] : []).map(modifier => modifier.kind);
 const decorated = (node: ts.Node): boolean => compiler.canHaveDecorators(node) && !!compiler.getDecorators(node)?.length;
 const unwrap = (expr: ts.Expression): ts.Expression => compiler.isParenthesizedExpression(expr) || compiler.isAsExpression(expr) || compiler.isSatisfiesExpression(expr) || compiler.isNonNullExpression(expr) || compiler.isTypeAssertionExpression(expr) ? unwrap(expr.expression) : expr;
 const unique = (symbol: ts.Symbol | undefined): ts.Declaration | undefined => symbol?.declarations?.length === 1 && symbol.declarations[0]!.getSourceFile() === file ? symbol.declarations[0] : undefined;
 // NodeFlags.AwaitUsing is Const|Using, so declaration kinds must be compared exactly.
 const disposable = (list: ts.VariableDeclarationList): boolean => [compiler.NodeFlags.Using, compiler.NodeFlags.AwaitUsing].includes(list.flags & compiler.NodeFlags.BlockScoped);
 const hoistingList = (node: ts.Node): boolean => compiler.isSourceFile(node) || compiler.isModuleBlock(node) || compiler.isBlock(node) && functionLike(node.parent);
 /** Row equality guarantees that no sibling code shares the unit's rows. */
 const ownsRows = (node: ts.Node, open?: ts.Node, close?: ts.Node): boolean => {
  const first = line(node), last = end(node);
  if (first === last) return physical[first]?.trim() === node.getText(file).trim();
  if (!open || !close || line(open) !== first || line(close) !== last) return false;
  return physical[first]?.trim() === file.text.slice(node.getStart(file), open.end).trim() && physical[last]?.trim() === file.text.slice(close.getStart(file), node.end).trim();
 };
 const braces = (node: ts.Node | undefined): [ts.Node, ts.Node] | [] => {
  if (!node) return [];
  const children = node.getChildren(file), open = children.find(child => child.kind === S.OpenBraceToken), close = children.filter(child => child.kind === S.CloseBraceToken).at(-1);
  return open && close ? [open, close] : [];
 };

 /** Local write sets: bindings that are assignment, update, destructuring or for-in/of targets anywhere. */
 const written = new Set<ts.Symbol>();
 const writeTarget = (node: ts.Node): boolean => {
  let current = node;
  for (let parent = current.parent; parent; current = parent, parent = parent.parent) {
   // Climb through wrappers and destructuring patterns to the outermost target expression.
   if (!(compiler.isParenthesizedExpression(parent) || compiler.isNonNullExpression(parent) || compiler.isAsExpression(parent) || compiler.isSatisfiesExpression(parent) || compiler.isTypeAssertionExpression(parent) || compiler.isArrayLiteralExpression(parent) || compiler.isObjectLiteralExpression(parent) || compiler.isSpreadElement(parent) || compiler.isSpreadAssignment(parent) || compiler.isShorthandPropertyAssignment(parent) || compiler.isPropertyAssignment(parent) && parent.initializer === current)) break;
  }
  const parent = current.parent;
  if (!parent) return false;
  if (compiler.isBinaryExpression(parent)) return parent.left === current && parent.operatorToken.kind >= S.FirstAssignment && parent.operatorToken.kind <= S.LastAssignment;
  if (compiler.isForInStatement(parent) || compiler.isForOfStatement(parent)) return parent.initializer === current;
  return (compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent)) && (parent.operator === S.PlusPlusToken || parent.operator === S.MinusMinusToken);
 };
 const collectWrites = (node: ts.Node): void => {
  if (compiler.isIdentifier(node) && writeTarget(node)) {
   const symbol = compiler.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
   if (symbol) written.add(symbol);
  }
  compiler.forEachChild(node, collectWrites);
 };
 collectWrites(file);

 /** Resolves an evaluation-time identifier read to a binding that is initialised whenever the read runs. */
 function binding(identifier: ts.Identifier, symbol: ts.Symbol | undefined): Binding | null {
  const declaration = unique(symbol);
  if (!declaration) return null;
  const sameContext = (statement: ts.Node): number | null => context(statement) === context(identifier) ? line(statement) : null;
  // A switch shares one scope between clauses: a jump can skip the declaration.
  const caseClause = (statement: ts.Node): boolean => compiler.isCaseClause(statement.parent) || compiler.isDefaultClause(statement.parent);
  if (compiler.isVariableDeclaration(declaration) && compiler.isIdentifier(declaration.name)) {
   const list = declaration.parent;
   if (compiler.isCatchClause(list)) return within(list.block, identifier) ? {row: null, primitiveInitializer: null} : null;
   if (!compiler.isVariableDeclarationList(list) || disposable(list)) return null;
   const owner = list.parent;
   if ((compiler.isForStatement(owner) || compiler.isForOfStatement(owner) || compiler.isForInStatement(owner)) && owner.initializer === list) return within(owner.statement, identifier) ? {row: null, primitiveInitializer: null} : null;
   // The read must follow the whole declaration: `const a = a` throws.
   if (!compiler.isVariableStatement(owner) || modifiers(owner).length || list.declarations.length !== 1 || declaration.end > identifier.getStart(file) || caseClause(owner)) return null;
   const lexical = (list.flags & compiler.NodeFlags.BlockScoped) !== 0, row = sameContext(owner);
   // From another function context a let/const may still be in its TDZ when the read runs.
   if (lexical && row === null) return null;
   // Never-written let/var behave like const; script-level ones stay writable through the global scope.
   const constant = (list.flags & compiler.NodeFlags.BlockScoped) === compiler.NodeFlags.Const || !!symbol && !written.has(symbol) && context(owner) !== file;
   return {row, primitiveInitializer: constant && declaration.initializer ? declaration.initializer : null};
  }
  if (compiler.isParameter(declaration) && compiler.isIdentifier(declaration.name)) {
   const body = (declaration.parent as ts.SignatureDeclaration & {body?: ts.Node}).body;
   return body && within(body, identifier) ? {row: null, primitiveInitializer: null} : null;
  }
  if (compiler.isFunctionDeclaration(declaration) && declaration.body && hoistingList(declaration.parent)) return {row: null, primitiveInitializer: null};
  if (compiler.isClassDeclaration(declaration) && declaration.end <= identifier.getStart(file) && !caseClause(declaration)) {
   const row = sameContext(declaration);
   return row === null ? null : {row, primitiveInitializer: null};
  }
  return null;
 }
 const primitiveCache = new Map<ts.Expression, boolean>();
 /** Effect-free, non-throwing expression whose value is a primitive (safe operand for coercing operators). */
 function primitive(raw: ts.Expression, reads: Set<number>, visiting: Set<ts.Expression> = new Set()): boolean {
  const expr = unwrap(raw);
  if (compiler.isNumericLiteral(expr) || compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || [S.TrueKeyword, S.FalseKeyword, S.NullKeyword].includes(expr.kind)) return true;
  if (compiler.isTemplateExpression(expr)) return expr.templateSpans.every(span => primitive(span.expression, reads, visiting));
  if (compiler.isIdentifier(expr)) {
   const found = binding(expr, checker.getSymbolAtLocation(expr)), initializer = found?.primitiveInitializer;
   if (!found || !initializer || visiting.has(initializer)) return false;
   if (!primitiveCache.has(initializer)) primitiveCache.set(initializer, primitive(initializer, new Set(), new Set([...visiting, initializer])));
   if (!primitiveCache.get(initializer)) return false;
   if (found.row !== null) reads.add(found.row);
   return true;
  }
  if (compiler.isPrefixUnaryExpression(expr)) return expr.operator === S.ExclamationToken ? pure(expr.operand, reads) : [S.PlusToken, S.MinusToken, S.TildeToken].includes(expr.operator) && primitive(expr.operand, reads, visiting);
  if (compiler.isTypeOfExpression(expr) || compiler.isVoidExpression(expr)) return pure(expr.expression, reads);
  if (compiler.isBinaryExpression(expr)) {
   const operator = expr.operatorToken.kind;
   // Strict equality never invokes user code, whatever the operand values are.
   if (operator === S.EqualsEqualsEqualsToken || operator === S.ExclamationEqualsEqualsToken) return pure(expr.left, reads) && pure(expr.right, reads);
   return coercing.has(operator) && primitive(expr.left, reads, visiting) && primitive(expr.right, reads, visiting);
  }
  if (compiler.isConditionalExpression(expr)) return pure(expr.condition, reads) && primitive(expr.whenTrue, reads, visiting) && primitive(expr.whenFalse, reads, visiting);
  return false;
 }
 const coercing = new Set<ts.SyntaxKind>([S.PlusToken, S.MinusToken, S.AsteriskToken, S.SlashToken, S.PercentToken, S.AsteriskAsteriskToken, S.LessThanToken, S.LessThanEqualsToken, S.GreaterThanToken, S.GreaterThanEqualsToken, S.EqualsEqualsToken, S.ExclamationEqualsToken, S.AmpersandToken, S.BarToken, S.CaretToken, S.LessThanLessThanToken, S.GreaterThanGreaterThanToken, S.GreaterThanGreaterThanGreaterThanToken, S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken]);
 const plainName = (name: ts.PropertyName): boolean => (compiler.isIdentifier(name) || compiler.isStringLiteral(name) || compiler.isNumericLiteral(name)) && name.text !== '__proto__';
 /** Effect-free, non-throwing expression of any value: binding reads, fresh literals and closures. */
 function pure(raw: ts.Expression, reads: Set<number>): boolean {
  if (primitive(raw, reads)) return true;
  const expr = unwrap(raw);
  if (compiler.isIdentifier(expr)) {
   const found = binding(expr, checker.getSymbolAtLocation(expr));
   if (!found) return false;
   if (found.row !== null) reads.add(found.row);
   return true;
  }
  // Creating a closure evaluates nothing inside it; its reads happen at call time, after a call barrier.
  if (compiler.isArrowFunction(expr) || compiler.isFunctionExpression(expr)) return true;
  if (compiler.isObjectLiteralExpression(expr)) return expr.properties.every(property => {
   if (compiler.isShorthandPropertyAssignment(property)) {
    if (property.objectAssignmentInitializer) return false;
    const found = binding(property.name, checker.getShorthandAssignmentValueSymbol(property));
    if (found?.row != null) reads.add(found.row);
    return !!found;
   }
   if (compiler.isPropertyAssignment(property)) return plainName(property.name) && pure(property.initializer, reads);
   // Defining a method or accessor does not invoke it.
   return (compiler.isMethodDeclaration(property) || compiler.isGetAccessorDeclaration(property) || compiler.isSetAccessorDeclaration(property)) && plainName(property.name);
  });
  if (compiler.isArrayLiteralExpression(expr)) return expr.elements.every(element => compiler.isOmittedExpression(element) || !compiler.isSpreadElement(element) && pure(element, reads));
  if (compiler.isConditionalExpression(expr)) return pure(expr.condition, reads) && pure(expr.whenTrue, reads) && pure(expr.whenFalse, reads);
  if (compiler.isBinaryExpression(expr) && [S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken].includes(expr.operatorToken.kind)) return pure(expr.left, reads) && pure(expr.right, reads);
  return false;
 }

 /** A use in a type position: a type node, an `implements` clause or an interface's `extends`. */
 const typePosition = (node: ts.Node): boolean => {
  for (let current: ts.Node | undefined = node; current && !compiler.isSourceFile(current); current = current.parent) {
   if (compiler.isTypeNode(current) && !compiler.isExpressionWithTypeArguments(current)) return true;
   if (compiler.isHeritageClause(current)) return current.token === S.ImplementsKeyword || compiler.isInterfaceDeclaration(current.parent);
   if (compiler.isStatement(current)) return false;
  }
  return false;
 };
 // Decorator metadata (emitDecoratorMetadata) may turn a type annotation into a value reference.
 let decoratedFile = false;
 const findDecorators = (node: ts.Node): void => {if (decoratedFile) return; if (compiler.isDecorator(node)) {decoratedFile = true; return;} compiler.forEachChild(node, findDecorators);};
 findDecorators(file);
 /** An import that emits nothing (ADR-013): `import type` always; under `elide-unused` also
  * one with bindings none of which is used as a value, in a file without decorators. A
  * side-effect import (no clause) always loads its module. */
 function erasedImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause || !ownsRows(node, ...braces(clause.namedBindings && compiler.isNamedImports(clause.namedBindings) ? clause.namedBindings : undefined))) return false;
  if (clause.isTypeOnly) return true;
  if (options.imports !== 'elide-unused' || decoratedFile) return false;
  const names: ts.Identifier[] = [...(clause.name ? [clause.name] : []), ...(clause.namedBindings ? compiler.isNamespaceImport(clause.namedBindings) ? [clause.namedBindings.name] : clause.namedBindings.elements.map(element => element.name) : [])];
  const symbols = new Set(names.flatMap(name => {const symbol = checker.getSymbolAtLocation(name); return symbol ? [symbol] : [];}));
  if (symbols.size !== names.length) return false;
  let valueUse = false;
  const visit = (current: ts.Node): void => {
   if (valueUse || current === node) return;
   if (compiler.isIdentifier(current)) {
    const symbol = compiler.isShorthandPropertyAssignment(current.parent) && current.parent.name === current ? checker.getShorthandAssignmentValueSymbol(current.parent) : checker.getSymbolAtLocation(current);
    if (symbol && symbols.has(symbol) && !typePosition(current)) valueUse = true;
    return;
   }
   compiler.forEachChild(current, visit);
  };
  visit(file);
  return !valueUse;
 }
 /** Bindings read when `expr` is evaluated; closure bodies run later, at a call barrier. */
 function symbolReads(expr: ts.Node | undefined, into: Set<ts.Symbol>): Set<ts.Symbol> {
  const visit = (node: ts.Node): void => {
   if (functionLike(node) || compiler.isTypeNode(node)) return;
   if (compiler.isShorthandPropertyAssignment(node)) {const symbol = checker.getShorthandAssignmentValueSymbol(node); if (symbol) into.add(symbol); return;}
   if (compiler.isPropertyAssignment(node)) {visit(node.initializer); return;}
   if (compiler.isIdentifier(node)) {const symbol = checker.getSymbolAtLocation(node); if (symbol) into.add(symbol); return;}
   compiler.forEachChild(node, visit);
  };
  if (expr) visit(expr);
  return into;
 }
 /** `x = e` where x is a let/var declared earlier in this function context and e is pure (ADR-013). */
 function localWrite(statement: ts.ExpressionStatement, reads: Set<number>): Set<ts.Symbol> | null {
  const expr = unwrap(statement.expression);
  if (!compiler.isBinaryExpression(expr) || expr.operatorToken.kind !== S.EqualsToken || !compiler.isIdentifier(expr.left)) return null;
  const symbol = checker.getSymbolAtLocation(expr.left), declaration = unique(symbol);
  if (!symbol || !declaration || !compiler.isVariableDeclaration(declaration) || !compiler.isIdentifier(declaration.name)) return null;
  const list = declaration.parent, owner = list.parent;
  if (!compiler.isVariableDeclarationList(list) || disposable(list) || (list.flags & compiler.NodeFlags.BlockScoped) === compiler.NodeFlags.Const || !compiler.isVariableStatement(owner) || modifiers(owner).length || list.declarations.length !== 1) return null;
  // Same function context (never script level: the global scope is writable from elsewhere), declared before the write, not in a switch clause.
  const scope = context(statement);
  if (scope === file || context(owner) !== scope || owner.end > statement.getStart(file) || compiler.isCaseClause(owner.parent) || compiler.isDefaultClause(owner.parent)) return null;
  if (!pure(expr.right, reads)) return null;
  reads.add(line(owner));
  return new Set([symbol]);
 }
 function summary(node: ts.Statement, list: ts.Node): Summary {
  const reads = new Set<number>(), readSet = new Set<ts.Symbol>(), writeSet = new Set<ts.Symbol>(), base = {first: line(node), last: end(node), start: node.getStart(file), reads, readSet, writeSet};
  const barrier = (reason: string): Summary => ({...base, kind: 'barrier', reason});
  /** Pure or local-write children compose; the unit reads and may write their unions. */
  const compose = (children: Summary[], kind: string): Summary | null => {
   if (!children.every(child => child.kind === 'pure' || child.kind === 'local-write')) return null;
   for (const child of children) {child.readSet.forEach(symbol => readSet.add(symbol)); child.writeSet.forEach(symbol => writeSet.add(symbol));}
   return children.some(child => child.kind === 'local-write') ? {...base, kind: 'local-write', reason: 'local-write-' + kind} : {...base, kind: 'pure', reason: 'pure-' + kind};
  };
  const mods = modifiers(node);
  if (mods.includes(S.DeclareKeyword) || compiler.isInterfaceDeclaration(node) || compiler.isTypeAliasDeclaration(node)) {
   const shape = compiler.isInterfaceDeclaration(node) ? node : compiler.isTypeAliasDeclaration(node) && compiler.isTypeLiteralNode(node.type) ? node.type : undefined;
   const name = 'name' in node && node.name && compiler.isIdentifier(node.name as ts.Node) ? node.name as ts.Identifier : undefined;
   if (name && unique(checker.getSymbolAtLocation(name)) && ownsRows(node, ...braces(shape))) return {...base, kind: 'position-free', reason: 'erased-type-declaration'};
   return barrier('erased-declaration-shape');
  }
  if (compiler.isFunctionDeclaration(node)) {
   if (node.body && node.name && hoistingList(list) && mods.every(kind => kind === S.ExportKeyword || kind === S.DefaultKeyword || kind === S.AsyncKeyword) && !decorated(node) && unique(checker.getSymbolAtLocation(node.name)) && ownsRows(node, ...braces(node.body))) return {...base, kind: 'position-free', reason: 'hoisted-function-declaration'};
   return barrier('function-declaration-not-hoistable');
  }
  if (compiler.isImportDeclaration(node)) {
   if (erasedImport(node)) return {...base, kind: 'position-free', reason: node.importClause?.isTypeOnly ? 'type-only-import' : 'elided-type-import'};
   return barrier('module-import');
  }
  if (compiler.isVariableStatement(node)) {
   const list = node.declarationList, declaration = list.declarations[0];
   const flags = list.flags & compiler.NodeFlags.BlockScoped;
   if (mods.length || list.declarations.length !== 1 || !declaration || !compiler.isIdentifier(declaration.name) || disposable(list) || !unique(checker.getSymbolAtLocation(declaration.name))) return barrier('declaration-shape');
   const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
   if (!initializer ? flags === compiler.NodeFlags.Const : !pure(declaration.initializer!, reads)) return barrier('effectful-or-unknown-initializer');
   const delimited = initializer && (compiler.isObjectLiteralExpression(initializer) ? initializer : (compiler.isArrowFunction(initializer) || compiler.isFunctionExpression(initializer)) && compiler.isBlock(initializer.body) ? initializer.body : undefined);
   symbolReads(declaration.initializer, readSet); writeSet.add(checker.getSymbolAtLocation(declaration.name)!);
   return ownsRows(node, ...braces(delimited)) ? {...base, kind: 'pure', reason: initializer ? 'pure-declaration' : 'uninitialised-declaration'} : barrier('shared-or-continued-rows');
  }
  if (compiler.isClassDeclaration(node)) {
   const heritage = node.heritageClauses?.find(clause => clause.token === S.ExtendsKeyword)?.types[0]?.expression;
   const definitionOnly = node.members.every(member => !(member.name && compiler.isComputedPropertyName(member.name)) && !compiler.isClassStaticBlockDeclaration(member) && !(compiler.isPropertyDeclaration(member) && member.initializer && modifiers(member).includes(S.StaticKeyword)) && !decorated(member));
   // `extends` throws unless its value is a constructor: only a declared class qualifies.
   const base_ = heritage && compiler.isIdentifier(heritage) ? unique(checker.getSymbolAtLocation(heritage)) : undefined;
   const heritageSafe = !heritage || !!base_ && compiler.isClassDeclaration(base_) && pure(heritage, reads);
   if (node.name && !decorated(node) && mods.every(kind => kind === S.ExportKeyword || kind === S.DefaultKeyword || kind === S.AbstractKeyword) && definitionOnly && heritageSafe && unique(checker.getSymbolAtLocation(node.name)) && ownsRows(node, ...braces(node))) {
    symbolReads(heritage, readSet); writeSet.add(checker.getSymbolAtLocation(node.name)!);
    return {...base, kind: 'pure', reason: 'class-definition'};
   }
   return barrier('class-evaluates-code');
  }
  if (compiler.isExpressionStatement(node)) {
   const written = localWrite(node, reads);
   if (written && ownsRows(node)) {symbolReads((unwrap(node.expression) as ts.BinaryExpression).right, readSet); written.forEach(symbol => writeSet.add(symbol)); return {...base, kind: 'local-write', reason: 'local-write'};}
   return barrier(S[node.kind]);
  }
  if (compiler.isBlock(node)) {
   const children = node.statements.map(child => summary(child, node));
   for (const child of children) for (const row of child.reads) if (row < base.first) reads.add(row);
   return compose(children, 'block') ?? barrier('block-contains-barrier');
  }
  if (compiler.isIfStatement(node) && compiler.isBlock(node.thenStatement) && (!node.elseStatement || compiler.isBlock(node.elseStatement))) {
   const branches = [summary(node.thenStatement, node), ...(node.elseStatement ? [summary(node.elseStatement, node)] : [])];
   for (const branch of branches) for (const row of branch.reads) if (row < base.first) reads.add(row);
   if (!pure(node.expression, reads)) return barrier('branch-contains-barrier');
   symbolReads(node.expression, readSet);
   return compose(branches, 'branch') ?? barrier('branch-contains-barrier');
  }
  if (compiler.isReturnStatement(node) && node.expression) pure(node.expression, reads);
  // Any other statement is an ordering barrier, including control transfers.
  return barrier(S[node.kind]);
 }
 /** RAW, WAR or WAW on a binding between two units that run code (ADR-013). */
 const meets = (a: Set<ts.Symbol>, b: Set<ts.Symbol>): boolean => [...a].some(symbol => b.has(symbol));
 const conflict = (a: Summary, b: Summary): boolean => meets(a.writeSet, b.readSet) || meets(a.writeSet, b.writeSet) || meets(a.readSet, b.writeSet);
 const add = (before: number, after: number, essential = false): void => {
  if (before >= after) return;
  if (!entries.has(after)) entries.set(after, new Set());
  entries.get(after)!.add(before);
  if (essential) {if (!protectedInputs.has(after)) protectedInputs.set(after, new Set()); protectedInputs.get(after)!.add(before);}
 };
 /** A statement list whose var/function declarations become global-object properties (classic script). */
 const scriptGlobal = (list: ts.Node): boolean => {
  if (compiler.isExternalModule(file)) return false;
  for (let current: ts.Node | undefined = list; current && !compiler.isSourceFile(current); current = current.parent) if (functionLike(current) || compiler.isModuleBlock(current) || compiler.isClassStaticBlockDeclaration(current) || compiler.isClassLike(current)) return false;
  return true;
 };
 /** A namespace that only declares types emits nothing; any other statement counts as instantiating it. */
 const typeOnly = (declaration: ts.ModuleDeclaration): boolean => {
  const body = declaration.body;
  if (body && compiler.isModuleDeclaration(body)) return typeOnly(body);
  return !body || compiler.isModuleBlock(body) && body.statements.every(statement => compiler.isInterfaceDeclaration(statement) || compiler.isTypeAliasDeclaration(statement) || modifiers(statement).includes(S.DeclareKeyword) || compiler.isModuleDeclaration(statement) && typeOnly(statement));
 };
 /** TypeScript emits an enum, an instantiated namespace and an import alias as a `var` binding. */
 const emitsVar = (node: ts.Node): boolean => (compiler.isEnumDeclaration(node) || compiler.isModuleDeclaration(node) && compiler.isIdentifier(node.name) && !typeOnly(node) || compiler.isImportEqualsDeclaration(node) && !node.isTypeOnly) && !modifiers(node).includes(S.DeclareKeyword);
 /** A function implementation, var names, Annex B block functions or TypeScript
  * `var`-emitting declarations outside nested functions. */
 const declaresGlobal = (statement: ts.Statement): boolean => {
  if (modifiers(statement).includes(S.DeclareKeyword)) return false;
  if (compiler.isFunctionDeclaration(statement)) return !!statement.body;
  if (emitsVar(statement)) return true;
  let found = false;
  const scan = (node: ts.Node): void => {
   if (emitsVar(node)) {found = true; return;}
   if (found || functionLike(node) || compiler.isClassLike(node) || compiler.isModuleDeclaration(node)) {if (compiler.isFunctionDeclaration(node)) found = true; return;}
   if (compiler.isVariableDeclarationList(node) && !(node.flags & compiler.NodeFlags.BlockScoped)) found = true;
   compiler.forEachChild(node, scan);
  };
  compiler.forEachChild(statement, scan);
  if (compiler.isVariableStatement(statement) && !(statement.declarationList.flags & compiler.NodeFlags.BlockScoped)) found = true;
  return found;
 };
 function visit(node: ts.Node): void {
  if (compiler.isSourceFile(node) || compiler.isBlock(node) || compiler.isModuleBlock(node)) {
   const summaries = node.statements.map(statement => summary(statement, node)), sourceFile = compiler.isSourceFile(node);
   if (scriptGlobal(node)) summaries.forEach((unit, i) => {if (declaresGlobal(node.statements[i]!)) unit.global = true;});
   // A physical row containing multiple statements/boundaries is indivisible.
   const separate = summaries.every((unit, i) => !i || summaries[i - 1]!.last < unit.first) && (!summaries.length || sourceFile || summaries[0]!.first > line(node) && summaries.at(-1)!.last < end(node));
   if (separate) {
    // A TS overload signature must directly precede the next signature or the
    // implementation (TS2389/TS2391): the whole group is one barrier unit.
    const grouped: Summary[] = [];
    summaries.forEach((unit, i) => {
     const previous = node.statements[i - 1], current = node.statements[i]!;
     if (previous && compiler.isFunctionDeclaration(previous) && !previous.body && compiler.isFunctionDeclaration(current) && !!previous.name && previous.name.text === current.name?.text) {
      const head = grouped.pop()!;
      grouped.push({...unit, first: head.first, start: head.start, kind: 'barrier', reason: 'overload-group'});
     } else grouped.push(unit);
    });
    // Preserve comments and other non-statement rows as opaque units.
    const complete: Summary[] = [];
    for (let i = 0; i < grouped.length; i++) {
     if (i) for (let row = grouped[i - 1]!.last + 1; row < grouped[i]!.first; row++) if (physical[row]?.trim()) complete.push({first: row, last: row, start: -1, kind: 'opaque', reason: 'non-statement-row', reads: new Set(), readSet: new Set(), writeSet: new Set()});
     complete.push(grouped[i]!);
    }
    for (const unit of complete) {
     units.push({first: unit.first, last: unit.last, kind: unit.kind, reason: unit.reason});
     entries.set(unit.first, new Set());
     for (const row of unit.reads) add(row, unit.first, true);
     if (!sourceFile && !entries.get(unit.first)!.size) add(line(node), unit.first);
    }
    for (let i = 0; i < complete.length; i++) for (let j = i + 1; j < complete.length; j++) {
     const a = complete[i]!, b = complete[j]!;
     const ordered = a.kind === 'opaque' || b.kind === 'opaque' || a.kind !== 'position-free' && b.kind !== 'position-free' && (a.kind === 'barrier' || b.kind === 'barrier') || !!a.global && !!b.global || conflict(a, b);
     if (ordered) add(a.last, b.first);
    }
   }
  }
  compiler.forEachChild(node, visit);
 }
 visit(file);
 return {entries: [...entries].map(([row, after]) => ({row, after: [...after]})), protectedInputs, units};
}
