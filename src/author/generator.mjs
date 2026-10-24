/** Author-only source -> CodeLine generator. Never run a learner's source. */
export class AuthoringError extends Error { constructor(message){super(message);this.name='AuthoringError';} }

/**
 * Produces a conservative constraint model: all physical lines retain their original
 * relative order; verified brace pairs become explicit structural blocks. No attempts
 * at guessing referential transparency, type-level effects, TDZ or variable aliasing.
 */
export function generateCodeLineExercise({source,language='javascript',title='Saját feladat',description='Rendezd sorba a programkódot.'}, ts){
  if(!['javascript','typescript'].includes(language))throw new AuthoringError('Csak JavaScript és TypeScript támogatott.');
  if(typeof source!=='string'||source.length>50_000)throw new AuthoringError('Túl hosszú vagy hiányzó forráskód (maximum 50 KB).');
  const normalized=source.replace(/\r\n?/g,'\n').trimEnd();
  if(!normalized.trim())throw new AuthoringError('A forráskód nem lehet üres.');
  if(/\u2028|\u2029/.test(normalized))throw new AuthoringError('Unicode sorhatár nem támogatott.');
  const physical=normalized.split('\n');
  const lines=physical.filter(x=>x.trim());
  if(lines.length>500||lines.some(l=>l.length>2048))throw new AuthoringError('Legfeljebb 500 sor és soronként 2048 karakter támogatott.');
  const filename=`source.${language==='typescript'?'ts':'js'}`;
  const ast=ts.createSourceFile(filename,normalized,ts.ScriptTarget.Latest,true,language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
  if(ast.parseDiagnostics.length){
    const diag=ast.parseDiagnostics[0];
    const place=ast.getLineAndCharacterOfPosition(diag.start??0);
    throw new AuthoringError(`Szintaktikai hiba ${place.line+1}. sor: ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);
  }
  // Detect function body opening braces in AST; the lexer handles ordinary literals/comments.
  const functionLines=new Set();
  const visit=node=>{
    if(ts.isBlock(node)&&node.parent&&ts.isFunctionLike(node.parent)&&node.parent.body===node){
      functionLines.add(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line);
    }
    ts.forEachChild(node,visit);
  }; visit(ast);

  const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,normalized);
  const braces=physical.map(()=>[]);
  for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan()){
    const pos=scanner.getTokenPos(),end=scanner.getTextPos();
    const startLine=ast.getLineAndCharacterOfPosition(pos).line;
    const endLine=ast.getLineAndCharacterOfPosition(Math.max(pos,end-1)).line;
    // Multiline templates and multiline quoted lexical segments cannot safely be line-trimmed.
    if(startLine!==endLine && [ts.SyntaxKind.NoSubstitutionTemplateLiteral,ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail,ts.SyntaxKind.StringLiteral,ts.SyntaxKind.RegularExpressionLiteral].includes(kind)){
      throw new AuthoringError(`Többsoros literál a ${startLine+1}. sor környékén: a soronkénti indent normalizálás nem biztonságos.`);
    }
    if(kind===ts.SyntaxKind.OpenBraceToken||kind===ts.SyntaxKind.CloseBraceToken){
      braces[startLine]?.push({open:kind===ts.SyntaxKind.OpenBraceToken,column:pos-(ast.getPositionOfLineAndCharacter(startLine,0))});
    }
  }
  const blocks=[], stack=[], out=[];let nextFunction=1,nextBlock=1;
  let cannotModelBlocks=false;
  const owner=()=>[...stack].reverse().find(b=>b.kind==='function')?.functionBlock??0;
  for(let i=0;i<physical.length;i++){
    const original=physical[i],trimmed=original.trim();if(!trimmed)continue;
    const found=braces[i]||[];
    // Cancel brace pairs contained entirely in this physical line (e.g. TS
    // object return types or inline object literals). Only unmatched boundary
    // braces influence the cross-line lexical nesting.
    const inlineOpens=[];let externalCloses=0;
    for(const brace of found){
      if(brace.open)inlineOpens.push(brace);
      else if(inlineOpens.length)inlineOpens.pop();
      else externalCloses++;
    }
    let action='none';
    if(externalCloses===1 && inlineOpens.length===0){
      const b=found.find(x=>!x.open);
      if(b && /^\s*$/.test(original.slice(0,b.column))&&/^\s*[;,]?\s*$/.test(original.slice(b.column+1)))action='close';
    }
    if(externalCloses===0 && inlineOpens.length===1){
      const b=inlineOpens[0];if(/^\s*$/.test(original.slice(b.column+1)))action='open';
    }
    if((externalCloses||inlineOpens.length)&&action==='none'){
      cannotModelBlocks=true; break;
    }
    const id=out.length+1;
    if(action==='close'){
      const block=stack.pop();if(!block)throw new AuthoringError(`Nem párosítható } a(z) ${i+1}. sorban.`);
      out.push({id,code:original,dependencies:id>1?[id-1]:[],fixed:false,functionBlock:block.kind==='function'?block.functionBlock:owner(),scopeId:stack.at(-1)?.id??null,normalization:'indent'});
      block.closeLineId=id;
    }else if(action==='open'){
      const isFn=functionLines.has(i),scopeId=stack.at(-1)?.id??null;
      const block={id:`scope-${nextBlock++}`,kind:isFn?'function':'block',parentScopeId:scopeId,openLineId:id,closeLineId:-1,...(isFn?{functionBlock:nextFunction++}:{})};
      out.push({id,code:original,dependencies:id>1?[id-1]:[],fixed:false,functionBlock:isFn?block.functionBlock:owner(),scopeId,normalization:'indent'});
      blocks.push(block);stack.push(block);
    }else{
      out.push({id,code:original,dependencies:id>1?[id-1]:[],fixed:false,functionBlock:owner(),scopeId:stack.at(-1)?.id??null,normalization:'indent'});
    }
  }
  if(stack.length)cannotModelBlocks=true;
  // Full TS service methods often contain `} else {`, `});`, and multiline
  // generic signatures. A strict full-order fallback is always valid for an
  // already-parsed source; never invent scope relationships for such tokens.
  if(cannotModelBlocks){
    const serial=lines.map((code,i)=>({id:i+1,code,dependencies:i?[i]:[],fixed:false,functionBlock:0,scopeId:null,normalization:'indent'}));
    return {schemaVersion:2,id:'draft',revision:1,language,title:String(title).slice(0,140)||'Saját feladat',description:String(description).slice(0,500)||'Rendezd sorba a programkódot.',lines:serial,blocks:[],edges:[],profiles:[],authoring:{strategy:'conservative-serial',reason:'complex-brace-boundaries'}};
  }
  const id='draft';
  return {schemaVersion:2,id,revision:1,language,title:String(title).slice(0,140)||'Saját feladat',description:String(description).slice(0,500)||'Rendezd sorba a programkódot.',lines:out,blocks,edges:[],profiles:[]};
}
