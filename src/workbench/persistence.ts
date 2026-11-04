/** Versioned author/attempt files. Imported reports are never trusted.
 *
 * NY-28 (ADR-097): migrated from the hand-written public/app/persistence.js to strict TypeScript.
 * The import is read as `unknown` and admitted only through the same checks as before, with the
 * same messages; behaviour unchanged. */
import {createAttempt,type Attempt} from './attempt.js';
import type {CodeLineExercise} from '../../dist/index.js';
import type {ExerciseSummary,LineId} from './contracts.js';

/** The exported session file, version 1. */
export interface SessionFile {
 kind:'ngdynamic-session';version:1;
 exercise:{id:string;revision:number};
 authorModel?:CodeLineExercise;
 attempt:{answer:(LineId|null)[];pool:LineId[];custom:[string,string][]};
}
type Exercise=Pick<ExerciseSummary,'lines'>;

export function parseImport(text:unknown):unknown {
 if(typeof text!=='string'||text.length>1024*1024)throw Error('Legfeljebb 1 MiB JSON importálható.');
 return JSON.parse(text);
}
export function exportSession(exercise:Pick<ExerciseSummary,'id'|'revision'>,attempt:Pick<Attempt,'answer'|'pool'|'custom'>,authorModel?:CodeLineExercise|null):SessionFile {
 return {kind:'ngdynamic-session',version:1,exercise:{id:exercise.id,revision:exercise.revision},...(authorModel?{authorModel:structuredClone(authorModel)}:{}),attempt:{answer:[...attempt.answer],pool:[...attempt.pool],custom:[...attempt.custom]}};
}
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null;
export function restoreAttempt(session:unknown,exercise:Exercise):Attempt {
 if(!record(session)||session.kind!=='ngdynamic-session'||session.version!==1)throw Error('Ismeretlen munkamenet-verzió.');
 const a=session.attempt;
 if(!record(a)||!Array.isArray(a.answer)||a.answer.length!==exercise.lines.length||!Array.isArray(a.pool)||!Array.isArray(a.custom)||a.pool.length>500||a.custom.length>500)throw Error('Hibás munkamenetméret.');
 const answer:unknown[]=a.answer,pool:unknown[]=a.pool,pairs:unknown[]=a.custom;
 const known=new Set<unknown>(exercise.lines.map(x=>x.id)),custom=new Map<string,string>();
 for(const pair of pairs){
  if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!/^edited_\d+$/.test(pair[0])||custom.has(pair[0])||typeof pair[1]!=='string'||Array.from(pair[1]).length>2048||/[\r\n\u2028\u2029]/.test(pair[1]))throw Error('Hibás szerkesztett sor.');
  custom.set(pair[0],pair[1]);
 }
 const ids=[...answer.filter(x=>x!==null),...pool];
 if(new Set(ids).size!==ids.length||ids.some(x=>!known.has(x)&&!(typeof x==='string'&&custom.has(x)))||[...known].some(x=>!ids.includes(x))||[...custom.keys()].some(x=>!answer.includes(x))||pool.some(x=>typeof x==='string'&&custom.has(x)))throw Error('Hiányzó, duplikált vagy ismeretlen sorazonosító.');
 for(let i=0;i<exercise.lines.length;i++)if(exercise.lines[i]!.fixed&&answer[i]!==exercise.lines[i]!.id)throw Error('Rögzített sor pozíciója eltér.');
 // Every id is now a known line id or an edited line's key, and null only in the answer.
 return {...createAttempt(exercise),answer:[...answer] as (LineId|null)[],pool:[...pool] as LineId[],custom};
}
export function downloadJSON(value:unknown,name:string):void {
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const KEY='ngdynamic.author-session.v1';
export function saveLocal(session:unknown):void {localStorage.setItem(KEY,JSON.stringify(session));}
export function loadLocal():unknown {const text=localStorage.getItem(KEY);return text?parseImport(text):null;}
