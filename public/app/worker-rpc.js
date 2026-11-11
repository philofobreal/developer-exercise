/**
 * ADR-125 (NY-32): calls across a worker boundary, as promises. One side `serve`s a set of async operations, the other
 * `connect`s and calls them by name. Hidden here: the message shape, the call numbering, how an error crosses (its
 * message and its plain `details`, as the author flow reads them: `error.details.gate`), and what happens when the
 * worker cannot start or dies (every waiting and later call fails with one clear message instead of hanging).
 * ADR-132 (P2): an operation served with `progress` receives a reporter as its first argument and may name its stage
 * while it runs; the caller's `onProgress` hears it. A caller may stop waiting (`cancel`): every waiting call fails with
 * the given message and the connection is closed. With nothing waiting, `cancel` does nothing and says so, so a caller
 * never tears down an idle worker (and the state it holds) for nothing.
 */
const isRequest = (value) => typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.op === 'string' && Array.isArray(value.args);
const isReply = (value) => typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.ok === 'boolean';
const isProgress = (value) => typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.progress === 'string';
/** Answers every request with the named operation's result; an unknown operation or a thrown error is a failed reply.
 *  With `progress`, each operation is called with a reporter of its stage first (an empty text clears it). */
export function serve(port, operations, options = {}) {
    port.addEventListener('message', async (event) => {
        const request = event.data;
        if (!isRequest(request))
            return;
        const operation = operations[request.op];
        try {
            if (typeof operation !== 'function')
                throw Error(`Ismeretlen művelet: ${request.op}`);
            const report = (progress) => { port.postMessage({ id: request.id, progress }); };
            const value = await operation(...(options.progress ? [report, ...request.args] : request.args));
            port.postMessage({ id: request.id, ok: true, value });
        }
        catch (error) {
            const details = typeof error === 'object' && error !== null && 'details' in error ? error.details : undefined;
            port.postMessage({ id: request.id, ok: false, message: error instanceof Error ? error.message : String(error), ...(details === undefined ? {} : { details }) });
        }
    });
}
/** A caller of the operations `serve` answers on the other side. `failure` is the message every call gets once the
 *  other side cannot answer (it failed to start or crashed); `onProgress` hears a waiting call's stage. */
export function connect(port, failure, onProgress) {
    const waiting = new Map();
    let next = 1, broken = false, closed = failure;
    const fail = (message) => { broken = true; closed = message; for (const call of waiting.values())
        call.reject(Error(message)); waiting.clear(); };
    port.addEventListener('error', () => fail(failure));
    port.addEventListener('message', event => {
        const reply = event.data;
        if (isProgress(reply)) {
            if (waiting.has(reply.id))
                onProgress?.(reply.progress);
            return;
        }
        if (!isReply(reply))
            return;
        const call = waiting.get(reply.id);
        if (!call)
            return;
        waiting.delete(reply.id);
        if (reply.ok)
            call.resolve(reply.value);
        else
            call.reject(Object.assign(Error(reply.message), reply.details === undefined ? {} : { details: reply.details }));
    });
    const call = (op, ...args) => broken ? Promise.reject(Error(closed)) : new Promise((resolve, reject) => {
        const id = next++;
        waiting.set(id, { resolve, reject });
        port.postMessage({ id, op, args });
    });
    return Object.assign(call, { cancel: (message) => { if (broken || !waiting.size)
            return false; fail(message); return true; } });
}
