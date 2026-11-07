/** Binding safety of an author reference (ADR-108, E3). Author-only; never runs for learner input.
 *
 * Finds accesses to a `let`, `const` or `class` binding before its initialization (the temporal dead
 * zone, a `ReferenceError` at run time) that are **definite**: the access happens on every execution
 * that reaches its block. The compiler reports the direct case in TypeScript only, and also inside a
 * branch that never runs (ADR-108 measurement); this analysis covers both languages, directly and
 * through calls (`const f = () => x; f(); const x = 1;`), and stays silent where it cannot be sure.
 *
 * Definite means all of:
 *  - the binding is identified by the compiler's symbol resolution (shadowing is respected);
 *  - the access lies on an unconditional path inside the declaration's block: no function boundary,
 *    branch body, loop body, `try`, short-circuit right operand, optional chain tail or default value
 *    in between (an allowlist of transparent constructs; anything else counts as conditional);
 *  - no unconditional `return`, `throw`, `break` or `continue` precedes it in any block on that path;
 *  - it precedes the declaration statement, or lies in its own (or an earlier declarator's) initializer
 *    or in the class's heritage clause;
 *  - through a call: the callee is certainly the function it names (a function declaration never
 *    assigned, a `const` bound to a function expression declared before the call, or an immediately
 *    invoked one), and its body reaches the access unconditionally; at most 8 calls deep.
 * The analysis needs no standard library, so it runs on Pages too. A work budget bounds it; when it is
 * spent the result is `budget-exceeded`, which a gate treats as unknown, never as passed.
 */
import type ts from 'typescript';
export interface BindingFinding {
    line: number;
    code: 'BS001' | 'BS002';
    message: string;
    certainty: 'definite';
    origin: 'runtime-order';
    binding: string;
}
export interface BindingSafety {
    completeness: 'within-supported-scope' | 'budget-exceeded';
    findings: BindingFinding[];
}
export declare function bindingSafety(compiler: typeof ts, source: string, language: 'javascript' | 'typescript'): BindingSafety;
