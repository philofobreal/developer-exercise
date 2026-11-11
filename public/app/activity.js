/**
 * ADR-127 (P1): one progress indicator for the work a user started and waits for (Modell készítése, Forrás vizsgálata,
 * Ellenőrzés, rule edits, Formázás, opening a sample, a file or a session). Hidden here: when it appears, how long it
 * stays, how it winds down, where it stands and what a screen reader hears.
 *
 * The timing follows the common delayed-spinner practice (Nielsen's 0.1 s / 1 s / 10 s limits; spin-delay, Carbon's
 * inline loading): work done within 400 ms shows nothing; once shown, the indicator stays at least 600 ms, so it never
 * flashes; when the work ends, its line fills (350 ms) and it fades (250 ms). It does not say „Kész”: the work's own
 * message says how it ended, and an operation can end with an error the indicator cannot see. After 3 s it counts the
 * seconds. Several operations share one slot: the latest one is named, and the slot winds down when the last ends.
 *
 * ADR-132 (P2): the work may name its phase (`activityDetail`, e.g. the Local Demo loading the compiler), shown after
 * the name. When the page registered how to stop waiting (`setActivityAbort`) and the work has lasted 10 s, the chip
 * offers „Megszakítás” (Nielsen's 10 s: beyond it the user needs a way out), said once on the status line.
 */
export const ACTIVITY_TIMING = { delay: 400, minimum: 600, settle: 350, leave: 250, countAfter: 3000, abortAfter: 10_000 };
/** The timing alone, against any clock and any painter (the unit tests drive it with a fake clock). */
export function createActivity(clock, paint) {
    const active = [];
    let phase = 'hidden', shownAt = 0, timer, shown = { phase: 'hidden', label: '' }, abort;
    const later = (ms) => { if (timer !== undefined)
        clock.clear(timer); timer = clock.set(() => { timer = undefined; step(); }, Math.max(0, ms)); };
    const draw = (next) => { shown = next; paint(next); };
    function step() {
        const now = clock.now(), top = active[active.length - 1];
        if (top) {
            if (phase === 'hidden') {
                const first = Math.min(...active.map(entry => entry.start));
                if (now < first + ACTIVITY_TIMING.delay) {
                    later(first + ACTIVITY_TIMING.delay - now);
                    return;
                }
                shownAt = now;
            }
            phase = 'running';
            const elapsed = now - top.start, counting = elapsed >= ACTIVITY_TIMING.countAfter, waited = now - Math.min(...active.map(entry => entry.start));
            draw({ phase, label: top.label, ...(top.detail ? { detail: top.detail } : {}), ...(counting ? { seconds: Math.floor(elapsed / 1000) } : {}), ...(abort && waited >= ACTIVITY_TIMING.abortAfter ? { abortable: true } : {}), ...(top.source ? { source: top.source } : {}) });
            const tick = counting ? 1000 - elapsed % 1000 : ACTIVITY_TIMING.countAfter - elapsed;
            later(abort && waited < ACTIVITY_TIMING.abortAfter ? Math.min(tick, ACTIVITY_TIMING.abortAfter - waited) : tick);
            return;
        }
        if (phase === 'hidden') {
            if (timer !== undefined) {
                clock.clear(timer);
                timer = undefined;
            }
            return;
        }
        if (phase === 'running') {
            if (now < shownAt + ACTIVITY_TIMING.minimum) {
                later(shownAt + ACTIVITY_TIMING.minimum - now);
                return;
            }
            phase = 'settling';
            draw({ ...shown, phase });
            later(ACTIVITY_TIMING.settle);
            return;
        }
        if (phase === 'settling') {
            phase = 'leaving';
            draw({ ...shown, phase });
            later(ACTIVITY_TIMING.leave);
            return;
        }
        phase = 'hidden';
        draw({ phase, label: '' });
    }
    return {
        track(label, work, source) {
            const entry = { label, start: clock.now(), ...(source ? { source } : {}) };
            active.push(entry);
            step();
            const end = () => { const index = active.indexOf(entry); if (index >= 0)
                active.splice(index, 1); step(); };
            work.then(end, end);
            return work;
        },
        detail(text) {
            const top = active[active.length - 1];
            if (!top || top.detail === text)
                return;
            if (text)
                top.detail = text;
            else
                delete top.detail;
            if (phase === 'running')
                step();
        },
        abortWith(next) { abort = next; if (phase === 'running')
            step(); },
    };
}
/** The slot in the page: a status line for screen readers and, above everything (the top layer, so also over the
 *  full-screen workspace), a chip docked above the sticky action bar of the current step. */
function mountActivity(doc) {
    const live = doc.createElement('div');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.dataset.activityLive = '';
    const chip = doc.createElement('div');
    chip.className = 'activity';
    chip.dataset.activity = '';
    chip.hidden = true;
    const topLayer = typeof chip.showPopover === 'function';
    if (topLayer)
        chip.popover = 'manual';
    // The status line speaks for the text; only the button is for everyone (ADR-132).
    chip.innerHTML = '<span class="activity-text" aria-hidden="true"><span class="activity-label"></span><span class="activity-detail"></span><span class="activity-seconds"></span></span><button type="button" class="activity-abort" data-activity-abort hidden>Megszakítás</button><span class="activity-line" aria-hidden="true"></span>';
    doc.body.append(live, chip);
    const label = chip.querySelector('.activity-label'), detail = chip.querySelector('.activity-detail'), seconds = chip.querySelector('.activity-seconds'), stop = chip.querySelector('.activity-abort');
    let abort;
    stop?.addEventListener('click', () => abort?.());
    let marked;
    const mark = (source) => { if (marked === source)
        return; marked?.removeAttribute('data-busy-shown'); marked = source; source?.setAttribute('data-busy-shown', ''); };
    // The sticky bar at the bottom of the screen (a step's action bar, the result bar): the chip stands above it.
    const dock = () => {
        const height = doc.documentElement.clientHeight;
        let top = height;
        for (const bar of doc.querySelectorAll('.action-bar,.evaluation-bar')) {
            const box = bar.getBoundingClientRect();
            if (box.height && box.top < height && box.bottom >= height - 2)
                top = Math.min(top, box.top);
        }
        chip.style.setProperty('--activity-dock', `${Math.round(height - top)}px`);
    };
    const paint = (view) => {
        chip.dataset.phase = view.phase;
        if (view.phase === 'hidden') {
            mark();
            live.textContent = '';
            if (topLayer && chip.matches(':popover-open'))
                chip.hidePopover();
            chip.hidden = true;
            return;
        }
        if (label)
            label.textContent = view.phase === 'running' ? `${view.label}…` : view.label;
        if (detail)
            detail.textContent = view.detail && view.phase === 'running' ? view.detail : '';
        if (seconds)
            seconds.textContent = view.seconds === undefined ? '' : `${view.seconds} s`;
        if (stop) {
            const offered = view.phase === 'running' && !!view.abortable;
            if (stop.hidden === offered)
                stop.hidden = !offered;
        }
        if (view.phase === 'running') {
            mark(view.source);
            const said = `${view.label} folyamatban.${view.detail ? ` ${view.detail}.` : ''}${view.abortable ? ' Sokáig tart; a Megszakítás gombbal leállítható.' : ''}`;
            if (live.textContent !== said)
                live.textContent = said;
        }
        else
            mark();
        if (chip.hidden) {
            chip.hidden = false;
            dock();
            if (topLayer)
                chip.showPopover();
        }
        else if (view.phase === 'running')
            dock();
    };
    const activity = createActivity({ now: () => performance.now(), set: (callback, ms) => window.setTimeout(callback, ms), clear: handle => window.clearTimeout(handle) }, paint);
    return { ...activity, abortWith: next => { abort = next; activity.abortWith(next); } };
}
let shared;
const sharedSlot = () => typeof document === 'undefined' || !document.body ? undefined : shared ??= mountActivity(document);
/** The stage of the latest work in the slot (`undefined` clears it). */
export function activityDetail(text) { sharedSlot()?.detail(text); }
/** How the page stops waiting for its work; the slot offers „Megszakítás” after 10 s only when this is set. */
export function setActivityAbort(abort) { sharedSlot()?.abortWith(abort); }
/** Shows `work` in the page's one progress slot (if it lasts) and returns it unchanged. Outside a page it only returns it. */
export function trackActivity(label, work, source) {
    const slot = sharedSlot();
    return slot ? slot.track(label, work, source) : work;
}
