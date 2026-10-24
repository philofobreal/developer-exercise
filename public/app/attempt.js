/**
 * The attempt owns only draggable identities. Every editable code slot is a
 * position; pinned reference slots are excluded from movement. Drop boundaries
 * INSERT and shift neighbours toward a blank slot, never replace/swap a row.
 * Validation belongs to the server and receives the assembled code strings.
 */
import {formatForIDE} from '../formatter.js';
export const normalize=(s,mode='indent')=>mode==='indent'?s.replace(/^[ \t]*/,''):s;
export const createAttempt=e=>({
  pool:e.lines.filter(l=>!l.fixed).map(l=>l.id),
  answer:e.lines.map(l=>l.fixed?l.id:null),
  custom:new Map(),draft:'',report:null,feedback:''
});

/** Pure position-aware insertion. Mutates the caller's array only on success. */
export function insertBetweenSlots(answer, fixedSlots, token, boundary){
  if(!Array.isArray(answer)||!Number.isInteger(boundary)||boundary<0||boundary>answer.length)return false;
  if(answer.length!==fixedSlots.length)return false;
  const slots=answer.map((_,i)=>i).filter(i=>!fixedSlots[i]);
  if(!slots.length)return false;
  const positions=slots.map(i=>answer[i]);
  const k=slots.filter(i=>i<boundary).length;
  const left=k>0?positions.lastIndexOf(null,k-1):-1;
  const right=positions.findIndex((v,i)=>i>=k&&v===null);
  if(left<0&&right<0)return false;
  // Use the nearest free position, shifting the intervening items only.
  // For a left hole, the insertion lives in k-1, i.e. immediately before
  // the first existing item on the right of the requested boundary.
  const useRight=right>=0&&(left<0||right-k<=k-left);
  if(useRight){
    for(let i=right;i>k;i--)positions[i]=positions[i-1];
    positions[k]=token;
  }else{
    for(let i=left;i<k-1;i++)positions[i]=positions[i+1];
    positions[k-1]=token;
  }
  slots.forEach((slot,i)=>{answer[slot]=positions[i];});
  return true;
}

export function createAttemptController(getExercise,getAttempt){
  const text=id=>{
    if(id===null)return '';
    return getExercise().lines.find(l=>l.id===id)?.code??getAttempt().custom.get(id)??'';
  };
  const fixed=i=>Boolean(getExercise().lines[i]?.fixed);
  const fixedSlots=()=>getExercise().lines.map(l=>Boolean(l.fixed));
  const formattedAnswer=()=>{
    const ids=getAttempt().answer;
    const lookup=new Map(getExercise().lines.map(x=>[x.id,x]));
    const rows=ids.filter(id=>id!==null).map(id=>({code:text(id),normalization:lookup.get(id)?.normalization??'indent'}));
    const projected=formatForIDE(rows,{language:getExercise().language});
    let index=0;
    return ids.map(id=>id===null?'':projected[index++]);
  };
  /** Boundary is a position between physical IDE rows, 0..answer.length. */
  const insertFromPool=(poolIndex,boundary)=>{
    const a=getAttempt();
    if(poolIndex<0||poolIndex>=a.pool.length)return false;
    if(!insertBetweenSlots(a.answer,fixedSlots(),a.pool[poolIndex],boundary))return false;
    a.pool.splice(poolIndex,1);return true;
  };
  const moveInAnswer=(origin,boundary)=>{
    const a=getAttempt();
    if(origin<0||origin>=a.answer.length||fixed(origin)||a.answer[origin]===null)return false;
    const old=a.answer.slice(),token=a.answer[origin];
    a.answer[origin]=null;
    if(!insertBetweenSlots(a.answer,fixedSlots(),token,boundary)){
      a.answer.splice(0,a.answer.length,...old);return false;
    }
    return a.answer.some((id,i)=>old[i]!==id);
  };
  const back=index=>{
    const a=getAttempt();if(index<0||index>=a.answer.length||fixed(index)||a.answer[index]===null)return false;
    a.pool.push(a.answer[index]);a.answer[index]=null;return true;
  };
  // Legacy programmatic compatibility: no swap is used by the drag/drop UI.
  const intoSolution=(index,slot)=>insertFromPool(index,slot??getAttempt().answer.findIndex(x=>x===null));
  const swap=(i,j)=>{const a=getAttempt();if(i===j||fixed(i)||fixed(j)||i<0||j<0||i>=a.answer.length||j>=a.answer.length)return false;
    [a.answer[i],a.answer[j]]=[a.answer[j],a.answer[i]];return true;};
  const applyText=source=>{
    const e=getExercise(),a=getAttempt(),input=source.replace(/\r\n?/g,'\n').split('\n');
    if(input.length>e.lines.length)return {ok:false,message:'Túl sok fizikai sor.'};
    const available=e.lines.map(l=>l.id),answer=Array(e.lines.length).fill(null),custom=new Map();
    for(let i=0;i<input.length;i++){
      const ref=e.lines[i];
      if(ref.fixed&&normalize(input[i],ref.normalization)===normalize(ref.code,ref.normalization)){
        answer[i]=ref.id;available.splice(available.indexOf(ref.id),1);
      }
    }
    for(let i=0;i<input.length;i++){
      const line=input[i];if(!line.trim()||answer[i]!==null)continue;
      const j=available.findIndex(id=>{const ref=e.lines.find(l=>l.id===id);return normalize(line,ref.normalization)===normalize(ref.code,ref.normalization);});
      if(j>=0)answer[i]=available.splice(j,1)[0];
      else{const id=`edited_${i}`;custom.set(id,line);answer[i]=id;}
    }
    a.answer=answer;a.pool=available.filter(id=>!e.lines.find(l=>l.id===id).fixed);a.custom=custom;
    return {ok:true};
  };
  return {text,fixed,formattedAnswer,insertFromPool,moveInAnswer,intoSolution,swap,back,applyText};
}
