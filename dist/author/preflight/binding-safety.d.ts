/** Binding safety of an author reference (ADR-108, E3–E4). Author-only; never runs for learner input.
 *
 * Finds accesses to a `let`, `const` or `class` binding before its initialization (the temporal dead
 * zone, a `ReferenceError` at run time) that are **definite**: whenever the statement holding them runs,
 * the access happens before the binding is initialized. The compiler reports the direct case in
 * TypeScript only, and also inside a branch that never runs (ADR-108 measurement); this analysis covers
 * both languages, directly and through calls (`const f = () => x; f(); const x = 1;`), and stays silent
 * where it cannot be sure.
 *
 * Definite means all of:
 *  - the binding is identified by the compiler's symbol resolution (shadowing is respected);
 *  - the statement certainly evaluates the access when it runs (flow-paths.ts: transparent constructs,
 *    both branches of an `if/else`, the first pass of a loop that certainly runs once; E4);
 *  - the statement is reachable and precedes the declaration, or the access lies in its own (or an
 *    earlier declarator's) initializer or in the class's heritage clause;
 *  - through a call: the callee is certainly the function it names (a function declaration never
 *    assigned, a `const` bound to a function expression declared before the call, or an immediately
 *    invoked one) and its body certainly reaches the access: no statement before it may leave the call
 *    on some path; at most 8 calls deep; a function containing the declaration makes a fresh binding
 *    per call (recursion), so a call path never reaches it.
 * A spent work budget is `budget-exceeded`, which a gate treats as unknown, never as passed.
 */
import type ts from 'typescript';
import { type ReferenceFacts } from './flow-paths.js';
export interface RuntimeFinding {
    line: number;
    code: string;
    message: string;
    certainty: 'definite';
    origin: 'runtime-order' | 'runtime-value';
    binding: string;
}
export interface RuntimeAnalysis {
    completeness: 'within-supported-scope' | 'budget-exceeded';
    findings: RuntimeFinding[];
}
/** Kept for the E3 callers: the binding findings are runtime findings of origin `runtime-order`. */
export type BindingFinding = RuntimeFinding;
export type BindingSafety = RuntimeAnalysis;
export declare function bindingSafety(compiler: typeof ts, source: string, language: 'javascript' | 'typescript'): RuntimeAnalysis;
export declare function bindingSafetyOf(facts: ReferenceFacts): RuntimeAnalysis;
