/** Erased, distinct TS data members may commute; runtime class fields keep their
 * order within their evaluation phase (ADR-012).
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs (ADR-008);
 * so is each half of a getter/setter pair, which creates one property (ADR-012).
 * Phases (ADR-012): computed method keys are evaluated while the class elements
 * are defined, static initialisers and blocks run after that, instance
 * initialisers at construction; units of different phases commute.
 * Their relative order is reflectable (ADR-010): OrdinaryOwnPropertyKeys lists
 * string keys in creation order. These keys are non-enumerable, so only an
 * explicit getOwnPropertyNames/Reflect.ownKeys can see it; since v11 (ADR-020)
 * the key chain applies only when the program can (options.reflectedKeys). Then
 * every member that creates a string key on the prototype (or, if static, on the
 * constructor) keeps its order relative to the other such members. Free of that order are: the constructor
 * (`constructor` is created first), array-index keys (listed ascending),
 * private names (not reflected) and erased members. An `accessor` field is in
 * that key chain and keeps its field order too. TypeScript emits parameter
 * properties at the start of construction in both class-field modes, whatever
 * the constructor's position, and erases declare fields (ADR-009). Runs for JS too.
 * Every edge carries its reason (ADR-014). */
import type ts from 'typescript';
import {mergeOrderingEntries, type OrderingEntry, type OrderingReason} from './ordering-relations.js';
import {freeCommentRows} from './comment-rows.js';
type Compiler = typeof ts;
/** `reflect`: the object on which the member creates a creation-ordered key.
 * `phases`: when a runtime class unit evaluates code (ADR-012): `key` at class
 * definition while element keys are evaluated, `static` in the static
 * initialisation that follows, `instance` at construction. Units without
 * phases (comments, overload groups, duplicates, decorated or computed fields
 * and other shapes) stay ordered relative to every unit. `pair`: the accessor
 * pair key (ADR-012). */
type Phase = 'key' | 'static' | 'instance';
/** `loose` (ADR-029): an instance field whose initialiser runs no code; such fields commute
 * with each other when the program does not enumerate keys. */
/** `sameKey` (ADR-068): a duplicate definition's key and object; such definitions keep their mutual order. */
/** `copies` (ADR-073): the last row of the earlier own data field a loose copy field (`f = this.g`) reads. */
interface Unit {first: number; last: number; pure: boolean; free?: boolean; reflect?: 'prototype' | 'static'; phases?: Phase[]; pair?: string; plain?: boolean; loose?: boolean; sameKey?: string; copies?: number;}
/** `spans` lists every ordered member/comment unit (0-based physical rows) so the
 * generator can keep same-scope siblings out of a multi-row unit's interior. */
export interface TypeMemberOrdering {entries: OrderingEntry[]; spans: {first: number; last: number}[]; note: string;}

/** `reflectedKeys` (ADR-020): the program may list non-enumerable keys, so the ADR-010 key chain applies.
 * `enumeratedKeys` (ADR-029): the program may list enumerable keys, so instance fields keep their order. */
export function typeMemberOrdering(file: ts.SourceFile, compiler: Compiler, options: {reflectedKeys?: boolean; enumeratedKeys?: boolean} = {}): TypeMemberOrdering {
 const physical = file.text.split('\n'), entries: OrderingEntry[] = [], spans: {first: number; last: number}[] = [];
 /** `row` follows every row of `after` for the same reason. */
 const order = (row: number, after: number[], code: OrderingReason['code']): void => {entries.push({row, after, reasons: after.map(before => ({before, code}))});};
 let hasClass = false, hasTypes = false;
 const first = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
 const last = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.end - 1).line;
 const name = (node: ts.Node): string | undefined => {
  // Constructor nodes carry no name property: test them first.
  if (compiler.isConstructorDeclaration(node)) return 'constructor';
  if (!('name' in node)) return undefined;
  const key = node.name as ts.Node | undefined;
  // Numeric class keys are canonical property keys (ADR-010); type members keep the ADR-007 barrier.
  if (key && compiler.isNumericLiteral(key)) {const value = Number(key.text); return compiler.isClassLike(node.parent) && Number.isFinite(value) ? String(value) : undefined;}
  return key && (compiler.isIdentifier(key) || compiler.isStringLiteral(key) || compiler.isPrivateIdentifier(key)) ? key.text : undefined;
 };
 const arrayIndex = (key: string): boolean => /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295;
 /** ADR-029: an initialiser that evaluates no code: a literal, or a fresh array/object of such literals. */
 const inert = (raw: ts.Expression): boolean => {
  const expr = compiler.isParenthesizedExpression(raw) || compiler.isAsExpression(raw) || compiler.isSatisfiesExpression(raw) ? raw.expression : raw;
  if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr) || compiler.isNumericLiteral(expr) || compiler.isBigIntLiteral(expr) || [compiler.SyntaxKind.TrueKeyword, compiler.SyntaxKind.FalseKeyword, compiler.SyntaxKind.NullKeyword].includes(expr.kind)) return true;
  if (compiler.isPrefixUnaryExpression(expr)) return (expr.operator === compiler.SyntaxKind.MinusToken || expr.operator === compiler.SyntaxKind.PlusToken) && compiler.isNumericLiteral(expr.operand);
  if (compiler.isArrayLiteralExpression(expr)) return expr.elements.every(element => !compiler.isSpreadElement(element) && !compiler.isOmittedExpression(element) && inert(element));
  if (compiler.isObjectLiteralExpression(expr)) return expr.properties.every(property => compiler.isPropertyAssignment(property) && (compiler.isIdentifier(property.name) || compiler.isStringLiteral(property.name)) && property.name.text !== '__proto__' && inert(property.initializer));
  return false;
 };
 const definitionModifiers = new Set<ts.SyntaxKind>([compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.PrivateKeyword, compiler.SyntaxKind.StaticKeyword, compiler.SyntaxKind.OverrideKeyword, compiler.SyntaxKind.AbstractKeyword, compiler.SyntaxKind.AsyncKeyword]);
 /** A whole method/accessor/constructor that owns its rows: one row, or `{` on the first and `}` on the last row. */
 const definitionRows = (member: ts.MethodDeclaration | ts.AccessorDeclaration | ts.ConstructorDeclaration): boolean => {
  const body = member.body, row = first(member), end = last(member);
  if (row === end) return physical[row]?.trim() === member.getText(file).trim();
  if (!body) return false;
  const children = body.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
  return !!open && !!close && first(open) === row && first(close) === end && physical[row]?.trim() === file.text.slice(member.getStart(file), open.end).trim() && physical[end]?.trim() === file.text.slice(close.getStart(file), member.end).trim();
 };
 // v39 (ADR-073): TypeScript's [[Set]] class-field mode assigns a field, which runs a setter of that
 // name anywhere on the prototype chain; a method or field there is a writable data property, which
 // the assignment shadows without running code. The accessor names the base classes may define
 // (get, set, `accessor` fields), when every base is a class declared once in this file without a
 // computed accessor name; otherwise unknown.
 const typescript = file.fileName.endsWith('.ts') || file.fileName.endsWith('.tsx') || file.fileName.endsWith('.mts') || file.fileName.endsWith('.cts');
 const reshapes = /\.prototype\b|__proto__|defineProperty|setPrototypeOf|\bReflect\b|\bProxy\b/.test(file.text);
 const declarations = new Map<string, ts.Node[]>();
 const collect = (node: ts.Node): void => {
  const named = (compiler.isClassLike(node) || compiler.isFunctionDeclaration(node) || compiler.isVariableDeclaration(node) || compiler.isParameter(node) || compiler.isBindingElement(node) || compiler.isImportSpecifier(node) || compiler.isImportClause(node) || compiler.isNamespaceImport(node) || compiler.isImportEqualsDeclaration(node) || compiler.isEnumDeclaration(node) || compiler.isModuleDeclaration(node)) ? node.name : undefined;
  if (named && compiler.isIdentifier(named)) declarations.set(named.text, [...declarations.get(named.text) ?? [], node]);
  compiler.forEachChild(node, collect);
 };
 collect(file);
 const baseAccessors = (node: ts.ClassLikeDeclaration, seen = new Set<ts.Node>()): Set<string> | null => {
  const heritage = node.heritageClauses?.find(clause => clause.token === compiler.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
  if (!heritage) return new Set();
  if (!compiler.isIdentifier(heritage)) return null;
  const found = declarations.get(heritage.text) ?? [], base = found[0];
  if (found.length !== 1 || !base || !compiler.isClassDeclaration(base) || seen.has(base)) return null;
  const inherited = baseAccessors(base, new Set([...seen, node]));
  if (!inherited) return null;
  for (const member of base.members) {
   const accessor = compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isPropertyDeclaration(member) && !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
   if (!accessor) continue;
   const key = member.name && compiler.isComputedPropertyName(member.name) ? undefined : name(member);
   if (key === undefined) return null;
   inherited.add(key);
  }
  return inherited;
 };
 function visit(node: ts.Node): void {
  if (compiler.isInterfaceDeclaration(node) || compiler.isTypeLiteralNode(node) || compiler.isClassLike(node)) {
   const isClass = compiler.isClassLike(node);
   hasClass ||= isClass; hasTypes ||= !isClass;
   const children = node.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
   const counts = new Map<string, number>();
   for (const member of node.members) {const key = name(member); if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);}
   const isStatic = (member: ts.Node): boolean => compiler.canHaveModifiers(member) && !!compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.StaticKeyword);
   // ADR-012: exactly one getter and one setter with bodies, the same name and the same placement form one property.
   const pairs = new Set<string>();
   if (isClass) for (const [key, count] of counts) {
    if (count !== 2) continue;
    const both = node.members.filter(member => name(member) === key);
    if (both.some(member => compiler.isGetAccessorDeclaration(member) && !!member.body) && both.some(member => compiler.isSetAccessorDeclaration(member) && !!member.body) && isStatic(both[0]!) === isStatic(both[1]!)) pairs.add(key);
   }
   // v34 (ADR-068): a name whose every member is a whole method or accessor definition. Each is
   // installed at class definition, before any initialiser or static code runs, so it is free of
   // the fields; the later of two same-key definitions on one object replaces the earlier one.
   const definitionOnly = (member: ts.ClassElement | ts.TypeElement): boolean => (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body && !!member.name && !compiler.isComputedPropertyName(member.name)
    && !(compiler.canHaveDecorators(member) && compiler.getDecorators(member)?.length) && ((compiler.canHaveModifiers(member) ? compiler.getModifiers(member) : undefined) ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && definitionRows(member);
   const duplicates = new Set(isClass ? [...counts].filter(([key, count]) => count > 1 && !pairs.has(key) && node.members.every(member => name(member) !== key || definitionOnly(member))).map(([key]) => key) : []);
   /** ADR-073: the earlier field `this.g` names, when `member`'s initialiser is just that read and `g`
    * is a uniquely named plain field of the same placement that no base can define. */
   const copySource = (member: ts.PropertyDeclaration, all: readonly (ts.ClassElement | ts.TypeElement)[]): ts.PropertyDeclaration | undefined => {
    let read = member.initializer!;
    while (compiler.isParenthesizedExpression(read)) read = read.expression;
    if (!compiler.isPropertyAccessExpression(read) || read.expression.kind !== compiler.SyntaxKind.ThisKeyword || read.questionDotToken) return undefined;
    const target = read.name.text, index = all.indexOf(member);
    const source = all.find((other, at) => at < index && name(other) === target);
    if (!source || !compiler.isPropertyDeclaration(source) || counts.get(target) !== 1 || isStatic(source) !== isStatic(member) || !source.name || compiler.isComputedPropertyName(source.name)) return undefined;
    const sourceModifiers = compiler.getModifiers(source) ?? [];
    if (sourceModifiers.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword || modifier.kind === compiler.SyntaxKind.AbstractKeyword) || compiler.getDecorators(source)?.length) return undefined;
    return assignable(target, source) ? source : undefined;
   };
   // ADR-073: a field assignment in the [[Set]] mode may run code unless no base can define its name.
   const inherited = isClass ? baseAccessors(node as ts.ClassLikeDeclaration) : new Set<string>();
   const assignable = (key: string, member: ts.ClassElement | ts.TypeElement): boolean => key !== '__proto__' && (!typescript || compiler.isPrivateIdentifier(member.name!) || !!inherited && !inherited.has(key));
   const members: Unit[] = node.members.map(member => {
    const key = name(member), row = first(member), end = last(member);
    const modifiers = compiler.canHaveModifiers(member) ? compiler.getModifiers(member) : undefined;
    const erased = compiler.isPropertySignature(member) || compiler.isPropertyDeclaration(member) && !member.initializer && !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.DeclareKeyword);
    const simpleModifiers = modifiers?.every(modifier => [compiler.SyntaxKind.DeclareKeyword, compiler.SyntaxKind.ReadonlyKeyword, compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.PrivateKeyword].includes(modifier.kind)) ?? true;
    const decorated = compiler.canHaveDecorators(member) && !!compiler.getDecorators(member)?.length;
    const fullStart = member.getFullStart(), fullRow = file.getLineAndCharacterOfPosition(fullStart).line;
    // Trivia on the previous member's physical row belongs to that member.
    const triviaStart = fullRow < row ? file.getPositionOfLineAndCharacter(fullRow + 1, 0) : fullStart;
    const leadingComment = !!file.text.slice(triviaStart, member.getStart(file)).trim();
    const paired = key !== undefined && pairs.has(key);
    const duplicate = !leadingComment && key !== undefined && duplicates.has(key);
    const distinct = !decorated && !leadingComment && key !== undefined && (counts.get(key) === 1 || paired || duplicate);
    const definition = isClass && (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isConstructorDeclaration(member)) && (!!member.body || !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword)) && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && distinct && definitionRows(member);
    const pure = erased && simpleModifiers && distinct && row === end && physical[row]?.trim() === member.getText(file).trim();
    // An emitted method/accessor creates a key unless it is private or an array index; a computed key is unknown, so ordered.
    // An `accessor` field defines its get/set pair at class definition among the methods; it stays a field for its initialiser.
    const autoAccessor = compiler.isPropertyDeclaration(member) && !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword) && !modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword || modifier.kind === compiler.SyntaxKind.DeclareKeyword);
    const emitted = isClass && ((compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body || autoAccessor);
    const reflected = emitted && !(member.name && compiler.isPrivateIdentifier(member.name)) && !(key !== undefined && arrayIndex(key));
    // ADR-012 phases: a named field initialises in its placement's phase; a computed
    // method/accessor key is evaluated at definition, before any initialiser runs.
    const plainName = !!member.name && !compiler.isComputedPropertyName(member.name);
    const phases: Phase[] | undefined = !isClass || decorated || leadingComment ? undefined
     : compiler.isPropertyDeclaration(member) && plainName && !erased ? [isStatic(member) ? 'static' : 'instance']
     : compiler.isClassStaticBlockDeclaration(member) ? ['static']
     : (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body && !plainName ? ['key'] : undefined;
    // A declare field emits nothing in either class-field mode: it is position-free in a class body.
    // A plain method row: a candidate overload signature or implementation (ADR-020).
    const plain = isClass && compiler.isMethodDeclaration(member) && !decorated && !leadingComment && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && (member.body ? definitionRows(member) : row === end && physical[row]?.trim() === member.getText(file).trim());
    // ADR-029: a uniquely named instance field that runs no code creates only its key; unless the program enumerates keys, that order is unobserved.
    // v34 (ADR-068): likewise a static field (a key of the constructor) and an `accessor` field, whose
    // initialiser only fills a private storage; its get/set key is created at definition (the key chain).
    const loose = !options.enumeratedKeys && phases?.length === 1 && key !== undefined && counts.get(key) === 1 && compiler.isPropertyDeclaration(member) && assignable(key, member) && (!member.initializer || inert(member.initializer));
    // v39 (ADR-073): a field that copies an earlier own data field of the same placement (`f = this.g`)
    // runs no code either: `g` is then an own data property (defined, or assigned without a setter on
    // the chain), so the read runs no getter. It follows `g`, but no other loose field.
    const copied = !loose && !options.enumeratedKeys && !reshapes && phases?.length === 1 && phases[0] !== 'key' && key !== undefined && counts.get(key) === 1 && compiler.isPropertyDeclaration(member) && !autoAccessor && assignable(key, member) && member.initializer ? copySource(member, node.members) : undefined;
    return {first: row, last: end, pure, plain, free: definition || isClass && pure, ...(definition && duplicate ? {sameKey: key + (isStatic(member) ? ' static' : ' prototype')} : {}), ...(reflected ? {reflect: isStatic(member) ? 'static' as const : 'prototype' as const} : {}), ...(phases ? {phases} : {}), ...(definition && paired ? {pair: key} : {}), ...(loose || copied ? {loose: true} : {}), ...(copied ? {copies: last(copied)} : {})};
   });
   // An overload signature must directly precede the next signature or the
   // implementation (TS2389/TS2391): the whole group is one unit. Its signatures are
   // erased, so a group of plain rows whose name occurs nowhere else is one method
   // definition, free like any other (ADR-020); otherwise the group stays ordered.
   const signature = (member: ts.Node): boolean => (compiler.isMethodDeclaration(member) || compiler.isConstructorDeclaration(member)) && !member.body && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword);
   const grouped: Unit[] = [], sizes: number[] = [];
   members.forEach((member, i) => {
    const previous = node.members[i - 1];
    if (isClass && previous && signature(previous) && name(previous) === name(node.members[i]!)) {
     const head = grouped.pop()!, size = sizes.pop()! + 1, key = name(node.members[i]!);
     const definition = !!head.plain && !!member.plain && !!(node.members[i] as ts.MethodDeclaration).body && key !== undefined && counts.get(key) === size;
     grouped.push({first: head.first, last: member.last, pure: false, plain: !!head.plain && !!member.plain, ...(definition ? {free: true} : {}), ...(member.reflect ? {reflect: member.reflect} : {})}); sizes.push(size);
    } else {grouped.push(member); sizes.push(1);}
   });
   // No edits on shared physical boundaries. A row with one complete comment is free (ADR-025);
   // other non-member rows remain opaque barriers.
   if (open && close && grouped.every((member, i) => member.first > first(open) && member.last < first(close) && (!i || grouped[i - 1]!.last < member.first))) {
    const units: Unit[] = [], free: Unit[] = []; let cursor = first(open) + 1;
    const gap = (until: number): void => {
     const comments = freeCommentRows(file, compiler, cursor, until - 1);
     for (; cursor < until; cursor++) if (physical[cursor]?.trim()) (comments.has(cursor) ? free : units).push({first: cursor, last: cursor, pure: false});
    };
    for (const member of grouped) {
     gap(member.first);
     (member.free ? free : units).push(member); cursor = member.last + 1;
    }
    gap(first(close));
    // Definitions only need the class open; the remaining units keep their own order,
    // wired explicitly so that no barrier inherits a definition's row as predecessor.
    const wired = new Set<number>();
    for (const member of free) order(member.first, [first(open)], 'block-open');
    const definedLast = new Map<string, Unit>();
    for (const member of free) if (member.sameKey) {const previous = definedLast.get(member.sameKey); if (previous) order(member.first, [previous.last], 'duplicate-definition-order'); definedLast.set(member.sameKey, member);}
    for (const unit of [...units, ...free]) spans.push({first: unit.first, last: unit.last});
    for (let start = 0; start < units.length;) {
     if (!units[start]!.pure) {start++; continue;}
     let end = start + 1; while (end < units.length && units[end]!.pure) end++;
     if (end - start > 1) {
      const previous = start ? units[start - 1]!.last : first(open), run = units.slice(start, end);
      // The run commutes; it stays between its ordered neighbours, which are conservative barriers.
      for (const member of run) {order(member.first, [previous], 'type-member-barrier'); wired.add(member.first);}
      order(units[end]?.first ?? first(close), run.map(member => member.last), 'type-member-barrier'); wired.add(units[end]?.first ?? first(close));
     }
     start = end;
    }
    if (isClass) {
     // ADR-012: a runtime unit follows every earlier unit it shares a phase with, and every
     // phase-less unit. The latest unit of each phase and the latest phase-less unit imply the rest.
     const latest = new Map<Phase | 'none', Unit>();
     // ADR-029: loose fields of each phase since the latest other unit of that phase; they follow it, but not each other.
     const loose = new Map<Phase, Unit[]>([['instance', []], ['static', []]]);
     // A shared phase is an evaluation order; a phase-less unit on either side is conservative.
     for (const unit of units) {
      const reasons: OrderingReason[] = [];
      for (const [key, other] of latest) if (!unit.phases || key === 'none' || unit.phases.includes(key)) reasons.push({before: other.last, code: unit.phases && key !== 'none' ? 'class-evaluation-order' : 'unclassified-member'});
      // Any other unit that runs in a phase (or may) follows every loose field of it: its code could observe them.
      if (!unit.loose) for (const [phase, fields] of loose) if (!unit.phases || unit.phases.includes(phase)) for (const field of fields) reasons.push({before: field.last, code: unit.phases ? 'class-evaluation-order' : 'unclassified-member'});
      if (unit.copies !== undefined) reasons.push({before: unit.copies, code: 'class-evaluation-order'});
      entries.push(reasons.length ? {row: unit.first, after: [...new Set(reasons.map(reason => reason.before))], reasons} : {row: unit.first, after: [first(open)], reasons: [{before: first(open), code: 'block-open'}]});
      if (unit.loose) {loose.get(unit.phases![0]!)!.push(unit); continue;}
      for (const [phase] of loose) if (!unit.phases || unit.phases.includes(phase)) loose.set(phase, []);
      for (const key of unit.phases ?? ['none' as const]) latest.set(key, unit);
     }
    } else if (free.length) units.forEach((unit, i) => {if (!wired.has(unit.first)) order(unit.first, [i ? units[i - 1]!.last : first(open)], i ? 'type-member-barrier' : 'block-open');});
    // Reflectable key order: consecutive key-creating members on the same object stay ordered.
    // The two halves of an accessor pair that are adjacent in that chain create one
    // key at the earlier half and form one group: both follow the previous group and
    // precede the next one, in either order between themselves (ADR-012).
    const chains = new Map<string, {last: Unit[]; before: Unit[]}>();
    if (options.reflectedKeys) for (const member of grouped) if (member.reflect) {
     const chain = chains.get(member.reflect) ?? {last: [], before: []};
     const joins = !!member.pair && chain.last.length === 1 && chain.last[0]!.pair === member.pair;
     const predecessors = joins ? chain.before : chain.last;
     if (predecessors.length) order(member.first, predecessors.map(unit => unit.last), 'reflected-key-order');
     chains.set(member.reflect, joins ? {last: [...chain.last, member], before: chain.before} : {last: [member], before: chain.last});
    }
   }
  }
  compiler.forEachChild(node, visit);
 }
 visit(file);
 // Several constraints on one row are a conjunction.
 return {entries: mergeOrderingEntries(entries), spans, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típusadatmezők felcserélhetők. A constructor, a declare mezők, a privát (#) és a tömbindex nevű metódusok bárhol állhatnak. A többi metódus és accessor is szabad; csak ha a program listázza a nem felsorolható kulcsokat (getOwnPropertyNames, Reflect.ownKeys), tartják meg a kulcssorrendjüket. Az azonos nevű getter és setter egy tulajdonság. A példány- és a static mezők egymáshoz képest szabadok; csoportjukon belül sorrendben maradnak, kivéve a kódot nem futtató mezőket, ha a program nem listázza a kulcsokat (Object.keys, JSON.stringify, for…in, spread, console). A számított nevű metódus a mezőkhöz képest szabad. Az azonos nevű metódusok csak egymáshoz képest kötöttek. Az overloadok, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : ''};
}
