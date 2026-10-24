import type { ExerciseDefinition, OrderingEdge } from './types.js';
import type { UnitStructure } from './language-ir.js';
export declare function hierarchyValid(items: readonly {
    id: string;
    parentId: string | null;
}[]): boolean;
/** Audit the lowered opt-in contract even when compileDefinition is called directly. */
export declare function auditUnitStructure(def: ExerciseDefinition, s: UnitStructure): OrderingEdge[] | string;
/** Precomputed structural checks for the existing bounded bijection search. */
export declare function createUnitChecks(def: ExerciseDefinition): {
    scopesValid: (assignment: Int32Array, partial: boolean) => boolean;
    placementValid: (token: number, position: number, positions: Int32Array) => boolean;
};
