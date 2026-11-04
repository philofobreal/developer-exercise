/** The abstract values of the object-footprint interpretation (ADR-025, ADR-032; NY-12, ADR-085):
 * a value may be a primitive (possibly a known one), any of a set of abstract objects, or `other`
 * (a fresh result nobody tracks). Heap cells and footprint keys are named by `at(object, field)`. */
/** `known` (ADR-032): the one primitive the value certainly is. */
export type Literal = string | number | boolean | null | undefined;
/** `text`: every primitive the value may be is a string (ADR-028). */
export interface Value {
    prim: boolean;
    text: boolean;
    objs: Set<string>;
    other: boolean;
    known?: {
        lit: Literal;
    };
}
export declare const PRIM: Value;
export declare const STR: Value;
export declare const OTHER: Value;
export declare const union: (...values: Value[]) => Value;
/** ADR-032: a value known to be exactly this primitive. */
export declare const literal: (lit: Literal) => Value;
export declare const objects: (...ids: string[]) => Value;
/** The field name that stands for every field of an object (and for an array's elements). */
export declare const WHOLE = "*";
export declare const at: (object: string, field: string) => string;
export declare const objectOf: (key: string) => string;
