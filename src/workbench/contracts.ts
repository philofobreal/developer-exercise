/** Presentation ports: no graph/parser/HTTP implementation leaks into the view. */
import type {Acknowledgement,CodeLineExercise,EditEffect,ModelVerification,Normalization,RefreshReport,RuleEdit,ValidationResult} from '../../dist/index.js';
import type {AuthorRuleSheet} from '../../dist/author/engine.js';
import type {ReferenceAudit} from '../../dist/author/reference-audit.js';
export type ViewName='sort'|'edit'|'author'|'model';
export type LineId=number|string;
export interface ExerciseLine {id:number;code:string;fixed?:boolean;normalization?:Normalization;sourceLine?:number;functionBlock?:number;}
export interface ExerciseSummary {id:string;revision:number;language:string;title:string;description:string;lines:ExerciseLine[];previewOnly?:boolean;}
export type Report=Pick<ValidationResult,'status'|'message'>&Partial<ValidationResult>;
export interface AttemptSnapshot {answer:(LineId|null)[];pool:LineId[];draft:string;report:Report|null;feedback:string;generation:number;editorDirty?:boolean;editorGeneration?:number;}
export type ImportEmit='verbatim'|'elide-unused';
export interface AuthorDraft {title:string;description:string;language:string;source:string;message:string;importEmit?:ImportEmit;}
/** What the API reported with the active author draft: presentation data, never a rule source (ADR-021). */
export interface AuthorInsight {rules?:AuthorRuleSheet;verification?:ModelVerification;audit?:ReferenceAudit;refresh?:RefreshReport;effect?:EditEffect;}
export type RemoveRule=Extract<RuleEdit,{kind:'remove-rule'}>;
/** The line whose rules the panel shows; `pending`: a removal the core refused until this acknowledgement. */
export interface RuleSelection {line:number;message:string;pending?:{edit:RemoveRule;acknowledge:Acknowledgement;message:string};}
/** `author`: building one exercise in steps (ADR-022); `practice`: solving the trusted exercises. */
export type Mode='author'|'practice';
/** Rules step: the visual rule board or the CodeLine JSON. */
export type RulesView='visual'|'json';
/** `active`: the exercise whose attempt is shown — the author's preview or the practice exercise.
 * `modeViews`: the view each mode returns to. `ruleConnect`: a keyboard connection's first line. */
export interface WorkbenchState {exercises:ExerciseSummary[];active:string|null;previews:Map<string,string>;view:ViewName;mode:Mode;modeViews?:Partial<Record<Mode,ViewName>>;practiceActive?:string|null;rulesView?:RulesView;sourceKind?:'code'|'json';boardAll?:boolean;ruleConnect?:number;boardStatus?:string;learnerPreview?:boolean;author:AuthorDraft;authorBaseline?:AuthorDraft;authorRequestGeneration?:number;authorModel?:CodeLineExercise;authorInsight?:AuthorInsight;ruleSelection?:RuleSelection;modelDraft:string;modelMessage:string;}
export interface AttemptPresentation {text:(id:LineId|null)=>string;fixed:(position:number)=>boolean;formattedAnswer:()=>string[];}
export interface ScrollMemory {capture:()=>void;restore:(id:string)=>void;}
export interface WorkbenchOptions {root:HTMLElement;state:WorkbenchState;ex:()=>ExerciseSummary|undefined;at:()=>AttemptSnapshot|undefined;attempt:AttemptPresentation;scroll:ScrollMemory;}
