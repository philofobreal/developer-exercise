/** How code rows are drawn in the sorter (ADR-106): `editor`, a dense continuous list like a code
 * editor, or `cards`, separate tiles with large targets. The choice is the reader's, remembered where
 * storage allows; without one, a coarse pointer gets cards and a fine pointer the editor. It is a root
 * attribute, so the stylesheet owns the geometry and every render keeps it. */
export type CodeView='editor'|'cards';
export const CODE_VIEW_KEY='ngdynamic.code-view.v1';
export const CODE_VIEW_LABEL:Readonly<Record<CodeView,string>>={editor:'Szerkesztő',cards:'Kártyák'};
const valid=(value:unknown):value is CodeView=>value==='editor'||value==='cards';
export function codeView(root:HTMLElement):CodeView {
 const value=root.dataset.codeView;if(valid(value))return value;
 let stored:string|null=null;try{stored=localStorage.getItem(CODE_VIEW_KEY);}catch{/* storage blocked */}
 const chosen:CodeView=valid(stored)?stored:typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches?'cards':'editor';
 root.dataset.codeView=chosen;return chosen;
}
export function setCodeView(root:HTMLElement,value:CodeView):void {
 root.dataset.codeView=value;try{localStorage.setItem(CODE_VIEW_KEY,value);}catch{/* this page only */}
}
