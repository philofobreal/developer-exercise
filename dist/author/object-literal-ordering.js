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
        for (const [i, property] of node.properties.entries()) {
            if (!compiler.isPropertyAssignment(property))
                return undefined;
            const name = property.name;
            const key = compiler.isIdentifier(name) || compiler.isStringLiteral(name) ? name.text : compiler.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
            if (key === undefined || key === '__proto__' || keys.has(key) || !inertValue(property.initializer, compiler))
                return undefined;
            keys.add(key);
            const row = rowOf(property.getStart(file)), comma = i < last || node.properties.hasTrailingComma;
            if (row !== rowOf(property.end - 1) || physical[row]?.trim() !== property.getText(file) + (comma ? ',' : ''))
                return undefined;
            rows.push({ row, key, comma });
        }
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