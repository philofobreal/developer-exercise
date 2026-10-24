/** A DOM replacement must not discard focus, selection or expanded explanations. */
export function createViewContinuity(root:HTMLElement){
 const expanded=new Map<string,Set<string>>();let previous='';
 let focused:{selector:string;selection?:[number,number]}|null=null;
 function selectorFor(element:HTMLElement):string|null {
  if(element.id)return '#'+CSS.escape(element.id);
  const row=element.closest<HTMLElement>('.code-row');
  const action=[...element.attributes].find(attribute=>attribute.name.startsWith('data-'));
  if(row&&element.classList.contains('drag-handle'))return `.code-row[data-list="${row.dataset.list}"][data-line-id="${CSS.escape(row.dataset.lineId??'')}"] .drag-handle`;
  if(action)return (row?`.code-row[data-line-id="${CSS.escape(row.dataset.lineId??'')}"] `:'')+`[${action.name}="${CSS.escape(action.value)}"]`;
  return null;
 }
 return {capture(){
  if(previous)expanded.set(previous,new Set([...root.querySelectorAll<HTMLDetailsElement>('details[open][data-memory]')].map(detail=>detail.dataset.memory??'')));
  const element=document.activeElement;
  if(element instanceof HTMLElement&&root.contains(element)){const selector=selectorFor(element);focused=selector?{selector}:null;if(focused&&(element instanceof HTMLTextAreaElement||element instanceof HTMLInputElement)&&element.selectionStart!==null)focused.selection=[element.selectionStart,element.selectionEnd??element.selectionStart];}else focused=null;
 },restore(key:string){
  const same=previous===key;previous=key;for(const detail of root.querySelectorAll<HTMLDetailsElement>('details[data-memory]'))detail.open=expanded.get(key)?.has(detail.dataset.memory??'')??detail.open;
  if(!focused)return;const element=root.querySelector<HTMLElement>(focused.selector);if(!element)return;
  // Navigation keeps its button focused; editor selection is restored only within its view.
  if(same||element.matches('[data-view],[data-task]')){element.focus({preventScroll:true});if(same&&focused.selection&&(element instanceof HTMLTextAreaElement||element instanceof HTMLInputElement)){try{element.setSelectionRange(...focused.selection);}catch{}}}
 }};
}
