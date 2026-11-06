/** The same bound the Python author audit applies to lexical nesting (src/python/audit-script.ts). */
export const MAX_NESTING = 64;
/** The first place where the nesting exceeds `limit`, or null. Stops there, so the cost stays linear. */
export function nestingExcess(source, compiler, limit = MAX_NESTING) {
    const S = compiler.SyntaxKind;
    const scanner = compiler.createScanner(compiler.ScriptTarget.Latest, true, compiler.LanguageVariant.Standard, source);
    // Tokens after which a `/` divides; after any other token it starts a regular expression.
    const ends = new Set([S.Identifier, S.PrivateIdentifier, S.ThisKeyword, S.SuperKeyword, S.NullKeyword, S.TrueKeyword, S.FalseKeyword,
        S.NumericLiteral, S.BigIntLiteral, S.StringLiteral, S.NoSubstitutionTemplateLiteral, S.TemplateTail, S.RegularExpressionLiteral,
        S.CloseParenToken, S.CloseBracketToken, S.CloseBraceToken, S.PlusPlusToken, S.MinusMinusToken]);
    const stack = [];
    let previous = S.Unknown;
    for (let token = scanner.scan(); token !== S.EndOfFileToken; token = scanner.scan()) {
        if ((token === S.SlashToken || token === S.SlashEqualsToken) && !ends.has(previous))
            token = scanner.reScanSlashToken();
        if (token === S.OpenParenToken || token === S.OpenBracketToken || token === S.OpenBraceToken || token === S.TemplateHead) {
            stack.push(token === S.TemplateHead ? 'template' : 'bracket');
            if (stack.length > limit)
                return { line: source.slice(0, scanner.getTokenStart()).split('\n').length };
        }
        else if (token === S.CloseBraceToken && stack.at(-1) === 'template') {
            token = scanner.reScanTemplateToken(false);
            if (token === S.TemplateTail)
                stack.pop();
        }
        else if (token === S.CloseParenToken || token === S.CloseBracketToken || token === S.CloseBraceToken)
            stack.pop();
        previous = token;
    }
    return null;
}
//# sourceMappingURL=source-nesting.js.map