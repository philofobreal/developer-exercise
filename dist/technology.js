const parts = (version) => version.split('.').map(Number);
/** Negative when `a` is older than `b`, positive when newer, zero when they are the same version (`5` and `5.0`). */
export function compareVersions(a, b) {
    const x = parts(a), y = parts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const difference = (x[i] ?? 0) - (y[i] ?? 0);
        if (difference)
            return difference;
    }
    return 0;
}
/** The newer of two versions; `a` when they are the same. */
export const newerVersion = (a, b) => compareVersions(b, a) > 0 ? b : a;
/** What is wrong with a technology list whose shape the schema accepted: a technology named twice. */
export function technologiesProblem(technologies) {
    const seen = new Set();
    for (const technology of technologies ?? []) {
        if (seen.has(technology.id))
            return 'Egy technológia csak egyszer szerepelhet a feladat jelölésében.';
        seen.add(technology.id);
    }
    return undefined;
}
//# sourceMappingURL=technology.js.map