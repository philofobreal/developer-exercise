/** The input contract of an exercise (ADR-050, policy v26). Author-only: it reads the reference
 * source and never runs for learner submissions.
 *
 * `any` (the default): a caller may pass any value, accessors, proxies and conversion hooks
 * included. `valid`: outside values are valid plain data (primitives, plain arrays and objects,
 * Set/Map, callbacks as direct parameters), well formed for the code, so reading a property,
 * converting or spreading a value and calling a listed built-in run no code and cannot throw.
 * This module hides what the contract lets the analysis assume in one program, and what the
 * program itself takes back: source text that can change what a read does disables it; the
 * program's own accessor names, conversion methods, generators and member names keep the reads,
 * conversions, spreads and calls they could reach.
 */
import type ts from 'typescript';
type Compiler = typeof ts;
export type InputContract = 'any' | 'valid';
export interface InputFacts {
    /** `valid` was asked for and nothing in the source can change what a read does. */
    readonly applies: boolean;
    /** `valid` was asked for but the program can change what a read does, so the analysis stays strict. */
    readonly unavailable: boolean;
    /** Converting an object runs only built-in code: the program names no conversion method. */
    readonly conversions: boolean;
    /** Reading this property name may run the program's own accessor. */
    accessor(name: string): boolean;
    /** A computed read or an object spread may reach one of the program's accessors. */
    readonly anyAccessor: boolean;
    /** Spreading or iterating may run the body of one of the program's generators. */
    readonly generators: boolean;
    /** `name(…)` of an undeclared global is a listed built-in function. */
    builtinFunction(name: string): boolean;
    /** `owner.name(…)` of an undeclared global owner is a listed built-in with this many arguments. */
    builtinStatic(owner: string, name: string, count: number): boolean;
    /** `x.name(…)` is a listed built-in method that no member of the program shadows. */
    builtinMethod(name: string): boolean;
    /** `new name(…)` of an undeclared global is a listed built-in constructor with this many arguments. */
    builtinConstructor(name: string, count: number): boolean;
}
export declare function inputFacts(file: ts.SourceFile, compiler: Compiler, inputs?: InputContract): InputFacts;
export {};
