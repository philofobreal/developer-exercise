import { mergeOrderingEntries } from './ordering-relations.js';
import { freeCommentRows } from './comment-rows.js';
/** `reflectedKeys` (ADR-020): the program may list non-enumerable keys, so the ADR-010 key chain applies.
 * `enumeratedKeys` (ADR-029): the program may list enumerable keys, so instance fields keep their order. */
export function typeMemberOrdering(file, compiler, options = {}) {
    const physical = file.text.split('\n'), entries = [], spans = [];
    /** `row` follows every row of `after` for the same reason. */
    const order = (row, after, code) => { entries.push({ row, after, reasons: after.map(before => ({ before, code })) }); };
    let hasClass = false, hasTypes = false;
    const first = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
    const last = (node) => file.getLineAndCharacterOfPosition(node.end - 1).line;
    const name = (node) => {
        // Constructor nodes carry no name property: test them first.
        if (compiler.isConstructorDeclaration(node))
            return 'constructor';
        if (!('name' in node))
            return undefined;
        const key = node.name;
        // Numeric class keys are canonical property keys (ADR-010); type members keep the ADR-007 barrier.
        if (key && compiler.isNumericLiteral(key)) {
            const value = Number(key.text);
            return compiler.isClassLike(node.parent) && Number.isFinite(value) ? String(value) : undefined;
        }
        // v44 (ADR-078): a class member's computed name that is a string literal (`['k5']`) is that key;
        // evaluating it runs no code.
        if (key && compiler.isComputedPropertyName(key) && compiler.isClassLike(node.parent) && (compiler.isStringLiteral(key.expression) || compiler.isNoSubstitutionTemplateLiteral(key.expression)))
            return key.expression.text;
        return key && (compiler.isIdentifier(key) || compiler.isStringLiteral(key) || compiler.isPrivateIdentifier(key)) ? key.text : undefined;
    };
    /** v44 (ADR-078): a member name that is known without evaluating code. */
    const plainNamed = (member) => !!member.name && (!compiler.isComputedPropertyName(member.name) || name(member) !== undefined);
    const arrayIndex = (key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295;
    /** ADR-029: an initialiser that evaluates no code: a literal, or a fresh array/object of such literals. */
    const inert = (raw) => {
        const expr = compiler.isParenthesizedExpression(raw) || compiler.isAsExpression(raw) || compiler.isSatisfiesExpression(raw) ? raw.expression : raw;
        if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || compiler.isNumericLiteral(expr) || compiler.isBigIntLiteral(expr) || [compiler.SyntaxKind.TrueKeyword, compiler.SyntaxKind.FalseKeyword, compiler.SyntaxKind.NullKeyword].includes(expr.kind))
            return true;
        if (compiler.isPrefixUnaryExpression(expr))
            return (expr.operator === compiler.SyntaxKind.MinusToken || expr.operator === compiler.SyntaxKind.PlusToken) && compiler.isNumericLiteral(expr.operand);
        if (compiler.isArrayLiteralExpression(expr))
            return expr.elements.every(element => !compiler.isSpreadElement(element) && !compiler.isOmittedExpression(element) && inert(element));
        if (compiler.isObjectLiteralExpression(expr))
            return expr.properties.every(property => compiler.isPropertyAssignment(property) && (compiler.isIdentifier(property.name) || compiler.isStringLiteral(property.name)) && property.name.text !== '__proto__' && inert(property.initializer));
        return false;
    };
    const definitionModifiers = new Set([compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.PrivateKeyword, compiler.SyntaxKind.StaticKeyword, compiler.SyntaxKind.OverrideKeyword, compiler.SyntaxKind.AbstractKeyword, compiler.SyntaxKind.AsyncKeyword]);
    /** A whole method/accessor/constructor that owns its rows: one row, or `{` on the first and `}` on the last row. */
    const definitionRows = (member) => {
        const body = member.body, row = first(member), end = last(member);
        if (row === end)
            return physical[row]?.trim() === member.getText(file).trim();
        if (!body)
            return false;
        const children = body.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
        return !!open && !!close && first(open) === row && first(close) === end && physical[row]?.trim() === file.text.slice(member.getStart(file), open.end).trim() && physical[end]?.trim() === file.text.slice(close.getStart(file), member.end).trim();
    };
    // v39 (ADR-073): the [[Set]] class-field mode assigns a field, which runs a setter of that name
    // anywhere on the prototype chain: TypeScript with useDefineForClassFields false, and (v40, ADR-074)
    // JavaScript too, whose ES2015 down-level emit assigns fields (ADR-062); a method or field there is a writable data property, which
    // the assignment shadows without running code. The accessor names the base classes may define
    // (get, set, `accessor` fields), when every base is a class declared once in this file without a
    // computed accessor name; otherwise unknown.
    const reshapes = /\.prototype\b|__proto__|defineProperty|setPrototypeOf|\bReflect\b|\bProxy\b/.test(file.text);
    const declarations = new Map();
    const collect = (node) => {
        const named = (compiler.isClassLike(node) || compiler.isFunctionDeclaration(node) || compiler.isVariableDeclaration(node) || compiler.isParameter(node) || compiler.isBindingElement(node) || compiler.isImportSpecifier(node) || compiler.isImportClause(node) || compiler.isNamespaceImport(node) || compiler.isImportEqualsDeclaration(node) || compiler.isEnumDeclaration(node) || compiler.isModuleDeclaration(node)) ? node.name : undefined;
        if (named && compiler.isIdentifier(named))
            declarations.set(named.text, [...declarations.get(named.text) ?? [], node]);
        compiler.forEachChild(node, collect);
    };
    collect(file);
    /** The class `node` extends: a class declared once in this file; `null` when unknown, `undefined` when none. */
    const baseOf = (node) => {
        const heritage = node.heritageClauses?.find(clause => clause.token === compiler.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
        if (!heritage)
            return undefined;
        if (!compiler.isIdentifier(heritage))
            return null;
        const found = declarations.get(heritage.text) ?? [], base = found[0];
        return found.length === 1 && base && compiler.isClassDeclaration(base) ? base : null;
    };
    const baseAccessors = (node, seen = new Set()) => {
        const base = baseOf(node);
        if (base === undefined)
            return new Set();
        if (base === null || seen.has(base))
            return null;
        const inherited = baseAccessors(base, new Set([...seen, node]));
        if (!inherited)
            return null;
        for (const member of base.members) {
            const accessor = compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isPropertyDeclaration(member) && !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
            if (!accessor)
                continue;
            const key = name(member);
            if (key === undefined)
                return null;
            inherited.add(key);
        }
        return inherited;
    };
    /** v42 (ADR-076): code that cannot name the instance under construction: no `this`, no `super`
     * other than the call, no `eval`/`arguments` (a nested function's own `this` counts too). */
    const thisFree = (code) => {
        let free = true;
        const scan = (node) => {
            if (!free)
                return;
            if (node.kind === compiler.SyntaxKind.ThisKeyword || node.kind === compiler.SyntaxKind.SuperKeyword && !(compiler.isCallExpression(node.parent) && node.parent.expression === node) || compiler.isIdentifier(node) && (node.text === 'eval' || node.text === 'arguments')) {
                free = false;
                return;
            }
            compiler.forEachChild(node, scan);
        };
        if (code)
            scan(code);
        return free;
    };
    const decorated = (node) => compiler.canHaveDecorators(node) && !!compiler.getDecorators(node)?.length;
    /** v42 (ADR-076): no code that runs before the own instance fields of `node` can let the instance
     * escape: every class of its chain is declared once in this file without decorators; the base
     * constructors and instance field initialisers cannot name the instance; no assignment there or of a
     * parameter property can run a setter of the chain (a field only in the [[Set]] mode, a parameter
     * property in both: TypeScript assigns it). */
    /** v42 (ADR-076): the accessor names of the chain, or `null` when the construction may leak the instance. */
    const quietConstruction = (node) => {
        const chain = [];
        for (let current = node; current; current = baseOf(current)) {
            if (chain.includes(current) || decorated(current))
                return null;
            chain.push(current);
            if (baseOf(current) === null)
                return null;
        }
        const accessors = new Set();
        for (const owner of chain)
            for (const member of owner.members) {
                if (decorated(member))
                    return null;
                const accessor = compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isPropertyDeclaration(member) && !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
                if (!accessor)
                    continue;
                const key = name(member);
                if (key === undefined)
                    return null;
                accessors.add(key);
            }
        const assigns = options.classFields !== 'define';
        for (const owner of chain)
            for (const member of owner.members) {
                if (compiler.isConstructorDeclaration(member)) {
                    for (const parameter of member.parameters)
                        if (compiler.getModifiers(parameter)?.some(modifier => [compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.PrivateKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.ReadonlyKeyword].includes(modifier.kind)) && (!compiler.isIdentifier(parameter.name) || accessors.has(parameter.name.text)))
                            return null;
                    // The own constructor runs after the own fields; a base one before them.
                    if (owner !== node && !thisFree(member))
                        return null;
                }
                else if (owner !== node && compiler.isPropertyDeclaration(member) && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.StaticKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword)) {
                    if (!thisFree(member.initializer))
                        return null;
                    const auto = !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
                    if (assigns && !auto && !compiler.isPrivateIdentifier(member.name)) {
                        const key = name(member);
                        if (key === undefined || key === '__proto__' || accessors.has(key))
                            return null;
                    }
                }
            }
        return accessors;
    };
    const instanceFootprint = (roots, resolve) => {
        const reads = new Set(), writes = new Set();
        let ok = true;
        const assignment = (kind) => kind >= compiler.SyntaxKind.FirstAssignment && kind <= compiler.SyntaxKind.LastAssignment;
        const role = (access) => {
            let node = access, pattern = false;
            while (compiler.isParenthesizedExpression(node.parent) || compiler.isArrayLiteralExpression(node.parent) || compiler.isSpreadElement(node.parent) || compiler.isSpreadAssignment(node.parent) || compiler.isShorthandPropertyAssignment(node.parent) || compiler.isPropertyAssignment(node.parent) && node.parent.initializer === node || compiler.isObjectLiteralExpression(node.parent)) {
                if (!compiler.isParenthesizedExpression(node.parent))
                    pattern = true;
                node = node.parent;
            }
            const parent = node.parent;
            if (compiler.isBinaryExpression(parent) && parent.left === node && assignment(parent.operatorToken.kind))
                return parent.operatorToken.kind === compiler.SyntaxKind.EqualsToken && !pattern ? 'write' : 'both';
            if ((compiler.isForInStatement(parent) || compiler.isForOfStatement(parent)) && parent.initializer === node)
                return 'both';
            if (pattern)
                return 'read';
            if ((compiler.isPrefixUnaryExpression(parent) || compiler.isPostfixUnaryExpression(parent)) && (parent.operator === compiler.SyntaxKind.PlusPlusToken || parent.operator === compiler.SyntaxKind.MinusMinusToken) || compiler.isDeleteExpression(parent))
                return 'both';
            return 'read';
        };
        const scan = (node, nested) => {
            if (!ok)
                return;
            if (node.kind === compiler.SyntaxKind.SuperKeyword || compiler.isIdentifier(node) && (node.text === 'eval' || node.text === 'arguments')) {
                ok = false;
                return;
            }
            if (node.kind === compiler.SyntaxKind.ThisKeyword) {
                // TypeScript's type-only wrappers (`(this as any).f1`) emit nothing.
                let self = node;
                while (compiler.isParenthesizedExpression(self.parent) || compiler.isAsExpression(self.parent) || compiler.isTypeAssertionExpression(self.parent) || compiler.isNonNullExpression(self.parent) || compiler.isSatisfiesExpression(self.parent))
                    self = self.parent;
                const access = self.parent;
                if (nested || !compiler.isPropertyAccessExpression(access) || access.expression !== self || compiler.isCallExpression(access.parent) && access.parent.expression === access || compiler.isTaggedTemplateExpression(access.parent) && access.parent.tag === access) {
                    ok = false;
                    return;
                }
                const key = access.name.text, how = role(access), runs = resolve(key, how);
                if (!runs) {
                    ok = false;
                    return;
                }
                if (how !== 'write')
                    reads.add(key);
                if (how !== 'read')
                    writes.add(key);
                for (const touched of runs.reads)
                    reads.add(touched);
                for (const touched of runs.writes)
                    writes.add(touched);
            }
            compiler.forEachChild(node, child => scan(child, nested || compiler.isFunctionLike(child) || compiler.isClassLike(child)));
        };
        for (const root of roots)
            scan(root, compiler.isFunctionLike(root) || compiler.isClassLike(root));
        return ok ? { reads: [...reads], writes: [...writes] } : undefined;
    };
    const none = { reads: [], writes: [] };
    const union = (a, b) => ({ reads: [...new Set([...a.reads, ...b.reads])], writes: [...new Set([...a.writes, ...b.writes])] });
    function visit(node) {
        if (compiler.isInterfaceDeclaration(node) || compiler.isTypeLiteralNode(node) || compiler.isClassLike(node)) {
            const isClass = compiler.isClassLike(node);
            hasClass ||= isClass;
            hasTypes ||= !isClass;
            const children = node.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
            const counts = new Map();
            for (const member of node.members) {
                const key = name(member);
                if (key !== undefined)
                    counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            const isStatic = (member) => compiler.canHaveModifiers(member) && !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.StaticKeyword);
            // ADR-012: exactly one getter and one setter with bodies, the same name and the same placement form one property.
            const pairs = new Set();
            // v44 (ADR-078): fields of that name may stand beside the pair; a field creates an instance or
            // constructor property when it runs, never a prototype definition, so the pair stays one property.
            if (isClass)
                for (const [key, count] of counts) {
                    if (count < 2)
                        continue;
                    const named = node.members.filter(member => name(member) === key), halves = named.filter(member => !compiler.isPropertyDeclaration(member) || !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword));
                    if (halves.length === 2 && halves.some(member => compiler.isGetAccessorDeclaration(member) && !!member.body) && halves.some(member => compiler.isSetAccessorDeclaration(member) && !!member.body) && isStatic(halves[0]) === isStatic(halves[1]))
                        pairs.add(key);
                }
            // v34 (ADR-068): a name whose every member is a whole method or accessor definition. Each is
            // installed at class definition, before any initialiser or static code runs, so it is free of
            // the fields; the later of two same-key definitions on one object replaces the earlier one.
            const definitionOnly = (member) => (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body && plainNamed(member)
                && !(compiler.canHaveDecorators(member) && compiler.getDecorators(member)?.length) && ((compiler.canHaveModifiers(member) ? compiler.getModifiers(member) : undefined) ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && definitionRows(member);
            // v47 (ADR-083): an `accessor` field defines its get/set pair at class definition among the methods,
            // in member order, replacing what an earlier definition of its key left; its initialiser runs later,
            // with the fields. In a same-key chain it counts by its definition; its field part stays ordered.
            const autoField = (member) => compiler.isPropertyDeclaration(member) && plainNamed(member) && !(compiler.canHaveDecorators(member) && compiler.getDecorators(member)?.length) && !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword) && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword);
            const duplicates = new Set(isClass ? [...counts].filter(([key, count]) => count > 1 && !pairs.has(key) && node.members.every(member => name(member) !== key || definitionOnly(member) || autoField(member))).map(([key]) => key) : []);
            /** ADR-073: the earlier field `this.g` names, when `member`'s initialiser is just that read and `g`
             * is a uniquely named plain field of the same placement that no base can define. */
            const copySource = (member, all) => {
                let read = member.initializer;
                while (compiler.isParenthesizedExpression(read))
                    read = read.expression;
                if (!compiler.isPropertyAccessExpression(read) || read.expression.kind !== compiler.SyntaxKind.ThisKeyword || read.questionDotToken)
                    return undefined;
                const target = read.name.text, index = all.indexOf(member);
                const source = all.find((other, at) => at < index && name(other) === target);
                if (!source || !compiler.isPropertyDeclaration(source) || counts.get(target) !== 1 || isStatic(source) !== isStatic(member) || !source.name || compiler.isComputedPropertyName(source.name))
                    return undefined;
                const sourceModifiers = compiler.getModifiers(source) ?? [];
                if (sourceModifiers.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword || modifier.kind === compiler.SyntaxKind.AbstractKeyword) || compiler.getDecorators(source)?.length)
                    return undefined;
                return assignable(target, source) ? source : undefined;
            };
            // ADR-073: a field assignment in the [[Set]] mode may run code unless no base can define its name.
            // ADR-075: in the `define` mode a field is defined on the instance and runs no inherited setter.
            const inherited = isClass && options.classFields !== 'define' ? baseAccessors(node) : new Set();
            const assignable = (key, member) => key !== '__proto__' && (compiler.isPrivateIdentifier(member.name) || !!inherited && !inherited.has(key));
            const chainAccessors = isClass && !reshapes ? quietConstruction(node) : null, quiet = !!chainAccessors;
            const plainField = (member) => compiler.isPropertyDeclaration(member) && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
            /** v43 (ADR-077), v44 (ADR-078): what accessing instance property `key` runs, as the names that code
             * touches. An own property (a base field already created it) or a prototype method is data; the
             * nearest accessor runs its getter (read) or setter (write), analysed in turn; a getter-only name
             * written, a mix of member kinds, a cycle or an unknown chain is refused. */
            const resolving = new Set();
            const resolve = (key, how) => {
                if (!chainAccessors || key === '__proto__')
                    return undefined;
                if (!chainAccessors.has(key))
                    return none;
                const chain = [];
                for (let current = node; current; current = baseOf(current))
                    chain.push(current);
                if (chain.slice(1).some(owner => owner.members.some(member => !isStatic(member) && name(member) === key && plainField(member))))
                    return none;
                for (const owner of chain) {
                    const named = owner.members.filter(member => !isStatic(member) && name(member) === key && !plainField(member));
                    if (!named.length)
                        continue;
                    // The definitions install in member order and their order is kept (duplicate-definition-order):
                    // the property is what the last ones leave. A method or `accessor` field replaces the property; a
                    // getter or setter replaces one half of an accessor property, or a data property as a whole.
                    let getter, setter, data = false;
                    for (const member of named) {
                        if (compiler.isMethodDeclaration(member) || compiler.isPropertyDeclaration(member)) {
                            data = true;
                            getter = setter = undefined;
                            continue;
                        }
                        if (!(compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) || !member.body)
                            return undefined;
                        if (data) {
                            data = false;
                            getter = setter = undefined;
                        }
                        if (compiler.isGetAccessorDeclaration(member))
                            getter = member;
                        else
                            setter = member;
                    }
                    // An `accessor` field's halves only read and write its private storage.
                    if (data)
                        return none;
                    const getters = getter ? [getter] : [], setters = setter ? [setter] : [];
                    const run = (accessor) => {
                        if (!accessor)
                            return none;
                        if (resolving.has(accessor))
                            return undefined;
                        resolving.add(accessor);
                        const result = instanceFootprint(accessor.getChildren(file), resolve);
                        resolving.delete(accessor);
                        return result;
                    };
                    const read = how === 'write' ? none : run(getters[0]), write = how === 'read' ? none : setters[0] ? run(setters[0]) : undefined;
                    return read && write ? union(read, write) : undefined;
                }
                return undefined;
            };
            const members = node.members.map(member => {
                const key = name(member), row = first(member), end = last(member);
                const modifiers = compiler.canHaveModifiers(member) ? compiler.getModifiers(member) : undefined;
                // v50 (ADR-087): a method signature of an interface or type literal is erased too; a unique name
                // (`distinct` below) leaves out overloads, whose order overload resolution reads.
                const erased = compiler.isPropertySignature(member) || compiler.isMethodSignature(member) || compiler.isPropertyDeclaration(member) && !member.initializer && !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.DeclareKeyword);
                const simpleModifiers = modifiers?.every(modifier => [compiler.SyntaxKind.DeclareKeyword, compiler.SyntaxKind.ReadonlyKeyword, compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.PrivateKeyword].includes(modifier.kind)) ?? true;
                const decorated = compiler.canHaveDecorators(member) && !!compiler.getDecorators(member)?.length;
                const fullStart = member.getFullStart(), fullRow = file.getLineAndCharacterOfPosition(fullStart).line;
                // Trivia on the previous member's physical row belongs to that member.
                const triviaStart = fullRow < row ? file.getPositionOfLineAndCharacter(fullRow + 1, 0) : fullStart;
                const leadingComment = !!file.text.slice(triviaStart, member.getStart(file)).trim();
                const paired = key !== undefined && pairs.has(key);
                const duplicate = !leadingComment && key !== undefined && duplicates.has(key);
                const distinct = !decorated && !leadingComment && key !== undefined && (counts.get(key) === 1 || paired || duplicate);
                const definition = isClass && (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isConstructorDeclaration(member)) && (!!member.body || !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword)) && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && distinct && definitionRows(member);
                const pure = erased && simpleModifiers && distinct && row === end && physical[row]?.trim() === member.getText(file).trim();
                // An emitted method/accessor creates a key unless it is private or an array index; a computed key is unknown, so ordered.
                // An `accessor` field defines its get/set pair at class definition among the methods; it stays a field for its initialiser.
                const autoAccessor = compiler.isPropertyDeclaration(member) && !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword) && !modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword);
                const emitted = isClass && ((compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body || autoAccessor);
                const reflected = emitted && !(member.name && compiler.isPrivateIdentifier(member.name)) && !(key !== undefined && arrayIndex(key));
                // ADR-012 phases: a named field initialises in its placement's phase; a computed
                // method/accessor key is evaluated at definition, before any initialiser runs.
                const plainName = plainNamed(member);
                const phases = !isClass || decorated || leadingComment ? undefined
                    : compiler.isPropertyDeclaration(member) && plainName && !erased ? [isStatic(member) ? 'static' : 'instance']
                        : compiler.isClassStaticBlockDeclaration(member) ? ['static']
                            : (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body && !plainName ? ['key'] : undefined;
                // A declare field emits nothing in either class-field mode: it is position-free in a class body.
                // A plain method row: a candidate overload signature or implementation (ADR-020).
                const plain = isClass && compiler.isMethodDeclaration(member) && !decorated && !leadingComment && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && (member.body ? definitionRows(member) : row === end && physical[row]?.trim() === member.getText(file).trim());
                // ADR-029: a uniquely named instance field that runs no code creates only its key; unless the program enumerates keys, that order is unobserved.
                // v34 (ADR-068): likewise a static field (a key of the constructor) and an `accessor` field, whose
                // initialiser only fills a private storage; its get/set key is created at definition (the key chain).
                // v44 (ADR-078): a private field is never listed, so it is loose even when the program lists keys.
                const loose = (!options.enumeratedKeys || !!member.name && compiler.isPrivateIdentifier(member.name)) && phases?.length === 1 && key !== undefined && counts.get(key) === 1 && compiler.isPropertyDeclaration(member) && assignable(key, member) && (!member.initializer || inert(member.initializer));
                // v39 (ADR-073): a field that copies an earlier own data field of the same placement (`f = this.g`)
                // runs no code either: `g` is then an own data property (defined, or assigned without a setter on
                // the chain), so the read runs no getter. It follows `g`, but no other loose field.
                const copied = !loose && !options.enumeratedKeys && !reshapes && phases?.length === 1 && phases[0] !== 'key' && key !== undefined && counts.get(key) === 1 && compiler.isPropertyDeclaration(member) && !autoAccessor && assignable(key, member) && member.initializer ? copySource(member, node.members) : undefined;
                // v42 (ADR-076): an instance field whose initialiser cannot name the instance, in a construction
                // that cannot leak it before: its code cannot observe the loose fields, only other code.
                const candidate = quiet && !loose && !copied && phases?.length === 1 && phases[0] === 'instance' && key !== undefined && counts.get(key) === 1 && compiler.isPropertyDeclaration(member) && !autoAccessor && !modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.DeclareKeyword || modifier.kind === compiler.SyntaxKind.AbstractKeyword);
                // v44 (ADR-078): an initialiser may read the instance through `this.name`, with what that runs.
                const initial = candidate ? member.initializer ? instanceFootprint([member.initializer], resolve) : none : undefined;
                // v43 (ADR-077): a field that may run a base setter is detached too, with what that setter touches.
                const assigned = initial && !assignable(key, member) ? resolve(key, 'write') : none;
                const footprint = initial && assigned ? union(initial, assigned) : undefined;
                // v44 (ADR-078): when the program lists keys, a public field that runs no code is not loose; it
                // stays ordered with every other public field (its key), but not with the private loose fields.
                const detached = !!footprint && (!assignable(key, member) || !!member.initializer || !!options.enumeratedKeys);
                return { first: row, last: end, pure, plain, free: definition || isClass && pure, ...((definition || autoAccessor) && duplicate ? { sameKey: key + (isStatic(member) ? ' static' : ' prototype'), ...(compiler.isGetAccessorDeclaration(member) ? { half: 'get' } : compiler.isSetAccessorDeclaration(member) ? { half: 'set' } : {}) } : {}), ...(reflected ? { reflect: isStatic(member) ? 'static' : 'prototype' } : {}), ...(phases ? { phases } : {}), ...(definition && paired ? { pair: key } : {}), ...(loose || copied ? { loose: true } : {}), ...(copied ? { copies: last(copied) } : {}), ...(loose || copied ? { touches: { reads: copied ? [name(copied)] : [], writes: [key] } } : {}), ...(detached ? { detached: true, ...(footprint ? { footprint } : {}) } : {}) };
            });
            // An overload signature must directly precede the next signature or the
            // implementation (TS2389/TS2391): the whole group is one unit. Its signatures are
            // erased, so a group of plain rows whose name occurs nowhere else is one method
            // definition, free like any other (ADR-020); otherwise the group stays ordered.
            const signature = (member) => (compiler.isMethodDeclaration(member) || compiler.isConstructorDeclaration(member)) && !member.body && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword);
            const grouped = [], sizes = [];
            members.forEach((member, i) => {
                const previous = node.members[i - 1];
                if (isClass && previous && signature(previous) && name(previous) === name(node.members[i])) {
                    const head = grouped.pop(), size = sizes.pop() + 1, key = name(node.members[i]);
                    const definition = !!head.plain && !!member.plain && !!node.members[i].body && key !== undefined && counts.get(key) === size;
                    // v45 (ADR-079): the signatures are the header of the implementation's body block.
                    const implemented = !!node.members[i].body;
                    grouped.push({ first: head.first, last: member.last, pure: false, plain: !!head.plain && !!member.plain, ...(implemented ? { header: 'overload-group' } : {}), ...(definition ? { free: true } : {}), ...(member.reflect ? { reflect: member.reflect } : {}) });
                    sizes.push(size);
                }
                else {
                    grouped.push(member);
                    sizes.push(1);
                }
            });
            // No edits on shared physical boundaries. A row with one complete comment is free (ADR-025);
            // other non-member rows remain opaque barriers.
            if (open && close && grouped.every((member, i) => member.first > first(open) && member.last < first(close) && (!i || grouped[i - 1].last < member.first))) {
                const units = [], free = [];
                let cursor = first(open) + 1;
                const gap = (until) => {
                    const comments = freeCommentRows(file, compiler, cursor, until - 1);
                    for (; cursor < until; cursor++)
                        if (physical[cursor]?.trim())
                            (comments.has(cursor) ? free : units).push({ first: cursor, last: cursor, pure: false });
                };
                for (const member of grouped) {
                    gap(member.first);
                    (member.free ? free : units).push(member);
                    cursor = member.last + 1;
                }
                gap(first(close));
                // Definitions only need the class open; the remaining units keep their own order,
                // wired explicitly so that no barrier inherits a definition's row as predecessor.
                const wired = new Set();
                for (const member of free)
                    order(member.first, [first(open)], 'block-open');
                // v44 (ADR-078): a getter and a setter next to each other in a same-key chain merge into one
                // accessor property in either order; the next definition follows both.
                const defined = new Map();
                for (const member of grouped)
                    if (member.sameKey) {
                        const chain = defined.get(member.sameKey) ?? { last: [], before: [] };
                        const joins = !!member.half && chain.last.length === 1 && !!chain.last[0].half && chain.last[0].half !== member.half;
                        const predecessors = joins ? chain.before : chain.last;
                        if (predecessors.length)
                            order(member.first, predecessors.map(unit => unit.last), 'duplicate-definition-order');
                        defined.set(member.sameKey, joins ? { last: [...chain.last, member], before: chain.before } : { last: [member], before: chain.last });
                    }
                for (const unit of [...units, ...free])
                    spans.push({ first: unit.first, last: unit.last, ...(unit.header ? { header: unit.header } : {}) });
                for (let start = 0; start < units.length;) {
                    if (!units[start].pure) {
                        start++;
                        continue;
                    }
                    let end = start + 1;
                    while (end < units.length && units[end].pure)
                        end++;
                    if (end - start > 1) {
                        const previous = start ? units[start - 1].last : first(open), run = units.slice(start, end);
                        // The run commutes; it stays between its ordered neighbours, which are conservative barriers.
                        for (const member of run) {
                            order(member.first, [previous], 'type-member-barrier');
                            wired.add(member.first);
                        }
                        order(units[end]?.first ?? first(close), run.map(member => member.last), 'type-member-barrier');
                        wired.add(units[end]?.first ?? first(close));
                    }
                    start = end;
                }
                if (isClass) {
                    // ADR-012: a runtime unit follows every earlier unit it shares a phase with, and every
                    // phase-less unit. The latest unit of each phase and the latest phase-less unit imply the rest.
                    const latest = new Map();
                    // v42 (ADR-076): the latest unit of each phase that is not detached; loose fields follow only these.
                    const barrier = new Map();
                    // ADR-029: loose fields of each phase since the latest other unit of that phase; they follow it, but not each other.
                    const loose = new Map([['instance', []], ['static', []]]);
                    // v43 (ADR-077): detached instance fields since the latest barrier; a loose field meets those that touch its names.
                    let detachedSince = [];
                    // Two units meet when one writes a name the other reads or writes; a loose field always has `touches`.
                    const meets = (a, b) => { const f = a.footprint, t = b.touches; return !!f && (f.writes.some(touched => t.reads.includes(touched) || t.writes.includes(touched)) || t.writes.some(touched => f.reads.includes(touched))); };
                    // A shared phase is an evaluation order; a phase-less unit on either side is conservative.
                    for (const unit of units) {
                        const reasons = [];
                        // A detached field counts only while no unit before it may have let the instance escape.
                        const detached = !!unit.detached && !barrier.has('instance') && !barrier.has('none');
                        for (const [key, other] of unit.loose ? barrier : latest)
                            if (!unit.phases || key === 'none' || unit.phases.includes(key))
                                reasons.push({ before: other.last, code: unit.phases && key !== 'none' ? 'class-evaluation-order' : 'unclassified-member' });
                        // Any other unit that runs in a phase (or may) follows every loose field of it: its code could observe them.
                        if (!unit.loose && !detached)
                            for (const [phase, fields] of loose)
                                if (!unit.phases || unit.phases.includes(phase))
                                    for (const field of fields)
                                        reasons.push({ before: field.last, code: unit.phases ? 'class-evaluation-order' : 'unclassified-member' });
                        if (unit.copies !== undefined)
                            reasons.push({ before: unit.copies, code: 'class-evaluation-order' });
                        if (detached)
                            for (const field of loose.get('instance'))
                                if (meets(unit, field))
                                    reasons.push({ before: field.last, code: 'class-evaluation-order' });
                        if (unit.loose)
                            for (const other of detachedSince)
                                if (unit.phases.includes('instance') && meets(other, unit))
                                    reasons.push({ before: other.last, code: 'class-evaluation-order' });
                        entries.push(reasons.length ? { row: unit.first, after: [...new Set(reasons.map(reason => reason.before))], reasons } : { row: unit.first, after: [first(open)], reasons: [{ before: first(open), code: 'block-open' }] });
                        if (unit.loose) {
                            loose.get(unit.phases[0]).push(unit);
                            continue;
                        }
                        for (const key of unit.phases ?? ['none'])
                            latest.set(key, unit);
                        if (detached) {
                            detachedSince.push(unit);
                            continue;
                        }
                        if (!unit.phases || unit.phases.includes('instance'))
                            detachedSince = [];
                        for (const [phase] of loose)
                            if (!unit.phases || unit.phases.includes(phase))
                                loose.set(phase, []);
                        for (const key of unit.phases ?? ['none'])
                            barrier.set(key, unit);
                    }
                }
                else if (free.length)
                    units.forEach((unit, i) => { if (!wired.has(unit.first))
                        order(unit.first, [i ? units[i - 1].last : first(open)], i ? 'type-member-barrier' : 'block-open'); });
                // Reflectable key order: consecutive key-creating members on the same object stay ordered.
                // The two halves of an accessor pair that are adjacent in that chain create one
                // key at the earlier half and form one group: both follow the previous group and
                // precede the next one, in either order between themselves (ADR-012).
                const chains = new Map();
                if (options.reflectedKeys)
                    for (const member of grouped)
                        if (member.reflect) {
                            const chain = chains.get(member.reflect) ?? { last: [], before: [] };
                            const joins = !!member.pair && chain.last.length === 1 && chain.last[0].pair === member.pair;
                            const predecessors = joins ? chain.before : chain.last;
                            if (predecessors.length)
                                order(member.first, predecessors.map(unit => unit.last), 'reflected-key-order');
                            chains.set(member.reflect, joins ? { last: [...chain.last, member], before: chain.before } : { last: [member], before: chain.last });
                        }
            }
        }
        compiler.forEachChild(node, visit);
    }
    visit(file);
    // Several constraints on one row are a conjunction.
    return { entries: mergeOrderingEntries(entries), spans, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típustagok (adatmezők és metódusszignatúrák) felcserélhetők. A constructor, a declare mezők, a privát (#) és a tömbindex nevű metódusok bárhol állhatnak. A többi metódus és accessor is szabad; csak ha a program listázza a nem felsorolható kulcsokat (getOwnPropertyNames, Reflect.ownKeys), tartják meg a kulcssorrendjüket. Az azonos nevű getter és setter egy tulajdonság. A példány- és a static mezők egymáshoz képest szabadok; csoportjukon belül sorrendben maradnak, kivéve a kódot nem futtató mezőket, ha a program nem listázza a kulcsokat (Object.keys, JSON.stringify, for…in, spread, console). A számított nevű metódus a mezőkhöz képest szabad. Az azonos nevű metódusok csak egymáshoz képest kötöttek. Az overloadok, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : '' };
}
//# sourceMappingURL=type-member-ordering.js.map