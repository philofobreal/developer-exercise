/**
 * ADR-137: the app bar shows the whole logo (mark, wordmark and the EDITOR label) whenever it fits on one row; on a narrow
 * screen it steps back only as far as it must: first without the label, then without the mark, then a smaller wordmark,
 * and only last the mark alone (the
 * wordmark staying the bar's accessible name). Hidden here: the steps and how „fits” is decided. The decision is
 * measured, not a breakpoint: a phone's own font and width decide (a fixed width hid the wordmark where it fitted and
 * would overflow where another font is wider).
 */
const STEPS=['complete','full','wordmark','small','smaller','mark'] as const;
export type BrandStep=typeof STEPS[number];

/** The first step at which the bar's row does not overflow; the last one otherwise. */
export function fitBrand(header:HTMLElement):BrandStep {
 for(const step of STEPS){header.dataset.brand=step;if(header.scrollWidth<=header.clientWidth)return step;}
 return 'mark';
}
/** Fits the bar of `root` now and again whenever the page's width changes; returns the fitting, for after a render. */
export function installHeaderFit(root:HTMLElement):()=>void {
 const fit=():void=>{const header=root.querySelector<HTMLElement>(':scope > .header, .header');if(header)fitBrand(header);};
 if(typeof ResizeObserver==='function')new ResizeObserver(fit).observe(root);
 // A web font that arrives after the first paint changes the wordmark's width.
 void document.fonts?.ready.then(fit);
 return fit;
}
