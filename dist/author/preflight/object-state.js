export function objectStateOf(facts) {
    const { compiler, file, checker } = facts, S = compiler.SyntaxKind;
    const strip = (node) => compiler.isParenthesizedExpression(node) || compiler.isAsExpression(node) || compiler.isSatisfiesExpression(node) ? strip(node.expression) : node;
    const kindOf = (declaration) => {
        if (!declaration.initializer)
            return declaration.parent.flags & compiler.NodeFlags.Let ? { nullish: true, label: 'undefined' } : undefined;
        const value = strip(declaration.initializer);
        switch (value.kind) {
            case S.NullKeyword: return { nullish: true, label: 'null' };
            case S.VoidExpression: return { nullish: true, label: 'undefined' };
            // The built-in `undefined` has a symbol but no declaration; a parameter or binding named so shadows it.
            case S.Identifier: return value.text === 'undefined' && !checker.getSymbolAtLocation(value)?.declarations?.length ? { nullish: true, label: 'undefined' } : undefined;
            case S.NumericLiteral:
            case S.BigIntLiteral: return { nullish: false, label: 'szám' };
            case S.StringLiteral:
            case S.NoSubstitutionTemplateLiteral:
            case S.TemplateExpression: return { nullish: false, label: 'szöveg' };
            case S.TrueKeyword:
            case S.FalseKeyword: return { nullish: false, label: 'logikai érték' };
            case S.ObjectLiteralExpression: return { nullish: false, label: 'objektum' };
            case S.ArrayLiteralExpression: return { nullish: false, label: 'tömb' };
            case S.RegularExpressionLiteral: return { nullish: false, label: 'reguláris kifejezés' };
            default: return undefined;
        }
    };
    const optional = (node) => (node.flags & compiler.NodeFlags.OptionalChain) !== 0 || ('questionDotToken' in node && !!node.questionDotToken);
    /** The operation that throws on the read `id`, and whether it needs a nullish (vs. non-callable) value. */
    const site = (id) => {
        let read = id;
        while (compiler.isParenthesizedExpression(read.parent) || compiler.isNonNullExpression(read.parent) || compiler.isAsExpression(read.parent))
            read = read.parent;
        const p = read.parent;
        if ((compiler.isPropertyAccessExpression(p) || compiler.isElementAccessExpression(p)) && p.expression === read && !optional(p))
            return { node: p, nullish: true, callable: false };
        if ((compiler.isCallExpression(p) || compiler.isNewExpression(p)) && p.expression === read && !optional(p))
            return { node: p, nullish: true, callable: true };
        if (compiler.isVariableDeclaration(p) && p.initializer === read && !compiler.isIdentifier(p.name))
            return { node: p, nullish: true, callable: false };
        if (compiler.isForOfStatement(p) && p.expression === read)
            return { node: read, nullish: true, callable: false };
        if (compiler.isSpreadElement(p) && compiler.isArrayLiteralExpression(p.parent))
            return { node: p, nullish: true, callable: false };
        return undefined;
    };
    const insideFunction = (node, block) => { for (let n = node.parent; n && n !== block; n = n.parent)
        if (compiler.isFunctionLike(n) || compiler.isClassLike(n))
            return true; return false; };
    const findings = [];
    const visitStatements = (node) => {
        if (facts.spent())
            return;
        if (compiler.isVariableStatement(node) && (node.declarationList.flags & (compiler.NodeFlags.Let | compiler.NodeFlags.Const))) {
            const block = facts.blockOf(node);
            if (block)
                for (const declaration of node.declarationList.declarations) {
                    if (!compiler.isIdentifier(declaration.name))
                        continue;
                    const kind = kindOf(declaration), symbol = checker.getSymbolAtLocation(declaration.name);
                    if (!kind || !symbol)
                        continue;
                    const references = facts.references.get(symbol) ?? [], writes = references.filter(id => facts.isWrite(id));
                    if (writes.some(id => insideFunction(id, block)))
                        continue;
                    const firstWrite = Math.min(...writes.map(id => id.pos), Number.POSITIVE_INFINITY), name = declaration.name.text, where = facts.lineOf(declaration);
                    const sites = references.filter(id => id.pos > declaration.end && id.pos < firstWrite && !facts.isWrite(id)).flatMap(id => { const s = site(id); return s && (kind.nullish ? s.nullish : s.callable) ? [s.node] : []; });
                    if (!sites.length)
                        continue;
                    const own = block.statements.indexOf(node);
                    for (const statement of block.statements.slice(own)) {
                        if (facts.spent() || !facts.reachable(statement, block))
                            break;
                        const hit = facts.mustEvaluate(statement, candidate => sites.includes(candidate) && candidate.pos > declaration.end);
                        if (!hit)
                            continue;
                        const at = hit[0], text = at.getText(file).replace(/\s+/g, ' '), shown = text.length > 40 ? text.slice(0, 37) + '…' : text;
                        findings.push(kind.nullish
                            ? { line: facts.lineOf(at), code: 'OS001', certainty: 'definite', origin: 'runtime-value', binding: name, message: `A(z) „${name}” értéke itt biztosan ${kind.label} (${where}. sor), ezért a(z) „${shown}” futáskor biztosan TypeError.` }
                            : { line: facts.lineOf(at), code: 'OS002', certainty: 'definite', origin: 'runtime-value', binding: name, message: `A(z) „${name}” nem függvény, hanem ${kind.label} (${where}. sor), ezért a(z) „${shown}” futáskor biztosan TypeError.` });
                        break;
                    }
                }
        }
        compiler.forEachChild(node, visitStatements);
    };
    visitStatements(file);
    findings.sort((a, b) => a.line - b.line);
    return { completeness: facts.spent() ? 'budget-exceeded' : 'within-supported-scope', findings };
}
//# sourceMappingURL=object-state.js.map