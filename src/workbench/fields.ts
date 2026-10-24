/** Hierarchical presentation registry; no evaluation decisions are made here. */
import type {ExerciseSummary} from './contracts.js';
import {escapeHtml} from './ui-utilities.js';
import {icon} from './icons.js';
interface Field {id:string;type:string;title?:string;language?:string;revision?:number;childIds?:string[];[key:string]:unknown;}
interface Context {escape?:(value:unknown)=>string;activeId?:string;}
type Renderer=(field:Field,render:(id:string)=>string,context:Context)=>string;
export function createFieldRegistry(){
 const types=new Map<string,Renderer>();
 return {register(type:string,renderer:Renderer){if(!type||types.has(type)||typeof renderer!=='function')throw new TypeError('Invalid/duplicate field type');types.set(type,renderer);return this;},
 render(fields:Field[],rootId:string,context:Context={}){
  const definitions=new Map<string,Field>();for(const field of fields){if(!field||definitions.has(field.id))throw Error('Duplicate field identity');definitions.set(field.id,field);}let budget=1000;
  const render=(id:string,path:string[]=[]):string=>{if(path.length>32||path.includes(id)||--budget<0)throw Error('Nested field cycle/depth/budget exceeded');const field=definitions.get(id),renderer=field?types.get(field.type):undefined;if(!field||!renderer)throw Error('Unknown field/type: '+id);return renderer(field,child=>render(child,[...path,id]),context);};return render(rootId);
 }};
}
export const fieldRegistry=createFieldRegistry()
 .register('container',(field,render)=>(field.childIds??[]).map(render).join(''))
 .register('group',(field,render)=>`<section class="field-group"><h3 class="side-title">${escapeHtml(field.title)}<span>${field.childIds?.length??0}</span></h3><div class="task-list">${(field.childIds??[]).map(render).join('')}</div></section>`)
 .register('exercise',(field,_render,{activeId})=>`<button type="button" class="task ${field.id===activeId?'selected':''}" data-task="${escapeHtml(field.id)}" ${field.id===activeId?'aria-current="page"':''}><span class="task-file ${field.language==='typescript'?'ts':'js'}">${field.language==='typescript'?'TS':'JS'}</span><span class="task-content"><strong>${escapeHtml(field.title)}</strong><small>${field.language==='typescript'?'TypeScript':'JavaScript'} · v${field.revision??1}</small></span>${field.id===activeId?icon('arrow'):''}</button>`);
export function createFieldRenderer(exercises:ExerciseSummary[],escape:(value:unknown)=>string,activeId:string):string {
 const groups:Field[]=[{id:'@reference',type:'group',title:'Gyakorlófeladatok',childIds:[]},{id:'@preview',type:'group',title:'Saját előnézet',childIds:[]}];
 for(const exercise of exercises)groups[exercise.previewOnly||exercise.id.startsWith('author-')?1:0]?.childIds?.push(exercise.id);
 return fieldRegistry.render([{id:'@root',type:'container',childIds:groups.filter(group=>group.childIds?.length).map(group=>group.id)},...groups,...exercises.map(exercise=>({...exercise,type:'exercise'}))],'@root',{escape,activeId});
}
