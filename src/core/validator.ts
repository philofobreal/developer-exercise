import type { Submission, ValidationOptions, ValidationResult } from './types.js';
import { matchContent } from './content-match.js';
import { compileDefinition, isModelError, type CompiledRules } from './model.js';
import { createPlacement } from './placement.js';

const result = (status: ValidationResult['status'], reason: ValidationResult['reason'], message: string, exploredStates: number, positions?:number[]):ValidationResult=>({status,accepted:status==='accepted',reason,message,exploredStates,...(positions?{positions}:{})});

/**
 * Witness-based exact validation:
 *   ∃ bijection of submitted positions to reference token instances
 *   respecting content normalization, lexical scopes, ordering edges, and one profile.
 * Deterministic bounded search: exhausted budget => INDETERMINATE, never falsely rejected.
 * No JS/TS execution, eval, vm, or server-side source parsing.
 */
export function validateSubmission(compiledOrRaw: CompiledRules | import('./types.js').ExerciseDefinition, submission: Submission, opts: ValidationOptions={}):ValidationResult {
  if(!compiledOrRaw||typeof compiledOrRaw!=='object')return result('invalid_reference','invalid_model','Hiányzó referencia.',0);
  const compiled = 'profiles' in compiledOrRaw && 'definition' in compiledOrRaw
    ? compiledOrRaw as CompiledRules : compileDefinition(compiledOrRaw as import('./types.js').ExerciseDefinition);
  if(isModelError(compiled)) return compiled;
  const def=compiled.definition;
  if(submission?.exerciseId!==def.id||submission.revision!==def.revision||!Array.isArray(submission.lines))return result('rejected','invalid_submission','Feladatazonosító, verzió vagy beküldési séma eltér.',0);
  if(submission.lines.length!==def.tokens.length)return result('rejected','wrong_length',`Várt elemszám: ${def.tokens.length}, beküldött: ${submission.lines.length}.`,0);
  if(submission.lines.some(x=>typeof x!=='string'||Array.from(x).length>2048||/[\r\n\u2028\u2029]/.test(x)))return result('rejected','unknown_content','Érvénytelen kódsor szerepel a beküldésben.',0);
  const tokens=def.tokens;
  const {tokenKeys,candidates,unknown:impossible,pinnedMismatch}=matchContent(tokens,submission.lines);
  if(impossible.length)return result('rejected','unknown_content','A feladatban nem engedélyezett sor található.',0,impossible);
  if(pinnedMismatch.length)return result('rejected','rule_violation','A rögzített sor tartalma nem a kötelező sorhelyen áll.',0,pinnedMismatch);
  const counts=new Map<string,number>();
  for(const key of tokenKeys){counts.set(key,(counts.get(key)??0)+1);}
  // Fast sufficient multiplicity check: all candidates map to exactly one key set.
  const singles=candidates.map(a=>new Set(a.map(i=>tokenKeys[i]!)));
  if(singles.every(s=>s.size===1)){
    const got=new Map<string,number>();for(const s of singles){const k=[...s][0]!;got.set(k,(got.get(k)??0)+1);}
    if([...counts].some(([k,v])=>got.get(k)!==v))return result('rejected','wrong_multiplicity','A kódsorok előfordulási száma nem egyezik.',0);
  }
  const byId=new Map(tokens.map((t,i)=>[t.id,i]));
  const maxStates=Math.max(1,Math.min(1_000_000,Math.floor(Number.isFinite(opts.maxStates)?opts.maxStates!:30_000)));
  let totalStates=0;
  let exceeded=false;

  for(const [profileIndex,profile] of compiled.profiles.entries()){
    // ADR-036: the placement owns the partial assignment and every rule over it.
    const placement=createPlacement(compiled,profileIndex);
    const degree=new Int32Array(tokens.length);
    for(const e of profile.edges){degree[byId.get(e.before)!]!++;degree[byId.get(e.after)!]!++;}
    // MRV heuristic: least choices first, then most dependencies for early rejection.
    const visitOrder=candidates.map((a,i)=>({i,size:a.length,degree:Math.max(...a.map(j=>degree[j]!))}))
      .sort((a,b)=>a.size-b.size||b.degree-a.degree||a.i-b.i).map(x=>x.i);
    function dfs(depth:number):boolean {
      if(totalStates>=maxStates){exceeded=true;return false;}
      totalStates++;
      if(depth===visitOrder.length)return placement.complete();
      const position=visitOrder[depth]!;
      for(const idx of candidates[position]!){
        if(!placement.tryPlace(idx,position))continue;
        if(dfs(depth+1))return true;
        placement.undo();
        if(exceeded)return false;
      }
      return false;
    }
    if(dfs(0))return {...result('accepted',null,'Az összeállított tartalomsorozathoz létezik minden szabályt kielégítő hozzárendelés.',totalStates),matchedProfile:profile.id,matchedTokenIds:placement.witness().map(index=>tokens[index]!.id)};
    if(exceeded)break;
  }
  if(exceeded)return result('indeterminate','search_budget','A keresési keret elfogyott; a megoldás NEM minősíthető hibásnak.',totalStates);
  return result('rejected','rule_violation','A tartalom megvan, de nem létezik az összes szabályt teljesítő elrendezés.',totalStates);
}
