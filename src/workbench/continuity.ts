/** A DOM replacement must not discard focus, selection or expanded explanations.
 *
 * ADR-155 (T1.5): `restore` works in two halves. The call opens again what was open, at once: the page is then measured
 * as the reader left it (measured with the remembered details still closed it was shorter, which once cost a jump of
 * the window's scroll, ADR-152). It returns the focusing, which the view calls after its measuring: a control the
 * fitting hid must not take the focus, and focusing lays the page out. */
/** ADR-136: the open header or step menu (`details.menu` named by its `…-menu` class), so a render the reader did not
 *  cause (an answer arriving in the background) leaves it open; a render after an action closes it as before. */
const menuName=(menu:Element):string|undefined=>[...menu.classList].find(name=>name.endsWith('-menu'));
export function createViewContinuity(root:HTMLElement){
 const expanded=new Map<string,Set<string>>();let previous='',openMenus:string[]=[];
 let focused:{selector:string;selection?:[number,number]}|null=null;
 function selectorFor(element:HTMLElement):string|null {
  if(element.id)return '#'+CSS.escape(element.id);
  const row=element.closest<HTMLElement>('.code-row');
  const action=[...element.attributes].find(attribute=>attribute.name.startsWith('data-'));
  if(row&&element.classList.contains('drag-handle'))return `.code-row[data-list="${row.dataset.list}"][data-line-id="${CSS.escape(row.dataset.lineId??'')}"] .drag-handle`;
  if(action)return (row?`.code-row[data-line-id="${CSS.escape(row.dataset.lineId??'')}"] `:'')+`[${action.name}="${CSS.escape(action.value)}"]`;
  return null;
 }
 return {capture({background=false}:{background?:boolean}={}){
  openMenus=background?[...root.querySelectorAll('details.menu[open]')].flatMap(menu=>menuName(menu)??[]):[];
  if(previous)expanded.set(previous,new Set([...root.querySelectorAll<HTMLDetailsElement>('details[open][data-memory]')].map(detail=>detail.dataset.memory??'')));
  const element=document.activeElement;
  if(element instanceof HTMLElement&&root.contains(element)){const selector=selectorFor(element);focused=selector?{selector}:null;if(focused&&(element instanceof HTMLTextAreaElement||element instanceof HTMLInputElement)&&element.selectionStart!==null)focused.selection=[element.selectionStart,element.selectionEnd??element.selectionStart];}else focused=null;
 },restore(key:string):()=>void {
  const same=previous===key;previous=key;for(const detail of root.querySelectorAll<HTMLDetailsElement>('details[data-memory]'))detail.open=expanded.get(key)?.has(detail.dataset.memory??'')??detail.open;
  if(same)for(const name of openMenus){const menu=root.querySelector<HTMLDetailsElement>(`details.menu.${CSS.escape(name)}`);if(menu)menu.open=true;}
  openMenus=[];
  return ()=>{
  if(!focused)return;const control=root.querySelector<HTMLElement>(focused.selector);if(!control)return;
  // A row of a menu the render closed cannot take the focus: its menu's button does (ADR-145).
  const menu=control.closest<HTMLDetailsElement>('details.menu'),element=(menu&&!menu.open?menu.querySelector<HTMLElement>(':scope > summary'):null)??control;
  // Navigation keeps its button focused; editor selection is restored only within its view.
  if(same||control.matches('[data-view],[data-task]')){element.focus({preventScroll:true});if(same&&focused.selection&&(element instanceof HTMLTextAreaElement||element instanceof HTMLInputElement)){try{element.setSelectionRange(...focused.selection);}catch{}}}
  };
 }};
}
