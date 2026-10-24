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
export function formatTypedSource(source, language, ts){
  if(typeof source!=='string'||source.length>50_000)throw new AuthoringError('Legfeljebb 50 KB kód formázható.');
  if(!['javascript','typescript'].includes(language))throw new AuthoringError('Érvénytelen nyelv.');
  const text=source.replace(/\r\n?/g,'\n');
  const fileName=`reference.${language==='typescript'?'ts':'js'}`;
  const file=ts.createSourceFile(fileName,text,ts.ScriptTarget.Latest,true,language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
  if(file.parseDiagnostics.length){
    const d=file.parseDiagnostics[0],place=file.getLineAndCharacterOfPosition(d.start??0);
    throw new AuthoringError(`Szintaktikai hiba a(z) ${place.line+1}. sorban: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
  }
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
    const after=ts.createSourceFile(fileName,output,ts.ScriptTarget.Latest,true,language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
    if(after.parseDiagnostics.length)throw new Error('A formázás szintaktikai hibát okozna.');
    return {code:output.replace(/\r\n?/g,'\n'),formatter:'typescript-language-service',indentSize:5,edits:edits.length};
  } finally {service.dispose();}
}
