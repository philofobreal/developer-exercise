/** The abstract values of the object-footprint interpretation (ADR-025, ADR-032; NY-12, ADR-085):
 * a value may be a primitive (possibly a known one), any of a set of abstract objects, or `other`
 * (a fresh result nobody tracks). Heap cells and footprint keys are named by `at(object, field)`. */
export const PRIM = { prim: true, text: false, objs: new Set(), other: false };
export const STR = { prim: true, text: true, objs: new Set(), other: false };
export const OTHER = { prim: false, text: false, objs: new Set(), other: true };
const same = (values) => values.every(v => v.known && Object.is(v.known.lit, values[0].known.lit)) ? values[0].known : undefined;
export const union = (...values) => { const known = values.length ? same(values) : undefined; return { prim: values.some(v => v.prim), text: values.some(v => v.prim) && values.every(v => !v.prim || v.text), objs: new Set(values.flatMap(v => [...v.objs])), other: values.some(v => v.other), ...known ? { known } : {} }; };
/** ADR-032: a value known to be exactly this primitive. */
export const literal = (lit) => ({ prim: true, text: typeof lit === 'string', objs: new Set(), other: false, known: { lit } });
export const objects = (...ids) => ({ prim: false, text: false, objs: new Set(ids), other: false });
/** The field name that stands for every field of an object (and for an array's elements). */
export const WHOLE = '*';
export const at = (object, field) => object + '::' + field;
export const objectOf = (key) => key.slice(0, key.lastIndexOf('::'));
//# sourceMappingURL=footprint-values.js.map