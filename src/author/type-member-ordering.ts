/** Erased, distinct TS data members may commute; runtime class fields/writes never do.
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs (ADR-008).
 * Their relative order is still reflectable (ADR-010): OrdinaryOwnPropertyKeys
 * lists string keys in creation order, so every member that creates a string
 * key on the prototype (or, if static, on the constructor) keeps its order
 * relative to the other such members. Free of that order are: the constructor
 * (`constructor` is created first), array-index keys (listed ascending),
 * private names (not reflected) and erased members. TypeScript emits parameter
 * properties at the start of construction in both class-field modes, whatever
 * the constructor's position, and erases declare fields (ADR-009). Runs for JS too. */
import type ts from 'typescript';
type Compiler = typeof ts;
interface Entry {row: number; after: number[];}
/** `reflect`: the object on which the member creates a creation-ordered key. */
interface Unit {first: number; last: number; pure: boolean; free?: boolean; reflect?: 'prototype' | 'static';}
/** `spans` lists every ordered member/comment unit (0-based physical rows) so the
 * generator can keep same-scope siblings out of a multi-row unit's interior. */
export interface TypeMemberOrdering {entries: Entry[]; spans: {first: number; last: number}[]; note: string;}

export function typeMemberOrdering(file: ts.SourceFile, compiler: Compiler): TypeMemberOrdering {
 const physical = file.text.split('\n'), entries: Entry[] = [], spans: {first: number; last: number}[] = [];
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
 const definitionModifiers = new Set<ts.SyntaxKind>([compiler.SyntaxKind.PublicKeyword, compiler.SyntaxKind.ProtectedKeyword, compiler.SyntaxKind.PrivateKeyword, compiler.SyntaxKind.StaticKeyword, compiler.SyntaxKind.OverrideKeyword, compiler.SyntaxKind.AbstractKeyword, compiler.SyntaxKind.AsyncKeyword]);
 /** A whole method/accessor/constructor that owns its rows: one row, or `{` on the first and `}` on the last row. */
 const definitionRows = (member: ts.MethodDeclaration | ts.AccessorDeclaration | ts.ConstructorDeclaration): boolean => {
  const body = member.body, row = first(member), end = last(member);
  if (row === end) return physical[row]?.trim() === member.getText(file).trim();
  if (!body) return false;
  const children = body.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
  return !!open && !!close && first(open) === row && first(close) === end && physical[row]?.trim() === file.text.slice(member.getStart(file), open.end).trim() && physical[end]?.trim() === file.text.slice(close.getStart(file), member.end).trim();
 };
 function visit(node: ts.Node): void {
  if (compiler.isInterfaceDeclaration(node) || compiler.isTypeLiteralNode(node) || compiler.isClassLike(node)) {
   const isClass = compiler.isClassLike(node);
   hasClass ||= isClass; hasTypes ||= !isClass;
   const children = node.getChildren(file), open = children.find(child => child.kind === compiler.SyntaxKind.OpenBraceToken), close = children.filter(child => child.kind === compiler.SyntaxKind.CloseBraceToken).at(-1);
   const counts = new Map<string, number>();
   for (const member of node.members) {const key = name(member); if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);}
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
    const distinct = !decorated && !leadingComment && key !== undefined && counts.get(key) === 1;
    const definition = isClass && (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member) || compiler.isConstructorDeclaration(member)) && (!!member.body || !!modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword)) && (modifiers ?? []).every(modifier => definitionModifiers.has(modifier.kind)) && distinct && definitionRows(member);
    const pure = erased && simpleModifiers && distinct && row === end && physical[row]?.trim() === member.getText(file).trim();
    // An emitted method/accessor creates a key unless it is private or an array index; a computed key is unknown, so ordered.
    const emitted = isClass && (compiler.isMethodDeclaration(member) || compiler.isGetAccessorDeclaration(member) || compiler.isSetAccessorDeclaration(member)) && !!member.body;
    const reflected = emitted && !(member.name && compiler.isPrivateIdentifier(member.name)) && !(key !== undefined && arrayIndex(key));
    // A declare field emits nothing in either class-field mode: it is position-free in a class body.
    return {first: row, last: end, pure, free: definition || isClass && pure, ...(reflected ? {reflect: modifiers?.some(modifier => modifier.kind === compiler.SyntaxKind.StaticKeyword) ? 'static' as const : 'prototype' as const} : {})};
   });
   // An overload signature must directly precede the next signature or the
   // implementation (TS2389/TS2391): the whole group is one ordered unit.
   const signature = (member: ts.Node): boolean => (compiler.isMethodDeclaration(member) || compiler.isConstructorDeclaration(member)) && !member.body && !compiler.getModifiers(member)?.some(modifier => modifier.kind === compiler.SyntaxKind.AbstractKeyword);
   const grouped: Unit[] = [];
   members.forEach((member, i) => {
    const previous = node.members[i - 1];
    if (isClass && previous && signature(previous) && name(previous) === name(node.members[i]!)) grouped.push({first: grouped.pop()!.first, last: member.last, pure: false, ...(member.reflect ? {reflect: member.reflect} : {})});
    else grouped.push(member);
   });
   // No edits on shared physical boundaries. Comments remain opaque barriers.
   if (open && close && grouped.every((member, i) => member.first > first(open) && member.last < first(close) && (!i || grouped[i - 1]!.last < member.first))) {
    const units: Unit[] = [], free: Unit[] = []; let cursor = first(open) + 1;
    for (const member of grouped) {
     for (; cursor < member.first; cursor++) if (physical[cursor]?.trim()) units.push({first: cursor, last: cursor, pure: false});
     (member.free ? free : units).push(member); cursor = member.last + 1;
    }
    for (; cursor < first(close); cursor++) if (physical[cursor]?.trim()) units.push({first: cursor, last: cursor, pure: false});
    // Definitions only need the class open; the remaining units keep their own order,
    // wired explicitly so that no barrier inherits a definition's row as predecessor.
    const wired = new Set<number>();
    for (const member of free) entries.push({row: member.first, after: [first(open)]});
    for (const unit of [...units, ...free]) spans.push({first: unit.first, last: unit.last});
    for (let start = 0; start < units.length;) {
     if (!units[start]!.pure) {start++; continue;}
     let end = start + 1; while (end < units.length && units[end]!.pure) end++;
     if (end - start > 1) {
      const previous = start ? units[start - 1]!.last : first(open), run = units.slice(start, end);
      for (const member of run) {entries.push({row: member.first, after: [previous]}); wired.add(member.first);}
      entries.push({row: units[end]?.first ?? first(close), after: run.map(member => member.last)}); wired.add(units[end]?.first ?? first(close));
     }
     start = end;
    }
    if (free.length) units.forEach((unit, i) => {if (!wired.has(unit.first)) entries.push({row: unit.first, after: [i ? units[i - 1]!.last : first(open)]});});
    // Reflectable key order: consecutive key-creating members on the same object stay ordered.
    const previous = new Map<string, Unit>();
    for (const member of grouped) if (member.reflect) {
     const before = previous.get(member.reflect);
     if (before && (before.free || member.free)) entries.push({row: member.first, after: [before.last]});
     previous.set(member.reflect, member);
    }
   }
  }
  compiler.forEachChild(node, visit);
 }
 visit(file);
 // Several constraints on one row are a conjunction.
 const merged = new Map<number, Set<number>>();
 for (const entry of entries) {const after = merged.get(entry.row) ?? new Set<number>(); entry.after.forEach(row => after.add(row)); merged.set(entry.row, after);}
 return {entries: [...merged].map(([row, after]) => ({row, after: [...after]})), spans, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típusadatmezők felcserélhetők. A constructor (paramétertulajdonságokkal együtt), a declare mezők, a privát (#) és a tömbindex nevű metódusok az osztálytörzsön belül bárhol állhatnak. A többi metódus és accessor a mezőkhöz képest szabad, de egymáshoz képest megtartja a sorrendjét, mert a prototípus (static esetén a konstruktor) kulcssorrendje reflexióval megfigyelhető. A rendes osztálymezők és this-értékadások sorrendje megmarad: mezőlétrehozás, kulcssorrend, setter, öröklés és inicializálási hatás is megfigyelhető. Az overloadok, duplikált nevek, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : ''};
}
