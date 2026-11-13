/** ADR-142: the local gate before a push. `npm run gate` builds once, then runs what the change needs: the verifiers,
 * the unit tests that depend on a changed file, and (when the change reaches the page) the browser suites, several at a
 * time. `npm run gate -- --full` runs everything, as CI does.
 *
 *   --full        every unit test and every browser suite, whatever changed
 *   --since=REF   compare with REF instead of the pushed main (origin/main)
 *   --jobs=N      browser suites at a time (default: the cores, at most 4)
 *   --files=A,B   plan for these changed files instead of asking git (to see what a change would run)
 *   --dry         print the plan and stop
 *
 * Hidden here: how the changed files are found, how a test's dependencies are read from its sources, and how the
 * commands of package.json are run and reported. What a change needs is gate-plan.ts's. The commands themselves stay
 * package.json's: this file reads `check` and `test:browser:all` and adds none of its own. */
import {spawn,spawnSync} from 'node:child_process';
import {createWriteStream,existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {planGate,type TestDependencies} from './gate-plan.js';

const ROOT=process.cwd(),LOGS=path.join(ROOT,'test-results','gate');
const option=(name:string):string|undefined=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
const flag=(name:string):boolean=>process.argv.includes(`--${name}`);
const posix=(file:string):string=>file.split(path.sep).join('/');

// ── The commands, from package.json ──
const scripts=(JSON.parse(readFileSync(path.join(ROOT,'package.json'),'utf8')) as {scripts:Record<string,string>}).scripts;
/** The commands a script runs, in order, with every `npm run x` replaced by x's own commands. */
function leaves(name:string):string[] {
 const script=scripts[name];if(script===undefined)throw Error(`package.json has no script "${name}"`);
 return script.split('&&').map(part=>part.trim()).filter(Boolean).flatMap(part=>{const inner=/^npm run (\S+)$/.exec(part);return inner?leaves(inner[1]!):[part];});
}
const built=new Set(leaves('build:pages')),isUnit=(command:string):boolean=>command.startsWith('node --test ');
const verifiers=leaves('check').filter(command=>!built.has(command)&&!isUnit(command));
const suites=leaves('test:browser:all');

// ── What changed ──
function git(...args:string[]):string|null {
 const result=spawnSync('git',args,{cwd:ROOT,encoding:'utf8'});
 return result.status===0?result.stdout:null;
}
/** Everything that differs from the base: committed, staged, unstaged and untracked (ignored files excepted).
 *  `null`: the base is not known, so nothing can be left out. */
function changedFiles(since:string):string[]|null {
 const base=git('merge-base','HEAD',since)?.trim();if(!base)return null;
 const tracked=git('diff','--name-only',base),untracked=git('ls-files','--others','--exclude-standard');
 if(tracked===null||untracked===null)return null;
 return [...new Set([...tracked.split('\n'),...untracked.split('\n')].map(line=>line.trim()).filter(Boolean))].sort();
}

// ── What each unit test depends on ──
const TOP=new Set(readdirSync(ROOT));
interface Scan {imports:string[];files:string[];directories:string[];}
const scans=new Map<string,Scan>();
/** A repository path a string names, if it exists: relative to the file that holds it, else to the repository. */
function named(text:string,from:string):string|null {
 if(text.length<2||text.length>200||/[\s*?<>|]/.test(text)||text.includes('node_modules'))return null;
 const relative=text.startsWith('./')||text.startsWith('../');
 if(!relative&&!text.includes('/')&&!TOP.has(text))return null;
 const target=path.resolve(relative?path.dirname(from):ROOT,text);
 if(target!==ROOT&&!target.startsWith(ROOT+path.sep))return null;
 return existsSync(target)?target:null;
}
/** A source file's static imports, and the files and directories its strings name (a test reads its fixtures, the
 *  examples, a stylesheet by path). A template's path counts up to its first `${`, as the directory it starts in. */
function scan(file:string):Scan {
 const known=scans.get(file);if(known)return known;
 const result:Scan={imports:[],files:[],directories:[]};scans.set(file,result);
 let source:string;try{source=readFileSync(file,'utf8');}catch{return result;}
 for(const match of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"\n]+)['"]/g)){
  const specifier=match[1]!;if(!specifier.startsWith('.'))continue;
  const target=path.resolve(path.dirname(file),specifier);if(existsSync(target)&&statSync(target).isFile())result.imports.push(target);
 }
 for(const match of source.matchAll(/(['"`])((?:(?!\1)[^\n\\])+)\1/g)){
  let text=match[2]!;
  if(match[1]==='`'&&text.includes('${')){text=text.slice(0,text.indexOf('${'));text=text.slice(0,text.lastIndexOf('/')+1);if(!text)continue;}
  const target=named(text.replace(/[?#].*$/,''),file);if(!target)continue;
  if(statSync(target).isDirectory())result.directories.push(target===ROOT?'':posix(path.relative(ROOT,target))+'/');
  else result.files.push(posix(path.relative(ROOT,target)));
 }
 return result;
}
function dependencies(test:string):TestDependencies {
 const files=new Set<string>(),directories=new Set<string>(),seen=new Set<string>(),queue=[path.join(ROOT,test)];
 while(queue.length){
  const file=queue.pop()!;if(seen.has(file))continue;seen.add(file);files.add(posix(path.relative(ROOT,file)));
  if(!/\.(?:m?js|ts)$/.test(file))continue;
  const found=scan(file);for(const name of found.files)files.add(name);for(const name of found.directories)directories.add(name);
  queue.push(...found.imports);
 }
 return {test,files,directories:[...directories]};
}

// ── Running ──
interface Outcome {name:string;ok:boolean;seconds:number;log:string;passed:number;}
function run(name:string,command:string):Promise<Outcome> {
 return new Promise(resolve=>{
  const log=path.join(LOGS,name.replace(/[^a-z0-9.-]+/gi,'-')+'.log'),out=createWriteStream(log),started=Date.now();let passed=0;
  const child=spawn(command,{cwd:ROOT,shell:true,stdio:['ignore','pipe','pipe']});
  const count=(chunk:Buffer):void=>{out.write(chunk);passed+=(chunk.toString('utf8').match(/^PASS /gm)??[]).length;};
  child.stdout.on('data',count);child.stderr.on('data',chunk=>out.write(chunk));
  child.on('close',code=>{out.end();const outcome={name,ok:code===0,seconds:Math.round((Date.now()-started)/1000),log,passed};
   console.log(`${outcome.ok?'✓':'✗'} ${name}${passed?` · ${passed} cases`:''} · ${outcome.seconds}s`);resolve(outcome);});
 });
}
/** Runs the tasks, at most `jobs` at a time, each started as soon as a place is free. */
async function pool(tasks:readonly (()=>Promise<Outcome>)[],jobs:number):Promise<Outcome[]> {
 const outcomes:Outcome[]=[];let next=0;
 await Promise.all(Array.from({length:Math.min(jobs,tasks.length)},async()=>{while(next<tasks.length){const task=tasks[next++]!;outcomes.push(await task());}}));
 return outcomes;
}
/** How long each suite took the last time here (test-results is not tracked): the longest start first, so the last
 *  place to free up is not left waiting for the longest suite. */
const TIMES=path.join(LOGS,'durations.json');
function lastTimes():Record<string,number> {try{return JSON.parse(readFileSync(TIMES,'utf8')) as Record<string,number>;}catch{return {};}}
const suiteName=(command:string):string=>(/tests\/(browser-[\w-]+?)\.playwright\.py(.*)$/.exec(command)??[]).slice(1).join('').replace(/\s+--/g,' ').trim()||command;

const started=Date.now(),since=option('since')??'origin/main';
const changed=flag('full')?[]:option('files')?.split(',').filter(Boolean)??changedFiles(since);
const tests=readdirSync(path.join(ROOT,'tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>dependencies('tests/'+name));
const plan=planGate(changed??[],tests,{full:flag('full')||changed===null});
const jobs=Math.max(1,Number(option('jobs'))||Math.min(4,os.availableParallelism()));
console.log(`gate: ${changed===null?`${since} is not known here, so nothing is left out`:plan.reason}`);
if(changed?.length&&!plan.full)console.log(changed.map(file=>'  '+file).join('\n'));
console.log(`gate: ${verifiers.length} verifiers, ${plan.unit.length}/${tests.length} unit test files, ${plan.browser?`${suites.length} browser suites, ${jobs} at a time`:'no browser suite'}`);
if(flag('dry')){if(!plan.full&&plan.unit.length)console.log(plan.unit.map(file=>'  '+file).join('\n'));process.exit(0);}
mkdirSync(LOGS,{recursive:true});
const outcomes:Outcome[]=[];
for(const command of verifiers)outcomes.push(await run(command.replace(/^node (?:dist-tools|scripts)\//,'').replace(/\.m?js$/,''),command));
// node --test runs one file fewer at a time than there are cores; the gate runs nothing else beside it.
if(plan.unit.length)outcomes.push(await run('unit tests',`node --test --test-concurrency=${os.availableParallelism()} ${plan.unit.join(' ')}`));
if(plan.browser){
 const times=lastTimes(),order=[...suites].sort((a,b)=>(times[suiteName(b)]??0)-(times[suiteName(a)]??0));
 const ran=await pool(order.map(command=>()=>run(suiteName(command),command)),jobs);outcomes.push(...ran);
 writeFileSync(TIMES,JSON.stringify({...times,...Object.fromEntries(ran.map(outcome=>[outcome.name,outcome.seconds]))},null,1)+'\n');
}
const failed=outcomes.filter(outcome=>!outcome.ok);
for(const outcome of failed){
 console.log(`\n── ${outcome.name} failed; the end of ${posix(path.relative(ROOT,outcome.log))}:`);
 console.log(readFileSync(outcome.log,'utf8').trimEnd().split('\n').slice(-25).join('\n'));
}
console.log(`\ngate: ${failed.length?`${failed.length} of ${outcomes.length} failed`:`all ${outcomes.length} passed`} in ${Math.round((Date.now()-started)/1000)}s${plan.full?'':' (scoped to the change; --full runs everything)'}`);
process.exit(failed.length?1:0);
