/** ADR-124 (H2): writes the help page from its one source (src/workbench/help-topics.ts, as compiled) and the analysis'
 *  reason-code registry. The page is static: the server and the Pages build serve it as it is. */
import {mkdir,writeFile} from 'node:fs/promises';
// ADR-135 (NY-31): the page's examples are highlighted at build time with the app's vendored Prism; its scripts set the
// global `Prism` that the shared highlighter reads, so the page needs no script for it.
for(const grammar of ['prism-core','prism-clike','prism-javascript','prism-typescript'])await import(`../public/vendor/${grammar}.js`);
const {renderHelpPage}=await import('../public/app/help-topics.js');
import {REASON_CODES} from '../dist/author/reason-codes.js';

const out=new URL('../public/help/',import.meta.url);
await mkdir(out,{recursive:true});
await writeFile(new URL('index.html',out),renderHelpPage(REASON_CODES.map(({code,category,meaning})=>({code,category,meaning}))));
console.log(`Help page built: ${REASON_CODES.length} reason codes.`);
