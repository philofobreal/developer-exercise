import { inertValue } from './inert-value.js';
import { mergeOrderingEntries } from './ordering-relations.js';
const arrayIndex = (key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295;
export function objectLiteralOrdering(file, compiler, options = {}) {
    const physical = file.text.split('\n'), entries = [], observed = options.keyOrder !== 'ignored';
    // Every identifier by name: a reference anywhere to a name like the variable's counts (shadowing only adds references).
    const references = new Map();
    const collect = (node) => { if (compiler.isIdentifier(node))
        references.set(node.text, [...references.get(node.text) ?? [], node]); compiler.forEachChild(node, collect); };
    collect(file);
    const evaluates = /\beval\b|\bwith\s*\(/.test(file.text);
    const declared = new Map();
    /** The function (or class field, static block, file) whose evaluation runs `node`. */
    const runner = (node) => {
        let current = node.parent;
        while (current && !(compiler.isFunctionLike(current) || compiler.isClassStaticBlockDeclaration(current) || compiler.isPropertyDeclaration(current) || compiler.isSourceFile(current)))
            current = current.parent;
        return current ?? file;
    };
    const declare = (name, binding) => {
        if (!name)
            return;
        if (compiler.isIdentifier(name)) {
            declared.set(name.text, [...declared.get(name.text) ?? [], binding]);
            return;
        }
        // A destructured binding: every name in it is initialised with the whole declaration, like a plain one.
        if (compiler.isObjectBindingPattern(name) || compiler.isArrayBindingPattern(name))
            for (const element of name.elements)
                if (compiler.isBindingElement(element))
                    declare(element.name, binding);
    };
    const bindings = (node) => {
        if (compiler.isVariableDeclaration(node)) {
            const list = node.parent, holder = list.parent;
            // `await using` is `const | using` in the flags: compare the block-scoped bits as a whole.
            const scoped = compiler.isVariableDeclarationList(list) ? list.flags & compiler.NodeFlags.BlockScoped : -1;
            if (scoped === -1 || scoped === compiler.NodeFlags.Using || scoped === compiler.NodeFlags.AwaitUsing)
                declare(node.name, { kind: 'other', node, scope: file });
            else if (!scoped)
                declare(node.name, { kind: 'var', node, scope: runner(node) });
            // A loop head's binding is read safely only in the loop body (`for (const x of {a: x})` reads it in its zone).
            else if (compiler.isForStatement(holder) || compiler.isForOfStatement(holder) || compiler.isForInStatement(holder))
                declare(node.name, { kind: 'let', node, scope: holder.statement });
            // A switch clause's binding lives in the whole switch body, which control may enter past its initialisation.
            else
                declare(node.name, compiler.isCaseClause(holder.parent) || compiler.isDefaultClause(holder.parent) ? { kind: 'let', node, scope: holder.parent.parent, clause: true } : { kind: 'let', node, scope: holder.parent });
        }
        else if (compiler.isParameter(node)) {
            const owner = node.parent;
            declare(node.name, compiler.isFunctionLike(owner) && 'body' in owner && owner.body ? { kind: 'param', node, scope: owner.body } : { kind: 'other', node, scope: file });
        }
        else if (compiler.isFunctionDeclaration(node)) {
            const owner = node.parent, top = compiler.isSourceFile(owner) || compiler.isBlock(owner) && compiler.isFunctionLike(owner.parent);
            declare(node.name, top ? { kind: 'function', node, scope: owner } : { kind: 'other', node, scope: file });
        }
        else if (compiler.isClassDeclaration(node))
            declare(node.name, compiler.isCaseClause(node.parent) || compiler.isDefaultClause(node.parent) ? { kind: 'let', node, scope: node.parent.parent, clause: true } : { kind: 'let', node, scope: node.parent });
        else if (compiler.isFunctionExpression(node) || compiler.isClassExpression(node) || compiler.isEnumDeclaration(node) || compiler.isImportEqualsDeclaration(node) || compiler.isImportClause(node) || compiler.isNamespaceImport(node) || compiler.isImportSpecifier(node) || compiler.isModuleDeclaration(node) && compiler.isIdentifier(node.name))
            declare(node.name, { kind: 'other', node, scope: file });
        else if (compiler.isCatchClause(node) && node.variableDeclaration) {
            declare(node.variableDeclaration.name, { kind: 'other', node, scope: file });
            compiler.forEachChild(node.block, bindings);
            return;
        }
        compiler.forEachChild(node, bindings);
    };
    bindings(file);
    const within = (inner, outer) => inner.getStart(file) >= outer.getStart(file) && inner.end <= outer.end;
    /** A read of `name` (an identifier used as a value) that runs no code and cannot throw: it resolves to the innermost
     *  declaration whose scope holds it; a var, parameter or function declaration has no temporal dead zone, a let, const
     *  or class is passed before the read in the same function (not in a switch clause). */
    let risky;
    const safeRead = (name) => {
        const found = declared.get(name.text) ?? [];
        if (evaluates || found.some(binding => binding.kind === 'other'))
            return false;
        const holding = found.filter(binding => within(name, binding.scope));
        if (!holding.length)
            return !found.length && ['undefined', 'NaN', 'Infinity'].includes(name.text);
        const size = (binding) => binding.scope.end - binding.scope.getStart(file);
        const smallest = Math.min(...holding.map(size)), innermost = holding.filter(binding => size(binding) === smallest);
        if (innermost.every(binding => binding.kind === 'var' || binding.kind === 'param' || binding.kind === 'function'))
            return true;
        if (innermost.length !== 1)
            return false;
        const binding = innermost[0];
        if (!binding.clause && binding.node.end <= name.getStart(file) && runner(binding.node) === runner(name))
            return true;
        // Not proven initialised: reading a lexical binding still runs no code, it may only throw its ReferenceError.
        risky?.add(binding);
        return !!risky;
    };
    /** The literal stays in its variable: each other occurrence of the name is the object of a member access, not called. */
    const contained = (node) => {
        const declaration = node.parent;
        if (evaluates || !compiler.isVariableDeclaration(declaration) || declaration.initializer !== node || !compiler.isIdentifier(declaration.name))
            return false;
        const statement = declaration.parent.parent;
        if (!compiler.isVariableStatement(statement) || compiler.isSourceFile(statement.parent) || compiler.isModuleBlock(statement.parent))
            return false;
        const own = declaration.name;
        return (references.get(own.text) ?? []).every(reference => {
            if (reference === own)
                return true;
            const access = reference.parent;
            if (!(compiler.isPropertyAccessExpression(access) || compiler.isElementAccessExpression(access)) || access.expression !== reference)
                return false;
            return !(compiler.isCallExpression(access.parent) && access.parent.expression === access);
        });
    };
    const rowOf = (position) => file.getLineAndCharacterOfPosition(position).line;
    const braces = (row) => physical[row]?.match(/[{}]/g)?.length ?? 0;
    /** The literal's property rows, or undefined when the literal does not qualify. */
    const propertyRows = (node, open, close) => {
        const rows = [], keys = new Set(), last = node.properties.length - 1;
        // A lexical binding not proven initialised may throw where it is read; with one such binding the order of the
        // rows decides nothing (the same error, or none), with two it decides which error is thrown.
        risky = new Set();
        for (const [i, property] of node.properties.entries()) {
            // NY-35: the shorthand `{ name }` is `name: name`; one with a default (`{ a = 1 }`) is only a pattern.
            const shorthand = compiler.isShorthandPropertyAssignment(property) && !property.objectAssignmentInitializer;
            if (!compiler.isPropertyAssignment(property) && !shorthand)
                return undefined;
            const name = property.name;
            const key = compiler.isIdentifier(name) || compiler.isStringLiteral(name) ? name.text : compiler.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
            const inert = compiler.isPropertyAssignment(property) ? inertValue(property.initializer, compiler, safeRead) : compiler.isIdentifier(name) && safeRead(name);
            if (key === undefined || key === '__proto__' || keys.has(key) || !inert)
                return undefined;
            keys.add(key);
            const row = rowOf(property.getStart(file)), comma = i < last || node.properties.hasTrailingComma;
            if (row !== rowOf(property.end - 1) || physical[row]?.trim() !== property.getText(file) + (comma ? ',' : ''))
                return undefined;
            rows.push({ row, key, comma });
        }
        if (risky.size > 1)
            return undefined;
        const owned = new Set(rows.map(entry => entry.row));
        for (let row = open + 1; row < close; row++)
            if (physical[row]?.trim() && !owned.has(row))
                return undefined;
        return rows;
    };
    const visit = (node) => {
        if (compiler.isObjectLiteralExpression(node) && node.properties.length > 1) {
            const children = node.getChildren(file), openToken = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), closeToken = children.find(child => child.kind === compiler.SyntaxKind.CloseBraceToken);
            const open = openToken ? rowOf(openToken.getStart(file)) : -1, close = closeToken ? rowOf(closeToken.getStart(file)) : -1;
            const bounded = open >= 0 && close > open + 1 && braces(open) === 1 && braces(close) === 1 && !!physical[open]?.trimEnd().endsWith('{') && !!physical[close]?.trim().startsWith('}');
            const rows = bounded ? propertyRows(node, open, close) : undefined;
            if (rows) {
                const tail = rows.at(-1).comma ? undefined : rows.at(-1), keyed = observed && !contained(node);
                let previousKey;
                for (const property of rows) {
                    const reasons = [{ before: open, code: 'block-open' }];
                    if (keyed && !arrayIndex(property.key)) {
                        if (previousKey)
                            reasons.push({ before: previousKey.row, code: 'reflected-key-order' });
                        previousKey = property;
                    }
                    if (property === tail)
                        for (const other of rows)
                            if (other !== tail)
                                reasons.push({ before: other.row, code: 'list-tail' });
                    entries.push({ row: property.row, after: [...new Set(reasons.map(reason => reason.before))], reasons });
                }
                entries.push({ row: close, after: rows.map(property => property.row), reasons: rows.map(property => ({ before: property.row, code: 'block-close' })) });
            }
        }
        compiler.forEachChild(node, visit);
    };
    visit(file);
    return { entries: mergeOrderingEntries(entries) };
}
//# sourceMappingURL=object-literal-ordering.js.map