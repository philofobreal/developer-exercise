/**
 * ADR-145 (D5): on a narrow screen a workspace tool shows its label where the toolbar's row has room for it. Hidden here:
 * the steps and how „fits” is decided. As for the app bar (ADR-137), the decision is measured, not a breakpoint: the row
 * holds other tools from step to step and from view to view, and a phone's own font decides how wide a label is.
 *
 * The view says which tools may carry a label and in what order: `data-label-rank="1"` on the tool the step is about,
 * `"2"` on the others. The module answers on the tools' group with `data-labels`: `2` (every ranked tool is labelled),
 * `1` (the first only) or `0` (icons); the stylesheet alone draws the difference. A group without ranked tools (a wide
 * screen) is left as it is.
 */
const STEPS = ['2', '1', '0'];
/** One row, nothing cut: the group stands beside the code view switch when there is one, and the bar does not overflow. */
function fits(bar, group) {
    const beside = bar.querySelector('.code-view-switch');
    return bar.scrollWidth <= bar.clientWidth && (!beside || group.getBoundingClientRect().top < beside.getBoundingClientRect().bottom);
}
/** The most labels the row of `root`'s toolbar has room for. */
function fit(root) {
    const group = root.querySelector('.workspace-actions'), bar = group?.parentElement;
    if (!group || !bar || !group.querySelector(':scope > [data-label-rank]'))
        return;
    for (const step of STEPS) {
        group.dataset.labels = step;
        if (fits(bar, group))
            return;
    }
}
/** Fits the toolbar of `root` now and again whenever the page's size changes; returns the fitting, for after a render. */
export function installToolbarFit(root) {
    const now = () => fit(root);
    if (typeof ResizeObserver === 'function')
        new ResizeObserver(now).observe(root);
    // A web font that arrives after the first paint changes the labels' width.
    void document.fonts?.ready.then(now);
    return now;
}
