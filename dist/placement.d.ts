import type { CompiledRules } from './model.js';
export interface Placement {
    /** Places `token` at the free `position` unless a rule rules the branch out. */
    tryPlace(token: number, position: number): boolean;
    /** Undoes the most recent successful placement. */
    undo(): void;
    /** Whether the full assignment closes every scope it opened. */
    complete(): boolean;
    /** A copy of the assignment, position → token index (-1 where nothing is placed). */
    witness(): number[];
}
export declare function createPlacement(compiled: CompiledRules, profile: number): Placement;
