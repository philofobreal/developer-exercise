/**
 * Native, pointer/touch and keyboard insertion adapter: pointer midpoint defines a boundary,
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
      const cssTransform=getComputedStyle(r).transform;
      const transform=cssTransform==='none'?0:new DOMMatrixReadOnly(cssTransform).m42;
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
    // Native HTML drag takes ownership; its browser-generated pointercancel
    // must never erase the new native drag session.
    keyboard=null;cancelPointer();
    drag=infoFor(node);
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
    if(zone.dataset.zone==='answer')finish(info,boundary);
    else if(info.from==='answer')finish(info,0,true);
  });
  root.addEventListener('dragend',()=>{drag=null;clear();});
  const announce=message=>{const live=root.querySelector('[data-move-status]');if(live)live.textContent=message;};
  const infoFor=node=>({from:node.dataset.list,index:Number(node.dataset.index),id:node.dataset.lineId,exercise:root.dataset.renderedExercise});
  const finish=(info,boundary,back=false)=>{
    if(info.exercise!==root.dataset.renderedExercise)return;
    if(back)onReturn(info.index);else onInsert(info,boundary);
    const row=[...root.querySelectorAll('.code-row')].find(x=>x.dataset.lineId===info.id&&x.dataset.list===(back?'pool':'answer'));
    row?.querySelector('.drag-handle')?.focus({preventScroll:true});
    announce(row?`Sor áthelyezve: ${Number(row.dataset.index)+1}. pozíció.`:'A sor nem mozgatható erre a helyre.');
  };
  let keyboard=null,pointer=null,animation=null;
  const cancelPointer=()=>{
    if(animation!==null)cancelAnimationFrame(animation);animation=null;
    if(pointer&&drag===pointer)drag=null;
    pointer=null;clear();
  };
  const tick=()=>{
    if(!pointer?.moving)return;
    const zone=document.elementFromPoint(pointer.x,pointer.y)?.closest('.drop-zone');
    if(zone){const box=zone.getBoundingClientRect();if(pointer.y<box.top+27)zone.scrollTop-=12;else if(pointer.y>box.bottom-27)zone.scrollTop+=12;preview(zone,position(zone,{clientY:pointer.y}));}
    animation=requestAnimationFrame(tick);
  };
  root.addEventListener('pointerdown',ev=>{
    const handle=ev.target.closest('.drag-handle'),row=handle?.closest('.code-row');
    if(!row||row.draggable!==true||ev.button!==0)return;
    ev.preventDefault();handle.focus({preventScroll:true});
    keyboard=null;pointer={...infoFor(row),pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,x:ev.clientX,y:ev.clientY,moving:false};
    try{root.setPointerCapture(ev.pointerId);}catch{}
  });
  root.addEventListener('pointermove',ev=>{
    if(!pointer||pointer.pointerId!==ev.pointerId)return;
    pointer.x=ev.clientX;pointer.y=ev.clientY;
    if(!pointer.moving&&Math.hypot(pointer.x-pointer.startX,pointer.y-pointer.startY)>4){pointer.moving=true;drag=pointer;tick();}
  });
  root.addEventListener('pointerup',ev=>{
    if(!pointer||pointer.pointerId!==ev.pointerId)return;
    const info=pointer,zone=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.drop-zone');
    const boundary=zone?position(zone,ev):null;
    cancelPointer();try{root.releasePointerCapture(ev.pointerId);}catch{}
    if(!info.moving||!zone)return;
    if(zone.dataset.zone==='answer')finish(info,boundary);
    else if(info.from==='answer')finish(info,0,true);
  });
  root.addEventListener('pointercancel',ev=>{
    // Native dragging intentionally cancels the browser pointer stream. Only
    // cancel a custom pointer gesture when this adapter owns that pointer ID.
    if(pointer?.pointerId===ev.pointerId)cancelPointer();
  });
  root.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){keyboard=null;drag=null;cancelPointer();announce('Mozgatás megszakítva.');return;}
    const handle=ev.target.closest('.drag-handle'),row=handle?.closest('.code-row');
    if(!row||row.draggable!==true)return;
    if(![' ','Enter','ArrowUp','ArrowDown','Home','End'].includes(ev.key))return;
    ev.preventDefault();
    if(!keyboard){
      if(ev.key!==' '&&ev.key!=='Enter')return;
      keyboard={...infoFor(row),boundary:row.dataset.list==='answer'?Number(row.dataset.index):0};
      announce('Sor felvéve. Nyilak: beszúrási hely. Enter: elhelyezés. Escape: megszakítás.');
    }else if(ev.key===' '||ev.key==='Enter'){
      const info=keyboard;keyboard=null;clear();finish(info,info.boundary);return;
    }else{
      const zone=root.querySelector('.solution-zone'),length=zone.querySelectorAll(':scope > .code-row').length;
      keyboard.boundary=ev.key==='Home'?0:ev.key==='End'?length:Math.max(0,Math.min(length,keyboard.boundary+(ev.key==='ArrowUp'?-1:1)));
      preview(zone,keyboard.boundary);announce(`Beszúrási határ: ${keyboard.boundary}.`);
    }
  });
  return {clear:()=>{keyboard=null;drag=null;cancelPointer();}};
}
