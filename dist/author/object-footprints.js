import { assignedNames, atMostOnce, loopEnds } from './loop-termination.js';
import { OTHER, PRIM, STR, WHOLE, at, literal, objectOf, objects, union } from './footprint-values.js';
import { ObjectHeap } from './object-heap.js';
/** Thrown inside the interpretation when a statement leaves the analysable subset. */
class Unknown extends Error {
}
const unknown = () => { throw new Unknown(); };
const ARRAY_READS = new Set(['map', 'filter', 'forEach', 'some', 'every', 'find', 'join', 'includes', 'indexOf', 'slice']);
const ARRAY_WRITES = new Set(['push', 'unshift', 'pop', 'shift']);
/** ADR-028: String.prototype methods that cannot throw or run code on a string receiver, by the
 * arguments they accept without conversion: none, strings, or numeric literals. */
const STRING_METHODS = new Map([
    ...['trim', 'trimStart', 'trimEnd', 'toUpperCase', 'toLowerCase'].map(name => [name, { args: 'none', text: true }]),
    ...['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf'].map(name => [name, { args: 'text', text: false }]),
    ['concat', { args: 'text', text: true }],
    ...['slice', 'substring', 'charAt'].map(name => [name, { args: 'number', text: true }])
]);
/** ADR-028: reads and writes are recorded per object field; `*` stands for the whole object
 * (its creation, an array, or a write that may add a key and so change the key order). */
const ERRORS = new Set(['Error', 'TypeError', 'RangeError']);
/** Source text that lets a program change what property access or calls do. */
const REFLECTIVE = /\.prototype\b|__proto__|defineProperty|setPrototypeOf|\bReflect\b|\bProxy\b|Object\.assign|\bdelete\b|\bSymbol\.iterator\b/;
export function objectFootprints(list, file, compiler, checker, host) {
    const result = new Map();
    if (REFLECTIVE.test(file.text))
        return result;
    const S = compiler.SyntaxKind;
    /** ADR-032: arithmetic, concatenation and comparison of two known primitives; none of them runs code. */
    const fold = (operator, a, b) => {
        const compare = (x, y) => operator === S.LessThanToken ? x < y : operator === S.LessThanEqualsToken ? x <= y : operator === S.GreaterThanToken ? x > y : operator === S.GreaterThanEqualsToken ? x >= y : undefined;
        if (typeof a === 'string' && typeof b === 'string') {
            const c = compare(a, b);
            if (c !== undefined)
                return literal(c);
        }
        if (operator === S.PlusToken && (typeof a === 'string' || typeof b === 'string'))
            return literal(String(a) + String(b));
        if (typeof a !== 'number' || typeof b !== 'number')
            return null;
        const c = compare(a, b);
        if (c !== undefined)
            return literal(c);
        const result = operator === S.PlusToken ? a + b : operator === S.MinusToken ? a - b : operator === S.AsteriskToken ? a * b : operator === S.SlashToken ? a / b : operator === S.PercentToken ? a % b : undefined;
        return result === undefined ? null : literal(result);
    };
    const unwrap = (expr) => compiler.isParenthesizedExpression(expr) || compiler.isAsExpression(expr) || compiler.isSatisfiesExpression(expr) || compiler.isNonNullExpression(expr) || compiler.isTypeAssertionExpression(expr) ? unwrap(expr.expression) : expr;
    // v35 (ADR-069): a numeric member name is the property key of its canonical numeric string.
    const nameOf = (name) => compiler.isIdentifier(name) || compiler.isPrivateIdentifier(name) || compiler.isStringLiteral(name) ? name.text : compiler.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
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
        const info = { fields: new Map(), methods: new Map(), getters: new Map(), setters: new Map(), parameterFields: [], created: new Set() };
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
                    // v35 (ADR-069): a later method of the same name replaces the earlier one on the prototype.
                    const name = nameOf(member.name);
                    info.methods.set(name !== undefined && info.methods.has(name) ? name : claim(name), member);
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
        // ADR-045: a constructor without `return` runs every top-level statement before the object
        // exists outside it, so a plain `this.x = …` there creates key x in every constructed object.
        const body = info.ctor?.body;
        if (body && !leaves(body))
            for (const statement of body.statements) {
                const expr = compiler.isExpressionStatement(statement) ? unwrap(statement.expression) : undefined;
                if (!expr || !compiler.isBinaryExpression(expr) || expr.operatorToken.kind !== S.EqualsToken)
                    continue;
                const target = unwrap(expr.left), name = compiler.isPropertyAccessExpression(target) && target.expression.kind === S.ThisKeyword ? nameOf(target.name) : undefined;
                if (name !== undefined && !info.getters.has(name) && !info.setters.has(name) && !info.methods.has(name))
                    info.created.add(name);
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
    // ADR-031: in the body of a constructor of an analysable class, `this` is an own object too. Its
    // field initialisers and parameter properties ran before the body; a parameter is an outside value
    // that may be stored but not operated on (OTHER).
    const ctor = list[0]?.parent && compiler.isBlock(list[0].parent) && compiler.isConstructorDeclaration(list[0].parent.parent) ? list[0].parent.parent : undefined;
    const selfInfo = ctor && compiler.isClassDeclaration(ctor.parent) ? classInfo(ctor.parent) : null;
    const self = selfInfo ? 'T' + ctor.pos : null;
    const parameters = new Set(ctor ? ctor.parameters.flatMap(parameter => { const symbol = compiler.isIdentifier(parameter.name) ? checker.getSymbolAtLocation(parameter.name) : undefined; return symbol ? [symbol] : []; }) : []);
    if (!owned.size && !self)
        return result;
    // Abstract heap, collected flow-insensitively over every statement of the list.
    const kinds = new Map([...owned.values()].map(entry => [entry.id, entry.kind]));
    if (self)
        kinds.set(self, { kind: 'class', info: selfInfo });
    // The positioned cells, the certain overwrites and the array-literal facts (ADR-070/071/072/084).
    const heap = new ObjectHeap();
    const fresh = (owner, node, kind) => { const id = owner + '|' + node.pos; if (!kinds.has(id)) {
        kinds.set(id, kind);
        heap.touch();
    } return id; };
    const step = (frame) => { if (++frame.budget.steps > 20_000)
        unknown(); };
    const prim = (value) => { if (!value.prim || value.objs.size || value.other)
        unknown(); };
    const NONE = new Set();
    const uncertain = (frame) => frame.certain ? { ...frame, certain: false } : frame;
    /** ADR-072: the objects certainly reached through `expr` (value `base`) in certain code: its one
     * object, or every member when it names the variable of a loop that visits each of them. */
    const sureObjects = (expr, base, frame) => {
        if (!frame.certain || !frame.must || base.prim || base.other)
            return NONE;
        if (base.objs.size === 1)
            return base.objs;
        const named = unwrap(expr);
        return frame.every && compiler.isIdentifier(named) && checker.getSymbolAtLocation(named) === frame.every.variable ? frame.every.members : NONE;
    };
    /** Whether a jump in `root` (outside nested functions) may skip the code after it in its block. */
    const jumps = (root) => {
        let found = false;
        const visit = (node) => {
            if (found || compiler.isFunctionLike(node) || compiler.isClassLike(node))
                return;
            if (compiler.isReturnStatement(node) || compiler.isBreakStatement(node) || compiler.isContinueStatement(node)) {
                found = true;
                return;
            }
            compiler.forEachChild(node, visit);
        };
        visit(root);
        return found;
    };
    /** Runs a constructor, method or accessor body on `self` with the given arguments. */
    function invoke(body, self, args, frame) {
        const key = self + '@' + body.pos;
        if (frame.stack.has(key) || !body.body || !compiler.isBlock(body.body))
            unknown();
        const inner = { ...frame, self, env: bind(body, args, { ...frame, self, env: new Map(), every: undefined, top: undefined }), stack: new Set([...frame.stack, key]), every: undefined, top: undefined };
        return block(body.body.statements, inner);
    }
    /** The parameters of `body` bound to `args`. v39 (ADR-073): a default runs, in the callee's scope
     * with the earlier parameters bound, when its argument is missing or may be undefined. */
    function bind(body, args, frame) {
        const env = frame.env;
        body.parameters.forEach((parameter, index) => {
            if (!compiler.isIdentifier(parameter.name) || parameter.dotDotDotToken)
                unknown();
            let value = args[index] ?? literal(undefined);
            if (parameter.initializer) {
                const missing = !!value.known && value.known.lit === undefined, maybe = !value.known && value.prim;
                if (missing || maybe) {
                    const fallback = expression(parameter.initializer, frame);
                    value = missing ? fallback : union(value, fallback);
                }
            }
            env.set(parameter.name.text, value);
        });
        return env;
    }
    function construct(id, info, args, frame) {
        frame.fp.writes.add(at(id, WHOLE));
        const own = { ...frame, self: id, env: new Map() };
        for (const [name, initializer] of info.fields) {
            heap.addField(id, name, initializer ? expression(initializer, own) : PRIM);
            if (frame.certain)
                frame.must?.add(at(id, name));
        }
        if (!info.ctor)
            return;
        // The parameter properties hold the bound arguments, defaults included (ADR-073).
        const bound = bind(info.ctor, args, { ...frame, self: id, env: new Map(), every: undefined, top: undefined }), values = info.ctor.parameters.map(parameter => compiler.isIdentifier(parameter.name) ? bound.get(parameter.name.text) : PRIM);
        info.ctor.parameters.forEach((parameter, index) => { if (info.parameterFields.includes(parameter.name.text)) {
            heap.addField(id, parameter.name.text, values[index]);
            if (frame.certain)
                frame.must?.add(at(id, parameter.name.text));
        } });
        invoke(info.ctor, id, values, { ...frame, constructing: new Set([...frame.constructing ?? [], id]) });
    }
    function block(statements, outer) {
        let returned = PRIM;
        // ADR-072: certain code stays certain across simple statements; inside a compound one only where
        // it surely runs, and after it only if no jump may skip the rest of the block.
        let carry = outer;
        // v38 (ADR-072): a return ending a straight-line prefix is the only way out: its value is the result.
        let straight = true;
        const plain = (statement) => compiler.isExpressionStatement(statement) || compiler.isVariableStatement(statement) || compiler.isReturnStatement(statement) || compiler.isThrowStatement(statement) || compiler.isIfStatement(statement) || compiler.isBlock(statement) || compiler.isForOfStatement(statement) || compiler.isSwitchStatement(statement);
        for (const statement of statements) {
            const frame = carry.certain && !plain(statement) ? uncertain(carry) : carry;
            if (carry.certain && jumps(statement))
                carry = uncertain(carry);
            if (!compiler.isExpressionStatement(statement) && !compiler.isVariableStatement(statement) && !compiler.isReturnStatement(statement))
                straight = false;
            step(frame);
            if (compiler.isExpressionStatement(statement))
                effect(statement.expression, frame);
            else if (compiler.isReturnStatement(statement)) {
                const value = statement.expression ? expression(statement.expression, frame) : literal(undefined);
                returned = straight ? value : union(returned, value);
                straight = false;
            }
            else if (compiler.isIfStatement(statement)) {
                // ADR-032: a test whose value is known runs only the branch it selects.
                const test = expression(statement.expression, frame), taken = test.known ? !!test.known.lit : undefined;
                returned = union(returned, taken !== false ? block([statement.thenStatement], taken ? frame : uncertain(frame)) : PRIM, statement.elseStatement && taken !== true ? block([statement.elseStatement], taken === false ? frame : uncertain(frame)) : PRIM);
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
            // ADR-034: a jump out of the enclosing switch or loop. Interpreting what follows anyway only adds effects.
            else if (compiler.isBreakStatement(statement) && !statement.label && frame.exits)
                continue;
            else if (compiler.isContinueStatement(statement) && !statement.label && frame.loops)
                continue;
            // ADR-042: a jump to an enclosing label of this statement, interpreted the same way.
            else if ((compiler.isBreakStatement(statement) || compiler.isContinueStatement(statement)) && statement.label && frame.labels?.has(statement.label.text))
                continue;
            else if (compiler.isLabeledStatement(statement))
                returned = union(returned, block([statement.statement], { ...frame, labels: new Set([...frame.labels ?? [], statement.label.text]) }));
            // ADR-034: every clause (fall-through included) may run; a break leaves the switch.
            // v38 (ADR-072): a known discriminant and known case labels select where the body starts (the
            // matching case, else the default clause); the clauses from there on may run by fall-through.
            else if (compiler.isSwitchStatement(statement)) {
                const discriminant = expression(statement.expression, frame), clauses = statement.caseBlock.clauses;
                const labels = clauses.map(clause => compiler.isCaseClause(clause) ? expression(clause.expression, frame).known : undefined);
                const decided = discriminant.known && clauses.every((clause, index) => !compiler.isCaseClause(clause) || labels[index]);
                const matched = decided ? clauses.findIndex((clause, index) => compiler.isCaseClause(clause) && labels[index].lit === discriminant.known.lit) : -1;
                const start = !decided ? 0 : matched >= 0 ? matched : clauses.findIndex(clause => !compiler.isCaseClause(clause));
                const inner = { ...uncertain(frame), exits: (frame.exits ?? 0) + 1 };
                if (start >= 0)
                    for (const clause of clauses.slice(start))
                        returned = union(returned, block(clause.statements, inner));
            }
            // ADR-034: a throw inside try is caught when there is a catch; the catch runs only if try may throw.
            else if (compiler.isTryStatement(statement)) {
                const outer = frame.fp.mayThrow;
                frame.fp.mayThrow = false;
                returned = union(returned, block(statement.tryBlock.statements, frame));
                const tryThrows = frame.fp.mayThrow, handler = statement.catchClause;
                frame.fp.mayThrow = outer || tryThrows && !handler;
                if (handler && tryThrows) {
                    const binding = handler.variableDeclaration?.name;
                    if (binding && !compiler.isIdentifier(binding))
                        unknown();
                    // The caught value is the Error this footprint threw: no own object.
                    if (binding)
                        frame.env.set(binding.text, OTHER);
                    returned = union(returned, block(handler.block.statements, frame));
                }
                if (statement.finallyBlock)
                    returned = union(returned, block(statement.finallyBlock.statements, frame));
            }
            // ADR-034: for…of over own arrays the body does not write: it ends, and reads every element.
            else if (compiler.isForOfStatement(statement)) {
                const head = statement.initializer;
                if (statement.awaitModifier || !compiler.isVariableDeclarationList(head) || head.declarations.length !== 1 || (head.flags & compiler.NodeFlags.BlockScoped) === 0)
                    unknown();
                const binding = head.declarations[0].name;
                const iterated = expression(statement.expression, frame);
                if (iterated.prim || iterated.other || !iterated.objs.size || [...iterated.objs].some(id => kinds.get(id)?.kind !== 'array'))
                    unknown();
                for (const id of iterated.objs)
                    frame.fp.reads.add(at(id, WHOLE));
                const entryEnv = new Map(frame.env);
                // Locals the body assigns lose a known value: a later iteration may see another one.
                for (const name of assignedNames(statement.statement, compiler))
                    if (frame.env.has(name))
                        frame.env.set(name, union(frame.env.get(name), PRIM));
                // v36 (ADR-070): a body that runs at most once sees only the first element of one own array literal.
                const single = iterated.objs.size === 1 ? [...iterated.objs][0] : undefined;
                const first = single !== undefined ? heap.first(single) : undefined;
                const element = first && atMostOnce(statement, compiler) ? first : union(...[...iterated.objs].map(id => heap.items(id)));
                if (compiler.isIdentifier(binding))
                    frame.env.set(binding.text, element);
                // ADR-059: `const [a, b]` over own arrays of own arrays (the pairs of Object.entries): every
                // name may be any element of an inner array, which the destructuring reads.
                else if (compiler.isArrayBindingPattern(binding) && !element.prim && !element.other && element.objs.size && [...element.objs].every(id => kinds.get(id)?.kind === 'array')) {
                    const inner = union(...[...element.objs].map(id => { frame.fp.reads.add(at(id, WHOLE)); return heap.items(id); }));
                    for (const item of binding.elements) {
                        if (compiler.isOmittedExpression(item))
                            continue;
                        if (!compiler.isIdentifier(item.name) || item.initializer || item.dotDotDotToken || item.propertyName)
                            unknown();
                        frame.env.set(item.name.text, union(inner, literal(undefined)));
                    }
                }
                else
                    unknown();
                const body = { reads: new Set(), writes: new Set(), mayThrow: false, external: false, mayHang: false };
                // v48 (ADR-084): the first iteration of a loop over one own array literal that no statement but
                // its creation wrote (and no unshift, pop or shift reshaped), with no jump in the body, binds the
                // first element and the list-level locals the body reads at their known entry values; the other
                // iterations bind the other elements, with those locals unknown as before.
                let rest;
                const list = single !== undefined ? heap.inOrder(single) : undefined;
                if (list?.length && frame.self === null && host.entry && compiler.isIdentifier(binding) && !jumps(statement.statement)) {
                    const seeds = new Map(), names = new Map();
                    const collect = (node) => {
                        if (compiler.isIdentifier(node)) {
                            const symbol = checker.getSymbolAtLocation(node);
                            if (names.has(node.text) && names.get(node.text) !== symbol)
                                names.set(node.text, undefined);
                            else if (!names.has(node.text))
                                names.set(node.text, symbol);
                            const known = !entryEnv.has(node.text) ? host.entry(node, statement) : undefined;
                            if (known)
                                seeds.set(node.text, literal(known.lit));
                        }
                        compiler.forEachChild(node, collect);
                    };
                    collect(statement.statement);
                    for (const name of [...seeds.keys()])
                        if (!names.get(name))
                            seeds.delete(name);
                    if (seeds.size) {
                        const first = new Map(entryEnv);
                        for (const [name, value] of seeds)
                            first.set(name, value);
                        first.set(binding.text, list[0]);
                        returned = union(returned, block([statement.statement], { ...frame, env: first, fp: body, exits: (frame.exits ?? 0) + 1, loops: (frame.loops ?? 0) + 1, every: undefined }));
                        for (const [name] of entryEnv)
                            if (frame.env.has(name))
                                frame.env.set(name, union(frame.env.get(name), first.get(name)));
                        rest = list.slice(1);
                    }
                }
                if (rest && compiler.isIdentifier(binding))
                    frame.env.set(binding.text, rest.length ? union(...rest) : PRIM);
                // v38 (ADR-072): a loop that no jump cuts short visits every member of one own array literal (no
                // unshift, pop or shift removed one); its body's certain code runs on each of them.
                const remaining = rest ? new Set(rest.flatMap(value => [...value.objs])) : undefined;
                const literalMembers = single !== undefined ? heap.members(single) : undefined;
                const visited = frame.certain && literalMembers && !heap.reshaped(single) && compiler.isIdentifier(binding) && !jumps(statement.statement) ? remaining ?? literalMembers : undefined;
                const variable = visited ? checker.getSymbolAtLocation(binding) : undefined;
                const each = visited && variable ? { variable, members: visited } : undefined;
                if (!rest || rest.length)
                    returned = union(returned, block([statement.statement], { ...frame, fp: body, exits: (frame.exits ?? 0) + 1, loops: (frame.loops ?? 0) + 1, certain: !!each, every: each }));
                // Writing the iterated array may extend the iteration: not shown to end.
                if ([...iterated.objs].some(id => body.writes.has(at(id, WHOLE))))
                    unknown();
                body.reads.forEach(key => frame.fp.reads.add(key));
                body.writes.forEach(key => frame.fp.writes.add(key));
                frame.fp.mayThrow ||= body.mayThrow;
                frame.fp.external ||= body.external;
                frame.fp.mayHang ||= body.mayHang;
            }
            // ADR-046: while, do…while and for over own objects. The body and the test are interpreted
            // once with the locals they assign widened, which covers every iteration; a loop not shown to
            // end may hang, which orders it like a throw.
            else if (compiler.isWhileStatement(statement) || compiler.isDoStatement(statement) || compiler.isForStatement(statement)) {
                const head = compiler.isForStatement(statement) ? statement.initializer : undefined;
                if (head && !(compiler.isVariableDeclarationList(head) && (head.flags & compiler.NodeFlags.BlockScoped) !== 0))
                    unknown();
                for (const declaration of head ? head.declarations : []) {
                    if (!compiler.isIdentifier(declaration.name))
                        unknown();
                    frame.env.set(declaration.name.text, declaration.initializer ? expression(declaration.initializer, frame) : literal(undefined));
                }
                for (const name of assignedNames(statement, compiler))
                    if (frame.env.has(name))
                        frame.env.set(name, union(frame.env.get(name), PRIM));
                const inner = { ...frame, exits: (frame.exits ?? 0) + 1, loops: (frame.loops ?? 0) + 1 };
                const test = compiler.isForStatement(statement) ? statement.condition : statement.expression;
                if (test)
                    expression(test, inner);
                returned = union(returned, block([statement.statement], inner));
                if (compiler.isForStatement(statement) && statement.incrementor)
                    effect(statement.incrementor, inner);
                if (!loopEnds(statement, file, compiler, loopObjects(frame)))
                    frame.fp.mayHang = true;
            }
            else
                unknown();
        }
        return returned;
    }
    /** ADR-046/064: what the loop-termination argument needs from this analysis (loop-termination.ts). */
    function loopObjects(frame) {
        const methods = new Map();
        for (const info of kinds.values())
            if (info.kind === 'class')
                for (const [name, method] of info.info.methods)
                    methods.set(name, [...methods.get(name) ?? [], method]);
        return { methods, receiver: identifier => {
                let value;
                try {
                    value = frame.env.get(identifier.text) ?? expression(identifier, frame);
                }
                catch {
                    return undefined;
                }
                if (value.prim || value.other || value.objs.size !== 1)
                    return undefined;
                const kind = kinds.get([...value.objs][0]);
                if (!kind)
                    return undefined;
                return kind.kind === 'class' ? { methods: kind.info.methods, accessors: new Set([...kind.info.getters.keys(), ...kind.info.setters.keys()]), parameterFields: kind.info.parameterFields } : { methods: new Map(), accessors: new Set(), parameterFields: [] };
            } };
    }
    /** Assignments, updates and calls whose value is discarded. */
    function effect(raw, frame) {
        const expr = unwrap(raw);
        if (compiler.isBinaryExpression(expr) && expr.operatorToken.kind >= S.FirstAssignment && expr.operatorToken.kind <= S.LastAssignment) {
            const target = unwrap(expr.left);
            if (compiler.isIdentifier(target)) {
                // ADR-048: a primitive local of the list's function; the analysis orders it by binding conflicts.
                if (!frame.env.has(target.text) && frame.self === null && host.assignable?.(target)) {
                    prim(expression(expr.right, frame));
                    if (expr.operatorToken.kind !== S.EqualsToken)
                        prim(expression(target, frame));
                    return;
                }
                if (!frame.env.has(target.text))
                    unknown();
                // ADR-084: a compound assignment (`seen += 2`) of a primitive local keeps a primitive, as ++/-- do;
                // an object operand would run its valueOf.
                if (expr.operatorToken.kind !== S.EqualsToken) {
                    prim(frame.env.get(target.text));
                    prim(expression(expr.right, frame));
                    frame.env.set(target.text, union(frame.env.get(target.text), PRIM));
                    return;
                }
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
            write(base, name, value, frame, sureObjects(access.expression, base, frame));
            return;
        }
        if ((compiler.isPrefixUnaryExpression(expr) || compiler.isPostfixUnaryExpression(expr)) && (expr.operator === S.PlusPlusToken || expr.operator === S.MinusMinusToken)) {
            const target = unwrap(expr.operand);
            // ADR-046: a local counter of a body or loop; ++/-- keep a primitive number.
            if (compiler.isIdentifier(target) && frame.env.has(target.text)) {
                prim(frame.env.get(target.text));
                frame.env.set(target.text, PRIM);
                return;
            }
            if (compiler.isIdentifier(target) && frame.self === null && host.assignable?.(target)) {
                prim(expression(target, frame));
                return;
            }
            if (!compiler.isPropertyAccessExpression(target))
                unknown();
            const access = target, base = expression(access.expression, frame), name = nameOf(access.name);
            prim(read(base, name, frame));
            write(base, name, PRIM, frame, sureObjects(access.expression, base, frame));
            return;
        }
        if (compiler.isCallExpression(expr)) {
            expression(expr, frame.certain ? { ...frame, top: expr } : frame);
            return;
        }
        unknown();
    }
    function write(base, name, value, frame, sure) {
        if (base.prim || base.other || !base.objs.size)
            unknown();
        for (const object of base.objs) {
            const kind = kinds.get(object);
            if (kind.kind === 'array')
                unknown();
            if (kind.kind === 'class') {
                const setter = kind.info.setters.get(name);
                if (setter) {
                    invoke(setter, object, [value], { ...frame, certain: sure.has(object) });
                    continue;
                }
                // Assigning to a getter-only accessor or a method throws or replaces behaviour.
                if (kind.info.getters.has(name) || kind.info.methods.has(name))
                    unknown();
            }
            // A field the construction already created keeps the key order; any other name may add a key.
            // ADR-031: unless the program lists keys, adding a key is a write of that field alone.
            // ADR-045: or one every finished construction created, once this object's construction is over.
            const existing = !host.enumeratedKeys || kind.kind === 'class' && (kind.info.fields.get(name) !== undefined || kind.info.parameterFields.includes(name) || kind.info.created.has(name) && !frame.constructing?.has(object));
            frame.fp.writes.add(at(object, existing ? name : WHOLE));
            heap.addField(object, name, value);
            if (sure.has(object))
                frame.must.add(at(object, name));
        }
    }
    function read(base, name, frame) {
        if (base.other || !base.objs.size && !base.prim)
            unknown();
        // `length` of null or undefined throws: only a value that can only be a string qualifies.
        if (base.prim) {
            if (name !== 'length' || !base.text || base.objs.size)
                unknown();
            return typeof base.known?.lit === 'string' ? literal(base.known.lit.length) : PRIM;
        }
        const values = [];
        for (const object of base.objs) {
            const kind = kinds.get(object);
            if (kind.kind === 'array') {
                if (name !== 'length')
                    unknown();
                frame.fp.reads.add(at(object, WHOLE));
                values.push(PRIM);
                continue;
            }
            if (kind.kind === 'class') {
                const getter = kind.info.getters.get(name);
                if (getter) {
                    values.push(invoke(getter, object, [], uncertain(frame)));
                    continue;
                }
                if (kind.info.methods.has(name) || kind.info.setters.has(name))
                    unknown();
            }
            const value = heap.field(object, name);
            // A property nobody has defined yet may come from Object.prototype: not modelled.
            if (!value)
                unknown();
            frame.fp.reads.add(at(object, name));
            values.push(value);
        }
        return union(...values);
    }
    function call(base, name, args, frame, sure = NONE) {
        // ADR-028: a known String.prototype method on a value that can only be a string.
        if (base.prim && base.text && !base.objs.size && !base.other) {
            const method = STRING_METHODS.get(name);
            if (!method || (method.args === 'none') !== !args.length)
                unknown();
            for (const argument of args) {
                const value = method.args === 'number' ? (compiler.isNumericLiteral(unwrap(argument)) ? PRIM : unknown()) : expression(argument, frame);
                if (method.args === 'text' && (!value.prim || !value.text || value.objs.size || value.other))
                    unknown();
            }
            return method.text ? STR : PRIM;
        }
        if (base.prim || base.other || !base.objs.size)
            unknown();
        const values = [];
        for (const object of base.objs) {
            const kind = kinds.get(object);
            if (kind.kind === 'class') {
                const method = kind.info.methods.get(name);
                if (!method)
                    unknown();
                values.push(invoke(method, object, args.map(argument => expression(argument, frame)), { ...frame, certain: sure.has(object) }));
                continue;
            }
            if (kind.kind !== 'array')
                unknown();
            if (ARRAY_WRITES.has(name)) {
                frame.fp.writes.add(at(object, WHOLE));
                frame.fp.reads.add(at(object, WHOLE));
                if (name !== 'push')
                    heap.reshape(object);
                const pushed = args.map(argument => expression(argument, frame));
                if (name === 'push' || name === 'unshift') {
                    pushed.forEach(value => heap.addElements(object, value));
                    values.push(PRIM);
                }
                else {
                    if (pushed.length)
                        unknown();
                    values.push(union(PRIM, heap.items(object)));
                }
                continue;
            }
            if (!ARRAY_READS.has(name))
                unknown();
            frame.fp.reads.add(at(object, WHOLE));
            const held = heap.items(object);
            if (name === 'join') {
                args.forEach(argument => prim(expression(argument, frame)));
                prim(held);
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
                unknown(); env.set(parameter.name.text, index ? PRIM : held); });
            const inner = { ...frame, env };
            const returned = compiler.isBlock(arrow.body) ? block(arrow.body.statements, inner) : expression(arrow.body, inner);
            values.push(name === 'find' ? union(held, PRIM) : name === 'forEach' || name === 'some' || name === 'every' ? PRIM : (void returned, OTHER));
        }
        return union(...values);
    }
    function expression(raw, frame) {
        step(frame);
        const expr = unwrap(raw);
        if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr))
            return literal(expr.text);
        if (compiler.isNumericLiteral(expr))
            return literal(Number(expr.text.replaceAll('_', '')));
        if (expr.kind === S.TrueKeyword || expr.kind === S.FalseKeyword)
            return literal(expr.kind === S.TrueKeyword);
        if (expr.kind === S.NullKeyword)
            return literal(null);
        if (expr.kind === S.ThisKeyword)
            return frame.self ? objects(frame.self) : self ? objects(self) : unknown();
        if (compiler.isIdentifier(expr)) {
            const local = frame.env.get(expr.text);
            if (local)
                return local;
            if (frame.self === null) {
                const symbol = checker.getSymbolAtLocation(expr), own = symbol && owned.get(symbol);
                if (own)
                    return objects(own.id);
                if (symbol && parameters.has(symbol))
                    return OTHER;
                if (host.primitive(expr))
                    return PRIM;
            }
            if (expr.text === 'undefined' && !checker.getSymbolAtLocation(expr)?.declarations?.some(declaration => declaration.getSourceFile() === file))
                return literal(undefined);
            return unknown();
        }
        if (compiler.isTemplateExpression(expr)) {
            const spans = expr.templateSpans.map(span => expression(span.expression, frame));
            spans.forEach(prim);
            return spans.every(span => span.known) ? literal(expr.head.text + expr.templateSpans.map((span, i) => String(spans[i].known.lit) + span.literal.text).join('')) : STR;
        }
        if (compiler.isPropertyAccessExpression(expr)) {
            if (expr.questionDotToken)
                unknown();
            return read(expression(expr.expression, frame), nameOf(expr.name), frame);
        }
        if (compiler.isCallExpression(expr)) {
            const callee = unwrap(expr.expression);
            if (compiler.isIdentifier(callee) && external(callee, frame) && !expr.questionDotToken) {
                for (const argument of expr.arguments)
                    prim(compiler.isSpreadElement(argument) ? unknown() : expression(argument, frame));
                frame.fp.external = frame.fp.mayThrow = true;
                // Its result is no own object: nothing it could return was reachable to it.
                return OTHER;
            }
            const listed = readingBuiltin(expr, frame);
            if (listed)
                return listed;
            if (expr.questionDotToken || !compiler.isPropertyAccessExpression(callee) || callee.questionDotToken || expr.arguments.some(argument => compiler.isSpreadElement(argument)))
                unknown();
            const access = callee, base = expression(access.expression, frame);
            return call(base, nameOf(access.name), expr.arguments, frame, frame.top === expr ? sureObjects(access.expression, base, frame) : NONE);
        }
        if (compiler.isBinaryExpression(expr)) {
            const operator = expr.operatorToken.kind, left = expression(expr.left, frame);
            // ADR-032: a known left side decides a short circuit; the right side then runs only if taken.
            if (operator === S.AmpersandAmpersandToken || operator === S.BarBarToken || operator === S.QuestionQuestionToken) {
                if (left.known) {
                    const lit = left.known.lit, takeLeft = operator === S.AmpersandAmpersandToken ? !lit : operator === S.BarBarToken ? !!lit : lit !== null && lit !== undefined;
                    return takeLeft ? left : expression(expr.right, frame);
                }
                return union(left, expression(expr.right, frame));
            }
            const right = expression(expr.right, frame);
            if (operator === S.EqualsEqualsEqualsToken || operator === S.ExclamationEqualsEqualsToken)
                return left.known && right.known ? literal((left.known.lit === right.known.lit) === (operator === S.EqualsEqualsEqualsToken)) : PRIM;
            if (operator >= S.FirstAssignment && operator <= S.LastAssignment || operator === S.CommaToken || operator === S.InKeyword || operator === S.InstanceOfKeyword)
                unknown();
            prim(left);
            prim(right);
            if (left.known && right.known) {
                const folded = fold(operator, left.known.lit, right.known.lit);
                if (folded)
                    return folded;
            }
            // A string operand makes `+` a concatenation.
            return operator === S.PlusToken && (left.text || right.text) ? STR : PRIM;
        }
        if (compiler.isPrefixUnaryExpression(expr)) {
            const operand = expression(expr.operand, frame);
            if (expr.operator === S.ExclamationToken)
                return operand.known ? literal(!operand.known.lit) : PRIM;
            if (expr.operator === S.MinusToken && typeof operand.known?.lit === 'number')
                return literal(-operand.known.lit);
            if (expr.operator === S.PlusPlusToken || expr.operator === S.MinusMinusToken)
                unknown();
            prim(operand);
            return PRIM;
        }
        if (compiler.isTypeOfExpression(expr)) {
            const operand = expression(expr.expression, frame);
            return operand.known ? literal(typeof operand.known.lit) : STR;
        }
        if (compiler.isConditionalExpression(expr)) {
            const test = expression(expr.condition, frame);
            if (test.known)
                return expression(test.known.lit ? expr.whenTrue : expr.whenFalse, frame);
            return union(expression(expr.whenTrue, frame), expression(expr.whenFalse, frame));
        }
        if (compiler.isArrayLiteralExpression(expr)) {
            const id = fresh(frame.self ?? 'S', expr, { kind: 'array' });
            for (const element of expr.elements) {
                if (compiler.isSpreadElement(element) || compiler.isOmittedExpression(element))
                    unknown();
                heap.addElements(id, expression(element, frame));
            }
            heap.created(id);
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
                heap.addField(id, name, expression(property.initializer, frame));
            }
            return objects(id);
        }
        return unknown();
    }
    /** ADR-059 (2d): a global read-only built-in called on own objects; null when the call is no such one.
     * `Object.keys`, `values` and `entries` list an object's own enumerable keys and values: they run no
     * program code (a class's accessors live on its prototype) and cannot throw on an object. Each is a
     * read of the whole object with a fresh array as its result, whose elements are the keys, the field
     * values, or fresh pairs of both. `JSON.stringify` reads every object it reaches; it may throw (a
     * BigInt, a cycle) and runs program code only through `toJSON`, which leaves the subset. */
    function readingBuiltin(expr, frame) {
        const callee = unwrap(expr.expression);
        if (expr.questionDotToken || !compiler.isPropertyAccessExpression(callee) || callee.questionDotToken || !compiler.isIdentifier(callee.expression) || !compiler.isIdentifier(callee.name))
            return null;
        const owner = callee.expression.text, name = callee.name.text;
        if (!(owner === 'Object' && (name === 'keys' || name === 'values' || name === 'entries') || owner === 'JSON' && name === 'stringify'))
            return null;
        if (frame.env.has(owner) || (checker.getSymbolAtLocation(callee.expression)?.declarations ?? []).some(declaration => declaration.getSourceFile() === file))
            return null;
        if (expr.arguments.length !== 1 || compiler.isSpreadElement(expr.arguments[0]))
            unknown();
        const argument = expression(expr.arguments[0], frame);
        if (argument.prim || argument.other || !argument.objs.size)
            unknown();
        const valuesOf = (id) => kinds.get(id).kind === 'array' ? heap.items(id) : union(PRIM, ...heap.fieldValues(id));
        if (name === 'stringify') {
            const seen = new Set(), queue = [...argument.objs];
            while (queue.length) {
                const id = queue.pop();
                if (seen.has(id))
                    continue;
                seen.add(id);
                const kind = kinds.get(id);
                if (heap.hasField(id, 'toJSON') || kind.kind === 'class' && (kind.info.methods.has('toJSON') || kind.info.getters.has('toJSON')))
                    unknown();
                frame.fp.reads.add(at(id, WHOLE));
                const inner = valuesOf(id);
                if (inner.other)
                    unknown();
                queue.push(...inner.objs);
            }
            frame.fp.mayThrow = true;
            return STR;
        }
        const result = fresh(frame.self ?? 'S', expr, { kind: 'array' }), pair = result + '#pair';
        if (name === 'entries' && !kinds.has(pair)) {
            kinds.set(pair, { kind: 'array' });
            heap.touch();
        }
        for (const id of argument.objs) {
            frame.fp.reads.add(at(id, WHOLE));
            if (name === 'keys')
                heap.addElements(result, STR);
            else if (name === 'values')
                heap.addElements(result, valuesOf(id));
            else {
                heap.addElements(pair, union(STR, valuesOf(id)));
                heap.addElements(result, objects(pair));
            }
        }
        return objects(result);
    }
    /** ADR-040: a callee name inside a body (never at list level, policy P2) that is no local of the
     * body and that the program does not declare, or declares only ambiently (`declare function`).
     * Direct `eval` sees the body's `this` and locals, so it is never external. */
    function external(callee, frame) {
        if (frame.self === null || frame.env.has(callee.text) || callee.text === 'eval' || callee.text === 'arguments')
            return false;
        return !(checker.getSymbolAtLocation(callee)?.declarations ?? []).some(declaration => declaration.getSourceFile() === file && !has(declaration, S.DeclareKeyword));
    }
    /** One list-level statement: a construction, or an operation on own objects. */
    function statementFootprint(statement, budget, must) {
        // ADR-031/045: the statements of a constructor body run while `this` is being constructed.
        const frame = { self: null, env: new Map(), fp: { reads: new Set(), writes: new Set(), mayThrow: false, external: false, mayHang: false }, stack: new Set(), budget, must, certain: true, ...self ? { constructing: new Set([self]) } : {} };
        if (compiler.isVariableStatement(statement)) {
            const declaration = statement.declarationList.declarations[0], symbol = checker.getSymbolAtLocation(declaration.name), own = symbol && owned.get(symbol);
            if (!own || own.statement !== statement)
                unknown();
            const init = unwrap(declaration.initializer);
            if (own.kind.kind === 'class')
                construct(own.id, own.kind.info, init.arguments?.map(argument => expression(argument, frame)) ?? [], frame);
            else if (compiler.isArrayLiteralExpression(init)) {
                frame.fp.writes.add(at(own.id, WHOLE));
                heap.literal(own.id, init.elements.map(element => {
                    if (compiler.isSpreadElement(element) || compiler.isOmittedExpression(element))
                        unknown();
                    return expression(element, frame);
                }));
            }
            else {
                frame.fp.writes.add(at(own.id, WHOLE));
                for (const property of init.properties) {
                    if (!compiler.isPropertyAssignment(property))
                        unknown();
                    const name = nameOf(property.name);
                    if (name === undefined || name === '__proto__')
                        unknown();
                    heap.addField(own.id, name, expression(property.initializer, frame));
                }
            }
            return frame.fp;
        }
        // ADR-028: an if/else on own objects, both branches over-approximated; it must not leave the list early.
        if (compiler.isIfStatement(statement) || compiler.isSwitchStatement(statement) || compiler.isTryStatement(statement) || compiler.isForOfStatement(statement) || compiler.isLabeledStatement(statement) || compiler.isWhileStatement(statement) || compiler.isDoStatement(statement) || compiler.isForStatement(statement)) {
            if (leaves(statement))
                unknown();
            block([statement], frame);
            return frame.fp;
        }
        if (!compiler.isExpressionStatement(statement))
            unknown();
        effect(statement.expression, frame);
        return frame.fp;
    }
    /** Whether a return inside `root` (outside nested functions) would leave the list's function. */
    function leaves(root) {
        let found = false;
        const visit = (node) => {
            if (found || compiler.isFunctionLike(node) || compiler.isClassLike(node))
                return;
            if (compiler.isReturnStatement(node)) {
                found = true;
                return;
            }
            compiler.forEachChild(node, visit);
        };
        compiler.forEachChild(root, visit);
        return found;
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
    const selfStatements = new Set();
    const scan = (node, statement) => {
        if (compiler.isIdentifier(node)) {
            const symbol = checker.getSymbolAtLocation(node);
            if (symbol && owned.has(symbol)) {
                if (inNested(node, statement))
                    foreign.add(symbol);
                (occurrences.get(symbol) ?? occurrences.set(symbol, []).get(symbol)).push(statement);
            }
        }
        // The constructor's own `this`; a nested function or class has a `this` of its own.
        if (self && node.kind === S.ThisKeyword && !inNested(node, statement))
            selfStatements.add(statement);
        compiler.forEachChild(node, child => scan(child, statement));
    };
    // A block-scoped const of this list is visible only to the list's statements; a use inside a nested function escapes.
    for (const statement of list)
        scan(statement, statement);
    const escaped = new Set([...foreign].map(symbol => owned.get(symbol).id));
    const budget = { steps: 0 };
    // ADR-031: the state the body starts from, as a construction leaves it.
    if (self) {
        try {
            const frame = { self, env: new Map(), fp: { reads: new Set(), writes: new Set(), mayThrow: false, external: false, mayHang: false }, stack: new Set(), budget };
            for (const [name, initializer] of selfInfo.fields)
                heap.addField(self, name, initializer ? expression(initializer, frame) : PRIM);
            for (const name of selfInfo.parameterFields)
                heap.addField(self, name, OTHER);
        }
        catch (error) {
            if (!(error instanceof Unknown))
                throw error;
            escaped.add(self);
        }
    }
    // Fixpoint: heap facts and footprints, escapes propagating through stored references.
    for (let round = 0; round < 12; round++) {
        heap.startRound();
        result.clear();
        for (const [index, statement] of list.entries()) {
            if (compiler.isReturnStatement(statement))
                continue;
            const must = heap.enter(index);
            try {
                const fp = statementFootprint(statement, budget, must);
                heap.leave(true);
                if ([...fp.reads, ...fp.writes].map(objectOf).some(id => escaped.has(id.split('|')[0]) || escaped.has(id)))
                    continue;
                result.set(statement, fp);
            }
            catch (error) {
                if (!(error instanceof Unknown))
                    throw error;
                heap.leave(false);
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
                    heap.touch();
                }
        // Any statement naming `this` without a footprint, a return included, may hand it to unknown code.
        if (self && !escaped.has(self) && [...selfStatements].some(statement => !result.has(statement))) {
            escaped.add(self);
            heap.touch();
        }
        for (const id of [...escaped]) {
            for (const value of heap.held(id))
                for (const object of value.objs)
                    if (!escaped.has(object)) {
                        escaped.add(object);
                        heap.touch();
                    }
        }
        if (!heap.changed)
            return result;
    }
    result.clear();
    return result;
}
/** Why two footprinted statements must keep their order; empty when they commute. */
export function footprintConflicts(a, b) {
    // ADR-028: fields of one object meet when equal or when either side is the whole object.
    const field = (key) => key.slice(key.lastIndexOf('::') + 2);
    const meets = (x, y) => [...x].some(p => [...y].some(q => objectOf(p) === objectOf(q) && (field(p) === WHOLE || field(q) === WHOLE || field(p) === field(q))));
    const found = [];
    // ADR-028: only two possible throws race for the surfacing exception. A statement that cannot
    // throw touches only this list's own, unescaped objects, which no one observes once the other
    // throws out of the block, and any state the throw depends on is a read conflict below.
    // ADR-040: two external calls write outside state in order (and either may throw); an external
    // call may also never return, which orders it with a possible throw like a throw of its own.
    // ADR-046: so does a loop not shown to end.
    const abrupt = (f) => f.mayThrow || f.external || f.mayHang;
    if (a.external && b.external)
        found.push('external-call-order');
    else if (abrupt(a) && abrupt(b))
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