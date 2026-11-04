/**
 * The attempt owns only draggable identities. Every editable code slot is a
 * position; pinned reference slots are excluded from movement. Drop boundaries
 * INSERT and shift neighbours toward a blank slot, never replace/swap a row.
 * Validation belongs to the server and receives the assembled code strings.
 *
 * NY-28 (ADR-097): migrated from the hand-written public/app/attempt.js to strict TypeScript;
 * behaviour unchanged.
 */
import {formatForIDE} from '../formatter.js';
import type {AttemptSnapshot,ExerciseLine,ExerciseSummary,LineId} from './contracts.js';

/** A learner's arrangement: the snapshot the view reads, plus the text of lines edited in the code view. */
export interface Attempt extends AttemptSnapshot {custom:Map<string,string>;}
type Slot=LineId|null;

export const normalize=(s:string,mode='indent'):string=>mode==='indent'?s.replace(/^[ \t]*/,''):s;
export const createAttempt=(e:Pick<ExerciseSummary,'lines'>):Attempt=>({
  pool:e.lines.filter(l=>!l.fixed).map(l=>l.id),
  answer:e.lines.map(l=>l.fixed?l.id:null),
  custom:new Map(),draft:'',report:null,feedback:'',generation:0
});

/** Pure position-aware insertion. Mutates the caller's array only on success. */
export function insertBetweenSlots(answer:Slot[],fixedSlots:readonly boolean[],token:LineId,boundary:number):boolean {
  if(!Array.isArray(answer)||!Number.isInteger(boundary)||boundary<0||boundary>answer.length)return false;
  if(answer.length!==fixedSlots.length)return false;
  const slots=answer.map((_,i)=>i).filter(i=>!fixedSlots[i]);
  if(!slots.length)return false;
  const positions=slots.map(i=>answer[i]!==undefined?answer[i]!:null);
  const k=slots.filter(i=>i<boundary).length;
  const left=k>0?positions.lastIndexOf(null,k-1):-1;
  const right=positions.findIndex((v,i)=>i>=k&&v===null);
  if(left<0&&right<0)return false;
  // Use the nearest free position, shifting the intervening items only.
  // For a left hole, the insertion lives in k-1, i.e. immediately before
  // the first existing item on the right of the requested boundary.
  const useRight=right>=0&&(left<0||right-k<=k-left);
  if(useRight){
    for(let i=right;i>k;i--)positions[i]=positions[i-1]!;
    positions[k]=token;
  }else{
    for(let i=left;i<k-1;i++)positions[i]=positions[i+1]!;
    positions[k-1]=token;
  }
  slots.forEach((slot,i)=>{answer[slot]=positions[i]!;});
  return true;
}

export interface AttemptController {
  text:(id:LineId|null)=>string;
  fixed:(position:number)=>boolean;
  formattedAnswer:()=>string[];
  insertFromPool:(poolIndex:number,boundary:number)=>boolean;
  moveInAnswer:(origin:number,boundary:number)=>boolean;
  intoSolution:(index:number,slot?:number)=>boolean;
  swap:(i:number,j:number)=>boolean;
  back:(index:number)=>boolean;
  applyText:(source:string)=>{ok:true}|{ok:false;message:string};
}

export function createAttemptController(getExercise:()=>Pick<ExerciseSummary,'lines'|'language'>,getAttempt:()=>Attempt):AttemptController {
  const text=(id:LineId|null):string=>{
    if(id===null)return '';
    return getExercise().lines.find(l=>l.id===id)?.code??getAttempt().custom.get(String(id))??'';
  };
  const fixed=(i:number):boolean=>Boolean(getExercise().lines[i]?.fixed);
  const fixedSlots=():boolean[]=>getExercise().lines.map(l=>Boolean(l.fixed));
  const formattedAnswer=():string[]=>{
    const ids=getAttempt().answer;
    const lookup=new Map<LineId,ExerciseLine>(getExercise().lines.map(x=>[x.id,x]));
    const rows=ids.filter((id):id is LineId=>id!==null).map(id=>({code:text(id),normalization:lookup.get(id)?.normalization??'indent'}));
    const projected=formatForIDE(rows,{language:getExercise().language});
    let index=0;
    return ids.map(id=>id===null?'':projected[index++]!);
  };
  /** Boundary is a position between physical IDE rows, 0..answer.length. */
  const insertFromPool=(poolIndex:number,boundary:number):boolean=>{
    const a=getAttempt();
    if(poolIndex<0||poolIndex>=a.pool.length)return false;
    if(!insertBetweenSlots(a.answer,fixedSlots(),a.pool[poolIndex]!,boundary))return false;
    a.pool.splice(poolIndex,1);return true;
  };
  const moveInAnswer=(origin:number,boundary:number):boolean=>{
    const a=getAttempt();
    if(origin<0||origin>=a.answer.length||fixed(origin)||a.answer[origin]===null)return false;
    const old=a.answer.slice(),token=a.answer[origin]!;
    a.answer[origin]=null;
    if(!insertBetweenSlots(a.answer,fixedSlots(),token,boundary)){
      a.answer.splice(0,a.answer.length,...old);return false;
    }
    return a.answer.some((id,i)=>old[i]!==id);
  };
  const back=(index:number):boolean=>{
    const a=getAttempt();if(index<0||index>=a.answer.length||fixed(index)||a.answer[index]===null)return false;
    a.pool.push(a.answer[index]!);a.answer[index]=null;return true;
  };
  // Legacy programmatic compatibility: no swap is used by the drag/drop UI.
  const intoSolution=(index:number,slot?:number):boolean=>insertFromPool(index,slot??getAttempt().answer.findIndex(x=>x===null));
  const swap=(i:number,j:number):boolean=>moveInAnswer(i,j>i?j+1:j);
  const applyText=(source:string):{ok:true}|{ok:false;message:string}=>{
    const e=getExercise(),a=getAttempt(),input=source.replace(/\r\n?/g,'\n').split('\n');
    if(input.length>e.lines.length)return {ok:false,message:'Túl sok fizikai sor.'};
    if(e.lines.some((l,i)=>l.fixed&&(typeof input[i]!=='string'||normalize(input[i]!,l.normalization)!==normalize(l.code,l.normalization))))return {ok:false,message:'Rögzített sor nem módosítható vagy helyezhető át.'};
    const lineOf=(id:LineId):ExerciseLine=>e.lines.find(l=>l.id===id)!;
    const available:LineId[]=e.lines.map(l=>l.id),answer:Slot[]=Array<Slot>(e.lines.length).fill(null),custom=new Map<string,string>();
    for(let i=0;i<input.length;i++){
      const ref=e.lines[i]!;
      if(ref.fixed&&normalize(input[i]!,ref.normalization)===normalize(ref.code,ref.normalization)){
        answer[i]=ref.id;available.splice(available.indexOf(ref.id),1);
      }
    }
    for(let i=0;i<input.length;i++){
      const line=input[i]!;if(answer[i]!==null||(!line.trim()&&!available.some(id=>{const ref=lineOf(id);return ref.normalization==='exact'&&ref.code===line;})))continue;
      const j=available.findIndex(id=>{const ref=lineOf(id);return normalize(line,ref.normalization)===normalize(ref.code,ref.normalization);});
      if(j>=0)answer[i]=available.splice(j,1)[0]!;
      else{const id=`edited_${i}`;custom.set(id,line);answer[i]=id;}
    }
    a.answer=answer;a.pool=available.filter(id=>!lineOf(id).fixed);a.custom=custom;
    return {ok:true};
  };
  return {text,fixed,formattedAnswer,insertFromPool,moveInAnswer,intoSolution,swap,back,applyText};
}
