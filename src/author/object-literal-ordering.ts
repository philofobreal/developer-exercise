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
import {inertValue} from './inert-value.js';
import {mergeOrderingEntries, type OrderingEntry, type OrderingReason} from './ordering-relations.js';

interface PropertyRow {readonly row: number; readonly key: string; readonly comma: boolean;}
const arrayIndex = (key: string): boolean => /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295;

export function objectLiteralOrdering(file: ts.SourceFile, compiler: typeof ts, options: {keyOrder?: 'observed' | 'ignored'} = {}): {entries: OrderingEntry[]} {
 const physical = file.text.split('\n'), entries: OrderingEntry[] = [], observed = options.keyOrder !== 'ignored';
 // Every identifier by name: a reference anywhere to a name like the variable's counts (shadowing only adds references).
 const references = new Map<string, ts.Identifier[]>();
 const collect = (node: ts.Node): void => {if (compiler.isIdentifier(node)) references.set(node.text, [...references.get(node.text) ?? [], node]); compiler.forEachChild(node, collect);};
 collect(file);
 const evaluates = /\beval\b|\bwith\s*\(/.test(file.text);
 /** The literal stays in its variable: each other occurrence of the name is the object of a member access, not called. */
 const contained = (node: ts.ObjectLiteralExpression): boolean => {
  const declaration = node.parent;
  if (evaluates || !compiler.isVariableDeclaration(declaration) || declaration.initializer !== node || !compiler.isIdentifier(declaration.name)) return false;
  const statement = declaration.parent.parent;
  if (!compiler.isVariableStatement(statement) || compiler.isSourceFile(statement.parent) || compiler.isModuleBlock(statement.parent)) return false;
  const own = declaration.name;
  return (references.get(own.text) ?? []).every(reference => {
   if (reference === own) return true;
   const access = reference.parent;
   if (!(compiler.isPropertyAccessExpression(access) || compiler.isElementAccessExpression(access)) || access.expression !== reference) return false;
   return !(compiler.isCallExpression(access.parent) && access.parent.expression === access);
  });
 };
 const rowOf = (position: number): number => file.getLineAndCharacterOfPosition(position).line;
 const braces = (row: number): number => physical[row]?.match(/[{}]/g)?.length ?? 0;
 /** The literal's property rows, or undefined when the literal does not qualify. */
 const propertyRows = (node: ts.ObjectLiteralExpression, open: number, close: number): PropertyRow[] | undefined => {
  const rows: PropertyRow[] = [], keys = new Set<string>(), last = node.properties.length - 1;
  for (const [i, property] of node.properties.entries()) {
   if (!compiler.isPropertyAssignment(property)) return undefined;
   const name = property.name;
   const key = compiler.isIdentifier(name) || compiler.isStringLiteral(name) ? name.text : compiler.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
   if (key === undefined || key === '__proto__' || keys.has(key) || !inertValue(property.initializer, compiler)) return undefined;
   keys.add(key);
   const row = rowOf(property.getStart(file)), comma = i < last || node.properties.hasTrailingComma;
   if (row !== rowOf(property.end - 1) || physical[row]?.trim() !== property.getText(file) + (comma ? ',' : '')) return undefined;
   rows.push({row, key, comma});
  }
  const owned = new Set(rows.map(entry => entry.row));
  for (let row = open + 1; row < close; row++) if (physical[row]?.trim() && !owned.has(row)) return undefined;
  return rows;
 };
 const visit = (node: ts.Node): void => {
  if (compiler.isObjectLiteralExpression(node) && node.properties.length > 1) {
   const children = node.getChildren(file), openToken = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), closeToken = children.find(child => child.kind === compiler.SyntaxKind.CloseBraceToken);
   const open = openToken ? rowOf(openToken.getStart(file)) : -1, close = closeToken ? rowOf(closeToken.getStart(file)) : -1;
   const bounded = open >= 0 && close > open + 1 && braces(open) === 1 && braces(close) === 1 && !!physical[open]?.trimEnd().endsWith('{') && !!physical[close]?.trim().startsWith('}');
   const rows = bounded ? propertyRows(node, open, close) : undefined;
   if (rows) {
    const tail = rows.at(-1)!.comma ? undefined : rows.at(-1)!, keyed = observed && !contained(node);
    let previousKey: PropertyRow | undefined;
    for (const property of rows) {
     const reasons: OrderingReason[] = [{before: open, code: 'block-open'}];
     if (keyed && !arrayIndex(property.key)) {
      if (previousKey) reasons.push({before: previousKey.row, code: 'reflected-key-order'});
      previousKey = property;
     }
     if (property === tail) for (const other of rows) if (other !== tail) reasons.push({before: other.row, code: 'list-tail'});
     entries.push({row: property.row, after: [...new Set(reasons.map(reason => reason.before))], reasons});
    }
    entries.push({row: close, after: rows.map(property => property.row), reasons: rows.map(property => ({before: property.row, code: 'block-close'}))});
   }
  }
  compiler.forEachChild(node, visit);
 };
 visit(file);
 return {entries: mergeOrderingEntries(entries)};
}
