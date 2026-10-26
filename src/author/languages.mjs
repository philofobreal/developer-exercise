/** Author-side language boundary; the structural validator is language agnostic.
 * Extensions register their own parser, formatter, tokenizer, structure and
 * whitespace policy. No source-to-JavaScript translation is involved.
 */
import {parse as parseJavaScript} from './vendor/acorn.mjs';
import {AuthoringError} from './errors.mjs';
import {bindingChecker,declarationGroups} from './dependency-analysis.mjs';
import {jsTsOrderingRelations} from '../../dist/author/js-ts-ordering.js';
import {formatTypedSource} from './ts-format.mjs';
const registry=new Map();
export function registerLanguageAdapter(id,adapter){
 if(typeof id!=='string'||!id||registry.has(id))throw new TypeError('Duplicate/invalid language adapter');
 for(const method of ['parse','format','tokenize','structure','whitespace'])if(typeof adapter?.[method]!=='function')throw new TypeError('Missing adapter method: '+method);
 registry.set(id,Object.freeze({...adapter}));
}
export function getLanguageAdapter(id){const a=registry.get(id);if(!a)throw new AuthoringError('Nem támogatott nyelv: '+id);return a;}
export const languageIds=()=>[...registry.keys()];
function structure(file,ts){
 const result=[];
 const visit=node=>{
  const eligible=ts.isBlock(node)||ts.isModuleBlock(node)||ts.isClassLike(node)||ts.isInterfaceDeclaration(node)||ts.isTypeLiteralNode(node)||ts.isObjectLiteralExpression(node)||ts.isEnumDeclaration(node);
  if(eligible){
   const children=node.getChildren(file),open=children.find(x=>x.kind===ts.SyntaxKind.OpenBraceToken),close=children.findLast(x=>x.kind===ts.SyntaxKind.CloseBraceToken);
   if(open&&close)result.push({start:file.getLineAndCharacterOfPosition(open.getStart(file)).line,end:file.getLineAndCharacterOfPosition(close.getStart(file)).line,kind:ts.isBlock(node)&&ts.isFunctionLike(node.parent)?'function':'block'});
  }
  ts.forEachChild(node,visit);
 };visit(file);return result;
}
function whitespace(file,ts){
 const exact=new Set();
 const visit=node=>{
  if(ts.isStringLiteralLike(node)||[ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(node.kind)){
   const start=file.getLineAndCharacterOfPosition(node.getStart(file)).line,end=file.getLineAndCharacterOfPosition(node.end-1).line;
   for(let line=start+1;line<=end;line++)exact.add(line);
  }
  ts.forEachChild(node,visit);
 };visit(file);return exact;
}
for(const language of ['javascript','typescript'])registerLanguageAdapter(language,{
 parse(source,ts){
  if(typeof source!=='string'||source.length>50_000)throw new AuthoringError('Legfeljebb 50 KB forráskód támogatott.');
  if(language==='javascript'){
   try{parseJavaScript(source,{ecmaVersion:'latest',sourceType:'script',allowHashBang:true});}
   catch(scriptError){try{parseJavaScript(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});}catch{throw new AuthoringError(`Szintaktikai hiba ${scriptError.loc?.line??1}. sor: ${scriptError.message}`);}}
  }
  const file=ts.createSourceFile('reference.'+(language==='typescript'?'ts':'js'),source,ts.ScriptTarget.Latest,true,language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
  if(file.parseDiagnostics.length){const d=file.parseDiagnostics[0],p=file.getLineAndCharacterOfPosition(d.start??0);throw new AuthoringError(`Szintaktikai hiba ${p.line+1}. sor: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}
  return file;
 },
 format:(source,ts)=>{getLanguageAdapter(language).parse(source,ts);return formatTypedSource(source,language,ts);},
 structure,whitespace,declarationGroups,orderingRelations:jsTsOrderingRelations,
 tokenize(file,ts){const out=[];const walk=n=>{const children=n.getChildren(file);if(!children.length&&n.kind!==ts.SyntaxKind.EndOfFileToken)out.push({kind:n.kind,text:n.getText(file)});else children.forEach(walk);};walk(file);return out;},
 analyzeDependencies(file,ts){
  // Binding identity, not equal identifier spelling, resolves shadowed locals.
  // These are author hints only; side effects and equivalence remain unproven.
  const checker=bindingChecker(file,ts),hints=[],seen=new Set();
  const visit=node=>{
   if(ts.isIdentifier(node)&&hints.length<200){
    const symbol=checker.getSymbolAtLocation(node),declaration=symbol?.valueDeclaration;
    if(declaration&&declaration.getSourceFile()===file&&declaration.name!==node){
     const before=file.getLineAndCharacterOfPosition(declaration.getStart(file)).line,after=file.getLineAndCharacterOfPosition(node.getStart(file)).line;
     const key=before+':'+after+':'+node.text;
     if(before!==after&&!seen.has(key)){seen.add(key);hints.push({name:node.text,declarationLine:before+1,usageLine:after+1});}
    }
   }
   ts.forEachChild(node,visit);
  };visit(file);return hints;
 }
});
