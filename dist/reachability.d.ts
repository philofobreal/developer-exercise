/** Reachability over ordering edges: the one place in the core that knows how the transitive
 * closure is computed (Kahn order and per-token descendant bitsets). Callers ask whether a
 * token must precede another, list a token's descendants or ancestors, or read its
 * topological rank. A cyclic graph is reported, never half-computed: `acyclic` is false and
 * no token reaches another, so a caller cannot mistake a partial closure for the whole one. */
export interface Reachability {
    readonly acyclic: boolean;
    /** Position of each token in one topological order (acyclic graphs only). */
    readonly rank: Int32Array;
    reaches(from: number, to: number): boolean;
    /** Tokens reachable from `token`, ascending. */
    descendants(token: number): readonly number[];
    /** Tokens that reach `token`, ascending. */
    ancestors(token: number): readonly number[];
}
export declare function reachability(n: number, edges: readonly (readonly [number, number])[]): Reachability;
