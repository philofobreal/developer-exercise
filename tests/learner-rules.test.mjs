/** ADR-147: the learner's look at an exercise's rules, as the workbench keeps and shows it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {keepLearnerRules,learnerRules,renderLearnerRulePanel,learnerLineName} from '../public/app/learner-rules.js';
import {createRuleMarks,renderRulePanel,ruleButton,rulesAvailable,rulesEditable,shownRules} from '../public/app/rule-panel.js';
import {renderTryRules,renderTryConnecting,tryRowRuleControls} from '../public/app/rule-board.js';

const lines=[{id:1,code:'function f(a) {'},{id:2,code:'  const b = a < 3;'},{id:3,code:'  return b;'},{id:4,code:'}'},{id:5,code:'}'}];
const sheet={constraints:[{before:1,after:2,structural:true},{before:1,after:3,structural:true},{before:2,after:3,structural:false},{before:3,after:4,structural:true}]};
const practice=()=>({mode:'practice',active:'ex',exercises:[{id:'ex',revision:1,language:'javascript',title:'T',description:'',lines},{id:'other',revision:1,language:'javascript',title:'O',description:'',lines}],previews:new Map(),rulePanelOpen:true});

test('nothing is shown before an answer brings the rules; the first answer closes the panel, later ones leave it alone',()=>{
 const state=practice();
 assert.equal(learnerRules(state),null);assert.equal(rulesAvailable(state),false);assert.equal(renderRulePanel(state),'');assert.equal(renderTryRules(state),'');assert.equal(tryRowRuleControls(state,2),'');
 assert.equal(keepLearnerRules(state,{status:'rejected',message:''}),false,'an answer without rules keeps nothing');assert.equal(learnerRules(state),null);assert.equal(state.rulePanelOpen,true);
 assert.equal(keepLearnerRules(state,{rules:sheet}),true,'the first answer with rules');
 assert.equal(state.rulePanelOpen,false,'the panel is the learner\'s to open');
 assert.deepEqual(learnerRules(state).rules,sheet.constraints);assert.equal(rulesAvailable(state),true);assert.equal(rulesEditable(state),false);
 state.rulePanelOpen=true;assert.equal(keepLearnerRules(state,{rules:sheet}),false);assert.equal(state.rulePanelOpen,true,'a later answer does not close what the learner opened');
 assert.equal(keepLearnerRules(state,{status:'indeterminate',message:'x'}),false);assert.ok(learnerRules(state),'an answer without rules does not take them away');
 // per exercise, and only in practice
 state.active='other';assert.equal(learnerRules(state),null);assert.equal(rulesAvailable(state),false);
 state.active='ex';state.mode='author';assert.equal(learnerRules(state),null);
 state.active=null;assert.equal(keepLearnerRules(state,{rules:sheet}),false);
});

test('an author\'s draft: only the learner\'s view keeps and shows them, and only for the model that was evaluated',()=>{
 const model={id:'draft',lines},state={mode:'author',active:'draft',exercises:[{id:'draft',revision:1,language:'javascript',title:'D',description:'',lines,previewOnly:true}],previews:new Map([['draft','d1']]),authorModel:model,rulePanelOpen:true};
 assert.equal(keepLearnerRules(state,{rules:sheet}),false,'the author\'s own check is not a learner\'s');assert.equal(state.rulePanelOpen,true,'and it leaves the author\'s panel open');
 state.learnerPreview=true;assert.equal(learnerRules(state),null);
 assert.equal(keepLearnerRules(state,{rules:sheet}),true);assert.equal(state.rulePanelOpen,false);assert.ok(learnerRules(state));
 state.learnerPreview=false;assert.equal(learnerRules(state),null,'back in the author\'s view the learner\'s rules are not the ones in front');
 state.learnerPreview=true;state.authorModel={...model};assert.equal(learnerRules(state),null,'another model: a check is needed again');
 assert.equal(keepLearnerRules(state,{rules:sheet}),true,'and that check is a first one again');
});

test('the panel: what stands before and after the selected line, by its code; nothing to edit, no number, no reason',()=>{
 const state=practice();keepLearnerRules(state,{rules:sheet});
 const hint=renderLearnerRulePanel(state);assert.match(hint,/data-rule-hint/);assert.match(hint,/Jelölj ki egy sort/);
 state.ruleSelection={line:99,message:''};assert.match(renderLearnerRulePanel(state),/data-rule-hint/,'a line of another exercise is no selection');
 state.ruleSelection={line:3,message:''};
 const html=renderRulePanel(state);
 assert.match(html,/data-rule-panel-line="3"/);assert.match(html,/Előtte kell állnia · 2/);assert.match(html,/Utána kell állnia · 1/);
 assert.deepEqual([...html.matchAll(/data-rule-pair="([^"]+)"/g)].map(m=>m[1]),['1-3','2-3','3-4']);
 assert.deepEqual([...html.matchAll(/class="rule-jump" data-rule-line="(\d+)"/g)].map(m=>m[1]),['1','2','4'],'each rule leads to its other line');
 assert.equal((html.match(/Szerkezeti/g)??[]).length,2,'the two structural pairs say so');
 assert.doesNotMatch(html,/data-rule-edit|data-rule-form|<select|<input|data-rule-connect|data-rule-note/,'nothing to edit');
 assert.doesNotMatch(html,/#\d|referencia|SZERZŐI/,'no line number and no author wording');
 assert.match(html,/a &lt; 3/);assert.doesNotMatch(html,/a < 3/,'code is escaped');
 assert.doesNotMatch(html,/data-rule-twins/);
 state.ruleSelection={line:4,message:''};assert.match(renderLearnerRulePanel(state),/data-rule-twins/,'two lines of this content: the panel says they are interchangeable');
 assert.equal(learnerLineName(state,2),'const b = a &lt; 3;');
});

test('the sorter: a rule button per row named by its code, marks and arcs from the sheet, and no author control',()=>{
 const state=practice();keepLearnerRules(state,{rules:sheet});state.ruleSelection={line:3,message:''};
 const controls=tryRowRuleControls(state,2);
 assert.match(controls,/data-rule-line="2"/);assert.match(controls,/aria-label="A sor szabályai: const b = a &lt; 3;"/);assert.doesNotMatch(controls,/data-rule-connect|#2|szerkesztése/);
 assert.equal(tryRowRuleControls(state,'blank'),'');
 const mark=createRuleMarks(state);assert.deepEqual([1,2,3,4,5].map(mark),[' rule-before',' rule-before',' rule-selected',' rule-after','']);
 assert.deepEqual(shownRules(state).map(rule=>rule.editability),['hard','hard','shown','hard']);
 assert.equal(renderTryConnecting(state),'');
 const legend=renderTryRules(state);assert.match(legend,/data-board-all/);assert.doesNotMatch(legend,/Rajzszög|kipipálja/,'the legend explains no author control');
 assert.match(ruleButton(state,3),/aria-pressed="true"/);
});
