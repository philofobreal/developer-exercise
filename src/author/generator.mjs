/** Author entry point (ADR-011, ADR-013): validates the input, lets the language
 * adapter parse and analyse it, and hands structure and ordering relations to the
 * typed, language-independent CodeLine v2 projection. */
import {AuthoringError} from './errors.mjs';
import {getLanguageAdapter} from './languages.mjs';
import {projectCodeLine,projectedRows} from '../../dist/author/code-line-projection.js';
export {AuthoringError} from './errors.mjs';
/** The generation-rule version (formal contract, policy versions); provenance is bound to it (ADR-015). */
export const DEPENDENCY_POLICY='scoped-effect-analysis-v52';
const POLICY=DEPENDENCY_POLICY;
/** `importEmit` (TypeScript only, ADR-013): 'verbatim' (default; unknown build) keeps every
 * non-`import type` import in order, 'elide-unused' is TypeScript's default emit.
 * `inputs` (ADR-050): 'any' (default) lets a caller pass any value; 'valid' assumes valid plain data.
 * `keyOrder` (ADR-055): 'observed' (default) keeps the creation order of object keys when the program can
 * see it; 'ignored' is the author's choice that key order is not part of the exercise.
 * `classFields` (ADR-075): 'either' (default) holds in both class-field modes; 'define' is the author's
 * statement that fields are created as standard JavaScript defines them ([[Define]]), as native class
 * fields and TypeScript with useDefineForClassFields do. */
export function generateCodeLineExercise({source,language='javascript',title='Saját feladat',description='Rendezd sorba a programkódot.',level,importEmit='verbatim',inputs='any',keyOrder='observed',classFields='either'},ts){
 // ADR-101: the difficulty is the author's metadata, carried as given; absent or empty means unclassified.
 if(level!==undefined&&level!==''&&!['beginner','intermediate','advanced'].includes(level))throw new AuthoringError('Ismeretlen szint.');
 const adapter=getLanguageAdapter(language);
 if(typeof source!=='string'||source.length>50_000)throw new AuthoringError('Túl hosszú vagy hiányzó forráskód (maximum 50 KB).');
 const normalized=source.replace(/\r\n?/g,'\n').trimEnd();
 if(!['verbatim','elide-unused'].includes(importEmit))throw new AuthoringError('Ismeretlen import-emit beállítás.');
 if(!['any','valid'].includes(inputs))throw new AuthoringError('Ismeretlen bemeneti szerződés.');
 if(!['observed','ignored'].includes(keyOrder))throw new AuthoringError('Ismeretlen kulcssorrend-beállítás.');
 if(!['either','define'].includes(classFields))throw new AuthoringError('Ismeretlen osztálymező-beállítás.');
 if(!normalized.trim()||/[\u2028\u2029]/.test(normalized))throw new AuthoringError('Üres forrás vagy nem támogatott sorhatár.');
 const ast=adapter.parse(normalized,ts),physical=normalized.split('\n'),exact=adapter.whitespace(ast,ts);
 const rows=projectedRows(physical,exact);
 if(rows.length>500||rows.some(x=>x.code.length>2048))throw new AuthoringError('Legfeljebb 500 sor és soronként 2048 karakter támogatott.');
 const ordering=adapter.orderingRelations?.(ast,ts,{imports:importEmit,inputs,keyOrder,classFields}),environment=adapter.environment?.(ast,ts,{imports:importEmit,inputs,keyOrder,classFields})??{};
 const {lines,blocks,edges,omittedBlocks,provenance,sourceDigest,projectionLoss}=projectCodeLine({physical,exact,structure:adapter.structure(ast,ts),ordering});
 return {schemaVersion:2,id:'draft',revision:1,language,title:String(title).slice(0,140)||'Saját feladat',description:String(description).slice(0,500),...(level?{level}:{}),lines,blocks,edges,profiles:[],authoring:{strategy:'ast-hierarchy',reason:omittedBlocks?'shared-physical-boundaries':'',omittedBlocks,semanticEquivalenceProven:false,dependencyPolicy:POLICY,...(provenance.length<=10_000?{provenance}:{}),evidence:{sourceDigest,analyzer:POLICY,environment,projectionLoss},...(ordering?.note?{note:ordering.note}:{}),dependencyHints:adapter.analyzeDependencies?.(ast,ts)??[]}};
}
