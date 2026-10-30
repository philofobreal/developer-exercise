import { footprintConflicts, objectFootprints } from './object-footprints.js';
import { freeCommentRows } from './comment-rows.js';
import { categoryOf } from './reason-codes.js';
/** Separate, browser-safe checker host: only the reference file is visible. */
export function bindingChecker(file, compiler) {
    const options = { allowJs: true, noLib: true, noResolve: true, target: compiler.ScriptTarget.Latest };
    const host = { getSourceFile: name => name === file.fileName ? file : undefined, getDefaultLibFileName: () => '', writeFile: () => undefined, getCurrentDirectory: () => '', getDirectories: () => [], getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n', fileExists: name => name === file.fileName, readFile: name => name === file.fileName ? file.text : undefined };
    return compiler.createProgram([file.fileName], options, host).getTypeChecker();
}
export function statementOrdering(file, compiler, options = {}) {
    const empty = { entries: [], protectedInputs: new Map(), units: [] };
    let dynamic = false;
    const scan = (node) => {
        // with and direct eval change name resolution at run time: analyse nothing.
        if (compiler.isWithStatement(node) || compiler.isCallExpression(node) && compiler.isIdentifier(node.expression) && node.expression.text === 'eval')
            dynamic = true;
        compiler.forEachChild(node, scan);
    };
    scan(file);
    if (dynamic)
        return empty;
    const checker = bindingChecker(file, compiler), physical = file.text.split('\n');
    const entries = new Map(), reasons = new Map(), protectedInputs = new Map(), units = [];
    const line = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
    const end = (node) => file.getLineAndCharacterOfPosition(node.end - 1).line;
    const S = compiler.SyntaxKind;
    // The enum's reverse mapping yields a SyntaxKind name; TypeScript types it as a plain string.
    const kindName = (node) => S[node.kind];
    const functionLike = (node) => compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isArrowFunction(node) || compiler.isMethodDeclaration(node) || compiler.isConstructorDeclaration(node) || compiler.isGetAccessorDeclaration(node) || compiler.isSetAccessorDeclaration(node);
    const context = (node) => {
        let current = node.parent;
        while (current && !compiler.isSourceFile(current) && !functionLike(current) && !compiler.isClassStaticBlockDeclaration(current) && !compiler.isPropertyDeclaration(current))
            current = current.parent;
        return current ?? file;
    };
    const within = (outer, inner) => inner.getStart(file) >= outer.getStart(file) && inner.end <= outer.end;
    const modifiers = (node) => (compiler.canHaveModifiers(node) ? compiler.getModifiers(node) ?? [] : []).map(modifier => modifier.kind);
    const decorated = (node) => compiler.canHaveDecorators(node) && !!compiler.getDecorators(node)?.length;
    const unwrap = (expr) => compiler.isParenthesizedExpression(expr) || compiler.isAsExpression(expr) || compiler.isSatisfiesExpression(expr) || compiler.isNonNullExpression(expr) || compiler.isTypeAssertionExpression(expr) ? unwrap(expr.expression) : expr;
    const unique = (symbol) => symbol?.declarations?.length === 1 && symbol.declarations[0].getSourceFile() === file ? symbol.declarations[0] : undefined;
    // NodeFlags.AwaitUsing is Const|Using, so declaration kinds must be compared exactly.
    const disposable = (list) => [compiler.NodeFlags.Using, compiler.NodeFlags.AwaitUsing].includes(list.flags & compiler.NodeFlags.BlockScoped);
    const hoistingList = (node) => compiler.isSourceFile(node) || compiler.isModuleBlock(node) || compiler.isBlock(node) && functionLike(node.parent);
    /** Row equality guarantees that no sibling code shares the unit's rows. */
    const ownsRows = (node, open, close) => {
        const first = line(node), last = end(node);
        if (first === last)
            return physical[first]?.trim() === node.getText(file).trim();
        if (!open || !close || line(open) !== first || line(close) !== last)
            return false;
        return physical[first]?.trim() === file.text.slice(node.getStart(file), open.end).trim() && physical[last]?.trim() === file.text.slice(close.getStart(file), node.end).trim();
    };
    /** ADR-028/034: the opening and closing brace that end a compound statement's first and last row:
     * if/else if chains, switch, try/catch/finally, for…of, and (ADR-042) a labelled one of these. */
    const compoundBraces = (statement) => {
        if (compiler.isLabeledStatement(statement))
            return compoundBraces(statement.statement);
        if (compiler.isIfStatement(statement)) {
            let last = statement;
            while (compiler.isIfStatement(last))
                last = last.elseStatement ?? last.thenStatement;
            return [braces(statement.thenStatement)[0], braces(last)[1]];
        }
        if (compiler.isSwitchStatement(statement))
            return braces(statement.caseBlock);
        if (compiler.isTryStatement(statement))
            return [braces(statement.tryBlock)[0], braces(statement.finallyBlock ?? statement.catchClause?.block)[1]];
        if (compiler.isForOfStatement(statement))
            return braces(statement.statement);
        return [];
    };
    /** A compound statement owns its first row (up to its opening brace) and its last row. */
    const ownsCompound = (statement) => ownsRows(statement, ...compoundBraces(statement));
    const braces = (node) => {
        if (!node)
            return [];
        const children = node.getChildren(file), open = children.find(child => child.kind === S.OpenBraceToken), close = children.filter(child => child.kind === S.CloseBraceToken).at(-1);
        return open && close ? [open, close] : [];
    };
    /** Local write sets: bindings that are assignment, update, destructuring or for-in/of targets anywhere. */
    const written = new Set();
    const writeTarget = (node) => {
        let current = node;
        for (let parent = current.parent; parent; current = parent, parent = parent.parent) {
            // Climb through wrappers and destructuring patterns to the outermost target expression.
            if (!(compiler.isParenthesizedExpression(parent) || compiler.isNonNullExpression(parent) || compiler.isAsExpression(parent) || compiler.isSatisfiesExpression(parent) || compiler.isTypeAssertionExpression(parent) || compiler.isArrayLiteralExpression(parent) || compiler.isObjectLiteralExpression(parent) || compiler.isSpreadElement(parent) || compiler.isSpreadAssignment(parent) || compiler.isShorthandPropertyAssignment(parent) || compiler.isPropertyAssignment(parent) && parent.initializer === current))
                break;
        }
        const parent = current.parent;
        if (!parent)
            return false;
        if (compiler.isBinaryExpression(parent))
            return parent.left === current && parent.operatorToken.kind >= S.FirstAssignment && parent.operatorToken.kind <= S.LastAssignment;
        if (compiler.isForInStatement(parent) || compiler.isForOfStatement(parent))
            return parent.initializer === current;
        return (compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent)) && (parent.operator === S.PlusPlusToken || parent.operator === S.MinusMinusToken);
    };
    const collectWrites = (node) => {
        if (compiler.isIdentifier(node) && writeTarget(node)) {
            const symbol = compiler.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
            if (symbol)
                written.add(symbol);
        }
        compiler.forEachChild(node, collectWrites);
    };
    collectWrites(file);
    /** Every identifier use of a binding, and whether it declares or writes it; the function
     * contexts that use `arguments`, which aliases parameters in sloppy mode (ADR-019). */
    const uses = new Map(), names = new Map(), withArguments = new Set();
    const declarationName = (node) => {
        const parent = node.parent;
        return (compiler.isVariableDeclaration(parent) || compiler.isParameter(parent) || compiler.isBindingElement(parent) || compiler.isFunctionDeclaration(parent) || compiler.isClassDeclaration(parent)) && parent.name === node;
    };
    const collectUses = (node) => {
        if (compiler.isIdentifier(node)) {
            if (node.text === 'arguments')
                for (let scope = context(node);; scope = context(scope)) {
                    withArguments.add(scope);
                    if (scope === file)
                        break;
                }
            const key = (compiler.isPropertyAccessExpression(node.parent) || compiler.isPropertyAssignment(node.parent) || compiler.isPropertyDeclaration(node.parent) || compiler.isMethodDeclaration(node.parent) || compiler.isAccessor(node.parent) || compiler.isPropertySignature(node.parent)) && node.parent.name === node;
            if (!key) {
                if (!names.has(node.text))
                    names.set(node.text, []);
                names.get(node.text).push(node);
            }
            const symbol = compiler.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
            if (symbol) {
                if (!uses.has(symbol))
                    uses.set(symbol, []);
                uses.get(symbol).push({ node, write: declarationName(node) || writeTarget(node) });
            }
            return;
        }
        compiler.forEachChild(node, collectUses);
    };
    collectUses(file);
    /** Script-level units summarised so far, in source order (filled while the file's list is summarised). */
    const scriptUnits = [];
    /** ADR-041 (v20): a read at script level that no script-level statement able to run code precedes.
     * A pure unit and a barrier of the script list keep their order (P2), so every accepted order has
     * no such statement before the read either: no code ran yet, through the global scope or not. */
    const codeFreeBefore = (identifier) => {
        if (context(identifier) !== file)
            return false;
        const index = file.statements.findIndex(statement => within(statement, identifier));
        return index >= 0 && scriptUnits.length >= index && scriptUnits.slice(0, index).every(unit => unit.kind === 'pure' || unit.kind === 'position-free');
    };
    /** Resolves an evaluation-time identifier read to a binding that is initialised whenever the read runs. */
    function binding(identifier, symbol) {
        const declaration = unique(symbol);
        if (!declaration)
            return null;
        const sameContext = (statement) => context(statement) === context(identifier) ? line(statement) : null;
        // A switch shares one scope between clauses: a jump can skip the declaration.
        const caseClause = (statement) => compiler.isCaseClause(statement.parent) || compiler.isDefaultClause(statement.parent);
        if (compiler.isVariableDeclaration(declaration) && compiler.isIdentifier(declaration.name)) {
            const list = declaration.parent;
            if (compiler.isCatchClause(list))
                return within(list.block, identifier) ? { row: null, primitiveInitializer: null } : null;
            if (!compiler.isVariableDeclarationList(list) || disposable(list))
                return null;
            const owner = list.parent;
            // ADR-019: ++/-- keep a primitive number a number, so a counter whose only writes are updates stays primitive.
            const counter = () => !!symbol && context(owner) !== file && (uses.get(symbol) ?? []).every(use => !use.write || declarationName(use.node) || compiler.isPrefixUnaryExpression(use.node.parent) || compiler.isPostfixUnaryExpression(use.node.parent));
            if ((compiler.isForStatement(owner) || compiler.isForOfStatement(owner) || compiler.isForInStatement(owner)) && owner.initializer === list)
                return within(owner.statement, identifier) ? { row: null, primitiveInitializer: compiler.isForStatement(owner) && list.declarations.length === 1 && declaration.initializer && counter() ? declaration.initializer : null } : null;
            // The read must follow the whole declaration: `const a = a` throws.
            if (!compiler.isVariableStatement(owner) || modifiers(owner).length || list.declarations.length !== 1 || declaration.end > identifier.getStart(file) || caseClause(owner))
                return null;
            const lexical = (list.flags & compiler.NodeFlags.BlockScoped) !== 0, row = sameContext(owner);
            // From another function context a let/const may still be in its TDZ when the read runs.
            if (lexical && row === null)
                return null;
            // Never-written let/var behave like const; script-level ones stay writable through the global
            // scope, so only a script-level read that no code-running statement precedes sees them unchanged.
            const constant = (list.flags & compiler.NodeFlags.BlockScoped) === compiler.NodeFlags.Const || !!symbol && !written.has(symbol) && (context(owner) !== file || codeFreeBefore(identifier));
            return { row, primitiveInitializer: (constant || counter()) && declaration.initializer ? declaration.initializer : null };
        }
        if (compiler.isParameter(declaration) && compiler.isIdentifier(declaration.name)) {
            const body = declaration.parent.body;
            return body && within(body, identifier) ? { row: null, primitiveInitializer: null } : null;
        }
        if (compiler.isFunctionDeclaration(declaration) && declaration.body && hoistingList(declaration.parent))
            return { row: null, primitiveInitializer: null };
        if (compiler.isClassDeclaration(declaration) && declaration.end <= identifier.getStart(file) && !caseClause(declaration)) {
            const row = sameContext(declaration);
            return row === null ? null : { row, primitiveInitializer: null };
        }
        return null;
    }
    const primitiveCache = new Map();
    /** Effect-free, non-throwing expression whose value is a primitive (safe operand for coercing operators). */
    function primitive(raw, reads, visiting = new Set()) {
        const expr = unwrap(raw);
        if (compiler.isNumericLiteral(expr) || compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || [S.TrueKeyword, S.FalseKeyword, S.NullKeyword].includes(expr.kind))
            return true;
        if (compiler.isTemplateExpression(expr))
            return expr.templateSpans.every(span => primitive(span.expression, reads, visiting));
        if (compiler.isIdentifier(expr)) {
            const found = binding(expr, checker.getSymbolAtLocation(expr)), initializer = found?.primitiveInitializer;
            if (!found || !initializer || visiting.has(initializer))
                return false;
            if (!primitiveCache.has(initializer))
                primitiveCache.set(initializer, primitive(initializer, new Set(), new Set([...visiting, initializer])));
            if (!primitiveCache.get(initializer))
                return false;
            if (found.row !== null)
                reads.add(found.row);
            return true;
        }
        if (compiler.isPrefixUnaryExpression(expr))
            return expr.operator === S.ExclamationToken ? pure(expr.operand, reads) : [S.PlusToken, S.MinusToken, S.TildeToken].includes(expr.operator) && primitive(expr.operand, reads, visiting);
        if (compiler.isTypeOfExpression(expr) || compiler.isVoidExpression(expr))
            return pure(expr.expression, reads);
        if (compiler.isBinaryExpression(expr)) {
            const operator = expr.operatorToken.kind;
            // Strict equality never invokes user code, whatever the operand values are.
            if (operator === S.EqualsEqualsEqualsToken || operator === S.ExclamationEqualsEqualsToken)
                return pure(expr.left, reads) && pure(expr.right, reads);
            return coercing.has(operator) && primitive(expr.left, reads, visiting) && primitive(expr.right, reads, visiting);
        }
        if (compiler.isConditionalExpression(expr))
            return pure(expr.condition, reads) && primitive(expr.whenTrue, reads, visiting) && primitive(expr.whenFalse, reads, visiting);
        return false;
    }
    const coercing = new Set([S.PlusToken, S.MinusToken, S.AsteriskToken, S.SlashToken, S.PercentToken, S.AsteriskAsteriskToken, S.LessThanToken, S.LessThanEqualsToken, S.GreaterThanToken, S.GreaterThanEqualsToken, S.EqualsEqualsToken, S.ExclamationEqualsToken, S.AmpersandToken, S.BarToken, S.CaretToken, S.LessThanLessThanToken, S.GreaterThanGreaterThanToken, S.GreaterThanGreaterThanGreaterThanToken, S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken]);
    const plainName = (name) => (compiler.isIdentifier(name) || compiler.isStringLiteral(name) || compiler.isNumericLiteral(name)) && name.text !== '__proto__';
    /** Effect-free, non-throwing expression of any value: binding reads, fresh literals and closures. */
    function pure(raw, reads) {
        if (primitive(raw, reads))
            return true;
        const expr = unwrap(raw);
        if (compiler.isIdentifier(expr)) {
            const found = binding(expr, checker.getSymbolAtLocation(expr));
            if (!found)
                return false;
            if (found.row !== null)
                reads.add(found.row);
            return true;
        }
        // Creating a closure evaluates nothing inside it; its reads happen at call time, after a call barrier.
        if (compiler.isArrowFunction(expr) || compiler.isFunctionExpression(expr))
            return true;
        if (compiler.isObjectLiteralExpression(expr))
            return expr.properties.every(property => {
                if (compiler.isShorthandPropertyAssignment(property)) {
                    if (property.objectAssignmentInitializer)
                        return false;
                    const found = binding(property.name, checker.getShorthandAssignmentValueSymbol(property));
                    if (found?.row != null)
                        reads.add(found.row);
                    return !!found;
                }
                if (compiler.isPropertyAssignment(property))
                    return plainName(property.name) && pure(property.initializer, reads);
                // Defining a method or accessor does not invoke it.
                return (compiler.isMethodDeclaration(property) || compiler.isGetAccessorDeclaration(property) || compiler.isSetAccessorDeclaration(property)) && plainName(property.name);
            });
        if (compiler.isArrayLiteralExpression(expr))
            return expr.elements.every(element => compiler.isOmittedExpression(element) || !compiler.isSpreadElement(element) && pure(element, reads));
        if (compiler.isConditionalExpression(expr))
            return pure(expr.condition, reads) && pure(expr.whenTrue, reads) && pure(expr.whenFalse, reads);
        if (compiler.isBinaryExpression(expr) && [S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken].includes(expr.operatorToken.kind))
            return pure(expr.left, reads) && pure(expr.right, reads);
        return false;
    }
    /** A use in a type position: a type node, an `implements` clause or an interface's `extends`. */
    const typePosition = (node) => {
        for (let current = node; current && !compiler.isSourceFile(current); current = current.parent) {
            if (compiler.isTypeNode(current) && !compiler.isExpressionWithTypeArguments(current))
                return true;
            if (compiler.isHeritageClause(current))
                return current.token === S.ImplementsKeyword || compiler.isInterfaceDeclaration(current.parent);
            if (compiler.isStatement(current))
                return false;
        }
        return false;
    };
    // Decorator metadata (emitDecoratorMetadata) may turn a type annotation into a value reference.
    let decoratedFile = false;
    const findDecorators = (node) => { if (decoratedFile)
        return; if (compiler.isDecorator(node)) {
        decoratedFile = true;
        return;
    } compiler.forEachChild(node, findDecorators); };
    findDecorators(file);
    /** An import that emits nothing (ADR-013): `import type` always; under `elide-unused` also
     * one with bindings none of which is used as a value, in a file without decorators. A
     * side-effect import (no clause) always loads its module. */
    function erasedImport(node) {
        const clause = node.importClause;
        if (!clause || !ownsRows(node, ...braces(clause.namedBindings && compiler.isNamedImports(clause.namedBindings) ? clause.namedBindings : undefined)))
            return false;
        if (clause.isTypeOnly)
            return true;
        if (options.imports !== 'elide-unused' || decoratedFile)
            return false;
        const names = [...(clause.name ? [clause.name] : []), ...(clause.namedBindings ? compiler.isNamespaceImport(clause.namedBindings) ? [clause.namedBindings.name] : clause.namedBindings.elements.map(element => element.name) : [])];
        const symbols = new Set(names.flatMap(name => { const symbol = checker.getSymbolAtLocation(name); return symbol ? [symbol] : []; }));
        if (symbols.size !== names.length)
            return false;
        let valueUse = false;
        const visit = (current) => {
            if (valueUse || current === node)
                return;
            if (compiler.isIdentifier(current)) {
                const symbol = compiler.isShorthandPropertyAssignment(current.parent) && current.parent.name === current ? checker.getShorthandAssignmentValueSymbol(current.parent) : checker.getSymbolAtLocation(current);
                if (symbol && symbols.has(symbol) && !typePosition(current))
                    valueUse = true;
                return;
            }
            compiler.forEachChild(current, visit);
        };
        visit(file);
        return !valueUse;
    }
    /** Bindings read when `expr` is evaluated; closure bodies run later, at a call barrier. */
    function symbolReads(expr, into) {
        const visit = (node) => {
            if (functionLike(node) || compiler.isTypeNode(node))
                return;
            if (compiler.isShorthandPropertyAssignment(node)) {
                const symbol = checker.getShorthandAssignmentValueSymbol(node);
                if (symbol)
                    into.add(symbol);
                return;
            }
            if (compiler.isPropertyAssignment(node)) {
                visit(node.initializer);
                return;
            }
            if (compiler.isIdentifier(node)) {
                const symbol = checker.getSymbolAtLocation(node);
                if (symbol)
                    into.add(symbol);
                return;
            }
            compiler.forEachChild(node, visit);
        };
        if (expr)
            visit(expr);
        return into;
    }
    /** `x = e` where x is a let/var declared earlier in this function context and e is pure (ADR-013). */
    function localWrite(statement, reads) {
        const expr = unwrap(statement.expression);
        if (!compiler.isBinaryExpression(expr) || expr.operatorToken.kind !== S.EqualsToken || !compiler.isIdentifier(expr.left))
            return null;
        const symbol = checker.getSymbolAtLocation(expr.left), declaration = unique(symbol);
        if (!symbol || !declaration || !compiler.isVariableDeclaration(declaration) || !compiler.isIdentifier(declaration.name))
            return null;
        const list = declaration.parent, owner = list.parent;
        if (!compiler.isVariableDeclarationList(list) || disposable(list) || (list.flags & compiler.NodeFlags.BlockScoped) === compiler.NodeFlags.Const || !compiler.isVariableStatement(owner) || modifiers(owner).length || list.declarations.length !== 1)
            return null;
        // Same function context (never script level: the global scope is writable from elsewhere), declared before the write, not in a switch clause.
        const scope = context(statement);
        if (scope === file || context(owner) !== scope || owner.end > statement.getStart(file) || compiler.isCaseClause(owner.parent) || compiler.isDefaultClause(owner.parent))
            return null;
        if (!pure(expr.right, reads))
            return null;
        reads.add(line(owner));
        return new Set([symbol]);
    }
    function summary(node, list) {
        const reads = new Set(), readSet = new Set(), writeSet = new Set(), base = { first: line(node), last: end(node), start: node.getStart(file), reads, readSet, writeSet, node };
        const barrier = (reason) => ({ ...base, kind: 'barrier', reason, code: reason });
        /** Pure or local-write children compose; the unit reads and may write their unions. */
        const compose = (children, kind) => {
            if (!children.every(child => child.kind === 'pure' || child.kind === 'local-write'))
                return null;
            for (const child of children) {
                child.readSet.forEach(symbol => readSet.add(symbol));
                child.writeSet.forEach(symbol => writeSet.add(symbol));
            }
            return children.some(child => child.kind === 'local-write') ? { ...base, kind: 'local-write', reason: 'local-write-' + kind } : { ...base, kind: 'pure', reason: 'pure-' + kind };
        };
        const mods = modifiers(node);
        if (mods.includes(S.DeclareKeyword) || compiler.isInterfaceDeclaration(node) || compiler.isTypeAliasDeclaration(node)) {
            const declared = compiler.isVariableStatement(node) && node.declarationList.declarations.length === 1 ? node.declarationList.declarations[0].type : undefined;
            const shape = compiler.isInterfaceDeclaration(node) ? node : compiler.isTypeAliasDeclaration(node) && compiler.isTypeLiteralNode(node.type) ? node.type : declared && compiler.isTypeLiteralNode(declared) ? declared : undefined;
            // v18 (ADR-039): a `declare` variable statement names its bindings in the declaration list.
            const names = compiler.isVariableStatement(node) ? node.declarationList.declarations.map(declaration => declaration.name) : 'name' in node && node.name ? [node.name] : [];
            if (names.length && names.every(name => compiler.isIdentifier(name) && unique(checker.getSymbolAtLocation(name))) && ownsRows(node, ...braces(shape)))
                return { ...base, kind: 'position-free', reason: 'erased-type-declaration' };
            return barrier('erased-declaration-shape');
        }
        if (compiler.isFunctionDeclaration(node)) {
            if (node.body && node.name && hoistingList(list) && mods.every(kind => kind === S.ExportKeyword || kind === S.DefaultKeyword || kind === S.AsyncKeyword) && !decorated(node) && unique(checker.getSymbolAtLocation(node.name)) && ownsRows(node, ...braces(node.body)))
                return { ...base, kind: 'position-free', reason: 'hoisted-function-declaration' };
            return barrier('function-declaration-not-hoistable');
        }
        if (compiler.isImportDeclaration(node)) {
            if (erasedImport(node))
                return { ...base, kind: 'position-free', reason: node.importClause?.isTypeOnly ? 'type-only-import' : 'elided-type-import' };
            return barrier('module-import');
        }
        if (compiler.isVariableStatement(node)) {
            const list = node.declarationList, declaration = list.declarations[0];
            const flags = list.flags & compiler.NodeFlags.BlockScoped;
            if (mods.length || list.declarations.length !== 1 || !declaration || !compiler.isIdentifier(declaration.name) || disposable(list) || !unique(checker.getSymbolAtLocation(declaration.name)))
                return barrier('declaration-shape');
            const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
            if (!initializer ? flags === compiler.NodeFlags.Const : !pure(declaration.initializer, reads))
                return barrier('effectful-or-unknown-initializer');
            const delimited = initializer && (compiler.isObjectLiteralExpression(initializer) ? initializer : (compiler.isArrowFunction(initializer) || compiler.isFunctionExpression(initializer)) && compiler.isBlock(initializer.body) ? initializer.body : undefined);
            symbolReads(declaration.initializer, readSet);
            writeSet.add(checker.getSymbolAtLocation(declaration.name));
            return ownsRows(node, ...braces(delimited)) ? { ...base, kind: 'pure', reason: initializer ? 'pure-declaration' : 'uninitialised-declaration' } : barrier('shared-or-continued-rows');
        }
        if (compiler.isClassDeclaration(node)) {
            const heritage = node.heritageClauses?.find(clause => clause.token === S.ExtendsKeyword)?.types[0]?.expression;
            const definitionOnly = node.members.every(member => !(member.name && compiler.isComputedPropertyName(member.name)) && !compiler.isClassStaticBlockDeclaration(member) && !(compiler.isPropertyDeclaration(member) && member.initializer && modifiers(member).includes(S.StaticKeyword)) && !decorated(member));
            // `extends` throws unless its value is a constructor: only a declared class qualifies.
            const base_ = heritage && compiler.isIdentifier(heritage) ? unique(checker.getSymbolAtLocation(heritage)) : undefined;
            const heritageSafe = !heritage || !!base_ && compiler.isClassDeclaration(base_) && pure(heritage, reads);
            if (node.name && !decorated(node) && mods.every(kind => kind === S.ExportKeyword || kind === S.DefaultKeyword || kind === S.AbstractKeyword) && definitionOnly && heritageSafe && unique(checker.getSymbolAtLocation(node.name)) && ownsRows(node, ...braces(node))) {
                symbolReads(heritage, readSet);
                writeSet.add(checker.getSymbolAtLocation(node.name));
                return { ...base, kind: 'pure', reason: 'class-definition' };
            }
            return barrier('class-evaluates-code');
        }
        if (compiler.isExpressionStatement(node)) {
            const written = localWrite(node, reads);
            if (written && ownsRows(node)) {
                symbolReads(unwrap(node.expression).right, readSet);
                written.forEach(symbol => writeSet.add(symbol));
                return { ...base, kind: 'local-write', reason: 'local-write' };
            }
            return barrier(kindName(node));
        }
        if (compiler.isBlock(node)) {
            const children = node.statements.map(child => summary(child, node));
            for (const child of children)
                for (const row of child.reads)
                    if (row < base.first)
                        reads.add(row);
            return compose(children, 'block') ?? barrier('block-contains-barrier');
        }
        if (compiler.isIfStatement(node) && compiler.isBlock(node.thenStatement) && (!node.elseStatement || compiler.isBlock(node.elseStatement))) {
            const branches = [summary(node.thenStatement, node), ...(node.elseStatement ? [summary(node.elseStatement, node)] : [])];
            for (const branch of branches)
                for (const row of branch.reads)
                    if (row < base.first)
                        reads.add(row);
            if (!pure(node.expression, reads))
                return barrier('branch-contains-barrier');
            symbolReads(node.expression, readSet);
            return compose(branches, 'branch') ?? barrier('branch-contains-barrier');
        }
        if (compiler.isReturnStatement(node) && node.expression)
            pure(node.expression, reads);
        // Any other statement is an ordering barrier, including control transfers.
        return barrier(kindName(node));
    }
    /** RAW, WAR or WAW on a binding between two units that run code (ADR-013). */
    const meets = (a, b) => [...a].some(symbol => b.has(symbol));
    /** Whether running `root` may leave it by return, throw, yield, await or a jump to a target outside it, or registers a disposal. */
    const transfers = (root) => {
        const internal = (jump) => {
            for (let current = jump.parent;; current = current.parent) {
                const loop = compiler.isForStatement(current) || compiler.isForInStatement(current) || compiler.isForOfStatement(current) || compiler.isWhileStatement(current) || compiler.isDoStatement(current);
                if (jump.label ? compiler.isLabeledStatement(current) && current.label.text === jump.label.text : loop || compiler.isBreakStatement(jump) && compiler.isSwitchStatement(current))
                    return true;
                if (current === root)
                    return false;
            }
        };
        let found = false;
        const visit = (node) => {
            if (found || functionLike(node) || compiler.isClassLike(node))
                return;
            // A using declaration registers a disposal (an await at block exit for await using).
            if (compiler.isReturnStatement(node) || compiler.isThrowStatement(node) || compiler.isYieldExpression(node) || compiler.isAwaitExpression(node) || compiler.isForOfStatement(node) && !!node.awaitModifier || compiler.isVariableDeclarationList(node) && disposable(node) || (compiler.isBreakStatement(node) || compiler.isContinueStatement(node)) && !internal(node)) {
                found = true;
                return;
            }
            compiler.forEachChild(node, visit);
        };
        visit(root);
        return found;
    };
    /** ADR-019: a pure unit and an effect barrier of one function-context list commute when no code
     * the barrier can run observes their order. The barrier never leaves its statement early; the
     * unit's own bindings are block-scoped, captured by no closure and not used by the barrier; every
     * binding it reads belongs to this context and is written neither by a closure nor by the barrier;
     * and the context does not use `arguments`. A throwing barrier exits the block, after which only a
     * closure could observe a block-scoped binding. */
    const commutes = (unit, barrier) => {
        const own = unit.node, other = barrier.node;
        if (unit.kind !== 'pure' || barrier.kind !== 'barrier' || !(categoryOf(barrier.reason) === 'effect' || barrier.reason === 'declaration-shape' || barrier.reason === 'shared-or-continued-rows') || !own || !other)
            return false;
        const scope = context(own);
        if (scope === file || withArguments.has(scope) || transfers(other))
            return false;
        // Uses are matched by binding and, like the independent oracle, also by name: a shadowing
        // name only forbids a commutation.
        const named = (root, name, writesOnly, nestedOnly) => (names.get(name) ?? []).some(use => within(root, use) && (!writesOnly || declarationName(use) || writeTarget(use)) && (!nestedOnly || context(use) !== scope));
        const usedBy = (symbol, writesOnly) => (uses.get(symbol) ?? []).some(use => within(other, use.node) && (!writesOnly || use.write)) || named(other, symbol.name, writesOnly, false);
        for (const symbol of unit.writeSet) {
            const declaration = unique(symbol);
            if (!declaration || !within(own, declaration))
                return false;
            const blockScoped = compiler.isVariableDeclaration(declaration) && compiler.isVariableDeclarationList(declaration.parent) && (declaration.parent.flags & compiler.NodeFlags.BlockScoped) !== 0 && !disposable(declaration.parent) || compiler.isClassDeclaration(declaration);
            if (!blockScoped || (uses.get(symbol) ?? []).some(use => context(use.node) !== context(declaration)) || named(scope, symbol.name, false, true) || usedBy(symbol, false))
                return false;
        }
        for (const symbol of unit.readSet) {
            const declaration = unique(symbol);
            if (!declaration || context(declaration) !== scope || (uses.get(symbol) ?? []).some(use => use.write && context(use.node) !== scope) || named(scope, symbol.name, true, true) || usedBy(symbol, true))
                return false;
        }
        return true;
    };
    /** Why units a < b of one list are ordered (ADR-014); empty when they commute. A comment
     * orders only conservatively; otherwise each barrier side, a shared global creation order
     * and each RAW/WAR/WAW conflict is a reason of its own. */
    const hoisted = (unit) => unit.kind === 'position-free' && unit.reason === 'hoisted-function-declaration';
    /** ADR-025: two statements on the list's own objects are ordered only by an object conflict or
     * a possible throw; one that cannot throw commutes with a local write (no binding is shared:
     * its callees run in other function contexts), unless it calls external code and the write reads
     * a binding of another context (ADR-040). Null when the rule does not apply. */
    const objectOrder = (a, b) => {
        if (a.footprint && b.footprint)
            return footprintConflicts(a.footprint, b.footprint);
        const [object, other] = a.footprint ? [a.footprint, b] : b.footprint ? [b.footprint, a] : [];
        if (!object || other.kind !== 'local-write')
            return null;
        if (object.mayThrow)
            return ['may-throw'];
        // ADR-040: external code may write a binding declared outside this function, which the local write reads.
        const outside = (symbol) => { const declaration = unique(symbol); return !declaration || !other.node || context(declaration) !== context(other.node); };
        return object.external && [...other.readSet].some(outside) ? ['external-call-order'] : [];
    };
    const pairReasons = (a, b) => {
        if (a.reason === 'free-comment' || b.reason === 'free-comment')
            return [];
        if (a.kind === 'opaque' || b.kind === 'opaque')
            return ['opaque-row'];
        const found = [];
        const objects = objectOrder(a, b);
        if (objects)
            found.push(...objects);
        else if (a.kind !== 'position-free' && b.kind !== 'position-free' && !commutes(a, b) && !commutes(b, a))
            for (const unit of [a, b])
                if (unit.kind === 'barrier')
                    found.push(unit.code ?? 'projection-unspecified');
        // v11 (ADR-020): a hoisted function's global key counts only if the program reflects keys; vars and emitted vars keep their order.
        if (a.global && b.global && (options.reflectedKeys || !hoisted(a) && !hoisted(b)))
            found.push('script-global-order');
        if (meets(a.writeSet, b.readSet))
            found.push('read-after-write');
        if (meets(a.readSet, b.writeSet))
            found.push('write-after-read');
        if (meets(a.writeSet, b.writeSet))
            found.push('write-after-write');
        return found;
    };
    const add = (before, after, code, essential = false) => {
        if (before >= after)
            return;
        if (!entries.has(after))
            entries.set(after, new Set());
        entries.get(after).add(before);
        reasons.set(after, [...reasons.get(after) ?? [], { before, code }]);
        if (essential) {
            if (!protectedInputs.has(after))
                protectedInputs.set(after, new Set());
            protectedInputs.get(after).add(before);
        }
    };
    /** A statement list whose var/function declarations become global-object properties (classic script). */
    const scriptGlobal = (list) => {
        if (compiler.isExternalModule(file))
            return false;
        for (let current = list; current && !compiler.isSourceFile(current); current = current.parent)
            if (functionLike(current) || compiler.isModuleBlock(current) || compiler.isClassStaticBlockDeclaration(current) || compiler.isClassLike(current))
                return false;
        return true;
    };
    /** A namespace that only declares types emits nothing; any other statement counts as instantiating it. */
    const typeOnly = (declaration) => {
        const body = declaration.body;
        if (body && compiler.isModuleDeclaration(body))
            return typeOnly(body);
        return !body || compiler.isModuleBlock(body) && body.statements.every(statement => compiler.isInterfaceDeclaration(statement) || compiler.isTypeAliasDeclaration(statement) || modifiers(statement).includes(S.DeclareKeyword) || compiler.isModuleDeclaration(statement) && typeOnly(statement));
    };
    /** TypeScript emits an enum, an instantiated namespace and an import alias as a `var` binding. */
    const emitsVar = (node) => (compiler.isEnumDeclaration(node) || compiler.isModuleDeclaration(node) && compiler.isIdentifier(node.name) && !typeOnly(node) || compiler.isImportEqualsDeclaration(node) && !node.isTypeOnly) && !modifiers(node).includes(S.DeclareKeyword);
    /** A function implementation, var names, Annex B block functions or TypeScript
     * `var`-emitting declarations outside nested functions. */
    const declaresGlobal = (statement) => {
        if (modifiers(statement).includes(S.DeclareKeyword))
            return false;
        if (compiler.isFunctionDeclaration(statement))
            return !!statement.body;
        if (emitsVar(statement))
            return true;
        let found = false;
        const scan = (node) => {
            if (emitsVar(node)) {
                found = true;
                return;
            }
            if (found || functionLike(node) || compiler.isClassLike(node) || compiler.isModuleDeclaration(node)) {
                if (compiler.isFunctionDeclaration(node))
                    found = true;
                return;
            }
            if (compiler.isVariableDeclarationList(node) && !(node.flags & compiler.NodeFlags.BlockScoped))
                found = true;
            compiler.forEachChild(node, scan);
        };
        compiler.forEachChild(statement, scan);
        if (compiler.isVariableStatement(statement) && !(statement.declarationList.flags & compiler.NodeFlags.BlockScoped))
            found = true;
        return found;
    };
    function visit(node) {
        if (compiler.isSourceFile(node) || compiler.isBlock(node) || compiler.isModuleBlock(node)) {
            const sourceFile = compiler.isSourceFile(node), summaries = sourceFile ? scriptUnits : [];
            for (const statement of node.statements)
                summaries.push(summary(statement, node));
            // ADR-025: in a function-context list, statements on the list's own objects get footprints.
            if (compiler.isBlock(node) && context(node) !== file) {
                const footprints = objectFootprints(node.statements, file, compiler, checker, { primitive: expr => primitive(expr, new Set()), enumeratedKeys: options.enumeratedKeys ?? true });
                summaries.forEach((unit, i) => {
                    const statement = node.statements[i], footprint = footprints.get(statement);
                    // ADR-028: an if/else owns its first and last rows; its branch rows follow their own block.
                    const owns = ownsCompound(statement);
                    if (unit.kind !== 'barrier' || !footprint || !owns)
                        return;
                    unit.footprint = footprint;
                    // Its binding inputs: every identifier it reads, protected like a pure unit's (TDZ and value).
                    const inputs = (current) => {
                        if (compiler.isIdentifier(current) && !(compiler.isPropertyAccessExpression(current.parent) && current.parent.name === current) && !(compiler.isVariableDeclaration(current.parent) && current.parent.name === current)) {
                            const symbol = checker.getSymbolAtLocation(current), found = binding(current, symbol);
                            if (symbol)
                                unit.readSet.add(symbol);
                            if (found?.row != null && found.row < unit.first)
                                unit.reads.add(found.row);
                        }
                        compiler.forEachChild(current, inputs);
                    };
                    inputs(statement);
                    if (compiler.isVariableStatement(statement)) {
                        const declared = statement.declarationList.declarations[0].name, symbol = checker.getSymbolAtLocation(declared);
                        if (symbol)
                            unit.writeSet.add(symbol);
                    }
                });
            }
            if (scriptGlobal(node))
                summaries.forEach((unit, i) => { if (declaresGlobal(node.statements[i]))
                    unit.global = true; });
            // A physical row containing multiple statements/boundaries is indivisible.
            const separate = summaries.every((unit, i) => !i || summaries[i - 1].last < unit.first) && (!summaries.length || sourceFile || summaries[0].first > line(node) && summaries.at(-1).last < end(node));
            if (separate) {
                // A TS overload signature must directly precede the next signature or the
                // implementation (TS2389/TS2391): the whole group is one barrier unit.
                const grouped = [];
                summaries.forEach((unit, i) => {
                    const previous = node.statements[i - 1], current = node.statements[i];
                    if (previous && compiler.isFunctionDeclaration(previous) && !previous.body && compiler.isFunctionDeclaration(current) && !!previous.name && previous.name.text === current.name?.text) {
                        const head = grouped.pop();
                        grouped.push({ ...unit, first: head.first, start: head.start, kind: 'barrier', reason: 'overload-group', code: 'overload-group' });
                    }
                    else
                        grouped.push(unit);
                });
                // ADR-025: a row holding one complete comment is free inside its list. Other non-statement
                // rows between statements stay opaque; before the first and after the last statement they
                // keep the projection's source order.
                const complete = [];
                const gap = (from, to, between) => {
                    const free = freeCommentRows(file, compiler, from, to);
                    for (let row = from; row <= to; row++) {
                        if (!physical[row]?.trim())
                            continue;
                        if (free.has(row))
                            complete.push({ first: row, last: row, start: -1, kind: 'position-free', reason: 'free-comment', reads: new Set(), readSet: new Set(), writeSet: new Set() });
                        else if (between)
                            complete.push({ first: row, last: row, start: -1, kind: 'opaque', reason: 'non-statement-row', reads: new Set(), readSet: new Set(), writeSet: new Set() });
                    }
                };
                const inner = sourceFile ? 0 : line(node) + 1, outer = sourceFile ? physical.length - 1 : end(node) - 1;
                if (!grouped.length)
                    gap(inner, outer, false);
                for (let i = 0; i < grouped.length; i++) {
                    gap(i ? grouped[i - 1].last + 1 : inner, grouped[i].first - 1, i > 0);
                    complete.push(grouped[i]);
                }
                if (grouped.length)
                    gap(grouped.at(-1).last + 1, outer, false);
                for (const unit of complete) {
                    units.push({ first: unit.first, last: unit.last, kind: unit.kind, reason: unit.reason });
                    entries.set(unit.first, new Set());
                    reasons.delete(unit.first);
                    for (const row of unit.reads)
                        add(row, unit.first, 'binding-input', true);
                    if (!sourceFile && !entries.get(unit.first).size)
                        add(line(node), unit.first, 'block-open');
                }
                for (let i = 0; i < complete.length; i++)
                    for (let j = i + 1; j < complete.length; j++) {
                        const a = complete[i], b = complete[j];
                        for (const code of pairReasons(a, b))
                            add(a.last, b.first, code);
                    }
            }
        }
        compiler.forEachChild(node, visit);
    }
    visit(file);
    return { entries: [...entries].map(([row, after]) => ({ row, after: [...after], reasons: reasons.get(row) ?? [] })), protectedInputs, units };
}
//# sourceMappingURL=statement-ordering.js.map