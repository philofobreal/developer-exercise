/** v54 (ADR-128): the property rows of a multi-row object literal. Until v53 they were continued rows of their
 * statement, fixed in source order whatever the program could observe. Here a literal whose every property owns
 * one row, has a plain unique key and an inert value (inert-value.ts) gives its rows only the constraints its
 * meaning has:
 *  - evaluating the properties runs no code and cannot throw, so their order changes nothing but the key order;
 *  - the key order is the creation order of string keys (OrdinaryOwnPropertyKeys). Under the author's key-order
 *    setting „Számít” (ADR-055) the other rows keep their order (`reflected-key-order`, freed by „Nem számít”)
 *    unless the object provably never leaves its variable: a `const`/`let`/`var` inside a function or block (a
 *    top-level binding is reachable from outside: an export, another script, the caller of a probe), initialised with
 *    the literal, whose every reference in the file is a member access (`v.x`, `v[k]`, not a call), in a file without
 *    `eval` or `with`.
 *    Listing the keys needs the object itself (Object.keys(v), JSON.stringify(v), for…in, spread, console), and so
 *    does any caller (a return, an argument, a property, an export), so this also covers code outside the program.
 *    Array-index keys are listed ascending whatever their order and stay free;
 *  - a property row without a trailing comma ends the list: every other property row precedes it (`list-tail`).
 * The rows stay inside the literal: each follows the opening row and precedes the closing row, explicitly, beside
 * the block the structure gives the literal. Only a literal whose opening and closing rows hold no other brace
 * qualifies (a shared boundary row would cost the literal its block), and only when every non-empty row between
 * them is a property row (a comment row keeps the literal conservative). Anything else stays as before.
 *
 * v55 (NY-35): a value may also read a variable (`start: origin`, the shorthand `{ name }`, inside an inert array or
 * object too) when the read provably runs no code and cannot throw, in a file without `eval` or `with`:
 *  - the read resolves to the innermost declaration of the name whose scope holds it (a destructured name included);
 *    a `var`, a parameter (whose scope is the body) or a function declaration at the top of a function or the file
 *    has no temporal dead zone;
 *  - a `let`, `const` or class ends before the read, in the same function, and is not declared in a `switch` clause
 *    (a loop head's binding counts only in the loop body): control cannot reach the read without passing the
 *    initialisation, so the read cannot meet the temporal dead zone. Any other lexical binding still runs no code
 *    when read, it may only throw its ReferenceError: a literal may read one such binding (in any number of rows,
 *    the error is the same), never two, whose order would decide which error is thrown;
 *  - or the file declares no such name and it is `undefined`, `NaN` or `Infinity` (non-writable, non-configurable
 *    globals).
 * A name the file also binds any other way (an import, a catch parameter, a function or class expression's own name,
 * an enum, a namespace, a block-level function, `using`) and an undeclared global (possibly an accessor of the global
 * object) keep the row conservative. */
import type ts from 'typescript';
import { type OrderingEntry } from './ordering-relations.js';
export declare function objectLiteralOrdering(file: ts.SourceFile, compiler: typeof ts, options?: {
    keyOrder?: 'observed' | 'ignored';
}): {
    entries: OrderingEntry[];
};
