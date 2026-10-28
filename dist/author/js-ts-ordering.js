import { statementOrdering } from './statement-ordering.js';
import { typeMemberOrdering } from './type-member-ordering.js';
import { combineOrderingRelations } from './ordering-relations.js';
/** Brace-delimited blocks as 0-based row intervals. A block of an if/else, try,
 * catch or finally clause is marked `clause`: its boundary row may be shared with
 * the next clause (`} else {`), which the projection represents as a separator. */
export function jsTsStructure(file, compiler) {
    const result = [];
    const visit = (node) => {
        const eligible = compiler.isBlock(node) || compiler.isModuleBlock(node) || compiler.isClassLike(node) || compiler.isInterfaceDeclaration(node) || compiler.isTypeLiteralNode(node) || compiler.isObjectLiteralExpression(node) || compiler.isEnumDeclaration(node);
        if (eligible) {
            const children = node.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
            if (open && close) {
                const clause = compiler.isBlock(node) && (compiler.isIfStatement(node.parent) || compiler.isTryStatement(node.parent) || compiler.isCatchClause(node.parent));
                result.push({ start: file.getLineAndCharacterOfPosition(open.getStart(file)).line, end: file.getLineAndCharacterOfPosition(close.getStart(file)).line, kind: compiler.isBlock(node) && compiler.isFunctionLike(node.parent) ? 'function' : 'block', ...(clause ? { clause: true } : {}) });
            }
        }
        compiler.forEachChild(node, visit);
    };
    visit(file);
    return result;
}
/** The emit and runtime assumptions behind the JS/TS analysis (ADR-015): the compiler that
 * analysed it, the TypeScript import emit, script or module semantics (as the global-order
 * rule decides it) and class-field-mode independence (ADR-012 holds in both modes). */
export function jsTsEnvironment(file, compiler, options = {}) {
    return { typescript: compiler.version, ...(file.fileName.endsWith('.ts') ? { importEmit: options.imports ?? 'verbatim' } : {}), sourceKind: compiler.isExternalModule(file) ? 'module' : 'script', classFields: 'either' };
}
/** Names through which a program can list non-enumerable or global keys in creation order. */
const keyReflection = /\b(?:getOwnPropertyNames|ownKeys|getOwnPropertyDescriptors|Reflect|globalThis|window|self|frames|global|Function|eval)\b/;
/** ADR-020: whether the program itself may observe the creation order of method,
 * accessor or top-level function keys: it names a reflection API or the global
 * object (also inside strings, which only makes it stricter), or uses `this` at
 * script level, where it is the global object. */
export function observesKeyOrder(file, compiler) {
    if (keyReflection.test(file.text))
        return true;
    let found = false;
    const visit = (node) => {
        if (found || compiler.isClassLike(node) || compiler.isFunctionLike(node) && !compiler.isArrowFunction(node))
            return;
        if (node.kind === compiler.SyntaxKind.ThisKeyword) {
            found = true;
            return;
        }
        compiler.forEachChild(node, visit);
    };
    if (!compiler.isExternalModule(file))
        visit(file);
    return found;
}
/** Names and forms through which a program lists enumerable keys in creation order (also inside
 * strings, which only makes it stricter): key listing, serialisation, copying, printing, for…in
 * and any spread. */
const keyEnumeration = /\b(?:keys|values|entries|stringify|assign|structuredClone|console|inspect)\b|\.\.\.|\bfor\s*\([^)]*\bin\b/;
/** ADR-029: whether the program itself may observe the creation order of instance fields. */
export function enumeratesKeys(file, compiler) {
    return observesKeyOrder(file, compiler) || keyEnumeration.test(file.text);
}
/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module. */
export function jsTsOrderingRelations(file, compiler, options = {}) {
    const reflectedKeys = observesKeyOrder(file, compiler), enumeratedKeys = enumeratesKeys(file, compiler);
    const statements = statementOrdering(file, compiler, { ...(file.fileName.endsWith('.ts') ? options : {}), reflectedKeys }), members = typeMemberOrdering(file, compiler, { reflectedKeys, enumeratedKeys });
    return combineOrderingRelations([
        { entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({ first, last }) => ({ first, last })), note: '' },
        { entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note }
    ]);
}
//# sourceMappingURL=js-ts-ordering.js.map