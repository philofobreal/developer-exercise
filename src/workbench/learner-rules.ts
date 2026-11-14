/** ADR-147: the learner's look at an exercise's rules. Hidden here: when a learner has them, and what the read-only
 * panel says.
 * - They come with an evaluation's answer, never with the exercise's listing, and only where the exercise's author
 *   allows it; so there is nothing to show before a first check, and nothing here can show it earlier.
 * - They are kept for the page's life, per exercise; a reload forgets them. For the author's own draft they hold only
 *   in the learner's view, and only while the model is the one that was evaluated.
 * - Their arrival opens nothing: the panel is the learner's to open.
 * The answer carries pairs of lines and whether a pair is the code's own structure. No reason or origin is known
 * here, and nothing here edits. */
import type {CodeLineExercise,LearnerRuleSheet} from '../../dist/index.js';
import type {ExerciseLine,Report,WorkbenchState} from './contracts.js';
import {escapeHtml as esc,highlight} from './ui-utilities.js';
import {icon} from './icons.js';

export type LearnerRule=LearnerRuleSheet['constraints'][number];
/** What was kept for one exercise: the sheet and, for an author's draft, the model it was evaluated with. */
export interface KeptLearnerRules {sheet:LearnerRuleSheet;model?:CodeLineExercise;}
interface LearnerRules {lines:readonly ExerciseLine[];language:string;rules:readonly LearnerRule[];}

/** Keeps what an evaluation's answer brought for the exercise in front. True when it is the first for that exercise:
 *  the caller may tell the learner; the panel stays closed until the learner opens it. */
export function keepLearnerRules(state:WorkbenchState,report:Pick<Report,'rules'>):boolean {
 const id=state.active,draft=!!id&&state.previews.has(id);
 // The author's own check of a draft is not a learner's: only the learner's view of it keeps anything.
 if(!id||!report.rules||draft&&!state.learnerPreview)return false;
 const kept=state.learnerRules??=new Map<string,KeptLearnerRules>(),first=!kept.has(id)||draft&&kept.get(id)?.model!==state.authorModel;
 kept.set(id,{sheet:report.rules,...(draft&&state.authorModel?{model:state.authorModel}:{})});
 if(first)state.rulePanelOpen=false;
 return first;
}
/** The rules the learner may see of the exercise in front, or null. */
export function learnerRules(state:WorkbenchState):LearnerRules|null {
 const id=state.active,kept=id?state.learnerRules?.get(id):undefined;
 if(!id||!kept)return null;
 const exercise=state.exercises.find(item=>item.id===id);if(!exercise)return null;
 if(state.previews.has(id)?!state.learnerPreview||kept.model!==state.authorModel:state.mode!=='practice')return null;
 return {lines:exercise.lines,language:exercise.language,rules:kept.sheet.constraints};
}
const clip=(code:string,limit:number):string=>code.length>limit?code.slice(0,limit-1)+'…':code;
/** The name a row's rule button and a rule's jump button are called by: the line's own code, never its number (a
 *  number would tell its place in the reference). */
export function learnerLineName(state:WorkbenchState,id:number):string {
 return esc(clip(learnerRules(state)?.lines.find(line=>line.id===id)?.code.trim()??'',60));
}
export const LEARNER_LEGEND='<div class="board-legend"><span class="board-legend-keys"><span class="rule-swatch before" aria-hidden="true"></span>előtte kell állnia <span class="rule-swatch selected" aria-hidden="true"></span>kijelölt <span class="rule-swatch after" aria-hidden="true"></span>utána kell állnia</span><details class="legend-help" data-memory="legend-help"><summary>Jelmagyarázat</summary><p>Láncszem a sor végén: kijelöli a sort, és megmutatja, mely soroknak kell előtte és utána állniuk. A szaggatott ív a kód blokkszerkezetéből következő szabály.</p></details></div>';
/** The read-only panel of the selected line: what must stand before it and after it. */
export function renderLearnerRulePanel(state:WorkbenchState):string {
 const found=learnerRules(state);if(!found)return '';
 const line=found.lines.find(item=>item.id===state.ruleSelection?.line);
 if(!line)return `<p class="rule-hint" data-rule-hint>${icon('link')}<span>Jelölj ki egy sort a láncszem gombjával: itt látod, mely soroknak kell előtte és utána állniuk.</span></p>`;
 const code=new Map(found.lines.map(item=>[item.id,item.code])),before=found.rules.filter(rule=>rule.after===line.id),after=found.rules.filter(rule=>rule.before===line.id);
 const item=(rule:LearnerRule,other:number):string=>`<li class="rule-item editability-${rule.structural?'hard':'shown'}" data-rule-pair="${rule.before}-${rule.after}"><div class="rule-item-main"><button type="button" class="rule-jump" data-rule-line="${other}" aria-label="Ugrás erre a sorra: ${learnerLineName(state,other)}" title="Ugrás erre a sorra">${icon('link')}</button><code>${highlight(clip(code.get(other)??'',120),found.language)}</code></div>${rule.structural?'<div class="rule-item-meta"><span class="rule-badge">Szerkezeti</span><span class="rule-reasons">a kód blokkszerkezetéből következik</span></div>':''}</li>`;
 const column=(direction:'before'|'after',title:string,rules:LearnerRule[],other:(rule:LearnerRule)=>number):string=>`<section class="rule-column" aria-labelledby="rule-${direction}-title"><h4 id="rule-${direction}-title"><span class="rule-swatch ${direction}" aria-hidden="true"></span>${title} · ${rules.length}</h4>${rules.length?`<ul class="rule-list">${rules.map(rule=>item(rule,other(rule))).join('')}</ul>`:'<p class="rule-empty">Nincs közvetlen szabály.</p>'}</section>`;
 // Lines of the same content are interchangeable for the validator; a rule names one of them.
 const twins=found.lines.filter(other=>other.code.trim()===line.code.trim()).length>1?'<p class="draft-notice" data-rule-twins>Több ilyen tartalmú sor van. Ezek felcserélhetők: a szabály bármelyikükkel teljesülhet.</p>':'';
 return `<section class="rule-panel learner-rules" data-rule-panel data-rule-panel-line="${line.id}" aria-labelledby="rule-panel-title"><div class="rule-panel-heading"><div><span class="eyebrow">A FELADAT SZABÁLYAI</span><h3 id="rule-panel-title" tabindex="-1">A kijelölt sor</h3><pre class="rule-code"><code>${highlight(clip(line.code,400),found.language)}</code></pre></div><div class="rule-panel-tools"><button type="button" class="btn" data-rule-close>${icon('close')}<span>Bezárás</span></button></div></div>${twins}<div class="rule-columns">${column('before','Előtte kell állnia',before,rule=>rule.before)}${column('after','Utána kell állnia',after,rule=>rule.after)}</div><p class="rule-legend">Az előtte álló sornak bárhol előbb kell állnia; közé más sorok kerülhetnek. A szabályok okát a feladat nem mutatja.</p></section>`;
}
