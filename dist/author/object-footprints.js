/** Thrown inside the interpretation when a statement leaves the analysable subset. */
class Unknown extends Error {
}
const unknown = () => { throw new Unknown(); };
const PRIM = { prim: true, objs: new Set(), other: false };
const OTHER = { prim: false, objs: new Set(), other: true };
const union = (...values) => ({ prim: values.some(v => v.prim), objs: new Set(values.flatMap(v => [...v.objs])), other: values.some(v => v.other) });
const objects = (...ids) => ({ prim: false, objs: new Set(ids), other: false });
const ARRAY_READS = new Set(['map', 'filter', 'forEach', 'some', 'every', 'find', 'join', 'includes', 'indexOf', 'slice']);
const ARRAY_WRITES = new Set(['push', 'unshift', 'pop', 'shift']);
const ERRORS = new Set(['Error', 'TypeError', 'RangeError']);
/** Source text that lets a program change what property access or calls do. */
const REFLECTIVE = /\.prototype\b|__proto__|defineProperty|setPrototypeOf|\bReflect\b|\bProxy\b|Object\.assign|\bdelete\b/;
export function objectFootprints(list, file, compiler, checker, host) {
    const result = new Map();
    if (REFLECTIVE.test(file.text))
        return result;
    const S = compiler.SyntaxKind;
    const unwrap = (expr) => compiler.isParenthesizedExpression(expr) || compiler.isAsExpression(expr) || compiler.isSatisfiesExpression(expr) || compiler.isNonNullExpression(expr) || compiler.isTypeAssertionExpression(expr) ? unwrap(expr.expression) : expr;
    const nameOf = (name) => compiler.isIdentifier(name) || compiler.isPrivateIdentifier(name) || compiler.isStringLiteral(name) ? name.text : undefined;
    const has = (node, kind) => (compiler.canHaveModifiers(node) ? compiler.getModifiers(node) ?? [] : []).some(modifier => modifier.kind === kind);
    const classes = new Map();
    /** A class whose instances behave exactly as its own body says: no heritage, decorators,
     * abstractness, auto-accessors or ambiguous member names. */
    function classInfo(declaration) {
        if (classes.has(declaration))
            return classes.get(declaration);
        classes.set(declaration, null);
        if (declaration.heritageClauses?.some(clause => clause.token === S.ExtendsKeyword) || has(declaration, S.AbstractKeyword) || compiler.getDecorators(declaration)?.length)
            return null;
        const info = { fields: new Map(), methods: new Map(), getters: new Map(), setters: new Map(), parameterFields: [] };
        const names = new Set(), claim = (name, accessor = false) => {
            if (name === undefined || name === 'constructor' || !accessor && names.has(name))
                return unknown();
            names.add(name);
            return name;
        };
        try {
            for (const member of declaration.members) {
                if (compiler.isSemicolonClassElement(member) || compiler.isIndexSignatureDeclaration(member))
                    continue;
                if (compiler.canHaveDecorators(member) && compiler.getDecorators(member)?.length)
                    return null;
                if (has(member, S.StaticKeyword))
                    continue;
                if (compiler.isPropertyDeclaration(member)) {
                    if (has(member, S.DeclareKeyword))
                        continue;
                    if (has(member, S.AccessorKeyword))
                        return null;
                    info.fields.set(claim(nameOf(member.name)), member.initializer);
                }
                else if (compiler.isMethodDeclaration(member)) {
                    if (!member.body)
                        continue; // an overload signature
                    if (member.asteriskToken || has(member, S.AsyncKeyword))
                        return null;
                    info.methods.set(claim(nameOf(member.name)), member);
                }
                else if (compiler.isGetAccessorDeclaration(member) && member.body) {
                    const name = nameOf(member.name);
                    if (name === undefined || info.getters.has(name) || info.fields.has(name) || info.methods.has(name))
                        return null;
                    if (!info.setters.has(name))
                        claim(name);
                    info.getters.set(name, member);
                }
                else if (compiler.isSetAccessorDeclaration(member) && member.body) {
                    const name = nameOf(member.name);
                    if (name === undefined || info.setters.has(name) || info.fields.has(name) || info.methods.has(name))
                        return null;
                    if (!info.getters.has(name))
                        claim(name);
                    info.setters.set(name, member);
                }
                else if (compiler.isConstructorDeclaration(member)) {
                    if (!member.body)
                        continue;
                    info.ctor = member;
                    for (const parameter of member.parameters)
                        if (compiler.isIdentifier(parameter.name) && (compiler.getModifiers(parameter) ?? []).some(modifier => [S.PublicKeyword, S.PrivateKeyword, S.ProtectedKeyword, S.ReadonlyKeyword].includes(modifier.kind)))
                            info.parameterFields.push(claim(parameter.name.text));
                }
                else
                    return null;
            }
        }
        catch (error) {
            if (error instanceof Unknown)
                return null;
            throw error;
        }
        classes.set(declaration, info);
        return info;
    }
    const classOf = (expr) => {
        const declaration = compiler.isIdentifier(expr) ? checker.getSymbolAtLocation(expr)?.declarations : undefined;
        return declaration?.length === 1 && compiler.isClassDeclaration(declaration[0]) && declaration[0].getSourceFile() === file ? classInfo(declaration[0]) : null;
    };
    // Own objects of this list, by declaring statement and binding.
    const owned = new Map();
    for (const statement of list) {
        if (!compiler.isVariableStatement(statement))
            continue;
        const declarations = statement.declarationList.declarations, declaration = declarations[0];
        if (declarations.length !== 1 || !declaration || (statement.declarationList.flags & compiler.NodeFlags.BlockScoped) !== compiler.NodeFlags.Const || !compiler.isIdentifier(declaration.name) || !declaration.initializer)
            continue;
        const symbol = checker.getSymbolAtLocation(declaration.name), init = unwrap(declaration.initializer);
        if (!symbol)
            continue;
        const id = 'L' + statement.pos;
        if (compiler.isNewExpression(init)) {
            const info = classOf(init.expression);
            if (info)
                owned.set(symbol, { id, statement, kind: { kind: 'class', info } });
        }
        else if (compiler.isArrayLiteralExpression(init))
            owned.set(symbol, { id, statement, kind: { kind: 'array' } });
        else if (compiler.isObjectLiteralExpression(init))
            owned.set(symbol, { id, statement, kind: { kind: 'object' } });
    }
    if (!owned.size)
        return result;
    // Abstract heap, collected flow-insensitively over every statement of the list.
    const kinds = new Map([...owned.values()].map(entry => [entry.id, entry.kind]));
    const fields = new Map(), elements = new Map();
    let changed = false;
    const addField = (object, name, value) => {
        const map = fields.get(object) ?? new Map(), before = map.get(name), after = before ? union(before, value) : value;
        if (!before || after.prim !== before.prim || after.other !== before.other || after.objs.size !== before.objs.size)
            changed = true;
        map.set(name, after);
        fields.set(object, map);
    };
    const addElements = (object, value) => {
        const before = elements.get(object), after = before ? union(before, value) : value;
        if (!before || after.prim !== before.prim || after.other !== before.other || after.objs.size !== before.objs.size)
            changed = true;
        elements.set(object, after);
    };
    const fresh = (owner, node, kind) => { const id = owner + '|' + node.pos; if (!kinds.has(id)) {
        kinds.set(id, kind);
        changed = true;
    } return id; };
    const step = (frame) => { if (++frame.budget.steps > 20_000)
        unknown(); };
    const prim = (value) => { if (!value.prim || value.objs.size || value.other)
        unknown(); };
    /** Runs a constructor, method or accessor body on `self` with the given arguments. */
    function invoke(body, self, args, frame) {
        const key = self + '@' + body.pos;
        if (frame.stack.has(key) || !body.body || !compiler.isBlock(body.body))
            unknown();
        const env = new Map();
        body.parameters.forEach((parameter, index) => {
            if (!compiler.isIdentifier(parameter.name) || parameter.initializer || parameter.dotDotDotToken)
                unknown();
            env.set(parameter.name.text, args[index] ?? PRIM);
        });
        const inner = { ...frame, self, env, stack: new Set([...frame.stack, key]) };
        return block(body.body.statements, inner);
    }
    function construct(id, info, args, frame) {
        frame.fp.writes.add(id);
        const own = { ...frame, self: id, env: new Map() };
        for (const [name, initializer] of info.fields)
            addField(id, name, initializer ? expression(initializer, own) : PRIM);
        if (!info.ctor)
            return;
        info.ctor.parameters.forEach((parameter, index) => { if (info.parameterFields.includes(parameter.name.text))
            addField(id, parameter.name.text, args[index] ?? PRIM); });
        invoke(info.ctor, id, args, frame);
    }
    function block(statements, frame) {
        let returned = PRIM;
        for (const statement of statements) {
            step(frame);
            if (compiler.isExpressionStatement(statement))
                effect(statement.expression, frame);
            else if (compiler.isReturnStatement(statement))
                returned = statement.expression ? union(returned, expression(statement.expression, frame)) : returned;
            else if (compiler.isIfStatement(statement)) {
                expression(statement.expression, frame);
                returned = union(returned, block([statement.thenStatement], frame), statement.elseStatement ? block([statement.elseStatement], frame) : PRIM);
            }
            else if (compiler.isBlock(statement))
                returned = union(returned, block(statement.statements, frame));
            else if (compiler.isVariableStatement(statement)) {
                for (const declaration of statement.declarationList.declarations) {
                    if (!compiler.isIdentifier(declaration.name) || (statement.declarationList.flags & compiler.NodeFlags.BlockScoped) === 0)
                        unknown();
                    frame.env.set(declaration.name.text, declaration.initializer ? expression(declaration.initializer, frame) : PRIM);
                }
            }
            else if (compiler.isThrowStatement(statement)) {
                const error = unwrap(statement.expression);
                if (!compiler.isNewExpression(error) || !compiler.isIdentifier(error.expression) || !ERRORS.has(error.expression.text) || checker.getSymbolAtLocation(error.expression)?.declarations?.some(declaration => declaration.getSourceFile() === file))
                    unknown();
                for (const argument of error.arguments ?? [])
                    prim(expression(argument, frame));
                frame.fp.mayThrow = true;
            }
            else
                unknown();
        }
        return returned;
    }
    /** Assignments, updates and calls whose value is discarded. */
    function effect(raw, frame) {
        const expr = unwrap(raw);
        if (compiler.isBinaryExpression(expr) && expr.operatorToken.kind >= S.FirstAssignment && expr.operatorToken.kind <= S.LastAssignment) {
            const target = unwrap(expr.left);
            if (compiler.isIdentifier(target)) {
                if (!frame.env.has(target.text) || expr.operatorToken.kind !== S.EqualsToken)
                    unknown();
                frame.env.set(target.text, union(frame.env.get(target.text), expression(expr.right, frame)));
                return;
            }
            if (!compiler.isPropertyAccessExpression(target))
                unknown();
            const access = target, name = nameOf(access.name), base = expression(access.expression, frame);
            let value = expression(expr.right, frame);
            if (expr.operatorToken.kind !== S.EqualsToken) {
                prim(value);
                prim(read(base, name, frame));
                value = PRIM;
            }
            write(base, name, value, frame);
            return;
        }
        if ((compiler.isPrefixUnaryExpression(expr) || compiler.isPostfixUnaryExpression(expr)) && (expr.operator === S.PlusPlusToken || expr.operator === S.MinusMinusToken)) {
            const target = unwrap(expr.operand);
            if (!compiler.isPropertyAccessExpression(target))
                unknown();
            const access = target, base = expression(access.expression, frame), name = nameOf(access.name);
            prim(read(base, name, frame));
            write(base, name, PRIM, frame);
            return;
        }
        if (compiler.isCallExpression(expr)) {
            expression(expr, frame);
            return;
        }
        unknown();
    }
    function write(base, name, value, frame) {
        if (base.prim || base.other || !base.objs.size)
            unknown();
        for (const object of base.objs) {
            const kind = kinds.get(object);
            if (kind.kind === 'array')
                unknown();
            if (kind.kind === 'class') {
                const setter = kind.info.setters.get(name);
                if (setter) {
                    invoke(setter, object, [value], frame);
                    continue;
                }
                // Assigning to a getter-only accessor or a method throws or replaces behaviour.
                if (kind.info.getters.has(name) || kind.info.methods.has(name))
                    unknown();
            }
            frame.fp.writes.add(object);
            addField(object, name, value);
        }
    }
    function read(base, name, frame) {
        if (base.other || !base.objs.size && !base.prim)
            unknown();
        if (base.prim) {
            if (name !== 'length' || base.objs.size)
                unknown();
            return PRIM;
        }
        const values = [];
        for (const object of base.objs) {
            const kind = kinds.get(object);
            if (kind.kind === 'array') {
                if (name !== 'length')
                    unknown();
                frame.fp.reads.add(object);
                values.push(PRIM);
                continue;
            }
            if (kind.kind === 'class') {
                const getter = kind.info.getters.get(name);
                if (getter) {
                    values.push(invoke(getter, object, [], frame));
                    continue;
                }
                if (kind.info.methods.has(name) || kind.info.setters.has(name))
                    unknown();
            }
            const value = fields.get(object)?.get(name);
            // A property nobody defines may come from Object.prototype: not modelled.
            if (!value)
                unknown();
            frame.fp.reads.add(object);
            values.push(value);
        }
        return union(...values);
    }
    function call(base, name, args, frame) {
        if (base.prim || base.other || !base.objs.size)
            unknown();
        const values = [];
        for (const object of base.objs) {
            const kind = kinds.get(object);
            if (kind.kind === 'class') {
                const method = kind.info.methods.get(name);
                if (!method)
                    unknown();
                values.push(invoke(method, object, args.map(argument => expression(argument, frame)), frame));
                continue;
            }
            if (kind.kind !== 'array')
                unknown();
            if (ARRAY_WRITES.has(name)) {
                frame.fp.writes.add(object);
                frame.fp.reads.add(object);
                const pushed = args.map(argument => expression(argument, frame));
                if (name === 'push' || name === 'unshift') {
                    pushed.forEach(value => addElements(object, value));
                    values.push(PRIM);
                }
                else {
                    if (pushed.length)
                        unknown();
                    values.push(union(PRIM, elements.get(object) ?? PRIM));
                }
                continue;
            }
            if (!ARRAY_READS.has(name))
                unknown();
            frame.fp.reads.add(object);
            const items = elements.get(object) ?? PRIM;
            if (name === 'join') {
                args.forEach(argument => prim(expression(argument, frame)));
                prim(items);
                values.push(PRIM);
                continue;
            }
            if (name === 'includes' || name === 'indexOf') {
                args.forEach(argument => expression(argument, frame));
                values.push(PRIM);
                continue;
            }
            if (name === 'slice') {
                args.forEach(argument => prim(expression(argument, frame)));
                values.push(OTHER);
                continue;
            }
            // map, filter, forEach, some, every, find: one synchronous callback per element.
            const callback = args[0] && unwrap(args[0]);
            if (args.length !== 1 || !callback || !compiler.isArrowFunction(callback) || callback.parameters.length > 2)
                unknown();
            const arrow = callback, env = new Map(frame.env);
            arrow.parameters.forEach((parameter, index) => { if (!compiler.isIdentifier(parameter.name) || parameter.initializer || parameter.dotDotDotToken)
                unknown(); env.set(parameter.name.text, index ? PRIM : items); });
            const inner = { ...frame, env };
            const returned = compiler.isBlock(arrow.body) ? block(arrow.body.statements, inner) : expression(arrow.body, inner);
            values.push(name === 'find' ? union(items, PRIM) : name === 'forEach' || name === 'some' || name === 'every' ? PRIM : (void returned, OTHER));
        }
        return union(...values);
    }
    function expression(raw, frame) {
        step(frame);
        const expr = unwrap(raw);
        if (compiler.isNumericLiteral(expr) || compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || [S.TrueKeyword, S.FalseKeyword, S.NullKeyword].includes(expr.kind))
            return PRIM;
        if (expr.kind === S.ThisKeyword)
            return frame.self ? objects(frame.self) : unknown();
        if (compiler.isIdentifier(expr)) {
            const local = frame.env.get(expr.text);
            if (local)
                return local;
            if (frame.self === null) {
                const symbol = checker.getSymbolAtLocation(expr), own = symbol && owned.get(symbol);
                if (own)
                    return objects(own.id);
                if (host.primitive(expr))
                    return PRIM;
            }
            if (expr.text === 'undefined' && !checker.getSymbolAtLocation(expr)?.declarations?.some(declaration => declaration.getSourceFile() === file))
                return PRIM;
            return unknown();
        }
        if (compiler.isTemplateExpression(expr)) {
            expr.templateSpans.forEach(span => prim(expression(span.expression, frame)));
            return PRIM;
        }
        if (compiler.isPropertyAccessExpression(expr)) {
            if (expr.questionDotToken)
                unknown();
            return read(expression(expr.expression, frame), nameOf(expr.name), frame);
        }
        if (compiler.isCallExpression(expr)) {
            const callee = unwrap(expr.expression);
            if (expr.questionDotToken || !compiler.isPropertyAccessExpression(callee) || callee.questionDotToken || expr.arguments.some(argument => compiler.isSpreadElement(argument)))
                unknown();
            const access = callee;
            return call(expression(access.expression, frame), nameOf(access.name), expr.arguments, frame);
        }
        if (compiler.isBinaryExpression(expr)) {
            const operator = expr.operatorToken.kind, left = expression(expr.left, frame), right = expression(expr.right, frame);
            if (operator === S.AmpersandAmpersandToken || operator === S.BarBarToken || operator === S.QuestionQuestionToken)
                return union(left, right);
            if (operator === S.EqualsEqualsEqualsToken || operator === S.ExclamationEqualsEqualsToken)
                return PRIM;
            if (operator >= S.FirstAssignment && operator <= S.LastAssignment || operator === S.CommaToken || operator === S.InKeyword || operator === S.InstanceOfKeyword)
                unknown();
            prim(left);
            prim(right);
            return PRIM;
        }
        if (compiler.isPrefixUnaryExpression(expr)) {
            const operand = expression(expr.operand, frame);
            if (expr.operator === S.ExclamationToken)
                return PRIM;
            if (expr.operator === S.PlusPlusToken || expr.operator === S.MinusMinusToken)
                unknown();
            prim(operand);
            return PRIM;
        }
        if (compiler.isTypeOfExpression(expr)) {
            expression(expr.expression, frame);
            return PRIM;
        }
        if (compiler.isConditionalExpression(expr)) {
            expression(expr.condition, frame);
            return union(expression(expr.whenTrue, frame), expression(expr.whenFalse, frame));
        }
        if (compiler.isArrayLiteralExpression(expr)) {
            const id = fresh(frame.self ?? 'S', expr, { kind: 'array' });
            for (const element of expr.elements) {
                if (compiler.isSpreadElement(element) || compiler.isOmittedExpression(element))
                    unknown();
                addElements(id, expression(element, frame));
            }
            if (!elements.has(id))
                elements.set(id, PRIM);
            return objects(id);
        }
        if (compiler.isObjectLiteralExpression(expr)) {
            const id = fresh(frame.self ?? 'S', expr, { kind: 'object' });
            for (const property of expr.properties) {
                if (!compiler.isPropertyAssignment(property))
                    unknown();
                const name = nameOf(property.name);
                if (name === undefined || name === '__proto__')
                    unknown();
                addField(id, name, expression(property.initializer, frame));
            }
            return objects(id);
        }
        return unknown();
    }
    /** One list-level statement: a construction, or an operation on own objects. */
    function statementFootprint(statement, budget) {
        const frame = { self: null, env: new Map(), fp: { reads: new Set(), writes: new Set(), mayThrow: false }, stack: new Set(), budget };
        if (compiler.isVariableStatement(statement)) {
            const declaration = statement.declarationList.declarations[0], symbol = checker.getSymbolAtLocation(declaration.name), own = symbol && owned.get(symbol);
            if (!own || own.statement !== statement)
                unknown();
            const init = unwrap(declaration.initializer);
            if (own.kind.kind === 'class')
                construct(own.id, own.kind.info, init.arguments?.map(argument => expression(argument, frame)) ?? [], frame);
            else if (compiler.isArrayLiteralExpression(init)) {
                frame.fp.writes.add(own.id);
                for (const element of init.elements) {
                    if (compiler.isSpreadElement(element) || compiler.isOmittedExpression(element))
                        unknown();
                    addElements(own.id, expression(element, frame));
                }
                if (!elements.has(own.id))
                    elements.set(own.id, PRIM);
            }
            else {
                frame.fp.writes.add(own.id);
                for (const property of init.properties) {
                    if (!compiler.isPropertyAssignment(property))
                        unknown();
                    const name = nameOf(property.name);
                    if (name === undefined || name === '__proto__')
                        unknown();
                    addField(own.id, name, expression(property.initializer, frame));
                }
            }
            return frame.fp;
        }
        if (!compiler.isExpressionStatement(statement))
            unknown();
        effect(statement.expression, frame);
        return frame.fp;
    }
    // Identifier occurrences of own bindings, by top-level statement of the list.
    const occurrences = new Map();
    const inNested = (node, statement) => {
        for (let current = node.parent; current && current !== statement; current = current.parent)
            if (compiler.isFunctionLike(current) && !compiler.isArrowFunction(current) || compiler.isClassLike(current))
                return true;
        return false;
    };
    let foreign = new Set();
    const scan = (node, statement) => {
        if (compiler.isIdentifier(node)) {
            const symbol = checker.getSymbolAtLocation(node);
            if (symbol && owned.has(symbol)) {
                if (inNested(node, statement))
                    foreign.add(symbol);
                (occurrences.get(symbol) ?? occurrences.set(symbol, []).get(symbol)).push(statement);
            }
        }
        compiler.forEachChild(node, child => scan(child, statement));
    };
    // A block-scoped const of this list is visible only to the list's statements; a use inside a nested function escapes.
    for (const statement of list)
        scan(statement, statement);
    const escaped = new Set([...foreign].map(symbol => owned.get(symbol).id));
    // Fixpoint: heap facts and footprints, escapes propagating through stored references.
    const budget = { steps: 0 };
    for (let round = 0; round < 12; round++) {
        changed = false;
        result.clear();
        for (const statement of list) {
            if (compiler.isReturnStatement(statement))
                continue;
            try {
                const fp = statementFootprint(statement, budget);
                if ([...fp.reads, ...fp.writes].some(id => escaped.has(id.split('|')[0]) || escaped.has(id)))
                    continue;
                result.set(statement, fp);
            }
            catch (error) {
                if (!(error instanceof Unknown))
                    throw error;
                if (budget.steps > 20_000) {
                    result.clear();
                    return result;
                }
            }
        }
        // Own objects named by a statement without a footprint escape, and so does everything they hold.
        for (const [symbol, statements] of occurrences)
            if (statements.some(statement => !result.has(statement) && !compiler.isReturnStatement(statement)))
                if (!escaped.has(owned.get(symbol).id)) {
                    escaped.add(owned.get(symbol).id);
                    changed = true;
                }
        for (const id of [...escaped]) {
            const held = [...fields.get(id)?.values() ?? [], ...elements.has(id) ? [elements.get(id)] : []];
            for (const value of held)
                for (const object of value.objs)
                    if (!escaped.has(object)) {
                        escaped.add(object);
                        changed = true;
                    }
        }
        if (!changed)
            return result;
    }
    result.clear();
    return result;
}
/** Why two footprinted statements must keep their order; empty when they commute. */
export function footprintConflicts(a, b) {
    const meets = (x, y) => [...x].some(id => y.has(id));
    const found = [];
    if (a.mayThrow || b.mayThrow)
        found.push('may-throw');
    if (meets(a.writes, b.reads))
        found.push('object-read-after-write');
    if (meets(a.reads, b.writes))
        found.push('object-write-after-read');
    if (meets(a.writes, b.writes))
        found.push('object-write-after-write');
    return found;
}
//# sourceMappingURL=object-footprints.js.map