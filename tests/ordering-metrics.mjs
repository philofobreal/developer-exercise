/** Manual runner: node tests/ordering-metrics.mjs [output.json] [--policy=call-only]
 *                node tests/ordering-metrics.mjs --baseline
 * Measures the CURRENT generator on the fixed corpus and prints Markdown tables:
 * per fixture, totals for the whole corpus and for the WP6 reproduction subset,
 * and the synthetic large references (generation and reference validation).
 * The oracle policy defaults to 'reflective' (ADR-010); 'call-only' reproduces
 * the earlier P0–P3 semantics so that old and new numbers stay comparable.
 * --baseline rewrites tests/fixtures/ordering-baseline.json, the pinned
 * completeness numbers of semantic-corpus.test.mjs; do it only deliberately
 * and review the diff (a lower gap count is an improvement, a higher one a regression). */
import {writeFile} from 'node:fs/promises';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {measureFixture,CORPUS_CAPS,pinned,largeReferences,measureLarge} from './support/ordering-metrics.mjs';

if(process.argv[2]==='--baseline'){
 const baseline=Object.fromEntries([...corpus.values()].map(fixture=>[fixture.id,pinned(measureFixture(fixture,CORPUS_CAPS))]));
 await writeFile(new URL('./fixtures/ordering-baseline.json',import.meta.url),JSON.stringify(baseline,null,1)+String.fromCharCode(10));
 console.log('baseline written for',Object.keys(baseline).length,'fixtures');process.exit(0);
}
const policy=process.argv.find(arg=>arg.startsWith('--policy='))?.slice(9)??'reflective',output=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
const rows=[...corpus.values()].map(fixture=>measureFixture(fixture,{policy}));
const large=Object.entries(largeReferences()).map(([name,source])=>measureLarge(name,source));
const sum=(set,key)=>set.reduce((total,row)=>total+row[key],0);
const summarise=set=>({fixtures:set.length,orders:sum(set,'orders'),unsound:sum(set,'unsound'),undecidedAccepted:sum(set,'undecidedAccepted'),neighbours:sum(set,'neighbours'),accepted:sum(set,'accepted'),completenessGaps:sum(set,'completenessGaps'),justifiedRejections:sum(set,'justifiedRejections'),undecided:sum(set,'undecided'),indeterminate:sum(set,'indeterminate'),
 unsupportedFixtures:set.filter(row=>row.unsupported).length,unsupportedGaps:sum(set.filter(row=>row.unsupported),'completenessGaps'),edges:sum(set,'edges'),redundant:sum(set,'redundant'),redundantRatio:+(sum(set,'redundant')/sum(set,'edges')).toFixed(4),states:sum(set,'states'),generationMs:+sum(set,'generationMs').toFixed(1)});
const totals={policy,all:summarise(rows),core:summarise(rows.filter(row=>!['wp6','reflection','precision'].includes(row.origin))),wp6:summarise(rows.filter(row=>row.origin==='wp6')),reflection:summarise(rows.filter(row=>row.origin==='reflection')),precision:summarise(rows.filter(row=>row.origin==='precision'))};
console.log('| fixture | rows | edges | A(M) orders | unsound | neighbour accepted | gaps | justified |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for(const row of rows)console.log(`| ${row.id} | ${row.rows} | ${row.edges} | ${row.orders}${row.ordersExhaustive?'':' (sample)'} | ${row.unsound} | ${row.accepted} | ${row.completenessGaps} | ${row.justifiedRejections} |`);
console.log(JSON.stringify(totals,null,1));
console.log('| large shape | rows | edges | redundant | generation ms | reference states | validation ms |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for(const row of large)console.log(`| ${row.shape} | ${row.rows} | ${row.edges} | ${row.redundant} | ${row.generationMs} | ${row.referenceStates} | ${row.validationMs} |`);
for(const row of rows)if(row.unsound)console.log('UNSOUND',row.id,JSON.stringify(row.counterexamples));
if(output)await writeFile(output,JSON.stringify({totals,large,rows},null,1)+'\n');
