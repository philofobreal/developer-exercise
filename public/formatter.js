/** Full editor formatting may change layout; live projection never changes rows. */
import {deriveIndentation} from './formatting/lexical-indenter.js';
import {ORIGINAL_BEAUTIFY_OPTIONS,legacyIndentHints} from './formatting/legacy-beautifier.js';
export {ORIGINAL_BEAUTIFY_OPTIONS} from './formatting/legacy-beautifier.js';
export {deriveIndentation} from './formatting/lexical-indenter.js';
export function beautifier(){return typeof window!=='undefined'&&typeof window.js_beautify==='function'?window.js_beautify:null;}
export function formatForIDE(rawLines,{language='javascript',beautify=beautifier()}={}){
 if(!Array.isArray(rawLines)||!rawLines.length)return [];
 const rows=rawLines.map(x=>typeof x==='string'?{code:x,normalization:'indent'}:x);
 const safe=deriveIndentation(rows);
 // The lexical component owns whitespace-sensitive literals and TypeScript.
 if(language!=='javascript'||rows.some(x=>x.normalization==='exact'||x.code.includes('`')||/\\$/.test(x.code)))return safe;
 const hints=legacyIndentHints(rows.map(x=>x.code),beautify);
 if(!hints)return safe;
 // Independently verified Beautify row boundaries can correct lexical depth.
 // Only the prefix is reused; Beautify's rewritten source is never submitted.
 return safe.map((line,i)=>Number.isInteger(hints[i])&&hints[i]>=0&&hints[i]<=2500?' '.repeat(hints[i])+rows[i].code.trimStart():line);
}
export function formatEditor(text){
 try{const fn=beautifier();return fn?fn(text,ORIGINAL_BEAUTIFY_OPTIONS):text;}catch{return text;}
}
