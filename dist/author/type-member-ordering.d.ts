/** Erased, distinct TS data members may commute; runtime class fields/writes never do. */
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
