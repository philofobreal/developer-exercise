/** Presentation ports: no graph/parser/HTTP implementation leaks into the view. */
import type {CodeLineExercise,Normalization,ValidationResult} from '../../dist/index.js';
export type ViewName='sort'|'edit'|'author'|'model';
export type LineId=number|string;
export interface ExerciseLine {id:number;code:string;fixed?:boolean;normalization?:Normalization;sourceLine?:number;functionBlock?:number;}
export interface ExerciseSummary {id:string;revision:number;language:string;title:string;description:string;lines:ExerciseLine[];previewOnly?:boolean;}
export type Report=Pick<ValidationResult,'status'|'message'>&Partial<ValidationResult>;
export interface AttemptSnapshot {answer:(LineId|null)[];pool:LineId[];draft:string;report:Report|null;feedback:string;generation:number;editorDirty?:boolean;editorGeneration?:number;}
export interface AuthorDraft {title:string;description:string;language:string;source:string;message:string;}
export interface WorkbenchState {exercises:ExerciseSummary[];active:string|null;previews:Map<string,string>;view:ViewName;learnerPreview?:boolean;author:AuthorDraft;authorBaseline?:AuthorDraft;authorRequestGeneration?:number;authorModel?:CodeLineExercise;modelDraft:string;modelMessage:string;}
export interface AttemptPresentation {text:(id:LineId|null)=>string;fixed:(position:number)=>boolean;formattedAnswer:()=>string[];}
export interface ScrollMemory {capture:()=>void;restore:(id:string)=>void;}
export interface WorkbenchOptions {root:HTMLElement;state:WorkbenchState;ex:()=>ExerciseSummary;at:()=>AttemptSnapshot;attempt:AttemptPresentation;scroll:ScrollMemory;}
