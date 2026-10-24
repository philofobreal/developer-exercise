/** Scope-compositional author analysis, deliberately conservative for effects. */
import {bindingChecker} from './dependency-analysis.mjs';
const binary=new Set(['+','-','*','/','%','**','<','<=','>','>=','===','!==','==','!=','&','|','^','<<','>>','>>>','&&','||','??']);
export function statementOrdering(file,ts){
 let dynamicScope=false;const checkDynamic=node=>{if(ts.isWithStatement(node))dynamicScope=true;ts.forEachChild(node,checkDynamic);};checkDynamic(file);
 if(dynamicScope)return {entries:[],protectedInputs:new Map()};
 const checker=bindingChecker(file,ts),physical=file.text.split('\n'),entries=new Map(),protectedInputs=new Map(),cache=new Map();
 const line=node=>file.getLineAndCharacterOfPosition(node.getStart(file)).line;
 const end=node=>file.getLineAndCharacterOfPosition(node.end-1).line;
 const isDeclaration=declaration=>ts.isVariableDeclaration(declaration)&&ts.isIdentifier(declaration.name)&&[ts.NodeFlags.Const,ts.NodeFlags.Let].includes(declaration.parent.flags&ts.NodeFlags.BlockScoped)&&declaration.parent.declarations.length===1&&ts.isVariableStatement(declaration.parent.parent)&&!declaration.parent.parent.modifiers?.length;
 function primitive(expr,reads=new Set(),visiting=new Set()){
  if(!expr)return false;
  if(ts.isNumericLiteral(expr)||ts.isStringLiteral(expr)||ts.isNoSubstitutionTemplateLiteral(expr)||[ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(expr.kind))return true;
  if(ts.isIdentifier(expr)){
   const symbol=checker.getSymbolAtLocation(expr),declaration=symbol?.valueDeclaration;
   if(!declaration||symbol.declarations?.length!==1||!isDeclaration(declaration)||(declaration.parent.flags&ts.NodeFlags.BlockScoped)!==ts.NodeFlags.Const||declaration.getStart(file)>=expr.getStart(file)||visiting.has(declaration))return false;
   if(!cache.has(declaration)){const next=new Set(visiting);next.add(declaration);cache.set(declaration,primitive(declaration.initializer,new Set(),next));}
   if(!cache.get(declaration))return false;reads.add(declaration);return true;
  }
  if(ts.isParenthesizedExpression(expr))return primitive(expr.expression,reads,visiting);
  if(ts.isPrefixUnaryExpression(expr)&&[ts.SyntaxKind.PlusToken,ts.SyntaxKind.MinusToken,ts.SyntaxKind.ExclamationToken,ts.SyntaxKind.TildeToken].includes(expr.operator))return primitive(expr.operand,reads,visiting);
  if(ts.isBinaryExpression(expr)&&binary.has(expr.operatorToken.getText(file)))return primitive(expr.left,reads,visiting)&&primitive(expr.right,reads,visiting);
  if(ts.isConditionalExpression(expr))return primitive(expr.condition,reads,visiting)&&primitive(expr.whenTrue,reads,visiting)&&primitive(expr.whenFalse,reads,visiting);
  return false;
 }
 function value(expr,reads){
  if(ts.isObjectLiteralExpression(expr))return expr.properties.every(property=>{
   if(ts.isShorthandPropertyAssignment(property))return primitive(property.name,reads);
   return ts.isPropertyAssignment(property)&&!ts.isComputedPropertyName(property.name)&&primitive(property.initializer,reads);
  });
  return primitive(expr,reads);
 }
 function summary(node){
  const reads=new Set();let pure=false;
  if(ts.isVariableStatement(node)&&node.declarationList.declarations.length===1){
   const declaration=node.declarationList.declarations[0];
   pure=isDeclaration(declaration)&&checker.getSymbolAtLocation(declaration.name)?.declarations?.length===1&&line(node)===end(node)&&physical[line(node)]?.trim()===node.getText(file).trim()&&primitive(declaration.initializer,reads);
  }else if(ts.isBlock(node)){
   const children=node.statements.map(summary);pure=children.every(x=>x.pure);for(const child of children)for(const dependency of child.reads)if(dependency.getStart(file)<node.getStart(file))reads.add(dependency);
  }else if(ts.isIfStatement(node)&&ts.isBlock(node.thenStatement)&&(!node.elseStatement||ts.isBlock(node.elseStatement))){
   const branches=[summary(node.thenStatement),...(node.elseStatement?[summary(node.elseStatement)]:[])];pure=primitive(node.expression,reads)&&branches.every(x=>x.pure);
   for(const branch of branches)for(const dependency of branch.reads)if(dependency.getStart(file)<node.getStart(file))reads.add(dependency);
  }else if(ts.isReturnStatement(node)&&node.expression){value(node.expression,reads);}
  // Any unknown statement is an ordering barrier, including control transfers.
  return {node,first:line(node),last:end(node),pure,reads};
 }
 const add=(before,after,essential=false)=>{
  if(before===after||before>after)return;
  if(!entries.has(after))entries.set(after,new Set());entries.get(after).add(before);
  if(essential){if(!protectedInputs.has(after))protectedInputs.set(after,new Set());protectedInputs.get(after).add(before);}
 };
 function visit(node){
  if(ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node)){
   const units=node.statements.map(summary),sourceFile=ts.isSourceFile(node);
   // A physical row containing multiple statements/boundaries is indivisible.
   const separate=units.every((unit,i)=>!i||units[i-1].last<unit.first)&&(!units.length||sourceFile||units[0].first>line(node)&&units.at(-1).last<end(node));
   if(separate){
    // Preserve comments and other non-statement rows as opaque units.
    const complete=[];for(let i=0;i<units.length;i++){if(i)for(let row=units[i-1].last+1;row<units[i].first;row++)if(physical[row].trim())complete.push({first:row,last:row,pure:false,reads:new Set()});complete.push(units[i]);}
    for(const unit of complete){
     entries.set(unit.first,new Set());
     for(const declaration of unit.reads)add(line(declaration),unit.first,true);
     if(!sourceFile&&!entries.get(unit.first).size)add(line(node),unit.first);
    }
    for(let i=0;i<complete.length;i++)for(let j=i+1;j<complete.length;j++)if(!complete[i].pure||!complete[j].pure)add(complete[i].last,complete[j].first);
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(file);
 return {entries:[...entries].map(([row,after])=>({row,after:[...after]})),protectedInputs};
}

/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export function reduceGeneratedDependencies(lines,protectedById=new Map()){
 const ancestors=new Map();
 for(const item of lines){const all=new Set();for(const dep of item.dependencies){all.add(dep);for(const ancestor of ancestors.get(dep)??[])all.add(ancestor);}ancestors.set(item.id,all);}
 for(const item of lines){const protectedIds=protectedById.get(item.id)??new Set();item.dependencies=item.dependencies.filter(dep=>protectedIds.has(dep)||!item.dependencies.some(other=>other!==dep&&ancestors.get(other)?.has(dep))).sort((a,b)=>a-b);}
}
