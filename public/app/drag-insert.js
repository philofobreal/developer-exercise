/**
 * Accessible-ish HTML5 DnD adapter: pointer midpoint defines a boundary,
 * never a target row replacement. Visual preview pushes subsequent IDE rows.
 * The domain model is updated only on drop; dragover has no data side effects.
 */
export function createInsertionDrag({root,onInsert,onReturn}){
  let drag=null,previewZone=null,previewBoundary=null;
  const clear=()=>{
    root.querySelectorAll('.drop-zone .code-row').forEach(row=>row.classList.remove('drop-shift','drop-prev'));
    root.querySelectorAll('.drop-zone').forEach(zone=>zone.classList.remove('over'));
    root.querySelectorAll('.insert-caret').forEach(el=>el.remove());
    previewZone=null;previewBoundary=null;
  };
  const position=(zone,event)=>{
    const rows=[...zone.querySelectorAll(':scope > .code-row')];
    if(!rows.length)return 0;
    const y=event.clientY;
    for(let i=0;i<rows.length;i++){
      const r=rows[i],rect=r.getBoundingClientRect();
      const transform=r.classList.contains('drop-shift')?8:r.classList.contains('drop-prev')?-8:0;
      if(y<rect.top-transform+rect.height/2)return i;
    }
    return rows.length;
  };
  const preview=(zone,boundary)=>{
    if(previewZone===zone&&previewBoundary===boundary)return;
    clear();previewZone=zone;previewBoundary=boundary;zone.classList.add('over');
    if(zone.dataset.zone!=='answer')return;
    const rows=[...zone.querySelectorAll(':scope > .code-row')];
    rows.slice(boundary).forEach(row=>row.classList.add('drop-shift'));
    if(boundary>0)rows[boundary-1].classList.add('drop-prev');
    const anchor=rows[boundary];
    const z=zone.getBoundingClientRect();
    const top=anchor?anchor.getBoundingClientRect().top-z.top+zone.scrollTop-8:
      rows.length?rows.at(-1).getBoundingClientRect().bottom-z.top+zone.scrollTop+8:8;
    const caret=document.createElement('div');caret.className='insert-caret';
    caret.style.top=`${Math.max(0,top)}px`;
    caret.setAttribute('aria-hidden','true');zone.append(caret);
  };
  root.addEventListener('dragstart',ev=>{
    const node=ev.target.closest('.code-row');
    if(!node||node.draggable!==true)return;
    drag={from:node.dataset.list,index:Number(node.dataset.index),exercise:root.dataset.renderedExercise};
    ev.dataTransfer?.setData('text/plain','ngdynamic-code-line');
    if(ev.dataTransfer)ev.dataTransfer.effectAllowed='move';
  });
  root.addEventListener('dragover',ev=>{
    if(!drag)return;const zone=ev.target.closest('.drop-zone');if(!zone)return;
    ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
    const box=zone.getBoundingClientRect();
    // Autoscroll long editors near their top/bottom edge.
    if(ev.clientY>box.bottom-27)zone.scrollTop+=16;
    else if(ev.clientY<box.top+27)zone.scrollTop-=16;
    preview(zone,position(zone,ev));
  });
  root.addEventListener('drop',ev=>{
    if(!drag)return;
    const zone=ev.target.closest('.drop-zone');
    if(!zone){clear();drag=null;return;}
    ev.preventDefault();
    const info=drag,boundary=position(zone,ev);
    clear();drag=null;
    if(info.exercise!==root.dataset.renderedExercise)return;
    if(zone.dataset.zone==='answer')onInsert(info,boundary);
    else if(info.from==='answer')onReturn(info.index);
  });
  root.addEventListener('dragend',()=>{drag=null;clear();});
  return {clear};
}
