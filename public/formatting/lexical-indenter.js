/**
 * Tolerant, syntax-aware indentation for INCOMPLETE code. Never edits source tokens.
 * Balanced pairs (including parentheses/arrays and TS type literals) are tracked
 * incrementally; no parser or evaluator is invoked on learner input.
 *
 * Contract: exactly one returned physical row per input row, with only leading
 * whitespace altered. An 'exact' row retains its full byte sequence.
 */
export const INDENT_SIZE=5;
const opening=new Set(['{','[','(']);
const closeToOpen={'}':'{',']':'[',')':'('};

/** Lexical walk deliberately ignores delimiters in strings and comments. */
function scan(line,state,visit){
  const st={...state};
  let i=0;
  while(i<line.length){
    const ch=line[i],next=line[i+1];
    if(st.comment){if(ch==='*'&&next==='/'){st.comment=false;i+=2;continue;}i++;continue;}
    if(st.quote){
      if(st.escape){st.escape=false;i++;continue;}
      if(ch==='\\'){st.escape=true;i++;continue;}
      if(ch===st.quote){st.quote=null;i++;continue;}
      i++;continue;
    }
    if(ch==='/'&&next==='/')break;
    if(ch==='/'&&next==='*'){st.comment=true;i+=2;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){st.quote=ch;i++;continue;}
    if(opening.has(ch)||Object.hasOwn(closeToOpen,ch))visit(ch,i);
    i++;
  }
  return st;
}

export function deriveIndentation(lines,{indentSize=INDENT_SIZE}={}){
  const frames=[];
  let lexical={quote:null,escape:false,comment:false};
  const result=[];
  for(const item of lines){
    const source=typeof item==='string'?item:item.code;
    const exact=typeof item==='object'&&item.normalization==='exact';
    if(typeof source!=='string'||/[\r\n\u2028\u2029]/.test(source))throw new TypeError('One physical line per row is required');
    const text=source.trimStart();
    // A closing delimiter at the start of a row reduces the *display* indentation
    // BEFORE this row is scanned. Mismatched closing delimiters are tolerated.
    const skip=new Set();
    for(let n=0;n<text.length;n++){
      if(!/\s/.test(text[n])){
        if(Object.hasOwn(closeToOpen,text[n])&&lexical.quote===null&&!lexical.comment)skip.add(n);
        else break;
      }
    }
    // Only pop matching pairs in the indentation preview; lexical scan below
    // updates the real stack. The original stack is not mutated for this check.
    const preview=[...frames];
    for(const pos of skip){const required=closeToOpen[text[pos]];
      if(preview.at(-1)===required)preview.pop();
    }
    // Parentheses belonging to a callback call must not over-indent the
    // callback *body*. Braces add lexical scope; only open call/array
    // continuations AFTER the innermost brace add continuation indentation.
    const lastBrace=preview.lastIndexOf('{');
    const braces=preview.filter(c=>c==='{').length;
    const depth=braces+preview.slice(lastBrace+1).filter(c=>c!=='{').length;
    const projected=exact?source:' '.repeat(depth*indentSize)+text;
    result.push(projected);
    lexical=scan(text,lexical,(ch)=>{
      if(opening.has(ch))frames.push(ch);
      else if(frames.at(-1)===closeToOpen[ch])frames.pop();
      // Bad intermediate syntax is allowed: stray closers do not pop other scopes.
    });
    // A // comment expires at EOL, quotes can span lines only in template literals.
    if(lexical.quote!=='`')lexical.quote=null;
    lexical.escape=false;
  }
  return result;
}
