/** Presentation ports: no graph/parser/HTTP implementation leaks into the view. */
import type {Acknowledgement,CodeLineExercise,EditEffect,Feedback,ModelVerification,Normalization,RefreshReport,RuleEdit,ValidationResult} from '../../dist/index.js';
import type {AuthorRuleSheet} from '../../dist/author/engine.js';
import type {ReferenceAudit} from '../../dist/author/reference-audit.js';
import type {AuthorPolicy,PolicyResolution} from '../../dist/author/preflight/config-resolver.js';
import type {SourceGate} from '../../dist/author/preflight/source-gate.js';
import type {RulesGate} from '../../dist/author/preflight/rules-gate.js';
export type ViewName='sort'|'edit'|'author'|'model';
export type LineId=number|string;
export interface ExerciseLine {id:number;code:string;fixed?:boolean;normalization?:Normalization;sourceLine?:number;functionBlock?:number;}
/** ADR-101: difficulty for the practice list. */
export type ExerciseLevel='beginner'|'intermediate'|'advanced';
export interface ExerciseSummary {id:string;revision:number;language:string;title:string;description:string;level?:ExerciseLevel;lines:ExerciseLine[];previewOnly?:boolean;}
/** `feedback` (ADR-026): what the API discloses to the author and to the learner view; `slots`: the
 * sorter slot of each submitted line, so diagnostic positions mark the rows that were graded. */
export type Report=Pick<ValidationResult,'status'|'message'>&Partial<ValidationResult>&{feedback?:{author?:Feedback;learner:Feedback};slots?:number[]};
export interface AttemptSnapshot {answer:(LineId|null)[];pool:LineId[];draft:string;report:Report|null;feedback:string;generation:number;editorDirty?:boolean;editorGeneration?:number;}
export type ImportEmit='verbatim'|'elide-unused';
/** The exercise's input contract (ADR-050): `any` (default) or valid plain data. */
export type InputContract='any'|'valid';
/** ADR-055: whether the creation order of object keys is part of the exercise. */
export type KeyOrder='observed'|'ignored';
/** ADR-075: whether the analysis covers both class-field modes or only the standard [[Define]]. */
export type ClassFields='either'|'define';
/** ADR-108 (E7): the preflight options of the request's `policy` object; absent is the resolver's start value. */
export type PreflightOptions=Partial<Pick<AuthorPolicy,'portability'|'unknownPolicy'|'tsDiagnostics'|'jsCheck'|'objectState'>>;
export interface AuthorDraft {title:string;description:string;level?:ExerciseLevel|'';language:string;source:string;message:string;importEmit?:ImportEmit;inputs?:InputContract;keyOrder?:KeyOrder;classFields?:ClassFields;policy?:PreflightOptions;}
/** ADR-108 (E8): where the applied model's analysis settings come from when they are not the author's choices of
 * this session: `recorded` in a session file, or `partial` (an older session or a model file: the model's recorded
 * environment, start values for the rest). */
export type SettingsOrigin='recorded'|'partial';
/** ADR-108 (E7): the first gate's outcome with the source it was made from, so its findings can say when they are out of date. */
export interface SourceGateRecord {gate:SourceGate;source:string;}
/** What the API reported with the active author draft: presentation data, never a rule source (ADR-021). */
/** `tryGate` (ADR-108, E6): the second gate for the source and policy the draft was made from. */
export interface AuthorInsight {rules?:AuthorRuleSheet;verification?:ModelVerification;audit?:ReferenceAudit;refresh?:RefreshReport;effect?:EditEffect;tryGate?:RulesGate;}
export type RemoveRule=Extract<RuleEdit,{kind:'remove-rule'}>;
/** ADR-056: a rule kind whose rules the author is about to lift together, and the last outcome. */
export interface RuleKindSelection {code:string;message:string;}
/** The line whose rules the panel shows; `pending`: a removal the core refused until this acknowledgement. */
export interface RuleSelection {line:number;message:string;pending?:{edit:RemoveRule;acknowledge:Acknowledgement;message:string};}
/** `author`: building one exercise in steps (ADR-022); `practice`: solving the trusted exercises. */
export type Mode='author'|'practice';
/** Rules step: the visual rule board or the CodeLine JSON. */
export type RulesView='visual'|'json';
/** `active`: the exercise whose attempt is shown — the author's preview or the practice exercise.
 * `modeViews`: the view each mode returns to. `ruleConnect`: a keyboard connection's first line. */
export interface WorkbenchState {exercises:ExerciseSummary[];active:string|null;previews:Map<string,string>;view:ViewName;mode:Mode;modeViews?:Partial<Record<Mode,ViewName>>;practiceActive?:string|null;rulesView?:RulesView;sourceKind?:'code'|'json';boardAll?:boolean;ruleConnect?:number;boardStatus?:string;feedbackFocus?:number;learnerPreview?:boolean;author:AuthorDraft;authorBaseline?:AuthorDraft;authorRequestGeneration?:number;authorModel?:CodeLineExercise;authorInsight?:AuthorInsight;ruleSelection?:RuleSelection;rulePanelOpen?:boolean;ruleKind?:RuleKindSelection;modelDraft:string;modelMessage:string;
 /** ADR-108 (E7): the resolver's answer for the author's current request, and the last first-gate outcome. */
 authorPolicy?:PolicyResolution;sourceGate?:SourceGateRecord;settingsOrigin?:SettingsOrigin;}
export interface AttemptPresentation {text:(id:LineId|null)=>string;fixed:(position:number)=>boolean;formattedAnswer:()=>string[];}
export interface ScrollMemory {capture:()=>void;restore:(id:string)=>void;}
export interface WorkbenchOptions {root:HTMLElement;state:WorkbenchState;ex:()=>ExerciseSummary|undefined;at:()=>AttemptSnapshot|undefined;attempt:AttemptPresentation;scroll:ScrollMemory;}
