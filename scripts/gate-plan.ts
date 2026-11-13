/** ADR-142: what a change has to be checked with, decided from the files it touched.
 *
 * Hidden here: which paths make every check necessary, which reach the browser, and how a unit test is tied to the files
 * it loads or names. The runner (gate.ts) gives the changed paths and each test's dependencies and gets the plan.
 *
 * The rule is conservative: a path this module does not know makes the plan full. */
export interface Plan {
 /** Why the plan is what it is, one line for the reader of the gate's output. */
 reason:string;
 full:boolean;
 /** The unit test files to run (repository-relative). */
 unit:string[];
 /** Whether the browser suites run. */
 browser:boolean;
}
/** A test file and what it depends on: files, and directories (ending in `/`) any file of which counts. */
export interface TestDependencies {test:string;files:ReadonlySet<string>;directories:readonly string[];}

/** A change to any of these is checked with everything.
 *  - The toolchain, the build and the checks' own harness can alter what every check does.
 *  - The risk classes whose evidence is the whole regression (docs/ai-governance.md): the core, the author analysis and
 *    the server that runs them, their generated output, the oracle and its fixtures, and the shipped examples. */
const EVERYTHING=[/^package(?:-lock)?\.json$/,/^tsconfig[^/]*\.json$/,/^scripts\//,/^\.gitattributes$/,/^\.editorconfig$/,
 /^src\/(?:core|author|server|python)\//,/^server\.mjs$/,/^dist\//,/^examples\//,/^tests\/(?:support|fixtures)\//];
/** What the browser loads or the server serves: a change here is seen only in a browser. */
const BROWSER=[/^src\//,/^public\//,/^dist\//,/^examples\//,/^server\.mjs$/,/^tests\/browser[-_]/,/^tests\/requirements-browser\.txt$/,/^docs\/schema\.json$/,/^docs\/python-runtime-manifest\.json$/];
/** Paths with no check of their own besides the tests that name them and the verifiers, which always run. */
const KNOWN=[...BROWSER,/^tests\//,/^docs\//,/^\.github\//,/^[^/]+\.md$/,/^LICENSE[^/]*$/,/^\.gitignore$/];
const matches=(patterns:readonly RegExp[],file:string):boolean=>patterns.some(pattern=>pattern.test(file));

/** The plan for a change. Scoping applies to the presentation and to documents and tooling only: there a unit test runs
 *  when a changed file is one it loads or names, and the browser suites run when the change reaches the page. */
export function planGate(changed:readonly string[],tests:readonly TestDependencies[],{full=false}:{full?:boolean}={}):Plan {
 const all=():string[]=>tests.map(item=>item.test);
 if(full)return {reason:'the whole regression was asked for (--full)',full:true,unit:all(),browser:true};
 const wide=changed.find(file=>matches(EVERYTHING,file));
 if(wide)return {reason:`${wide} is checked with the whole regression`,full:true,unit:all(),browser:true};
 const unknown=changed.find(file=>!matches(KNOWN,file));
 if(unknown)return {reason:`${unknown} is a path the gate does not know`,full:true,unit:all(),browser:true};
 const touched=(item:TestDependencies):boolean=>changed.some(file=>item.files.has(file)||item.directories.some(directory=>file.startsWith(directory)));
 const unit=tests.filter(touched).map(item=>item.test),browser=changed.some(file=>matches(BROWSER,file));
 const reason=!changed.length?'nothing differs from the pushed main: only the verifiers run'
  :`${changed.length} changed file${changed.length===1?'':'s'}: ${unit.length} of ${tests.length} unit test files depend on them; the browser suites ${browser?'run (the change reaches the page)':'are skipped (nothing the page loads changed)'}`;
 return {reason,full:false,unit,browser};
}
