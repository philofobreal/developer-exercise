/** Erased, distinct TS data members may commute; runtime class fields/writes never do.
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs, so
 * their position in the class body is unobservable (ADR-008). TypeScript emits
 * parameter properties at the start of construction in both class-field modes,
 * whatever the constructor's position, and erases declare fields (ADR-009).
 * Runs for JS too. */
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
