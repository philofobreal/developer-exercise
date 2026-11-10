/**
 * ADR-124 (H2): the help page's search. It narrows the page to the topics whose text holds every word typed (accents
 * and case ignored), hides the empty groups and the contents entries of hidden topics, and says how many are left.
 * Without the script the page is whole, so nothing depends on it. Runs on the help page only.
 */
const fold=(text:string):string=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();

export function installHelpSearch(doc:Document):void {
 const input=doc.querySelector<HTMLInputElement>('[data-help-search]'),count=doc.querySelector<HTMLElement>('[data-help-count]');
 if(!input)return;
 const topics=[...doc.querySelectorAll<HTMLElement>('[data-help-topic]')].map(element=>({element,text:fold(element.textContent??'')}));
 const apply=():void=>{
  const words=fold(input.value).split(/\s+/).filter(Boolean);
  let shown=0;
  for(const topic of topics){
   const hit=words.every(word=>topic.text.includes(word));topic.element.hidden=!hit;if(hit)shown++;
   const entry=doc.querySelector<HTMLElement>(`[data-help-entry="${CSS.escape(topic.element.id)}"]`);if(entry)entry.hidden=!hit;
  }
  for(const group of doc.querySelectorAll<HTMLElement>('[data-help-group]'))group.hidden=!group.querySelector('[data-help-topic]:not([hidden])');
  if(count)count.textContent=words.length?(shown?`${shown} találat`:'Nincs találat. Próbálj rövidebb szót.'):'';
 };
 input.addEventListener('input',apply);
}
installHelpSearch(document);
