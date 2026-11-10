/** Author rule panel (ADR-021). It presents the core's explanation of the author's own draft
 * and turns author intent into typed rule edits (ADR-018). Whether an edit is admissible, what
 * it costs and what it changes are the core's answers, as is the model's qualification
 * (ADR-017): nothing here derives a graph rule. The panel exists only for an admitted author
 * draft and never in learner preview, which is UI isolation, not authorization. */
import {highlight} from './ui-utilities.js';
import {availability,disabledAttributes} from './availability.js';
/** ADR-120: an editing control carries the rule editor's availability (one draft at a time). */
const editGate=(state:WorkbenchState):string=>disabledAttributes(availability(state,'rule-edit'));
import type {CodeLineExercise,ConstraintCategory,DirectConstraint,Editability,EditEffect,RemovalRequirement,RuleEdit,RuleEditResult,VerificationStatus} from '../../dist/index.js';
import type {AuthorInsight,RuleKindSelection,RuleSelection,WorkbenchState} from './contracts.js';
import {escapeHtml as esc} from './ui-utilities.js';
import {icon} from './icons.js';
import {renderFindingGroups} from './preflight-settings.js';
import {renderInfo} from './help-topics.js';

const editabilityLabel:Record<Editability,string>={hard:'Szerkezeti',proven:'Bizonyított',conservative:'Konzervatív',pedagogical:'Szerzői',legacy:'Ismeretlen eredetű'};
const categoryLabel:Record<ConstraintCategory,string>={structure:'szerkezet',unit:'egység',data:'adatfüggés',effect:'hatás',policy:'sorrendpolitika',conservative:'konzervatív becslés',author:'szerzői szabály',unknown:'ismeretlen eredet'};
const statusLabel:Record<VerificationStatus,string>={'analysis-verified':'Elemzéssel igazolt',conservative:'Konzervatív','author-modified':'Szerzői döntéssel módosított',unverified:'Nem igazolt'};
const basisLabel={checked:'ellenőrizve',tested:'tesztelt (generátor)','not-established':'nem megállapított',refuted:'cáfolt'} as const;
const auditLabel={ok:'Nincs nyelvi hiba ebben az egyfájlos kontextusban.',errors:'A referencia nyelvi hibát tartalmaz.',unverifiable:'Projektkontextus nélkül nem ellenőrizhető.','not-run':'A nyelvi audit nem futott (a statikus demó nem tartalmaz szabványos könyvtárat).'} as const;
const refreshOutcome={reapplied:'újra alkalmazva',revoked:'visszavonva: az új elemzés erősebb kényszert talált',implied:'már csak tranzitív következmény',obsolete:'tárgytalan: nincs már ilyen kényszer',
 reconfirm:'nincs alkalmazva: a forrás megváltozott a jóváhagyás óta, ezért a kényszer visszakerült; ha a lazítás továbbra is helyes, távolítsd el újra megerősítéssel',
 unchecked:'újra alkalmazva, de régi lazítás: nem tudni, milyen forrásra hagyták jóvá; mostantól a forrás változását figyeli'} as const;
const effectLabel={yes:'igen',no:'nem (bizonyítva)',maybe:'nem eldöntött (korlátos tanúkeresés)'} as const;
const provenanceNotice={complete:'',partial:'Néhány szabálynak nincs ismert oka; ezek ismeretlen eredetűként jelennek meg.',
 absent:'A modellnek nincs provenienciája: régi vagy importált modell, vagy olyan nagy, hogy a generátor nem menti az okokat. Minden generált szabály ismeretlen eredetű, ezért eltávolításuk policy-felülírást kér. Az Adatmodell nézet „Sorfüggőségek újraszámítása” gombja újra levezeti az okokat.',
 unbound:'A proveniencia nem ezekhez a sorokhoz tartozik, mert a kód a generálás óta változott. Minden generált szabály ismeretlen eredetű, amíg az Adatmodell nézet „Sorfüggőségek újraszámítása” gombja újra nem köti.'} as const;
const clip=(code:string,limit:number):string=>code.length>limit?code.slice(0,limit-1)+'…':code;
/** Plain text (an <option> holds no markup) and highlighted code (ADR-121) of the same clipped line. */
const snippet=(code:string,limit=120):string=>esc(clip(code,limit));
const codeSnippet=(code:string,language:string,limit=120):string=>highlight(clip(code,limit),language);
const badge=(status:VerificationStatus):string=>`<span class="verification-badge status-${status}" data-verification-status>${statusLabel[status]}</span>`;

interface Context {model:CodeLineExercise;constraints:DirectConstraint[];meanings:Readonly<Record<string,string>>;}
function context(state:WorkbenchState):Context|null {
 if(state.learnerPreview||!state.previews.has(state.active??''))return null;
 const model=state.authorModel,rules=state.authorInsight?.rules;
 // A sheet saved before ADR-054 has no meanings; the codes still show.
 return model&&rules?{model,constraints:rules.constraints,meanings:rules.meanings??{}}:null;
}
export const rulesAvailable=(state:WorkbenchState):boolean=>!!context(state);
/** How each removable class of rule is lifted; mirrors the acknowledgement the core asks for (ADR-018). */
/** ADR-065: the step that lifts a rule, by the core's removal requirement (DirectConstraint.removal). */
const liftStep:Record<Exclude<RemovalRequirement,'impossible'>,string>={
 'policy-override':'Eltávolítás, majd „Policy-felülírás megerősítése” indoklással. A modell ezután eltér a sorrendpolitikától, ezért „Nem igazolt” minősítést kap.',
 'unproven-relaxation':'Eltávolítás, majd „Nem bizonyított lazítás megerősítése” indoklással.',
 none:'Eltávolítás: ez a te szabályod, megerősítés nélkül törölhető.'
};
/** ADR-056: the removable rules grouped by their one reason code, largest group first. A rule with
 * several reasons is lifted one by one in the panel, so no group decides for another reason. */
function ruleKinds(found:Context):{code:string;rules:DirectConstraint[];editability:Exclude<Editability,'hard'>;removal:Exclude<RemovalRequirement,'impossible'>}[] {
 const groups=new Map<string,DirectConstraint[]>();
 for(const c of found.constraints){
  const codes=[...new Set(c.reasons.map(reason=>reason.code))];
  if(c.removal==='impossible'||codes.length!==1)continue;
  groups.set(codes[0]!,[...(groups.get(codes[0]!)??[]),c]);
 }
 return [...groups].map(([code,rules])=>({code,rules,editability:rules[0]!.editability as Exclude<Editability,'hard'>,removal:rules[0]!.removal as Exclude<RemovalRequirement,'impossible'>})).sort((a,b)=>b.rules.length-a.rules.length||a.code.localeCompare(b.code));
}
/** ADR-056: the rule kinds of the author's model, each liftable in one confirmed step. */
export function renderRuleKinds(state:WorkbenchState):string {
 const found=context(state);
 if(!found)return '';
 const kinds=ruleKinds(found),pending=state.ruleKind,mixed=found.constraints.filter(c=>c.removal!=='impossible'&&new Set(c.reasons.map(reason=>reason.code)).size>1).length;
 if(!kinds.length&&!pending?.message)return '';
 const item=({code,rules,editability,removal}:ReturnType<typeof ruleKinds>[number]):string=>{
  const meaning=found.meanings[code],confirming=pending?.code===code&&!pending.message;
  const confirm=confirming?`<div class="rule-confirm" data-rule-kind-form role="group" aria-label="${rules.length} szabály feloldásának megerősítése"><p>${esc(liftStep[removal])}</p><label>Indoklás, amely a lazításokkal együtt a modellbe kerül<input data-rule-kind-note maxlength="500" autocomplete="off"></label><div class="rule-confirm-actions"><button type="button"${editGate(state)} class="btn danger" data-rule-kind-confirm="${esc(code)}">${rules.length} szabály feloldása</button><button type="button" class="btn" data-rule-kind-cancel>Mégse</button></div></div>`:'';
  return `<li class="rule-kind editability-${editability}" data-rule-kind-item="${esc(code)}"><div class="rule-kind-main"><span class="rule-badge">${editabilityLabel[editability]}</span><b>${esc(meaning??categoryLabel[rules[0]!.reasons[0]!.category])}</b> <code>${esc(code)}</code><span class="rule-kind-count">${rules.length} szabály: ${rules.slice(0,6).map(c=>`#${c.before}→#${c.after}`).join(', ')}${rules.length>6?', …':''}</span></div>${confirming?'':`<button type="button" data-rule-kind="${esc(code)}">Mind feloldása</button>`}${confirm}</li>`;
 };
 return `<details class="rule-kinds" data-rule-kinds${pending?' open':''}><summary>Szabályok típus szerint · ${kinds.length} típus, egy lépésben feloldhatók</summary>${renderInfo('rule-kinds','Szabályok típus szerint')}<p class="inline-hint">Ha egy szabálytípus a feladatban nem számít, itt egyszerre feloldhatod az összes ilyen szabályt; egyenként a sor láncszem gombjával is lehet. Ha a kulcsok sorrendje nem számít, inkább a Forrás lépés „Objektumkulcsok sorrendje: Nem számít” beállítását válaszd: az az egész feladatra érvényes, és a modell „Elemzéssel igazolt” marad, míg a bizonyított szabályok feloldása „Nem igazolt” minősítést ad.${mixed?` ${mixed} több okú szabály csak egyenként oldható fel.`:''}</p><ul class="rule-kind-list">${kinds.map(item).join('')}</ul>${pending?.message?`<p class="rule-status" role="status">${esc(pending.message)}</p>`:''}</details>`;
}
/** ADR-056: the confirmed removal of every rule of one kind, as one batch for the core; null while unconfirmed. */
export function readRuleKindEdits(button:HTMLElement,state:WorkbenchState):RuleEdit[]|null {
 const found=context(state),code=button.dataset.ruleKindConfirm;
 if(!found||!code)return null;
 const kind=ruleKinds(found).find(item=>item.code===code);
 if(!kind)return null;
 const note=(button.closest('[data-rule-kind-form]')?.querySelector<HTMLInputElement>('[data-rule-kind-note]')?.value??'').trim(),acknowledge=kind.removal==='none'?undefined:kind.removal;
 return kind.rules.map(c=>({kind:'remove-rule',before:c.before,after:c.after,...(acknowledge?{acknowledge}:{}),...(note?{note}:{})}));
}
/** After a batch: the core's refusal stays readable; an applied batch says what happened. */
export function settleRuleKind(state:WorkbenchState,outcome:{edited:boolean;count?:number;refusal?:string}):void {
 const pending:RuleKindSelection|undefined=state.ruleKind;if(!pending)return;
 if(outcome.refusal!==undefined){pending.message=outcome.refusal;return;}
 if(outcome.edited)state.ruleKind={code:pending.code,message:`${outcome.count??0} szabály feloldva; a modell újraminősítve.`};else delete state.ruleKind;
}
/** ADR-054: why the first violated rule of an author's preview attempt holds, and how the author
 * may lift it. `path` is the rule chain from the diagnostic; the first link with a direct rule is
 * shown. Empty outside the author's own preview, so a learner never sees reasons. */
export function renderRuleCause(state:WorkbenchState,path:readonly number[]):string {
 const found=context(state);
 if(!found)return '';
 for(let k=0;k+1<path.length;k++){
  const before=path[k]!,after=path[k+1]!,c=found.constraints.find(item=>item.before===before&&item.after===after);
  if(!c)continue;
  const why=[...new Set(c.reasons.map(reason=>found.meanings[reason.code]??categoryLabel[reason.category]))].join('; ');
  const lift=c.removal==='impossible'?'A program szerkezete köti, ezért ez a szabály nem oldható fel.':`Ha ez a sorrend a feladatban elfogadható, feloldhatod: a #${after} sor szabályai között a #${before} → #${after} szabálynál ${liftStep[c.removal]}`;
  const line=(id:number):string=>`<code>${codeSnippet(found.model.lines.find(item=>item.id===id)?.code.trim()??'',found.model.language)}</code> (#${id})`;
  return `<div class="rule-cause" data-rule-cause="${before}-${after}"><p><b>Miért?</b> ${line(before)} előbb kell álljon, mint ${line(after)}. A szabály ${editabilityLabel[c.editability].toLowerCase()}, oka: ${esc(why)}.</p><p>${esc(lift)}</p><button type="button" class="btn link-action" data-rule-line="${after}">A #${after} sor szabályainak megnyitása</button></div>`;
 }
 return '';
}
/** Sorter row classes: the selected line and its direct predecessors and successors. */
export function createRuleMarks(state:WorkbenchState):(id:unknown)=>string {
 const found=context(state),line=state.ruleSelection?.line;
 if(!found||line===undefined)return ()=>'';
 const before=new Set(found.constraints.filter(c=>c.after===line).map(c=>c.before)),after=new Set(found.constraints.filter(c=>c.before===line).map(c=>c.after));
 return id=>typeof id!=='number'?'':id===line?' rule-selected':before.has(id)?' rule-before':after.has(id)?' rule-after':'';
}
export const ruleButton=(state:WorkbenchState,id:number):string=>`<button type="button" class="rule-toggle" data-rule-line="${id}" aria-pressed="${state.ruleSelection?.line===id}" aria-label="A(z) #${id} sor szabályai" title="Szabályok megjelenítése és szerkesztése">${icon('link')}</button>`;

function effectView(effect:EditEffect|undefined):string {
 if(!effect)return '';
 const row=(label:string,value:EditEffect['stricter'],witness:number[]|undefined,meaning:string):string=>`<li><b>${label}:</b> ${effectLabel[value]}${witness?`<details><summary>Tanúsorrend · ${witness.length} sor</summary><p>${meaning}</p><code>${witness.map(id=>'#'+id).join(' ')}</code></details>`:''}</li>`;
 return `<div class="rule-effect" data-rule-effect><b>A legutóbbi módosítás hatása</b><ul>${row('Szigorítás',effect.stricter,effect.stricterWitness,'Ezt a sorrendet a módosítás előtt elfogadta, most elutasítja.')}${row('Lazítás',effect.looser,effect.looserWitness,'Ezt a sorrendet a módosítás előtt elutasította, most elfogadja.')}</ul></div>`;
}

export function renderRulePanel(state:WorkbenchState):string {
 const found=context(state),selection=state.ruleSelection;
 if(!found)return '';
 if(!selection)return `<p class="rule-hint" data-rule-hint>${icon('link')}<span>Jelölj ki egy sort a láncszem gombjával: itt jelennek meg a szabályai, és itt szerkesztheted őket. A tanulói nézet ebből semmit nem mutat.</span></p>`;
 const {model,constraints}=found,index=model.lines.findIndex(line=>line.id===selection.line),line=model.lines[index];
 if(!line)return '';
 const code=new Map(model.lines.map(item=>[item.id,item.code])),before=constraints.filter(c=>c.after===line.id),after=constraints.filter(c=>c.before===line.id);
 const item=(c:DirectConstraint,other:number):string=>{
  const pair=`data-before="${c.before}" data-after="${c.after}"`,reasons=c.reasons.map(reason=>{const meaning=found.meanings[reason.code];return `${categoryLabel[reason.category]} · <code>${esc(reason.code)}</code>${meaning?` <span class="rule-meaning">– ${esc(meaning)}</span>`:''}`;}).join('; ');
  return `<li class="rule-item editability-${c.editability}" data-rule-pair="${c.before}-${c.after}"><div class="rule-item-main"><button type="button" class="rule-jump" data-rule-line="${other}" aria-label="Ugrás a(z) #${other} sor szabályaira">#${other}</button><code>${codeSnippet(code.get(other)??'',model.language)}</code></div><div class="rule-item-meta"><span class="rule-badge">${editabilityLabel[c.editability]}</span><span class="rule-reasons">${reasons}</span></div>${c.note?`<p class="rule-note" data-rule-note-text>${esc(c.note)}</p>`:''}<div class="rule-item-actions">${c.removal==='impossible'?'<span class="rule-locked">Szerkezeti szabály, nem távolítható el</span>':`<button type="button"${editGate(state)} class="btn" data-rule-edit="remove" ${pair} aria-label="A(z) #${c.before} → #${c.after} szabály eltávolítása">${icon('close')}<span>Eltávolítás</span></button>`}<details class="rule-note-editor" data-rule-form><summary>Megjegyzés</summary><label>Megjegyzés a(z) #${c.before} → #${c.after} szabályhoz<input data-rule-note maxlength="500" autocomplete="off" value="${esc(c.note??'')}"></label><button type="button"${editGate(state)} class="btn" data-rule-edit="note" ${pair}>Megjegyzés mentése</button></details></div></li>`;
 };
 const list=(items:DirectConstraint[],other:(c:DirectConstraint)=>number):string=>items.length?`<ul class="rule-list">${items.map(c=>item(c,other(c))).join('')}</ul>`:'<p class="rule-empty">Nincs közvetlen szabály.</p>';
 // Only lines consistent with the reference order are offered; the core still decides admissibility.
 const earlier=model.lines.slice(0,index).map(item=>item.id).filter(id=>!before.some(c=>c.before===id)),later=model.lines.slice(index+1).map(item=>item.id).filter(id=>!after.some(c=>c.after===id));
 const add=(direction:'before'|'after',ids:number[]):string=>ids.length?`<div class="rule-add" data-rule-form data-rule-add="${direction}"><label>${direction==='before'?'Új előzmény':'Új követő'}<select data-rule-other><option value="">Válassz sort…</option>${ids.map(id=>`<option value="${id}">#${id} · ${snippet(code.get(id)??'',60)}</option>`).join('')}</select></label><label>Megjegyzés<input data-rule-note maxlength="500" autocomplete="off" placeholder="Nem kötelező"></label><button type="button"${editGate(state)} class="btn" data-rule-edit="add">${icon('plus')}<span>Szabály hozzáadása</span></button></div>`:'';
 const column=(direction:'before'|'after',title:string,items:DirectConstraint[],other:(c:DirectConstraint)=>number,candidates:number[]):string=>`<section class="rule-column" aria-labelledby="rule-${direction}-title"><h4 id="rule-${direction}-title"><span class="rule-swatch ${direction}" aria-hidden="true"></span>${title} · ${items.length}</h4>${list(items,other)}${add(direction,candidates)}</section>`;
 const pending=selection.pending,notice=provenanceNotice[state.authorInsight?.rules?.provenance??'complete'],verification=state.authorInsight?.verification;
 const confirm=pending?`<div class="rule-confirm" data-rule-form data-rule-confirm role="group" aria-labelledby="rule-confirm-title"><p id="rule-confirm-title"><b>Megerősítés szükséges: #${pending.edit.before} → #${pending.edit.after}</b></p><p>${esc(pending.message)}</p><label>Indoklás, amely a lazítással együtt a modellbe kerül<input data-rule-note maxlength="500" autocomplete="off"></label><div class="rule-confirm-actions"><button type="button"${editGate(state)} class="btn danger" data-rule-edit="confirm">${pending.acknowledge==='unproven-relaxation'?'Nem bizonyított lazítás megerősítése':'Policy-felülírás megerősítése'}</button><button type="button" class="btn" data-rule-cancel>Mégse</button></div></div>`:'';
 const fixed=`<div class="rule-fixed"><button type="button"${editGate(state)} class="btn" data-rule-edit="fixed" data-fixed="${!line.fixed}" aria-pressed="${line.fixed}">${icon('pin')}<span>${line.fixed?'Rögzítés feloldása':'Rögzítés a referencia helyén'}</span></button><span>${line.fixed?`A sor a megoldás ${index+1}. helyén rögzített.`:'A sor helyét csak a szabályok kötik.'}</span></div>`;
 return `<section class="rule-panel" data-rule-panel data-rule-panel-line="${line.id}" aria-labelledby="rule-panel-title"><div class="rule-panel-heading"><div><span class="eyebrow">SZERZŐI SZABÁLYOK</span><h3 id="rule-panel-title" tabindex="-1">#${line.id} sor · a referencia ${index+1}. sora</h3><pre class="rule-code"><code>${codeSnippet(line.code,model.language,400)}</code></pre></div><div class="rule-panel-tools">${verification?badge(verification.status):''}<button type="button" class="btn" data-rule-close>${icon('close')}<span>Bezárás</span></button></div></div>${notice?`<p class="draft-notice" data-rule-provenance>${notice}</p>`:''}<div class="rule-columns">${column('before','Előtte kell állnia',before,c=>c.before,earlier)}${column('after','Utána kell állnia',after,c=>c.after,later)}</div><p class="rule-legend">Az előzménynek bárhol előbb kell állnia, közé más sorok kerülhetnek. Kötelező szabály csak a referencia sorrendjével összhangban adható; eltérő sorrendhez OR-profil kell, amely az Adatmodell JSON-jában szerkeszthető.</p>${fixed}${confirm}${effectView(state.authorInsight?.effect)}<p class="rule-status" role="status" aria-live="polite">${esc(selection.message)}</p></section>`;
}

/** Author intent as a typed rule edit; null while the form is incomplete. */
export function readRuleEdit(button:HTMLElement,selection:RuleSelection):RuleEdit|null {
 const kind=button.dataset.ruleEdit,line=selection.line,note=(button.closest('[data-rule-form]')?.querySelector<HTMLInputElement>('[data-rule-note]')?.value??'').trim();
 const pair={before:Number(button.dataset.before),after:Number(button.dataset.after)};
 if(kind==='add'){
  const form=button.closest<HTMLElement>('[data-rule-add]'),other=Number(form?.querySelector<HTMLSelectElement>('[data-rule-other]')?.value);
  if(!form||!other)return null;
  const earlier=form.dataset.ruleAdd==='before';
  return {kind:'add-rule',before:earlier?other:line,after:earlier?line:other,...(note?{note}:{})};
 }
 if(kind==='remove')return {kind:'remove-rule',...pair};
 if(kind==='note')return {kind:'set-note',...pair,note};
 if(kind==='fixed')return {kind:'set-fixed',line,fixed:button.dataset.fixed==='true'};
 if(kind==='confirm'&&selection.pending)return {...selection.pending.edit,acknowledge:selection.pending.acknowledge,...(note?{note}:{})};
 return null;
}
/** A rule edit installs a new model and its JSON; an unapplied JSON draft must be settled first, never overwritten. */
/** A refused edit leaves the draft as it was; a removal waits for the acknowledgement the core names. */
export function recordRuleRefusal(selection:RuleSelection,result:Extract<RuleEditResult,{ok:false}>,edits:readonly RuleEdit[]):void {
 const [edit]=edits;
 if(result.error==='needs-acknowledgement'&&result.acknowledge&&edit?.kind==='remove-rule'){selection.pending={edit,acknowledge:result.acknowledge,message:result.message};selection.message='';}
 else{delete selection.pending;selection.message=result.message;}
}
/** After a new draft is installed: an applied edit settles the selection; a new model may drop it. */
export function settleRuleSelection(state:WorkbenchState,edited:boolean):void {
 const selection=state.ruleSelection;if(!selection)return;
 if(!state.authorModel?.lines.some(line=>line.id===selection.line)){delete state.ruleSelection;return;}
 delete selection.pending;selection.message=edited?'A szabálymódosítás érvényes; a modell újraminősítve.':'';
}

/** `model`: the applied model, whose rows carry their source line; the audit numbers the model's rows, the author reads source lines (ADR-122). */
/** The author-editable rules of the applied model (structural ones left out): the count the Rules step shows and a
 * reanalysis reports against (ADR-123). */
export const ruleCount=(insight:AuthorInsight|undefined):number=>insight?.rules?.constraints.filter(c=>c.editability!=='hard').length??0;
/** How many of the model's rules are the author's own decisions (narrowing, pins, profiles, lifted rules): what a
 * rebuild from the source would discard. */
export function authorDecisions(insight:AuthorInsight|undefined):number {
 const checks=insight?.verification?.checks;
 return checks?checks.authorRules+checks.fixed+checks.profiles+checks.relaxations.conservative+checks.relaxations.overrides:0;
}
export function renderModelInsight(insight:AuthorInsight|undefined,model?:CodeLineExercise):string {
 const verification=insight?.verification;if(!verification)return '';
 const sourceLine=(row:number):number=>model?.lines[row-1]?.sourceLine??row;
 const {audit,refresh,rules}=insight;
 const findings=verification.findings.length?`<ul class="insight-findings">${verification.findings.map(finding=>`<li>${esc(finding)}</li>`).join('')}</ul>`:'';
 const claims=`<div class="dependency-scroll"><table class="insight-claims"><thead><tr><th>Állítás</th><th>Alap</th></tr></thead><tbody>${verification.claims.map(claim=>`<tr><td>${esc(claim.claim)}</td><td class="basis-${claim.basis}">${basisLabel[claim.basis]}</td></tr>`).join('')}</tbody></table></div>`;
 const auditView=audit?`<div class="insight-block" data-insight-audit><h4>A referencia nyelvi auditja</h4><p>${auditLabel[audit.semantics]}</p>${audit.diagnostics.length?renderFindingGroups(audit.diagnostics.map(item=>({line:sourceLine(item.line),code:`TS${item.code}`,message:item.message,certainty:item.certainty,origin:item.context?'environment':'compiler'}))):''}${audit.unresolved.length?`<p>Feloldatlan modulok: ${audit.unresolved.map(name=>`<code>${esc(name)}</code>`).join(', ')}</p>`:''}</div>`:'';
 const relaxations=rules?.relaxations.length?`<div class="insight-block" data-insight-relaxations><h4>Szerzői lazítások</h4><ul>${rules.relaxations.map(entry=>`<li>#${entry.before} → #${entry.after} · ${editabilityLabel[entry.editability]}${entry.note?` · ${esc(entry.note)}`:''}</li>`).join('')}</ul></div>`:'';
 const refreshView=refresh?`<div class="insight-block" data-insight-refresh><h4>Az újraszámítás jelentése</h4><ul><li>${refresh.authorRules} szerzői szabály megmaradt</li><li>${refresh.legacyEdges} ismeretlen eredetű él megmaradt</li><li>${refresh.supersededEdges} korábbi generált él lecserélve</li>${refresh.relaxations.map(entry=>`<li>#${entry.before} → #${entry.after} lazítás: ${refreshOutcome[entry.outcome]}${entry.note?` · ${esc(entry.note)}`:''}</li>`).join('')}${refresh.droppedNotes?`<li>${refresh.droppedNotes} megjegyzés elveszett, mert a szabálya megszűnt</li>`:''}</ul></div>`:'';
 return `<section class="model-insight" data-model-insight aria-labelledby="model-insight-title"><div class="insight-heading"><h3 id="model-insight-title">Minősítés</h3>${renderInfo('qualification','Minősítés')}${badge(verification.status)}<span class="publish-badge ${verification.publishable?'ok':'blocked'}">${verification.publishable?'Publikálható':'Nem publikálható'}</span></div>${findings}<details data-memory="verification-claims"><summary>Állítások és alapjuk</summary>${claims}</details>${auditView}${relaxations}${refreshView}</section>`;
}
