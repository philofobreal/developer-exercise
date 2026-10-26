/** Language audit of an author reference beyond syntax (ADR-016). Never runs for learner input.
 *
 * Syntax (and exact whitespace) is the admission gate of audit.mjs. This module adds a
 * single-file TypeScript `Program` check with the standard library and reports what it
 * could and could not establish:
 *  - `ok`: no diagnostic in this single-file context;
 *  - `errors`: a definite language error (type error, redeclaration…);
 *  - `unverifiable`: only diagnostics that a missing project context explains
 *    (an unresolved module, an undeclared global); the reference may be correct;
 *  - `not-run`: no standard library is available (static Pages demo).
 * The result is reported at every admission, never stored in or trusted from a model.
 * The library files come through a port, so the module stays browser-safe; a parsed
 * library is cached per auditor. JavaScript is checked for binding and grammar errors
 * only (no `checkJs`): its untyped code would otherwise yield inference noise.
 */
import type ts from 'typescript';

/** Returns the text of a standard library file (`lib.es2022.full.d.ts`, …) or undefined. */
export type LibraryPort = (fileName: string) => string | undefined;
export interface ReferenceAudit {
 semantics: 'ok' | 'errors' | 'unverifiable' | 'not-run';
 /** First 20 diagnostics, 1-based physical source lines; `context`: explained by a missing project context. */
 diagnostics: {line: number; code: number; message: string; context: boolean}[];
 /** Module specifiers the single-file context cannot resolve (at most 50). */
 unresolved: string[];
 /** The fixed configuration the result depends on. */
 assumptions: string[];
}
export interface ReferenceAuditor {audit(source: string, language: 'javascript' | 'typescript'): ReferenceAudit;}

const DEFAULT_LIB = 'lib.es2022.full.d.ts';
/** Unresolved modules, undeclared names and namespaces, and missing ambient typings. */
const CONTEXT_CODES = new Set([2307, 2792, 2304, 2552, 2503, 2580, 2582, 2583, 2584, 2591, 2688]);
const UNRESOLVED_MODULE = new Set([2307, 2792]);

export function createReferenceAuditor(compiler: typeof ts, library?: LibraryPort): ReferenceAuditor {
 const libraries = new Map<string, ts.SourceFile | undefined>();
 const libraryFile = (fileName: string): ts.SourceFile | undefined => {
  const name = fileName.slice(fileName.lastIndexOf('/') + 1);
  if (!library || !/^lib\.[a-z0-9.]+\.d\.ts$/.test(name)) return undefined;
  if (!libraries.has(name)) {const text = library(name); libraries.set(name, text === undefined ? undefined : compiler.createSourceFile(name, text, compiler.ScriptTarget.ES2022));}
  return libraries.get(name);
 };
 function audit(source: string, language: 'javascript' | 'typescript'): ReferenceAudit {
  const assumptions = ['single-file', 'target:es2022', 'module:esnext', 'non-strict', ...(language === 'javascript' ? ['javascript-binding-only'] : [])];
  if (!library || !libraryFile(DEFAULT_LIB)) return {semantics: 'not-run', diagnostics: [], unresolved: [], assumptions: [...assumptions, 'no-standard-library']};
  const fileName = 'reference.' + (language === 'typescript' ? 'ts' : 'js');
  const file = compiler.createSourceFile(fileName, source, compiler.ScriptTarget.ES2022, true, language === 'typescript' ? compiler.ScriptKind.TS : compiler.ScriptKind.JS);
  // Decorators are checked in TypeScript's legacy mode, the one frameworks such as Angular build with.
  let decorated = false;
  const scan = (node: ts.Node): void => {if (compiler.isDecorator(node)) decorated = true; else if (!decorated) compiler.forEachChild(node, scan);};
  scan(file);
  if (decorated) assumptions.push('experimental-decorators');
  const options: ts.CompilerOptions = {target: compiler.ScriptTarget.ES2022, module: compiler.ModuleKind.ESNext, moduleResolution: compiler.ModuleResolutionKind.Bundler, allowJs: true, noEmit: true, types: [], skipDefaultLibCheck: true, experimentalDecorators: decorated, lib: [DEFAULT_LIB]};
  const host: ts.CompilerHost = {
   getSourceFile: name => name === fileName ? file : libraryFile(name),
   getDefaultLibFileName: () => DEFAULT_LIB, getDefaultLibLocation: () => '', writeFile: () => undefined, getCurrentDirectory: () => '', getDirectories: () => [],
   getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
   fileExists: name => name === fileName || !!libraryFile(name), readFile: () => undefined
  };
  const program = compiler.createProgram([fileName], options, host);
  const found = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file), ...program.getGlobalDiagnostics()];
  const unresolved = new Set<string>();
  const diagnostics = found.map(diagnostic => {
   const start = diagnostic.start ?? 0;
   if (UNRESOLVED_MODULE.has(diagnostic.code) && diagnostic.file === file && diagnostic.length) unresolved.add(file.text.slice(start + 1, start + diagnostic.length - 1));
   return {line: diagnostic.file === file ? file.getLineAndCharacterOfPosition(start).line + 1 : 0, code: diagnostic.code, message: compiler.flattenDiagnosticMessageText(diagnostic.messageText, ' ').slice(0, 300), context: CONTEXT_CODES.has(diagnostic.code)};
  });
  const semantics = diagnostics.some(diagnostic => !diagnostic.context) ? 'errors' : diagnostics.length ? 'unverifiable' : 'ok';
  return {semantics, diagnostics: diagnostics.slice(0, 20), unresolved: [...unresolved].slice(0, 50), assumptions: [...assumptions, 'lib:' + DEFAULT_LIB]};
 }
 return {audit};
}
