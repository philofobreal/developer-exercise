export function inertValue(raw, compiler, read) {
    const expr = compiler.isParenthesizedExpression(raw) || compiler.isAsExpression(raw) || compiler.isSatisfiesExpression(raw) ? raw.expression : raw;
    if (read && compiler.isIdentifier(expr))
        return read(expr);
    if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || compiler.isNumericLiteral(expr) || compiler.isBigIntLiteral(expr) || [compiler.SyntaxKind.TrueKeyword, compiler.SyntaxKind.FalseKeyword, compiler.SyntaxKind.NullKeyword].includes(expr.kind))
        return true;
    if (compiler.isPrefixUnaryExpression(expr))
        return (expr.operator === compiler.SyntaxKind.MinusToken || expr.operator === compiler.SyntaxKind.PlusToken) && compiler.isNumericLiteral(expr.operand);
    if (compiler.isArrayLiteralExpression(expr))
        return expr.elements.every(element => !compiler.isSpreadElement(element) && !compiler.isOmittedExpression(element) && inertValue(element, compiler, read));
    if (compiler.isObjectLiteralExpression(expr))
        return expr.properties.every(property => compiler.isPropertyAssignment(property) && (compiler.isIdentifier(property.name) || compiler.isStringLiteral(property.name)) && property.name.text !== '__proto__' && inertValue(property.initializer, compiler, read));
    return false;
}
//# sourceMappingURL=inert-value.js.map