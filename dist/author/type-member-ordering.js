export function typeMemberOrdering(file, compiler) {
    const physical = file.text.split('\n'), entries = [], spans = [];
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
        return key && (compiler.isIdentifier(key) || compiler.isStringLiteral(key) || compiler.isPrivateIdentifier(key)) ? key.text : undefined;
    };
    const arrayIndex = (key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295;
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
            if (isClass)
                for (const [key, count] of counts) {
                    if (count !== 2)
                        continue;
                    const both = node.members.filter(member => name(member) === key);
                    if (both.some(member => compiler.isGetAccessorDeclaration(member) && !!member.body) && both.some(member => compiler.isSetAccessorDeclaration(member) && !!member.body) && isStatic(both[0]) === isStatic(both[1]))
                        pairs.add(key);
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
                const paired = key !== undefined && pairs.has(key);
                const distinct = !decorated && !leadingComment && key !== undefined && (counts.get(key) === 1 || paired);
                const definition = isClass && (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isConstructorDeclaration(member)) && (!!member.body || !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword)) && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && distinct && definitionRows(member);
                const pure = erased && simpleModifiers && distinct && row === end && physical[row]?.trim() === member.getText(file).trim();
                // An emitted method/accessor creates a key unless it is private or an array index; a computed key is unknown, so ordered.
                // An `accessor` field defines its get/set pair at class definition among the methods; it stays a field for its initialiser.
                const autoAccessor = compiler.isPropertyDeclaration(member) && !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword) && !modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword);
                const emitted = isClass && ((compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body || autoAccessor);
                const reflected = emitted && !(member.name && compiler.isPrivateIdentifier(member.name)) && !(key !== undefined && arrayIndex(key));
                // ADR-012 phases: a named field initialises in its placement's phase; a computed
                // method/accessor key is evaluated at definition, before any initialiser runs.
                const plainName = !!member.name && !compiler.isComputedPropertyName(member.name);
                const phases = !isClass || decorated || leadingComment ? undefined
                    : compiler.isPropertyDeclaration(member) && plainName && !erased ? [isStatic(member) ? 'static' : 'instance']
                        : compiler.isClassStaticBlockDeclaration(member) ? ['static']
                            : (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body && !plainName ? ['key'] : undefined;
                // A declare field emits nothing in either class-field mode: it is position-free in a class body.
                return { first: row, last: end, pure, free: definition || isClass && pure, ...(reflected ? { reflect: isStatic(member) ? 'static' : 'prototype' } : {}), ...(phases ? { phases } : {}), ...(definition && paired ? { pair: key } : {}) };
            });
            // An overload signature must directly precede the next signature or the
            // implementation (TS2389/TS2391): the whole group is one ordered unit.
            const signature = (member) => (compiler.isMethodDeclaration(member) || compiler.isConstructorDeclaration(member)) && !member.body && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword);
            const grouped = [];
            members.forEach((member, i) => {
                const previous = node.members[i - 1];
                if (isClass && previous && signature(previous) && name(previous) === name(node.members[i]))
                    grouped.push({ first: grouped.pop().first, last: member.last, pure: false, ...(member.reflect ? { reflect: member.reflect } : {}) });
                else
                    grouped.push(member);
            });
            // No edits on shared physical boundaries. Comments remain opaque barriers.
            if (open && close && grouped.every((member, i) => member.first > first(open) && member.last < first(close) && (!i || grouped[i - 1].last < member.first))) {
                const units = [], free = [];
                let cursor = first(open) + 1;
                for (const member of grouped) {
                    for (; cursor < member.first; cursor++)
                        if (physical[cursor]?.trim())
                            units.push({ first: cursor, last: cursor, pure: false });
                    (member.free ? free : units).push(member);
                    cursor = member.last + 1;
                }
                for (; cursor < first(close); cursor++)
                    if (physical[cursor]?.trim())
                        units.push({ first: cursor, last: cursor, pure: false });
                // Definitions only need the class open; the remaining units keep their own order,
                // wired explicitly so that no barrier inherits a definition's row as predecessor.
                const wired = new Set();
                for (const member of free)
                    entries.push({ row: member.first, after: [first(open)] });
                for (const unit of [...units, ...free])
                    spans.push({ first: unit.first, last: unit.last });
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
                        for (const member of run) {
                            entries.push({ row: member.first, after: [previous] });
                            wired.add(member.first);
                        }
                        entries.push({ row: units[end]?.first ?? first(close), after: run.map(member => member.last) });
                        wired.add(units[end]?.first ?? first(close));
                    }
                    start = end;
                }
                if (isClass) {
                    // ADR-012: a runtime unit follows every earlier unit it shares a phase with, and every
                    // phase-less unit. The latest unit of each phase and the latest phase-less unit imply the rest.
                    const latest = new Map();
                    for (const unit of units) {
                        const before = unit.phases ? [latest.get('none'), ...unit.phases.map(phase => latest.get(phase))] : [...latest.values()];
                        const rows = [...new Set(before.flatMap(other => other ? [other.last] : []))];
                        entries.push({ row: unit.first, after: rows.length ? rows : [first(open)] });
                        for (const key of unit.phases ?? ['none'])
                            latest.set(key, unit);
                    }
                }
                else if (free.length)
                    units.forEach((unit, i) => { if (!wired.has(unit.first))
                        entries.push({ row: unit.first, after: [i ? units[i - 1].last : first(open)] }); });
                // Reflectable key order: consecutive key-creating members on the same object stay ordered.
                // The two halves of an accessor pair that are adjacent in that chain create one
                // key at the earlier half and form one group: both follow the previous group and
                // precede the next one, in either order between themselves (ADR-012).
                const chains = new Map();
                for (const member of grouped)
                    if (member.reflect) {
                        const chain = chains.get(member.reflect) ?? { last: [], before: [] };
                        const joins = !!member.pair && chain.last.length === 1 && chain.last[0].pair === member.pair;
                        const predecessors = joins ? chain.before : chain.last;
                        if (predecessors.length)
                            entries.push({ row: member.first, after: predecessors.map(unit => unit.last) });
                        chains.set(member.reflect, joins ? { last: [...chain.last, member], before: chain.before } : { last: [member], before: chain.last });
                    }
            }
        }
        compiler.forEachChild(node, visit);
    }
    visit(file);
    // Several constraints on one row are a conjunction.
    const merged = new Map();
    for (const entry of entries) {
        const after = merged.get(entry.row) ?? new Set();
        entry.after.forEach(row => after.add(row));
        merged.set(entry.row, after);
    }
    return { entries: [...merged].map(([row, after]) => ({ row, after: [...after] })), spans, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típusadatmezők felcserélhetők. A constructor, a declare mezők, a privát (#) és a tömbindex nevű metódusok bárhol állhatnak az osztálytörzsben. A többi metódus és accessor a mezőkhöz képest szabad, de egymáshoz képest megtartja a sorrendjét, mert a prototípus (static esetén a konstruktor) kulcssorrendje reflexióval megfigyelhető; az accessor mező ebben a láncban és a mezők között is a helyén marad. Egy azonos nevű getter és setter egy tulajdonság: egymással felcserélhetők. A példány- és a static mezők egymáshoz képest szabadok, mert más fázisban futnak, de csoportjukon belül megtartják a sorrendet; a számított nevű metódus a mezőkhöz képest szabad. Az overloadok, duplikált nevek, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : '' };
}
//# sourceMappingURL=type-member-ordering.js.map