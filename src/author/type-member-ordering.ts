/** Erased, distinct TS data members may commute; runtime class fields/writes never do.
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs, so
 * their position in the class body is unobservable (ADR-008). Runs for JS too. */
import type ts from 'typescript';
type Compiler = typeof ts;
interface Entry {row: number; after: number[];}
interface Unit {first: number; last: number; pure: boolean; free?: boolean;}
export interface TypeMemberOrdering {entries: Entry[]; note: string;}

export function typeMemberOrdering(file: ts.SourceFile, compiler: Compiler): TypeMemberOrdering {
 const physical = file.text.split('\n'), entries: Entry[] = [];
 let hasClass = false, hasTypes = false;
 const first = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.getStart(file)).line;
 const last = (node: ts.Node): number => file.getLineAndCharacterOfPosition(node.end - 1).line;
 const name = (node: ts.Node): string | undefined => {
  if (!('name' in node)) return undefined;
  const key = node.name as ts.Node | undefined;
  return key && (compiler.isIdentifier(key) || compiler.isStringLiteral(key)) ? key.text : compiler.isConstructorDeclaration(node) ? 'constructor' : undefined;
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
    return {first: row, last: end, pure: erased && simpleModifiers && distinct && row === end && physical[row]?.trim() === member.getText(file).trim(), free: definition};
   });
   // No edits on shared physical boundaries. Comments remain opaque barriers.
   if (open && close && members.every((member, i) => member.first > first(open) && member.last < first(close) && (!i || members[i - 1]!.last < member.first))) {
    const units: Unit[] = [], free: Unit[] = []; let cursor = first(open) + 1;
    for (const member of members) {
     for (; cursor < member.first; cursor++) if (physical[cursor]?.trim()) units.push({first: cursor, last: cursor, pure: false});
     (member.free ? free : units).push(member); cursor = member.last + 1;
    }
    for (; cursor < first(close); cursor++) if (physical[cursor]?.trim()) units.push({first: cursor, last: cursor, pure: false});
    // Definitions only need the class open; the remaining units keep their own order,
    // wired explicitly so that no barrier inherits a definition's row as predecessor.
    const wired = new Set<number>();
    for (const member of free) entries.push({row: member.first, after: [first(open)]});
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
   }
  }
  compiler.forEachChild(node, visit);
 }
 visit(file);
 return {entries, note: hasClass || hasTypes ? 'A külön nevű, egysoros interface-/típusadatmezők és declare osztálymezők felcserélhetők. Az egyedi nevű metódusok, accessorok és a constructor definíciók, így az osztálytörzsön belül bárhol állhatnak. A rendes osztálymezők és this-értékadások sorrendje megmarad: mezőlétrehozás, kulcssorrend, setter, öröklés és inicializálási hatás is megfigyelhető. Az overloadok, duplikált nevek, kommentek és összetett sorok konzervatívak. Ez szintaktikai audit és korlátozott sorrendelemzés, nem teljes TypeScript típusellenőrzés.' : ''};
}
