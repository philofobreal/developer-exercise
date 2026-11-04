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
import { type Value } from './footprint-values.js';
export declare class ObjectHeap {
    private readonly fields;
    private readonly elements;
    private readonly certainAt;
    private readonly memberSets;
    private readonly firsts;
    private readonly reshapedArrays;
    private readonly literals;
    private readonly createdAt;
    private current;
    private certain;
    private grew;
    /** The list position of the statement being interpreted. */
    get position(): number;
    get changed(): boolean;
    startRound(): void;
    /** A fact outside the heap grew (an object identity, an escape). */
    touch(): void;
    /** Starts the statement at list position `index`; it adds the cells it certainly writes to the set returned. */
    enter(index: number): Set<string>;
    /** Ends the statement started last: `completed` when it has a footprint (its certain writes count). */
    leave(completed: boolean): void;
    /** What the current statement may read from field `name` of `object`; undefined when nothing visible was written. */
    field(object: string, name: string): Value | undefined;
    /** Every field value the current statement may read from `object`. */
    fieldValues(object: string): Value[];
    hasField(object: string, name: string): boolean;
    /** What the current statement may read from the elements of array `object`. */
    items(object: string): Value;
    addField(object: string, name: string, value: Value): void;
    addElements(object: string, value: Value): void;
    /** An array the current statement creates has elements at its position, even when it has none. */
    created(object: string): void;
    /** Every value `object` ever holds (what an escaping object hands to unknown code). */
    held(object: string): Value[];
    /** The current statement creates the own array literal `object` with these element values. */
    literal(object: string, values: readonly Value[]): void;
    /** ADR-072: the members of an own array literal whose elements are single own objects. */
    members(object: string): Set<string> | null | undefined;
    /** ADR-070: the first element of an own array literal, unless an unshift, pop or shift may have changed it. */
    first(object: string): Value | undefined;
    reshaped(object: string): boolean;
    /** An unshift, pop or shift ran on `object`. */
    reshape(object: string): void;
    /** ADR-084: the elements of an own array literal in order, while no statement but its creation wrote them. */
    inOrder(object: string): Value[] | undefined;
    private grow;
    private upTo;
}
