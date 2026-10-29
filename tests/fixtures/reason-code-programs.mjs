/** Fixed programs that evidence reason codes the corpus does not isolate (ADR-038). Each
 * always terminates; the oracle runs them only as fixtures, never learner code. */
export const reasonCodePrograms=new Map([
 ['code-write-after-read',{language:'javascript',probe:'run()',source:['function run() {','  let a = 1;','  let b = 2;','  a = b;','  b = 3;','  return [a, b];','}']}],
 ['code-write-after-write',{language:'javascript',probe:'run()',source:['function run() {','  let x = 1;','  x = 2;','  x = 3;','  return x;','}']}],
 ['code-opaque-comment',{language:'javascript',probe:'g()',source:['var a = 1;','/*','  note','*/','function g() {','  return a;','}']}],
 ['code-shared-boundary-lock',{language:'javascript',probe:'[run(1), run(2), run(3)]',source:['function run(n) {','  switch (n) {','    case 1: {','      return 1;','    } case 2: {','      return 2;','    }','  }','  return 0;','}']}],
 ['code-erased-destructuring',{language:'typescript',probe:'evaluate()',source:['declare const { x }: { x: number };','var v = 1;','function evaluate() {','  return v;','}']}],
 ['code-shared-rows',{language:'javascript',probe:'run()',source:['function run() {','  const value = `first','  second`;','  const result = value + \'!\';','  return result;','}']}],
].map(([id,fixture])=>[id,{id,origin:'reason-code',...fixture}]));

/** Codes whose constraint the fixed oracle cannot observe, with the reason; reviewed by hand.
 * reason-codes.test.mjs accepts a waiver only for these codes. */
export const reasonCodeWaivers={
 'module-import':'a modul betöltése a rögzített orákulumban nem futtatható, ezért viselkedési ellenpélda nem képezhető',
 'overload-group':'a szétválasztott TS-overload típushiba; az orákulum csak a szintaxist és a futást látja',
};
