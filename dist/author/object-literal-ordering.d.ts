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
 * them is a property row (a comment row keeps the literal conservative). Anything else stays as before. */
import type ts from 'typescript';
import { type OrderingEntry } from './ordering-relations.js';
export declare function objectLiteralOrdering(file: ts.SourceFile, compiler: typeof ts, options?: {
    keyOrder?: 'observed' | 'ignored';
}): {
    entries: OrderingEntry[];
};
