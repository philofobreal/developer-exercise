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
 *
 * ADR-108 (E2): the author may ask for a stricter check. `tsDiagnostics: 'strict'` compiles TypeScript
 * with the `strict` family (the author's build is strict, so its errors are definite compile errors).
 * `jsCheck: 'on'` type-checks JavaScript (`checkJs`); JavaScript still runs whatever a type checker
 * thinks, so a finding that only the type check reports is `possible`, never definite (ADR-108, the
 * TDZ measurement): only what the binding-and-grammar pass also reports stays definite.
 * The library files come through a port, so the module stays browser-safe; a parsed
 * library is cached per auditor. JavaScript is checked for binding and grammar errors
 * only (no `checkJs`): its untyped code would otherwise yield inference noise.
 */
import type ts from 'typescript';
/** Returns the text of a standard library file (`lib.es2022.full.d.ts`, …) or undefined. */
export type LibraryPort = (fileName: string) => string | undefined;
export interface AuditMode {
    tsDiagnostics?: 'baseline' | 'strict';
    jsCheck?: 'off' | 'on';
}
export type AuditCertainty = 'definite' | 'possible' | 'unknown';
export interface ReferenceAudit {
    /** From the definite diagnostics: `errors` when there is one; `unverifiable` when only a missing project
     * context explains what was found; `ok` otherwise (possible findings of a type check may remain). */
    semantics: 'ok' | 'errors' | 'unverifiable' | 'not-run';
    /** First 20 diagnostics, 1-based physical source lines; `context`: explained by a missing project context;
     * `certainty`: definite (a language or compile error), possible (only a JavaScript type check reports it),
     * unknown (a missing project context explains it). */
    diagnostics: {
        line: number;
        code: number;
        message: string;
        context: boolean;
        certainty: AuditCertainty;
    }[];
    /** Module specifiers the single-file context cannot resolve (at most 50). */
    unresolved: string[];
    /** The fixed configuration the result depends on. */
    assumptions: string[];
}
export interface ReferenceAuditor {
    audit(source: string, language: 'javascript' | 'typescript', mode?: AuditMode): ReferenceAudit;
}
export declare function createReferenceAuditor(compiler: typeof ts, library?: LibraryPort): ReferenceAuditor;
