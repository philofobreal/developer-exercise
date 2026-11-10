const cache = new WeakMap();
export function objectReach(file, compiler) {
    const known = cache.get(file);
    if (known)
        return known;
    const evaluates = /\beval\b|\bwith\s*\(/.test(file.text);
    /** In a type position: an annotation, a type argument, a type declaration, `implements`. It does not run. */
    const inType = (node) => {
        for (let current = node.parent; current && !compiler.isSourceFile(current); current = current.parent) {
            if (compiler.isTypeNode(current) && !compiler.isExpressionWithTypeArguments(current) || compiler.isInterfaceDeclaration(current) || compiler.isTypeAliasDeclaration(current))
                return true;
            if (compiler.isHeritageClause(current))
                return current.token === compiler.SyntaxKind.ImplementsKeyword || compiler.isInterfaceDeclaration(current.parent);
            if (compiler.isStatement(current) || compiler.isClassElement(current))
                return false;
        }
        return false;
    };
    const references = new Map();
    const collect = (node) => { if (compiler.isIdentifier(node) && !inType(node))
        references.set(node.text, [...references.get(node.text) ?? [], node]); compiler.forEachChild(node, collect); };
    collect(file);
    /** The local variable `value` initialises, when it is a plain name in a function or a block. */
    const localVariable = (value) => {
        const declaration = value.parent;
        if (!compiler.isVariableDeclaration(declaration) || declaration.initializer !== value || !compiler.isIdentifier(declaration.name))
            return undefined;
        const statement = declaration.parent.parent;
        if (!compiler.isVariableStatement(statement) || compiler.isSourceFile(statement.parent) || compiler.isModuleBlock(statement.parent))
            return undefined;
        return declaration.name;
    };
    const called = (access) => compiler.isCallExpression(access.parent) && access.parent.expression === access;
    const memberName = (access) => compiler.isPropertyAccessExpression(access) ? access.name.text : undefined;
    /** Every other reference to `own` is the object of a member access; a call only of one of `methods`. */
    const usedAsMember = (own, methods) => (references.get(own.text) ?? []).every(reference => {
        if (reference === own)
            return true;
        const access = reference.parent;
        if (!(compiler.isPropertyAccessExpression(access) || compiler.isElementAccessExpression(access)) || access.expression !== reference)
            return false;
        return !called(access) || methods.has(memberName(access) ?? '');
    });
    const methodsOf = (declaration) => new Set(declaration.members.flatMap(member => compiler.isMethodDeclaration(member) && member.name && (compiler.isIdentifier(member.name) || compiler.isStringLiteral(member.name)) ? [member.name.text] : []));
    /** Every `this` of the class body (outside nested non-arrow functions and classes) is the object of a member access,
     *  called only for one of the class's own methods. */
    const thisStays = (declaration, methods) => {
        let stays = true;
        const visit = (node, top) => {
            if (!stays)
                return;
            if (!top && (compiler.isClassLike(node) || compiler.isFunctionLike(node) && !compiler.isArrowFunction(node) && !compiler.isClassElement(node)))
                return;
            if (node.kind === compiler.SyntaxKind.ThisKeyword) {
                const access = node.parent;
                if (!(compiler.isPropertyAccessExpression(access) || compiler.isElementAccessExpression(access)) || access.expression !== node || called(access) && !methods.has(memberName(access) ?? ''))
                    stays = false;
            }
            compiler.forEachChild(node, child => visit(child, false));
        };
        for (const member of declaration.members)
            visit(member, true);
        return stays;
    };
    const classes = new Map();
    const gather = (node) => { if (compiler.isClassDeclaration(node) && node.name)
        classes.set(node.name.text, [...classes.get(node.name.text) ?? [], node]); compiler.forEachChild(node, gather); };
    gather(file);
    const base = (declaration) => declaration.heritageClauses?.find(clause => clause.token === compiler.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
    /** The class and its ancestors, when every ancestor is a class declared once in this file; undefined otherwise. */
    const chainOf = (declaration) => {
        const chain = [declaration];
        for (let heritage = base(declaration); heritage; heritage = base(chain.at(-1))) {
            const found = compiler.isIdentifier(heritage) ? classes.get(heritage.text) ?? [] : [];
            if (found.length !== 1 || chain.includes(found[0]))
                return undefined;
            chain.push(found[0]);
        }
        return chain;
    };
    const exportedOnly = (declaration) => !!compiler.canHaveModifiers(declaration) && !!compiler.getModifiers(declaration)?.some(modifier => modifier.kind === compiler.SyntaxKind.ExportKeyword || modifier.kind === compiler.SyntaxKind.DefaultKeyword);
    const script = !compiler.isExternalModule(file);
    /** Code outside the program can name the class: an export, or a script's top-level (global) binding. */
    const exported = (declaration) => exportedOnly(declaration) || script && compiler.isSourceFile(declaration.parent);
    /** The class's name as the file uses it: a static member access (not called) or what `use` admits. */
    const usedOnly = (declaration, use) => (references.get(declaration.name.text) ?? []).every(reference => {
        if (reference === declaration.name)
            return true;
        const parent = reference.parent;
        if ((compiler.isPropertyAccessExpression(parent) || compiler.isElementAccessExpression(parent)) && parent.expression === reference)
            return !called(parent);
        return use(reference);
    });
    const created = (reference) => compiler.isNewExpression(reference.parent) && reference.parent.expression === reference ? reference.parent : undefined;
    /** The class a reference names as its base (`class D extends C`). */
    const extendedBy = (reference) => {
        const heritage = reference.parent;
        return compiler.isExpressionWithTypeArguments(heritage) && heritage.expression === reference && compiler.isHeritageClause(heritage.parent) && heritage.parent.token === compiler.SyntaxKind.ExtendsKeyword && compiler.isClassLike(heritage.parent.parent) ? heritage.parent.parent : undefined;
    };
    const staying = new Map();
    const instancesStay = (declaration) => {
        const known = staying.get(declaration);
        if (known !== undefined)
            return known;
        staying.set(declaration, false);
        const chain = evaluates || !compiler.isClassDeclaration(declaration) || !declaration.name ? undefined : chainOf(declaration);
        const methods = new Set(chain?.flatMap(link => [...methodsOf(link)]) ?? []);
        const stays = !!chain && chain.every(link => !exported(link) && thisStays(link, methods)) && usedOnly(declaration, reference => {
            const subclass = extendedBy(reference);
            if (subclass)
                return instancesStay(subclass);
            const creation = created(reference), own = creation && localVariable(creation);
            return !!own && usedAsMember(own, methods);
        });
        staying.set(declaration, stays);
        return stays;
    };
    const reach = {
        literalStays: node => {
            if (evaluates)
                return false;
            const own = localVariable(node);
            return !!own && usedAsMember(own, new Set());
        },
        instancesStay,
        classStays: declaration => !evaluates && compiler.isClassDeclaration(declaration) && !!declaration.name && !exported(declaration) && !base(declaration) && thisStays(declaration, methodsOf(declaration)) && usedOnly(declaration, reference => !!created(reference)),
    };
    cache.set(file, reach);
    return reach;
}
//# sourceMappingURL=object-reach.js.map