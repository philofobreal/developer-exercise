/** Transitional port (ADR-001, ADR-125): the Local Demo engine, legacy JavaScript; the worker serves its operations
 *  by name and passes bodies and results through unchanged. */
export const validationMode:'local-demo';
export function getExercises():Promise<unknown>;
export function getCurriculum():Promise<unknown>;
export function compileDraft(body:unknown):Promise<unknown>;
export function editRules(body:unknown):Promise<unknown>;
export function resolvePolicy(body:unknown):Promise<unknown>;
export function authorTransition(body:unknown):Promise<unknown>;
export function previewDraft(body:unknown):Promise<unknown>;
export function evaluate(body:unknown):Promise<unknown>;
export function loadTypeScriptFixture():Promise<string>;
export function checkSource(body:unknown):Promise<unknown>;
export function formatSource(source:string,language:string):Promise<unknown>;
