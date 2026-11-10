/** Independent pedagogical-policy oracle for FIXED, bounded test fixtures only.
 *
 * It never sees learner input and is deliberately implemented apart from the
 * author generator: JavaScript is parsed with Acorn, TypeScript with a separate
 * shape/effect walk over the compiler AST. Verdict for a candidate row order:
 *   P0 syntax     – the arrangement parses (TS: overload signatures adjacent);
 *   P1 scope      – every statement/member stays in the same lexical list
 *                   (statement and member lists compared as multisets);
 *   P2 effects    – in each statement list, the relative order of every pair
 *                   with at least one external evaluation-time effect is
 *                   unchanged, unless one side is position-free (hoisted
 *                   function or erased type declaration); a write of a
 *                   function-local let/var/parameter with an effect-free right
 *                   side is a local effect, ordered only against statements
 *                   that read or write the same name (RAW/WAR/WAW, ADR-013);
 *                   in a function-level list an effect-free statement may
 *                   cross an external one that cannot observe it (ADR-019,
 *                   by name: see commutation()); two local object
 *                   operations (ADR-025, see jsObjectOperations()) are not
 *                   ordered here, and one beside a statement without external
 *                   effect only by name conflicts: P3 compares the runtime
 *                   result;
 *   P3 runtime    – value, thrown exception and record() trace agree with the
 *                   reference on the fixture probe (TS: both class-field modes).
 * A fixture with `inputs: 'valid'` (ADR-050) assumes valid plain-data inputs: a
 * property read, a spread and a call of a listed built-in are then a read
 * effect (see readWorld()): ordered against external statements only, apart
 * from name conflicts.
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
/* Shapes are injective encodings compared for equality. Only the atoms are JSON-escaped and the
 * nesting is written around already encoded children, so the length grows linearly with the
 * tree; re-escaping every level grew it exponentially with depth. */
/* v54 (ADR-128): the properties of an object literal are a free list here too, like statements and class
   members; what their order changes (evaluation, key order) is left to P2 and the P3 run, which compares
   key order unless the fixture ignores it (P4). */
function jsShape(value,key=''){
 if(Array.isArray(value)){const items=value.map(item=>jsShape(item));return '['+(key==='body'||key==='object-properties'?items.sort():items).join(',')+']';}
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([name])=>!['start','end','raw','loc','range'].includes(name)).map(([name,item])=>JSON.stringify(name)+':'+jsShape(item,value.type==='ObjectExpression'&&name==='properties'?'object-properties':name)).join(',')+'}';
 return typeof value==='bigint'?value+'n':JSON.stringify(value)??'null';
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
const jsScope=new Set(['BlockStatement','StaticBlock','ForStatement','ForInStatement','ForOfStatement','CatchClause']);
/** Statement lists with their scope chain: the enclosing function (or Program) first. */
function jsLists(tree){
 const lists=[];
 const visit=(node,functionLevel,chain)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,false,chain));return;}
  const scopes=jsFunction.has(node.type)||node.type==='Program'?[node]:jsScope.has(node.type)?[...chain,node]:chain;
  if((node.type==='Program'||node.type==='BlockStatement'||node.type==='StaticBlock')&&Array.isArray(node.body))lists.push({items:node.body,hoisting:node.type==='Program'||functionLevel,chain:scopes});
  for(const [key,value] of Object.entries(node))if(value&&typeof value==='object')visit(value,jsFunction.has(node.type)&&key==='body',scopes);
 };
 visit(tree,false,[]);return lists;
}
/* P2 local writes (ADR-013). Bindings are keyed by name inside one function:
 * shadowing can only merge two bindings, which reports more conflicts (the safe
 * direction), never fewer. Independent of the generator's TypeScript checker. */
function jsPatternNames(pattern,out){if(!pattern)return out;if(pattern.type==='Identifier')out.push(pattern.name);else if(pattern.type==='ObjectPattern')pattern.properties.forEach(p=>jsPatternNames(p.type==='RestElement'?p.argument:p.value,out));else if(pattern.type==='ArrayPattern')pattern.elements.forEach(e=>jsPatternNames(e,out));else if(pattern.type==='RestElement')jsPatternNames(pattern.argument,out);else if(pattern.type==='AssignmentPattern')jsPatternNames(pattern.left,out);return out;}
const jsWritable=declaration=>declaration?.type==='VariableDeclaration'&&declaration.kind!=='const'?declaration.declarations.flatMap(d=>jsPatternNames(d.id,[])):[];
function jsVarNames(fn){const names=new Set();const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node!==fn&&jsFunction.has(node.type))return;if(node.type==='VariableDeclaration'&&node.kind==='var')jsWritable(node).forEach(n=>names.add(n));for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);};visit(fn.body);return names;}
function jsDeclares(scope,name){
 if(jsFunction.has(scope.type))return scope.params.some(p=>jsPatternNames(p,[]).includes(name))||jsVarNames(scope).has(name);
 if(Array.isArray(scope.body))return scope.body.some(statement=>jsWritable(statement).includes(name));
 if(scope.type==='ForStatement')return jsWritable(scope.init).includes(name);
 if(scope.type==='ForInStatement'||scope.type==='ForOfStatement')return jsWritable(scope.left).includes(name);
 if(scope.type==='CatchClause')return jsPatternNames(scope.param,[]).includes(name);
 return false;
}
/** {external, reads, writes, heap}: external = an effect outside function-local bindings;
 * heap (ADR-050, `world` given) = it reads object state without running code. */
function jsClassify(statement,chain,world=null){
 let external=false,heap=false;const reads=new Set(),writes=new Set();
 const local=(name,scopes)=>scopes[0]?.type!=='Program'&&scopes.some(scope=>jsDeclares(scope,name));
 const visit=(node,scopes)=>{
  if(!node||typeof node!=='object'||external)return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,scopes));return;}
  if(jsFunction.has(node.type))return;
  if(node.type==='AssignmentExpression'){if(node.operator==='='&&node.left.type==='Identifier'&&local(node.left.name,scopes)){writes.add(node.left.name);visit(node.right,scopes);}else external=true;return;}
  if(node.type==='ClassDeclaration'||node.type==='ClassExpression'){if(jsHasEffect(node)){external=true;return;}if(node.type==='ClassDeclaration')writes.add(node.id.name);visit(node.superClass,scopes);return;}
  if(world){const parts=jsRead(node,world);if(parts){heap=true;parts.forEach(part=>visit(part,scopes));return;}}
  if(jsEffect.has(node.type)||node.type==='UnaryExpression'&&node.operator==='delete'||node.type==='BinaryExpression'&&['in','instanceof'].includes(node.operator)||node.type==='Identifier'&&node.name==='eval'){external=true;return;}
  if(node.type==='VariableDeclarator'){if(node.id.type!=='Identifier'){external=true;return;}writes.add(node.id.name);visit(node.init,scopes);return;}
  if(node.type==='Identifier'){reads.add(node.name);return;}
  if(node.type==='Property'){if(node.computed)visit(node.key,scopes);visit(node.value,scopes);return;}
  if(node.type==='LabeledStatement'){visit(node.body,scopes);return;}
  const inner=jsScope.has(node.type)?[...scopes,node]:scopes;
  for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value,inner);
 };
 visit(statement,chain);
 return {external,reads,writes,heap};
}
/* ADR-050: the `valid` input contract. Outside values are valid plain data, so reading a property,
 * spreading, and calling a listed built-in run no code and cannot throw, unless the program itself
 * supplies the code: an accessor of that name, a generator to spread, a method of that name, or a
 * hook that changes property access (then the contract does not apply at all). */
const contractHooks=/\bProxy\b|\bReflect\b|defineProperty|defineProperties|setPrototypeOf|__proto__|__define[GS]etter__|\.prototype\b|\bSymbol\.|\beval\b|\bFunction\b|\bwith\s*\(/;
const builtinFunctions=new Set(['Number','String','Boolean','parseInt','parseFloat','isNaN','isFinite']);
const builtinStatics={Math:['abs','ceil','floor','round','trunc','sign','sqrt','cbrt','pow','max','min','hypot','log','log2','log10','exp'],Number:['isInteger','isFinite','isNaN','isSafeInteger','parseInt','parseFloat'],Object:['keys','values','entries'],Array:['isArray','from']};
/* v51 (ADR-099): array methods that call a callback on each element and write nothing; reduce only with an initial value. */
const callbackMethods=new Set(['map','filter','some','every','find','findIndex','findLast','findLastIndex','flatMap','reduce','reduceRight']);
const callbackCount=(name,count)=>name.startsWith('reduce')?count===2:count===1;
const builtinMethods=new Set(['join','slice','indexOf','lastIndexOf','includes','at','concat','flat','charAt','charCodeAt','codePointAt','startsWith','endsWith','trim','trimStart','trimEnd','toUpperCase','toLowerCase','padStart','padEnd','repeat','split','substring','toFixed','has','get']);
/** The program facts the contract depends on, or null when it does not apply. */
function readWorld(code,language,inputs){
 // v54 (NY-34): a hook counts only in code that runs, read here from the TypeScript emit without comments (the
 // generator blanks comments and type syntax in the source instead: two independent ways to one answer).
 if(inputs!=='valid'||contractHooks.test(ts.transpileModule(code,{fileName:language==='typescript'?'world.ts':'world.js',compilerOptions:{removeComments:true,target:ts.ScriptTarget.ES2022}}).outputText))return null;
 const world={accessors:new Set(),defined:new Set(),declared:new Set(),generators:false};let computed=false;
 const key=node=>node&&(node.type==='Identifier'||node.type==='PrivateIdentifier'?node.name:node.type==='Literal'?String(node.value):null);
 if(language==='typescript'){
  const file=ts.createSourceFile('world.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const name=node=>node&&(ts.isIdentifier(node)||ts.isPrivateIdentifier(node)||ts.isStringLiteral(node)||ts.isNumericLiteral(node))?node.text:null;
  const visit=node=>{
   if(ts.isGetAccessorDeclaration(node)||ts.isSetAccessorDeclaration(node)||ts.isPropertyDeclaration(node)&&ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.AccessorKeyword)){const n=name(node.name);if(n===null)computed=true;else world.accessors.add(n);}
   if(ts.isClassElement(node)||ts.isObjectLiteralElementLike(node)||ts.isTypeElement(node)){const n=name(node.name);if(n!==null)world.defined.add(n);}
   if(ts.isBinaryExpression(node)&&ts.isPropertyAccessExpression(node.left))world.defined.add(node.left.name.text);
   if((ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isMethodDeclaration(node))&&node.asteriskToken)world.generators=true;
   if((ts.isVariableDeclaration(node)||ts.isParameter(node)||ts.isBindingElement(node)||ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node)||ts.isImportSpecifier(node)||ts.isImportClause(node)||ts.isEnumDeclaration(node)||ts.isModuleDeclaration(node))&&node.name&&ts.isIdentifier(node.name))world.declared.add(node.name.text);
   ts.forEachChild(node,visit);
  };
  visit(file);
 }else{
  let tree;try{tree=parseScript(code,{ecmaVersion:'latest',sourceType:'script'});}catch{return null;}
  const visit=node=>{
   if(!node||typeof node!=='object')return;
   if(Array.isArray(node)){node.forEach(visit);return;}
   if((node.type==='Property'||node.type==='MethodDefinition')&&['get','set'].includes(node.kind)){const n=node.computed?null:key(node.key);if(n===null)computed=true;else world.accessors.add(n);}
   if(['Property','MethodDefinition','PropertyDefinition'].includes(node.type)&&!node.computed&&key(node.key)!==null)world.defined.add(key(node.key));
   if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&!node.left.computed)world.defined.add(key(node.left.property));
   if((jsFunction.has(node.type)||node.type==='MethodDefinition'&&node.value)&&(node.generator||node.value?.generator))world.generators=true;
   for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);
  };
  visit(tree);
  for(const ref of jsRefs(tree))if(ref.write&&ref.kind)world.declared.add(ref.name);
 }
 return computed?null:world;
}
/** ADR-050: the parts to visit when `node` is a read effect under `world` (Acorn), else null. */
function jsRead(node,world){
 const global=callee=>callee.type==='Identifier'&&!world.declared.has(callee.name);
 if(node.type==='MemberExpression'&&node.object.type!=='Super'&&(node.computed?!world.accessors.size:!world.accessors.has(node.property.name)))return node.computed?[node.object,node.property]:[node.object];
 if(node.type==='SpreadElement'&&!world.generators&&!world.accessors.size)return [node.argument];
 // v51 (ADR-099): a for...of over valid plain data runs the built-in iterator; its body is judged as it is.
 if(node.type==='ForOfStatement'&&!node.await&&!world.generators&&!world.accessors.size&&node.left.type==='VariableDeclaration'&&node.left.kind!=='var'&&node.left.declarations.length===1&&node.left.declarations[0].id.type==='Identifier'&&!node.left.declarations[0].init)return [node.right,node.body];
 if(node.type==='CallExpression'&&!node.optional){
  const callee=node.callee,spread=node.arguments.some(argument=>argument.type==='SpreadElement');
  // v51 (ADR-099): a built-in function's arguments may spread valid plain data.
  if(global(callee)&&builtinFunctions.has(callee.name))return spread&&world.generators?null:node.arguments;
  if(callee.type!=='MemberExpression'||callee.computed||callee.optional)return null;
  const name=callee.property.name;
  if(global(callee.object)&&builtinStatics[callee.object.name]?.includes(name))return callee.object.name==='Array'&&(name==='from'&&node.arguments.length!==1||world.generators)||spread&&world.generators?null:node.arguments;
  if(spread)return null;
  // v51 (ADR-099): a callback method with a concise arrow: the arrow's body is visited as part of the call.
  const callback=node.arguments[0];
  if(callbackMethods.has(name)&&!world.defined.has(name)&&callbackCount(name,node.arguments.length)&&callback?.type==='ArrowFunctionExpression'&&!callback.async&&callback.expression&&callback.params.every(param=>param.type==='Identifier'))return [callee.object,callback.body,...node.arguments.slice(1)];
  return builtinMethods.has(name)&&!world.defined.has(name)?[callee.object,...node.arguments]:null;
 }
 if(node.type==='NewExpression'&&global(node.callee)&&['Set','Map'].includes(node.callee.name)&&node.arguments.length<=1&&!world.generators&&node.arguments.every(argument=>argument.type!=='SpreadElement'))return node.arguments;
 return null;
}
/** The TypeScript counterpart of jsRead. */
function tsRead(node,world){
 const global=callee=>ts.isIdentifier(callee)&&!world.declared.has(callee.text);
 if(ts.isPropertyAccessExpression(node)&&node.expression.kind!==ts.SyntaxKind.SuperKeyword&&!world.accessors.has(node.name.text))return [node.expression];
 if(ts.isElementAccessExpression(node)&&node.expression.kind!==ts.SyntaxKind.SuperKeyword&&!world.accessors.size)return [node.expression,node.argumentExpression];
 if((ts.isSpreadElement(node)||ts.isSpreadAssignment(node))&&!world.generators&&!world.accessors.size)return [node.expression];
 // v51 (ADR-099): the counterpart of jsRead's for...of.
 if(ts.isForOfStatement(node)&&!node.awaitModifier&&!world.generators&&!world.accessors.size&&ts.isVariableDeclarationList(node.initializer)&&(node.initializer.flags&ts.NodeFlags.BlockScoped)!==0&&node.initializer.declarations.length===1&&ts.isIdentifier(node.initializer.declarations[0].name)&&!node.initializer.declarations[0].initializer)return [node.expression,node.statement];
 if(ts.isCallExpression(node)&&!node.questionDotToken){
  const callee=node.expression,spread=node.arguments.some(argument=>ts.isSpreadElement(argument));
  if(global(callee)&&builtinFunctions.has(callee.text))return spread&&world.generators?null:[...node.arguments];
  if(!ts.isPropertyAccessExpression(callee)||callee.questionDotToken)return null;
  const name=callee.name.text;
  if(global(callee.expression)&&builtinStatics[callee.expression.text]?.includes(name))return callee.expression.text==='Array'&&(name==='from'&&node.arguments.length!==1||world.generators)||spread&&world.generators?null:[...node.arguments];
  if(spread)return null;
  const callback=node.arguments[0];
  if(callbackMethods.has(name)&&!world.defined.has(name)&&callbackCount(name,node.arguments.length)&&callback&&ts.isArrowFunction(callback)&&!callback.modifiers?.length&&!ts.isBlock(callback.body)&&callback.parameters.every(param=>ts.isIdentifier(param.name)&&!param.initializer&&!param.dotDotDotToken))return [callee.expression,callback.body,...node.arguments.slice(1)];
  return builtinMethods.has(name)&&!world.defined.has(name)?[callee.expression,...node.arguments]:null;
 }
 if(ts.isNewExpression(node)&&global(node.expression)&&['Set','Map'].includes(node.expression.text)&&(node.arguments??[]).length<=1&&!world.generators&&(node.arguments??[]).every(argument=>!ts.isSpreadElement(argument)))return [...(node.arguments??[])];
 return null;
}
const jsPositionFree=(statement,hoisting)=>hoisting&&statement.type==='FunctionDeclaration';
/* P2 pure/effect commutation (ADR-019), by name: shadowing only merges bindings,
 * which forbids more commutations (the safe direction). In a function-level list a
 * statement without external effect and an external one commute when the external
 * one never leaves itself early (return, throw, yield, await, outward jump), the
 * function uses neither `arguments` nor `eval`, every name the statement writes is a
 * let/const/class it declares itself, used by no nested function and not at all by
 * the external statement, and every name it reads is declared at the function's
 * level, written by no nested function and not by the external statement. */
function jsRefs(root){
 const out=[];
 const visit=(node,nested,target,kind)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,nested,target,kind));return;}
  switch(node.type){
   case 'Identifier':out.push({name:node.name,write:target,kind,nested,at:node.start});return;
   case 'FunctionDeclaration':case 'FunctionExpression':case 'ArrowFunctionExpression':{
    if(node!==root&&node.id)visit(node.id,node.type==='FunctionDeclaration'?nested:true,true,'function');
    const level=node===root?nested:true;visit(node.params,level,true,'param');visit(node.body,level,false,null);return;}
   case 'ClassDeclaration':case 'ClassExpression':visit(node.id,node.type==='ClassDeclaration'?nested:true,true,'class');visit(node.superClass,nested,false,null);visit(node.body,nested,false,null);return;
   case 'MethodDefinition':if(node.computed)visit(node.key,nested,false,null);visit(node.value,nested,false,null);return;
   case 'PropertyDefinition':if(node.computed)visit(node.key,nested,false,null);visit(node.value,true,false,null);return;
   case 'StaticBlock':visit(node.body,true,false,null);return;
   case 'VariableDeclaration':node.declarations.forEach(d=>{visit(d.id,nested,true,node.kind);visit(d.init,nested,false,null);});return;
   case 'AssignmentExpression':visit(node.left,nested,true,null);visit(node.right,nested,false,null);return;
   case 'UpdateExpression':visit(node.argument,nested,true,null);return;
   case 'ForInStatement':case 'ForOfStatement':visit(node.left,nested,true,null);visit(node.right,nested,false,null);visit(node.body,nested,false,null);return;
   case 'CatchClause':visit(node.param,nested,true,'catch');visit(node.body,nested,false,null);return;
   case 'AssignmentPattern':visit(node.left,nested,target,kind);visit(node.right,nested,false,null);return;
   case 'ArrayPattern':visit(node.elements,nested,target,kind);return;
   case 'ObjectPattern':visit(node.properties,nested,target,kind);return;
   case 'RestElement':visit(node.argument,nested,target,kind);return;
   case 'Property':if(node.computed)visit(node.key,nested,false,null);visit(node.value,nested,target,kind);return;
   case 'MemberExpression':visit(node.object,nested,false,null);if(node.computed)visit(node.property,nested,false,null);return;
   case 'LabeledStatement':visit(node.body,nested,false,null);return;
   case 'BreakStatement':case 'ContinueStatement':case 'MetaProperty':return;
  }
  for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value,nested,false,null);
 };
 visit(root,false,false,null);return out;
}
const jsLoop=new Set(['ForStatement','ForInStatement','ForOfStatement','WhileStatement','DoWhileStatement']);
function jsTransfers(root){
 let found=false;
 const visit=(node,targets)=>{
  if(found||!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,targets));return;}
  if(jsFunction.has(node.type)||node.type==='ClassDeclaration'||node.type==='ClassExpression')return;
  if(['ReturnStatement','ThrowStatement','YieldExpression','AwaitExpression'].includes(node.type)||node.type==='ForOfStatement'&&node.await){found=true;return;}
  if(node.type==='BreakStatement'||node.type==='ContinueStatement'){if(!(node.label?targets.labels.includes(node.label.name):targets.loop||node.type==='BreakStatement'&&targets.switch))found=true;return;}
  const next={loop:targets.loop||jsLoop.has(node.type),switch:targets.switch||node.type==='SwitchStatement',labels:node.type==='LabeledStatement'?[...targets.labels,node.label.name]:targets.labels};
  for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value,next);
 };
 visit(root,{loop:false,switch:false,labels:[]});return found;
}
/** The shared commutation decision over name references (jsRefs / tsRefs). */
function commutation(refs,transfers,isFunction,classify){
 return (statement,effect,chain)=>{
  const fn=chain[0];
  if(!fn||!isFunction(fn)||isFunction(statement)||transfers(effect))return false;
  const own=classify(statement,chain);
  // ADR-050: a read effect sees what the external statement may write.
  if(own.external||own.heap)return false;
  const inside=refs(fn),other=refs(effect),mine=refs(statement);
  // A block-level function declaration assigns an outer binding where it stands (Annex B).
  if(inside.some(ref=>ref.name==='arguments'||ref.name==='eval')||mine.some(ref=>ref.kind==='function'&&!ref.nested))return false;
  const declared=new Set(mine.filter(ref=>!ref.nested&&['let','const','class'].includes(ref.kind)).map(ref=>ref.name));
  const local=new Set(inside.filter(ref=>!ref.nested&&ref.kind).map(ref=>ref.name));
  for(const name of own.writes)if(!declared.has(name)||inside.some(ref=>ref.nested&&ref.name===name)||other.some(ref=>ref.name===name))return false;
  for(const name of own.reads)if(!local.has(name)||inside.some(ref=>ref.nested&&ref.write&&ref.name===name)||other.some(ref=>ref.write&&ref.name===name))return false;
  return true;
 };
}
const jsCommutes=world=>commutation(jsRefs,jsTransfers,node=>jsFunction.has(node.type),(statement,chain)=>jsClassify(statement,chain,world));
/* P2 local object operations (ADR-025), by syntax only and apart from the generator's
 * footprints. In a function's statement list, `const X = new C(…)` for a class C declared
 * without `extends` anywhere in the program, or `const X = [ … ]` / `{ … }`, owns X. A
 * statement that is such a declaration, or calls a method of / assigns a property of an owned
 * name with identifier or literal arguments, is a local object operation. */
function jsObjectOperations(program){
 const classes=new Set(),constructors=new Set();
 const collect=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return;}if(node.type==='ClassDeclaration'&&!node.superClass)classes.add(node.id.name);if((node.type==='ClassDeclaration'||node.type==='ClassExpression')&&!node.superClass)for(const member of node.body.body)if(member.type==='MethodDefinition'&&member.kind==='constructor')constructors.add(member.value);for(const value of Object.values(node))if(value&&typeof value==='object')collect(value);};
 collect(program);
 const simple=node=>node.type==='Literal'||node.type==='Identifier';
 return (items,chain)=>{
  if(!chain[0]||!jsFunction.has(chain[0].type))return ()=>false;
  const owned=new Map();
  for(const item of items){
   const declaration=item.type==='VariableDeclaration'&&item.kind==='const'&&item.declarations.length===1?item.declarations[0]:null,init=declaration?.init;
   if(declaration?.id.type==='Identifier'&&init&&(init.type==='NewExpression'&&init.callee.type==='Identifier'&&classes.has(init.callee.name)&&init.arguments.every(simple)||init.type==='ArrayExpression'||init.type==='ObjectExpression'))owned.set(declaration.id.name,item);
  }
  // ADR-031: in the constructor of a class without `extends`, `this` is an own object as well.
  const self=constructors.has(chain[0]);
  // ADR-034: a for…of variable over an own object stands for its elements inside the loop body.
  const aliases=new Set();
  const receiver=node=>node.type==='MemberExpression'&&!node.computed&&(node.object.type==='Identifier'&&(owned.has(node.object.name)||aliases.has(node.object.name))||self&&node.object.type==='ThisExpression');
  // ADR-031: a value built only from simple values and own objects' fields: literals, arrays and
  // objects of them, arithmetic and comparisons. Its effects stay on own objects, so P3 sees them.
  // ADR-046: a property chain read from an own object (a.log.length) is a value too, as for the generator.
  const path=node=>receiver(node)||node.type==='MemberExpression'&&!node.computed&&path(node.object);
  const value=node=>simple(node)||path(node)||node.type==='TemplateLiteral'&&node.expressions.every(value)||node.type==='ArrayExpression'&&node.elements.every(element=>element&&element.type!=='SpreadElement'&&value(element))
   ||node.type==='ObjectExpression'&&node.properties.every(property=>property.type==='Property'&&!property.computed&&property.kind==='init'&&!property.method&&value(property.value))
   ||node.type==='UnaryExpression'&&node.operator!=='delete'&&value(node.argument)||node.type==='BinaryExpression'&&value(node.left)&&value(node.right);
  const thrown=item=>item.type==='ThrowStatement'&&item.argument.type==='NewExpression'&&item.argument.callee.type==='Identifier'&&['Error','TypeError','RangeError'].includes(item.argument.callee.name)&&item.argument.arguments.every(value);
  // ADR-042: a labelled jump may name an enclosing label of the same operation.
  const labels=new Set();
  const jump=item=>(item.type==='BreakStatement'||item.type==='ContinueStatement')&&(!item.label||labels.has(item.label.name));
  // ADR-046: a loop's own head variables may be written in its body, like the generator's locals;
  // ADR-048: so may the list's own let/var bindings.
  const locals=new Set(items.flatMap(item=>item.type==='VariableDeclaration'&&item.kind!=='const'?item.declarations.flatMap(d=>d.id.type==='Identifier'?[d.id.name]:[]):[]));
  const local=item=>item.type==='ExpressionStatement'&&(item.expression.type==='AssignmentExpression'&&['=','+=','-=','*=','/=','%='].includes(item.expression.operator)&&item.expression.left.type==='Identifier'&&locals.has(item.expression.left.name)&&value(item.expression.right)||item.expression.type==='UpdateExpression'&&item.expression.argument.type==='Identifier'&&locals.has(item.expression.argument.name));
  const body=branch=>!branch||branch.type==='BlockStatement'&&branch.body.every(statement=>statement.type!=='VariableDeclaration'&&(operation(statement)||thrown(statement)||jump(statement)||local(statement)));
  const operation=item=>{
   if(item.type==='VariableDeclaration')return [...owned.values()].includes(item);
   // ADR-042: a labelled operation is the operation it labels.
   if(item.type==='LabeledStatement'){if(labels.has(item.label.name))return false;labels.add(item.label.name);const ok=operation(item.body);labels.delete(item.label.name);return ok;}
   // ADR-028/034: an if/else (if) chain whose tests and branches only operate on own objects (or throw).
   if(item.type==='IfStatement')return value(item.test)&&body(item.consequent)&&(!item.alternate||(item.alternate.type==='IfStatement'?operation(item.alternate):body(item.alternate)));
   // ADR-034: switch, try/catch/finally and for…of over an own object, built the same way.
   if(item.type==='SwitchStatement')return value(item.discriminant)&&item.cases.every(clause=>(!clause.test||value(clause.test))&&clause.consequent.every(statement=>operation(statement)||thrown(statement)||jump(statement)));
   if(item.type==='TryStatement')return body(item.block)&&(!item.handler||body(item.handler.body))&&body(item.finalizer);
   // ADR-046: while, do…while and a for with a let head and a counter step, built the same way.
   if(item.type==='WhileStatement'||item.type==='DoWhileStatement')return value(item.test)&&body(item.body);
   if(item.type==='ForStatement'){
    const head=!item.init||item.init.type==='VariableDeclaration'&&item.init.kind==='let'&&item.init.declarations.every(d=>d.id.type==='Identifier'&&(!d.init||value(d.init)));
    const step=!item.update||item.update.type==='UpdateExpression'&&item.update.argument.type==='Identifier';
    if(!head||!step)return false;
    const names=(item.init?.declarations??[]).map(d=>d.id.name).filter(name=>!locals.has(name));names.forEach(name=>locals.add(name));
    const ok=(!item.test||value(item.test))&&body(item.body);names.forEach(name=>locals.delete(name));return ok;
   }
   if(item.type==='ForOfStatement'){
    // ADR-070: also over an array literal of values; its variable may stand for any own object.
    const iterated=item.right.type==='Identifier'&&owned.has(item.right.name)||item.right.type==='ArrayExpression'&&value(item.right);
    if(item.await||!iterated||item.left.type!=='VariableDeclaration'||item.left.declarations.length!==1||item.left.declarations[0].id.type!=='Identifier')return false;
    const name=item.left.declarations[0].id.name;aliases.add(name);const ok=body(item.body);aliases.delete(name);return ok;
   }
   const expression=item.type==='ExpressionStatement'?item.expression:null;
   if(expression?.type==='CallExpression')return receiver(expression.callee)&&expression.arguments.every(value);
   // ADR-064: a compound assignment or ++/-- of an own object's field is an operation too.
   if(expression?.type==='UpdateExpression')return receiver(expression.argument);
   return expression?.type==='AssignmentExpression'&&['=','+=','-=','*=','/=','%='].includes(expression.operator)&&receiver(expression.left)&&value(expression.right);
  };
  return operation;
 };
}

/* ------------------------- TypeScript (compiler AST walk) -------------------- */
const tsFunction=node=>ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node)||ts.isMethodDeclaration(node)||ts.isConstructorDeclaration(node)||ts.isGetAccessorDeclaration(node)||ts.isSetAccessorDeclaration(node);
const assignment=new Set([ts.SyntaxKind.EqualsToken,ts.SyntaxKind.PlusEqualsToken,ts.SyntaxKind.MinusEqualsToken,ts.SyntaxKind.AsteriskEqualsToken,ts.SyntaxKind.AsteriskAsteriskEqualsToken,ts.SyntaxKind.SlashEqualsToken,ts.SyntaxKind.PercentEqualsToken,ts.SyntaxKind.LessThanLessThanEqualsToken,ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,ts.SyntaxKind.AmpersandEqualsToken,ts.SyntaxKind.BarEqualsToken,ts.SyntaxKind.CaretEqualsToken,ts.SyntaxKind.AmpersandAmpersandEqualsToken,ts.SyntaxKind.BarBarEqualsToken,ts.SyntaxKind.QuestionQuestionEqualsToken,ts.SyntaxKind.InKeyword,ts.SyntaxKind.InstanceOfKeyword]);
/** `(head,child…)` with a JSON head; a node list is `[node,…]`. Linear in the tree, like jsShape. */
function tsShape(node){
 const head=[ts.SyntaxKind[node.kind]];
 if(!ts.isSourceFile(node)&&typeof node.text==='string')head.push(node.text);
 if(ts.isVariableDeclarationList(node))head.push(node.flags&(ts.NodeFlags.Let|ts.NodeFlags.Const|ts.NodeFlags.Using|ts.NodeFlags.AwaitUsing));
 if(ts.isPrefixUnaryExpression(node)||ts.isPostfixUnaryExpression(node))head.push(node.operator);
 const parts=[JSON.stringify(head)];
 ts.forEachChild(node,child=>{parts.push(tsShape(child));},list=>{
  const items=list.map(tsShape),free=list===node.statements||list===node.members&&!ts.isEnumDeclaration(node)||ts.isObjectLiteralExpression(node)&&list===node.properties;
  parts.push('['+(free?items.sort():items).join(',')+']');
 });
 return '('+parts.join(',')+')';
}
const erased=node=>ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)||!!ts.canHaveModifiers(node)&&!!ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.DeclareKeyword);
/** An effect of this node itself (children aside); assignments are classified separately. */
const tsDirectEffect=node=>ts.isCallExpression(node)||ts.isNewExpression(node)||ts.isPrefixUnaryExpression(node)&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator)||ts.isPostfixUnaryExpression(node)||ts.isDeleteExpression(node)||ts.isAwaitExpression(node)||ts.isYieldExpression(node)||ts.isThrowStatement(node)||ts.isReturnStatement(node)||ts.isBreakOrContinueStatement(node)||ts.isTaggedTemplateExpression(node)||ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)||ts.isSpreadElement(node)||ts.isSpreadAssignment(node)||ts.isObjectBindingPattern(node)||ts.isArrayBindingPattern(node)||ts.isIterationStatement(node,false)||ts.isWithStatement(node)||ts.isDebuggerStatement(node)||ts.isEnumDeclaration(node)||ts.isModuleDeclaration(node)||ts.isDecorator(node)||ts.isClassStaticBlockDeclaration(node)||ts.isIdentifier(node)&&node.text==='eval';
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
const tsScope=node=>ts.isBlock(node)||ts.isForStatement(node)||ts.isForInStatement(node)||ts.isForOfStatement(node)||ts.isCatchClause(node);
/** Statement lists with their scope chain: the enclosing function, file or namespace body first. */
function tsLists(file){
 const lists=[];
 const visit=(node,chain)=>{
  const scopes=tsFunction(node)||ts.isSourceFile(node)||ts.isModuleBlock(node)||ts.isClassStaticBlockDeclaration(node)?[node]:tsScope(node)?[...chain,node]:chain;
  if(ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node))lists.push({items:[...node.statements],hoisting:ts.isSourceFile(node)||ts.isModuleBlock(node)||tsFunction(node.parent),chain:scopes});
  ts.forEachChild(node,child=>visit(child,scopes));
 };
 visit(file,[]);return lists;
}
const tsBindingNames=(name,out)=>{if(ts.isIdentifier(name))out.push(name.text);else name.elements.forEach(e=>{if(!ts.isOmittedExpression(e))tsBindingNames(e.name,out);});return out;};
const tsWritable=list=>!!list&&ts.isVariableDeclarationList(list)&&[0,ts.NodeFlags.Let].includes(list.flags&ts.NodeFlags.BlockScoped)?list.declarations.flatMap(d=>tsBindingNames(d.name,[])):[];
function tsVarNames(fn){const names=new Set();const visit=node=>{if(node!==fn&&tsFunction(node))return;if(ts.isVariableDeclarationList(node)&&!(node.flags&ts.NodeFlags.BlockScoped))tsWritable(node).forEach(n=>names.add(n));ts.forEachChild(node,visit);};if(fn.body)visit(fn.body);return names;}
function tsDeclares(scope,name){
 if(tsFunction(scope))return scope.parameters.some(p=>tsBindingNames(p.name,[]).includes(name))||tsVarNames(scope).has(name);
 if(ts.isBlock(scope))return scope.statements.some(statement=>ts.isVariableStatement(statement)&&tsWritable(statement.declarationList).includes(name));
 if(ts.isForStatement(scope))return tsWritable(scope.initializer).includes(name);
 if(ts.isForInStatement(scope)||ts.isForOfStatement(scope))return tsWritable(scope.initializer).includes(name);
 if(ts.isCatchClause(scope))return !!scope.variableDeclaration&&tsBindingNames(scope.variableDeclaration.name,[]).includes(name);
 return false;
}
/** {external, reads, writes} over the TS AST; types are not reads. Same policy as jsClassify. */
function tsClassify(statement,chain,world=null){
 let external=false,heap=false;const reads=new Set(),writes=new Set();
 const local=(name,scopes)=>!!scopes[0]&&tsFunction(scopes[0])&&scopes.some(scope=>tsDeclares(scope,name));
 const visit=(node,scopes)=>{
  if(external||ts.isTypeNode(node)||erased(node))return;
  if(ts.isFunctionDeclaration(node)&&!node.body){external=true;return;}
  if(tsFunction(node))return;
  if(ts.isBinaryExpression(node)&&assignment.has(node.operatorToken.kind)){if(node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isIdentifier(node.left)&&local(node.left.text,scopes)){writes.add(node.left.text);visit(node.right,scopes);}else external=true;return;}
  if(ts.isClassLike(node)){if(tsHasEffect(node)){external=true;return;}if(ts.isClassDeclaration(node)&&node.name)writes.add(node.name.text);node.heritageClauses?.forEach(clause=>clause.types.forEach(type=>visit(type.expression,scopes)));return;}
  if(world){const parts=tsRead(node,world);if(parts){heap=true;parts.forEach(part=>visit(part,scopes));return;}}
  if(tsDirectEffect(node)){external=true;return;}
  if(ts.isVariableDeclaration(node)){if(!ts.isIdentifier(node.name)){external=true;return;}writes.add(node.name.text);if(node.initializer)visit(node.initializer,scopes);return;}
  if(ts.isIdentifier(node)){reads.add(node.text);return;}
  if(ts.isPropertyAssignment(node)){if(ts.isComputedPropertyName(node.name))visit(node.name.expression,scopes);visit(node.initializer,scopes);return;}
  if(ts.isShorthandPropertyAssignment(node)){reads.add(node.name.text);return;}
  if(ts.isLabeledStatement(node)){visit(node.statement,scopes);return;}
  const inner=tsScope(node)?[...scopes,node]:scopes;
  ts.forEachChild(node,child=>{visit(child,inner);});
 };
 visit(statement,chain);
 return {external,reads,writes,heap};
}
const tsPositionFree=(statement,hoisting)=>erased(statement)||hoisting&&ts.isFunctionDeclaration(statement)&&!!statement.body;
/** The TypeScript counterpart of jsObjectOperations (ADR-025). */
function tsObjectOperations(file){
 const classes=new Set();
 const collect=node=>{if(ts.isClassDeclaration(node)&&node.name&&!node.heritageClauses?.some(clause=>clause.token===ts.SyntaxKind.ExtendsKeyword))classes.add(node.name.text);ts.forEachChild(node,collect);};
 collect(file);
 const simple=node=>ts.isIdentifier(node)||ts.isStringLiteral(node)||ts.isNumericLiteral(node)||[ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(node.kind);
 return (items,chain)=>{
  if(!chain[0]||!tsFunction(chain[0]))return ()=>false;
  const owned=new Map();
  for(const item of items){
   const list=ts.isVariableStatement(item)&&(item.declarationList.flags&ts.NodeFlags.BlockScoped)===ts.NodeFlags.Const?item.declarationList.declarations:[],declaration=list.length===1?list[0]:null,init=declaration?.initializer;
   if(declaration&&ts.isIdentifier(declaration.name)&&init&&(ts.isNewExpression(init)&&ts.isIdentifier(init.expression)&&classes.has(init.expression.text)&&(init.arguments??[]).every(simple)||ts.isArrayLiteralExpression(init)||ts.isObjectLiteralExpression(init)))owned.set(declaration.name.text,item);
  }
  // ADR-031: in the constructor of a class without `extends`, `this` is an own object as well.
  const self=ts.isConstructorDeclaration(chain[0])&&!chain[0].parent.heritageClauses?.some(clause=>clause.token===ts.SyntaxKind.ExtendsKeyword);
  // ADR-034: a for…of variable over an own object stands for its elements inside the loop body.
  const aliases=new Set();
  const receiver=node=>ts.isPropertyAccessExpression(node)&&(ts.isIdentifier(node.expression)&&(owned.has(node.expression.text)||aliases.has(node.expression.text))||self&&node.expression.kind===ts.SyntaxKind.ThisKeyword);
  // ADR-031: a value built only from simple values and own objects' fields: literals, arrays and
  // objects of them, arithmetic and comparisons. Its effects stay on own objects, so P3 sees them.
  const path=node=>receiver(node)||ts.isPropertyAccessExpression(node)&&path(node.expression);
  const value=node=>simple(node)||path(node)||ts.isParenthesizedExpression(node)&&value(node.expression)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateExpression(node)&&node.templateSpans.every(span=>value(span.expression))
   ||ts.isArrayLiteralExpression(node)&&node.elements.every(value)||ts.isObjectLiteralExpression(node)&&node.properties.every(property=>ts.isPropertyAssignment(property)&&(ts.isIdentifier(property.name)||ts.isStringLiteral(property.name))&&value(property.initializer))
   ||ts.isPrefixUnaryExpression(node)&&value(node.operand)||ts.isBinaryExpression(node)&&!assignment.has(node.operatorToken.kind)&&value(node.left)&&value(node.right);
  const thrown=item=>ts.isThrowStatement(item)&&ts.isNewExpression(item.expression)&&ts.isIdentifier(item.expression.expression)&&['Error','TypeError','RangeError'].includes(item.expression.expression.text)&&(item.expression.arguments??[]).every(value);
  const labels=new Set();
  const jump=item=>(ts.isBreakStatement(item)||ts.isContinueStatement(item))&&(!item.label||labels.has(item.label.text));
  const locals=new Set(items.flatMap(item=>ts.isVariableStatement(item)&&!(item.declarationList.flags&ts.NodeFlags.Const)?item.declarationList.declarations.flatMap(d=>ts.isIdentifier(d.name)?[d.name.text]:[]):[]));
  const local=item=>{if(!ts.isExpressionStatement(item))return false;const e=item.expression;return ts.isBinaryExpression(e)&&[ts.SyntaxKind.EqualsToken,ts.SyntaxKind.PlusEqualsToken,ts.SyntaxKind.MinusEqualsToken,ts.SyntaxKind.AsteriskEqualsToken,ts.SyntaxKind.SlashEqualsToken,ts.SyntaxKind.PercentEqualsToken].includes(e.operatorToken.kind)&&ts.isIdentifier(e.left)&&locals.has(e.left.text)&&value(e.right)||(ts.isPostfixUnaryExpression(e)||ts.isPrefixUnaryExpression(e))&&ts.isIdentifier(e.operand)&&locals.has(e.operand.text);};
  const body=branch=>!branch||ts.isBlock(branch)&&branch.statements.every(statement=>!ts.isVariableStatement(statement)&&(operation(statement)||thrown(statement)||jump(statement)||local(statement)));
  const operation=item=>{
   if(ts.isVariableStatement(item))return [...owned.values()].includes(item);
   if(ts.isLabeledStatement(item)){if(labels.has(item.label.text))return false;labels.add(item.label.text);const ok=operation(item.statement);labels.delete(item.label.text);return ok;}
   // ADR-028/034: an if/else (if) chain whose tests and branches only operate on own objects (or throw).
   if(ts.isIfStatement(item))return value(item.expression)&&body(item.thenStatement)&&(!item.elseStatement||(ts.isIfStatement(item.elseStatement)?operation(item.elseStatement):body(item.elseStatement)));
   // ADR-034: switch, try/catch/finally and for…of over an own object, built the same way.
   if(ts.isSwitchStatement(item))return value(item.expression)&&item.caseBlock.clauses.every(clause=>(!ts.isCaseClause(clause)||value(clause.expression))&&clause.statements.every(statement=>operation(statement)||thrown(statement)||jump(statement)));
   if(ts.isTryStatement(item))return body(item.tryBlock)&&(!item.catchClause||body(item.catchClause.block))&&body(item.finallyBlock);
   if(ts.isWhileStatement(item)||ts.isDoStatement(item))return value(item.expression)&&body(item.statement);
   if(ts.isForStatement(item)){
    const init=item.initializer,head=!init||ts.isVariableDeclarationList(init)&&(init.flags&ts.NodeFlags.Let)!==0&&init.declarations.every(d=>ts.isIdentifier(d.name)&&(!d.initializer||value(d.initializer)));
    const update=item.incrementor,step=!update||(ts.isPostfixUnaryExpression(update)||ts.isPrefixUnaryExpression(update))&&ts.isIdentifier(update.operand);
    if(!head||!step)return false;
    const names=(init?init.declarations:[]).map(d=>d.name.text).filter(name=>!locals.has(name));names.forEach(name=>locals.add(name));
    const ok=(!item.condition||value(item.condition))&&body(item.statement);names.forEach(name=>locals.delete(name));return ok;
   }
   if(ts.isForOfStatement(item)){
    const head=item.initializer;
    // ADR-070: also over an array literal of values; its variable may stand for any own object.
    const iterated=ts.isIdentifier(item.expression)&&owned.has(item.expression.text)||ts.isArrayLiteralExpression(item.expression)&&value(item.expression);
    if(item.awaitModifier||!iterated||!ts.isVariableDeclarationList(head)||head.declarations.length!==1||!ts.isIdentifier(head.declarations[0].name))return false;
    const name=head.declarations[0].name.text;aliases.add(name);const ok=body(item.statement);aliases.delete(name);return ok;
   }
   const expression=ts.isExpressionStatement(item)?item.expression:null;
   if(expression&&ts.isCallExpression(expression))return receiver(expression.expression)&&expression.arguments.every(value);
   // ADR-064: a compound assignment or ++/-- of an own object's field is an operation too.
   if(expression&&(ts.isPrefixUnaryExpression(expression)||ts.isPostfixUnaryExpression(expression))&&(expression.operator===ts.SyntaxKind.PlusPlusToken||expression.operator===ts.SyntaxKind.MinusMinusToken))return receiver(expression.operand);
   return !!expression&&ts.isBinaryExpression(expression)&&[ts.SyntaxKind.EqualsToken,ts.SyntaxKind.PlusEqualsToken,ts.SyntaxKind.MinusEqualsToken,ts.SyntaxKind.AsteriskEqualsToken,ts.SyntaxKind.SlashEqualsToken,ts.SyntaxKind.PercentEqualsToken].includes(expression.operatorToken.kind)&&receiver(expression.left)&&value(expression.right);
  };
  return operation;
 };
}
/** tsRefs: name references as in jsRefs, over the TypeScript AST; types are not references. */
function tsRefs(root){
 const out=[],S=ts.SyntaxKind;
 const visit=(node,nested,target,kind)=>{
  if(!node||ts.isTypeNode(node)||erased(node))return;
  if(ts.isIdentifier(node)){out.push({name:node.text,write:target,kind,nested,at:node.getStart()});return;}
  if(tsFunction(node)){
   if(node!==root&&node.name&&ts.isIdentifier(node.name)&&(ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)))visit(node.name,ts.isFunctionDeclaration(node)?nested:true,true,'function');
   if(node.name&&ts.isComputedPropertyName(node.name))visit(node.name.expression,nested,false,null);
   const level=node===root?nested:true;node.parameters.forEach(p=>visit(p,level,true,'param'));visit(node.body,level,false,null);return;
  }
  if(ts.isParameter(node)){visit(node.name,nested,target,kind);visit(node.initializer,nested,false,null);return;}
  if(ts.isClassLike(node)){
   if(node.name)visit(node.name,ts.isClassDeclaration(node)?nested:true,true,'class');
   node.heritageClauses?.forEach(clause=>clause.types.forEach(type=>visit(type.expression,nested,false,null)));
   node.members.forEach(member=>{
    if(member.name&&ts.isComputedPropertyName(member.name))visit(member.name.expression,nested,false,null);
    if(ts.isPropertyDeclaration(member))visit(member.initializer,true,false,null);
    else if(ts.isClassStaticBlockDeclaration(member))visit(member.body,true,false,null);
    else if(tsFunction(member))visit(member,nested,false,null);
   });
   return;
  }
  if(ts.isVariableDeclarationList(node)){const flags=node.flags&ts.NodeFlags.BlockScoped,declared=flags===ts.NodeFlags.Const?'const':flags===ts.NodeFlags.Let?'let':flags?'using':'var';node.declarations.forEach(d=>{visit(d.name,nested,true,declared);visit(d.initializer,nested,false,null);});return;}
  if(ts.isBinaryExpression(node)&&assignment.has(node.operatorToken.kind)&&node.operatorToken.kind!==S.InKeyword&&node.operatorToken.kind!==S.InstanceOfKeyword){visit(node.left,nested,true,null);visit(node.right,nested,false,null);return;}
  if((ts.isPrefixUnaryExpression(node)||ts.isPostfixUnaryExpression(node))&&[S.PlusPlusToken,S.MinusMinusToken].includes(node.operator)){visit(node.operand,nested,true,null);return;}
  if(ts.isForInStatement(node)||ts.isForOfStatement(node)){visit(node.initializer,nested,true,null);visit(node.expression,nested,false,null);visit(node.statement,nested,false,null);return;}
  if(ts.isCatchClause(node)){if(node.variableDeclaration)visit(node.variableDeclaration.name,nested,true,'catch');visit(node.block,nested,false,null);return;}
  if(ts.isBindingElement(node)){if(node.propertyName&&ts.isComputedPropertyName(node.propertyName))visit(node.propertyName.expression,nested,false,null);visit(node.name,nested,target,kind);visit(node.initializer,nested,false,null);return;}
  if(ts.isObjectBindingPattern(node)||ts.isArrayBindingPattern(node)||ts.isArrayLiteralExpression(node)||ts.isObjectLiteralExpression(node)||ts.isSpreadElement(node)||ts.isSpreadAssignment(node)||ts.isParenthesizedExpression(node)||ts.isNonNullExpression(node)||ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isTypeAssertionExpression(node)){ts.forEachChild(node,child=>visit(child,nested,target,kind));return;}
  if(ts.isPropertyAssignment(node)){if(ts.isComputedPropertyName(node.name))visit(node.name.expression,nested,false,null);visit(node.initializer,nested,target,kind);return;}
  if(ts.isShorthandPropertyAssignment(node)){visit(node.name,nested,target,kind);visit(node.objectAssignmentInitializer,nested,false,null);return;}
  if(ts.isPropertyAccessExpression(node)){visit(node.expression,nested,false,null);return;}
  if(ts.isLabeledStatement(node)){visit(node.statement,nested,false,null);return;}
  if(ts.isBreakOrContinueStatement(node))return;
  ts.forEachChild(node,child=>visit(child,nested,false,null));
 };
 visit(root,false,false,null);return out;
}
function tsTransfers(root){
 let found=false;
 const visit=(node,targets)=>{
  if(found||tsFunction(node)||ts.isClassLike(node))return;
  if(ts.isReturnStatement(node)||ts.isThrowStatement(node)||ts.isYieldExpression(node)||ts.isAwaitExpression(node)||ts.isForOfStatement(node)&&!!node.awaitModifier||ts.isVariableDeclarationList(node)&&(node.flags&ts.NodeFlags.Using)!==0){found=true;return;}
  if(ts.isBreakOrContinueStatement(node)){if(!(node.label?targets.labels.includes(node.label.text):targets.loop||ts.isBreakStatement(node)&&targets.switch))found=true;return;}
  const next={loop:targets.loop||ts.isIterationStatement(node,false),switch:targets.switch||ts.isSwitchStatement(node),labels:ts.isLabeledStatement(node)?[...targets.labels,node.label.text]:targets.labels};
  ts.forEachChild(node,child=>visit(child,next));
 };
 visit(root,{loop:false,switch:false,labels:[]});return found;
}
const tsCommutes=world=>commutation(tsRefs,tsTransfers,tsFunction,(statement,chain)=>tsClassify(statement,chain,world));
/** TS2389/TS2391: an overload signature must be directly followed by the next
 * signature or the implementation of the same name. transpileModule does not
 * report this checker error, so P0 tests it explicitly. */
function tsOverloadsAdjacent(file){
 let adjacent=true;
 const name=node=>ts.isConstructorDeclaration(node)?'constructor':node.name?.getText(file);
 const check=items=>items.forEach((item,i)=>{
  const signature=(ts.isFunctionDeclaration(item)||ts.isMethodDeclaration(item)||ts.isConstructorDeclaration(item))&&!item.body&&!ts.getModifiers(item)?.some(m=>m.kind===ts.SyntaxKind.DeclareKeyword||m.kind===ts.SyntaxKind.AbstractKeyword);
  const next=items[i+1];
  if(signature&&(!next||next.kind!==item.kind||name(next)!==name(item)))adjacent=false;
 });
 const visit=node=>{
  if(ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node))check(node.statements);
  if(ts.isClassLike(node)&&!ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.DeclareKeyword))check(node.members);
  ts.forEachChild(node,visit);
 };
 visit(file);return adjacent;
}

/* ------------------------------- shared policy ------------------------------- */
const meets=(x,y)=>[...x].some(v=>y.has(v));
/** Ordered pairs of P2: an external effect on either side, or a RAW/WAR/WAW conflict.
 * `objectOperations(items, chain)` names the list's local object operations (ADR-025). */
function effectPairs(lists,key,classify,positionFree,commutes,objectOperations=()=>()=>false){
 const pairs=[];
 for(const {items,hoisting,chain} of lists){
  const classes=items.map(item=>classify(item,chain)),operation=objectOperations(items,chain);
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
   const a=items[i],b=items[j],ca=classes[i],cb=classes[j];
   if(positionFree(a,hoisting)||positionFree(b,hoisting))continue;
   // ADR-025: the order of two local object operations is judged by P3 alone.
   if(operation(a)&&operation(b))continue;
   // ADR-025 (v12): a local object operation and a statement without external effect (a local
   // write) are ordered only by their name conflicts; P3 judges whether a throw is observed.
   if(operation(a)&&!cb.external||operation(b)&&!ca.external){if(meets(ca.writes,cb.reads)||meets(ca.writes,cb.writes)||meets(ca.reads,cb.writes))pairs.push(key(a)+'\u0000'+key(b));continue;}
   // ADR-019: an effect-free statement may cross an external one that cannot observe it.
   if(ca.external!==cb.external&&(ca.external?commutes(b,a,chain):commutes(a,b,chain)))continue;
   if(ca.external||cb.external||meets(ca.writes,cb.reads)||meets(ca.writes,cb.writes)||meets(ca.reads,cb.writes))pairs.push(key(a)+'\u0000'+key(b));
  }
 }
 return JSON.stringify(pairs.sort());
}
/* --------------- P4 reflective property order (ADR-010, ADR-020) ---------------
 * OrdinaryOwnPropertyKeys lists array-index keys ascending, then string keys in
 * creation order. ClassDefinitionEvaluation creates `constructor` first, then
 * methods/accessors in source order on the prototype (static ones on the
 * constructor, before static fields); instance fields follow source order
 * (TS parameter properties first); a TS `accessor` field defines its get/set
 * pair among the methods. A script's top-level function and var names become
 * global-object properties; the specification creates functions first, V8
 * interleaves them in source order. For TypeScript they are read from the
 * emitted script, so enums, namespaces and import aliases count exactly when
 * they emit a var. Private names are not reflected.
 * v11 (ADR-020): only enumerable keys keep their order: instance and static
 * fields and var globals. Methods, accessors (non-enumerable on a class) and
 * top-level function declarations compare as a set, as only an explicit
 * Object.getOwnPropertyNames/Reflect.ownKeys or Object.keys(globalThis) could
 * see their creation order. */
const arrayIndex=key=>/^(0|[1-9]\d*)$/.test(key)&&Number(key)<4294967295;
/** v11 (ADR-020): non-enumerable keys (methods, accessors, functions) count as a set;
 * enumerable ones (fields, static fields, vars) keep their creation order. */
const keySet=keys=>[...new Set(keys)].sort();
/** `ordered`: the program itself may list these keys (reflectsKeys), so every creation order counts, as in ADR-010. */
/** `enumerated` (ADR-029): the program may list enumerable keys; otherwise instance fields count as a set too. */
const classOrder=(proto,statics,staticFields,instance,ordered,enumerated=true)=>JSON.stringify(ordered?[firstOccurrences(proto),firstOccurrences([...statics,...staticFields]),firstOccurrences(instance)]:[keySet(proto),keySet(statics),firstOccurrences(staticFields),enumerated?firstOccurrences(instance):keySet(instance)]);
/** ADR-029: a fixture lists enumerable keys itself (key listing, serialisation, copying, printing, for…in, any spread). */
const enumerationNames=/\b(?:keys|values|entries|stringify|assign|structuredClone|console|inspect)\b|\.\.\.|\bfor\s*\([^)]*\bin\b/;
const globalOrder=(globals,functions)=>{const ordered=firstOccurrences(globals).filter(name=>!functions.includes(name));return [ordered,keySet(functions)];};
/** Whether a fixture can list non-enumerable or global keys itself: it names a reflection
 * API or the global object anywhere in its text, or uses `this` at script level. */
const reflectionNames=/\b(?:getOwnPropertyNames|ownKeys|getOwnPropertyDescriptors|Reflect|globalThis|window|self|frames|global|Function|eval)\b/;
function reflectsKeys(code,language){
 if(reflectionNames.test(code))return true;
 let found=false;
 if(language==='typescript'){
  const file=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(ts.isExternalModule(file))return false;
  const visit=node=>{if(found||ts.isClassLike(node)||tsFunction(node)&&!ts.isArrowFunction(node))return;if(node.kind===ts.SyntaxKind.ThisKeyword){found=true;return;}ts.forEachChild(node,visit);};
  visit(file);return found;
 }
 const visit=node=>{
  if(found||!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(visit);return;}
  if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'||node.type==='ClassDeclaration'||node.type==='ClassExpression')return;
  if(node.type==='ThisExpression'){found=true;return;}
  for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value);
 };
 try{visit(parseScript(code,{ecmaVersion:'latest',sourceType:'script'}));}catch{return true;}
 return found;
}
const firstOccurrences=keys=>[...new Set(keys)].filter(key=>!arrayIndex(key));
function jsReflection(tree,ordered=false,enumerated=true){
 const classes=[],globals=[],functions=[],vars=[];
 const keyOf=member=>member.computed?'computed:'+jsShape(member.key):member.key.type==='PrivateIdentifier'?null:member.key.type==='Identifier'?member.key.name:String(member.key.value);
 const patternNames=(pattern,out)=>{if(!pattern)return;if(pattern.type==='Identifier')out.push(pattern.name);else if(pattern.type==='ObjectPattern')pattern.properties.forEach(p=>patternNames(p.type==='RestElement'?p.argument:p.value,out));else if(pattern.type==='ArrayPattern')pattern.elements.forEach(e=>patternNames(e,out));else if(pattern.type==='RestElement')patternNames(pattern.argument,out);else if(pattern.type==='AssignmentPattern')patternNames(pattern.left,out);};
 const visit=(node,global)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,global));return;}
  if(node.type==='ClassDeclaration'||node.type==='ClassExpression'){
   const proto=[],statics=[],staticFields=[],instance=[];
   for(const member of node.body.body){
    const key=member.type==='StaticBlock'?null:keyOf(member);if(key===null)continue;
    if(member.type==='MethodDefinition'&&member.kind!=='constructor')(member.static?statics:proto).push(key);
    if(member.type==='PropertyDefinition')(member.static?staticFields:instance).push(key);
   }
   classes.push(classOrder(proto,statics,staticFields,instance,ordered,enumerated));
  }
  if(global&&node.type==='VariableDeclaration'&&node.kind==='var')node.declarations.forEach(d=>{patternNames(d.id,globals);patternNames(d.id,vars);});
  if(global&&node.type==='FunctionDeclaration'){globals.push(node.id.name);functions.push(node.id.name);}
  const inner=global&&!jsFunction.has(node.type);
  for(const [key,value] of Object.entries(node))if(value&&typeof value==='object')visit(value,inner&&!(node.type==='ClassBody'));
 };
 visit(tree,true);
 // A name that is also a var keeps its place among the ordered globals.
 const functionsOnly=ordered?[]:firstOccurrences(functions).filter(name=>!vars.includes(name));
 return {order:JSON.stringify([classes.sort(),globalOrder(globals,functionsOnly)]),classNames:tree.body.filter(s=>s.type==='ClassDeclaration').map(s=>s.id.name),globals:firstOccurrences(globals),functions:functionsOnly,ordered,enumerated};
}
function tsReflection(file,{globals=[],functions=[]}={},ordered=false,enumerated=true){
 const classes=[];
 const has=(node,kind)=>!!ts.canHaveModifiers(node)&&!!ts.getModifiers(node)?.some(m=>m.kind===kind);
 const keyOf=name=>!name||ts.isPrivateIdentifier(name)?null:ts.isComputedPropertyName(name)?'computed:'+tsShape(name.expression):ts.isNumericLiteral(name)?String(Number(name.text)):name.text;
 const visit=node=>{
  if(ts.isClassLike(node)&&!has(node,ts.SyntaxKind.DeclareKeyword)){
   const proto=[],statics=[],staticFields=[],instance=[],parameters=[];
   for(const member of node.members){
    if(has(member,ts.SyntaxKind.AbstractKeyword)||has(member,ts.SyntaxKind.DeclareKeyword))continue;
    if(ts.isConstructorDeclaration(member)&&member.body)for(const p of member.parameters)if(ts.getModifiers(p)?.length&&ts.isIdentifier(p.name))parameters.push(p.name.text);
    const key=keyOf(member.name);if(key===null)continue;
    const isStatic=has(member,ts.SyntaxKind.StaticKeyword);
    if((ts.isMethodDeclaration(member)||ts.isGetAccessorDeclaration(member)||ts.isSetAccessorDeclaration(member))&&member.body||ts.isPropertyDeclaration(member)&&has(member,ts.SyntaxKind.AccessorKeyword))(isStatic?statics:proto).push(key);
    else if(ts.isPropertyDeclaration(member))(isStatic?staticFields:instance).push(key);
   }
   classes.push(classOrder(proto,statics,staticFields,[...parameters,...instance],ordered,enumerated));
  }
  ts.forEachChild(node,visit);
 };
 visit(file);
 return {order:JSON.stringify([classes.sort(),globalOrder(globals,functions)]),classNames:file.statements.flatMap(s=>ts.isClassDeclaration(s)&&s.name&&!has(s,ts.SyntaxKind.DeclareKeyword)?[s.name.text]:[]),globals:firstOccurrences(globals),functions,ordered,enumerated};
}

/** Class declarations below the top level, keyed by their enclosing named
 * declarations; the runtime snapshot reaches them through a registration
 * statement inserted right after each declaration (`end`: source offset). */
function nestedClasses(code,language){
 const found=[];
 if(language==='typescript'){
  const file=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const visit=(node,path)=>{
   if(ts.isClassDeclaration(node)&&node.name&&!ts.isSourceFile(node.parent)&&!ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.DeclareKeyword))found.push({key:[...path,node.name.text].join('/'),name:node.name.text,end:node.end});
   const named=(tsFunction(node)||ts.isClassLike(node)||ts.isModuleDeclaration(node))&&node.name&&!ts.isComputedPropertyName(node.name)?node.name.getText(file):ts.isConstructorDeclaration(node)?'constructor':null;
   ts.forEachChild(node,child=>visit(child,named?[...path,named]:path));
  };
  ts.forEachChild(file,child=>visit(child,[]));
  return found;
 }
 const visit=(node,path,top)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,path,top));return;}
  if(node.type==='ClassDeclaration'&&!top)found.push({key:[...path,node.id.name].join('/'),name:node.id.name,end:node.end});
  const named=(jsFunction.has(node.type)||node.type==='ClassDeclaration'||node.type==='ClassExpression')&&node.id?node.id.name:node.type==='MethodDefinition'&&!node.computed?(node.key.name??String(node.key.value)):null;
  for(const [key,value] of Object.entries(node))if(value&&typeof value==='object'&&key!=='id')visit(value,named?[...path,named]:path,node.type==='Program'&&key==='body');
 };
 try{visit(parseScript(code,{ecmaVersion:'latest',sourceType:'script'}),[],false);}catch{return [];}
 return found;
}
/** ADR-063: the independent JavaScript reading of a TypeScript script. The ES2022 emit with native
 * class fields (useDefineForClassFields), the faithful image of the source, is parsed with Acorn and
 * judged by the JavaScript P1/P2 checks: its shape and its effect-pair order. The [[Set]] mode moves
 * fields into constructor assignments, an emit artefact the JavaScript checks would order without
 * the class-member policy (ADR-012, ADR-029); P3 still runs both modes. The TypeScript AST still
 * decides what the emit erases (types, interfaces, overload signatures, declare). A module keeps the
 * TypeScript reading only ('' here), as its CommonJS emit adds a loader prologue. null: the emit
 * does not parse. */
function emittedAnalysis(code,file,inputs){
 if(ts.isExternalModule(file))return '';
 const parts=[];
 for(const define of [true]){
  const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,useDefineForClassFields:define}}).outputText;
  let tree;try{tree=parseScript(js,{ecmaVersion:'latest',sourceType:'script'});}catch{return null;}
  const world=readWorld(js,'javascript',inputs);
  parts.push(jsShape(tree)+'#'+effectPairs(jsLists(tree),node=>jsShape(node),(statement,chain)=>jsClassify(statement,chain,world),jsPositionFree,jsCommutes(world),jsObjectOperations(tree)));
 }
 return parts.join(' | ');
}
function analyse(code,language,ordered=false,enumerated=true,inputs='any'){
 // ADR-050: the input contract is the reference's; a candidate is judged under the same facts.
 const world=readWorld(code,language,inputs);
 if(language==='typescript'){
  const file=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(file.parseDiagnostics.length||!tsOverloadsAdjacent(file))return null;
  // Global-object properties are what the emitted script declares; a module declares none.
  let globals={};
  if(!ts.isExternalModule(file)){try{globals=jsReflection(parseScript(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{ecmaVersion:'latest',sourceType:'script'}),ordered);}catch{return null;}}
  const emitted=emittedAnalysis(code,file,inputs);
  if(emitted===null)return null;
  return {shape:tsShape(file),effects:effectPairs(tsLists(file),tsShape,(statement,chain)=>tsClassify(statement,chain,world),tsPositionFree,tsCommutes(world),tsObjectOperations(file)),reflection:tsReflection(file,globals,ordered,enumerated),nested:nestedClasses(code,language),emitted};
 }
 let tree;try{tree=parseScript(code,{ecmaVersion:'latest',sourceType:'script'});}catch{return null;}
 return {shape:jsShape(tree),effects:effectPairs(jsLists(tree),node=>jsShape(node),(statement,chain)=>jsClassify(statement,chain,world),jsPositionFree,jsCommutes(world),jsObjectOperations(tree)),reflection:jsReflection(tree,ordered,enumerated),nested:nestedClasses(code,language)};
}
/** Runs a fixed fixture. `call`: probe value, exception and record() trace.
 * `reflection`: own keys and descriptor kinds of the top-level classes'
 * prototypes and constructors, and the declared global-object properties
 * (names come from the reference analysis), read right after evaluation.
 * `nested` (from this code's own analysis) registers the nested classes; their
 * snapshots are sorted by key, as declaration order is not itself observable. */
/** ADR-055: with key order `ignored`, every key listing the program can call returns its keys in a
 * fixed canonical order (array indices ascending, then names sorted, then symbols), so the creation
 * order is unobservable by construction; values and presence still show. for…in iterates the same
 * canonical order (ADR-062, canonicalForIn). */
const canonicalKeys=`(()=>{const index=k=>typeof k==='string'&&/^(0|[1-9]\\d*)$/.test(k)&&Number(k)<4294967295;const order=list=>[...list.filter(index),...list.filter(k=>typeof k==='string'&&!index(k)).sort(),...list.filter(k=>typeof k==='symbol')];const ownKeys=Reflect.ownKeys,keys=Object.keys,names=Object.getOwnPropertyNames,stringify=JSON.stringify;Reflect.ownKeys=o=>order(ownKeys(o));Object.getOwnPropertyNames=o=>order(names(o));Object.keys=o=>order(keys(o));Object.values=o=>Object.keys(o).map(k=>o[k]);Object.entries=o=>Object.keys(o).map(k=>[k,o[k]]);JSON.stringify=(v,r,s)=>typeof r==='function'||Array.isArray(r)?stringify(v,r,s):stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).map(n=>[n,x[n]])):x,s);`
 // for…in (rewritten to for…of over __forIn, see canonicalForIn): enumerable string keys, own first, then each prototype, every level in the canonical order.
 +`const proto=Object.getPrototypeOf,describe=Object.getOwnPropertyDescriptor;globalThis.__forIn=o=>{const out=[],seen=new Set();if(o===null||o===undefined)return out;for(let p=Object(o);p!==null;p=proto(p))for(const k of order(ownKeys(p))){if(typeof k!=='string'||seen.has(k))continue;seen.add(k);if(describe(p,k).enumerable)out.push(k);}return out;};})();\n`;
/** ADR-062: with key order ignored, every for…in of the script iterates __forIn(object), the keys a
 * for…in would visit in the canonical order. The keys are taken when the loop starts: a key added
 * or deleted during the loop is not followed (the specification leaves that order open anyway). */
function canonicalForIn(js){
 let tree;try{tree=parseScript(js,{ecmaVersion:'latest',sourceType:'script'});}catch{return js;}
 const loops=[];
 const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==='ForInStatement')loops.push(node);for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value);};
 visit(tree);
 for(const loop of loops.sort((a,b)=>b.right.start-a.right.start)){
  const between=js.slice(loop.left.end,loop.right.start),at=between.search(/\bin\b/);
  js=js.slice(0,loop.left.end)+between.slice(0,at)+'of'+between.slice(at+2)+'__forIn('+js.slice(loop.right.start,loop.right.end)+')'+js.slice(loop.right.end);
 }
 return js;
}
/** Independent reach witness (ADR-058): which key-listing, reflection and hook APIs the program
 * actually calls while it runs, however their names are spelled. The oracle's textual rules
 * (enumerationNames, reflectionNames, contractHooks) mirror the generator's; this run-time record
 * shares nothing with the generator's name and escape analysis (ADR-052/053). Each API is
 * replaced by a Proxy that forwards unchanged (name, length, prototype and statics included)
 * and marks `__reach` while `__reach.on`; the harness turns it off around its own snapshot and
 * serialisation. `eval` is wrapped only when the text does not name it, as a wrapped eval is
 * no longer a direct eval. Not seen: for…in and spread (text), and a call only a candidate makes
 * (judge() checks the candidate's own record). */
const reached=record=>({enumerates:!!record.enumerates,reflects:!!record.reflects,hooks:!!record.hooks});
const reachWitness=wrapEval=>`(()=>{const apply=Reflect.apply,construct=Reflect.construct,define=Object.defineProperty,describe=Object.getOwnPropertyDescriptor,P=Proxy;`
 +`const E=Error,frames=()=>{const prepare=E.prepareStackTrace;E.prepareStackTrace=(_,sites)=>sites;try{return new E().stack;}finally{E.prepareStackTrace=prepare;}};`
 // The first frame of this script past the preludes is the caller: only the program's own rows count, not the probe's.
 +`const mine=()=>{for(const site of frames()){if(site.getFileName()!=='fixed-oracle-fixture.js')continue;const line=site.getLineNumber();if(line<__reach.from)continue;return line<=__reach.to;}return false;};`
 +`const mark=kinds=>{if(__reach.on&&kinds.some(kind=>!__reach[kind])&&mine())for(const kind of kinds)__reach[kind]=true;};`
 +`const watch=(fn,kinds)=>{const p=new P(fn,{apply(t,self,args){mark(kinds);return apply(t,self,args);},construct(t,args,target){mark(kinds);return construct(t,args,target===p?t:target);}});return p;};`
 +`const swap=(owner,key,kinds)=>{const d=describe(owner,key);if(d&&typeof d.value==='function')define(owner,key,{...d,value:watch(d.value,kinds)});};`
 +`for(const key of ['keys','values','entries','assign'])swap(Object,key,['enumerates']);swap(JSON,'stringify',['enumerates']);if(typeof structuredClone==='function')swap(globalThis,'structuredClone',['enumerates']);`
 +`for(const key of ['getOwnPropertyNames','getOwnPropertyDescriptors','getOwnPropertySymbols'])swap(Object,key,['reflects']);`
 +`for(const key of Reflect.ownKeys(Reflect))if(typeof Reflect[key]==='function')swap(Reflect,key,['reflects','hooks']);`
 +`for(const key of ['defineProperty','defineProperties','setPrototypeOf'])swap(Object,key,['hooks']);`
 +`const create=Object.create;Object.create=new P(create,{apply(t,self,args){if(args.length>1&&args[1]!==undefined)mark(['hooks']);return apply(t,self,args);}});`
 +`for(const key of ['__defineGetter__','__defineSetter__'])swap(Object.prototype,key,['hooks']);`
 +`const proto=describe(Object.prototype,'__proto__');if(proto&&proto.set)define(Object.prototype,'__proto__',{...proto,set:new P(proto.set,{apply(t,self,args){mark(['hooks']);return apply(t,self,args);}})});`
 +`globalThis.Proxy=watch(P,['hooks']);`
 +`const F=Function,fnKinds=['reflects','hooks'];const FW=watch(F,fnKinds);globalThis.Function=FW;define(F.prototype,'constructor',{...describe(F.prototype,'constructor'),value:FW});`
 +`for(const sample of [async function(){},function*(){},async function*(){}]){const p=Object.getPrototypeOf(sample),c=p.constructor;define(p,'constructor',{...describe(p,'constructor'),value:watch(c,fnKinds)});}`
 +(wrapEval?`globalThis.eval=watch(eval,fnKinds);`:'')
 +`const S=Symbol;globalThis.Symbol=new P(S,{get(t,key,self){const v=Reflect.get(t,key);if(typeof v==='symbol')mark(['hooks']);return v;}});`
 +`})();\n`;
/** ADR-081: the `hostile` environment's external code, the adversary of the default `any` input
 * contract for a script's globals. After recording, `record` replaces every primitive top-level
 * variable of the program with an object that converts back to the same value and, whenever it is
 * converted, records the values of all of them: external code may write a script's globals (they share
 * one global environment), and a conversion then runs external code that observes the order of the
 * program's other writes. The realm itself stays untampered, as the contract assumes (no earlier
 * script redefines built-ins or the program's global names). Modules keep their bindings to themselves:
 * there `record` only records. */
function hostileRecord(js){
 const names=[];
 if(!/^\s*(import|export)\b/m.test(js)){
  const file=ts.createSourceFile('hostile.js',js,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  for(const statement of file.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name)&&!names.includes(declaration.name.text))names.push(declaration.name.text);
 }
 const key=JSON.stringify;
 const snapshot=names.map(name=>`try{s[${key(name)}]=typeof ${name}==='object'||typeof ${name}==='function'?'<object>':${name};}catch(e){s[${key(name)}]='<uninitialised>';}`).join('');
 const replace=names.map(name=>`try{if(typeof ${name}==='number'||typeof ${name}==='string'||typeof ${name}==='boolean')${name}=__watch(${key(name)},${name});}catch(e){}`).join('');
 return `function __globals() { const s = {}; ${snapshot} return s; }\nfunction __watch(name, value) { const seen = () => { trace.push(['converts', name, __globals()]); return value; }; return {valueOf: seen, toString: () => String(seen())}; }\nfunction record(...args) { trace.push(args); ${replace} }\n`;
}
function execute(code,{language,probe,strict:strictMode=true,environment='strict',asynchronous=false,keyOrder='observed',classFields='either',hit=()=>{}},{classNames=[],globals=[],functions=[],ordered=false,enumerated=true}={},nested=[]){
 // ADR-062: `sloppy` runs the script without strict mode; `es2015` runs the emit of an ES2015 target.
 // ADR-081: `hostile` runs it with external code that writes its globals.
 const strict=strictMode&&environment!=='sloppy',target=environment==='es2015'?ts.ScriptTarget.ES2015:ts.ScriptTarget.ES2022;
 for(const {key,name,end} of [...nested].sort((a,b)=>b.end-a.end))code=code.slice(0,end)+`;__classes.push([${JSON.stringify(key)}, ${name}]);`+code.slice(end);
 const keys=`const keys=o=>Reflect.ownKeys(o).map(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return [String(k),'get' in d||'set' in d?'accessor':'value',d.enumerable,d.configurable,d.writable===undefined?null:d.writable];}),own=o=>{const all=keys(o);if(${ordered})return all;return [...all.filter(k=>!k[2]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),...all.filter(k=>k[2])];};`;
 const reflect=`;__reach.on=false;var __reflection=(()=>{try{${keys}`
  +`return JSON.stringify({classes:[${classNames.map(name=>`typeof ${name}==='function'?[own(${name}.prototype),own(${name})]:null`).join(',')}],globals:Object.getOwnPropertyNames(globalThis).filter(k=>${JSON.stringify(globals.filter(name=>!functions.includes(name)))}.includes(k)),functions:Object.getOwnPropertyNames(globalThis).filter(k=>${JSON.stringify(functions)}.includes(k)).sort()});}catch(error){return 'throws:'+(error&&error.name);}})();`;
 // Nested classes exist only once the probe ran: snapshot them afterwards.
 const nestedSnapshot=`(()=>{try{${keys}return JSON.stringify(__classes.map(([k,c])=>JSON.stringify([k,own(c.prototype),own(c)])).sort());}catch(error){return 'throws:'+(error&&error.name);}})()`;
 const attempt=(js,timeout)=>{
  const prefix=(strict?'"use strict";\n':'')+(environment==='hostile'?hostileRecord(js):'function record(...args) { trace.push(args); }\n')+(keyOrder==='ignored'?canonicalKeys:'')+reachWitness(!/\beval\b/.test(js)),from=prefix.split('\n').length,reach={on:true,from,to:from+js.split('\n').length-1},context=createContext({trace:[],__classes:[],exports:{},__hit:hit,__reach:reach},asynchronous?{microtaskMode:'afterEvaluate'}:{});
  // ADR-029: unless the program lists enumerable keys itself, an object's key order is not part of the result.
  const replacer=enumerated?'null':`(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(name=>[name,value[name]])):value`;
  const tail=asynchronous
   ?`;var __result='pending',__nested='pending';__reach.on=true;Promise.resolve(${probe}).then(value=>{__reach.on=false;__result=JSON.stringify({value,trace},${replacer});__nested=${nestedSnapshot};},error=>{__result='throws:'+(error&&error.name)+':'+(error&&error.message);});`
   :`;__reach.on=true;var __value=(${probe});__reach.on=false;var __result=JSON.stringify({value:__value,trace},${replacer});var __nested=${nestedSnapshot};`;
  try{new Script(prefix+(keyOrder==='ignored'?canonicalForIn(js):js)+'\n'+reflect+tail,{filename:'fixed-oracle-fixture.js'}).runInContext(context,{timeout});return {call:String(context.__result),reflection:String(context.__reflection)+' nested:'+String(context.__nested),reach:reached(reach)};}
  catch(error){if(error?.code==='ERR_SCRIPT_EXECUTION_TIMEOUT')return {call:'timeout',reflection:'',reach:reached(reach)};return {call:'throws:'+error?.name+':'+error?.message,reflection:'',reach:reached(reach)};}
 };
 const run=js=>{let result={call:'timeout',reflection:''};for(const timeout of TIMEOUTS_MS){result=attempt(js,timeout);if(result.call!=='timeout')break;}return result;};
 if(language!=='typescript'&&environment!=='es2015')return run(code);
 const outputs=[];
 // ADR-075: a `define` fixture runs only the standard [[Define]] class-field mode.
 for(const define of classFields==='define'?[true]:[false,true]){
  const transpile=module=>ts.transpileModule(code,{fileName:language==='typescript'?'fixture.ts':'fixture.js',reportDiagnostics:true,compilerOptions:{target,useDefineForClassFields:define,...language==='typescript'?{}:{allowJs:true},...module?{module:ts.ModuleKind.CommonJS}:{}}});
  let output=transpile(false);
  if(output.diagnostics?.length)return {call:'syntax',reflection:'',reach:reached({})};
  // A module's exports run as a script: CommonJS emit keeps every declaration a script binding.
  if(/^export\b/m.test(output.outputText))output=transpile(true);
  outputs.push(run(output.outputText));
 }
 return {call:outputs.map(o=>o.call).join(' | '),reflection:outputs.map(o=>o.reflection).join(' | '),reach:reached(Object.assign({},...outputs.map(o=>o.reach)))};
}

/** Plan 5.1: a fixture may carry several probes (`probes`), each run in a fresh context; the
 * results are compared probe by probe, and what any run reaches counts (ADR-058). */
function executeAll(code,fixture,reflection,nested){
 const runs=(fixture.environments??['strict']).flatMap(environment=>(fixture.probes??[fixture.probe]).map(probe=>execute(code,{...fixture,environment,probe},reflection,nested)));
 return {call:runs.map(run=>run.call).join(' || '),reflection:runs.map(run=>run.reflection).join(' || '),reach:reached(Object.assign({},...runs.map(run=>run.reach)))};
}

/** ADR-043: the 0-based source rows the reference executes. Every statement of a statement list
 * (not a directive, not a TypeScript declaration without runtime code) is prefixed with
 * `__hit(row)` on its own row, so rows keep their numbers; a row counts as executed when the
 * innermost listed statement covering it ran. Only the fixed reference runs, once. */
function executedRows(code,fixture){
 const statements=[];
 if(fixture.language==='typescript'){
  const file=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const erased=node=>ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)||ts.isFunctionDeclaration(node)&&!node.body||(ts.canHaveModifiers(node)?ts.getModifiers(node)??[]:[]).some(m=>m.kind===ts.SyntaxKind.DeclareKeyword)||ts.isModuleDeclaration(node)||ts.isImportDeclaration(node)||ts.isExportDeclaration(node)||ts.isImportEqualsDeclaration(node);
  const list=items=>{for(const item of items)if(!erased(item)&&!(ts.isExpressionStatement(item)&&ts.isStringLiteral(item.expression)))statements.push([item.getStart(file),item.end]);};
  const visit=node=>{if(ts.isSourceFile(node)||ts.isBlock(node))list(node.statements);else if(ts.isCaseClause(node)||ts.isDefaultClause(node))list(node.statements);ts.forEachChild(node,visit);};
  visit(file);
 }else{
  const visit=node=>{
   if(!node||typeof node!=='object')return;
   if(Array.isArray(node)){node.forEach(visit);return;}
   const items=node.type==='Program'||node.type==='BlockStatement'||node.type==='StaticBlock'?node.body:node.type==='SwitchCase'?node.consequent:null;
   if(items)for(const item of items)if(!item.directive)statements.push([item.start,item.end]);
   for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value);
  };
  visit(parseScript(code,{ecmaVersion:'latest',sourceType:'script'}));
 }
 const starts=[0];for(let i=0;i<code.length;i++)if(code[i]==='\n')starts.push(i+1);
 const rowOf=offset=>{let low=0,high=starts.length-1;while(low<high){const mid=(low+high+1)>>1;if(starts[mid]<=offset)low=mid;else high=mid-1;}return low;};
 const spans=statements.map(([start,end])=>({start,first:rowOf(start),last:rowOf(Math.max(start,end-1))}));
 let instrumented=code;
 for(const {start,first} of [...spans].sort((a,b)=>b.start-a.start))instrumented=instrumented.slice(0,start)+`__hit(${first});`+instrumented.slice(start);
 const hits=new Set();
 for(const probe of fixture.probes??[fixture.probe])execute(instrumented,{...fixture,probe,hit:row=>hits.add(row)});
 const executed=new Set();
 for(let row=0;row<starts.length;row++){
  // The innermost listed statement covering the row decides.
  let owner=null;
  for(const span of spans)if(span.first<=row&&span.last>=row&&(!owner||span.start>=owner.start))owner=span;
  if(!owner||hits.has(owner.first))executed.add(row);
 }
 return executed;
}

/** Returns judge(lines) → {ok: true|false|null, reason}. ok=null means undecided.
 * policy 'reflective' (default, ADR-010) adds P4: reflectable property order
 * (syntactic rule and runtime snapshot) is part of the observable behaviour;
 * reason 'reflection' separates it from a call-level 'runtime' difference.
 * policy 'call-only' is the pre-ADR-010 P0–P3 policy, kept for comparison.
 * `judge.referenceValue` is the probe's value on the reference (the first class-field mode
 * for TypeScript), so a fixture can say whether its own probe caught an exception. */
/** `runtimeOnly` (ADR-080): judge a variant only by its runs, after the syntax and scope checks.
 * For a measurement variant whose original the full oracle already found equivalent: its added
 * calls would otherwise change the static effect analysis, not the question. */
export function createOracle(fixture,{policy='reflective',reach:assumed=null,runtimeOnly=false}={}){
 if(!['reflective','call-only'].includes(policy))throw Error('unknown oracle policy '+policy);
 const source=Array.isArray(fixture.source)?fixture.source.join('\n'):fixture.source;
 // ADR-055: with key order ignored no key list keeps its creation order (P4 compares sets).
 // ADR-058: the textual rules or the reach witness of the reference run; a candidate that reaches
 // more than these facts allow is judged by an oracle that assumes everything reached.
 const observed=fixture.keyOrder!=='ignored',facts=reach=>{
  const ordered=observed&&(reflectsKeys(source,fixture.language)||reach.reflects);
  return {ordered,enumerated:observed&&(ordered||enumerationNames.test(source)||reach.enumerates),inputs:reach.hooks?'any':fixture.inputs??'any'};
 };
 const settle=reach=>{
  const {ordered,enumerated,inputs}=facts(reach),reference=analyse(source,fixture.language,ordered,enumerated,inputs);
  if(!reference)throw Error(`oracle fixture ${fixture.id} does not parse`);
  return {ordered,enumerated,inputs,reference,baseline:executeAll(source,{...fixture,environments:['strict']},reference.reflection,reference.nested)};
 };
 let settled=settle(assumed??{});
 if(!assumed){const first=settled.baseline.reach,again=facts(first);if(again.ordered!==settled.ordered||again.enumerated!==settled.enumerated||again.inputs!==settled.inputs)settled=settle(first);}
 const {ordered,enumerated,inputs,reference}=settled;let {baseline}=settled;
 if(/^throws:|timeout|syntax/.test(baseline.call))throw Error(`oracle fixture ${fixture.id} reference fails: ${baseline.call}`);
 // ADR-062: an environment variant counts where the reference runs in it; sloppy mode only where the
 // reference gives the strict result, as the contract promises strict scripts.
 const environments=['strict'];
 for(const environment of fixture.environments??[]){
  if(environment==='strict')continue;
  // ADR-081: valid plain data (ADR-050) promises external code that writes no hostile values.
  if(environment==='hostile'&&fixture.inputs==='valid')continue;
  const run=executeAll(source,{...fixture,environments:[environment]},reference.reflection,reference.nested);
  if(/^throws:|timeout|syntax/.test(run.call)||run.call.split(/ \|\|? /).some(call=>/^throws:|^syntax|^timeout/.test(call)))continue;
  if(environment==='sloppy'&&run.call!==baseline.call)continue;
  environments.push(environment);
 }
 const runs={...fixture,environments};
 if(environments.length>1)baseline=executeAll(source,runs,reference.reflection,reference.nested);
 const reach=baseline.reach;
 const exceeds=seen=>!!seen&&(seen.reflects&&observed&&!ordered||seen.enumerates&&observed&&!enumerated||seen.hooks&&inputs==='valid');
 let escalated=null;const escalate=()=>escalated??=createOracle(fixture,{policy,runtimeOnly,reach:{reflects:true,enumerates:true,hooks:true}});
 const reflective=policy==='reflective',cache=new Map();
 const judge=lines=>{
  const code=lines.join('\n');
  if(cache.has(code))return cache.get(code);
  let verdict;const candidate=analyse(code,fixture.language,ordered,enumerated,inputs);
  if(!candidate)verdict={ok:false,reason:'syntax'};
  else if(candidate.shape!==reference.shape)verdict={ok:false,reason:'scope'};
  else if(!runtimeOnly&&candidate.effects!==reference.effects)verdict={ok:false,reason:'effect-order'};
  else if(!runtimeOnly&&candidate.emitted!==reference.emitted)verdict={ok:false,reason:'emitted-order'};
  else if(!runtimeOnly&&reflective&&candidate.reflection.order!==reference.reflection.order)verdict={ok:false,reason:'reflection'};
  else{
   const observed=executeAll(code,runs,reference.reflection,candidate.nested);
   verdict=exceeds(observed.reach)?escalate()(lines):observed.call.includes('timeout')?{ok:null,reason:'timeout'}:observed.call!==baseline.call?{ok:false,reason:'runtime'}:reflective&&observed.reflection!==baseline.reflection?{ok:false,reason:'reflection'}:{ok:true,reason:'equivalent'};
  }
  cache.set(code,verdict);return verdict;
 };
 judge.referenceValue=JSON.parse(baseline.call.split(' || ')[0].split(' | ')[0]).value;
 // ADR-058: what the reference run reached, and the facts the verdicts assume.
 judge.reach=reach;judge.facts={ordered,enumerated,inputs};judge.environments=environments;
 // ADR-063: whether a TypeScript fixture is also read through its JavaScript emit.
 judge.emittedReading=!!reference.emitted;
 // ADR-043: computed on first use, as only a rejected equivalent order needs it.
 let executed=null;
 judge.executedRows=()=>executed??=executedRows(source,fixture);
 return judge;
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
/** Every move of one whole unit (a statement or a class member, any number of
 * rows) to another position in its own list. The units come from an AST walk of
 * the model's code, independent of the generator; single-row neighbourhoods
 * cannot express moving a multi-row method or block. Lists whose units share a
 * row are skipped. */
export function blockMoves(model){
 const ids=model.lines.map(line=>line.id),code=model.lines.map(line=>line.code).join('\n');
 const typescript=model.language==='typescript',file=ts.createSourceFile('moves.'+(typescript?'ts':'js'),code,ts.ScriptTarget.Latest,true,typescript?ts.ScriptKind.TS:ts.ScriptKind.JS);
 const row=position=>file.getLineAndCharacterOfPosition(position).line,orders=new Map();
 const visit=node=>{
  const items=ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node)?node.statements:ts.isClassLike(node)?node.members:null;
  if(items&&items.length>1){
   const spans=items.map(item=>[row(item.getStart(file)),row(item.end-1)]);
   if(spans.every((span,i)=>!i||spans[i-1][1]<span[0]))spans.forEach(([first,last],i)=>{
    const moved=ids.slice(first,last+1),rest=ids.filter((_,k)=>k<first||k>last);
    for(let j=0;j<=spans.length;j++){
     if(j===i||j===i+1)continue;
     const at=j<spans.length?rest.indexOf(ids[spans[j][0]]):rest.indexOf(ids[spans.at(-1)[1]])+1;
     const order=[...rest.slice(0,at),...moved,...rest.slice(at)];orders.set(order.join(','),order);
    }
   });
  }
  ts.forEachChild(node,visit);
 };
 visit(file);return [...orders.values()];
}
/** Topological orders of a CodeLine v2 model honouring dependencies, edges,
 * scope nesting and fixed slots. `rng` randomises; `limit` bounds the search. */
export function extensions(model,{limit=Infinity,rng=null}={}){
 const lines=model.lines,openers=new Map(model.blocks.map(b=>[b.openLineId,b.id])),closers=new Map(model.blocks.map(b=>[b.closeLineId,b.id]));
 const before=new Map(lines.map(line=>[line.id,new Set(line.dependencies)]));for(const edge of model.edges??[])before.get(edge.after).add(edge.before);
 const pinned=new Map(lines.flatMap((line,i)=>line.fixed?[[i,line.id]]:[]));
 // Dead-end pruning (the enumerated set is unchanged): a block opens only once every
 // dependency its rows have outside it is placed, and closes only once all its rows are.
 const parent=new Map(model.blocks.map(b=>[b.id,b.parentScopeId])),inside=new Map(model.blocks.map(b=>[b.id,new Set()]));
 for(const line of lines)for(let scope=line.scopeId;scope;scope=parent.get(scope))inside.get(scope)?.add(line.id);
 const external=new Map(model.blocks.map(b=>{const rows=inside.get(b.id),needs=new Set();for(const id of [...rows,b.closeLineId])for(const dep of before.get(id)??[])if(!rows.has(dep)&&dep!==b.openLineId)needs.add(dep);return [b.id,needs];}));
 const ready=line=>{const open=openers.get(line.id),close=closers.get(line.id);return (open===undefined||[...external.get(open)].every(id=>placed.has(id)))&&(close===undefined||[...inside.get(close)].every(id=>placed.has(id)));};
 const results=[],placed=new Set(),sequence=[],stack=[];
 (function extend(){
  if(results.length>=limit)return;
  if(sequence.length===lines.length){if(!stack.length)results.push([...sequence]);return;}
  const candidates=rng?[...lines].sort(()=>rng()-0.5):lines;
  for(const line of candidates){
   if(results.length>=limit)return;
   if(placed.has(line.id)||[...before.get(line.id)].some(id=>!placed.has(id))||!ready(line))continue;
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
