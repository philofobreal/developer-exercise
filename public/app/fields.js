import { escapeHtml } from './ui-utilities.js';
import { icon } from './icons.js';
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
export const fieldRegistry = createFieldRegistry()
    .register('container', (field, render) => (field.childIds ?? []).map(render).join(''))
    .register('group', (field, render) => `<section class="field-group"><h3 class="side-title">${escapeHtml(field.title)}<span>${field.childIds?.length ?? 0}</span></h3><div class="task-list">${(field.childIds ?? []).map(render).join('')}</div></section>`)
    .register('exercise', (field, _render, { activeId }) => `<button type="button" class="task ${field.id === activeId ? 'selected' : ''}" data-task="${escapeHtml(field.id)}" ${field.id === activeId ? 'aria-current="page"' : ''}><span class="task-file ${field.language === 'typescript' ? 'ts' : 'js'}">${field.language === 'typescript' ? 'TS' : 'JS'}</span><span class="task-content"><strong>${escapeHtml(field.title)}</strong><small>${field.language === 'typescript' ? 'TypeScript' : 'JavaScript'} · v${field.revision ?? 1}</small></span>${field.id === activeId ? icon('arrow') : ''}</button>`);
/** ADR-101: the practice order: beginner, intermediate, advanced, then unclassified; catalog order within a level. */
const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
export function practiceOrder(exercises) {
    return exercises.map((exercise, index) => ({ exercise, index })).sort((a, b) => (LEVEL_ORDER[a.exercise.level ?? ''] ?? 3) - (LEVEL_ORDER[b.exercise.level ?? ''] ?? 3) || a.index - b.index).map(({ exercise }) => exercise);
}
export function createFieldRenderer(exercises, escape, activeId) {
    // ADR-101: reference exercises grouped by difficulty, in catalog order within a group; unclassified ones last.
    const groups = [{ id: '@beginner', type: 'group', title: 'Kezdő', childIds: [] }, { id: '@intermediate', type: 'group', title: 'Közepes', childIds: [] }, { id: '@advanced', type: 'group', title: 'Haladó', childIds: [] }, { id: '@reference', type: 'group', title: 'Egyéb feladatok', childIds: [] }, { id: '@preview', type: 'group', title: 'Saját előnézet', childIds: [] }];
    const slot = { beginner: 0, intermediate: 1, advanced: 2 };
    for (const exercise of exercises)
        groups[exercise.previewOnly || exercise.id.startsWith('author-') ? 4 : slot[exercise.level ?? ''] ?? 3]?.childIds?.push(exercise.id);
    return fieldRegistry.render([{ id: '@root', type: 'container', childIds: groups.filter(group => group.childIds?.length).map(group => group.id) }, ...groups, ...exercises.map(exercise => ({ ...exercise, type: 'exercise' }))], '@root', { escape, activeId });
}
