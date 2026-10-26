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
/** `options.imports` describes the TypeScript emit (ADR-013); JavaScript imports always load their module. */
export function jsTsOrderingRelations(file, compiler, options = {}) {
    const statements = statementOrdering(file, compiler, file.fileName.endsWith('.ts') ? options : {}), members = typeMemberOrdering(file, compiler);
    return combineOrderingRelations([
        { entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({ first, last }) => ({ first, last })), note: '' },
        { entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note }
    ]);
}
//# sourceMappingURL=js-ts-ordering.js.map