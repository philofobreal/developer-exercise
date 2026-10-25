/** Manual runner: node tests/ordering-metrics.mjs [output.json]
 *                node tests/ordering-metrics.mjs --baseline
 * Measures the CURRENT generator on the fixed corpus and prints a Markdown table.
 * --baseline rewrites tests/fixtures/ordering-baseline.json, the pinned
 * completeness numbers of semantic-corpus.test.mjs; do it only deliberately
 * and review the diff (a lower gap count is an improvement, a higher one a regression). */
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {measureFixture,generate,CORPUS_CAPS,pinned} from './support/ordering-metrics.mjs';

if(process.argv[2]==='--baseline'){
 const baseline=Object.fromEntries([...corpus.values()].map(fixture=>[fixture.id,pinned(measureFixture(fixture,CORPUS_CAPS))]));
 await writeFile(new URL('./fixtures/ordering-baseline.json',import.meta.url),JSON.stringify(baseline,null,1)+String.fromCharCode(10));
 console.log('baseline written for',Object.keys(baseline).length,'fixtures');process.exit(0);
}
const rows=[...corpus.values()].map(fixture=>measureFixture(fixture));
const big={id:'large-500',language:'javascript',source:['function large() {',...Array.from({length:498},(_,i)=>`  const value${i} = ${i};`),'}']};
const started=performance.now();generate(big);const largeMs=+(performance.now()-started).toFixed(1);
const sum=key=>rows.reduce((total,row)=>total+row[key],0);
const totals={fixtures:rows.length,orders:sum('orders'),unsound:sum('unsound'),undecidedAccepted:sum('undecidedAccepted'),neighbours:sum('neighbours'),accepted:sum('accepted'),completenessGaps:sum('completenessGaps'),justifiedRejections:sum('justifiedRejections'),undecided:sum('undecided'),indeterminate:sum('indeterminate'),edges:sum('edges'),redundant:sum('redundant'),states:sum('states'),generationMs:+sum('generationMs').toFixed(1),largeMs};
console.log('| fixture | rows | edges | A(M) orders | unsound | neighbour accepted | gaps | justified |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for(const row of rows)console.log(`| ${row.id} | ${row.rows} | ${row.edges} | ${row.orders}${row.ordersExhaustive?'':' (sample)'} | ${row.unsound} | ${row.accepted} | ${row.completenessGaps} | ${row.justifiedRejections} |`);
console.log(JSON.stringify(totals,null,1));
for(const row of rows)if(row.unsound)console.log('UNSOUND',row.id,JSON.stringify(row.counterexamples));
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify({totals,rows},null,1)+'\n');
