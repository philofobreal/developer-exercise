export function referenceFacts(compiler, source, language, budget = 400_000) {
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
    const spend = () => ++work > budget;
    const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
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
    /** Inside an assignment target (`[a, b] = …`, `({a} = …)`, `for (a of …)`)? */
    const inTarget = (node) => {
        let child = node;
        for (let p = node.parent; p; child = p, p = p.parent) {
            if (compiler.isBinaryExpression(p))
                return p.left === child && p.operatorToken.kind >= S.FirstAssignment && p.operatorToken.kind <= S.LastAssignment;
            if (compiler.isForInStatement(p) || compiler.isForOfStatement(p))
                return p.initializer === child;
            if (compiler.isPrefixUnaryExpression(p) || compiler.isPostfixUnaryExpression(p))
                return p.operator === S.PlusPlusToken || p.operator === S.MinusMinusToken;
            if (!(compiler.isParenthesizedExpression(p) || compiler.isArrayLiteralExpression(p) || compiler.isObjectLiteralExpression(p) || compiler.isPropertyAssignment(p) || compiler.isShorthandPropertyAssignment(p) || compiler.isSpreadElement(p) || compiler.isSpreadAssignment(p) || compiler.isNonNullExpression(p) || compiler.isAsExpression(p)))
                return false;
            if (compiler.isPropertyAssignment(p) && p.name === child)
                return false;
        }
        return false;
    };
    const isWrite = (id) => inTarget(id);
    const abrupt = (statement) => compiler.isReturnStatement(statement) || compiler.isThrowStatement(statement) || compiler.isBreakStatement(statement) || compiler.isContinueStatement(statement);
    const blockOf = (statement) => compiler.isSourceFile(statement.parent) || compiler.isBlock(statement.parent) ? statement.parent : undefined;
    const reachable = (statement, block) => { for (const sibling of block.statements) {
        if (sibling === statement)
            return true;
        if (abrupt(sibling))
            return false;
    } return false; };
    const exits = new Map();
    const mayExit = (statement) => {
        const known = exits.get(statement);
        if (known !== undefined)
            return known;
        let found = false;
        const visit = (node) => { if (found)
            return; if (spend()) {
            found = true;
            return;
        } if (abrupt(node)) {
            found = true;
            return;
        } if (compiler.isFunctionLike(node) || compiler.isClassLike(node))
            return; compiler.forEachChild(node, visit); };
        visit(statement);
        exits.set(statement, found);
        return found;
    };
    /** No earlier sibling of `statement` in a nested block may leave the flow. */
    const clearBefore = (statement, block) => { for (const sibling of block.statements) {
        if (sibling === statement)
            return true;
        if (mayExit(sibling))
            return false;
    } return false; };
    const SHORT_CIRCUIT = new Set([S.AmpersandAmpersandToken, S.BarBarToken, S.QuestionQuestionToken, S.AmpersandAmpersandEqualsToken, S.BarBarEqualsToken, S.QuestionQuestionEqualsToken]);
    const optional = (node) => (node.flags & compiler.NodeFlags.OptionalChain) !== 0;
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
            case S.Block: return !compiler.isFunctionLike(parent.parent) && clearBefore(child, parent);
            default: return false;
        }
    };
    const transparentTo = (node, root) => {
        for (let child = node, parent = node.parent; child !== root; child = parent, parent = parent.parent)
            if (!parent || spend() || !transparent(child, parent))
                return false;
        return true;
    };
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
    const literallyTrue = (expression) => !expression || expression.kind === S.TrueKeyword;
    const mustEvaluate = (statement, wanted) => {
        let direct;
        const visit = (node) => {
            if (direct || spend())
                return;
            if (wanted(node) && transparentTo(node, statement)) {
                direct = node;
                return;
            }
            if (compiler.isFunctionLike(node) && node !== statement)
                return;
            compiler.forEachChild(node, visit);
        };
        visit(statement);
        if (direct)
            return [direct];
        if (spend())
            return undefined;
        if (compiler.isIfStatement(statement) && statement.elseStatement) {
            const then = mustEvaluate(statement.thenStatement, wanted), otherwise = then && mustEvaluate(statement.elseStatement, wanted);
            return then && otherwise ? [...then, ...otherwise] : undefined;
        }
        if (compiler.isBlock(statement)) {
            for (const inner of statement.statements) {
                const hit = mustEvaluate(inner, wanted);
                if (hit)
                    return hit;
                if (mayExit(inner))
                    return undefined;
            }
            return undefined;
        }
        // A loop body that certainly runs once: `do … while`, and `while (true)` / `for (…;;…)`.
        if (compiler.isDoStatement(statement))
            return mustEvaluate(statement.statement, wanted);
        if (compiler.isWhileStatement(statement) && literallyTrue(statement.expression))
            return mustEvaluate(statement.statement, wanted);
        if (compiler.isForStatement(statement) && literallyTrue(statement.condition))
            return mustEvaluate(statement.statement, wanted);
        if (compiler.isLabeledStatement(statement))
            return mustEvaluate(statement.statement, wanted);
        return undefined;
    };
    return { compiler, file, checker, lineOf, spend, spent: () => work > budget, references, isValueReference, symbolOf, isWrite, blockOf, reachable, mayExit, transparent, transparentTo, statementIn, mustEvaluate };
}
//# sourceMappingURL=flow-paths.js.map