/** Manual long generative campaign (not part of check:all):
 *   node tests/ordering-campaign.mjs [--from=1] [--to=200] [--kinds=class,script,function,object,flow]
 *        [--languages=javascript,typescript] [--output=campaign.json]
 *   node tests/ordering-campaign.mjs --baseline   (pins the quick check's thresholds)
 * For every seeded program it grades sampled linear extensions, the single-row
 * neighbourhood and every whole-unit block move with the structural validator and
 * classifies them with the reflective oracle. Runtime comparison happens ONLY on
 * these fixed, always-terminating generated programs; learners are never involved.
 * Rows are grouped by kind, language, policy version and whether the reference threw,
 * with the gap rate and the ranked causes of the gaps (support/generative-metrics.mjs).
 * A soundness violation is printed at once, minimised and with its source, so a
 * long run never loses it to output buffering. Exit code 1 if any was found. */
import {writeFile} from 'node:fs/promises';
import {measureCampaign,QUICK} from './support/generative-metrics.mjs';

// --baseline rewrites tests/fixtures/generative-baseline.json with the pinned quick
// configuration; do it only deliberately and review the diff (a higher gap rate is a regression).
if(process.argv.includes('--baseline')){
 const {rows,violations}=measureCampaign(QUICK);
 if(violations)throw Error('unsound orders found; fix them before pinning a baseline');
 const baseline=Object.fromEntries(rows.map(row=>[[row.kind,row.language,row.policy,row.throws?'throws':'returns'].join(' '),{programs:row.programs,orders:row.orders,gap:row.gap,gapRate:row.gapRate}]).sort(([a],[b])=>a.localeCompare(b)));
 await writeFile(new URL('./fixtures/generative-baseline.json',import.meta.url),JSON.stringify(baseline,null,1)+'\n');
 console.log('generative baseline written for',Object.keys(baseline).length,'groups');process.exit(0);
}
const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const from=Number(option('from','1')),to=Number(option('to','200')),kinds=option('kinds','class,script,function,object,flow').split(','),languages=option('languages','javascript,typescript').split(','),output=option('output',null);
const {rows,violations}=measureCampaign({from,to,kinds,languages,onUnsound:({id,reason,minimal,source})=>console.log(`UNSOUND ${id} (${reason}) minimal order ${minimal.join(',')}\n${source.join('\n')}\n`)});
for(const row of rows)console.log(JSON.stringify(row));
if(output)await writeFile(output,JSON.stringify({from,to,rows},null,1)+'\n');
process.exitCode=violations?1:0;
