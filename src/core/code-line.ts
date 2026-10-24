import type { ExerciseDefinition, Normalization, OrderingProfile, OrderingEdge, ValidationResult } from './types.js';
import { compileDefinition, isModelError, type CompiledRules } from './model.js';

/** Kept source-compatible with the user-proposed interface. IDs are transport identities, not semantic identities. */
export interface CodeLine {
  id: number;
  code: string;
  /** All predecessors must occur somewhere earlier; never means immediately before. */
  dependencies: number[];
  /** Cannot be moved from the zero-based source index; enforced on the server, too. */
  fixed: boolean;
  /** Owning function ID (0 means top-level), including opener and closer. */
  functionBlock: number;
}
/** Separates nested lexical scopes from ownership of functions, and raw whitespace from indentation. */
export interface StructuredCodeLine extends CodeLine {
  scopeId: string | null;
  normalization?: Normalization;
}
export interface CodeBlock {
  id: string;
  /** 'function' blocks map to numeric functionBlock; 'block' includes loops/conditionals. */
  kind: 'function' | 'block';
  functionBlock?: number;
  parentScopeId: string | null;
  openLineId: number;
  closeLineId: number;
}
export interface CodeLineExercise {
  schemaVersion: 2;
  id: string;
  revision: number;
  language: 'javascript' | 'typescript';
  title: string;
  description: string;
  lines: StructuredCodeLine[];
  blocks: CodeBlock[];
  /** Shared mandatory partial ordering, outside per-line dependencies. */
  edges?: { before: number; after: number }[];
  /** Each profile adds AND constraints; alternative profiles are OR. */
  profiles?: { id: string; edges: { before: number; after: number }[] }[];
}
export type AdaptResult = { definition: ExerciseDefinition; compiled: CompiledRules } | ValidationResult;
const invalid = (message:string):ValidationResult => ({status:'invalid_reference',accepted:false,reason:'invalid_model',message,exploredStates:0});
const refId=(id:number)=>`n:${id}`;

/** Compile and audit once at publication time. Never compile rules supplied by a learner. */
export function compileCodeLineExercise(raw: CodeLineExercise): AdaptResult {
  if (!raw || raw.schemaVersion !== 2 || !Array.isArray(raw.lines) || !Array.isArray(raw.blocks) || !raw.lines.length || raw.lines.length>500) return invalid('Hibás CodeLine v2 definíció.');
  const seen = new Set<number>();
  for(const l of raw.lines) {
    if(!l || !Number.isSafeInteger(l.id) || l.id < 1 || seen.has(l.id) || !Array.isArray(l.dependencies) || l.dependencies.some(d=>!Number.isSafeInteger(d)) || typeof l.fixed!=='boolean' || !Number.isSafeInteger(l.functionBlock) || l.functionBlock<0 || (l.scopeId!==null && typeof l.scopeId!=='string')) return invalid('Hibás sorazonosító, dependencies, fixed, functionBlock vagy scopeId.');
    seen.add(l.id);
  }
  const bIds = new Set<string>();
  const boundaries = new Map<number,CodeBlock>();
  const functionIds=new Set<number>();
  for(const b of raw.blocks){
    if(!b || typeof b.id!=='string' || !b.id || bIds.has(b.id) || !seen.has(b.openLineId) || !seen.has(b.closeLineId) || b.openLineId===b.closeLineId || boundaries.has(b.openLineId) || boundaries.has(b.closeLineId) || !['block','function'].includes(b.kind) || (b.parentScopeId!==null && typeof b.parentScopeId!=='string'))return invalid('Hibás vagy átfedő blokkhatár.');
    if (b.kind==='function') {
      if(!Number.isSafeInteger(b.functionBlock)||b.functionBlock! <= 0 || functionIds.has(b.functionBlock!))return invalid('Egyedi pozitív functionBlock szükséges a függvényblokkokhoz.');
      functionIds.add(b.functionBlock!);
    } else if (b.functionBlock !== undefined) return invalid('A közönséges blokk nem definiálhat functionBlock azonosítót.');
    bIds.add(b.id);boundaries.set(b.openLineId,b);boundaries.set(b.closeLineId,b);
  }
  const blockById=new Map(raw.blocks.map(b=>[b.id,b]));
  for(const l of raw.lines){
    if(l.scopeId!==null && !bIds.has(l.scopeId))return invalid('Ismeretlen lexical scope.');
    const boundary=boundaries.get(l.id);
    let scope=boundary?.kind==='function' ? boundary.id : l.scopeId;
    const visited=new Set<string>();let owner=0;
    while(scope!==null){
      if(visited.has(scope))return invalid('Körkörös blokk-hierarchia.');visited.add(scope);
      const block=blockById.get(scope);if(!block)return invalid('Hiányzó blokk.');
      if(block.kind==='function'){owner=block.functionBlock!;break;}
      scope=block.parentScopeId;
    }
    if(l.functionBlock!==owner)return invalid(`A(z) ${l.id}. sor functionBlock értéke nem felel meg a blokk-hierarchiának (elvárt: ${owner}).`);
  }
  const tokens = raw.lines.map(l=>({id:refId(l.id),code:l.code,scope:l.scopeId,after:l.dependencies.map(refId),normalization:l.normalization??'indent' as Normalization}));
  const edges:OrderingEdge[]=(raw.edges??[]).map(e=>({before:refId(e.before),after:refId(e.after)}));
  // Pin by index; O(N) edges per pinned token. This preserves movable freedoms within other slots.
  for(let i=0;i<raw.lines.length;i++){
    if(!raw.lines[i]!.fixed)continue;
    const pivot=refId(raw.lines[i]!.id);
    for(let j=0;j<raw.lines.length;j++){
      if(i===j)continue;
      if(j<i)edges.push({before:refId(raw.lines[j]!.id),after:pivot});
      else edges.push({before:pivot,after:refId(raw.lines[j]!.id)});
    }
  }
  const profiles:OrderingProfile[]=(raw.profiles??[]).map(p=>({id:p.id,edges:p.edges.map(e=>({before:refId(e.before),after:refId(e.after)}))}));
  const definition:ExerciseDefinition={schemaVersion:1,id:raw.id,revision:raw.revision,language:raw.language,title:raw.title,description:raw.description,tokens,blocks:raw.blocks.map(b=>({id:b.id,open:refId(b.openLineId),close:refId(b.closeLineId),parent:b.parentScopeId})),edges,profiles};
  const compiled=compileDefinition(definition);
  if(isModelError(compiled))return compiled;
  return {definition,compiled};
}
