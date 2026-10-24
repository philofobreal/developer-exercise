/** Tolerant JS/TS lexical preview. No parsing or execution of learner code.
 * Each input row yields one row. Only leading whitespace outside literal payloads
 * may change. Delimiter frames and lexical modes have independent lifetimes.
 */
export const INDENT_SIZE=5;
const closes={'}':'{',']':'[',')':'('};
const controls=new Set(['if','while','for','switch','catch','with']);
const prefixes=new Set(['return','throw','case','yield','await','delete','typeof','void','new','in','instanceof','of','const','let','var']);
const blocks=new Set(['else','do','try','finally']);
const depth=frames=>{
 const last=frames.findLastIndex(x=>x.char==='{');
 return frames.filter(x=>x.char==='{').length+frames.slice(last+1).filter(x=>x.char!=='{').length;
};
/** The slash lexical goal follows tokens, including control parentheses. Invalid
 * source is best effort: an unterminated regex expires at EOL, never eats a scope.
 */
function scan(text,s,frames){
 let i=0;
 while(i<text.length){
  const ch=text[i],next=text[i+1];
  if(s.mode==='comment'){if(ch==='*'&&next==='/'){s.mode='code';i+=2;}else i++;continue;}
  if(s.mode==='template'){
   if(s.escape){s.escape=false;i++;continue;}
   if(ch==='\\'){s.escape=true;i++;continue;}
   if(ch==='`'){s.mode='code';s.expr=false;i++;continue;}
   if(ch==='$'&&next==='{'){frames.push({char:'{',kind:'template'});s.mode='code';s.expr=true;i+=2;continue;}
   i++;continue;
  }
  if(s.mode==='string'){
   if(s.escape){s.escape=false;i++;continue;}
   if(ch==='\\'){s.escape=true;i++;continue;}
   if(ch===s.quote){s.mode='code';s.expr=false;}
   i++;continue;
  }
  if(s.mode==='regex'){
   if(s.escape){s.escape=false;i++;continue;}
   if(ch==='\\'){s.escape=true;i++;continue;}
   if(ch==='[')s.characterClass=true;
   if(ch===']')s.characterClass=false;
   if(ch==='/'&&!s.characterClass){s.mode='code';s.expr=false;i++;while(/[a-z]/i.test(text[i]??'')&&i<text.length)i++;continue;}
   i++;continue;
  }
  if(/\s/.test(ch)){i++;continue;}
  if(ch==='/'&&next==='/')break;
  if(ch==='/'&&next==='*'){s.mode='comment';i+=2;continue;}
  if(ch==='"'||ch==="'"){s.mode='string';s.quote=ch;s.escape=false;i++;continue;}
  if(ch==='`'){s.mode='template';s.escape=false;i++;continue;}
  if(ch==='/'){
   if(s.expr){s.mode='regex';s.characterClass=false;s.escape=false;i++;}
   else{s.expr=true;i+=next==='='?2:1;}
   continue;
  }
  if(/[\p{ID_Start}_$]/u.test(ch)){
   const start=i++;while(i<text.length&&/[\p{ID_Continue}$]/u.test(text[i]))i++;
   const word=text.slice(start,i),property=s.last==='.';
   if(word==='function'&&!property)s.pendingFunction={expression:s.last==='async'?!!s.asyncExpression:![';','{','}','export','default'].includes(s.last)};
   if(word==='async')s.asyncExpression=![';','{','}','export','default'].includes(s.last);
   s.control=!property&&controls.has(word);s.block=!property&&blocks.has(word);s.expr=!property&&(prefixes.has(word)||s.control||s.block);s.last=word;continue;
  }
  if(/[0-9]/.test(ch)){i++;while(i<text.length&&/[\w.]/.test(text[i]))i++;s.expr=false;s.last='value';continue;}
  if(ch==='('||ch==='['||ch==='{'){
   frames.push({char:ch,kind:ch==='{'?(s.functionBody?.expression?'function-expression':s.block||!s.expr||s.last===')'||s.last===';'||s.last==='=>'? 'block':'object'):'group',control:ch==='('&&s.control,function:ch==='('?s.pendingFunction:null});
   if(ch==='(')s.pendingFunction=null;if(ch==='{')s.functionBody=null;
   s.expr=true;s.control=false;s.block=false;s.last=ch;i++;continue;
  }
  if(Object.hasOwn(closes,ch)){
   const frame=frames.at(-1);
   if(frame?.char===closes[ch]){
    frames.pop();if(ch===')'&&frame.function)s.functionBody=frame.function;
    if(frame.kind==='template'){s.mode='template';s.expr=false;}
    else s.expr=ch===')'?!!frame.control:ch==='}'&&frame.kind==='block';
   }
   s.last=ch;i++;continue;
  }
  if((ch==='+'||ch==='-')&&next===ch){i+=2;s.last='update';continue;}
  if(ch==='='&&next==='>'){s.last='=>';s.expr=true;i+=2;continue;}
  if(ch===';')s.functionBody=null;
  s.expr=ch!=='.';s.last=ch;s.control=false;i++;
 }
 // JS strings may continue only after an escaped physical newline. Regexes may
 // never span physical lines. Template/comment contexts are explicitly retained.
 if(s.mode==='regex'){s.mode='code';s.expr=true;}
 if(s.mode==='string'&&!s.escape)s.mode='code';
 s.escape=false;
}
export function deriveIndentation(lines,{indentSize=INDENT_SIZE}={}){
 if(!Number.isInteger(indentSize)||indentSize<0||indentSize>16)throw new RangeError('Invalid indent size');
 const frames=[],s={mode:'code',expr:true,last:';',control:false,block:false,escape:false};
 return lines.map(item=>{
  const source=typeof item==='string'?item:item?.code;
  if(typeof source!=='string'||/[\r\n\u2028\u2029]/.test(source))throw new TypeError('One physical line per row is required');
  const preserve=item?.normalization==='exact'||s.mode==='template'||s.mode==='string';
  const text=source.replace(/^[ \t]*/,''),preview=frames.slice();
  if(s.mode==='code'){
   for(const ch of text){if(/\s/.test(ch))continue;if(!Object.hasOwn(closes,ch))break;if(preview.at(-1)?.char===closes[ch])preview.pop();}
  }
  const out=preserve?source:' '.repeat(depth(preview)*indentSize)+text;
  scan(source,s,frames);
  return out;
 });
}
