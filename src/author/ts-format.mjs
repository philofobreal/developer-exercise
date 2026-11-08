/** Format JS/TS author content with the TypeScript language service.
 * Never execute or typecheck learner code. Pure text edits + syntax parse.
 */
import {AuthoringError} from './errors.mjs';

export const FORMAT_OPTIONS=Object.freeze({
  indentSize:5, tabSize:5, convertTabsToSpaces:true, newLineCharacter:'\n',
  insertSpaceAfterCommaDelimiter:true, insertSpaceAfterSemicolonInForStatements:true,
  insertSpaceBeforeAndAfterBinaryOperators:true, insertSpaceAfterKeywordsInControlFlowStatements:true,
  insertSpaceAfterFunctionKeywordForAnonymousFunctions:false,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis:false,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets:false,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces:true,
  insertSpaceBeforeFunctionParenthesis:false,
  placeOpenBraceOnNewLineForFunctions:false,
  placeOpenBraceOnNewLineForControlBlocks:false,
  semicolons:'ignore',
});
/** The syntax tree without positions and trivia: node kinds and the text of every token. Two sources with the same
 * signature differ only in whitespace, line breaks and comments placement. */
function syntaxSignature(file, ts){
  const out=[];
  const visit=node=>{out.push(node.kind);const children=node.getChildren(file);if(!children.length&&node.kind!==ts.SyntaxKind.EndOfFileToken)out.push(node.getText(file));children.forEach(visit);};
  visit(file);return out.join('\u0001');
}
/** U2 (ADR-111): one statement, class or type member, enum member or case clause per line, and a block's closing
 * brace on its own line, as the original ngDynamic formatter laid code out. Line breaks go only between list
 * elements the parser already separated (never inside a statement or an expression, so ASI cannot change), and
 * object literals stay as written. */
function breakLines(text, file, ts){
  const at=[];
  const line=pos=>file.getLineAndCharacterOfPosition(pos).line;
  const list=(elements, open, close)=>{
    let previous=open;
    for(const element of elements){const start=element.getStart(file);if(previous!==undefined&&line(start)===line(previous))at.push(start);previous=element.end;}
    if(close!==undefined&&elements.length&&line(close)===line(previous))at.push(close);
  };
  const braces=node=>{const open=node.getChildren(file).find(child=>child.kind===ts.SyntaxKind.OpenBraceToken),close=node.getChildren(file).find(child=>child.kind===ts.SyntaxKind.CloseBraceToken);return [open?.end,close?.getStart(file)];};
  const visit=node=>{
    if(ts.isSourceFile(node))list(node.statements,undefined,undefined);
    else if(ts.isBlock(node)||ts.isModuleBlock(node)){const [open,close]=braces(node);list(node.statements,open,close);}
    else if(ts.isCaseBlock(node)){const [open,close]=braces(node);list(node.clauses,open,close);}
    else if(ts.isCaseClause(node)||ts.isDefaultClause(node))list(node.statements,node.getChildren(file).find(child=>child.kind===ts.SyntaxKind.ColonToken)?.end,undefined);
    else if(ts.isClassLike(node)||ts.isInterfaceDeclaration(node)||ts.isEnumDeclaration(node)){const [open,close]=braces(node);list(node.members,open,close);}
    ts.forEachChild(node,visit);
  };
  visit(file);
  let output=text;
  for(const position of [...new Set(at)].sort((a,b)=>b-a))output=output.slice(0,position).replace(/[ \t]+$/,'')+'\n'+output.slice(position);
  return output;
}
export function formatTypedSource(source, language, ts){
  if(typeof source!=='string'||source.length>50_000)throw new AuthoringError('Legfeljebb 50 KB kód formázható.');
  if(!['javascript','typescript'].includes(language))throw new AuthoringError('Érvénytelen nyelv.');
  const fileName=`reference.${language==='typescript'?'ts':'js'}`;
  const parse=content=>ts.createSourceFile(fileName,content,ts.ScriptTarget.Latest,true,language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
  const original=parse(source.replace(/\r\n?/g,'\n'));
  if(original.parseDiagnostics.length){
    const d=original.parseDiagnostics[0],place=original.getLineAndCharacterOfPosition(d.start??0);
    throw new AuthoringError(`Szintaktikai hiba a(z) ${place.line+1}. sorban: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
  }
  const signature=syntaxSignature(original,ts);
  // Line breaks first, then the language service indents; a changed syntax tree is never returned.
  const broken=breakLines(original.text,original,ts);
  const text=syntaxSignature(parse(broken),ts)===signature?broken:original.text;
  const host={
    getCompilationSettings:()=>({allowJs:true,target:ts.ScriptTarget.Latest}),
    getScriptFileNames:()=>[fileName],getScriptVersion:()=>String(text.length),
    getScriptSnapshot:name=>name===fileName?ts.ScriptSnapshot.fromString(text):undefined,
    getCurrentDirectory:()=>'',getDefaultLibFileName:()=>'',
    fileExists:name=>name===fileName,readFile:name=>name===fileName?text:undefined,
    readDirectory:()=>[],getNewLine:()=> '\n',useCaseSensitiveFileNames:()=>true,
  };
  const service=ts.createLanguageService(host,ts.createDocumentRegistry());
  try{
    const edits=service.getFormattingEditsForDocument(fileName,FORMAT_OPTIONS);
    let output=text;
    for(const edit of edits.sort((a,b)=>b.span.start-a.span.start)){
      output=output.slice(0,edit.span.start)+edit.newText+output.slice(edit.span.start+edit.span.length);
    }
    const after=parse(output);
    if(after.parseDiagnostics.length||syntaxSignature(after,ts)!==signature)throw new AuthoringError('A formázás megváltoztatná a kód szerkezetét, ezért nem formáztam.');
    return {code:output.replace(/\r\n?/g,'\n'),formatter:'typescript-language-service',indentSize:5,edits:edits.length};
  } finally {service.dispose();}
}
