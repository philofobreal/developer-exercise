/** Verify explicit boundaries, migration inventory and generated-source ownership. */
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {inspectModule,type Violation} from './architecture-rules.js';
interface Policy {legacyJavaScript:string[];generated:Record<string,string>;}
const policy:Policy=JSON.parse(await readFile('docs/architecture-policy.json','utf8'));
async function files(directory:string):Promise<string[]>{const entries=await readdir(directory,{withFileTypes:true});const nested=await Promise.all(entries.filter(entry=>entry.name!=='vendor').map(entry=>entry.isDirectory()?files(directory+'/'+entry.name):Promise.resolve([directory+'/'+entry.name])));return nested.flat();}
const production=[...(await files('src')),...(await files('public')).filter(file=>/\.(?:js|mjs)$/.test(file)),'server.mjs'];
const errors:Violation[]=[];const generated=new Set(Object.values(policy.generated));
for(const file of production){if(!/\.(?:ts|js|mjs)$/.test(file))continue;const source=await readFile(file,'utf8');if(!generated.has(file)&&!file.endsWith('.d.ts'))errors.push(...inspectModule(file,source));if(/\.(?:js|mjs)$/.test(file)&&!generated.has(file)&&!policy.legacyJavaScript.includes(file))errors.push({file,rule:'native-typescript',message:'New production implementation must be TypeScript or registered compiler output.'});}
const configFile=ts.readConfigFile('tsconfig.workbench.json',ts.sys.readFile);const config=ts.parseJsonConfigFileContent(configFile.config,ts.sys,process.cwd());
for(const [source,output] of Object.entries(policy.generated)){
 const emitted=ts.transpileModule(await readFile(source,'utf8'),{compilerOptions:config.options,fileName:source}).outputText;
 const actual=await readFile(output,'utf8');const normalize=(text:string):string=>text.replace(/\r\n?/g,'\n').trimEnd();
 if(normalize(emitted)!==normalize(actual))errors.push({file:output,rule:'generated-output',message:'Edit '+source+' and rebuild instead of changing compiler output.'});
}
for(const file of ['AGENTS.md','docs/ai-governance.md',...(await files('docs/adr')).filter(file=>file.endsWith('.md'))]){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(await readFile(file));if(!text.trim()||text.includes('\0'))throw Error('Invalid governance record: '+file);
 for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const link=match[1];if(!link||/^(https?:|#|mailto:)/.test(link))continue;const target=path.resolve(path.dirname(file),decodeURIComponent(link.split('#')[0]??''));if(!(await stat(target)).isFile())throw Error('Broken governance link: '+file+': '+link);}
}
if(errors.length){for(const error of errors)console.error(`${error.file}: ${error.rule}: ${error.message}`);process.exitCode=1;}else console.log(`Architecture verified: ${production.length} production files, ${Object.keys(policy.generated).length} TypeScript-owned browser outputs, explicit legacy inventory.`);
