/**
 * ADR-125 (NY-32): the Local Demo's author API on the main thread, answered by a worker. The Pages build serves this
 * as `app/api.js`, with the operations of the server's API under the same names. The engine (generation, both gates,
 * the qualification, preview grading) runs in `pages-worker`, so a 500-row source no longer holds the page still for
 * seconds; the TypeScript compiler loads there too, off the main thread. Hidden here: that there is a worker, when it
 * starts (with the first call) and what a call looks like on the wire (worker-rpc).
 */
import { connect } from './worker-rpc.js';
export const validationMode = 'local-demo';
const FAILURE = 'A Local Demo háttérszála nem indult el ebben a böngészőben; frissítsd az oldalt, vagy használj újabb böngészőt.';
let call;
const engine = (op) => (...args) => {
    if (!call) {
        try {
            call = connect(new Worker(new URL('./pages-worker.js', import.meta.url), { type: 'module' }), FAILURE);
        }
        catch {
            return Promise.reject(Error(FAILURE));
        }
    }
    return call(op, ...args);
};
export const getExercises = engine('getExercises');
export const compileDraft = engine('compileDraft');
export const editRules = engine('editRules');
export const resolvePolicy = engine('resolvePolicy');
export const authorTransition = engine('authorTransition');
export const previewDraft = engine('previewDraft');
export const evaluate = engine('evaluate');
export const loadTypeScriptFixture = engine('loadTypeScriptFixture');
export const checkSource = engine('checkSource');
export const formatSource = engine('formatSource');
