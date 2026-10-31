/** Fail publication on malformed UTF-8, NULs or broken local Markdown links (ADRs included, ADR-049). */
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const files=['README.md','CHANGELOG.md','LICENSE-STATUS.md','AGENTS.md',...(await readdir('docs')).filter(x=>x.endsWith('.md')).map(x=>'docs/'+x),...(await readdir('docs/adr')).filter(x=>x.endsWith('.md')).map(x=>'docs/adr/'+x)];
for(const file of files){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(await readFile(file));
 if(text.includes('\0'))throw Error('NUL in '+file);
 for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
  const link=match[1];if(/^(https?:|#|mailto:)/.test(link))continue;
  const target=path.resolve(path.dirname(file),decodeURIComponent(link.split('#')[0]));
  if(!(await stat(target)).isFile())throw Error('Broken link in '+file+': '+link);
 }
}
console.log(`${files.length} UTF-8 documents and local links verified.`);
