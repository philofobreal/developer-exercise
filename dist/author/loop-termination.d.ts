/** Which loops over a list's own objects are shown to end (ADR-046, ADR-064). Author-only: it reads
 * the reference source and never runs for learner submissions.
 *
 * The object effect analysis (object-footprints.ts) orders a loop not shown to end like a possible
 * throw (`mayHang`). This module hides the termination arguments: the shapes it recognises, the
 * field-type argument behind a monotone `while`, and how calls are followed. The analysis gives
 * it the loop and what it knows about the receiver; the answer is one boolean.
 */
import type ts from 'typescript';
type Compiler = typeof ts;
/** What the effect analysis knows about the objects of the list: the methods of every analysable
 * class by name, and the one own object an identifier stands for. `receiver` returns undefined when
 * the identifier is not exactly one own object; a plain object or array literal has no members. */
export interface LoopObjects {
    methods: ReadonlyMap<string, readonly ts.MethodDeclaration[]>;
    receiver(name: ts.Identifier): {
        methods: ReadonlyMap<string, ts.MethodDeclaration>;
        accessors: ReadonlySet<string>;
        parameterFields: readonly string[];
    } | undefined;
}
/** Whether the loop is shown to end: a counting `for` (ADR-046) or a monotone `while` (ADR-064). */
export declare function loopEnds(statement: ts.IterationStatement, file: ts.SourceFile, compiler: Compiler, objects: LoopObjects): boolean;
/** Identifiers assigned anywhere in `root`, nested functions included (they may run in it). */
export declare function assignedNames(root: ts.Node, compiler: Compiler): Set<string>;
export {};
