/** Author-only publication audit: the trusted catalog's own admission and gate (ADR-035), under
 * the policy named by `CODELINE_PUBLICATION`. Every example must be served; a refusal fails. */
import {ExerciseCatalog,publicationPolicy} from '../src/server/catalog.mjs';
const dir=process.argv[2]??'examples',publication=publicationPolicy(process.env.CODELINE_PUBLICATION);
const catalog=await ExerciseCatalog.open(dir,{publication}).catch(error=>{console.error(`✗ ${error.message}`);process.exit(1);});
for(const {file,verification} of [...catalog.trusted.values()].sort((a,b)=>a.file.localeCompare(b.file)))console.log(`✓ ${file}: admitted, reference accepted, language audit ${verification.checks.audit}, ${verification.status}`);
for(const {file,status,reason} of catalog.skipped)console.error(`✗ ${file} [${status}]: ${reason}`);
if(catalog.skipped.length){console.error(`${catalog.skipped.length} exercise(s) refused for publication (${publication}).`);process.exit(1);}
console.log(`${catalog.trusted.size} exercises verified for publication (${publication}).`);
