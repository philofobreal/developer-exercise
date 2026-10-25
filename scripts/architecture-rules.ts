/** Explicit machine-checkable constraints; design quality still requires review. */
import ts from 'typescript';
import path from 'node:path';
export interface Violation {file:string;rule:string;message:string;}
const typedAuthorWiring=new Set(['src/author/generator.mjs -> dist/author/type-member-ordering.js','src/author/generator.mjs -> dist/author/statement-ordering.js','src/author/languages.mjs -> dist/author/statement-ordering.js']);
export function inspectModule(file:string,source:string):Violation[]{
 const out:Violation[]=[],normalized=file.replaceAll('\\','/'),generatedSchema=normalized==='src/core/schema-check.ts';
 const core=normalized.startsWith('src/core/'),ui=normalized.startsWith('src/workbench/'),author=normalized.startsWith('src/author/'),python=normalized.startsWith('src/python/');
 const report=(rule:string,message:string):void=>{out.push({file:normalized,rule,message});};
 if(normalized.endsWith('.ts')&&!generatedSchema&&/@ts-(?:ignore|nocheck)/.test(source))report('strictness','Handwritten source must not disable TypeScript checking.');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,normalized.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 function importRule(specifier:string,typeOnly:boolean):void{
  const resolved=specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(normalized),specifier)):specifier;
  if(core&&!resolved.startsWith('src/core/'))report('core-boundary','Core must remain independent of browser, author, transport and Node libraries: '+specifier);
  if(ui&&!(resolved.startsWith('src/workbench/')||specifier==='../formatter.js'||typeOnly&&resolved.startsWith('dist/')))report('presentation-boundary','Presentation may use only its own modules, explicit formatter port and domain types: '+specifier);
  const authorEngine=normalized==='src/author/engine.ts'&&resolved==='dist/index.js';
  // Explicit ADR-007/ADR-008 migration wiring: legacy author MJS → compiled typed author modules.
  const typedMemberProjection=typedAuthorWiring.has(normalized+' -> '+resolved);
  if(author&&!(resolved.startsWith('src/author/')||authorEngine||typedMemberProjection||typeOnly&&(resolved.startsWith('src/core/')||resolved.startsWith('dist/')||specifier==='typescript')))report('author-boundary','Author algorithms must remain browser-safe and infrastructure independent: '+specifier);
  if(!python&&(resolved.startsWith('src/python/')||resolved.startsWith('dist/python/')||specifier==='pyodide'))report('python-isolation','Python runtime is currently author-probe infrastructure only; product and learner paths must not import it.');
  const nodePython=['src/python/node-parser.ts','src/python/node-worker.ts'].includes(normalized);
  if(python&&!(resolved.startsWith('src/python/')||resolved==='dist/author/python-parser.js'||nodePython&&(specifier.startsWith('node:')||specifier==='pyodide')))report('python-boundary','Parser infrastructure may use only its own modules and author DTO port; Node imports belong only to process entry points.');
  if(specifier==='node:vm'||specifier==='vm')report('no-execution','Production modules must never execute learner code.');
 }
 function visit(node:ts.Node):void{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))importRule(node.moduleSpecifier.text,ts.isImportDeclaration(node)?!!node.importClause?.isTypeOnly:node.isTypeOnly);
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){const argument=node.arguments[0];if(argument&&ts.isStringLiteral(argument))importRule(argument.text,false);else if(core||ui||python&&normalized!=='src/python/browser-worker.ts')report('dynamic-import','Dynamic imports must be explicit at these boundaries.');}
  if(!generatedSchema&&normalized.endsWith('.ts')&&node.kind===ts.SyntaxKind.AnyKeyword)report('strictness','Handwritten production TypeScript must not use any.');
  if((ts.isCallExpression(node)||ts.isNewExpression(node))&&ts.isIdentifier(node.expression)&&['eval','Function'].includes(node.expression.text))report('no-execution','Dynamic code execution is not permitted in production.');
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
   const method=node.expression.name.text;
   if(['runPython','runPythonAsync','loadPackagesFromImports'].includes(method)&&!(normalized==='src/python/runtime.ts'&&method==='runPython'&&node.arguments.length===1&&ts.isIdentifier(node.arguments[0]!)&&node.arguments[0]!.getText(tree)==='PYTHON_AUDIT_BOOTSTRAP'))report('python-source-data','Only the fixed trusted bootstrap may be passed to runPython; source is function-argument data.');
  }
  if(core&&ts.isIdentifier(node)&&['window','document','fetch','HTMLElement','XMLHttpRequest'].includes(node.text))report('core-platform','Core must not depend on DOM/network globals.');
  if(ui&&ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['fetch','validateSubmission','compileCodeLineExercise','generateCodeLineExercise'].includes(node.expression.text))report('presentation-policy','Rendering must not own transport, author analysis or grading.');
  ts.forEachChild(node,visit);
 }
 visit(tree);return out;
}
