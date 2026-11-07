/** The runtime-safety analyses of the first gate, over one set of reference facts (ADR-108, E3–E4).
 * Binding safety (TDZ) always runs: it is part of the author policy's non-switchable definite-error
 * blocking. Local object state runs under `objectState: local` (the default). A spent budget in either
 * makes the whole result `budget-exceeded`. */
import type ts from 'typescript';
import { type RuntimeAnalysis } from './binding-safety.js';
export declare function runtimeSafety(compiler: typeof ts, source: string, language: 'javascript' | 'typescript', options: {
    objectState: 'off' | 'local';
}): RuntimeAnalysis;
