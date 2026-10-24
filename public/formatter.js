/** Public, deep facade: incomplete-code indentation and full-editor beautification. */
import {deriveIndentation} from './formatting/lexical-indenter.js';
import {ORIGINAL_BEAUTIFY_OPTIONS,legacyIndentHints} from './formatting/legacy-beautifier.js';
export {ORIGINAL_BEAUTIFY_OPTIONS} from './formatting/legacy-beautifier.js';
export {deriveIndentation} from './formatting/lexical-indenter.js';
export function beautifier(){return typeof window!=='undefined'&&typeof window.js_beautify==='function'?window.js_beautify:null;}
export function formatForIDE(rawLines,{language='javascript',beautify=beautifier()}={}){
  if(!Array.isArray(rawLines)||!rawLines.length)return [];
  const rows=rawLines.map(x=>typeof x==='string'?{code:x,normalization:'indent'}:x);
  // The lexical formatter understands JS and TS incomplete fragments. It is the
  // authoritative safety net when js-beautify changes physical line boundaries.
  const safe=deriveIndentation(rows);
  if(language!=='javascript'||rows.some(x=>x.normalization==='exact'))return safe;
  const hints=legacyIndentHints(rows.map(x=>x.code),beautify);
  if(!hints||hints.length!==rows.length)return safe;
  // Only reuse the original beautifier's indent when its lexical *nesting*
  // agrees with the safer tolerant scan. This preserves old formatting of
  // unfinished JS fragments without letting js-beautify change line identity.
  return safe.map((line,i)=>{
    const safeDepth=line.length-line.trimStart().length;
    const suggested=hints[i];
    return suggested>=0&&suggested===safeDepth?' '.repeat(suggested)+rows[i].code.trimStart():line;
  });
}
export function formatEditor(text){return beautifier()?beautifier()(text,ORIGINAL_BEAUTIFY_OPTIONS):text;}
