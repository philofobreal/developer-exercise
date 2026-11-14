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
import { type CodeLineExercise } from '../../dist/index.js';
/** One shipped exercise: what the practice list shows of it (the trusted catalogue's own summary, made at build time)
 *  and its finished model. */
export interface PracticeEntry {
    summary: {
        id: string;
    };
    model: CodeLineExercise;
}
/** The page's API over the given exercises. A model the core does not accept fails here, when the page loads, and not
 *  at a learner's first check. */
export declare function createPracticeApi(entries: readonly PracticeEntry[]): {
    validationMode: "local-demo";
    /** Checking runs to its end in the page; there is nothing in flight to stop. */
    abortPending: () => void;
    getExercises: () => Promise<unknown>;
    /** A handful of exercises is a flat list: no curriculum manifest is shipped, and the page then groups them by level. */
    getCurriculum: () => Promise<unknown>;
    /** No authoring is served: the page then offers practice only (ADR-170). */
    authorAccess: () => Promise<boolean>;
    evaluate: (body: unknown) => Promise<unknown>;
    compileDraft: () => Promise<never>;
    checkSource: () => Promise<never>;
    resolvePolicy: () => Promise<never>;
    previewDraft: () => Promise<never>;
    editRules: () => Promise<never>;
    formatSource: () => Promise<never>;
    loadTypeScriptFixture: () => Promise<never>;
};
