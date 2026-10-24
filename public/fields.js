/** Framework-free dynamic field registry. The presentation registry is separate from grading. */
export function createFieldRenderer(exercises,escape,activeId){
 const defs=new Map();
 const root={id:'root',type:'container',parentId:null,childIds:exercises.map(e=>e.id)};
 defs.set(root.id,root);
 for(const x of exercises)defs.set(x.id,{id:x.id,type:'exercise',parentId:'root',title:x.title,language:x.language,revision:x.revision});
 const registry={
   container:(node,render)=>node.childIds.map(id=>render(id)).join(''),
   exercise:node=>`<button class="task ${node.id===activeId?'selected':''}" data-task="${escape(node.id)}"><span>${escape(node.title)}</span><small>${escape(node.language)} · v${node.revision}</small></button>`
 };
 const render=(id,depth=0)=>{
  if(depth>32)throw Error('Nested field depth exceeded');
  const field=defs.get(id);
  if(!field||!registry[field.type])throw Error(`Unknown field: ${id}`);
  return registry[field.type](field,childId=>render(childId,depth+1));
 };
 return render('root');
}
