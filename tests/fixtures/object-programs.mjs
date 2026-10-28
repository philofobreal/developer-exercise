/** ADR-025: fixed programs for local object footprints, after the master prompt's reference
 * case (`first` / `second` / `store`) and its counter-examples. Each probe returns the whole
 * observable state, so the runtime oracle sees any change of value, order or exception. */
const item=[
 'class Item {',
 '  constructor(name) {',
 '    this.name = name;',
 "    this._alias = '';",
 '    this.active = false;',
 '  }',
 '  set alias(value) {',
 '    this._alias = value;',
 '  }',
 '  get alias() {',
 '    return this._alias;',
 '  }',
 '  activate() {',
 '    this.active = true;',
 '  }',
 '}'];
const referenceStore=[
 'class Store {',
 '  constructor() {',
 '    this.items = [];',
 '  }',
 '  add(item) {',
 '    this.items.push(item);',
 '  }',
 '  list() {',
 "    return this.items.map(entry => entry.name + ':' + entry.alias + ':' + entry.active);",
 '  }',
 '}'];
const build=[
 'function build() {',
 "  const first = new Item('a');",
 "  const second = new Item('b');",
 '  const store = new Store();',
 "  first.alias = 'A';",
 '  store.add(first);',
 '  second.activate();',
 '  store.add(second);',
 '  return store.list();',
 '}'];
const fixtures=[
 {id:'prompt-store-alias',probe:'build()',source:[...item,...referenceStore,...build]},
 {id:'prompt-copying-store',probe:'build()',source:[...item,
  'class Store {','  constructor() {','    this.items = [];','  }','  add(item) {',"    this.items.push(item.name + '=' + item.alias);",'  }','  list() {',"    return this.items.join(',');",'  }','}',...build]},
 {id:'prompt-shared-log',probe:'run()',source:[
  'class Logger {','  attach(log) {','    this.log = log;','  }','  note(text) {','    this.log.push(text);','  }','}',
  'function run() {','  const log = [];','  const first = new Logger();','  const second = new Logger();','  first.attach(log);','  second.attach(log);',"  first.note('x');","  second.note('y');","  return log.join(',');",'}']},
 {id:'prompt-two-arrays',probe:'run()',source:[
  'function run() {','  const left = [];','  const right = [];','  left.push(1);','  right.push(2);','  left.push(3);','  return [left, right];','}']},
 {id:'prompt-throwing-setters',probe:'(() => { try { return rename(); } catch (error) { return error.message; } })()',source:[
  'class Item {','  constructor(name) {','    this.name = name;',"    this._alias = '';",'  }','  set alias(value) {',"    if (value === '') {","      throw new Error('empty alias');",'    }','    this._alias = value;','  }','  rename(value) {',"    if (value === '') {","      throw new Error('empty name');",'    }','    this.name = value;','  }','}',
  'function rename() {',"  const first = new Item('a');","  const second = new Item('b');","  first.alias = '';","  second.rename('');",'  return [first, second];','}']},
 {id:'prompt-unknown-call',probe:'build()',source:[
  'class Item {','  constructor(name) {','    this.name = name;','  }','  activate() {',"    record('activate', this.name);",'  }','}',
  'function build() {',"  const first = new Item('a');","  const second = new Item('b');",'  first.activate();','  second.activate();','  return [first.name, second.name];','}']},
 {id:'prompt-alias-binding',probe:'build()',source:[...item,
  'function build() {',"  const first = new Item('a');",'  const same = first;',"  first.alias = 'A';","  same.alias = 'B';",'  return first.alias;','}']},
 {id:'prompt-store-alias-ts',language:'typescript',probe:'build()',source:[
  'class Item {',"  private _alias = '';",'  active = false;','  constructor(public name: string) {}','  set alias(value: string) {','    this._alias = value;','  }','  get alias(): string {','    return this._alias;','  }','  activate(): void {','    this.active = true;','  }','}',
  'class Store {','  private items: Item[] = [];','  add(item: Item): void {','    this.items.push(item);','  }','  list(): string[] {',"    return this.items.map(entry => entry.name + ':' + entry.alias + ':' + entry.active);",'  }','}',
  'function build(): string[] {',"  const first = new Item('a');","  const second = new Item('b');",'  const store = new Store();',"  first.alias = 'A';",'  store.add(first);','  second.activate();','  store.add(second);','  return store.list();','}']},
 // ADR-028: only the setter may throw; the other object's write is dead once it does.
 {id:'prompt-one-thrower',probe:'(() => { try { return build(); } catch (error) { return error.message; } })()',source:[
  'class Item {','  constructor(name) {','    this.name = name;',"    this._alias = '';",'    this.active = false;','  }','  set alias(value) {',"    if (value === '') {","      throw new Error('empty alias');",'    }','    this._alias = value;','  }','  activate() {','    this.active = true;','  }','}',
  'function build() {',"  const first = new Item('a');","  const second = new Item('b');","  first.alias = '';",'  second.activate();','  return [first, second];','}']},
 // ADR-028: writes that add keys to an object keep their order (the key order is observable).
 {id:'prompt-new-keys',probe:'build()',source:['function build() {','  const box = {a: 1};','  box.b = 2;','  box.c = 3;','  return JSON.stringify(box);','}']},
 // ADR-028: the runtime master prompt's own input — a string method in a setter, two fields of
 // one object written by independent statements and a list-level if/else on an own object.
 {id:'prompt-mini-fixture',language:'typescript',probe:'runMiniFixture()',source:[
  'type State = "idle" | "active";','','class User {','    private _alias = "";','    state: State = "idle";','    score = 0;','',
  '    constructor(public readonly id: string, public name: string) {}','','    set alias(value: string) {','        this._alias = value.trim();','    }','',
  '    get alias(): string {','        return this._alias;','    }','','    activate(): void {','        this.state = "active";','    }','',
  '    updateScore(value: number): void {','        this.score = value;','    }','}','','class Store<T> {','    private readonly items: T[] = [];','',
  '    add(item: T): void {','        this.items.push(item);','    }','','    list(): readonly T[] {','        return this.items;','    }','}','',
  'export function runMiniFixture(): readonly User[] {','    const store = new Store<User>();','    const first = new User("u1", "Anna");','    const second = new User("u2", "Bela");','',
  '    first.alias = "A";','    second.activate();','','    store.add(first);','    store.add(second);','','    const bonus = 5;','    const nextScore = 40 + bonus;','    first.updateScore(nextScore);','',
  '    if (second.state === "active") {','        second.updateScore(90);','    } else {','        second.updateScore(10);','    }','','    return store.list();','}']},
];
export const objectFixtures=new Map(fixtures.map(fixture=>[fixture.id,{origin:'object',language:'javascript',...fixture}]));
