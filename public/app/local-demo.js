/**
 * ADR-125 (NY-32): the Local Demo's author API on the main thread, answered by a worker. The Pages build serves this
 * as `app/api.js`, with the operations of the server's API under the same names. The engine (generation, both gates,
 * the qualification, preview grading) runs in `pages-worker`, so a 500-row source no longer holds the page still for
 * seconds; the TypeScript compiler loads there too, off the main thread. Hidden here: that there is a worker, when it
 * starts (with the first call) and what a call looks like on the wire (worker-rpc).
 */
import { connect } from './worker-rpc.js';
import { activityDetail } from './activity.js';
export const validationMode = 'local-demo';
const FAILURE = 'A Local Demo háttérszála nem indult el ebben a böngészőben; frissítsd az oldalt, vagy használj újabb böngészőt.';
/** ADR-132 (P2): stopping the worker is the only way to stop its work; the author previews it held go with it. */
const STOPPED = 'A műveletet megszakítottad. A Local Demo háttérszála újraindult; ha volt kész modell, készítsd el újra.';
let call, worker, stopped = false;
/** After a stop, the fresh worker first reloads the shipped exercises, which the page listed from the old one, so
 *  practising them keeps working; the call waits for that. */
let ready = Promise.resolve();
const engine = (op) => (...args) => {
    if (!call) {
        try {
            worker = new Worker(new URL('./pages-worker.js', import.meta.url), { type: 'module' });
            call = connect(worker, FAILURE, stage => activityDetail(stage || undefined));
        }
        catch {
            return Promise.reject(Error(FAILURE));
        }
        if (stopped) {
            stopped = false;
            ready = call('getExercises').catch(() => undefined);
        }
    }
    const connection = call;
    return ready.then(() => connection(op, ...args));
};
/** Stops waiting for the work in progress: the worker is stopped, and the next call starts a fresh one. With nothing
 *  in progress it does nothing (the worker and its previews stay). */
export function abortPending() {
    if (!call?.cancel(STOPPED))
        return;
    worker?.terminate();
    call = undefined;
    worker = undefined;
    stopped = true;
}
export const getCurriculum = engine('getCurriculum');
export const getExercises = engine('getExercises');
/** The Local Demo runs the author engine in the visitor's own browser: authoring is always offered. */
export const authorAccess = async () => true;
export const compileDraft = engine('compileDraft');
export const editRules = engine('editRules');
export const resolvePolicy = engine('resolvePolicy');
export const previewDraft = engine('previewDraft');
export const evaluate = engine('evaluate');
export const loadTypeScriptFixture = engine('loadTypeScriptFixture');
export const checkSource = engine('checkSource');
export const formatSource = engine('formatSource');
