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

/* ------------- generative coverage of classes and script-level declarations ------------- */
const indentOf=pad=>pad+'  ';
/** Seeded class programs: a top-level class (optionally extending a base) and an
 * optional class nested in evaluate(), with methods, getters, accessor pairs,
 * fields, static members, private members, index-, string- and computed-named,
 * duplicate and constructor members; TypeScript adds declare fields, parameter
 * properties, overload groups and `accessor` fields. The probe reaches every
 * public member, and every reference runs without throwing. */
export function randomClassProgram(seed,{language='javascript',members=6,nested=true}={}){
 const rng=random(seed),pick=items=>items[Math.floor(rng()*items.length)],chance=p=>rng()<p,typescript=language==='typescript';
 const lines=[],probes=[];let counter=0;const fresh=prefix=>`${prefix}${counter++}`;
 const returns=type=>typescript?`: ${type}`:'';
 /** Emits one class; `instance` names the probe's instance expression. */
 function emitClass(name,{base=null,pad='',instance,count}){
  const inner=indentOf(pad),body=[],tail=[],fields=[];let constructed=false,indexKey=0;
  const one=(head,expression)=>chance(0.4)?[`${inner}${head} { return ${expression}; }`]:[`${inner}${head} {`,`${indentOf(inner)}return ${expression};`,`${inner}}`];
  const kinds=['method','method','field','field','static-method','static-field','getter','accessor-pair','private','index','string-name','computed','constructor',...(typescript?['declare','overload','auto-accessor','static-auto-accessor','parameter-property']:['duplicate'])];
  for(let i=0;i<count;i++){
   const kind=pick(kinds);
   if(kind==='method'){const id=fresh('m');body.push(...one(`${id}()${returns('unknown')}`,fields.length&&chance(0.6)?`this.${pick(fields)}`:`'${id}'`));probes.push(`${instance}.${id}()`);}
   else if(kind==='field'){const id=fresh('f'),init=fields.length&&chance(0.3)?`this.${pick(fields)}`:chance(0.3)?`record('${id}') ?? ${counter}`:String(counter);body.push(`${inner}${id} = ${init};`);fields.push(id);probes.push(`${instance}.${id}`);}
   else if(kind==='static-method'){const id=fresh('s');body.push(...one(`static ${id}()${returns('string')}`,`'${id}'`));probes.push(`${name}.${id}()`);}
   else if(kind==='static-field'){const id=fresh('g');body.push(`${inner}static ${id} = ${chance(0.4)?`record('${id}') ?? ${counter}`:counter};`);probes.push(`${name}.${id}`);}
   else if(kind==='getter'){const id=fresh('t');body.push(...one(`get ${id}()${returns('unknown')}`,fields.length?`this.${pick(fields)}`:`'${id}'`));probes.push(`${instance}.${id}`);}
   else if(kind==='accessor-pair'){const id=fresh('p');body.push(...one(`get ${id}()${returns('unknown')}`,`'${id}'`),`${inner}set ${id}(value${returns('unknown')}) {`,`${indentOf(inner)}record('${id}', value);`,`${inner}}`);probes.push(`(${instance}.${id} = ${counter}, ${instance}.${id})`);}
   else if(kind==='private'){const id=fresh('h');body.push(`${inner}#${id} = ${counter};`,...one(`#q${id}()${returns('number')}`,`this.#${id}`),...one(`r${id}()${returns('number')}`,`this.#q${id}()`));probes.push(`${instance}.r${id}()`);}
   else if(kind==='index'){const key=indexKey++;body.push(...one(`${key}()${returns('string')}`,`'i${key}'`));probes.push(`${instance}[${key}]()`);}
   else if(kind==='string-name'){const id=fresh('n');body.push(...one(`'${id}'()${returns('string')}`,`'${id}'`));probes.push(`${instance}['${id}']()`);}
   else if(kind==='computed'){const id=fresh('k');body.push(...one(`[record('${id}') ?? '${id}']()${returns('string')}`,`'${id}'`));probes.push(`${instance}['${id}']()`);}
   else if(kind==='duplicate'){const id=fresh('d');body.push(...one(`${id}()`,`'first'`));tail.push(...one(`${id}()`,`'second'`));probes.push(`${instance}.${id}()`);}
   else if(kind==='constructor'||kind==='parameter-property'){
    if(constructed)continue;constructed=true;const id=fresh('c');
    const parameter=kind==='parameter-property'?`readonly ${id}: number = ${counter}`:'';
    body.push(`${inner}constructor(${parameter}) {`,...(base?[`${indentOf(inner)}super();`]:[]),...(kind==='constructor'?[`${indentOf(inner)}this.${id} = record('${id}') ?? ${counter};`]:[]),`${inner}}`);
    probes.push(`${instance}.${id}`);
   }
   else if(kind==='declare')body.push(`${inner}declare ${fresh('e')}: number;`);
   else if(kind==='overload'){const id=fresh('o');body.push(`${inner}${id}(value: string): string;`,`${inner}${id}(value: number): string;`,`${inner}${id}(value: string | number): string {`,`${indentOf(inner)}return String(value);`,`${inner}}`);probes.push(`${instance}.${id}(${counter})`);}
   else if(kind==='auto-accessor'){const id=fresh('a');body.push(`${inner}accessor ${id} = ${counter};`);probes.push(`${instance}.${id}`);}
   else if(kind==='static-auto-accessor'){const id=fresh('u');body.push(`${inner}static accessor ${id} = '${id}';`);probes.push(`${name}.${id}`);}
  }
  return [`${pad}class ${name}${base?` extends ${base}`:''} {`,...body,...tail,`${pad}}`];
 }
 if(typescript&&chance(0.5))lines.push(`interface Shape${seed} {`,'  size: number;','  label: string;','}');
 const base=chance(0.5)?`Base${seed}`:null;
 if(base)lines.push(...emitClass(base,{instance:'item',count:2+Math.floor(rng()*3)}));
 lines.push(...emitClass(`Item${seed}`,{base,instance:'item',count:2+Math.floor(rng()*members)}));
 const local=nested&&chance(0.6)?emitClass('Local',{pad:'  ',instance:'local',count:2+Math.floor(rng()*4)}):[];
 lines.push('function evaluate() {',...local,`  const item = new Item${seed}();`,...(local.length?['  const local = new Local();']:[]),`  return [${probes.join(', ')}];`,'}');
 return {id:`random-class-${language}-${seed}`,origin:'random',language,source:lines,probe:'evaluate()'};
}

/** Seeded classic scripts mixing top-level function, var, let, const, class,
 * assignment and call statements; TypeScript adds enums, instantiated and
 * type-only namespaces, import aliases, interfaces, type aliases and declare
 * statements. evaluate() reads every runtime binding after the whole script ran. */
export function randomScriptProgram(seed,{language='javascript',items=8}={}){
 const rng=random(seed),pick=items=>items[Math.floor(rng()*items.length)],chance=p=>rng()<p,typescript=language==='typescript';
 const lines=[],reads=[],values=[],lets=[],calls=[],namespaces=[];let counter=0;const fresh=prefix=>`${prefix}${counter++}`;
 const operand=()=>values.length&&chance(0.5)?`${pick(values)} + 1`:String(counter);
 const kinds=['function','function','var','var','let','const','const','class','record','assign',...(typescript?['enum','namespace','type-namespace','interface','type','alias','declare']:[])];
 const count=3+Math.floor(rng()*items);
 for(let i=0;i<count;i++){
  const kind=pick(kinds);
  if(kind==='function'){const id=fresh('f');lines.push(...(chance(0.5)?[`function ${id}() { return ${counter}; }`]:[`function ${id}() {`,`  return ${counter};`,'}']));calls.push(`${id}()`);reads.push(`${id}()`);}
  else if(kind==='var'){const id=fresh('v');lines.push(`var ${id} = ${calls.length&&chance(0.4)?pick(calls):operand()};`);values.push(id);reads.push(id);}
  else if(kind==='let'){const id=fresh('l');lines.push(`let ${id} = ${operand()};`);values.push(id);lets.push(id);reads.push(id);}
  else if(kind==='const'){const id=fresh('c');lines.push(`const ${id} = ${operand()};`);values.push(id);reads.push(id);}
  else if(kind==='class'){const id=fresh('K');lines.push(`class ${id} {`,`  m() { return '${id}'; }`,'}');reads.push(`new ${id}().m()`);}
  else if(kind==='record')lines.push(`record('${fresh('r')}', ${operand()});`);
  else if(kind==='assign'){if(lets.length)lines.push(`${pick(lets)} = ${counter++};`);}
  else if(kind==='enum'){const id=fresh('E');lines.push(`enum ${id} {`,'  A,','  B,','}');reads.push(`${id}.B`,`${id}[0]`);}
  else if(kind==='namespace'){const id=fresh('N');lines.push(`namespace ${id} {`,`  export const x = ${counter};`,'}');namespaces.push(id);reads.push(`${id}.x`);}
  else if(kind==='type-namespace')lines.push(`namespace ${fresh('T')} {`,'  export interface Box {','    size: number;','  }','}');
  else if(kind==='interface')lines.push(`interface ${fresh('I')} {`,'  a: number;','}');
  else if(kind==='type')lines.push(`type ${fresh('Y')} = { a: number };`);
  else if(kind==='alias'){if(namespaces.length){const id=fresh('a');lines.push(`import ${id} = ${pick(namespaces)}.x;`);reads.push(id);}}
  else if(kind==='declare')lines.push(`declare const ${fresh('d')}: number;`);
 }
 lines.push('function evaluate() {',`  return [${reads.join(', ')}];`,'}');
 return {id:`random-script-${language}-${seed}`,origin:'random',language,source:lines,probe:'evaluate()'};
}
