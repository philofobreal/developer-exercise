/** Lexical nesting budget of an author JS/TS source (ADR-103). Author-only; never runs for learner input.
 *
 * The TypeScript parser is recursive: a few kilobytes of nested brackets exhaust the call stack
 * (`RangeError`), and type-checking time grows steeply with nesting depth (ADR-103 measurement). This
 * module measures the deepest nesting of `(`, `[`, `{` and template substitutions `${…}` with the
 * compiler's scanner, which is linear and non-recursive, before any parse. A `/` after a token that
 * cannot end an expression is rescanned as a regular expression, and a `}` that closes a template
 * substitution is rescanned as template text, so brackets inside literals, comments, regular
 * expressions and template text never count. The caller rejects a source deeper than `MAX_NESTING`.
 */
import type ts from 'typescript';

/** The same bound the Python author audit applies to lexical nesting (src/python/audit-script.ts). */
export const MAX_NESTING = 64;

export interface NestingExcess {
 /** 1-based physical row where the nesting first exceeds the limit. */
 line: number;
}

/** The first place where the nesting exceeds `limit`, or null. Stops there, so the cost stays linear. */
export function nestingExcess(source: string, compiler: typeof ts, limit: number = MAX_NESTING): NestingExcess | null {
 const S = compiler.SyntaxKind;
 const scanner = compiler.createScanner(compiler.ScriptTarget.Latest, true, compiler.LanguageVariant.Standard, source);
 // Tokens after which a `/` divides; after any other token it starts a regular expression.
 const ends = new Set<ts.SyntaxKind>([S.Identifier, S.PrivateIdentifier, S.ThisKeyword, S.SuperKeyword, S.NullKeyword, S.TrueKeyword, S.FalseKeyword,
  S.NumericLiteral, S.BigIntLiteral, S.StringLiteral, S.NoSubstitutionTemplateLiteral, S.TemplateTail, S.RegularExpressionLiteral,
  S.CloseParenToken, S.CloseBracketToken, S.CloseBraceToken, S.PlusPlusToken, S.MinusMinusToken]);
 const stack: ('bracket' | 'template')[] = [];
 let previous: ts.SyntaxKind = S.Unknown;
 for (let token = scanner.scan(); token !== S.EndOfFileToken; token = scanner.scan()) {
  if ((token === S.SlashToken || token === S.SlashEqualsToken) && !ends.has(previous)) token = scanner.reScanSlashToken();
  if (token === S.OpenParenToken || token === S.OpenBracketToken || token === S.OpenBraceToken || token === S.TemplateHead) {
   stack.push(token === S.TemplateHead ? 'template' : 'bracket');
   if (stack.length > limit) return {line: source.slice(0, scanner.getTokenStart()).split('\n').length};
  } else if (token === S.CloseBraceToken && stack.at(-1) === 'template') {
   token = scanner.reScanTemplateToken(false);
   if (token === S.TemplateTail) stack.pop();
  } else if (token === S.CloseParenToken || token === S.CloseBracketToken || token === S.CloseBraceToken) stack.pop();
  previous = token;
 }
 return null;
}
