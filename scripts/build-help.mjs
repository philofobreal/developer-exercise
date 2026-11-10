/** ADR-124 (H2): writes the help page from its one source (src/workbench/help-topics.ts, as compiled) and the analysis'
 *  reason-code registry. The page is static: the server and the Pages build serve it as it is. */
import {mkdir,writeFile} from 'node:fs/promises';
import {renderHelpPage} from '../public/app/help-topics.js';
import {REASON_CODES} from '../dist/author/reason-codes.js';

const out=new URL('../public/help/',import.meta.url);
await mkdir(out,{recursive:true});
await writeFile(new URL('index.html',out),renderHelpPage(REASON_CODES.map(({code,category,meaning})=>({code,category,meaning}))));
console.log(`Help page built: ${REASON_CODES.length} reason codes.`);
