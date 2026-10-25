/** Independent pedagogical-policy oracle for FIXED, bounded test fixtures only.
 *
 * It never sees learner input and is deliberately implemented apart from the
 * author generator: JavaScript is parsed with Acorn, TypeScript with a separate
 * shape/effect walk over the compiler AST. Verdict for a candidate row order:
 *   P0 syntax     – the arrangement parses;
 *   P1 scope      – every statement/member stays in the same lexical list
 *                   (statement and member lists compared as multisets);
 *   P2 effects    – in each statement list, the relative order of every pair
 *                   with at least one evaluation-time effect is unchanged,
 *                   unless one side is position-free (hoisted function or
 *                   erased type declaration);
 *   P3 runtime    – value, thrown exception and record() trace agree with the
 *                   reference on the fixture probe (TS: both class-field modes).
 * P3 is empirical evidence on finite inputs, not an equivalence proof.
 */
import {parse as parseScript} from 'acorn';
import ts from 'typescript';
import {Script,createContext} from 'node:vm';

// Short first budget; a timeout is re-checked with a long one so that machine
// load cannot turn a terminating fixture into a false 'timeout'.
const TIMEOUTS_MS=[250,2000];

/* ----------------------------- JavaScript (Acorn) ---------------------------- */
const jsFunction=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression']);
const jsEffect=new Set(['CallExpression','NewExpression','AssignmentExpression','UpdateExpression','AwaitExpression','YieldExpression','ThrowStatement','ReturnStatement','BreakStatement','ContinueStatement','TaggedTemplateExpression','MemberExpression','ImportExpression','SpreadElement','ObjectPattern','ArrayPattern','ForStatement','ForInStatement','ForOfStatement','WhileStatement','DoWhileStatement','WithStatement','DebuggerStatement','StaticBlock']);
function jsShape(value,key=''){
 if(Array.isArray(value)){const items=value.map(item=>jsShape(item));return key==='body'?items.sort():items;}
 if(value&&typeof value==='object')return JSON.stringify(Object.entries(value).filter(([name])=>!['start','end','raw','loc','range'].includes(name)).map(([name,item])=>[name,jsShape(item,name)]));
 return JSON.stringify(value);
}
function jsHasEffect(node){
 if(!node||typeof node!=='object')return false;
 if(Array.isArray(node))return node.some(jsHasEffect);
 if(jsEffect.has(node.type))return true;
 if(node.type==='UnaryExpression'&&node.operator==='delete'||node.type==='BinaryExpression'&&['in','instanceof'].includes(node.operator))return true;
 if(node.type==='Identifier'&&node.name==='eval')return true;
 if(jsFunction.has(node.type))return false;
 if(node.type==='ClassDeclaration'||node.type==='ClassExpression'){
  // Class evaluation runs heritage, computed keys and static initializers only.
  return jsHasEffect(node.superClass)||node.body.body.some(member=>member.computed&&jsHasEffect(member.key)||member.static&&member.value&&member.type==='PropertyDefinition'||member.type==='StaticBlock');
 }
 return Object.entries(node).some(([key,value])=>key!=='type'&&value&&typeof value==='object'&&jsHasEffect(value));
}
function jsLists(tree){
 const lists=[];
 const visit=(node,functionLevel)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,false));return;}
  if((node.type==='Program'||node.type==='BlockStatement'||node.type==='StaticBlock')&&Array.isArray(node.body))lists.push({items:node.body,hoisting:node.type==='Program'||functionLevel});
  for(const [key,value] of Object.entries(node))if(value&&typeof value==='object')visit(value,jsFunction.has(node.type)&&key==='body');
 };
 visit(tree,false);return lists;
}
const jsPositionFree=(statement,hoisting)=>hoisting&&statement.type==='FunctionDeclaration';

/* ------------------------- TypeScript (compiler AST walk) -------------------- */
const tsFunction=node=>ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node)||ts.isMethodDeclaration(node)||ts.isConstructorDeclaration(node)||ts.isGetAccessorDeclaration(node)||ts.isSetAccessorDeclaration(node);
const assignment=new Set([ts.SyntaxKind.EqualsToken,ts.SyntaxKind.PlusEqualsToken,ts.SyntaxKind.MinusEqualsToken,ts.SyntaxKind.AsteriskEqualsToken,ts.SyntaxKind.AsteriskAsteriskEqualsToken,ts.SyntaxKind.SlashEqualsToken,ts.SyntaxKind.PercentEqualsToken,ts.SyntaxKind.LessThanLessThanEqualsToken,ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,ts.SyntaxKind.AmpersandEqualsToken,ts.SyntaxKind.BarEqualsToken,ts.SyntaxKind.CaretEqualsToken,ts.SyntaxKind.AmpersandAmpersandEqualsToken,ts.SyntaxKind.BarBarEqualsToken,ts.SyntaxKind.QuestionQuestionEqualsToken,ts.SyntaxKind.InKeyword,ts.SyntaxKind.InstanceOfKeyword]);
function tsShape(node){
 const head=[ts.SyntaxKind[node.kind]];
 if(!ts.isSourceFile(node)&&typeof node.text==='string')head.push(node.text);
 if(ts.isVariableDeclarationList(node))head.push(node.flags&(ts.NodeFlags.Let|ts.NodeFlags.Const|ts.NodeFlags.Using|ts.NodeFlags.AwaitUsing));
 if(ts.isPrefixUnaryExpression(node)||ts.isPostfixUnaryExpression(node))head.push(node.operator);
 const children=[];
 ts.forEachChild(node,child=>{children.push(tsShape(child));},list=>{
  const items=list.map(tsShape),free=list===node.statements||list===node.members&&!ts.isEnumDeclaration(node);
  children.push(JSON.stringify(free?items.sort():items));
 });
 return JSON.stringify([head,children]);
}
const erased=node=>ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)||!!ts.canHaveModifiers(node)&&!!ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.DeclareKeyword);
function tsHasEffect(node){
 if(erased(node))return false;
 if(ts.isFunctionDeclaration(node))return !node.body;
 if(ts.isCallExpression(node)||ts.isNewExpression(node)||ts.isPrefixUnaryExpression(node)&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator)||ts.isPostfixUnaryExpression(node)||ts.isDeleteExpression(node)||ts.isAwaitExpression(node)||ts.isYieldExpression(node)||ts.isThrowStatement(node)||ts.isReturnStatement(node)||ts.isBreakOrContinueStatement(node)||ts.isTaggedTemplateExpression(node)||ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)||ts.isSpreadElement(node)||ts.isSpreadAssignment(node)||ts.isObjectBindingPattern(node)||ts.isArrayBindingPattern(node)||ts.isIterationStatement(node,false)||ts.isWithStatement(node)||ts.isDebuggerStatement(node)||ts.isEnumDeclaration(node)||ts.isModuleDeclaration(node)||ts.isDecorator(node)||ts.isClassStaticBlockDeclaration(node))return true;
 if(ts.isBinaryExpression(node)&&assignment.has(node.operatorToken.kind))return true;
 if(ts.isIdentifier(node)&&node.text==='eval')return true;
 if(tsFunction(node)&&!ts.isFunctionDeclaration(node))return false;
 if(ts.isClassLike(node))return node.heritageClauses?.some(clause=>clause.types.some(type=>tsHasEffect(type.expression)))||node.members.some(member=>member.name&&ts.isComputedPropertyName(member.name)&&tsHasEffect(member.name.expression)||ts.isPropertyDeclaration(member)&&!!member.initializer&&!!ts.getModifiers(member)?.some(m=>m.kind===ts.SyntaxKind.StaticKeyword)||ts.isClassStaticBlockDeclaration(member));
 return !!ts.forEachChild(node,child=>tsHasEffect(child)||undefined);
}
function tsLists(file){
 const lists=[];
 const visit=node=>{
  if(ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node))lists.push({items:[...node.statements],hoisting:ts.isSourceFile(node)||ts.isModuleBlock(node)||tsFunction(node.parent)});
  ts.forEachChild(node,visit);
 };
 visit(file);return lists;
}
const tsPositionFree=(statement,hoisting)=>erased(statement)||hoisting&&ts.isFunctionDeclaration(statement)&&!!statement.body;

/* ------------------------------- shared policy ------------------------------- */
function effectPairs(lists,key,hasEffect,positionFree){
 const pairs=[];
 for(const {items,hoisting} of lists)for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j];
  if(positionFree(a,hoisting)||positionFree(b,hoisting))continue;
  if(hasEffect(a)||hasEffect(b))pairs.push(key(a)+'\u0000'+key(b));
 }
 return JSON.stringify(pairs.sort());
}
function analyse(code,language){
 if(language==='typescript'){
  const file=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(file.parseDiagnostics.length)return null;
  return {shape:tsShape(file),effects:effectPairs(tsLists(file),tsShape,tsHasEffect,tsPositionFree)};
 }
 let tree;try{tree=parseScript(code,{ecmaVersion:'latest',sourceType:'script'});}catch{return null;}
 return {shape:jsShape(tree),effects:effectPairs(jsLists(tree),node=>jsShape(node),jsHasEffect,jsPositionFree)};
}
function execute(code,{language,probe,strict=true,asynchronous=false}){
 const attempt=(js,timeout)=>{
  const context=createContext({trace:[]},asynchronous?{microtaskMode:'afterEvaluate'}:{});
  const tail=asynchronous
   ?`;var __result='pending';Promise.resolve(${probe}).then(value=>{__result=JSON.stringify({value,trace});},error=>{__result='throws:'+(error&&error.name)+':'+(error&&error.message);});`
   :`;var __result=JSON.stringify({value:(${probe}),trace});`;
  try{new Script((strict?'"use strict";\n':'')+'function record(...args) { trace.push(args); }\n'+js+'\n'+tail,{filename:'fixed-oracle-fixture.js'}).runInContext(context,{timeout});return String(context.__result);}
  catch(error){if(error?.code==='ERR_SCRIPT_EXECUTION_TIMEOUT')return 'timeout';return 'throws:'+error?.name+':'+error?.message;}
 };
 const run=js=>{let result='timeout';for(const timeout of TIMEOUTS_MS){result=attempt(js,timeout);if(result!=='timeout')break;}return result;};
 if(language!=='typescript')return run(code);
 const outputs=[];
 for(const define of [false,true]){
  const output=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,useDefineForClassFields:define}});
  if(output.diagnostics?.length)return 'syntax';
  outputs.push(run(output.outputText));
 }
 return outputs.join(' | ');
}

/** Returns judge(lines) → {ok: true|false|null, reason}. ok=null means undecided. */
export function createOracle(fixture){
 const source=Array.isArray(fixture.source)?fixture.source.join('\n'):fixture.source;
 const reference=analyse(source,fixture.language),baseline=execute(source,fixture);
 if(!reference)throw Error(`oracle fixture ${fixture.id} does not parse`);
 if(/^throws:|timeout|syntax/.test(baseline))throw Error(`oracle fixture ${fixture.id} reference fails: ${baseline}`);
 const cache=new Map();
 return lines=>{
  const code=lines.join('\n');
  if(cache.has(code))return cache.get(code);
  let verdict;const candidate=analyse(code,fixture.language);
  if(!candidate)verdict={ok:false,reason:'syntax'};
  else if(candidate.shape!==reference.shape)verdict={ok:false,reason:'scope'};
  else if(candidate.effects!==reference.effects)verdict={ok:false,reason:'effect-order'};
  else{const observed=execute(code,fixture);verdict=observed===baseline?{ok:true,reason:'equivalent'}:observed.includes('timeout')?{ok:null,reason:'timeout'}:{ok:false,reason:'runtime'};}
  cache.set(code,verdict);return verdict;
 };
}

/* --------------------------- arrangement utilities --------------------------- */
/** Mulberry32: tiny deterministic PRNG for reproducible property tests. */
export function random(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export const codesOf=(model,order)=>order.map(id=>model.lines.find(line=>line.id===id).code);
/** Every distinct single-row move and pair swap of the reference order. */
export function neighbourhood(reference){
 const orders=new Map(),add=order=>orders.set(order.join(','),order);
 for(const id of reference)for(let at=0;at<reference.length;at++){const rest=reference.filter(x=>x!==id);add([...rest.slice(0,at),id,...rest.slice(at)]);}
 for(let i=0;i<reference.length;i++)for(let j=i+1;j<reference.length;j++)add(reference.map((id,k)=>k===i?reference[j]:k===j?reference[i]:id));
 orders.delete(reference.join(','));return [...orders.values()];
}
/** Topological orders of a CodeLine v2 model honouring dependencies, edges,
 * scope nesting and fixed slots. `rng` randomises; `limit` bounds the search. */
export function extensions(model,{limit=Infinity,rng=null}={}){
 const lines=model.lines,openers=new Map(model.blocks.map(b=>[b.openLineId,b.id])),closers=new Map(model.blocks.map(b=>[b.closeLineId,b.id]));
 const before=new Map(lines.map(line=>[line.id,new Set(line.dependencies)]));for(const edge of model.edges??[])before.get(edge.after).add(edge.before);
 const pinned=new Map(lines.flatMap((line,i)=>line.fixed?[[i,line.id]]:[]));
 const results=[],placed=new Set(),sequence=[],stack=[];
 (function extend(){
  if(results.length>=limit)return;
  if(sequence.length===lines.length){if(!stack.length)results.push([...sequence]);return;}
  const candidates=rng?[...lines].sort(()=>rng()-0.5):lines;
  for(const line of candidates){
   if(results.length>=limit)return;
   if(placed.has(line.id)||[...before.get(line.id)].some(id=>!placed.has(id)))continue;
   if(line.fixed?lines.indexOf(line)!==sequence.length:pinned.has(sequence.length))continue;
   const close=closers.get(line.id);if(close!==undefined&&stack.at(-1)!==close)continue;
   if(close!==undefined)stack.pop();
   if((stack.at(-1)??null)===line.scopeId){const open=openers.get(line.id);if(open!==undefined)stack.push(open);placed.add(line.id);sequence.push(line.id);extend();sequence.pop();placed.delete(line.id);if(open!==undefined)stack.pop();}
   if(close!==undefined)stack.push(close);
  }
 })();
 return results;
}
/** Greedy delta reduction: move displaced rows back while `failing` stays true. */
export function shrink(reference,order,failing){
 let current=order,changed=true;
 while(changed){
  changed=false;
  for(const id of reference){
   const rest=current.filter(x=>x!==id),anchor=reference.slice(0,reference.indexOf(id)).filter(x=>rest.includes(x)).at(-1);
   const candidate=[...rest];candidate.splice(anchor===undefined?0:rest.indexOf(anchor)+1,0,id);
   if(candidate.join(',')!==current.join(',')&&failing(candidate)){current=candidate;changed=true;}
  }
 }
 return current;
}
