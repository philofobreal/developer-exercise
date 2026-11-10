/**
 * ADR-122 (M3): what the teacher needs to know about the task in hand, decided in one place. Three questions, each
 * answered by one tone, one sentence and at most one action:
 *  - Kitölthető? the reference is accepted, its source check settled, and the task is short enough to sort;
 *  - Ellenőrizhető? every learner order gets a decided answer (the model is publishable);
 *  - Igazságos? no correct order is refused (verified by analysis), or the answer says where one may be;
 * and the one next step the worst answer asks for. The stepper's word for the Rules step comes from here too, so the
 * card and the step never disagree.
 *
 * Hidden here: how the gate records and the qualification map to the three questions, the long-task threshold, which
 * finding leads and which action it offers. The gates and the qualification decide; this module only reads their
 * records and never weakens or strengthens what they said.
 */
import type {WorkbenchState} from './contracts.js';
import type {ModelVerification} from '../../dist/index.js';
import type {GateDiagnostic} from '../../dist/author/preflight/source-gate.js';
import {evidenceStale} from './author-workspace.js';
import {renderFindingGroups} from './preflight-settings.js';
import {escapeHtml as esc} from './ui-utilities.js';
import {icon} from './icons.js';

export type Tone='ok'|'warning'|'error';
/** Where the next step sends the teacher: back to the code, or on to the try (the step's action bar makes it primary). */
export type TaskAction='source'|'try';
export interface TaskAnswer {id:'fillable'|'checkable'|'fair';question:string;tone:Tone;text:string;action?:'rule-kinds';}
export interface TaskStatus {tone:Tone;answers:readonly TaskAnswer[];next:{text:string;action:TaskAction};}
/** Above this many rows a task is long for a learner to sort (the author's decision of 2026-11-09). */
export const LONG_TASK_ROWS=100;

const RANK:Readonly<Record<Tone,number>>={ok:0,warning:1,error:2};
const worst=(tones:readonly Tone[]):Tone=>tones.reduce<Tone>((a,b)=>RANK[b]>RANK[a]?b:a,'ok');
const count=(n:number,noun:string):string=>`${n} ${noun}`;

/** The first gate's findings for the source the applied model was made from; none for another text. */
function modelSourceFindings(state:WorkbenchState):readonly GateDiagnostic[] {
 const record=state.sourceGate,base=state.authorBaseline;
 return record&&base&&record.source===base.source?record.gate.diagnostics:[];
}
/** One sentence on the undecided findings: those for missing project context (unresolved imports, undeclared globals)
 * leave the order analysis untouched; the rest are counted. */
function undecided(findings:readonly GateDiagnostic[]):string {
 const open=findings.filter(item=>item.certainty==='unknown'),context=open.filter(item=>item.origin==='environment').length,other=open.length-context;
 const parts=[context?`${count(context,'sor')} a projekten kívüli modulra vagy névre hivatkozik, ezért a típusai nem ellenőrizhetők; a sorrend elemzését ez nem érinti`:'',other?`${count(other,'lelet')} nem dőlt el`:''].filter(Boolean);
 return parts.length?`A forrás vizsgálata nem dőlt el teljesen: ${parts.join('; ')}.`:'';
}

function fillable(state:WorkbenchState,verification:ModelVerification,rows:number):TaskAnswer {
 const base={id:'fillable',question:'Kitölthető?'} as const,{checks}=verification;
 if(checks.admission==='failed')return {...base,tone:'error',text:verification.findings[0]??'A modell nem fogadható be.'};
 if(checks.reference==='rejected')return {...base,tone:'error',text:'A modell a saját referenciasorrendjét sem fogadja el.'};
 const findings=modelSourceFindings(state),gateOpen=state.sourceGate?.gate.verdict==='inconclusive'&&findings.length>0;
 const warnings=[
  checks.reference==='indeterminate'?'A referenciasorrend elfogadása a kereten belül nem dőlt el.':'',
  gateOpen?undecided(findings):'',
  rows>LONG_TASK_ROWS?`Hosszú feladat: ${rows} sor. ${LONG_TASK_ROWS} sor fölött a rendezés nehezen gyakorolható; érdemes egy osztályt vagy függvényt külön feladatba emelni.`:''
 ].filter(Boolean);
 return warnings.length?{...base,tone:'warning',text:[checks.reference==='accepted'?'A referencia elfogadott.':'',...warnings].filter(Boolean).join(' ')}:{...base,tone:'ok',text:`A referencia elfogadott; ${rows} sor.`};
}
function checkable(verification:ModelVerification):TaskAnswer {
 const base={id:'checkable',question:'Ellenőrizhető?'} as const,{checks}=verification;
 if(verification.publishable)return {...base,tone:'ok',text:'Minden tanulói sorrendre eldönthető a válasz; a feladat publikálható.'};
 if(checks.admission==='failed'||checks.reference==='rejected')return {...base,tone:'error',text:'Nem publikálható: a referencia nem fogadható el.'};
 if(checks.audit==='errors')return {...base,tone:'error',text:'Nem publikálható: a referencia nyelvi hibát tartalmaz.'};
 return {...base,tone:'warning',text:'Nem minden tanulói sorrendre dönthető el a válasz a kereten belül: a tanuló „Nem eldönthető” eredményt kaphat, és a feladat nem publikálható.'};
}
function fair(state:WorkbenchState,verification:ModelVerification):TaskAnswer {
 const base={id:'fair',question:'Igazságos?'} as const,{checks}=verification,meanings=state.authorInsight?.rules?.meanings??{};
 switch(verification.status){
  case 'analysis-verified':return {...base,tone:'ok',text:'Nem utasít el helyes sorrendet: elemzéssel igazolt.'};
  case 'conservative':{
   const kinds=Object.keys(checks.fallbacks.codes).map(code=>meanings[code]??code);
   const parts=[checks.fallbacks.count?`${count(checks.fallbacks.count,'óvatos szabály')}: ${kinds.join(', ')}`:'',checks.projectionLoss?`${count(checks.projectionLoss,'sorpárt')} a sorokra bontás köt sorrendbe, bár az elemzés szabadon hagyta`:''].filter(Boolean);
   return {...base,tone:'warning',text:`Néhány helyes sorrendet is elutasíthat (${parts.join('; ')}).`,...(checks.fallbacks.count&&state.authorInsight?.rules?{action:'rule-kinds' as const}:{})};
  }
  case 'author-modified':{
   const parts=[checks.authorRules?count(checks.authorRules,'szűkítő szabály'):'',checks.fixed?count(checks.fixed,'rögzített sor'):'',checks.profiles?count(checks.profiles,'OR-profil'):'',checks.relaxations.conservative+checks.relaxations.overrides?count(checks.relaxations.conservative+checks.relaxations.overrides,'feloldott szabály'):''].filter(Boolean);
   return {...base,tone:'warning',text:`A szerző döntése szerint${parts.length?` (${parts.join(', ')})`:''}: ezt az elemzés nem igazolja.`};
  }
  case 'unverified':return {...base,tone:'warning',text:`Nem igazolt: ${verification.findings[0]??'a modellhez nincs elemzési bizonyíték.'}`};
 }
}

/** The status of the applied author model; undefined without one, or while the source or settings changed since it was made. */
export function taskStatus(state:WorkbenchState):TaskStatus|undefined {
 const verification=state.authorInsight?.verification,model=state.authorModel;
 if(!verification||!model||evidenceStale(state))return undefined;
 const answers=[fillable(state,verification,model.lines.length),checkable(verification),fair(state,verification)];
 const gate=state.authorInsight?.tryGate,refused=!!gate&&!gate.admitted,tone=refused?'error':worst(answers.map(answer=>answer.tone));
 const next:TaskStatus['next']=refused?{text:gate.message,action:'source'}
  :tone==='error'?{text:'Javítsd a forrást, és készítsd újra a modellt.',action:'source'}
  :tone==='warning'?{text:'A figyelmeztetések nem akadályozzák a próbát: döntsd el, javítasz-e rajtuk, vagy így próbálod ki tanulóként.',action:'try'}
  :{text:'Próbáld ki tanulóként.',action:'try'};
 return {tone,answers,next};
}

/** The stepper's word for the Rules step: the card's overall tone. */
export const TONE_WORD:Readonly<Record<Tone,string>>={ok:'Kész',warning:'Figyelem',error:'Hiba'};
const VERDICT:Readonly<Record<Tone,string>>={ok:'Igen',warning:'Részben',error:'Nem'};
const SHOW_RULE_KINDS=`<button type="button" class="btn" data-show-rule-kinds>${icon('link')}<span>Megmutatom</span></button>`;

/** The card at the top of the Rules step: three answers and the source findings grouped by cause. The next step is the
 * step's action bar (ADR-123), which reads `taskStatus` too. */
export function renderTaskStatus(state:WorkbenchState):string {
 const status=taskStatus(state);if(!status)return '';
 const answers=status.answers.map(answer=>`<li class="task-answer tone-${answer.tone}" data-task-answer="${answer.id}"><b class="task-question">${answer.question}</b><span class="task-verdict"><span class="status-dot" aria-hidden="true"></span>${VERDICT[answer.tone]}</span><span class="task-text">${esc(answer.text)}</span>${answer.action?SHOW_RULE_KINDS:''}</li>`).join('');
 const findings=modelSourceFindings(state);
 const details=findings.length?`<details class="task-findings" data-memory="task-findings"><summary>Részletek: a forrás leletei okonként</summary>${renderFindingGroups(findings)}</details>`:'';
 return `<section class="task-status tone-${status.tone}" data-task-status aria-labelledby="task-status-title"><h3 id="task-status-title">A feladat állapota</h3><ul class="task-answers">${answers}</ul>${details}</section>`;
}
