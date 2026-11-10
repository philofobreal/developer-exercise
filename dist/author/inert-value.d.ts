/** ADR-029: a value whose evaluation runs no code and cannot throw: a literal, a signed number, or a fresh array or
 * object of such values (no spread, no hole, no `__proto__` key). Class field initialisers (type-member-ordering) and,
 * since v54 (ADR-128), object-literal properties (object-literal-ordering) are free of each other only with such a value. */
import type ts from 'typescript';
export declare function inertValue(raw: ts.Expression, compiler: typeof ts): boolean;
