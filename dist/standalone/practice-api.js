/**
 * The practice-only engine of the standalone demonstration page (ADR-171): a handful of finished exercises checked in
 * the visitor's browser, with no server and no author analysis. It answers the same operations as the server API
 * adapter (`src/workbench/api.ts`), so the page runs on it unchanged.
 *
 * Hidden here: that the exercises are compiled once from the models handed in, and that checking is the core's
 * diagnosis with the learner's disclosure, exactly as the trusted server does it. What is deliberately absent: every
 * module that derives rules from source code. The models arrive finished; nothing here can make a new one.
 *
 * The result is a Local Demo (AGENTS.md): the rules of the shipped exercises are in the page, and a verdict is not an
 * authoritative grade.
 */
import { compileCodeLineExercise, diagnoseSubmission, evaluationDisclosure } from '../../dist/index.js';
/** The search budget of one check, the trusted server's. */
const MAX_STATES = 50_000;
const NOT_SERVED = 'A feladatkészítés ebben az önálló bemutatóban nem érhető el. A gyakorlás használható.';
const notServed = async () => { throw new Error(NOT_SERVED); };
/** The page's API over the given exercises. A model the core does not accept fails here, when the page loads, and not
 *  at a learner's first check. */
export function createPracticeApi(entries) {
    const records = new Map(entries.map(({ summary, model }) => {
        const result = compileCodeLineExercise(model);
        if ('status' in result)
            throw new Error(`Invalid exercise ${model.id}: ${result.message}`);
        return [summary.id, { model, compiled: result.compiled }];
    }));
    return {
        validationMode: 'local-demo',
        /** Checking runs to its end in the page; there is nothing in flight to stop. */
        abortPending: () => { },
        getExercises: async () => entries.map(entry => entry.summary),
        /** A handful of exercises is a flat list: no curriculum manifest is shipped, and the page then groups them by level. */
        getCurriculum: async () => null,
        /** No authoring is served: the page then offers practice only (ADR-170). */
        authorAccess: async () => false,
        evaluate: async (body) => {
            const submission = body;
            const record = typeof submission?.exerciseId === 'string' ? records.get(submission.exerciseId) : undefined;
            if (!record || !Array.isArray(submission?.lines))
                throw new Error('Ismeretlen feladat vagy érvénytelen megoldás.');
            const report = diagnoseSubmission(record.compiled, submission, { maxStates: MAX_STATES });
            return { ...report.verdict, ...evaluationDisclosure(report, 'learner', record.model) };
        },
        compileDraft: notServed, checkSource: notServed, resolvePolicy: notServed, previewDraft: notServed, editRules: notServed,
        formatSource: notServed, loadTypeScriptFixture: notServed,
    };
}
//# sourceMappingURL=practice-api.js.map