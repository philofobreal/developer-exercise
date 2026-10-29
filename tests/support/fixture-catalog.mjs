/** Every fixed or seeded program the measurements may name by id: the corpus, the object
 * fixtures and the seeded random programs (author tooling). Pinned evidence refers to programs
 * by id only, so the program text stays defined in one place. */
import {corpus} from '../fixtures/ordering-corpus.mjs';
import {objectFixtures} from '../fixtures/object-programs.mjs';
import {reasonCodePrograms} from '../fixtures/reason-code-programs.mjs';
import {randomProgram,randomClassProgram,randomScriptProgram,randomObjectProgram,randomFlowProgram} from './random-programs.mjs';

const seeded=[
 [/^random-(extended-)?(\d+)$/,match=>randomProgram(Number(match[2]),{extended:!!match[1]})],
 [/^random-class-(javascript|typescript)-(\d+)$/,match=>randomClassProgram(Number(match[2]),{language:match[1]})],
 [/^random-script-(javascript|typescript)-(\d+)$/,match=>randomScriptProgram(Number(match[2]),{language:match[1]})],
 [/^object-(javascript|typescript)-(\d+)$/,match=>randomObjectProgram(Number(match[2]),{language:match[1]})],
 [/^flow-(javascript|typescript)-(\d+)$/,match=>randomFlowProgram(Number(match[2]),{language:match[1]})],
];
/** The program named `id`; throws for an unknown id. */
export function fixtureById(id){
 const fixed=corpus.get(id)??objectFixtures.get(id)??reasonCodePrograms.get(id);
 if(fixed)return {language:'javascript',...fixed};
 for(const [pattern,make] of seeded){const match=pattern.exec(id);if(match)return make(match);}
 throw Error('unknown fixture '+id);
}
/** The seeded program kinds: kind → (seed, {language}) → program, or null when the kind has
 * no program in that language. */
export const PROGRAM_KINDS={class:randomClassProgram,script:randomScriptProgram,object:randomObjectProgram,flow:randomFlowProgram,
 function:(seed,{language})=>language==='javascript'?randomProgram(seed,{extended:seed%2===0}):null};
export const LANGUAGES=['javascript','typescript'];

/** The fixed programs and `seeds` seeded programs of every kind and language. */
export function catalog(seeds=8){
 const programs=[...corpus.values(),...objectFixtures.values(),...reasonCodePrograms.values()].map(fixture=>({language:'javascript',...fixture}));
 for(let seed=1;seed<=seeds;seed++)for(const make of Object.values(PROGRAM_KINDS))for(const language of LANGUAGES){const program=make(seed,{language});if(program)programs.push(program);}
 return programs;
}
