/** The abstract heap of one statement list's own objects (NY-12, ADR-085). It hides how a cell's
 * values are kept and which of them a statement sees:
 *  - v37 (ADR-071): a cell (one field of an object, or an array's elements) keeps each value with the
 *    position of the list statement that wrote it. The statement at `position` sees the values written
 *    at or before it: every statement that writes a cell it reads is ordered with it, so in every
 *    accepted order a write of a later statement still runs after it;
 *  - v38 (ADR-072): the field cells each list statement certainly overwrites whenever it completes
 *    normally (narrowed only, across the fixpoint's rounds). A reader sees no value written before the
 *    last statement ahead of it that certainly overwrote the cell;
 *  - the facts of an own array literal: the members of one whose elements are single own objects
 *    (ADR-072), its first element and whether an unshift, pop or shift may have changed it (ADR-070),
 *    and its elements in order while no other statement wrote it (ADR-084).
 * `changed` tells the fixpoint whether any fact grew since `startRound`. */
import { PRIM, union } from './footprint-values.js';
export class ObjectHeap {
    fields = new Map();
    elements = new Map();
    certainAt = new Map();
    memberSets = new Map();
    firsts = new Map();
    reshapedArrays = new Set();
    literals = new Map();
    createdAt = new Map();
    current = -1;
    certain = new Set();
    grew = false;
    /** The list position of the statement being interpreted. */
    get position() { return this.current; }
    get changed() { return this.grew; }
    startRound() { this.grew = false; }
    /** A fact outside the heap grew (an object identity, an escape). */
    touch() { this.grew = true; }
    /** Starts the statement at list position `index`; it adds the cells it certainly writes to the set returned. */
    enter(index) {
        this.current = index;
        this.certain = new Set();
        return this.certain;
    }
    /** Ends the statement started last: `completed` when it has a footprint (its certain writes count). */
    leave(completed) {
        const index = this.current, cells = completed ? this.certain : new Set();
        const before = this.certainAt.get(index), after = before ? new Set([...before].filter(key => cells.has(key))) : new Set(cells);
        if (before && after.size !== before.size)
            this.grew = true;
        this.certainAt.set(index, after);
    }
    /** What the current statement may read from field `name` of `object`; undefined when nothing visible was written. */
    field(object, name) {
        const key = object + '::' + name;
        let from = -Infinity;
        for (const [writer, cells] of this.certainAt)
            if (writer < this.current && writer > from && cells.has(key))
                from = writer;
        return this.upTo(this.fields.get(object)?.get(name), from);
    }
    /** Every field value the current statement may read from `object`. */
    fieldValues(object) {
        return [...this.fields.get(object)?.keys() ?? []].flatMap(name => this.field(object, name) ?? []);
    }
    hasField(object, name) { return !!this.fields.get(object)?.has(name); }
    /** What the current statement may read from the elements of array `object`. */
    items(object) { return this.upTo(this.elements.get(object)) ?? PRIM; }
    addField(object, name, value) {
        const map = this.fields.get(object) ?? new Map(), cell = map.get(name) ?? new Map();
        this.grow(cell, value);
        map.set(name, cell);
        this.fields.set(object, map);
    }
    addElements(object, value) {
        const cell = this.elements.get(object) ?? new Map();
        this.grow(cell, value);
        this.elements.set(object, cell);
    }
    /** An array the current statement creates has elements at its position, even when it has none. */
    created(object) { if (!this.elements.get(object)?.has(this.current))
        this.addElements(object, PRIM); }
    /** Every value `object` ever holds (what an escaping object hands to unknown code). */
    held(object) {
        return [...[...this.fields.get(object)?.values() ?? []].flatMap(cell => [...cell.values()]), ...this.elements.has(object) ? [...this.elements.get(object).values()] : []];
    }
    /** The current statement creates the own array literal `object` with these element values. */
    literal(object, values) {
        const members = new Set();
        let single = this.memberSets.get(object) !== null;
        values.forEach((value, index) => {
            this.addElements(object, value);
            if (!index)
                this.firsts.set(object, union(this.firsts.get(object) ?? value, value));
            if (value.prim || value.other || value.objs.size !== 1)
                single = false;
            else
                members.add([...value.objs][0]);
        });
        this.memberSets.set(object, single ? members : null);
        this.literals.set(object, [...values]);
        this.createdAt.set(object, this.current);
        this.created(object);
    }
    /** ADR-072: the members of an own array literal whose elements are single own objects. */
    members(object) { return this.memberSets.get(object); }
    /** ADR-070: the first element of an own array literal, unless an unshift, pop or shift may have changed it. */
    first(object) { return this.reshapedArrays.has(object) ? undefined : this.firsts.get(object); }
    reshaped(object) { return this.reshapedArrays.has(object); }
    /** An unshift, pop or shift ran on `object`. */
    reshape(object) { if (!this.reshapedArrays.has(object)) {
        this.reshapedArrays.add(object);
        this.grew = true;
    } }
    /** ADR-084: the elements of an own array literal in order, while no statement but its creation wrote them. */
    inOrder(object) {
        if (this.reshapedArrays.has(object))
            return undefined;
        const created = this.createdAt.get(object);
        return [...this.elements.get(object)?.keys() ?? []].every(written => written === created) ? this.literals.get(object) : undefined;
    }
    grow(cell, value) {
        const before = cell.get(this.current), after = before ? union(before, value) : value;
        if (!before || after.prim !== before.prim || after.text !== before.text || after.other !== before.other || after.objs.size !== before.objs.size || !!after.known !== !!before.known)
            this.grew = true;
        cell.set(this.current, after);
    }
    upTo(cell, from = -Infinity) {
        const visible = [...cell ?? []].filter(([written]) => written >= from && written <= this.current).map(([, value]) => value);
        return visible.length ? union(...visible) : undefined;
    }
}
//# sourceMappingURL=object-heap.js.map