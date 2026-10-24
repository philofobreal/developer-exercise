import type { ExerciseDefinition } from './types.js';
const sum: ExerciseDefinition = {
  schemaVersion:1,id:'sum-js',revision:1,language:'javascript',title:'Összegzés algoritmus',
  description:'A változó deklarációja és inicializálása megelőzi a használatát; a blokkok helyes struktúrája is feltétel.',
  tokens:[
    {id:'fn-open', code:'function sumArrayElements(arr) {', scope:null},
    {id:'sum-init', code:'let sum = 0;',scope:'fn',after:[]},
    {id:'loop-open',code:'for (let i = 0; i < arr.length; i++) {',scope:'fn',after:['sum-init']},
    {id:'accumulate',code:'sum += arr[i];',scope:'loop'},
    {id:'loop-close',code:'}',scope:'fn'},
    {id:'return',code:'return sum;',scope:'fn',after:['loop-close']},
    {id:'fn-close',code:'}',scope:null}
  ],
  blocks:[{id:'fn',open:'fn-open',close:'fn-close',parent:null}, {id:'loop',open:'loop-open',close:'loop-close',parent:'fn'}]
};
const flex: ExerciseDefinition={
 schemaVersion:1,id:'flex-js',revision:1,language:'javascript',title:'Független deklarációk',description:'A két deklaráció felcserélhető, a visszatérés elé kell kerülniük.',
 tokens:[
 {id:'open',code:'function makeUser() {',scope:null},
 {id:'name',code:"const name = 'Ada';",scope:'fn',after:[]},
 {id:'active',code:'const active = true;',scope:'fn',after:[]},
 {id:'return',code:'return { name, active };',scope:'fn',after:['name','active']},
 {id:'close',code:'}',scope:null}
 ],blocks:[{id:'fn',open:'open',close:'close',parent:null}]
};
const tsPermutations:ExerciseDefinition={
 schemaVersion:1,id:'permutations-ts',revision:1,language:'typescript',title:'String permutációk TypeScriptben',description:'Rekurzív permutációs algoritmus, beágyazott blokkokkal.',
 tokens:[
 {id:'fn-open',code:'function stringPermutations(str: string): string[] {',scope:null},
 {id:'base',code:'if (str.length <= 1) return [str];',scope:'fn'},
 {id:'result',code:'const permutations: string[] = [];',scope:'fn'},
 {id:'outer-open',code:'for (let i = 0; i < str.length; i++) {',scope:'fn',after:['result']},
 {id:'char',code:'const char: string = str[i];',scope:'outer'},
 {id:'remaining',code:'const remainingChars: string = str.slice(0, i) + str.slice(i + 1);',scope:'outer'},
 {id:'inner',code:'const innerPermutations: string[] = stringPermutations(remainingChars);',scope:'outer',after:['remaining']},
 {id:'inner-open',code:'for (let j = 0; j < innerPermutations.length; j++) {',scope:'outer',after:['inner','char']},
 {id:'push',code:'permutations.push(char + innerPermutations[j]);',scope:'inner'},
 {id:'inner-close',code:'}',scope:'outer'},
 {id:'outer-close',code:'}',scope:'fn'},
 {id:'return',code:'return permutations;',scope:'fn',after:['outer-close','base']},
 {id:'fn-close',code:'}',scope:null}
 ],blocks:[{id:'fn',open:'fn-open',close:'fn-close',parent:null},{id:'outer',open:'outer-open',close:'outer-close',parent:'fn'},{id:'inner',open:'inner-open',close:'inner-close',parent:'outer'}],
 edges:[{before:'char',after:'push'}]
};
export const examples: ExerciseDefinition[]=[sum,flex,tsPermutations];
