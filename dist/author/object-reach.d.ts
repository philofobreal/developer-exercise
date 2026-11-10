/** NY-36 (v56, ADR-130): whether an object the program creates can reach code outside the program, which may then list
 * its keys. Under the author's key-order setting „Számít” (ADR-055) the creation order of an object's keys is part of
 * its behaviour whenever anyone can list them: the program itself (enumeratesKeys, ADR-029) or a caller, a test, a
 * console that receives the object. So a key order is free only where the object provably stays inside the program.
 *
 * Hidden here: which references keep an object inside, and how a class's instances and the class value itself stay
 * inside. The decisions, deliberately narrow (the error is always towards keeping an order):
 *  - an object literal stays inside its variable: a `const`/`let`/`var` in a function or block (a top-level binding is
 *    reachable from outside: an export, another script, a caller), whose every reference is the object of a member
 *    access that is not called;
 *  - a class's instances stay inside: a named class declaration that code outside cannot reach (not exported, and in
 *    a script not at the top level, where it is a global binding a caller may instantiate itself), whose name the file uses only as
 *    `new C(…)` into such a variable (where a call of one of the chain's own methods is also allowed), as the object
 *    of a static member access, or as the base of a class whose instances stay inside too; every class of its chain
 *    (`extends` a class declared once in this file, not exported, transitively) keeps its `this` (outside nested
 *    non-arrow functions and classes) as the object of a member access, called only for the chain's own methods
 *    (the base constructor and methods receive the instance);
 *  - the class value (whose static fields are keys) stays inside: no `extends` either way, used only as `new C(…)`
 *    or as the object of a static member access, its `this` kept the same way;
 *  - nothing stays inside in a file with `eval` or `with`.
 * Type positions (annotations, `implements`, type queries) are not references: they do not run. */
import type ts from 'typescript';
export interface ObjectReach {
    /** The literal is the initialiser of a variable that never hands it on. */
    literalStays(node: ts.ObjectLiteralExpression): boolean;
    /** No instance of the class can reach code outside the program. */
    instancesStay(declaration: ts.ClassLikeDeclaration): boolean;
    /** The class value (its static keys) cannot reach code outside the program. */
    classStays(declaration: ts.ClassLikeDeclaration): boolean;
}
export declare function objectReach(file: ts.SourceFile, compiler: typeof ts): ObjectReach;
