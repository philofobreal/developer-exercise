/** Hierarchical presentation registry; no evaluation decisions are made here. */
import type {ExerciseSummary} from './contracts.js';
import {escapeHtml} from './ui-utilities.js';
import {icon} from './icons.js';
import {matchesTechnology,technologiesOf,technologyGroups,technologyLabel,type TechnologyFilter} from './technology-filter.js';
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
const languageName=(field:Field):string=>field.language==='typescript'?'TypeScript':'JavaScript';
/** ADR-152: an exercise's labels as chips (`TS 2.0`, `ES2018`); the square before the title already names the language. */
export const technologyChips=(exercise:Pick<ExerciseSummary,'technologies'>|Field):string=>technologiesOf(exercise as Pick<ExerciseSummary,'technologies'>).map(label=>`<span class="tech-chip ${escapeHtml(label.id)}">${escapeHtml(technologyLabel(label))}</span>`).join('');
/** The filter that still names a label the list holds; a label that left the list filters nothing. */
const liveFilter=(exercises:readonly ExerciseSummary[],filter:TechnologyFilter|undefined):TechnologyFilter|undefined=>filter&&technologyGroups(exercises).some(group=>group.id===filter.id&&group.facets.some(facet=>facet.version===filter.version))?filter:undefined;
/** ADR-152: the labels of the whole list with the number of exercises under each: the summary of what the list is
 *  made of, and its filter (a label pressed narrows the list to it; pressed again, it lets go). */
export function renderTechnologyFilter(exercises:readonly ExerciseSummary[],chosen:TechnologyFilter|undefined):string {
 const groups=technologyGroups(exercises),filter=liveFilter(exercises,chosen);
 if(groups.reduce((count,group)=>count+group.facets.length,0)<2)return '';
 // The name a screen reader says is the visible text and what the number counts („ES2015 13 feladat”); the technology
 // is the name of the facet's own group.
 const facet=({id,version,label,count}:{id:string;version:string;label:string;count:number}):string=>`<button type="button" class="tech-facet" data-technology="${escapeHtml(id+' '+version)}" aria-pressed="${filter?.id===id&&filter.version===version}"><span>${escapeHtml(label)}</span> <b>${count}</b><span class="sr-only"> feladat</span></button>`;
 return `<div class="tech-filter" role="group" aria-label="Szűrés technológia és verzió szerint">${groups.map(group=>`<div class="tech-group" role="group" aria-labelledby="tech-group-${escapeHtml(group.id)}"><span class="tech-group-name" id="tech-group-${escapeHtml(group.id)}">${escapeHtml(group.name)}</span>${group.facets.map(facet).join('')}</div>`).join('')}<label class="tech-earlier"><input type="checkbox" data-technology-earlier ${filter?.earlier?'checked':''} ${filter?'':'disabled'}><span>és a korábbi verziók</span></label></div>`;
}
export const fieldRegistry=createFieldRegistry()
 .register('container',(field,render)=>(field.childIds??[]).map(render).join(''))
 .register('group',(field,render)=>`<section class="field-group"><h3 class="side-title">${escapeHtml(field.title)}<span>${field.childIds?.length??0}</span></h3><div class="task-list">${(field.childIds??[]).map(render).join('')}</div></section>`)
 .register('exercise',(field,_render,{activeId})=>`<button type="button" class="task ${field.id===activeId?'selected':''}" data-task="${escapeHtml(field.id)}" ${field.id===activeId?'aria-current="page"':''}><span class="task-file ${field.language==='typescript'?'ts':'js'}" role="img" aria-label="${languageName(field)}" title="${languageName(field)}">${field.language==='typescript'?'TS':'JS'}</span><span class="task-content"><strong>${escapeHtml(field.title)}</strong><small>${technologyChips(field)||languageName(field)} · v${field.revision??1}</small></span>${field.id===activeId?icon('arrow'):''}</button>`);
/** ADR-101: the practice order: beginner, intermediate, advanced, then unclassified; catalog order within a level. */
const LEVEL_ORDER:Record<string,number>={beginner:0,intermediate:1,advanced:2};
export function practiceOrder<T extends Pick<ExerciseSummary,'level'>>(exercises:readonly T[]):T[] {
 return exercises.map((exercise,index)=>({exercise,index})).sort((a,b)=>(LEVEL_ORDER[a.exercise.level??'']??3)-(LEVEL_ORDER[b.exercise.level??'']??3)||a.index-b.index).map(({exercise})=>exercise);
}
export function createFieldRenderer(all:ExerciseSummary[],escape:(value:unknown)=>string,activeId:string,chosen?:TechnologyFilter):string {
 // ADR-152: the list narrowed to the chosen technology label, if the list still holds it.
 const filter=liveFilter(all,chosen),exercises=all.filter(exercise=>matchesTechnology(exercise,filter));
 // ADR-101: reference exercises grouped by difficulty, in catalog order within a group; unclassified ones last.
 const groups:Field[]=[{id:'@beginner',type:'group',title:'Kezdő',childIds:[]},{id:'@intermediate',type:'group',title:'Közepes',childIds:[]},{id:'@advanced',type:'group',title:'Haladó',childIds:[]},{id:'@reference',type:'group',title:'Egyéb feladatok',childIds:[]},{id:'@preview',type:'group',title:'Saját előnézet',childIds:[]}];
 const slot:Record<string,number>={beginner:0,intermediate:1,advanced:2};
 for(const exercise of exercises)groups[exercise.previewOnly||exercise.id.startsWith('author-')?4:slot[exercise.level??'']??3]?.childIds?.push(exercise.id);
 return fieldRegistry.render([{id:'@root',type:'container',childIds:groups.filter(group=>group.childIds?.length).map(group=>group.id)},...groups,...exercises.map(exercise=>({...exercise,type:'exercise'}))],'@root',{escape,activeId});
}
