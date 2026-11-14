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
export interface Technology { id: TechnologyId; version: string }

const parts = (version: string): number[] => version.split('.').map(Number);
/** Negative when `a` is older than `b`, positive when newer, zero when they are the same version (`5` and `5.0`). */
export function compareVersions(a: string, b: string): number {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
/** The newer of two versions; `a` when they are the same. */
export const newerVersion = (a: string, b: string): string => compareVersions(b, a) > 0 ? b : a;
/** What is wrong with a technology list whose shape the schema accepted: a technology named twice. */
export function technologiesProblem(technologies: readonly Technology[] | undefined): string | undefined {
  const seen = new Set<string>();
  for (const technology of technologies ?? []) {
    if (seen.has(technology.id)) return 'Egy technológia csak egyszer szerepelhet a feladat jelölésében.';
    seen.add(technology.id);
  }
  return undefined;
}
