const NAMES = {
    ecmascript: { group: 'JavaScript (ECMAScript)', full: 'ECMAScript ', short: 'ES' },
    typescript: { group: 'TypeScript', full: 'TypeScript ', short: 'TS ' }
};
const ORDER = Object.keys(NAMES);
const parts = (version) => version.split('.').map(Number);
/** Negative when `a` is the older version; `4.10` is newer than `4.9`. */
export function compareVersions(a, b) {
    const x = parts(a), y = parts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const difference = (x[i] ?? 0) - (y[i] ?? 0);
        if (difference)
            return difference;
    }
    return 0;
}
/** The short label of a chip: `ES2020`, `ES5`, `TS 2.0`. */
export const technologyLabel = ({ id, version }) => (NAMES[id]?.short ?? id + ' ') + version;
/** The labels of an exercise, TypeScript before ECMAScript (the narrower statement first). */
export const technologiesOf = (exercise) => [...exercise.technologies ?? []].sort((a, b) => ORDER.indexOf(b.id) - ORDER.indexOf(a.id));
/** Every label the exercises carry, grouped by technology, oldest version first, with the number of exercises. */
export function technologyGroups(exercises) {
    const counts = new Map();
    for (const exercise of exercises)
        for (const { id, version } of exercise.technologies ?? []) {
            const versions = counts.get(id) ?? new Map();
            counts.set(id, versions);
            versions.set(version, (versions.get(version) ?? 0) + 1);
        }
    return [...counts].sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b)).map(([id, versions]) => ({ id, name: NAMES[id]?.group ?? id,
        facets: [...versions].sort(([a], [b]) => compareVersions(a, b)).map(([version, count]) => ({ id, version, label: technologyLabel({ id, version }), count })) }));
}
/** Without a filter every exercise matches; with one, an exercise that carries the label (or, with `earlier`, an
 *  older version of that technology). An exercise without labels matches no filter. */
export function matchesTechnology(exercise, filter) {
    if (!filter)
        return true;
    return (exercise.technologies ?? []).some(({ id, version }) => id === filter.id && (filter.earlier ? compareVersions(version, filter.version) <= 0 : compareVersions(version, filter.version) === 0));
}
/** The filter after its label was pressed: pressing the chosen label again clears it. */
export function toggleTechnology(filter, label) {
    return filter && filter.id === label.id && filter.version === label.version ? undefined : { ...label, earlier: filter?.earlier ?? false };
}
/** „-tól” or „-től” after a number, as it is read: the last spoken numeral decides (öt → től, hat → tól). */
const UNITS = ['tól', 'től', 'től', 'tól', 'től', 'től', 'tól', 'től', 'tól', 'től'], TENS = ['', 'től', 'tól', 'tól', 'től', 'től', 'tól', 'től', 'tól', 'től'];
function from(version) {
    const last = parts(version).at(-1) ?? 0, unit = last % 10, tens = Math.floor(last / 10) % 10;
    const suffix = last === 0 ? 'tól' : unit ? UNITS[unit] : tens ? TENS[tens] : last % 1000 === 0 ? 'től' : 'tól';
    return version + '-' + suffix;
}
/** The sentence under an exercise's title: from which versions it runs, and which compiler checked it.
 *  „TypeScript 2.0-tól · ES2018-tól · ellenőrizve: TypeScript 5.8”. Empty for an exercise without labels. */
export function technologyNote(exercise) {
    const said = technologiesOf(exercise).map(({ id, version }) => (id === 'ecmascript' ? 'ES' : NAMES[id]?.full ?? id + ' ') + from(version));
    if (said.length && exercise.checkedWith)
        said.push('ellenőrizve: TypeScript ' + exercise.checkedWith);
    return said.join(' · ');
}
