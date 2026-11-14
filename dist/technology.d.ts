/** ADR-149: the technologies an exercise is made of, each with a version. A label for people who look for
 * exercises; the validator never reads it.
 *
 * Hidden here: how versions are ordered and when a list is well formed. A version is a dotted number
 * (`2020`, `4.9`, `7.8.2`) and orders by its parts, so `4.10` is newer than `4.9`.
 *
 * What a version means is its technology's own matter:
 *  - `ecmascript`: the edition of the newest language or standard library element the code uses (`5` for anything
 *    older than ES2015);
 *  - `typescript`: the release of the newest TypeScript element the code uses. */
export type TechnologyId = 'ecmascript' | 'typescript';
export interface Technology {
    id: TechnologyId;
    version: string;
}
/** Negative when `a` is older than `b`, positive when newer, zero when they are the same version (`5` and `5.0`). */
export declare function compareVersions(a: string, b: string): number;
/** The newer of two versions; `a` when they are the same. */
export declare const newerVersion: (a: string, b: string) => string;
/** What is wrong with a technology list whose shape the schema accepted: a technology named twice. */
export declare function technologiesProblem(technologies: readonly Technology[] | undefined): string | undefined;
