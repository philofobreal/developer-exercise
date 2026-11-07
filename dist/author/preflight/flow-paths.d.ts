/** Facts and must-execute paths of one author reference (ADR-108, E3–E4). Author-only.
 *
 * One owner for the question the runtime-safety analyses ask: "if this statement runs, does it certainly
 * evaluate that node?" The answer is an allowlist of transparent constructs, joined over both branches of
 * an `if/else` and the first pass of a loop that certainly runs once; anything unknown is conditional.
 * A statement lets the flow continue to the next one only when it has no way out (`return`, `throw`,
 * `break`, `continue` outside nested functions): an early exit on some path makes what follows uncertain.
 * Symbols come from the compiler without a standard library, so this runs on Pages too. Every walk spends
 * one budget; once spent, the analyses stop and report `budget-exceeded`.
 */
import type ts from 'typescript';
export type Block = ts.Block | ts.SourceFile;
export interface ReferenceFacts {
    readonly compiler: typeof ts;
    readonly file: ts.SourceFile;
    readonly checker: ts.TypeChecker;
    lineOf(node: ts.Node): number;
    /** Counts one step; true once the budget is spent. */
    spend(): boolean;
    spent(): boolean;
    /** Identifiers that evaluate a value binding (reads and writes), by symbol. */
    readonly references: ReadonlyMap<ts.Symbol, readonly ts.Identifier[]>;
    isValueReference(id: ts.Identifier): boolean;
    symbolOf(id: ts.Identifier): ts.Symbol | undefined;
    /** The identifier is assigned (`=`, compound, `++`/`--`, a destructuring or `for…in/of` target). */
    isWrite(id: ts.Identifier): boolean;
    /** The block (source file or block) a statement belongs to. */
    blockOf(statement: ts.Node): Block | undefined;
    /** The unconditional abrupt statements before `statement` in `block` make it unreachable. */
    reachable(statement: ts.Node, block: Block): boolean;
    /** The statement can leave its enclosing flow on some path. */
    mayExit(statement: ts.Statement): boolean;
    /** Whether evaluating `parent` certainly evaluates `child`. */
    transparent(child: ts.Node, parent: ts.Node): boolean;
    /** Whether `node` is evaluated whenever `root` is (every step up to `root` is transparent). */
    transparentTo(node: ts.Node, root: ts.Node): boolean;
    /** The statement of `block` that certainly evaluates `node` when it runs, or undefined. */
    statementIn(node: ts.Node, block: Block): ts.Statement | undefined;
    /** Nodes satisfying `wanted` that a run of `statement` certainly evaluates (one per path), or undefined. */
    mustEvaluate(statement: ts.Statement, wanted: (node: ts.Node) => boolean): ts.Node[] | undefined;
}
export declare function referenceFacts(compiler: typeof ts, source: string, language: 'javascript' | 'typescript', budget?: number): ReferenceFacts;
