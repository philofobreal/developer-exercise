/**
 * ADR-144 (NY-38): the lists end above the sticky result bar. What stands above the lists differs from view to view and
 * from screen to screen (a description that wraps, the Local Demo notice, the steps), and the bar grows when a result
 * arrives, so a constant in the stylesheet cannot say how much room the lists have.
 *
 * Hidden here: what is measured and when. The module publishes two facts on the app root, as CSS custom properties in
 * pixels; the stylesheet alone decides what the lists do with them (side by side, stacked, a phone on its side, focus):
 * - `--lists-top`: from the top of the page to the top of the lists, wherever the page is scrolled;
 * - `--result-bar`: the height of the result bar.
 * Neither depends on the lists' own height, so one measurement settles. While the result bar is away (the bar of a
 * picked row stands in its place on a touch screen) or there are no lists, the last facts stay: the lists do not jump.
 */
const TOP='--lists-top',BAR='--result-bar';

/** Publishes the two facts of `root` as it stands now. */
function measure(root:HTMLElement):void {
 const zone=[...root.querySelectorAll<HTMLElement>('.drop-zone')].find(candidate=>candidate.getClientRects().length>0),bar=root.querySelector<HTMLElement>('.evaluation-bar:not(.pick-bar)');
 if(!zone||!bar||!bar.getClientRects().length)return;
 // The root starts at the top of the page and scrolls with it, or (full screen, focus) is itself what scrolls.
 const top=Math.ceil(zone.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop),height=Math.ceil(bar.getBoundingClientRect().height);
 const facts:[string,number][]=[[TOP,top],[BAR,height]];
 for(const [name,value] of facts){
  const text=`${value}px`;
  if(root.style.getPropertyValue(name)!==text)root.style.setProperty(name,text);
 }
}
/** Measures `root` now and again whenever its size changes (a width that wraps a line, a result or an opened detail in
 *  the bar, a notice dismissed, a late web font: each changes the height of the page); returns the measuring, for after
 *  a render. A change that leaves the page no higher than the screen leaves the bar where it stands, off the lists. */
export function installListFit(root:HTMLElement):()=>void {
 let frame=0;
 const fit=():void=>measure(root);
 // Measured in the next frame, not inside the observer: the lists' new height changes the root's own size.
 const later=():void=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;fit();});};
 if(typeof ResizeObserver==='function')new ResizeObserver(later).observe(root);
 void document.fonts?.ready.then(fit);
 return fit;
}
