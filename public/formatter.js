/** Full editor formatting may change layout; live projection never changes rows. */
import {deriveIndentation,INDENT_SIZE} from './formatting/lexical-indenter.js';
import {ORIGINAL_BEAUTIFY_OPTIONS} from './formatting/legacy-beautifier.js';
export {ORIGINAL_BEAUTIFY_OPTIONS} from './formatting/legacy-beautifier.js';
export {deriveIndentation} from './formatting/lexical-indenter.js';
export function beautifier(){return typeof window!=='undefined'&&typeof window.js_beautify==='function'?window.js_beautify:null;}
/** The IDE projection of placed rows, one string per row (ADR-112): the nesting depth comes from the rows'
 * current arrangement (it never reveals the reference's), plus each row's own continuation indent taken from the
 * formatted reference (`offset`), in the reference's own indent unit (`indentSize`; see referenceLayout). The same
 * projection draws the author's board and the learner's sorter, so the reference order shows as its source. */
export function formatForIDE(rawLines,{indentSize=INDENT_SIZE}={}){
 if(!Array.isArray(rawLines)||!rawLines.length)return [];
 const rows=rawLines.map(x=>typeof x==='string'?{code:x,normalization:'indent'}:x);
 return deriveIndentation(rows,{indentSize});
}
const lead=text=>(/^ */.exec(text)??[''])[0].length;
/** What the formatted reference says about indentation (ADR-112): its indent unit (the smallest indentation of a
 * row one level deep; 5 when the rows carry none) and, per row, how many levels it stands deeper than its nesting
 * (a continuation line of a statement, `let r = 0,` / `t = Infinity,`). */
export function referenceLayout(referenceRows){
 if(!Array.isArray(referenceRows)||!referenceRows.length)return {indentSize:INDENT_SIZE,offsets:[]};
 const rows=referenceRows.map(x=>typeof x==='string'?{code:x,normalization:'indent'}:x);
 const depths=deriveIndentation(rows.map(row=>({code:row.code,normalization:row.normalization})),{indentSize:1}).map(lead);
 const firstLevel=rows.map((row,i)=>row.normalization!=='exact'&&depths[i]===1?lead(row.code):0).filter(value=>value>0);
 const indentSize=firstLevel.length?Math.min(16,Math.min(...firstLevel)):INDENT_SIZE;
 const offsets=rows.map((row,i)=>row.normalization==='exact'?0:Math.max(0,Math.min(8,Math.floor((lead(row.code)-depths[i]*indentSize)/indentSize))));
 return {indentSize,offsets};
}
export function formatEditor(text){
 try{const fn=beautifier();return fn?fn(text,ORIGINAL_BEAUTIFY_OPTIONS):text;}catch{return text;}
}
