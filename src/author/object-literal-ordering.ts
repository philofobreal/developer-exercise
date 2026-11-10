/** v54 (ADR-128): the property rows of a multi-row object literal. Until v53 they were continued rows of their
 * statement, fixed in source order whatever the program could observe. Here a literal whose every property owns
 * one row, has a plain unique key and an inert value (inert-value.ts) gives its rows only the constraints its
 * meaning has:
 *  - evaluating the properties runs no code and cannot throw, so their order changes nothing but the key order;
 *  - the key order is the creation order of string keys (OrdinaryOwnPropertyKeys). Under the author's key-order
 *    setting „Számít” (ADR-055) the other rows keep their order (`key-creation-order` since v57, ADR-131; freed by „Nem számít”)
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
import {inertValue} from './inert-value.js';
import {objectReach} from './object-reach.js';
import {mergeOrderingEntries, type OrderingEntry, type OrderingReason} from './ordering-relations.js';

interface PropertyRow {readonly row: number; readonly key: string; readonly comma: boolean;}
const arrayIndex = (key: string): boolean => /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295;

export function objectLiteralOrdering(file: ts.SourceFile, compiler: typeof ts, options: {keyOrder?: 'observed' | 'ignored'} = {}): {entries: OrderingEntry[]} {
 const physical = file.text.split('\n'), entries: OrderingEntry[] = [], observed = options.keyOrder !== 'ignored';
 const evaluates = /\beval\b|\bwith\s*\(/.test(file.text);
 // NY-35: every value binding the file declares, by name: its kind, the node whose end initialises it and its scope
 // (the node a read must lie in to resolve to it). `other` is any binding this analysis does not prove.
 type Kind = 'var' | 'let' | 'param' | 'function' | 'other';
 interface Binding {readonly kind: Kind; readonly node: ts.Node; readonly scope: ts.Node; readonly clause?: boolean;}
 const declared = new Map<string, Binding[]>();
 /** The function (or class field, static block, file) whose evaluation runs `node`. */
 const runner = (node: ts.Node): ts.Node => {
  let current = node.parent;
  while (current && !(compiler.isFunctionLike(current) || compiler.isClassStaticBlockDeclaration(current) || compiler.isPropertyDeclaration(current) || compiler.isSourceFile(current))) current = current.parent;
  return current ?? file;
 };
 const declare = (name: ts.Node | undefined, binding: Binding): void => {
  if (!name) return;
  if (compiler.isIdentifier(name)) {declared.set(name.text, [...declared.get(name.text) ?? [], binding]); return;}
  // A destructured binding: every name in it is initialised with the whole declaration, like a plain one.
  if (compiler.isObjectBindingPattern(name) || compiler.isArrayBindingPattern(name)) for (const element of name.elements) if (compiler.isBindingElement(element)) declare(element.name, binding);
 };
 const bindings = (node: ts.Node): void => {
  if (compiler.isVariableDeclaration(node)) {
   const list = node.parent, holder = list.parent;
   // `await using` is `const | using` in the flags: compare the block-scoped bits as a whole.
   const scoped = compiler.isVariableDeclarationList(list) ? list.flags & compiler.NodeFlags.BlockScoped : -1;
   if (scoped === -1 || scoped === compiler.NodeFlags.Using || scoped === compiler.NodeFlags.AwaitUsing) declare(node.name, {kind: 'other', node, scope: file});
   else if (!scoped) declare(node.name, {kind: 'var', node, scope: runner(node)});
   // A loop head's binding is read safely only in the loop body (`for (const x of {a: x})` reads it in its zone).
   else if (compiler.isForStatement(holder) || compiler.isForOfStatement(holder) || compiler.isForInStatement(holder)) declare(node.name, {kind: 'let', node, scope: holder.statement});
   // A switch clause's binding lives in the whole switch body, which control may enter past its initialisation.
   else declare(node.name, compiler.isCaseClause(holder.parent) || compiler.isDefaultClause(holder.parent) ? {kind: 'let', node, scope: holder.parent.parent, clause: true} : {kind: 'let', node, scope: holder.parent});
  } else if (compiler.isParameter(node)) {
   const owner = node.parent;
   declare(node.name, compiler.isFunctionLike(owner) && 'body' in owner && owner.body ? {kind: 'param', node, scope: owner.body} : {kind: 'other', node, scope: file});
  } else if (compiler.isFunctionDeclaration(node)) {
   const owner = node.parent, top = compiler.isSourceFile(owner) || compiler.isBlock(owner) && compiler.isFunctionLike(owner.parent);
   declare(node.name, top ? {kind: 'function', node, scope: owner} : {kind: 'other', node, scope: file});
  } else if (compiler.isClassDeclaration(node)) declare(node.name, compiler.isCaseClause(node.parent) || compiler.isDefaultClause(node.parent) ? {kind: 'let', node, scope: node.parent.parent, clause: true} : {kind: 'let', node, scope: node.parent});
  else if (compiler.isFunctionExpression(node) || compiler.isClassExpression(node) || compiler.isEnumDeclaration(node) || compiler.isImportEqualsDeclaration(node) || compiler.isImportClause(node) || compiler.isNamespaceImport(node) || compiler.isImportSpecifier(node) || compiler.isModuleDeclaration(node) && compiler.isIdentifier(node.name)) declare(node.name, {kind: 'other', node, scope: file});
  else if (compiler.isCatchClause(node) && node.variableDeclaration) {declare(node.variableDeclaration.name, {kind: 'other', node, scope: file}); compiler.forEachChild(node.block, bindings); return;}
  compiler.forEachChild(node, bindings);
 };
 bindings(file);
 const within = (inner: ts.Node, outer: ts.Node): boolean => inner.getStart(file) >= outer.getStart(file) && inner.end <= outer.end;
 /** A read of `name` (an identifier used as a value) that runs no code and cannot throw: it resolves to the innermost
  *  declaration whose scope holds it; a var, parameter or function declaration has no temporal dead zone, a let, const
  *  or class is passed before the read in the same function (not in a switch clause). */
 let risky: Set<Binding> | undefined;
 const safeRead = (name: ts.Identifier): boolean => {
  const found = declared.get(name.text) ?? [];
  if (evaluates || found.some(binding => binding.kind === 'other')) return false;
  const holding = found.filter(binding => within(name, binding.scope));
  if (!holding.length) return !found.length && ['undefined', 'NaN', 'Infinity'].includes(name.text);
  const size = (binding: Binding): number => binding.scope.end - binding.scope.getStart(file);
  const smallest = Math.min(...holding.map(size)), innermost = holding.filter(binding => size(binding) === smallest);
  if (innermost.every(binding => binding.kind === 'var' || binding.kind === 'param' || binding.kind === 'function')) return true;
  if (innermost.length !== 1) return false;
  const binding = innermost[0]!;
  if (!binding.clause && binding.node.end <= name.getStart(file) && runner(binding.node) === runner(name)) return true;
  // Not proven initialised: reading a lexical binding still runs no code, it may only throw its ReferenceError.
  risky?.add(binding);
  return !!risky;
 };
 const rowOf = (position: number): number => file.getLineAndCharacterOfPosition(position).line;
 const braces = (row: number): number => physical[row]?.match(/[{}]/g)?.length ?? 0;
 /** The literal's property rows, or undefined when the literal does not qualify. */
 const propertyRows = (node: ts.ObjectLiteralExpression, open: number, close: number): PropertyRow[] | undefined => {
  const rows: PropertyRow[] = [], keys = new Set<string>(), last = node.properties.length - 1;
  // A lexical binding not proven initialised may throw where it is read; with one such binding the order of the
  // rows decides nothing (the same error, or none), with two it decides which error is thrown.
  risky = new Set<Binding>();
  for (const [i, property] of node.properties.entries()) {
   // NY-35: the shorthand `{ name }` is `name: name`; one with a default (`{ a = 1 }`) is only a pattern.
   const shorthand = compiler.isShorthandPropertyAssignment(property) && !property.objectAssignmentInitializer;
   if (!compiler.isPropertyAssignment(property) && !shorthand) return undefined;
   const name = property.name;
   const key = compiler.isIdentifier(name) || compiler.isStringLiteral(name) ? name.text : compiler.isNumericLiteral(name) ? String(Number(name.text)) : undefined;
   const inert = compiler.isPropertyAssignment(property) ? inertValue(property.initializer, compiler, safeRead) : compiler.isIdentifier(name) && safeRead(name);
   if (key === undefined || key === '__proto__' || keys.has(key) || !inert) return undefined;
   keys.add(key);
   const row = rowOf(property.getStart(file)), comma = i < last || node.properties.hasTrailingComma;
   if (row !== rowOf(property.end - 1) || physical[row]?.trim() !== property.getText(file) + (comma ? ',' : '')) return undefined;
   rows.push({row, key, comma});
  }
  if (risky.size > 1) return undefined;
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
    const tail = rows.at(-1)!.comma ? undefined : rows.at(-1)!, keyed = observed && !objectReach(file, compiler).literalStays(node);
    let previousKey: PropertyRow | undefined;
    for (const property of rows) {
     const reasons: OrderingReason[] = [{before: open, code: 'block-open'}];
     if (keyed && !arrayIndex(property.key)) {
      if (previousKey) reasons.push({before: previousKey.row, code: 'key-creation-order'});
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
