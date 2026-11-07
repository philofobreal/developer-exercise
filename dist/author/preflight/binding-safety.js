const MAX_CALL_DEPTH = 8, MAX_WORK = 400_000;
export function bindingSafety(compiler, source, language) {
    const S = compiler.SyntaxKind;
    const fileName = 'reference.' + (language === 'typescript' ? 'ts' : 'js');
    const file = compiler.createSourceFile(fileName, source, compiler.ScriptTarget.ES2022, true, language === 'typescript' ? compiler.ScriptKind.TS : compiler.ScriptKind.JS);
    const host = {
        getSourceFile: name => name === fileName ? file : undefined, getDefaultLibFileName: () => 'lib.d.ts', getDefaultLibLocation: () => '', writeFile: () => undefined,
        getCurrentDirectory: () => '', getDirectories: () => [], getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
        fileExists: name => name === fileName, readFile: () => undefined
    };
    const checker = compiler.createProgram([fileName], { noLib: true, noResolve: true, allowJs: true, types: [], target: compiler.ScriptTarget.ES2022 }, host).getTypeChecker();
    let work = 0;
    const spend = () => ++work > MAX_WORK;
    const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    // ── Identifiers that evaluate (read or write) a value binding, with their symbol ──
    const isTypePosition = (node) => { for (let n = node.parent; n && n !== file; n = n.parent) {
        if (compiler.isTypeNode(n) && !compiler.isExpressionWithTypeArguments(n))
            return true;
        if (compiler.isStatement(n))
            return false;
    } return false; };
    const isValueReference = (id) => {
        const p = id.parent;
        if (compiler.isPropertyAccessExpression(p) && p.name === id)
            return false;
        if ((compiler.isPropertyAssignment(p) || compiler.isMethodDeclaration(p) || compiler.isPropertyDeclaration(p) || compiler.isGetAccessor(p) || compiler.isSetAccessor(p) || compiler.isEnumMember(p) || compiler.isPropertySignature(p) || compiler.isMethodSignature(p)) && p.name === id)
            return false;
        if ((compiler.isVariableDeclaration(p) || compiler.isFunctionDeclaration(p) || compiler.isClassDeclaration(p) || compiler.isClassExpression(p) || compiler.isFunctionExpression(p) || compiler.isParameter(p) || compiler.isBindingElement(p) || compiler.isInterfaceDeclaration(p) || compiler.isTypeAliasDeclaration(p) || compiler.isEnumDeclaration(p) || compiler.isModuleDeclaration(p)) && p.name === id)
            return false;
        if (compiler.isLabeledStatement(p) || compiler.isBreakOrContinueStatement(p) || compiler.isImportSpecifier(p) || compiler.isImportClause(p) || compiler.isNamespaceImport(p) || compiler.isExportSpecifier(p) || compiler.isQualifiedName(p) || compiler.isMetaProperty(p))
            return false;
        return !isTypePosition(id);
    };
    const symbolOf = (id) => compiler.isShorthandPropertyAssignment(id.parent) && id.parent.name === id ? checker.getShorthandAssignmentValueSymbol(id.parent) : checker.getSymbolAtLocation(id);
    const references = new Map();
    const collect = (node) => {
        if (compiler.isIdentifier(node) && isValueReference(node)) {
            const symbol = symbolOf(node);
            if (symbol) {
                const list = references.get(symbol) ?? [];
                list.push(node);
                references.set(symbol, list);
            }
        }
        compiler.forEachChild(node, collect);
    };
    collect(file);
    const assigned = (symbol) => (references.get(symbol) ?? []).some(id => {
        const p = id.parent;
        return compiler.isBinaryExpression(p) && p.left === id && p.operatorToken.kind >= S.FirstAssignment && p.operatorToken.kind <= S.LastAssignment
            || (compiler.isPrefixUnaryExpression(p) || compiler.isPostfixUnaryExpression(p)) && (p.operator === S.PlusPlusToken || p.operator === S.MinusMinusToken);
    });
    // ── Unconditional paths ──
    const abrupt = (statement) => compiler.isReturnStatement(statement) || compiler.isThrowStatement(statement) || compiler.isBreakStatement(statement) || compiler.isContinueStatement(statement);
    const reachable = (statement, block) => {
        for (const sibling of block.statements) {
            if (sibling === statement)
                return true;
            if (abrupt(sibling))
                return false;
        }
        return false;
    };
    const SHORT_CIRCUIT = new Set([S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken, S.AmpersandAmpersandEqualsToken, S.BarBarEqualsToken, S.QuestionQuestionEqualsToken]);
    const optional = (node) => (node.flags & compiler.NodeFlags.OptionalChain) !== 0;
    /** Whether evaluating `parent` certainly evaluates `child` (an allowlist; anything unknown is conditional). */
    const transparent = (child, parent) => {
        switch (parent.kind) {
            case S.ExpressionStatement:
            case S.ReturnStatement:
            case S.ThrowStatement:
            case S.ParenthesizedExpression:
            case S.ArrayLiteralExpression:
            case S.ObjectLiteralExpression:
            case S.ShorthandPropertyAssignment:
            case S.SpreadElement:
            case S.SpreadAssignment:
            case S.TemplateExpression:
            case S.TemplateSpan:
            case S.TaggedTemplateExpression:
            case S.PrefixUnaryExpression:
            case S.PostfixUnaryExpression:
            case S.TypeOfExpression:
            case S.VoidExpression:
            case S.DeleteExpression:
            case S.AwaitExpression:
            case S.AsExpression:
            case S.SatisfiesExpression:
            case S.NonNullExpression:
            case S.TypeAssertionExpression:
            case S.VariableStatement:
            case S.VariableDeclarationList:
            case S.LabeledStatement:
            case S.NewExpression:
            case S.ExportAssignment:
            case S.HeritageClause:
            case S.ExpressionWithTypeArguments:
                return true;
            case S.CallExpression:
            case S.PropertyAccessExpression:
            case S.ElementAccessExpression:
                return !optional(parent) || child === parent.expression;
            case S.PropertyAssignment: return child === parent.initializer;
            case S.VariableDeclaration: return child === parent.initializer;
            case S.BinaryExpression: return !SHORT_CIRCUIT.has(parent.operatorToken.kind) || child === parent.left;
            case S.ConditionalExpression: return child === parent.condition;
            case S.IfStatement: return child === parent.expression;
            case S.SwitchStatement: return child === parent.expression;
            case S.WhileStatement: return child === parent.expression;
            case S.ForOfStatement:
            case S.ForInStatement: return child === parent.expression;
            case S.ForStatement: return child === parent.initializer;
            case S.ClassDeclaration:
            case S.ClassExpression: return compiler.isHeritageClause(child);
            case S.Block: return !compiler.isFunctionLike(parent.parent) && reachable(child, parent);
            default: return false;
        }
    };
    /** The statement of `block` that unconditionally evaluates `node`, or undefined. */
    const statementIn = (node, block) => {
        let child = node;
        for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
            if (spend())
                return undefined;
            if (parent === block)
                return reachable(child, block) ? child : undefined;
            if (!transparent(child, parent))
                return undefined;
        }
        return undefined;
    };
    const declarations = [];
    const blockOf = (statement) => compiler.isSourceFile(statement.parent) || compiler.isBlock(statement.parent) ? statement.parent : undefined;
    const findDeclarations = (node) => {
        if (compiler.isVariableStatement(node) && (node.declarationList.flags & (compiler.NodeFlags.Let | compiler.NodeFlags.Const)) && !(node.declarationList.flags & compiler.NodeFlags.Using)) {
            const block = blockOf(node);
            if (block)
                for (const declaration of node.declarationList.declarations)
                    if (compiler.isIdentifier(declaration.name)) {
                        const symbol = checker.getSymbolAtLocation(declaration.name);
                        if (symbol)
                            declarations.push({ symbol, name: declaration.name.text, block, statement: node, node: declaration });
                    }
        }
        else if (compiler.isClassDeclaration(node) && node.name && !compiler.getModifiers(node)?.some(m => m.kind === S.DeclareKeyword)) {
            const block = blockOf(node), symbol = checker.getSymbolAtLocation(node.name);
            if (block && symbol)
                declarations.push({ symbol, name: node.name.text, block, statement: node, node });
        }
        compiler.forEachChild(node, findDeclarations);
    };
    findDeclarations(file);
    /** Whether an access inside `statement` happens before `declaration` is initialized. */
    const before = (access, statement, declaration) => {
        const index = declaration.block.statements.indexOf(statement), own = declaration.block.statements.indexOf(declaration.statement);
        if (index < own)
            return true;
        if (index > own)
            return false;
        if (compiler.isClassDeclaration(declaration.node))
            return (declaration.node.heritageClauses ?? []).some(clause => access.pos >= clause.pos && access.end <= clause.end);
        const declarators = declaration.statement.declarationList.declarations, target = declarators.indexOf(declaration.node);
        const at = declarators.findIndex(declarator => !!declarator.initializer && access.pos >= declarator.initializer.pos && access.end <= declarator.initializer.end);
        return at >= 0 && at <= target;
    };
    const strip = (node) => compiler.isParenthesizedExpression(node) ? strip(node.expression) : node;
    const callee = (call) => {
        if (optional(call))
            return undefined;
        const target = strip(call.expression);
        if (compiler.isFunctionExpression(target) || compiler.isArrowFunction(target))
            return target;
        if (!compiler.isIdentifier(target))
            return undefined;
        const symbol = checker.getSymbolAtLocation(target);
        if (!symbol || assigned(symbol))
            return undefined;
        const bodies = (symbol.declarations ?? []).filter((d) => compiler.isFunctionDeclaration(d) && !!d.body);
        if (bodies.length === 1 && symbol.declarations?.every(d => compiler.isFunctionDeclaration(d)))
            return bodies[0];
        const variable = symbol.valueDeclaration;
        if (variable && compiler.isVariableDeclaration(variable) && variable.initializer && (variable.parent.flags & compiler.NodeFlags.Const)) {
            const init = strip(variable.initializer);
            if ((compiler.isArrowFunction(init) || compiler.isFunctionExpression(init)) && variable.end <= call.pos)
                return init;
        }
        return undefined;
    };
    /** Unconditional calls and accesses of `symbol` evaluated by the subtree of `root` relative to `block`. */
    const unconditionalNodes = (root, block, wanted) => {
        const found = [];
        const visit = (node) => {
            if (spend())
                return;
            if (wanted(node) && statementIn(node, block))
                found.push(node);
            if (compiler.isFunctionLike(node) && node !== root)
                return;
            compiler.forEachChild(node, visit);
        };
        visit(root);
        return found;
    };
    /** The first access to the declaration's binding that a call of `fn` certainly reaches. A function that
     * contains the declaration creates a fresh binding on every call (recursion included), so a call path
     * never reaches it: an access before it within that call is the direct case, found on its own. */
    const reaches = (fn, declaration, depth, seen) => {
        const symbol = declaration.symbol;
        if (depth > MAX_CALL_DEPTH || seen.has(fn) || spend())
            return undefined;
        if (declaration.node.pos >= fn.pos && declaration.node.end <= fn.end)
            return undefined;
        seen.add(fn);
        const body = fn.body;
        if (!body)
            return undefined;
        if (!compiler.isBlock(body)) {
            // A concise arrow body is one unconditionally evaluated expression.
            const direct = unconditionalExpression(body, symbol);
            if (direct)
                return direct;
            for (const call of callsIn(body)) {
                const target = callee(call);
                const hit = target && reaches(target, declaration, depth + 1, seen);
                if (hit)
                    return hit;
            }
            return undefined;
        }
        for (const statement of body.statements) {
            if (spend())
                return undefined;
            const access = unconditionalNodes(statement, body, node => compiler.isIdentifier(node) && symbolOf(node) === symbol && isValueReference(node))[0];
            if (access)
                return access;
            for (const call of unconditionalNodes(statement, body, compiler.isCallExpression)) {
                const target = callee(call);
                const hit = target && reaches(target, declaration, depth + 1, seen);
                if (hit)
                    return hit;
            }
            if (abrupt(statement))
                return undefined;
        }
        return undefined;
    };
    /** For a concise arrow body: the transparent path from a node up to the body expression itself. */
    const transparentTo = (node, top) => { for (let child = node, parent = node.parent; child !== top; child = parent, parent = parent.parent) {
        if (!parent || spend() || !transparent(child, parent))
            return false;
    } return true; };
    const unconditionalExpression = (expression, symbol) => {
        let hit;
        const visit = (node) => { if (hit || spend())
            return; if (compiler.isIdentifier(node) && isValueReference(node) && symbolOf(node) === symbol && transparentTo(node, expression)) {
            hit = node;
            return;
        } if (compiler.isFunctionLike(node))
            return; compiler.forEachChild(node, visit); };
        visit(expression);
        return hit;
    };
    const callsIn = (expression) => {
        const calls = [];
        const visit = (node) => { if (spend())
            return; if (compiler.isCallExpression(node) && transparentTo(node, expression))
            calls.push(node); if (compiler.isFunctionLike(node))
            return; compiler.forEachChild(node, visit); };
        visit(expression);
        return calls;
    };
    // ── Findings ──
    const findings = [];
    const reported = new Set();
    const report = (finding) => { const key = `${finding.line}:${finding.binding}`; if (!reported.has(key)) {
        reported.add(key);
        findings.push(finding);
    } };
    for (const declaration of declarations) {
        if (work > MAX_WORK)
            break;
        const where = lineOf(declaration.node);
        for (const access of references.get(declaration.symbol) ?? []) {
            if (access === declaration.node.name)
                continue;
            const statement = statementIn(access, declaration.block);
            if (statement && before(access, statement, declaration))
                report({ line: lineOf(access), code: 'BS001', certainty: 'definite', origin: 'runtime-order', binding: declaration.name, message: `A(z) „${declaration.name}” a deklarációja (${where}. sor) előtt kerül kiolvasásra vagy írásra; ez futáskor biztosan ReferenceError (TDZ).` });
        }
        const own = declaration.block.statements.indexOf(declaration.statement);
        for (const statement of declaration.block.statements.slice(0, own + 1)) {
            if (work > MAX_WORK)
                break;
            for (const call of unconditionalNodes(statement, declaration.block, compiler.isCallExpression)) {
                if (!before(call, statement, declaration))
                    continue;
                const target = callee(call), access = target && reaches(target, declaration, 1, new Set());
                if (access)
                    report({ line: lineOf(call), code: 'BS002', certainty: 'definite', origin: 'runtime-order', binding: declaration.name, message: `A(z) ${line(call)} hívás olyan függvényt futtat, amely a(z) „${declaration.name}” értékét a ${lineOf(access)}. sorban a deklarációja (${where}. sor) előtt használja; ez futáskor biztosan ReferenceError (TDZ).` });
            }
            if (abrupt(statement))
                break;
        }
    }
    function line(call) { const text = call.expression.getText(file); return `„${text.length > 40 ? text.slice(0, 37) + '…' : text}()”`; }
    findings.sort((a, b) => a.line - b.line);
    return { completeness: work > MAX_WORK ? 'budget-exceeded' : 'within-supported-scope', findings };
}
//# sourceMappingURL=binding-safety.js.map