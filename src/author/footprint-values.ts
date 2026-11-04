/** The abstract values of the object-footprint interpretation (ADR-025, ADR-032; NY-12, ADR-085):
 * a value may be a primitive (possibly a known one), any of a set of abstract objects, or `other`
 * (a fresh result nobody tracks). Heap cells and footprint keys are named by `at(object, field)`. */

/** `known` (ADR-032): the one primitive the value certainly is. */
export type Literal = string | number | boolean | null | undefined;
/** `text`: every primitive the value may be is a string (ADR-028). */
export interface Value {prim: boolean; text: boolean; objs: Set<string>; other: boolean; known?: {lit: Literal};}

export const PRIM: Value = {prim: true, text: false, objs: new Set(), other: false};
export const STR: Value = {prim: true, text: true, objs: new Set(), other: false};
export const OTHER: Value = {prim: false, text: false, objs: new Set(), other: true};
const same = (values: Value[]): Value['known'] => values.every(v => v.known && Object.is(v.known.lit, values[0]!.known!.lit)) ? values[0]!.known : undefined;
export const union = (...values: Value[]): Value => {const known = values.length ? same(values) : undefined; return {prim: values.some(v => v.prim), text: values.some(v => v.prim) && values.every(v => !v.prim || v.text), objs: new Set(values.flatMap(v => [...v.objs])), other: values.some(v => v.other), ...known ? {known} : {}};};
/** ADR-032: a value known to be exactly this primitive. */
export const literal = (lit: Literal): Value => ({prim: true, text: typeof lit === 'string', objs: new Set(), other: false, known: {lit}});
export const objects = (...ids: string[]): Value => ({prim: false, text: false, objs: new Set(ids), other: false});

/** The field name that stands for every field of an object (and for an array's elements). */
export const WHOLE = '*';
export const at = (object: string, field: string): string => object + '::' + field;
export const objectOf = (key: string): string => key.slice(0, key.lastIndexOf('::'));
