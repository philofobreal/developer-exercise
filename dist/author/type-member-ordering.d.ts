/** Erased, distinct TS data members may commute; runtime class fields keep their
 * order within their evaluation phase (ADR-012).
 * Uniquely named class methods, accessors and constructors are definitions: the
 * class installs them before any field initialiser or static code runs (ADR-008);
 * so is each half of a getter/setter pair, which creates one property (ADR-012).
 * Phases (ADR-012): computed method keys are evaluated while the class elements
 * are defined, static initialisers and blocks run after that, instance
 * initialisers at construction; units of different phases commute.
 * Their relative order is reflectable (ADR-010): OrdinaryOwnPropertyKeys lists
 * string keys in creation order. These keys are non-enumerable, so only an
 * explicit getOwnPropertyNames/Reflect.ownKeys can see it; since v11 (ADR-020)
 * the key chain applies only when the program can (options.reflectedKeys). Then
 * every member that creates a string key on the prototype (or, if static, on the
 * constructor) keeps its order relative to the other such members. Free of that order are: the constructor
 * (`constructor` is created first), array-index keys (listed ascending),
 * private names (not reflected) and erased members. An `accessor` field is in
 * that key chain and keeps its field order too. TypeScript emits parameter
 * properties at the start of construction in both class-field modes, whatever
 * the constructor's position, and erases declare fields (ADR-009). Runs for JS too.
 * Every edge carries its reason (ADR-014). */
import type ts from 'typescript';
import { type OrderingEntry } from './ordering-relations.js';
type Compiler = typeof ts;
/** `spans` lists every ordered member/comment unit (0-based physical rows) so the
 * generator can keep same-scope siblings out of a multi-row unit's interior. */
export interface TypeMemberOrdering {
    entries: OrderingEntry[];
    spans: {
        first: number;
        last: number;
    }[];
    note: string;
}
/** `reflectedKeys` (ADR-020): the program may list non-enumerable keys, so the ADR-010 key chain applies. */
export declare function typeMemberOrdering(file: ts.SourceFile, compiler: Compiler, options?: {
    reflectedKeys?: boolean;
}): TypeMemberOrdering;
export {};
