/** Fixed programs for ADR-040 (plan phase 4, item 2): a method body that calls unknown code with
 * primitive arguments. `free` programs hold orders the oracle finds equivalent but v18 rejects,
 * because the call makes the statement unknown and its object escapes; `bound` programs hold
 * orders the policy keeps (a list-level external call, two external calls, two possible throws).
 * The oracle runs them only as fixtures. */
const box=['class Box {','  constructor(name) {','    this.name = name;','    this.log = [];','  }','  add(value) {','    this.log.push(value);','  }','  shout() {',"    record('shout', this.name);",'  }','  check(value) {',"    if (value < 0) throw new RangeError('negative');",'    this.log.push(value);','  }','}'];
export const escapePrograms=new Map([
 // `b.shout()` reads b.name and records it; `a.add` and `b.add` touch other fields or objects.
 ['escape-free-shout-beside-writes',{free:true,source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  a.add(1);','  b.shout();','  b.add(2);','  a.add(3);','  return JSON.stringify([a, b]);','}']}],
 // Policy P2: a list-level unknown call is external and stays ordered with object operations.
 ['escape-bound-list-level-call',{free:false,source:[...box,'function run() {',"  const a = new Box('a');","  record('start');",'  a.add(1);','  return JSON.stringify(a);','}']}],
 // Two external calls: the recorded trace changes with their order.
 ['escape-bound-two-shouts',{free:false,source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  a.shout();','  b.shout();','  return JSON.stringify([a, b]);','}']}],
 // Both may throw: which exception surfaces depends on the order.
 ['escape-bound-both-throw',{free:false,source:[...box,'function run() {',"  const a = new Box('a');",'  a.check(-1);','  a.shout();','  return JSON.stringify(a);','}']}],
].map(([id,fixture])=>[id,{id,origin:'escape',language:'javascript',probe:"(() => { try { return run(); } catch (error) { return 'throws ' + error.message; } })()",...fixture}]));
