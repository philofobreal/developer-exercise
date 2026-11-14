/** ADR-154 (G3): the curriculum tree of the practice list.
 *
 * Hidden here: the shape of the curriculum manifest the catalog sends (topics, their modules, the exercises of a module
 * in teaching order) and what is left out of a malformed one; where an exercise of the list stands; which branches
 * the list shows, with how many exercises under each; and when a branch is open. Headless: no DOM.
 *
 * The tree is the curriculum's knowledge, not an exercise's: an exercise does not say where it stands. An exercise the
 * manifest does not name stands in a last branch of its own; a list no part of which the manifest names has no tree. */
const REST = '@rest';
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const record = (value) => typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
const named = (value, taken) => {
    const item = record(value);
    if (!item)
        return null;
    const { id, title } = item;
    if (typeof id !== 'string' || !ID.test(id) || taken.has(id) || typeof title !== 'string' || !title.trim() || title.length > 80)
        return null;
    taken.add(id);
    return { id, title: title.trim(), rest: item };
};
/** The manifest as the catalog sent it, made safe to draw. Whatever is not well formed is left out, never thrown: a
 *  topic or a module without an id or a title, a repeated id, an exercise named a second time (its first place holds).
 *  No manifest, or one that is not an object, is an empty curriculum. */
export function readCurriculum(value) {
    const source = record(value), topics = [], topicIds = new Set(), placed = new Set();
    for (const entry of Array.isArray(source?.topics) ? source.topics : []) {
        const topic = named(entry, topicIds);
        if (!topic)
            continue;
        const modules = [], moduleIds = new Set();
        for (const inner of Array.isArray(topic.rest.modules) ? topic.rest.modules : []) {
            const module = named(inner, moduleIds);
            if (!module)
                continue;
            const exercises = [];
            for (const id of Array.isArray(module.rest.exercises) ? module.rest.exercises : [])
                if (typeof id === 'string' && id && id.length <= 120 && !placed.has(id)) {
                    placed.add(id);
                    exercises.push(id);
                }
            modules.push({ id: module.id, title: module.title, exercises });
        }
        topics.push({ id: topic.id, title: topic.title, modules });
    }
    return { topics };
}
/** The tree of `exercises` (the list as it is shown: filtered, in its own order). A branch holds only exercises of the
 *  list, in the curriculum's order; an empty branch is not drawn. A branch is open if the reader opened it, closed if
 *  they closed it; left alone it is open when it holds the open exercise, and when the list is narrowed by a filter
 *  (`filtering`: a narrowed list is short, and what it found should be seen). */
export function curriculumTree(curriculum, exercises, view = {}) {
    const listed = new Set(exercises.map(exercise => exercise.id)), placed = new Set();
    const open = (id, holds) => view.opened?.[id] ?? (!!view.filtering || holds);
    const holds = (ids) => view.activeId !== undefined && ids.includes(view.activeId);
    const branches = [];
    for (const topic of curriculum.topics) {
        const modules = [];
        for (const module of topic.modules) {
            const ids = module.exercises.filter(id => listed.has(id));
            if (!ids.length)
                continue;
            for (const id of ids)
                placed.add(id);
            const id = topic.id + '/' + module.id;
            modules.push({ id, title: module.title, count: ids.length, open: open(id, holds(ids)), branches: [], exercises: ids });
        }
        if (!modules.length)
            continue;
        branches.push({ id: topic.id, title: topic.title, count: modules.reduce((sum, module) => sum + module.count, 0), open: open(topic.id, modules.some(module => holds(module.exercises))), branches: modules, exercises: [] });
    }
    if (!branches.length)
        return { branches: [], flat: true };
    const rest = exercises.map(exercise => exercise.id).filter(id => !placed.has(id));
    if (rest.length)
        branches.push({ id: REST, title: 'További feladatok', count: rest.length, open: open(REST, holds(rest)), branches: [], exercises: rest });
    return { branches, flat: false };
}
/** The reader's choices after a branch was pressed: shown open, it closes; shown closed, it opens. */
export function toggleBranch(opened, id, shownOpen) {
    return { ...opened, [id]: !shownOpen };
}
