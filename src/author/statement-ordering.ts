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
 * is position-free and at least one is a barrier. Every evaluation-time read of
 * a binding whose initialisation has a TDZ/value position in the same function
 * context adds a protected edge from that declaration row. Pure units thus
 * commute; a barrier keeps its position relative to every ordered sibling.
 */
import type ts from 'typescript';
type Compiler = typeof ts;

export type UnitKind = 'pure' | 'position-free' | 'barrier' | 'opaque';
/** Evidence for one unit: why it may move, or why it may not. */
export interface StatementUnit {first: number; last: number; kind: UnitKind; reason: string;}
export interface OrderingEntry {row: number; after: number[];}
export interface StatementOrdering {entries: OrderingEntry[]; protectedInputs: Map<number, Set<number>>; units: StatementUnit[];}
interface Summary extends StatementUnit {reads: Set<number>; start: number;}
interface Binding {row: number | null; primitiveInitializer: ts.Expression | null;}

/** Separate, browser-safe checker host: only the reference file is visible. */
export function bindingChecker(file: ts.SourceFile, compiler: Compiler): ts.TypeChecker {
 const options = {allowJs: true, noLib: true, noResolve: true, target: compiler.ScriptTarget.Latest};
 const host: ts.CompilerHost = {getSourceFile: name => name === file.fileName ? file : undefined, getDefaultLibFileName: () => '', writeFile: () => undefined, getCurrentDirectory: () => '', getDirectories: () => [], getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n', fileExists: name => name === file.fileName, readFile: name => name === file.fileName ? file.text : undefined};
 return compiler.createProgram([file.fileName], options, host).getTypeChecker();
}

export function statementOrdering(file: ts.SourceFile, compiler: Compiler): StatementOrdering {
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

 function summary(node: ts.Statement, list: ts.Node): Summary {
  const reads = new Set<number>(), base = {first: line(node), last: end(node), start: node.getStart(file), reads};
  const barrier = (reason: string): Summary => ({...base, kind: 'barrier', reason});
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
  if (compiler.isVariableStatement(node)) {
   const list = node.declarationList, declaration = list.declarations[0];
   const flags = list.flags & compiler.NodeFlags.BlockScoped;
   if (mods.length || list.declarations.length !== 1 || !declaration || !compiler.isIdentifier(declaration.name) || disposable(list) || !unique(checker.getSymbolAtLocation(declaration.name))) return barrier('declaration-shape');
   const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
   if (!initializer ? flags === compiler.NodeFlags.Const : !pure(declaration.initializer!, reads)) return barrier('effectful-or-unknown-initializer');
   const delimited = initializer && (compiler.isObjectLiteralExpression(initializer) ? initializer : (compiler.isArrowFunction(initializer) || compiler.isFunctionExpression(initializer)) && compiler.isBlock(initializer.body) ? initializer.body : undefined);
   return ownsRows(node, ...braces(delimited)) ? {...base, kind: 'pure', reason: initializer ? 'pure-declaration' : 'uninitialised-declaration'} : barrier('shared-or-continued-rows');
  }
  if (compiler.isClassDeclaration(node)) {
   const heritage = node.heritageClauses?.find(clause => clause.token === S.ExtendsKeyword)?.types[0]?.expression;
   const definitionOnly = node.members.every(member => !(member.name && compiler.isComputedPropertyName(member.name)) && !compiler.isClassStaticBlockDeclaration(member) && !(compiler.isPropertyDeclaration(member) && member.initializer && modifiers(member).includes(S.StaticKeyword)) && !decorated(member));
   // `extends` throws unless its value is a constructor: only a declared class qualifies.
   const base_ = heritage && compiler.isIdentifier(heritage) ? unique(checker.getSymbolAtLocation(heritage)) : undefined;
   const heritageSafe = !heritage || !!base_ && compiler.isClassDeclaration(base_) && pure(heritage, reads);
   if (node.name && !decorated(node) && mods.every(kind => kind === S.ExportKeyword || kind === S.DefaultKeyword || kind === S.AbstractKeyword) && definitionOnly && heritageSafe && unique(checker.getSymbolAtLocation(node.name)) && ownsRows(node, ...braces(node))) return {...base, kind: 'pure', reason: 'class-definition'};
   return barrier('class-evaluates-code');
  }
  if (compiler.isBlock(node)) {
   const children = node.statements.map(child => summary(child, node));
   for (const child of children) for (const row of child.reads) if (row < base.first) reads.add(row);
   return children.every(child => child.kind === 'pure') ? {...base, kind: 'pure', reason: 'pure-block'} : barrier('block-contains-barrier');
  }
  if (compiler.isIfStatement(node) && compiler.isBlock(node.thenStatement) && (!node.elseStatement || compiler.isBlock(node.elseStatement))) {
   const branches = [summary(node.thenStatement, node), ...(node.elseStatement ? [summary(node.elseStatement, node)] : [])];
   for (const branch of branches) for (const row of branch.reads) if (row < base.first) reads.add(row);
   return pure(node.expression, reads) && branches.every(branch => branch.kind === 'pure') ? {...base, kind: 'pure', reason: 'pure-branch'} : barrier('branch-contains-barrier');
  }
  if (compiler.isReturnStatement(node) && node.expression) pure(node.expression, reads);
  // Any other statement is an ordering barrier, including control transfers.
  return barrier(S[node.kind]);
 }
 const add = (before: number, after: number, essential = false): void => {
  if (before >= after) return;
  if (!entries.has(after)) entries.set(after, new Set());
  entries.get(after)!.add(before);
  if (essential) {if (!protectedInputs.has(after)) protectedInputs.set(after, new Set()); protectedInputs.get(after)!.add(before);}
 };
 function visit(node: ts.Node): void {
  if (compiler.isSourceFile(node) || compiler.isBlock(node) || compiler.isModuleBlock(node)) {
   const summaries = node.statements.map(statement => summary(statement, node)), sourceFile = compiler.isSourceFile(node);
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
     if (i) for (let row = grouped[i - 1]!.last + 1; row < grouped[i]!.first; row++) if (physical[row]?.trim()) complete.push({first: row, last: row, start: -1, kind: 'opaque', reason: 'non-statement-row', reads: new Set()});
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
     const ordered = a.kind === 'opaque' || b.kind === 'opaque' || a.kind !== 'position-free' && b.kind !== 'position-free' && (a.kind === 'barrier' || b.kind === 'barrier');
     if (ordered) add(a.last, b.first);
    }
   }
  }
  compiler.forEachChild(node, visit);
 }
 visit(file);
 return {entries: [...entries].map(([row, after]) => ({row, after: [...after]})), protectedInputs, units};
}

/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export function reduceGeneratedDependencies(lines: {id: number; dependencies: number[]}[], protectedById: Map<number, Set<number>> = new Map()): void {
 const ancestors = new Map<number, Set<number>>();
 for (const item of lines) {const all = new Set<number>(); for (const dep of item.dependencies) {all.add(dep); for (const ancestor of ancestors.get(dep) ?? []) all.add(ancestor);} ancestors.set(item.id, all);}
 for (const item of lines) {const protectedIds = protectedById.get(item.id) ?? new Set<number>(); item.dependencies = item.dependencies.filter(dep => protectedIds.has(dep) || !item.dependencies.some(other => other !== dep && ancestors.get(other)?.has(dep))).sort((a, b) => a - b);}
}
