/** ADR-029: a value whose evaluation runs no code and cannot throw: a literal, a signed number, or a fresh array or
 * object of such values (no spread, no hole, no `__proto__` key). Class field initialisers (type-member-ordering) and,
 * since v54 (ADR-128), object-literal properties (object-literal-ordering) are free of each other only with such a value.
 * v55 (NY-35): `read` lets a caller admit a variable read it has proven to run no code and not to throw. */
import type ts from 'typescript';

export function inertValue(raw: ts.Expression, compiler: typeof ts, read?: (name: ts.Identifier) => boolean): boolean {
 const expr = compiler.isParenthesizedExpression(raw) || compiler.isAsExpression(raw) || compiler.isSatisfiesExpression(raw) ? raw.expression : raw;
 if (read && compiler.isIdentifier(expr)) return read(expr);
 if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || compiler.isNumericLiteral(expr) || compiler.isBigIntLiteral(expr) || [compiler.SyntaxKind.TrueKeyword, compiler.SyntaxKind.FalseKeyword, compiler.SyntaxKind.NullKeyword].includes(expr.kind)) return true;
 if (compiler.isPrefixUnaryExpression(expr)) return (expr.operator === compiler.SyntaxKind.MinusToken || expr.operator === compiler.SyntaxKind.PlusToken) && compiler.isNumericLiteral(expr.operand);
 if (compiler.isArrayLiteralExpression(expr)) return expr.elements.every(element => !compiler.isSpreadElement(element) && !compiler.isOmittedExpression(element) && inertValue(element, compiler, read));
 if (compiler.isObjectLiteralExpression(expr)) return expr.properties.every(property => compiler.isPropertyAssignment(property) && (compiler.isIdentifier(property.name) || compiler.isStringLiteral(property.name)) && property.name.text !== '__proto__' && inertValue(property.initializer, compiler, read));
 return false;
}
