/** The task corpus: classroom-style exercises, larger than the scenario fixtures, that
 * combine the constructs a real assignment uses together (parameterised helpers, classes,
 * closures, collections, exceptions, generics, enums, unions). Each task is measured under
 * both input contracts (ADR-050), so its probe passes valid plain data only. Every program
 * is fixed, author-trusted, bounded test data; nothing here comes from learners.
 * id → {language, source: string (LF), probe?} */
export const taskPrograms={
 'task-word-frequency-js':{language:'javascript',source:`function wordFrequency(text, limit) {
  const words = text.toLowerCase().split(/\\W+/).filter(Boolean);
  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const ranked = [...counts.entries()];
  ranked.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.slice(0, limit);
}
function evaluate() {
  return [wordFrequency('A rose is a rose is a rose', 2), wordFrequency('', 3), wordFrequency('x y z', 5)];
}`},
 'task-matrix-stats-js':{language:'javascript',source:`function matrixStats(matrix) {
  const rows = matrix.length;
  const cols = rows === 0 ? 0 : matrix[0].length;
  const rowSums = [];
  const colSums = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    let sum = 0;
    for (let c = 0; c < cols; c++) {
      sum += matrix[r][c];
      colSums[c] += matrix[r][c];
    }
    rowSums.push(sum);
  }
  const total = rowSums.reduce((a, b) => a + b, 0);
  return { rows, cols, rowSums, colSums, total };
}
function evaluate() {
  return [matrixStats([[1, 2, 3], [4, 5, 6]]), matrixStats([]), matrixStats([[7]])];
}`},
 'task-ledger-js':{language:'javascript',source:`class Ledger {
  constructor(owner) {
    this.owner = owner;
    this.balance = 0;
    this.entries = [];
  }
  deposit(amount) {
    if (amount <= 0) {
      throw new RangeError('invalid amount');
    }
    this.balance += amount;
    this.entries.push(['in', amount]);
  }
  withdraw(amount) {
    if (amount > this.balance) {
      throw new Error('insufficient funds');
    }
    this.balance -= amount;
    this.entries.push(['out', amount]);
  }
}
function evaluate() {
  const ledger = new Ledger('Bea');
  const errors = [];
  ledger.deposit(100);
  try {
    ledger.withdraw(150);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    ledger.deposit(-5);
  } catch (error) {
    errors.push(error.name);
  }
  ledger.withdraw(30);
  return [ledger.balance, ledger.entries, errors];
}`},
 'task-group-by-js':{language:'javascript',source:`function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key];
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(item.name);
    return groups;
  }, {});
}
function summarize(people) {
  const byCity = groupBy(people, 'city');
  const byRole = groupBy(people, 'role');
  const cities = Object.keys(byCity).sort();
  const roles = Object.keys(byRole).sort();
  return { cities, roles, byCity, byRole };
}
function evaluate() {
  return summarize([
    { name: 'Ann', city: 'Pécs', role: 'dev' },
    { name: 'Bob', city: 'Győr', role: 'qa' },
    { name: 'Cili', city: 'Pécs', role: 'qa' },
  ]);
}`},
 'task-form-validation-js':{language:'javascript',source:`function validate(form) {
  const errors = [];
  const name = form.name.trim();
  const age = Number(form.age);
  if (name.length === 0) {
    errors.push('name required');
  }
  if (!Number.isInteger(age) || age < 0) {
    errors.push('age invalid');
  }
  if (!form.email.includes('@')) {
    errors.push('email invalid');
  }
  return { ok: errors.length === 0, name, errors };
}
function evaluate() {
  return [validate({ name: ' Ann ', age: '31', email: 'ann@example.org' }), validate({ name: '', age: 'x', email: 'nope' })];
}`},
 'task-search-tree-js':{language:'javascript',source:`class Node {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}
class Tree {
  constructor() {
    this.root = null;
    this.size = 0;
  }
  insert(value) {
    const node = new Node(value);
    this.size++;
    if (this.root === null) {
      this.root = node;
      return;
    }
    let current = this.root;
    while (true) {
      const side = value < current.value ? 'left' : 'right';
      if (current[side] === null) {
        current[side] = node;
        return;
      }
      current = current[side];
    }
  }
  inOrder(node = this.root, out = []) {
    if (node !== null) {
      this.inOrder(node.left, out);
      out.push(node.value);
      this.inOrder(node.right, out);
    }
    return out;
  }
}
function evaluate() {
  const tree = new Tree();
  for (const value of [5, 3, 8, 1, 4, 9]) {
    tree.insert(value);
  }
  return [tree.inOrder(), tree.size];
}`},
 'task-memoize-js':{language:'javascript',source:`function memoize(fn) {
  const cache = new Map();
  let hits = 0;
  const wrapped = (n) => {
    if (cache.has(n)) {
      hits++;
      return cache.get(n);
    }
    const value = fn(n);
    cache.set(n, value);
    return value;
  };
  wrapped.stats = () => ({ hits, size: cache.size });
  return wrapped;
}
function evaluate() {
  const square = memoize((n) => n * n);
  const results = [square(3), square(4), square(3)];
  return [results, square.stats()];
}`},
 'task-bracket-stack-ts':{language:'typescript',source:`class Stack<T> {
  private items: T[] = [];
  push(item: T): void {
    this.items.push(item);
  }
  pop(): T | undefined {
    return this.items.pop();
  }
  get size(): number {
    return this.items.length;
  }
}
function balanced(text: string): boolean {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack = new Stack<string>();
  for (const char of text) {
    if ('([{'.includes(char)) {
      stack.push(char);
    } else if (char in pairs) {
      if (stack.pop() !== pairs[char]) {
        return false;
      }
    }
  }
  return stack.size === 0;
}
function evaluate(): boolean[] {
  return ['(a[b]{c})', '(]', '((', ''].map(balanced);
}`},
 'task-cart-total-ts':{language:'typescript',source:`interface Item {
  name: string;
  price: number;
  quantity: number;
}
type Discount = { threshold: number; percent: number };
function cartTotal(items: Item[], discount: Discount): { subtotal: number; saved: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const eligible = subtotal >= discount.threshold;
  const saved = eligible ? Math.round((subtotal * discount.percent) / 100) : 0;
  const total = subtotal - saved;
  return { subtotal, saved, total };
}
function evaluate() {
  const items: Item[] = [
    { name: 'pen', price: 250, quantity: 4 },
    { name: 'pad', price: 900, quantity: 1 },
  ];
  const rule: Discount = { threshold: 1000, percent: 10 };
  return [cartTotal(items, rule), cartTotal([], rule)];
}`},
 'task-priority-queue-ts':{language:'typescript',source:`enum Priority {
  Low = 1,
  Normal = 2,
  High = 3,
}
interface Task {
  title: string;
  priority: Priority;
  order: number;
}
class TaskQueue {
  private tasks: Task[] = [];
  private counter = 0;
  add(title: string, priority: Priority = Priority.Normal): void {
    this.tasks.push({ title, priority, order: this.counter++ });
    this.tasks.sort((a, b) => b.priority - a.priority || a.order - b.order);
  }
  next(): string | undefined {
    return this.tasks.shift()?.title;
  }
}
function evaluate(): Array<string | undefined> {
  const queue = new TaskQueue();
  queue.add('write tests', Priority.High);
  queue.add('lunch');
  queue.add('refactor', Priority.Low);
  queue.add('fix bug', Priority.High);
  return [queue.next(), queue.next(), queue.next(), queue.next(), queue.next()];
}`},
 'task-grade-report-ts':{language:'typescript',source:`type Grade = 'A' | 'B' | 'C' | 'F';
interface Student {
  name: string;
  scores: number[];
}
function gradeOf(average: number): Grade {
  if (average >= 90) {
    return 'A';
  } else if (average >= 75) {
    return 'B';
  } else if (average >= 50) {
    return 'C';
  }
  return 'F';
}
function describe(grade: Grade): string {
  switch (grade) {
    case 'A':
      return 'excellent';
    case 'B':
    case 'C':
      return 'passed';
    default:
      return 'failed';
  }
}
function report(students: Student[]): string[] {
  const lines: string[] = [];
  for (const student of students) {
    const total = student.scores.reduce((a, b) => a + b, 0);
    const average = student.scores.length ? total / student.scores.length : 0;
    const grade = gradeOf(average);
    lines.push(\`\${student.name}: \${grade} (\${describe(grade)})\`);
  }
  return lines;
}
function evaluate(): string[] {
  return report([{ name: 'Ann', scores: [95, 88] }, { name: 'Bob', scores: [40] }, { name: 'Cy', scores: [] }]);
}`},
 'task-graph-reach-ts':{language:'typescript',source:`type Graph = Map<string, string[]>;
function buildGraph(edges: Array<[string, string]>): Graph {
  const graph: Graph = new Map();
  for (const [from, to] of edges) {
    if (!graph.has(from)) {
      graph.set(from, []);
    }
    if (!graph.has(to)) {
      graph.set(to, []);
    }
    graph.get(from)!.push(to);
  }
  return graph;
}
function reachable(graph: Graph, start: string): string[] {
  const visited = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    for (const next of graph.get(node) ?? []) {
      stack.push(next);
    }
  }
  return [...visited].sort();
}
function evaluate(): string[][] {
  const graph = buildGraph([['a', 'b'], ['b', 'c'], ['c', 'a'], ['d', 'e']]);
  return [reachable(graph, 'a'), reachable(graph, 'd'), reachable(graph, 'x')];
}`},
};
