/** ADR-149: which language versions a reference source needs. For each language the answer is the version of
 * the newest element the source uses, so the label of an exercise is measured, not typed in.
 *
 * Hidden here:
 *  - the table from syntax to ECMAScript edition and to TypeScript release (read from the source's own tree,
 *    never from compiled output);
 *  - how a standard library element gets its edition: the type checker follows the name to its declaration, and
 *    the declaring library file names the edition (`lib.es2023.array.d.ts`);
 *  - what to do where the checker cannot follow (an untyped receiver in JavaScript): the member's name decides,
 *    by the oldest edition that declares a member of that name, unless the source declares that name itself.
 *
 * Limits, recorded in ADR-149: a novelty that lives in the type checker's behaviour and not in syntax is not seen;
 * a name-based answer is a lower bound; without the standard library only the syntax is measured. */
import type ts from 'typescript';
import type { Technology } from '../../dist/index.js';
import type { LibraryPort } from './reference-audit.js';
export interface TechnologyProfiler {
    /** The technologies of `source`, each with the version of the newest element the source uses: ECMAScript always
     * (`5` for anything older than ES2015), TypeScript for a TypeScript source (`1.0` for anything older). */
    profile(source: string, language: 'javascript' | 'typescript'): Technology[];
}
export declare function createTechnologyProfiler(compiler: typeof ts, library?: LibraryPort): TechnologyProfiler;
