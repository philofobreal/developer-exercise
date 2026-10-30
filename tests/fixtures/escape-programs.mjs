/** Fixed programs for ADR-040 (v19): a method body that calls unknown code with primitive
 * arguments. `free` programs hold orders the oracle finds equivalent, which v18 rejected because
 * the call made the statement unknown and its object escaped, and v19 accepts; `bound` programs
 * hold orders the policy keeps (a list-level external call, two external calls, two possible
 * throws, a caught external call beside a throw) or calls that stay unknown (direct eval, an
 * object argument, a callee the program declares, a shadowed name). The oracle runs them only
 * as fixtures. */
const box=['class Box {','  constructor(name) {','    this.name = name;','    this.log = [];','  }','  add(value) {','    this.log.push(value);','  }','  shout() {',"    record('shout', this.name);",'  }','  check(value) {',"    if (value < 0) throw new RangeError('negative');",'    this.log.push(value);','  }','}'];
/** The Box class with `members` added before its closing brace. */
const boxWith=(...members)=>[...box.slice(0,-1),...members,'}'];
const run=(...body)=>['function run() {',"  const a = new Box('a');","  const b = new Box('b');",...body,'  return JSON.stringify([a, b]);','}'];
export const escapePrograms=new Map([
 // `b.shout()` reads b.name and records it; `a.add` and `b.add` touch other fields or objects.
 ['escape-free-shout-beside-writes',{free:true,source:[...box,...run('  a.add(1);','  b.shout();','  b.add(2);','  a.add(3);')]}],
 // A constructor records its creation: two constructions are two external calls.
 ['escape-free-constructor-records',{free:true,source:['class Tag {','  constructor(name) {','    this.name = name;','    this.items = [];',"    record('new', name);",'  }','  add(value) {','    this.items.push(value);','  }','}','function run() {',"  const a = new Tag('a');","  const b = new Tag('b');",'  a.add(1);','  b.add(2);','  return JSON.stringify([a, b]);','}']}],
 // A callback records each element: it reads b.log, so only b's own writes stay ordered.
 ['escape-free-callback-records',{free:true,source:[...boxWith('  flush() {','    this.log.forEach(value => record(value));','  }'),...run('  b.add(5);','  b.flush();','  a.add(1);','  a.add(2);')]}],
 // A caught external call cannot throw out, but it may not return: it stays ordered with a throw.
 ['escape-free-caught-external',{free:true,source:[...boxWith('  safeShout() {','    try {',"      record('safe', this.name);",'    } catch (error) {','      this.log.push(0);','    }','  }'),...run('  a.add(1);','  b.safeShout();','  a.check(-1);')]}],
 // TypeScript: an ambient declaration names the environment's function, still external.
 ['escape-free-ambient-typescript',{free:true,language:'typescript',source:['declare function record(...args: unknown[]): void;','class Box {','  log: number[] = [];','  constructor(public name: string) {}','  add(value: number): void {','    this.log.push(value);','  }','  shout(): void {',"    record('shout', this.name);",'  }','}','function run(): string {',"  const a = new Box('a');","  const b = new Box('b');",'  a.add(1);','  b.shout();','  a.add(2);','  return JSON.stringify([a, b]);','}']}],
 // A caught external call beside a local write: free when the write reads only this function's
 // bindings, ordered when it reads a script binding that external code could write.
 ['escape-free-caught-beside-local-write',{free:true,source:['var g = 1;',...boxWith('  safeShout() {','    try {',"      record('safe', this.name);",'    } catch (error) {','      this.log.push(0);','    }','  }'),'function run() {',"  const a = new Box('a');",'  let k = 2;','  let x = 0;','  let y = 0;','  a.safeShout();','  x = k;','  y = g;','  return JSON.stringify([a, x, y]);','}']}],
 // Policy P2: a list-level unknown call is external and stays ordered with object operations.
 ['escape-bound-list-level-call',{free:false,source:[...box,'function run() {',"  const a = new Box('a');","  record('start');",'  a.add(1);','  return JSON.stringify(a);','}']}],
 // Two external calls: the recorded trace changes with their order.
 ['escape-bound-two-shouts',{free:false,source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  a.shout();','  b.shout();','  return JSON.stringify([a, b]);','}']}],
 // Both may throw: which exception surfaces depends on the order.
 ['escape-bound-both-throw',{free:false,source:[...box,'function run() {',"  const a = new Box('a');",'  a.check(-1);','  a.shout();','  return JSON.stringify(a);','}']}],
 // Direct eval sees the method's `this`: never external.
 ['escape-bound-eval',{free:false,source:[...boxWith('  evalShout() {',"    eval('record(this.name)');",'  }'),...run('  a.add(1);','  b.evalShout();','  a.add(2);')]}],
 // An object argument hands an own object to unknown code: the object escapes (item 2d).
 ['escape-bound-object-argument',{free:false,source:[...boxWith('  dump() {','    record(this.log);','  }'),...run('  a.add(1);','  b.dump();','  a.add(2);')]}],
 // A callee the program declares is not the environment's: not analysed, so unknown.
 ['escape-bound-declared-callee',{free:false,source:['function note(text) {',"  record('note', text);",'}',...boxWith('  noted() {','    note(this.name);','  }'),...run('  a.add(1);','  b.noted();','  a.add(2);')]}],
 // A parameter shadows the global name: calling a value is unknown code.
 ['escape-bound-shadowed-callee',{free:false,source:[...boxWith('  call(record) {','    record(this.name);','  }'),...run('  a.add(1);','  b.call(1);','  a.add(2);')]}],
].map(([id,fixture])=>[id,{id,origin:'escape',language:'javascript',probe:"(() => { try { return run(); } catch (error) { return 'throws ' + error.message; } })()",...fixture}]));
