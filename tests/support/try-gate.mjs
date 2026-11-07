/** ADR-108 (E6): tests pass the second gate (Rules → Try) like a well-behaved client: with the draft's
 *  reference source (the text the model was made from; for an imported model, its rows) and the policy
 *  it asked for, as the draft response reports it. */
const TOP_LEVEL=['inputs','keyOrder','classFields','importEmit'];
export function gateBody(draft,source){
 const requested=draft.policy?.requested??{};
 const top=Object.fromEntries(Object.entries(requested).filter(([key])=>TOP_LEVEL.includes(key)));
 const nested=Object.fromEntries(Object.entries(requested).filter(([key])=>!TOP_LEVEL.includes(key)));
 return {draftId:draft.draftId,source:source??draft.model.lines.map(line=>line.code).join('\n'),...top,...(Object.keys(nested).length?{policy:nested}:{})};
}
/** Passes the gate on a server catalog, a Pages API module or over HTTP (`post(path, body)`), and returns the draft. */
export async function admit(target,draft,source){
 const body=gateBody(draft,source);
 if(typeof target==='function')await target('/api/author/transition',body);
 else if(typeof target.transition==='function')await target.transition(body);
 else await target.authorTransition(body);
 return draft;
}
