/** Fixed, bounded ordering fixtures shared by the semantic-oracle tests and the
 * metrics runner. Every fixture is author-trusted test data; probes call only
 * the fixture itself and record(). Nothing here comes from learners. */
import {readFile} from 'node:fs/promises';

const library={
 'algo-bfs-js':'(() => { const grid = [[0, 0, 0, 0], [1, 1, 0, 1], [0, 0, 0, 0], [0, 1, 1, 0]]; return [shortestPath(grid, [0, 0], [3, 3]), shortestPath(grid, [0, 0], [2, 0]), shortestPath(grid, [3, 0], [0, 3]), shortestPath([[0, 1], [1, 0]], [0, 0], [1, 1]), shortestPath(grid, [2, 2], [2, 2]), shortestPath([[0, 0], [0, 0]], [0, 0], [5, 5])]; })()',
 'algo-sort-search-js':'(() => { const input = [5, 2, 9, 1, 5, 6, -3]; const sorted = insertionSort(input); return [sorted, input, [-3, 1, 5, 6, 9, 4, 10].map((target) => binarySearch(sorted, target))]; })()',
 'class-inventory-ts':"(() => { const inventory = new Inventory(3); inventory.add({ sku: 'a', name: 'alma', quantity: 2, price: 100 }); inventory.add({ sku: 'b', name: 'barack', quantity: 5, price: 40 }); inventory.add({ sku: 'a', name: 'alma', quantity: 4, price: 100 }); inventory.add({ sku: 'c', name: 'citrom', quantity: 1, price: 70 }); return [inventory.totalValue(), inventory.lowStock(), Object.keys(inventory)]; })()",
 'class-accounts-ts':"(() => { const account = new CreditAccount('Ana', 50); account.deposit(100); const results = [account.withdraw(120), account.withdraw(40), account.withdraw(5)]; account.deposit(7); return [results, account.statement(), Object.keys(account), account instanceof Account]; })()",
};

const fixtures=[
 // Scope and ordering scenarios (also used by complex-scope-ordering.test.mjs).
 {id:'scope-outer-const-loop',origin:'scenario',language:'javascript',source:[
  'function evaluate() {','  const limit = 3;','  const step = 2;','  let total = 0;','  for (let i = 0; i < limit; i++) {','    const scaled = i * step;','    total += scaled;','  }','  return total;','}']},
 {id:'scope-three-levels-shadowing',origin:'scenario',language:'javascript',source:[
  'function evaluate() {','  const base = 10;',"  const label = 'outer';",'  {',"    const label = 'inner';",'    const offset = base + 1;','    {','      const scaled = offset * 2;','      const shifted = offset + 2;','      record(label, scaled, shifted);','    }','  }','  return label;','}']},
 {id:'hoisting-var-function',origin:'scenario',language:'javascript',source:[
  'function evaluate() {','  var count = 0;','  for (var i = 0; i < 3; i++) {','    count += helper(i);','  }','  function helper(value) {','    return value * 10;','  }','  return count + i;','}']},
 {id:'top-level-functions',origin:'scenario',language:'javascript',source:[
  'function double(value) {','  return value * 2;','}','function evaluate() {','  return double(21);','}']},
 {id:'closure-deferred-read',origin:'scenario',language:'javascript',source:[
  'function makeCounter(step) {','  let count = 0;','  const increment = () => {','    count += step;','    return count;','  };','  return increment;','}','function evaluate() {','  const counter = makeCounter(5);','  counter();','  return counter();','}']},
 {id:'else-if-shared-boundaries',origin:'scenario',language:'javascript',source:[
  'function classify(n) {','  const big = 10;','  const huge = 100;','  let label;','  if (n > huge) {',"    label = 'huge';",'  } else if (n > big) {',"    label = 'big';",'  } else {',"    label = 'small';",'  }','  return label;','}','function evaluate() {','  return [5, 50, 500].map(classify);','}']},
 {id:'labelled-loops',origin:'scenario',language:'javascript',source:[
  'function evaluate() {','  const found = [];','  outer: for (let i = 0; i < 4; i++) {','    for (let j = 0; j < 4; j++) {','      if (j > i) {','        continue outer;','      }','      if (i + j === 5) {','        break outer;','      }','      found.push(i * 10 + j);','    }','  }','  return found;','}']},
 {id:'try-finally-switch',origin:'scenario',language:'javascript',source:[
  'function evaluate() {','  const log = [];',"  for (const value of [1, 'x', 3]) {",'    try {',"      if (typeof value !== 'number') {","        throw new TypeError('bad ' + value);",'      }','      log.push(value * 2);','    } catch (error) {','      log.push(error.message);','    } finally {',"      log.push('done');",'    }','    switch (value) {','      case 1:',"        log.push('one');",'        break;','      default:',"        log.push('other');",'    }','  }','  return log;','}']},
 {id:'destructuring-object-template',origin:'scenario',language:'javascript',source:[
  'function evaluate() {','  const point = { x: 3, y: 4 };','  const scale = 2;','  const { x, y } = point;','  const label = `${x}:${y}`;','  return [label, x * scale, y * scale];','}']},
 {id:'js-class-fields-methods',origin:'scenario',language:'javascript',source:[
  'class Counter {','  count = 0;','  step = this.count + 1;','  increment() {','    this.count += this.step;','    return this.count;','  }','  reset() {','    this.count = 0;','  }','}','function evaluate() {','  const counter = new Counter();','  counter.increment();','  const second = counter.increment();','  counter.reset();','  return [second, counter.count, Object.keys(counter)];','}']},
 {id:'ts-interface-type-literal',origin:'scenario',language:'typescript',source:[
  'interface Point {','  x: number;','  y: number;','  label?: string;','}','type Pair = {','  left: Point;','  right: Point;','};','function evaluate(): string {','  const a: Point = { x: 1, y: 2 };',"  const pair: Pair = { left: a, right: { x: 3, y: 4, label: 'b' } };",'  return JSON.stringify(pair);','}']},
 {id:'ts-enum',origin:'scenario',language:'typescript',source:[
  'enum Level {','  Low,','  Medium,','  High,','}','function evaluate(): number[] {','  return [Level.Low, Level.Medium, Level.High];','}']},
 {id:'ts-fields-declare-parameter-property',origin:'scenario',language:'typescript',source:[
  'class Config {','  readonly base: number = 2;','  readonly doubled: number = this.base * 2;','  declare readonly tag?: string;','  constructor(readonly name: string) {}','  describe(): string {',"    return this.name + '=' + this.doubled;",'  }','}','function evaluate(): string[] {',"  const config = new Config('cfg');","  return [config.describe(), Object.keys(config).join(',')];",'}']},
 {id:'ts-inheritance',origin:'scenario',language:'typescript',source:[
  'class Shape {','  constructor(readonly name: string) {}','  area(): number {','    return 0;','  }','}','class Square extends Shape {','  constructor(private readonly side: number) {',"    super('square');",'  }','  area(): number {','    return this.side * this.side;','  }','}','function evaluate(): string {','  const shape: Shape = new Square(3);',"  return shape.name + ':' + shape.area();",'}']},
 {id:'ts-method-outer-declaration',origin:'scenario',language:'typescript',source:[
  'class Stats {','  mean(values: number[]): number {','    const scale: number = 2;','    let sum = 0;','    for (const value of values) {','      sum += value * scale;','    }','    return values.length === 0 ? 0 : sum / values.length;','  }','}','function evaluate(): number[] {','  const stats = new Stats();','  return [stats.mean([1, 2, 3, 4]), stats.mean([])];','}']},

 // Prompt examples A–E and harder WP1 constructs.
 {id:'ch-independent-declarations',origin:'challenge',language:'javascript',probe:'calculate()',source:[
  'function calculate() {','  const a = 10;','  const b = 20;','  const c = a + b;','  return c;','}']},
 {id:'ch-unknown-calls',origin:'challenge',language:'javascript',source:[
  'function evaluate() {',"  record('log', 'first');","  record('save', 'second');",'  return 0;','}']},
 {id:'ch-shadowing-top-level',origin:'challenge',language:'javascript',probe:'outer',source:[
  'const value = 10;','{','  const value = 20;','  record(value);','}','const outer = value;']},
 {id:'ch-write-then-read',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  let total = 10;','  total += 5;','  return total;','}']},
 {id:'ch-unknown-call-then-read',origin:'challenge',language:'javascript',probe:'result',source:[
  'let counter = 0;','changeCounter();','const result = counter;','function changeCounter() {','  counter += 1;','}']},
 {id:'ch-aliasing',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const box = { count: 1 };','  const alias = box;',"  const label = 'box';",'  alias.count = 5;','  const seen = box.count;','  return [label, seen];','}']},
 {id:'ch-getter',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const source = {','    get value() {',"      record('get');",'      return 1;','    },','  };',"  const before = 'start';",'  const read = source.value;','  record(before);','  return read;','}']},
 {id:'ch-async-await',origin:'challenge',language:'javascript',asynchronous:true,source:[
  'async function evaluate() {','  const first = 1;','  const second = await Promise.resolve(2);','  const third = 3;','  record(first, third);','  return first + second + third;','}']},
 {id:'ch-generator',origin:'challenge',language:'javascript',source:[
  'function* steps() {','  const start = 1;','  yield start;','  const next = 2;','  yield next;','}','function evaluate() {','  return [...steps()];','}']},
 {id:'ch-direct-eval',origin:'challenge',language:'javascript',strict:false,source:[
  'function evaluate() {','  const a = 1;','  const b = 2;',"  eval('var c = a + b');",'  return c;','}']},
 {id:'ch-loop-and-catch-bindings',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const out = [];',"  for (const item of ['a', 'b']) {",'    const copy = item;',"    const tag = 'item';","    out.push(tag + ':' + copy);",'  }','  try {',"    throw new Error('boom');",'  } catch (error) {','    const caught = error;',"    const kind = 'error';","    out.push(kind + ':' + caught.message);",'  }','  return out;','}']},
 {id:'ch-parameter-reads',origin:'challenge',language:'javascript',source:[
  'function describe(person, greeting) {','  const name = person;','  const prefix = greeting;',"  const fallback = 'n/a';",'  return [prefix, name, fallback];','}','function evaluate() {',"  return describe('Ada', 'Hello');",'}']},
 {id:'ch-fresh-allocations',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const limit = 3;',"  const settings = { limit, mode: 'fast' };",'  const steps = [1, 2, limit];','  const describe = () => settings.mode + steps.length;','  const empty = [];','  return [settings, steps, describe(), empty];','}']},
 {id:'ch-multiline-closure',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  let count = 0;','  const increment = () => {','    count += 1;','    return count;','  };',"  const label = 'counter';",'  increment();','  return [label, increment()];','}']},
 {id:'ch-hoisted-helpers',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const total = sum([1, 2, 3]);','  return total * factor();','  function sum(values) {','    let acc = 0;','    for (const value of values) {','      acc += value;','    }','    return acc;','  }','  function factor() {','    return 2;','  }','}']},
 {id:'ch-let-without-initializer',origin:'challenge',language:'javascript',source:[
  'function classify(n) {','  const limit = 10;','  let label;','  if (n > limit) {',"    label = 'big';",'  } else {',"    label = 'small';",'  }','  return label;','}','function evaluate() {','  return [classify(3), classify(30)];','}']},
 {id:'ch-typeof-strict-equality',origin:'challenge',language:'javascript',source:[
  'function evaluate() {',"  const user = { name: 'Ada' };","  const fallback = 'guest';","  const present = user !== null && typeof user === 'object';",'  const chosen = present ? user : fallback;','  return [present, chosen];','}']},
 {id:'ch-var-operand',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  var base = 2;','  const doubled = base * 2;',"  var label = 'x';",'  return [doubled, label];','}']},
 {id:'ch-multiline-object',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const origin = 0;','  const config = {','    start: origin,','    end: 10,','  };',"  const name = 'range';",'  return [config, name];','}']},
 {id:'ch-template-coercion',origin:'challenge',language:'javascript',source:[
  'function evaluate() {','  const item = {','    toString() {',"      record('toString');","      return 'item';",'    },','  };',"  const marker = 'm';",'  const text = `${item}`;','  record(marker);','  return text;','}']},
 {id:'ch-block-function-declaration',origin:'challenge',language:'javascript',strict:false,source:[
  'function evaluate() {','  const seen = [];','  {','    seen.push(typeof inner);','    function inner() {','      return 1;','    }','  }','  seen.push(typeof inner);','  return seen;','}']},
 {id:'ch-ts-hoisted-types',origin:'challenge',language:'typescript',probe:'[evaluate(), unit]',source:[
  'function evaluate(): number {','  return length({ x: 3, y: 4 });','}','function length(point: Point): number {','  const squared: number = point.x * point.x + point.y * point.y;','  return Math.sqrt(squared);','}','interface Point {','  x: number;','  y: number;','}',"type Unit = 'px' | 'em';","const unit: Unit = 'px';"]},
 {id:'ch-ts-class-declarations',origin:'challenge',language:'typescript',source:[
  'class Base {','  greet(): string {',"    return 'base';",'  }','}','class Derived extends Base {','  override greet(): string {',"    return 'derived:' + super.greet();",'  }','}',"const label: string = 'x';",'function evaluate(): string[] {','  return [new Derived().greet(), label];','}']},
 {id:'ch-ts-static-initializer',origin:'challenge',language:'typescript',source:[
  'let created = 0;','class Registry {','  static readonly id = ++created;','}','const after = created;','function evaluate(): number[] {','  return [Registry.id, after];','}']},
 {id:'ch-ts-overloads',origin:'challenge',language:'typescript',source:[
  'function pick(value: string): string;','function pick(value: number): number;','function pick(value: string | number): string | number {','  return value;','}',"const fixed: string = 'k';",'function evaluate(): Array<string | number> {','  return [pick(fixed), pick(2)];','}']},
 // WP6 reproductions: each one made the ADR-008 generator accept a wrong order.
 // Position-free rows entering a multi-row statement or a shared-boundary block:
 {id:'wp6-hoisted-into-continued-call',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  const out = record(','    1,','  );','  const size = 2;','  return [out, size, helper()];','  function helper() { return 2; }','}']},
 {id:'wp6-hoisted-into-shared-boundaries',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  const out = [];','  try {','    out.push(1);','  } catch (error) {','    out.push(2);','  }','  if (out.length > 1) {','    out.push(3);','  } else {','    out.push(4);','  }','  return helper(out);','  function helper(values) { return values.join(); }','}']},
 {id:'wp6-member-into-continued-field',origin:'wp6',language:'typescript',source:[
  'class Box {','  items: number[] = [','    1,','  ];','  size(): number { return this.items.length; }','  constructor(readonly label: string) {}','}','function evaluate(): Array<number | string> {',"  const box = new Box('b');",'  return [box.size(), box.label, Object.keys(box).join()];','}']},
 // A position-free row between an overload signature and its implementation (TS2391).
 {id:'wp6-overload-groups',origin:'wp6',language:'typescript',source:[
  'class Format {','  show(value: string): string;','  show(value: number): string;','  show(value: string | number): string {','    return String(value);','  }','  twice(value: string): string { return value + value; }','}','function pick(value: string): string;','function pick(value: string | number): string | number {','  return value;','}','function evaluate(): string[] {','  const format = new Format();',"  return [format.show(1), format.twice(format.show('a')), pick('p')];",'}']},
 // ADR-010: reflectable property order. The probes only call methods, so a
 // call-only comparison cannot see a reordering; the reflective oracle can.
 {id:'refl-prototype-and-static-methods',origin:'reflection',language:'javascript',source:[
  'class Shape {','  constructor(size) {','    this.size = size;','  }','  area() {','    return this.size * this.size;','  }','  get label() {',"    return 'shape:' + this.size;",'  }','  perimeter() {','    return 4 * this.size;','  }','  static unit() {','    return new Shape(1);','  }','  static of(size) {','    return new Shape(size);','  }','}','class Square extends Shape {','  diagonal() {','    return this.size * 2;','  }','  describe() {','    return this.label;','  }','}','function evaluate() {','  const square = new Square(3);','  return [square.area(), square.perimeter(), square.label, square.diagonal(), square.describe(), Shape.unit().area(), Shape.of(2).size];','}']},
 {id:'refl-explicit-property-names',origin:'reflection',language:'javascript',source:[
  'class Example {','  first() {','    return 1;','  }','  second() {','    return 2;','  }','}','function evaluate() {','  const methodNames = Object.getOwnPropertyNames(Example.prototype);','  return [new Example().first(), methodNames, Reflect.ownKeys(Example)];','}']},
 {id:'refl-index-private-accessor-duplicate',origin:'reflection',language:'javascript',source:[
  'class Table {','  #secret() {',"    return 's';",'  }','  1() {',"    return 'one';",'  }','  0() {',"    return 'zero';",'  }','  name() {',"    return 'table';",'  }','  reveal() {','    return this.#secret();','  }','  get size() {','    return 2;','  }','  set size(value) {',"    record('set', value);",'  }','  again() {',"    return 'first';",'  }','  again() {',"    return 'second';",'  }','  [record(\'key\') ?? \'computed\']() {',"    return 'computed';",'  }','}','function evaluate() {','  const table = new Table();','  table.size = 5;','  return [table[0](), table[1](), table.name(), table.reveal(), table.size, table.again(), table.computed()];','}']},
 {id:'refl-ts-erased-and-overloads',origin:'reflection',language:'typescript',source:[
  'interface Named {','  name(): string;','  id: number;','}','abstract class Base implements Named {','  declare tag: string;','  abstract id: number;','  abstract kind(): string;','  name(): string {',"    return 'base';",'  }','  format(value: string): string;','  format(value: number): string;','  format(value: string | number): string {','    return String(value);','  }','  describe(): string {',"    return this.name() + ':' + this.kind();",'  }','}','class Item extends Base {','  id = 7;','  constructor(readonly label: string) {','    super();','  }',"  kind(): string { return 'item'; }",'  static create(): Item {',"    return new Item('x');",'  }','  static empty(): Item {',"    return new Item('');",'  }','}','function evaluate(): Array<string | number> {','  const item = Item.create();','  return [item.describe(), item.format(3), item.id, item.label, Item.empty().label];','}']},
 {id:'refl-script-globals',origin:'reflection',language:'javascript',probe:'evaluate()',source:[
  'function alpha() {','  return 1;','}','function beta() {','  return 2;','}','var one = 1;','var two = 2;',"const local = 'l';",'function evaluate() {','  return [alpha(), beta(), one, two, local];','}']},
 // Post-ADR-010 review: an `accessor` field defines a get/set pair among the
 // methods, and TypeScript emits enums, instantiated namespaces and import
 // aliases as script-level var declarations.
 {id:'refl-ts-accessor-fields',origin:'reflection',language:'typescript',source:[
  'class Gauge {','  read(): number {','    return this.level;','  }',"  label = 'g';",'  accessor level = 1;','  static make(): Gauge {','    return new Gauge();','  }',"  static accessor unit = 'u';",'  accessor #hidden = 0;','  bump(): number {','    this.#hidden += 1;','    return this.#hidden;','  }','  total(): number {','    return this.level + this.#hidden;','  }','}','function evaluate(): Array<number | string> {','  const gauge = Gauge.make();','  return [gauge.read(), gauge.label, Gauge.unit, gauge.bump(), gauge.total()];','}']},
 {id:'refl-ts-emitted-globals',origin:'reflection',language:'typescript',source:[
  'namespace Shapes {','  export interface Box {','    size: number;','  }','}','function alpha(): number {','  return 1;','}','enum Color {','  Red,','  Green,','}','namespace Tools {','  export const twice = (value: number): number => value * 2;','}','import double = Tools.twice;','function evaluate(): Array<number | string> {','  const box: Shapes.Box = { size: 2 };','  return [alpha(), Color.Green, Color[0], double(box.size)];','}']},
 // "Pure" rows that throw (uninitialised binding); a closure observes the order.
 {id:'wp6-self-referential-initializer',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  const log = [];',"  let probe = () => 'unset';",'  function run() {','    probe = () => typeof marker;',"    const marker = 'm';",'    const broken = broken;','  }','  try { run(); } catch (error) { log.push(error.name); }','  try { log.push(probe()); } catch (error) { log.push(error.name); }','  return log;','}']},
 {id:'wp6-outer-binding-before-initialization',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  const log = [];',"  let probe = () => 'unset';",'  try { run(); } catch (error) { log.push(error.name); }','  try { log.push(probe()); } catch (error) { log.push(error.name); }','  const config = 1;','  return log;','  function run() {','    probe = () => typeof marker;',"    const marker = 'm';",'    const early = config;','  }','}']},
 {id:'wp6-case-clause-binding',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  const log = [];',"  let probe = () => 'unset';",'  function run(step) {','    switch (step) {','      case 1:',"        const shared = 's';",'        break;','      case 2: {','        probe = () => typeof marker;',"        const marker = 'm';",'        const early = shared;','      }','    }','  }','  try { run(2); } catch (error) { log.push(error.name); }','  try { log.push(probe()); } catch (error) { log.push(error.name); }','  return log;','}']},
 // Local write sets: never-reassigned let/var behave like const; written ones stay barriers.
 {id:'wp6-unwritten-let-var',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  let rate = 3;',"  var unit = 'cm';",'  const width = rate * 2;',"  const label = unit + ':' + width;",'  const height = rate + 1;','  return [label, height];','}']},
 {id:'wp6-written-let-coercion',origin:'wp6',language:'javascript',source:[
  'function evaluate() {','  let count = 0;','  let base = 2;','  if (count === 0) {','    base = { valueOf() { count += 1; return count; } };','  }','  const small = base * 2;','  const large = base * 10;','  return [small, large];','}']},
 // ADR-013: local writes commute unless they conflict; clause chains keep each row in its clause.
 {id:'prec-else-chain-local-writes',origin:'precision',language:'javascript',source:[
  'function evaluate() {','  const results = [];','  for (const n of [1, 5, 50]) {','    let label;','    let size;','    if (n > 10) {',"      label = 'big';",'      size = 3;','    } else if (n > 2) {',"      label = 'mid';",'      size = label.length;','    } else {',"      label = 'small';",'      size = 1;','    }','    results.push([label, size]);','  }','  return results;','}']},
 {id:'prec-try-catch-finally',origin:'precision',language:'javascript',source:[
  'function evaluate() {','  let a = 0;','  let b = 0;','  let c = 0;','  try {','    a = 1;','    b = 2;',"    record('try', a);",'    c = b;','  } catch (error) {','    a = 3;','    b = 4;','  } finally {','    c = c + 1;','    b = 5;','  }','  return [a, b, c];','}']},
 {id:'prec-ts-clause-chain',origin:'precision',language:'typescript',source:[
  'interface Point {','  x: number;','  y: number;','}','function evaluate(): Array<number | string> {','  let best: Point = { x: 0, y: 0 };','  let label = "none";','  const candidates: Point[] = [{ x: 1, y: 2 }, { x: 3, y: 1 }];','  for (const point of candidates) {','    if (point.x > best.x) {','      best = point;','      label = "x";','    } else {','      label = "keep";','      best = best;','    }','  }','  return [best.x, best.y, label];','}']}
];

const evaluateSource=(await readFile(new URL('./evaluate-ordering.js',import.meta.url),'utf8')).replace(/\r\n?/g,'\n').trimEnd().split('\n');
fixtures.push({id:'evaluate-ordering',origin:'regression',language:'javascript',source:evaluateSource});
for(const [id,probe] of Object.entries(library)){
 const model=JSON.parse(await readFile(new URL(`../../examples/${id}.json`,import.meta.url),'utf8'));
 fixtures.push({id,origin:'library',language:model.language,probe,source:model.lines.map(line=>line.code)});
}

/** id → {id, origin, language, source: string[], probe = 'evaluate()', strict = true, asynchronous = false} */
export const corpus=new Map(fixtures.map(fixture=>[fixture.id,{probe:'evaluate()',...fixture}]));
