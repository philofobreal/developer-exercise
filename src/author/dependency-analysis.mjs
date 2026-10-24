/** Author-side binding analysis. Never runs for student submissions. */
export function bindingChecker(file,ts){
 const options={allowJs:true,noLib:true,noResolve:true,target:ts.ScriptTarget.Latest};
 const host={getSourceFile:name=>name===file.fileName?file:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],getCanonicalFileName:name=>name,useCaseSensitiveFileNames:()=>true,getNewLine:()=>String.fromCharCode(10),fileExists:name=>name===file.fileName,readFile:name=>name===file.fileName?file.text:undefined};
 return ts.createProgram([file.fileName],options,host).getTypeChecker();
}

/** Legacy advisory groups; generation uses scope-compositional statementOrdering.
 * Only contiguous single-row const declarations of primitive values commute.
 * Calls, property access/getters, mutation, objects, unresolved identifiers,
 * forward references and every unrecognized expression remain order barriers.
 */
export function declarationGroups(file,ts){
 const checker=bindingChecker(file,ts),groups=[],physical=file.text.split('\n');
 const lineOf=node=>file.getLineAndCharacterOfPosition(node.getStart(file)).line;
 const operators=new Set(['+','-','*','/','%','**','<','<=','>','>=','===','!==','==','!=','&','|','^','<<','>>','>>>','&&','||','??']);
 const visit=node=>{
  if(ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node)){
   let run=[],known=new Map();
   const flush=()=>{if(run.length>1)groups.push(run);run=[];known=new Map();};
   for(const statement of node.statements){
    const start=lineOf(statement),end=file.getLineAndCharacterOfPosition(statement.end-1).line;
    const declaration=ts.isVariableStatement(statement)&&!statement.modifiers?.length&&((statement.declarationList.flags&ts.NodeFlags.BlockScoped)===ts.NodeFlags.Const)&&statement.declarationList.declarations.length===1?statement.declarationList.declarations[0]:null;
    const symbol=declaration&&ts.isIdentifier(declaration.name)?checker.getSymbolAtLocation(declaration.name):null;
    const after=new Set();
    const pure=expr=>{
     if(!expr)return false;
     if(ts.isNumericLiteral(expr)||ts.isStringLiteral(expr)||ts.isNoSubstitutionTemplateLiteral(expr)||[ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(expr.kind))return true;
     if(ts.isIdentifier(expr)){const dependency=known.get(checker.getSymbolAtLocation(expr));if(!dependency)return false;after.add(dependency.line);return true;}
     if(ts.isParenthesizedExpression(expr))return pure(expr.expression);
     if(ts.isPrefixUnaryExpression(expr)&&[ts.SyntaxKind.PlusToken,ts.SyntaxKind.MinusToken,ts.SyntaxKind.ExclamationToken,ts.SyntaxKind.TildeToken].includes(expr.operator))return pure(expr.operand);
     if(ts.isBinaryExpression(expr)&&operators.has(expr.operatorToken.getText(file)))return pure(expr.left)&&pure(expr.right);
     if(ts.isConditionalExpression(expr))return pure(expr.condition)&&pure(expr.whenTrue)&&pure(expr.whenFalse);
     return false;
    };
    if(run.length&&start!==run.at(-1).line+1)flush();
    const eligible=start===end&&physical[start]?.trim()===statement.getText(file).trim()&&symbol&&symbol.declarations?.length===1&&pure(declaration.initializer);
    if(!eligible){flush();continue;}
    const entry={line:start,after:[...after]};run.push(entry);known.set(symbol,entry);
   }
   flush();
  }
  ts.forEachChild(node,visit);
 };visit(file);return groups;
}
