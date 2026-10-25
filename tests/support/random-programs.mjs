/** Seeded generator of small, always-terminating JavaScript fixtures for
 * property-based ordering tests. Every reference program runs without throwing:
 * reads only target bindings that are initialised and visible at that point,
 * helper functions only use their parameter, and every block is bounded.
 * `extended` adds multi-row calls and shared `} else {` boundaries (WP6). */
import {random} from './semantic-oracle.mjs';

export function randomProgram(seed,{statements=7,depth=2,extended=false}={}){
 const rng=random(seed),pick=items=>items[Math.floor(rng()*items.length)],lines=['function evaluate() {'];
 let counter=0;const fresh=prefix=>`${prefix}${counter++}`;
 const scopes=[[]];
 const visible=filter=>scopes.flat().filter(filter);
 const numberRead=()=>{const options=visible(b=>b.kind==='number'&&b.constant);return options.length&&rng()<0.7?pick(options).name:String(Math.floor(rng()*9));};
 const anyRead=()=>{const options=visible(b=>b.readable);return options.length?pick(options).name:"'s'";};
 function expression(){
  switch(Math.floor(rng()*8)){
   case 0:return {code:String(Math.floor(rng()*9)),kind:'number'};
   case 1:return {code:`${numberRead()} + ${numberRead()}`,kind:'number'};
   case 2:return {code:`[${anyRead()}, ${numberRead()}]`,kind:'object'};
   case 3:return {code:`{ value: ${anyRead()} }`,kind:'object'};
   case 4:return {code:`() => ${anyRead()}`,kind:'function'};
   case 5:return {code:`typeof ${anyRead()}`,kind:'string'};
   case 6:return {code:`${anyRead()} === ${anyRead()}`,kind:'boolean'};
   default:return {code:`'t${Math.floor(rng()*5)}'`,kind:'string'};
  }
 }
 function statement(level,indent){
  const pad='  '.repeat(indent),choice=Math.floor(rng()*((level<depth?10:8)+(extended?2:0)));
  if(extended&&choice>=(level<depth?10:8)){
   if(choice===(level<depth?10:8)){lines.push(`${pad}record(`,`${pad}  ${anyRead()},`,`${pad});`);return;}
   if(level>=depth){lines.push(`${pad}record('flat');`);return;}
   lines.push(`${pad}if (${anyRead()} === ${anyRead()}) {`);
   for(const [i,close] of [[0,'} else {'],[1,'}']]){scopes.push([]);statement(level+1,indent+1);scopes.pop();lines.push(pad+close);}
   return;
  }
  if(choice<=2){const name=fresh('c'),value=expression();lines.push(`${pad}const ${name} = ${value.code};`);scopes.at(-1).push({name,kind:value.kind,constant:true,readable:true});return;}
  if(choice===3){const name=fresh('l');lines.push(`${pad}let ${name};`);scopes.at(-1).push({name,kind:'undefined',constant:false,readable:true,writable:true});return;}
  if(choice===4){const target=visible(b=>b.writable);if(target.length){const name=pick(target).name;lines.push(`${pad}${name} = ${numberRead()};`);return;}lines.push(`${pad}record('noop');`);return;}
  if(choice===5){lines.push(`${pad}record('r${counter++}', ${anyRead()});`);return;}
  if(choice===6&&indent===1){const name=fresh('f');lines.push(`${pad}function ${name}(input) {`,`${pad}  return [input, '${name}'];`,`${pad}}`);scopes[0].push({name,kind:'function',constant:false,readable:true});return;}
  if(choice===7){const helpers=scopes[0].filter(b=>b.kind==='function'&&b.name.startsWith('f'));if(helpers.length){lines.push(`${pad}record('call', ${pick(helpers).name}(${anyRead()}));`);return;}lines.push(`${pad}record('none');`);return;}
  const opener=choice===8?'{':`if (${anyRead()} === ${anyRead()}) {`;
  lines.push(pad+opener);scopes.push([]);
  const count=1+Math.floor(rng()*3);for(let i=0;i<count;i++)statement(level+1,indent+1);
  scopes.pop();lines.push(pad+'}');
 }
 for(let i=0;i<statements;i++)statement(0,1);
 const results=scopes[0].filter(b=>b.readable&&b.kind!=='function').map(b=>b.kind==='function'?`typeof ${b.name}`:b.name);
 lines.push(`  return [${results.join(', ')}];`,'}');
 return {id:(extended?'random-extended-':'random-')+seed,origin:'random',language:'javascript',source:lines,probe:'evaluate()'};
}
