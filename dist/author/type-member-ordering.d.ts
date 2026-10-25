/** Erased, distinct TS data members may commute; runtime class fields/writes never do.
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs, so
 * their position in the class body is unobservable (ADR-008). Runs for JS too. */
import type ts from 'typescript';
type Compiler = typeof ts;
interface Entry {
    row: number;
    after: number[];
}
export interface TypeMemberOrdering {
    entries: Entry[];
    note: string;
}
export declare function typeMemberOrdering(file: ts.SourceFile, compiler: Compiler): TypeMemberOrdering;
export {};
