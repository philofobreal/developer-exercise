import { escapeHtml } from './ui-utilities.js';
import { icon } from './icons.js';
import { matchesTechnology, technologiesOf, technologyGroups, technologyLabel } from './technology-filter.js';
import { curriculumTree } from './curriculum.js';
export function createFieldRegistry() {
    const types = new Map();
    return { register(type, renderer) { if (!type || types.has(type) || typeof renderer !== 'function')
            throw new TypeError('Invalid/duplicate field type'); types.set(type, renderer); return this; },
        render(fields, rootId, context = {}) {
            const definitions = new Map();
            for (const field of fields) {
                if (!field || definitions.has(field.id))
                    throw Error('Duplicate field identity');
                definitions.set(field.id, field);
            }
            let budget = 1000;
            const render = (id, path = []) => { if (path.length > 32 || path.includes(id) || --budget < 0)
                throw Error('Nested field cycle/depth/budget exceeded'); const field = definitions.get(id), renderer = field ? types.get(field.type) : undefined; if (!field || !renderer)
                throw Error('Unknown field/type: ' + id); return renderer(field, child => render(child, [...path, id]), context); };
            return render(rootId);
        } };
}
const languageName = (field) => field.language === 'typescript' ? 'TypeScript' : 'JavaScript';
/** ADR-152: an exercise's labels as chips (`TS 2.0`, `ES2018`); the square before the title already names the language. */
export const technologyChips = (exercise) => technologiesOf(exercise).map(label => `<span class="tech-chip ${escapeHtml(label.id)}">${escapeHtml(technologyLabel(label))}</span>`).join('');
/** The filter that still names a label the list holds; a label that left the list filters nothing. */
const liveFilter = (exercises, filter) => filter && technologyGroups(exercises).some(group => group.id === filter.id && group.facets.some(facet => facet.version === filter.version)) ? filter : undefined;
/** ADR-152: the labels of the whole list with the number of exercises under each: the summary of what the list is
 *  made of, and its filter (a label pressed narrows the list to it; pressed again, it lets go). */
export function renderTechnologyFilter(exercises, chosen) {
    const groups = technologyGroups(exercises), filter = liveFilter(exercises, chosen);
    if (groups.reduce((count, group) => count + group.facets.length, 0) < 2)
        return '';
    // The name a screen reader says is the visible text and what the number counts („ES2015 13 feladat”); the technology
    // is the name of the facet's own group.
    const facet = ({ id, version, label, count }) => `<button type="button" class="tech-facet" data-technology="${escapeHtml(id + ' ' + version)}" aria-pressed="${filter?.id === id && filter.version === version}"><span>${escapeHtml(label)}</span> <b>${count}</b><span class="sr-only"> feladat</span></button>`;
    return `<div class="tech-filter" role="group" aria-label="Szűrés technológia és verzió szerint">${groups.map(group => `<div class="tech-group" role="group" aria-labelledby="tech-group-${escapeHtml(group.id)}"><span class="tech-group-name" id="tech-group-${escapeHtml(group.id)}">${escapeHtml(group.name)}</span>${group.facets.map(facet).join('')}</div>`).join('')}<label class="tech-earlier"><input type="checkbox" data-technology-earlier ${filter?.earlier ? 'checked' : ''} ${filter ? '' : 'disabled'}><span>és a korábbi verziók</span></label></div>`;
}
export const fieldRegistry = createFieldRegistry()
    .register('container', (field, render) => (field.childIds ?? []).map(render).join(''))
    .register('group', (field, render) => `<section class="field-group"><h3 class="side-title">${escapeHtml(field.title)}<span>${field.childIds?.length ?? 0}</span></h3><div class="task-list">${(field.childIds ?? []).map(render).join('')}</div></section>`)
    .register('exercise', (field, _render, { activeId, levels }) => `<button type="button" class="task ${field.id === activeId ? 'selected' : ''}" data-task="${escapeHtml(field.id)}" ${field.id === activeId ? 'aria-current="page"' : ''}><span class="task-file ${field.language === 'typescript' ? 'ts' : 'js'}" role="img" aria-label="${languageName(field)}" title="${languageName(field)}">${field.language === 'typescript' ? 'TS' : 'JS'}</span><span class="task-content"><strong>${escapeHtml(field.title)}</strong><small>${technologyChips(field) || languageName(field)}${levels && LEVEL_NAME[String(field.level)] ? ' · ' + LEVEL_NAME[String(field.level)] : ''} · v${field.revision ?? 1}</small></span>${field.id === activeId ? icon('arrow') : ''}</button>`)
    // ADR-154: a branch of the curriculum tree (a topic, or a module under it): a button that opens and closes it, with
    // the number of exercises under it; closed, its content is not drawn.
    .register('branch', (field, render) => {
    const depth = field.depth === 2 ? 2 : 1, open = field.open === true, body = 'branch-' + String(field.branch).replace(/[^a-z0-9-]/g, '-'), heading = 'h' + (depth + 2);
    return `<section class="tree-branch depth-${depth}"><${heading} class="tree-heading"><button type="button" class="branch" data-branch="${escapeHtml(field.branch)}" aria-expanded="${open}"${open ? ` aria-controls="${body}"` : ''}><span class="branch-title">${escapeHtml(field.title)}</span><span class="branch-count">${Number(field.count) || 0}<span class="sr-only"> feladat</span></span></button></${heading}>${open ? `<div class="tree-body" id="${body}">${(field.childIds ?? []).map(render).join('')}</div>` : ''}</section>`;
});
const LEVEL_NAME = { beginner: 'Kezdő', intermediate: 'Közepes', advanced: 'Haladó' };
/** ADR-101: the practice order: beginner, intermediate, advanced, then unclassified; catalog order within a level. */
const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
export function practiceOrder(exercises) {
    return exercises.map((exercise, index) => ({ exercise, index })).sort((a, b) => (LEVEL_ORDER[a.exercise.level ?? ''] ?? 3) - (LEVEL_ORDER[b.exercise.level ?? ''] ?? 3) || a.index - b.index).map(({ exercise }) => exercise);
}
/** The practice list. Without a curriculum that names any of its exercises it is grouped by level, as before
 *  (ADR-101); with one it is the curriculum's tree (ADR-154): topics, their modules, the exercises in teaching order,
 *  each naming its own level. The author's own previews stand in a group of their own after either. */
export function createFieldRenderer(all, escape, activeId, chosen, tree) {
    // ADR-152: the list narrowed to the chosen technology label, if the list still holds it.
    const filter = liveFilter(all, chosen), exercises = all.filter(exercise => matchesTechnology(exercise, filter));
    const own = (exercise) => !!exercise.previewOnly || exercise.id.startsWith('author-');
    const preview = { id: '@preview', type: 'group', title: 'Saját előnézet', childIds: exercises.filter(own).map(exercise => exercise.id) };
    const items = exercises.map(exercise => ({ ...exercise, type: 'exercise' }));
    const drawn = tree ? curriculumTree(tree.curriculum, exercises.filter(exercise => !own(exercise)), { activeId, ...(tree.opened ? { opened: tree.opened } : {}), filtering: !!filter }) : { branches: [], flat: true };
    if (!drawn.flat) {
        const fields = [], key = (branch) => '@branch:' + branch.id;
        const add = (branch, depth) => { fields.push({ id: key(branch), type: 'branch', branch: branch.id, title: branch.title, count: branch.count, open: branch.open, depth, childIds: [...branch.branches.map(inner => add(inner, depth + 1)), ...branch.exercises] }); return key(branch); };
        const roots = drawn.branches.map(branch => add(branch, 1));
        return fieldRegistry.render([{ id: '@root', type: 'container', childIds: [...roots, ...(preview.childIds?.length ? [preview.id] : [])] }, ...fields, preview, ...items], '@root', { escape, activeId, levels: true });
    }
    // ADR-101: reference exercises grouped by difficulty, in catalog order within a group; unclassified ones last.
    const groups = [{ id: '@beginner', type: 'group', title: 'Kezdő', childIds: [] }, { id: '@intermediate', type: 'group', title: 'Közepes', childIds: [] }, { id: '@advanced', type: 'group', title: 'Haladó', childIds: [] }, { id: '@reference', type: 'group', title: 'Egyéb feladatok', childIds: [] }, preview];
    const slot = { beginner: 0, intermediate: 1, advanced: 2 };
    for (const exercise of exercises)
        if (!own(exercise))
            groups[slot[exercise.level ?? ''] ?? 3]?.childIds?.push(exercise.id);
    return fieldRegistry.render([{ id: '@root', type: 'container', childIds: groups.filter(group => group.childIds?.length).map(group => group.id) }, ...groups, ...items], '@root', { escape, activeId });
}
