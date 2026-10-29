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
        return key && (compiler.isIdentifier(key) || compiler.isStringLiteral(key) || compiler.isPrivateIdentifier(key)) ? key.text : undefined;
    };
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
                // A plain method row: a candidate overload signature or implementation (ADR-020).
                const plain = isClass && compiler.isMethodDeclaration(member) && !decorated && !leadingComment && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && (member.body ? definitionRows(member) : row === end && physical[row]?.trim() === member.getText(file).trim());
                // ADR-029: a uniquely named instance field that runs no code creates only its key; unless the program enumerates keys, that order is unobserved.
                const loose = !options.enumeratedKeys && phases?.length === 1 && phases[0] === 'instance' && !autoAccessor && key !== undefined && counts.get(key) === 1 && compiler.isPropertyDeclaration(member) && (!member.initializer || inert(member.initializer));
                return { first: row, last: end, pure, plain, free: definition || isClass && pure, ...(reflected ? { reflect: isStatic(member) ? 'static' : 'prototype' } : {}), ...(phases ? { phases } : {}), ...(definition && paired ? { pair: key } : {}), ...(loose ? { loose } : {}) };
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
                    grouped.push({ first: head.first, last: member.last, pure: false, plain: !!head.plain && !!member.plain, ...(definition ? { free: true } : {}), ...(member.reflect ? { reflect: member.reflect } : {}) });
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
                    // ADR-029: loose instance fields since the latest other instance unit; they follow it, but not each other.
                    let loose = [];
                    // A shared phase is an evaluation order; a phase-less unit on either side is conservative.
                    for (const unit of units) {
                        const reasons = [];
                        for (const [key, other] of latest)
                            if (!unit.phases || key === 'none' || unit.phases.includes(key))
                                reasons.push({ before: other.last, code: unit.phases && key !== 'none' ? 'class-evaluation-order' : 'unclassified-member' });
                        // Any other unit that runs at construction (or may) follows every loose field: its code could observe them.
                        if (!unit.loose && (!unit.phases || unit.phases.includes('instance')))
                            for (const field of loose)
                                reasons.push({ before: field.last, code: unit.phases ? 'class-evaluation-order' : 'unclassified-member' });
                        entries.push(reasons.length ? { row: unit.first, after: [...new Set(reasons.map(reason => reason.before))], reasons } : { row: unit.first, after: [first(open)], reasons: [{ before: first(open), code: 'block-open' }] });
                        if (unit.loose) {
                            loose.push(unit);
                            continue;
                        }
                        if (!unit.phases || unit.phases.includes('instance'))
                            loose = [];
                        for (const key of unit.phases ?? ['none'])
                            latest.set(key, unit);
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
    return { entries: mergeOrderingEntries(entries), spans, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típusadatmezők felcserélhetők. A constructor, a declare mezők, a privát (#) és a tömbindex nevű metódusok bárhol állhatnak. A többi metódus és accessor is szabad; csak ha a program listázza a nem felsorolható kulcsokat (getOwnPropertyNames, Reflect.ownKeys), tartják meg a kulcssorrendjüket. Az azonos nevű getter és setter egy tulajdonság. A példány- és a static mezők más fázisban futnak, egymáshoz képest szabadok; csoportjukon belül sorrendben maradnak, kivéve a kódot nem futtató példánymezőket, ha a program nem listázza a kulcsokat (Object.keys, JSON.stringify, for…in, spread, console). A számított nevű metódus a mezőkhöz képest szabad. Az overloadok, duplikált nevek, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : '' };
}
//# sourceMappingURL=type-member-ordering.js.map