/** Versioned author/attempt files. Imported reports are never trusted. */
import {createAttempt} from './attempt.js';
export function parseImport(text){
 if(typeof text!=='string'||text.length>1024*1024)throw Error('Legfeljebb 1 MiB JSON importálható.');
 return JSON.parse(text);
}
export function exportSession(exercise,attempt,authorModel){
 return {kind:'ngdynamic-session',version:1,exercise:{id:exercise.id,revision:exercise.revision},...(authorModel?{authorModel:structuredClone(authorModel)}:{}),attempt:{answer:[...attempt.answer],pool:[...attempt.pool],custom:[...attempt.custom]}};
}
export function restoreAttempt(session,exercise){
 if(session?.kind!=='ngdynamic-session'||session.version!==1)throw Error('Ismeretlen munkamenet-verzió.');
 const a=session.attempt;
 if(!a||!Array.isArray(a.answer)||a.answer.length!==exercise.lines.length||!Array.isArray(a.pool)||!Array.isArray(a.custom)||a.pool.length>500||a.custom.length>500)throw Error('Hibás munkamenetméret.');
 const known=new Set(exercise.lines.map(x=>x.id)),custom=new Map();
 for(const pair of a.custom){
  if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!/^edited_\d+$/.test(pair[0])||custom.has(pair[0])||typeof pair[1]!=='string'||Array.from(pair[1]).length>2048||/[\r\n\u2028\u2029]/.test(pair[1]))throw Error('Hibás szerkesztett sor.');
  custom.set(pair[0],pair[1]);
 }
 const ids=[...a.answer.filter(x=>x!==null),...a.pool];
 if(new Set(ids).size!==ids.length||ids.some(x=>!known.has(x)&&!custom.has(x))||[...known].some(x=>!ids.includes(x))||[...custom.keys()].some(x=>!a.answer.includes(x))||a.pool.some(x=>custom.has(x)))throw Error('Hiányzó, duplikált vagy ismeretlen sorazonosító.');
 for(let i=0;i<exercise.lines.length;i++)if(exercise.lines[i].fixed&&a.answer[i]!==exercise.lines[i].id)throw Error('Rögzített sor pozíciója eltér.');
 return {...createAttempt(exercise),answer:[...a.answer],pool:[...a.pool],custom};
}
export function downloadJSON(value,name){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const KEY='ngdynamic.author-session.v1';
export function saveLocal(session){localStorage.setItem(KEY,JSON.stringify(session));}
export function loadLocal(){const text=localStorage.getItem(KEY);return text?parseImport(text):null;}
