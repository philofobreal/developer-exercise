/** ADR-029: a value whose evaluation runs no code and cannot throw: a literal, a signed number, or a fresh array or
 * object of such values (no spread, no hole, no `__proto__` key). Class field initialisers (type-member-ordering) and,
 * since v54 (ADR-128), object-literal properties (object-literal-ordering) are free of each other only with such a value. */
import type ts from 'typescript';

export function inertValue(raw: ts.Expression, compiler: typeof ts): boolean {
 const expr = compiler.isParenthesizedExpression(raw) || compiler.isAsExpression(raw) || compiler.isSatisfiesExpression(raw) ? raw.expression : raw;
 if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || compiler.isNumericLiteral(expr) || compiler.isBigIntLiteral(expr) || [compiler.SyntaxKind.TrueKeyword, compiler.SyntaxKind.FalseKeyword, compiler.SyntaxKind.NullKeyword].includes(expr.kind)) return true;
 if (compiler.isPrefixUnaryExpression(expr)) return (expr.operator === compiler.SyntaxKind.MinusToken || expr.operator === compiler.SyntaxKind.PlusToken) && compiler.isNumericLiteral(expr.operand);
 if (compiler.isArrayLiteralExpression(expr)) return expr.elements.every(element => !compiler.isSpreadElement(element) && !compiler.isOmittedExpression(element) && inertValue(element, compiler));
 if (compiler.isObjectLiteralExpression(expr)) return expr.properties.every(property => compiler.isPropertyAssignment(property) && (compiler.isIdentifier(property.name) || compiler.isStringLiteral(property.name)) && property.name.text !== '__proto__' && inertValue(property.initializer, compiler));
 return false;
}
