const join = (a, b) => !a || !b ? null : a === 'number' && b === 'number' ? 'number' : 'literal';
/** Timers that compile a string argument as code. */
const TIMERS = new Set(['setTimeout', 'setInterval', 'setImmediate']);
/** Methods that call or wrap their receiver itself rather than a spelled function. */
const INVOKERS = new Set(['call', 'apply', 'bind']);
/** True when the program may use, beyond comparing or computing with it, a value it read by a
 * property name its source does not spell out. */
export function readsUnspelledNames(file, compiler) {
    const k = compiler.SyntaxKind;
    const numeric = new Set([k.MinusToken, k.AsteriskToken, k.SlashToken, k.PercentToken, k.AsteriskAsteriskToken, k.AmpersandToken, k.BarToken, k.CaretToken, k.LessThanLessThanToken, k.GreaterThanGreaterThanToken, k.GreaterThanGreaterThanGreaterThanToken]);
    const numericAssignment = new Set([k.MinusEqualsToken, k.AsteriskEqualsToken, k.SlashEqualsToken, k.PercentEqualsToken, k.AsteriskAsteriskEqualsToken, k.AmpersandEqualsToken, k.BarEqualsToken, k.CaretEqualsToken, k.LessThanLessThanEqualsToken, k.GreaterThanGreaterThanEqualsToken, k.GreaterThanGreaterThanGreaterThanEqualsToken]);
    /** Operators whose operands are only compared, converted or computed with. */
    const consuming = new Set([...numeric, k.PlusToken, k.LessThanToken, k.GreaterThanToken, k.LessThanEqualsToken, k.GreaterThanEqualsToken, k.EqualsEqualsToken, k.EqualsEqualsEqualsToken, k.ExclamationEqualsToken, k.ExclamationEqualsEqualsToken, k.InKeyword, k.InstanceOfKeyword]);
    const assignment = (operator) => operator >= k.FirstAssignment && operator <= k.LastAssignment;
    const transparent = (node) => compiler.isParenthesizedExpression(node) || compiler.isAsExpression(node) || compiler.isSatisfiesExpression(node) || compiler.isNonNullExpression(node) || compiler.isTypeAssertionExpression(node);
    // Every value a name is given and every read of it, anywhere in the file. `null`: unknown value.
    const values = new Map();
    const reads = new Map();
    const give = (name, value) => { const list = values.get(name) ?? []; list.push(value); values.set(name, list); };
    const bound = (node) => compiler.isIdentifier(node) ? [node.text] : compiler.isShorthandPropertyAssignment(node) ? [node.name.text] : compiler.isPropertyAccessExpression(node) || compiler.isElementAccessExpression(node) ? [] : (() => { const all = []; compiler.forEachChild(node, child => { if (!compiler.isComputedPropertyName(child) && !(compiler.isBindingElement(node) && child === node.propertyName) && !(compiler.isPropertyAssignment(node) && child === node.name))
        all.push(...bound(child)); }); return all; })();
    const unknown = (target) => { for (const name of bound(target))
        give(name, null); };
    /** The pattern contains a target that is not a plain name: a property or element write. */
    const storesInto = (target) => compiler.isPropertyAccessExpression(target) || compiler.isElementAccessExpression(target) || (!compiler.isIdentifier(target) && !compiler.isComputedPropertyName(target) && !!compiler.forEachChild(target, child => child !== target.propertyName && child !== (compiler.isPropertyAssignment(target) ? target.name : undefined) && storesInto(child) || undefined));
    const declarationName = (node) => {
        const parent = node.parent;
        if (compiler.isPropertyAccessExpression(parent))
            return parent.name === node;
        if (compiler.isQualifiedName(parent))
            return true;
        if (compiler.isBindingElement(parent))
            return parent.name === node || parent.propertyName === node;
        if (compiler.isPropertyAssignment(parent))
            return parent.name === node;
        if (compiler.isLabeledStatement(parent) || compiler.isBreakOrContinueStatement(parent))
            return true;
        return (compiler.isVariableDeclaration(parent) || compiler.isParameter(parent) || compiler.isFunctionLike(parent) || compiler.isClassLike(parent) || compiler.isEnumDeclaration(parent) || compiler.isEnumMember(parent) || compiler.isPropertyDeclaration(parent) || compiler.isPropertySignature(parent) || compiler.isInterfaceDeclaration(parent) || compiler.isTypeAliasDeclaration(parent) || compiler.isModuleDeclaration(parent) || compiler.isTypeParameterDeclaration(parent) || compiler.isImportClause(parent) || compiler.isImportSpecifier(parent) || compiler.isExportSpecifier(parent) || compiler.isNamespaceImport(parent) || compiler.isImportEqualsDeclaration(parent) || compiler.isNamespaceExport(parent)) && parent.name === node;
    };
    const candidates = [], computedBindings = [], assignedKeys = [];
    const taintedNames = [];
    let escapes = false;
    const visit = (node) => {
        if (escapes || compiler.isTypeNode(node))
            return;
        if (compiler.isIdentifier(node) && !declarationName(node)) {
            const list = reads.get(node.text) ?? [];
            list.push(node);
            reads.set(node.text, list);
        }
        if (compiler.isVariableDeclaration(node)) {
            const loopHead = compiler.isVariableDeclarationList(node.parent) && (compiler.isForOfStatement(node.parent.parent) || compiler.isForInStatement(node.parent.parent));
            if (compiler.isIdentifier(node.name) && !loopHead)
                give(node.name.text, node.initializer ?? null);
            else
                unknown(node.name);
        }
        else if (compiler.isParameter(node) || compiler.isBindingElement(node) && !compiler.isVariableDeclaration(node.parent.parent))
            unknown(node.name);
        else if ((compiler.isFunctionDeclaration(node) || compiler.isClassDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isClassExpression(node) || compiler.isEnumDeclaration(node) || compiler.isModuleDeclaration(node) || compiler.isImportClause(node) || compiler.isImportSpecifier(node) || compiler.isNamespaceImport(node) || compiler.isImportEqualsDeclaration(node)) && node.name && compiler.isIdentifier(node.name))
            give(node.name.text, null);
        else if (compiler.isBinaryExpression(node) && assignment(node.operatorToken.kind)) {
            const operator = node.operatorToken.kind;
            if (!compiler.isIdentifier(node.left))
                unknown(node.left);
            else if (operator === k.EqualsToken)
                give(node.left.text, node.right);
            else if (numericAssignment.has(operator))
                give(node.left.text, 'number');
            else
                give(node.left.text, operator === k.PlusEqualsToken ? node : null);
        }
        else if ((compiler.isPrefixUnaryExpression(node) || compiler.isPostfixUnaryExpression(node)) && (node.operator === k.PlusPlusToken || node.operator === k.MinusMinusToken) && compiler.isIdentifier(node.operand))
            give(node.operand.text, 'number');
        else if ((compiler.isForOfStatement(node) || compiler.isForInStatement(node)) && !compiler.isVariableDeclarationList(node.initializer))
            unknown(node.initializer);
        else if (compiler.isCatchClause(node) && node.variableDeclaration)
            unknown(node.variableDeclaration.name);
        // Values read by a name the source may not spell out, and timers that run a string.
        if (compiler.isElementAccessExpression(node) || compiler.isPropertyAccessExpression(node) && node.name.text === 'constructor')
            candidates.push(node);
        else if (compiler.isComputedPropertyName(node) && compiler.isBindingElement(node.parent))
            computedBindings.push(node);
        else if (compiler.isComputedPropertyName(node) && compiler.isPropertyAssignment(node.parent) && destructuringTarget(node.parent))
            assignedKeys.push(node.expression);
        else if (compiler.isCallExpression(node) && compiler.isIdentifier(node.expression) && TIMERS.has(node.expression.text) && !(node.arguments[0] && (compiler.isArrowFunction(node.arguments[0]) || compiler.isFunctionExpression(node.arguments[0]))))
            escapes = true;
        compiler.forEachChild(node, visit);
    };
    /** A property of an object literal that is the target of a destructuring assignment. */
    const destructuringTarget = (node) => {
        let current = node;
        while (compiler.isPropertyAssignment(current) || compiler.isShorthandPropertyAssignment(current) || compiler.isObjectLiteralExpression(current) || compiler.isArrayLiteralExpression(current) || compiler.isSpreadAssignment(current) || compiler.isSpreadElement(current)) {
            const parent = current.parent;
            if (compiler.isBinaryExpression(parent) && parent.left === current && assignment(parent.operatorToken.kind))
                return true;
            if ((compiler.isForOfStatement(parent) || compiler.isForInStatement(parent)) && parent.initializer === current)
                return true;
            current = parent;
        }
        return false;
    };
    // Greatest fixed point: a name is known when every value it is given is known, assuming the
    // same of the names those values read (`i = i + 1` keeps a number).
    const known = new Map();
    const kindOf = (expression) => {
        if (expression === 'number')
            return 'number';
        if (!expression)
            return null;
        if (transparent(expression))
            return kindOf(expression.expression);
        if (compiler.isNumericLiteral(expression) || compiler.isBigIntLiteral(expression))
            return 'number';
        if (compiler.isStringLiteral(expression) || compiler.isNoSubstitutionTemplateLiteral(expression))
            return 'literal';
        if (compiler.isConditionalExpression(expression))
            return join(kindOf(expression.whenTrue), kindOf(expression.whenFalse));
        if (compiler.isPrefixUnaryExpression(expression))
            return expression.operator === k.ExclamationToken ? null : 'number';
        if (compiler.isPostfixUnaryExpression(expression))
            return 'number';
        if (compiler.isIdentifier(expression))
            return values.has(expression.text) ? known.get(expression.text) ?? null : null;
        if (compiler.isBinaryExpression(expression)) {
            const operator = expression.operatorToken.kind;
            if (numeric.has(operator) || numericAssignment.has(operator))
                return 'number';
            if (operator === k.EqualsToken)
                return kindOf(expression.right);
            if (operator === k.PlusToken || operator === k.PlusEqualsToken)
                return kindOf(expression.left) === 'number' && kindOf(expression.right) === 'number' ? 'number' : null;
        }
        return null;
    };
    /** A known literal choice that may yield `constructor`, the way to `Function`. */
    const mayBeConstructor = (node, seen = new Set()) => {
        if (compiler.isStringLiteralLike(node))
            return node.text === 'constructor';
        if (transparent(node))
            return mayBeConstructor(node.expression, seen);
        if (compiler.isConditionalExpression(node))
            return mayBeConstructor(node.whenTrue, seen) || mayBeConstructor(node.whenFalse, seen);
        if (compiler.isBinaryExpression(node) && node.operatorToken.kind === k.EqualsToken)
            return mayBeConstructor(node.right, seen);
        if (!compiler.isIdentifier(node) || seen.has(node.text))
            return false;
        seen.add(node.text);
        return (values.get(node.text) ?? []).some(value => value !== 'number' && !!value && mayBeConstructor(value, seen));
    };
    const harmlessKey = (key) => kindOf(key) !== null && !mayBeConstructor(key);
    /** Follows an unspelled value from `node` upwards; true when it escapes. */
    const escapesFrom = (node) => {
        const parent = node.parent;
        if (transparent(parent))
            return escapesFrom(parent);
        if (compiler.isConditionalExpression(parent))
            return parent.condition !== node && escapesFrom(parent);
        if (compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent) || compiler.isTypeOfExpression(parent) || compiler.isVoidExpression(parent) || compiler.isDeleteExpression(parent))
            return false;
        if (compiler.isTemplateSpan(parent) || compiler.isExpressionStatement(parent) || compiler.isCaseClause(parent))
            return false;
        if ((compiler.isIfStatement(parent) || compiler.isWhileStatement(parent) || compiler.isDoStatement(parent) || compiler.isSwitchStatement(parent)) && parent.expression === node || compiler.isForStatement(parent) && parent.condition === node)
            return false;
        if (compiler.isElementAccessExpression(parent) && parent.argumentExpression === node)
            return false;
        if (compiler.isPropertyAccessExpression(parent) || compiler.isElementAccessExpression(parent)) {
            // A read reached from the value: a write into it, a call of it or an invoker escapes; a spelled
            // method called on it may return it (`valueOf`), so the result is followed in turn.
            if (writeTarget(parent))
                return true;
            const callee = compiler.isCallExpression(parent.parent) && parent.parent.expression === parent;
            if (callee)
                return compiler.isElementAccessExpression(parent) || INVOKERS.has(parent.name.text) || escapesFrom(parent.parent);
            return escapesFrom(parent);
        }
        if (compiler.isBinaryExpression(parent)) {
            const operator = parent.operatorToken.kind;
            if (consuming.has(operator))
                return false;
            if (operator === k.CommaToken)
                return parent.right === node && escapesFrom(parent);
            if (operator === k.AmpersandAmpersandToken || operator === k.BarBarToken || operator === k.QuestionQuestionToken)
                return escapesFrom(parent);
            if (assignment(operator) && parent.left === node)
                return false;
            if (operator === k.EqualsToken || operator === k.BarBarEqualsToken || operator === k.AmpersandAmpersandEqualsToken || operator === k.QuestionQuestionEqualsToken)
                return taint(parent.left) || escapesFrom(parent);
            return !assignment(operator);
        }
        if (compiler.isVariableDeclaration(parent) && parent.initializer === node)
            return taint(parent.name);
        if ((compiler.isForOfStatement(parent) || compiler.isForInStatement(parent)) && parent.expression === node)
            return compiler.isVariableDeclarationList(parent.initializer) ? parent.initializer.declarations.some(declaration => taint(declaration.name)) : taint(parent.initializer);
        return true;
    };
    /** The access is written: assigned, incremented or a destructuring target. */
    const writeTarget = (node) => {
        const parent = node.parent;
        if (compiler.isBinaryExpression(parent) && parent.left === node && assignment(parent.operatorToken.kind))
            return true;
        if ((compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent)) && (parent.operator === k.PlusPlusToken || parent.operator === k.MinusMinusToken))
            return true;
        return destructuringTarget(parent) || (compiler.isForOfStatement(parent) || compiler.isForInStatement(parent)) && parent.initializer === node;
    };
    /** The names a target binds now hold an unspelled value; a property or element target escapes. */
    const taint = (target) => {
        if (storesInto(target))
            return true;
        taintedNames.push(...bound(target));
        return false;
    };
    visit(file);
    if (escapes)
        return true;
    for (const name of values.keys())
        known.set(name, 'number');
    for (let changed = true; changed;) {
        changed = false;
        for (const [name, list] of values) {
            const kind = list.reduce((all, value) => join(all, kindOf(value)), 'number');
            if (kind !== known.get(name)) {
                known.set(name, kind);
                changed = true;
            }
        }
    }
    // A computed key in a destructuring assignment target: rare, so any unknown one counts.
    if (assignedKeys.some(key => !harmlessKey(key)))
        return true;
    for (const key of computedBindings)
        if (!harmlessKey(key.expression) && taint(key.parent.name))
            return true;
    for (const candidate of candidates) {
        const source = compiler.isElementAccessExpression(candidate) ? !harmlessKey(candidate.argumentExpression) && !(compiler.isBinaryExpression(candidate.parent) && candidate.parent.left === candidate && candidate.parent.operatorToken.kind === k.EqualsToken) : true;
        if (source && escapesFrom(candidate))
            return true;
    }
    const seen = new Set();
    while (taintedNames.length) {
        const name = taintedNames.pop();
        if (seen.has(name))
            continue;
        seen.add(name);
        if ((reads.get(name) ?? []).some(read => escapesFrom(read)))
            return true;
    }
    return false;
}
//# sourceMappingURL=property-names.js.map