/** The original 2019 ngDynamic options, copied deliberately rather than guessed. */
export const ORIGINAL_BEAUTIFY_OPTIONS=Object.freeze({
  indent_size:5,indent_char:' ',indent_with_tabs:false,editorconfig:false,
  eol:'\n',end_with_newline:true,indent_level:0,preserve_newlines:true,
  max_preserve_newlines:10,space_in_paren:false,space_in_empty_paren:false,
  jslint_happy:false,space_after_anon_function:false,space_after_named_function:false,
  brace_style:'collapse',unindent_chained_methods:false,break_chained_methods:false,
  keep_array_indentation:false,unescape_strings:false,wrap_line_length:0,
  e4x:false,comma_first:false,operator_position:'before-newline',
  indent_empty_lines:false,templating:['auto']
});
export const LEGACY_SENTINEL='_____code_line_end_;';
/**
 * The marker is used as a DISPLAY guide only. Unlike the original implementation,
 * a marker never becomes part of a CodeLine, and a formatter cannot add/remove IDs.
 * When beautifier rewrites a marker boundary, only the independent lexer is used.
 */
export function legacyIndentHints(lines,beautify){
  if(typeof beautify!=='function'||lines.some(x=>x.includes(LEGACY_SENTINEL)))return null;
  try{
    const annotated=lines.map(line=>line.trim()+LEGACY_SENTINEL).join('');
    const output=beautify(annotated,ORIGINAL_BEAUTIFY_OPTIONS);
    if(typeof output!=='string'||output===annotated)return null;
    const chunks=output.split(LEGACY_SENTINEL);
    if(chunks.length!==lines.length+1)return null;
    return chunks.slice(0,-1).map(chunk=>{
      const nonempty=chunk.replace(/\r/g,'').split('\n').filter(s=>s.trim());
      if(nonempty.length!==1)return null;
      return (nonempty[0].match(/^[ \t]*/)||[''])[0].replace(/\t/g,'     ').length;
    });
  }catch{return null;}
}
