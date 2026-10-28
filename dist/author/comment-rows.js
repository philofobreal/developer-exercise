const DIRECTIVE = /^\/\/\s*@ts-|^\/\/\/\s*<|^\/\/#|^\/\*[*\s]*@jsx|^\/\*\*(?!\/)/;
/** The free comment rows among the 0-based physical rows `from`..`to` (inclusive), which must be
 * trivia only (blank lines and comments between two statements or members). */
export function freeCommentRows(file, compiler, from, to) {
    const rows = new Set();
    if (from > to)
        return rows;
    const line = (position) => file.getLineAndCharacterOfPosition(position).line;
    // Leading comment ranges start after a line break: scan from the previous row's line break.
    const start = from ? file.getPositionOfLineAndCharacter(from, 0) - 1 : 0, ranges = compiler.getLeadingCommentRanges(file.text, start) ?? [];
    const covered = new Map();
    for (const range of ranges)
        for (let row = line(range.pos); row <= line(range.end - 1); row++)
            covered.set(row, (covered.get(row) ?? 0) + 1);
    for (const range of ranges) {
        const row = line(range.pos), text = file.text.slice(range.pos, range.end);
        if (row < from || row > to || line(range.end - 1) !== row || covered.get(row) !== 1 || DIRECTIVE.test(text))
            continue;
        // Nothing but this comment on its row.
        const physical = file.text.slice(file.getPositionOfLineAndCharacter(row, 0), row + 1 < file.getLineStarts().length ? file.getPositionOfLineAndCharacter(row + 1, 0) : file.text.length);
        if (physical.trim() === text.trim())
            rows.add(row);
    }
    return rows;
}
//# sourceMappingURL=comment-rows.js.map