/** Erased, distinct TS data members may commute; runtime class fields/writes never do.
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs (ADR-008).
 * Their relative order is still reflectable (ADR-010): OrdinaryOwnPropertyKeys
 * lists string keys in creation order, so every member that creates a string
 * key on the prototype (or, if static, on the constructor) keeps its order
 * relative to the other such members. Free of that order are: the constructor
 * (`constructor` is created first), array-index keys (listed ascending),
 * private names (not reflected) and erased members. TypeScript emits parameter
 * properties at the start of construction in both class-field modes, whatever
 * the constructor's position, and erases declare fields (ADR-009). Runs for JS too. */
import type ts from 'typescript';
type Compiler = typeof ts;
interface Entry {
    row: number;
    after: number[];
}
/** `spans` lists every ordered member/comment unit (0-based physical rows) so the
 * generator can keep same-scope siblings out of a multi-row unit's interior. */
export interface TypeMemberOrdering {
    entries: Entry[];
    spans: {
        first: number;
        last: number;
    }[];
    note: string;
}
export declare function typeMemberOrdering(file: ts.SourceFile, compiler: Compiler): TypeMemberOrdering;
export {};
