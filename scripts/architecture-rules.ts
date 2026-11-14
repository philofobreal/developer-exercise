/** Explicit machine-checkable constraints; design quality still requires review. */
import ts from 'typescript';
import path from 'node:path';
export interface Violation {file:string;rule:string;message:string;}
// ADR-011/013: the generator reaches only the typed language-independent projection; the registry wires the JS/TS analysis.
// ADR-015: the projection binds its provenance with the core's digest, the only definition of it.
const typedAuthorWiring=new Set(['src/author/generator.mjs -> dist/author/code-line-projection.js','src/author/languages.mjs -> dist/author/js-ts-ordering.js','src/author/languages.mjs -> dist/author/source-nesting.js','src/author/code-line-projection.ts -> dist/index.js',
 // ADR-148 (NY-41): the article before a name or a number has one definition, the core's; the two preflight modules
 // whose findings name a binding at the start of a sentence use it.
 'src/author/preflight/binding-safety.ts -> dist/index.js','src/author/preflight/object-state.ts -> dist/index.js']);
// ADR-037: core-internal modules hide one decision for named owners; no other module, not even
// the public index, may import them. A new caller is a design decision, recorded here.
const internalOwners:Record<string,readonly string[]>={
 'src/core/placement.js':['src/core/validator.ts'],
 'src/core/reachability.js':['src/core/placement.ts','src/core/diagnostics.ts'],
};
// ADR-151 (NY-58, K1): the headless application core of the workbench. A module on this list names no DOM or browser
// global, not even as a type, and imports (other than types) only other headless modules and the formatter port, so
// it runs and is tested without a browser. The list grows as the refactoring moves modules in (store, controller,
// selectors, gesture machine); adding a module is a design decision, recorded in that phase's ADR.
// ADR-152: the technology filter was written headless from the start.
const headless:ReadonlySet<string>=new Set(['src/workbench/attempt.ts','src/workbench/author-session.ts','src/workbench/technology-filter.ts']);
const browserGlobals:ReadonlySet<string>=new Set(['document','window','Element','HTMLElement','localStorage','sessionStorage','matchMedia','getComputedStyle','requestAnimationFrame']);
// ADR-151 (K3): raw HTML is written into the page by these modules only (the view, the editor frame's highlighter and
// the progress chip's fixed skeleton). Everything else builds strings or nodes and hands them over.
const htmlWriters:ReadonlySet<string>=new Set(['src/workbench/view.ts','src/workbench/ui-utilities.ts','src/workbench/activity.ts']);
// ADR-151 (K4): listeners on the document or the window, and observers, belong to behaviours, which take them off
// again. These modules hold them today; the behaviour life cycle (attach, update, dispose) reaches them in phase F5.
const globalListeners:ReadonlySet<string>=new Set(['src/workbench/view.ts','src/workbench/interactions.ts','src/workbench/surface.ts','src/workbench/toggletip.ts','src/workbench/header-fit.ts','src/workbench/list-fit.ts','src/workbench/toolbar-fit.ts']);
// ADR-151 (K11): what draws from the state reads no environment (media queries, storage) while it draws; the
// environment reaches it as data. `view.ts` joins this list in phase F3, when its reads have moved into the snapshot.
const environmentFree:ReadonlySet<string>=new Set(['src/workbench/rule-board.ts','src/workbench/rule-panel.ts','src/workbench/learner-rules.ts','src/workbench/fields.ts','src/workbench/task-status.ts','src/workbench/dependency-view.ts','src/workbench/preflight-settings.ts','src/workbench/help-topics.ts','src/workbench/flow.ts','src/workbench/availability.ts']);
const environmentGlobals:ReadonlySet<string>=new Set(['matchMedia','localStorage','sessionStorage']);
export function inspectModule(file:string,source:string):Violation[]{
 const out:Violation[]=[],normalized=file.replaceAll('\\','/'),generatedSchema=normalized==='src/core/schema-check.ts';
 const core=normalized.startsWith('src/core/'),ui=normalized.startsWith('src/workbench/'),author=normalized.startsWith('src/author/'),python=normalized.startsWith('src/python/');
 // ADR-155: the standalone page's practice engine. It ships to the visitor, so it reaches the validator through the
 // core's public interface only: never the author analysis, the server, the page or the network.
 const standalone=normalized.startsWith('src/standalone/');
 const report=(rule:string,message:string):void=>{out.push({file:normalized,rule,message});};
 if(normalized.endsWith('.ts')&&!generatedSchema&&/@ts-(?:ignore|nocheck)/.test(source))report('strictness','Handwritten source must not disable TypeScript checking.');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,normalized.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 function importRule(specifier:string,typeOnly:boolean):void{
  const resolved=specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(normalized),specifier)):specifier;
  if(core&&!resolved.startsWith('src/core/'))report('core-boundary','Core must remain independent of browser, author, transport and Node libraries: '+specifier);
  const owners=internalOwners[resolved.replace(/^dist\//,'src/core/').replace(/\.ts$/,'.js')];
  if(owners&&!owners.includes(normalized))report('information-hiding',`${specifier} hides one decision for ${owners.join(', ')} only (ADR-037).`);
  // ADR-125: the Local Demo worker's one compiler port, for that file and that import only.
  const workerCompiler=normalized==='src/workbench/pages-worker.ts'&&specifier==='../vendor/typescript.mjs';
  if(ui&&!(resolved.startsWith('src/workbench/')||specifier==='../formatter.js'||workerCompiler||typeOnly&&resolved.startsWith('dist/')))report('presentation-boundary','Presentation may use only its own modules, explicit formatter port and domain types: '+specifier);
  const authorEngine=normalized==='src/author/engine.ts'&&resolved==='dist/index.js';
  // Explicit ADR-007/008/011 migration wiring: legacy author MJS → compiled typed author modules.
  const typedMemberProjection=typedAuthorWiring.has(normalized+' -> '+resolved);
  if(author&&!(resolved.startsWith('src/author/')||authorEngine||typedMemberProjection||typeOnly&&(resolved.startsWith('src/core/')||resolved.startsWith('dist/')||specifier==='typescript')))report('author-boundary','Author algorithms must remain browser-safe and infrastructure independent: '+specifier);
  if(!python&&(resolved.startsWith('src/python/')||resolved.startsWith('dist/python/')||specifier==='pyodide'))report('python-isolation','Python runtime is currently author-probe infrastructure only; product and learner paths must not import it.');
  const nodePython=['src/python/node-parser.ts','src/python/node-worker.ts'].includes(normalized);
  if(python&&!(resolved.startsWith('src/python/')||resolved==='dist/author/python-parser.js'||nodePython&&(specifier.startsWith('node:')||specifier==='pyodide')))report('python-boundary','Parser infrastructure may use only its own modules and author DTO port; Node imports belong only to process entry points.');
  if(standalone&&!(resolved.startsWith('src/standalone/')||resolved==='dist/index.js'))report('standalone-boundary','The standalone practice engine may use only its own modules and the core\'s public interface: '+specifier);
  if(specifier==='node:vm'||specifier==='vm')report('no-execution','Production modules must never execute learner code.');
  if(headless.has(normalized)&&!typeOnly&&!(headless.has(resolved.replace(/\.js$/,'.ts'))||specifier==='../formatter.js'))report('presentation-headless','A headless module imports only headless modules, the formatter port and types: '+specifier);
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
  if(standalone&&ts.isIdentifier(node)&&['window','document','fetch','XMLHttpRequest','Worker','importScripts'].includes(node.text))report('standalone-boundary','The standalone practice engine names no DOM or network global: '+node.text);
  // ADR-134 (NY-28): the server API adapter is the presentation's one transport port; it may fetch, and nothing else may.
  const transportPort=normalized==='src/workbench/api.ts'&&ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='fetch';
  if(ui&&!transportPort&&ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['fetch','validateSubmission','compileCodeLineExercise','generateCodeLineExercise'].includes(node.expression.text))report('presentation-policy','Rendering must not own transport, author analysis or grading.');
  // ADR-151 (K1, K11): a property of that name (`event.window`) or a member being declared is not the global.
  const globalName=ts.isIdentifier(node)&&!(ts.isPropertyAccessExpression(node.parent)&&node.parent.name===node)&&!(ts.isPropertyAssignment(node.parent)&&node.parent.name===node)&&!(ts.isPropertySignature(node.parent)&&node.parent.name===node)?node.text:undefined;
  if(globalName&&headless.has(normalized)&&browserGlobals.has(globalName))report('presentation-headless','A headless module names no DOM or browser global: '+globalName);
  if(globalName&&environmentFree.has(normalized)&&environmentGlobals.has(globalName))report('presentation-environment','What draws from the state reads no environment while it draws: '+globalName);
  if(ui&&!htmlWriters.has(normalized)&&ts.isPropertyAccessExpression(node)&&['innerHTML','outerHTML','insertAdjacentHTML'].includes(node.name.text))report('presentation-dom-write','Raw HTML is written into the page by the view adapter only: '+node.name.text);
  if(ui&&!globalListeners.has(normalized)){
   const listens=ts.isCallExpression(node)&&(ts.isIdentifier(node.expression)&&node.expression.text==='addEventListener'||ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='addEventListener'&&ts.isIdentifier(node.expression.expression)&&['document','window','globalThis'].includes(node.expression.expression.text));
   const observes=ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&['ResizeObserver','MutationObserver','IntersectionObserver'].includes(node.expression.text);
   if(listens||observes)report('presentation-behavior','A listener on the document or the window, or an observer, belongs to a behaviour module that takes it off again.');
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);return out;
}
