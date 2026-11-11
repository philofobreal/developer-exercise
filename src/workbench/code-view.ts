/** How code rows are drawn in the sorter (ADR-106): `editor`, a dense continuous list like a code
 * editor, or `cards`, separate tiles with large targets. The choice is the reader's, remembered where
 * storage allows; without one, a coarse pointer gets cards and a fine pointer the editor. It is a root
 * attribute, so the stylesheet owns the geometry and every render keeps it. */
export type CodeView='editor'|'cards';
export const CODE_VIEW_KEY='ngdynamic.code-view.v1';
/** ADR-133 (the user's decision): the page offers no view switches, neither Rendező | Megoldáskód nor Szerkesztő |
 * Kártyák. The views stay in the code, switched off: the Try workspace is the sorter, and its rows are drawn as the
 * pointer suits (a coarse pointer gets cards, for their large targets; a fine one the editor), whatever an earlier
 * choice stored. Developers and the tests that cover the switched-off views turn them back on with this key set to
 * `on` in the page's storage. */
export const VIEW_SWITCHES_KEY='ngdynamic.view-switches.v1';
export function viewSwitchesOffered():boolean {
 try{return typeof localStorage!=='undefined'&&localStorage.getItem(VIEW_SWITCHES_KEY)==='on';}catch{return false;}
}
export const CODE_VIEW_LABEL:Readonly<Record<CodeView,string>>={editor:'Szerkesztő',cards:'Kártyák'};
const valid=(value:unknown):value is CodeView=>value==='editor'||value==='cards';
export function codeView(root:HTMLElement):CodeView {
 const value=root.dataset.codeView;if(valid(value))return value;
 let stored:string|null=null;if(viewSwitchesOffered())try{stored=localStorage.getItem(CODE_VIEW_KEY);}catch{/* storage blocked */}
 const chosen:CodeView=valid(stored)?stored:typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches?'cards':'editor';
 root.dataset.codeView=chosen;return chosen;
}
export function setCodeView(root:HTMLElement,value:CodeView):void {
 root.dataset.codeView=value;try{localStorage.setItem(CODE_VIEW_KEY,value);}catch{/* this page only */}
}
