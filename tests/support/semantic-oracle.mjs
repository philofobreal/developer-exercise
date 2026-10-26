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
/** {external, reads, writes}: external = an effect outside function-local bindings. */
function jsClassify(statement,chain){
 let external=false;const reads=new Set(),writes=new Set();
 const local=(name,scopes)=>scopes[0]?.type!=='Program'&&scopes.some(scope=>jsDeclares(scope,name));
 const visit=(node,scopes)=>{
  if(!node||typeof node!=='object'||external)return;
  if(Array.isArray(node)){node.forEach(item=>visit(item,scopes));return;}
  if(jsFunction.has(node.type))return;
  if(node.type==='AssignmentExpression'){if(node.operator==='='&&node.left.type==='Identifier'&&local(node.left.name,scopes)){writes.add(node.left.name);visit(node.right,scopes);}else external=true;return;}
  if(node.type==='ClassDeclaration'||node.type==='ClassExpression'){if(jsHasEffect(node)){external=true;return;}if(node.type==='ClassDeclaration')writes.add(node.id.name);visit(node.superClass,scopes);return;}
  if(jsEffect.has(node.type)||node.type==='UnaryExpression'&&node.operator==='delete'||node.type==='BinaryExpression'&&['in','instanceof'].includes(node.operator)||node.type==='Identifier'&&node.name==='eval'){external=true;return;}
  if(node.type==='VariableDeclarator'){if(node.id.type!=='Identifier'){external=true;return;}writes.add(node.id.name);visit(node.init,scopes);return;}
  if(node.type==='Identifier'){reads.add(node.name);return;}
  if(node.type==='Property'){if(node.computed)visit(node.key,scopes);visit(node.value,scopes);return;}
  if(node.type==='LabeledStatement'){visit(node.body,scopes);return;}
  const inner=jsScope.has(node.type)?[...scopes,node]:scopes;
  for(const [key,value] of Object.entries(node))if(key!=='type'&&value&&typeof value==='object')visit(value,inner);
 };
 visit(statement,chain);
 return {external,reads,writes};
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
function tsClassify(statement,chain){
 let external=false;const reads=new Set(),writes=new Set();
 const local=(name,scopes)=>!!scopes[0]&&tsFunction(scopes[0])&&scopes.some(scope=>tsDeclares(scope,name));
 const visit=(node,scopes)=>{
  if(external||ts.isTypeNode(node)||erased(node))return;
  if(ts.isFunctionDeclaration(node)&&!node.body){external=true;return;}
  if(tsFunction(node))return;
  if(ts.isBinaryExpression(node)&&assignment.has(node.operatorToken.kind)){if(node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isIdentifier(node.left)&&local(node.left.text,scopes)){writes.add(node.left.text);visit(node.right,scopes);}else external=true;return;}
  if(ts.isClassLike(node)){if(tsHasEffect(node)){external=true;return;}if(ts.isClassDeclaration(node)&&node.name)writes.add(node.name.text);node.heritageClauses?.forEach(clause=>clause.types.forEach(type=>visit(type.expression,scopes)));return;}
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
 return {external,reads,writes};
}
const tsPositionFree=(statement,hoisting)=>erased(statement)||hoisting&&ts.isFunctionDeclaration(statement)&&!!statement.body;
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
/** Ordered pairs of P2: an external effect on either side, or a RAW/WAR/WAW conflict. */
function effectPairs(lists,key,classify,positionFree){
 const pairs=[];
 for(const {items,hoisting,chain} of lists){
  const classes=items.map(item=>classify(item,chain));
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
   const a=items[i],b=items[j],ca=classes[i],cb=classes[j];
   if(positionFree(a,hoisting)||positionFree(b,hoisting))continue;
   if(ca.external||cb.external||meets(ca.writes,cb.reads)||meets(ca.writes,cb.writes)||meets(ca.reads,cb.writes))pairs.push(key(a)+'\u0000'+key(b));
  }
 }
 return JSON.stringify(pairs.sort());
}
/* ------------------- P4 reflective property order (ADR-010) ------------------
 * OrdinaryOwnPropertyKeys lists array-index keys ascending, then string keys in
 * creation order. ClassDefinitionEvaluation creates `constructor` first, then
 * methods/accessors in source order on the prototype (static ones on the
 * constructor, before static fields); instance fields follow source order
 * (TS parameter properties first); a TS `accessor` field defines its get/set
 * pair among the methods. A script's top-level function and var names become
 * global-object properties; the specification creates functions first, V8
 * interleaves them in source order, so P4 compares the source order of all of
 * them. For TypeScript they are read from the emitted script, so enums,
 * namespaces and import aliases count exactly when they emit a var.
 * Private names are not reflected. */
const arrayIndex=key=>/^(0|[1-9]\d*)$/.test(key)&&Number(key)<4294967295;
const firstOccurrences=keys=>[...new Set(keys)].filter(key=>!arrayIndex(key));
function jsReflection(tree){
 const classes=[],globals=[];
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
   classes.push(JSON.stringify([firstOccurrences(proto),firstOccurrences([...statics,...staticFields]),firstOccurrences(instance)]));
  }
  if(global&&node.type==='VariableDeclaration'&&node.kind==='var')node.declarations.forEach(d=>patternNames(d.id,globals));
  if(global&&node.type==='FunctionDeclaration')globals.push(node.id.name);
  const inner=global&&!jsFunction.has(node.type);
  for(const [key,value] of Object.entries(node))if(value&&typeof value==='object')visit(value,inner&&!(node.type==='ClassBody'));
 };
 visit(tree,true);
 return {order:JSON.stringify([classes.sort(),firstOccurrences(globals)]),classNames:tree.body.filter(s=>s.type==='ClassDeclaration').map(s=>s.id.name),globals:firstOccurrences(globals)};
}
function tsReflection(file,globals){
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
   classes.push(JSON.stringify([firstOccurrences(proto),firstOccurrences([...statics,...staticFields]),firstOccurrences([...parameters,...instance])]));
  }
  ts.forEachChild(node,visit);
 };
 visit(file);
 return {order:JSON.stringify([classes.sort(),firstOccurrences(globals)]),classNames:file.statements.flatMap(s=>ts.isClassDeclaration(s)&&s.name&&!has(s,ts.SyntaxKind.DeclareKeyword)?[s.name.text]:[]),globals:firstOccurrences(globals)};
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
function analyse(code,language){
 if(language==='typescript'){
  const file=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(file.parseDiagnostics.length||!tsOverloadsAdjacent(file))return null;
  // Global-object properties are what the emitted script declares; a module declares none.
  let globals=[];
  if(!ts.isExternalModule(file)){try{globals=jsReflection(parseScript(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{ecmaVersion:'latest',sourceType:'script'})).globals;}catch{return null;}}
  return {shape:tsShape(file),effects:effectPairs(tsLists(file),tsShape,tsClassify,tsPositionFree),reflection:tsReflection(file,globals),nested:nestedClasses(code,language)};
 }
 let tree;try{tree=parseScript(code,{ecmaVersion:'latest',sourceType:'script'});}catch{return null;}
 return {shape:jsShape(tree),effects:effectPairs(jsLists(tree),node=>jsShape(node),jsClassify,jsPositionFree),reflection:jsReflection(tree),nested:nestedClasses(code,language)};
}
/** Runs a fixed fixture. `call`: probe value, exception and record() trace.
 * `reflection`: own keys and descriptor kinds of the top-level classes'
 * prototypes and constructors, and the declared global-object properties
 * (names come from the reference analysis), read right after evaluation.
 * `nested` (from this code's own analysis) registers the nested classes; their
 * snapshots are sorted by key, as declaration order is not itself observable. */
function execute(code,{language,probe,strict=true,asynchronous=false},{classNames=[],globals=[]}={},nested=[]){
 for(const {key,name,end} of [...nested].sort((a,b)=>b.end-a.end))code=code.slice(0,end)+`;__classes.push([${JSON.stringify(key)}, ${name}]);`+code.slice(end);
 const keys=`const keys=o=>Reflect.ownKeys(o).map(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return [String(k),'get' in d||'set' in d?'accessor':'value',d.enumerable,d.configurable,d.writable===undefined?null:d.writable];});`;
 const reflect=`;var __reflection=(()=>{try{${keys}`
  +`return JSON.stringify({classes:[${classNames.map(name=>`typeof ${name}==='function'?[keys(${name}.prototype),keys(${name})]:null`).join(',')}],globals:Object.getOwnPropertyNames(globalThis).filter(k=>${JSON.stringify(globals)}.includes(k))});}catch(error){return 'throws:'+(error&&error.name);}})();`;
 // Nested classes exist only once the probe ran: snapshot them afterwards.
 const nestedSnapshot=`(()=>{try{${keys}return JSON.stringify(__classes.map(([k,c])=>JSON.stringify([k,keys(c.prototype),keys(c)])).sort());}catch(error){return 'throws:'+(error&&error.name);}})()`;
 const attempt=(js,timeout)=>{
  const context=createContext({trace:[],__classes:[]},asynchronous?{microtaskMode:'afterEvaluate'}:{});
  const tail=asynchronous
   ?`;var __result='pending',__nested='pending';Promise.resolve(${probe}).then(value=>{__result=JSON.stringify({value,trace});__nested=${nestedSnapshot};},error=>{__result='throws:'+(error&&error.name)+':'+(error&&error.message);});`
   :`;var __result=JSON.stringify({value:(${probe}),trace});var __nested=${nestedSnapshot};`;
  try{new Script((strict?'"use strict";\n':'')+'function record(...args) { trace.push(args); }\n'+js+'\n'+reflect+tail,{filename:'fixed-oracle-fixture.js'}).runInContext(context,{timeout});return {call:String(context.__result),reflection:String(context.__reflection)+' nested:'+String(context.__nested)};}
  catch(error){if(error?.code==='ERR_SCRIPT_EXECUTION_TIMEOUT')return {call:'timeout',reflection:''};return {call:'throws:'+error?.name+':'+error?.message,reflection:''};}
 };
 const run=js=>{let result={call:'timeout',reflection:''};for(const timeout of TIMEOUTS_MS){result=attempt(js,timeout);if(result.call!=='timeout')break;}return result;};
 if(language!=='typescript')return run(code);
 const outputs=[];
 for(const define of [false,true]){
  const output=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,useDefineForClassFields:define}});
  if(output.diagnostics?.length)return {call:'syntax',reflection:''};
  outputs.push(run(output.outputText));
 }
 return {call:outputs.map(o=>o.call).join(' | '),reflection:outputs.map(o=>o.reflection).join(' | ')};
}

/** Returns judge(lines) → {ok: true|false|null, reason}. ok=null means undecided.
 * policy 'reflective' (default, ADR-010) adds P4: reflectable property order
 * (syntactic rule and runtime snapshot) is part of the observable behaviour;
 * reason 'reflection' separates it from a call-level 'runtime' difference.
 * policy 'call-only' is the pre-ADR-010 P0–P3 policy, kept for comparison. */
export function createOracle(fixture,{policy='reflective'}={}){
 if(!['reflective','call-only'].includes(policy))throw Error('unknown oracle policy '+policy);
 const source=Array.isArray(fixture.source)?fixture.source.join('\n'):fixture.source;
 const reference=analyse(source,fixture.language);
 if(!reference)throw Error(`oracle fixture ${fixture.id} does not parse`);
 const baseline=execute(source,fixture,reference.reflection,reference.nested);
 if(/^throws:|timeout|syntax/.test(baseline.call))throw Error(`oracle fixture ${fixture.id} reference fails: ${baseline.call}`);
 const reflective=policy==='reflective',cache=new Map();
 return lines=>{
  const code=lines.join('\n');
  if(cache.has(code))return cache.get(code);
  let verdict;const candidate=analyse(code,fixture.language);
  if(!candidate)verdict={ok:false,reason:'syntax'};
  else if(candidate.shape!==reference.shape)verdict={ok:false,reason:'scope'};
  else if(candidate.effects!==reference.effects)verdict={ok:false,reason:'effect-order'};
  else if(reflective&&candidate.reflection.order!==reference.reflection.order)verdict={ok:false,reason:'reflection'};
  else{
   const observed=execute(code,fixture,reference.reflection,candidate.nested);
   verdict=observed.call.includes('timeout')?{ok:null,reason:'timeout'}:observed.call!==baseline.call?{ok:false,reason:'runtime'}:reflective&&observed.reflection!==baseline.reflection?{ok:false,reason:'reflection'}:{ok:true,reason:'equivalent'};
  }
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
