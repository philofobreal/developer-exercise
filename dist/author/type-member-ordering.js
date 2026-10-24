export function typeMemberOrdering(file, compiler) {
    const physical = file.text.split('\n'), entries = [];
    let hasClass = false, hasTypes = false;
    const first = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
    const last = (node) => file.getLineAndCharacterOfPosition(node.end - 1).line;
    const name = (node) => {
        if (!('name' in node))
            return undefined;
        const key = node.name;
        return key && (compiler.isIdentifier(key) || compiler.isStringLiteral(key)) ? key.text : undefined;
    };
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
            const members = node.members.map(member => {
                const key = name(member), row = first(member), end = last(member);
                const modifiers = compiler.canHaveModifiers(member) ? compiler.getModifiers(member) : undefined;
                const erased = compiler.isPropertySignature(member) || compiler.isPropertyDeclaration(member) && !member.initializer && !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.DeclareKeyword);
                const simpleModifiers = modifiers?.every(modifier => [compiler.SyntaxKind.DeclareKeyword, compiler.SyntaxKind.ReadonlyKeyword, compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.PrivateKeyword].includes(modifier.kind)) ?? true;
                const decorated = compiler.canHaveDecorators(member) && !!compiler.getDecorators(member)?.length;
                const fullStart = member.getFullStart(), fullRow = file.getLineAndCharacterOfPosition(fullStart).line;
                // Trivia on the previous member's physical row belongs to that member.
                const triviaStart = fullRow < row ? file.getPositionOfLineAndCharacter(fullRow + 1, 0) : fullStart;
                const leadingComment = !!file.text.slice(triviaStart, member.getStart(file)).trim();
                return { first: row, last: end, pure: erased && simpleModifiers && !decorated && !leadingComment && key !== undefined && counts.get(key) === 1 && row === end && physical[row]?.trim() === member.getText(file).trim() };
            });
            // No edits on shared physical boundaries. Comments remain opaque barriers.
            if (open && close && members.every((member, i) => member.first > first(open) && member.last < first(close) && (!i || members[i - 1].last < member.first))) {
                const units = [];
                let cursor = first(open) + 1;
                for (const member of members) {
                    for (; cursor < member.first; cursor++)
                        if (physical[cursor]?.trim())
                            units.push({ first: cursor, last: cursor, pure: false });
                    units.push(member);
                    cursor = member.last + 1;
                }
                for (; cursor < first(close); cursor++)
                    if (physical[cursor]?.trim())
                        units.push({ first: cursor, last: cursor, pure: false });
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
                        for (const member of run)
                            entries.push({ row: member.first, after: [previous] });
                        entries.push({ row: units[end]?.first ?? first(close), after: run.map(member => member.last) });
                    }
                    start = end;
                }
            }
        }
        compiler.forEachChild(node, visit);
    }
    visit(file);
    return { entries, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típusadatmezők és declare osztálymezők felcserélhetők. A rendes osztálymezők és this-értékadások sorrendje megmarad: mezőlétrehozás, kulcssorrend, setter, öröklés és inicializálási hatás is megfigyelhető. Az overloadok, duplikált nevek, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : '' };
}
//# sourceMappingURL=type-member-ordering.js.map