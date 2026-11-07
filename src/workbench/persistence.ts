/** Versioned author/attempt files. Imported reports are never trusted.
 *
 * NY-28 (ADR-097): migrated from the hand-written public/app/persistence.js to strict TypeScript.
 * The import is read as `unknown` and admitted only through the same checks as before, with the
 * same messages; behaviour unchanged. */
import {createAttempt,type Attempt} from './attempt.js';
import type {CodeLineExercise} from '../../dist/index.js';
import type {ExerciseSummary,LineId,SettingsOrigin} from './contracts.js';
import {readSettings,type SettingsRequest} from './preflight-settings.js';

/** The exported session file. Version 2 (ADR-108, E8) adds the author's analysis settings (`authorSettings`),
 * which a model does not record in full; version 1 is still read, its settings are then partial. */
export interface SessionFile {
 kind:'ngdynamic-session';version:2;
 exercise:{id:string;revision:number};
 authorModel?:CodeLineExercise;
 authorSettings?:SettingsRequest;
 attempt:{answer:(LineId|null)[];pool:LineId[];custom:[string,string][]};
}
/** A session as the workbench applies it: an author model comes with the settings to request and how far they
 * are the author's recorded ones. Nothing in it is trusted: the gates run again on the model. */
export interface ReadSession {session:unknown;author?:{model:unknown;settings:SettingsRequest;origin:SettingsOrigin}}
type Exercise=Pick<ExerciseSummary,'lines'>;

export function parseImport(text:unknown):unknown {
 if(typeof text!=='string'||text.length>1024*1024)throw Error('Legfeljebb 1 MiB JSON importálható.');
 return JSON.parse(text);
}
export function exportSession(exercise:Pick<ExerciseSummary,'id'|'revision'>,attempt:Pick<Attempt,'answer'|'pool'|'custom'>,authorModel?:CodeLineExercise|null,authorSettings?:SettingsRequest):SessionFile {
 return {kind:'ngdynamic-session',version:2,exercise:{id:exercise.id,revision:exercise.revision},...(authorModel?{authorModel:structuredClone(authorModel),...(authorSettings?{authorSettings:structuredClone(authorSettings)}:{})}:{}),attempt:{answer:[...attempt.answer],pool:[...attempt.pool],custom:[...attempt.custom]}};
}
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null;
const VERSIONS=new Set<unknown>([1,2]);
/** Reads a session file of either version (C34). Version 1 recorded no analysis settings; neither does a version 2
 * file without them: those settings are `partial` (the model's recorded environment, start values for the rest). */
export function readSession(value:unknown):ReadSession {
 if(!record(value)||value.kind!=='ngdynamic-session'||!VERSIONS.has(value.version))throw Error('Ismeretlen munkamenet-verzió.');
 if(value.authorModel===undefined)return {session:value};
 const recorded=value.version===2&&value.authorSettings!==undefined;
 return {session:value,author:{model:value.authorModel,settings:recorded?readSettings(value.authorSettings):{},origin:recorded?'recorded':'partial'}};
}
export function restoreAttempt(session:unknown,exercise:Exercise):Attempt {
 if(!record(session)||session.kind!=='ngdynamic-session'||!VERSIONS.has(session.version))throw Error('Ismeretlen munkamenet-verzió.');
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
