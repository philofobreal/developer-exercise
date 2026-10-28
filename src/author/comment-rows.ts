/** Free comment rows (ADR-025, policy v12). Moving a comment never changes what a program does,
 * so a physical row that holds exactly one complete comment, and nothing else, needs no order:
 * it stays only inside its block. Kept ordered: a row of a multi-row comment (its interior would
 * turn code into comment text or back), and directives that act on their neighbourhood
 * (`@ts-` comments, triple-slash references, `//#` pragmas, `@jsx` pragmas), and JSDoc, which
 * documents the declaration after it (tooling, `@deprecated`, `@internal`, JS type annotations). The rows come from
 * the compiler's own comment ranges over a trivia gap, never from text patterns alone. */
import type ts from 'typescript';
type Compiler = typeof ts;

const DIRECTIVE = /^\/\/\s*@ts-|^\/\/\/\s*<|^\/\/#|^\/\*[*\s]*@jsx|^\/\*\*(?!\/)/;

/** The free comment rows among the 0-based physical rows `from`..`to` (inclusive), which must be
 * trivia only (blank lines and comments between two statements or members). */
export function freeCommentRows(file: ts.SourceFile, compiler: Compiler, from: number, to: number): Set<number> {
 const rows = new Set<number>();
 if (from > to) return rows;
 const line = (position: number): number => file.getLineAndCharacterOfPosition(position).line;
 // Leading comment ranges start after a line break: scan from the previous row's line break.
 const start = from ? file.getPositionOfLineAndCharacter(from, 0) - 1 : 0, ranges = compiler.getLeadingCommentRanges(file.text, start) ?? [];
 const covered = new Map<number, number>();
 for (const range of ranges) for (let row = line(range.pos); row <= line(range.end - 1); row++) covered.set(row, (covered.get(row) ?? 0) + 1);
 for (const range of ranges) {
  const row = line(range.pos), text = file.text.slice(range.pos, range.end);
  if (row < from || row > to || line(range.end - 1) !== row || covered.get(row) !== 1 || DIRECTIVE.test(text)) continue;
  // Nothing but this comment on its row.
  const physical = file.text.slice(file.getPositionOfLineAndCharacter(row, 0), row + 1 < file.getLineStarts().length ? file.getPositionOfLineAndCharacter(row + 1, 0) : file.text.length);
  if (physical.trim() === text.trim()) rows.add(row);
 }
 return rows;
}
