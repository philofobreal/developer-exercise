/** Local object effect footprints (ADR-025, policy v12). Author-only: it reads the reference
 * source and never runs for learner submissions.
 *
 * In one function-context statement list, a statement that only creates or operates on the
 * list's own objects gets a footprint: the abstract objects it reads and writes, and whether it
 * may throw. Own objects are `const x = new C(…)` of an analysable class declared in the file,
 * and `const x = []` / `{…}` literals. The bodies of the constructor, methods and accessors that
 * run are interpreted abstractly with `this` bound to the receiver and the parameters to the
 * argument values, so a statement's footprint includes what its callee does:
 *  - values are primitives, sets of abstract objects, or `other` (a fresh result nobody tracks);
 *  - field values and array elements are collected flow-insensitively per object, so a stored
 *    reference (an item in a store, a shared log in two objects) is seen by every later read or
 *    mutation through it, whatever the order;
 *  - a fresh array or object created inside a body is an object of its own, per owner and site.
 * Anything outside this subset — unknown or global calls, statics, closures that escape,
 * implicit conversion of an object, inheritance, prototype or reflection tricks — makes the
 * statement unknown (no footprint), and it stays an ordinary barrier. An object that occurs in
 * any statement without a footprint (other than the list's `return`) escapes: unknown code may
 * reach it, so no statement touching it gets a footprint either. Two footprinted statements
 * commute when neither may throw and neither writes an object the other reads or writes.
 */
import type ts from 'typescript';
type Compiler = typeof ts;

export interface Footprint {reads: Set<string>; writes: Set<string>; mayThrow: boolean;}
/** `primitive`: whether a list-level expression is an effect-free primitive (the analyser's own test). */
/** `enumeratedKeys` (ADR-029): the program may list enumerable keys, so a write that adds a key orders like a whole-object write. */
export interface FootprintHost {primitive(expr: ts.Expression): boolean; enumeratedKeys?: boolean;}

/** `text`: every primitive the value may be is a string (ADR-028). */
interface Value {prim: boolean; text: boolean; objs: Set<string>; other: boolean;}
interface ClassInfo {
 fields: Map<string, ts.Expression | undefined>; methods: Map<string, ts.MethodDeclaration>;
 getters: Map<string, ts.GetAccessorDeclaration>; setters: Map<string, ts.SetAccessorDeclaration>;
 ctor?: ts.ConstructorDeclaration; parameterFields: string[];
}
type Kind = {kind: 'class'; info: ClassInfo} | {kind: 'array'} | {kind: 'object'};
/** Thrown inside the interpretation when a statement leaves the analysable subset. */
class Unknown extends Error {}
const unknown = (): never => {throw new Unknown();};
const PRIM: Value = {prim: true, text: false, objs: new Set(), other: false};
const STR: Value = {prim: true, text: true, objs: new Set(), other: false};
const OTHER: Value = {prim: false, text: false, objs: new Set(), other: true};
const union = (...values: Value[]): Value => ({prim: values.some(v => v.prim), text: values.some(v => v.prim) && values.every(v => !v.prim || v.text), objs: new Set(values.flatMap(v => [...v.objs])), other: values.some(v => v.other)});
const objects = (...ids: string[]): Value => ({prim: false, text: false, objs: new Set(ids), other: false});
const ARRAY_READS = new Set(['map', 'filter', 'forEach', 'some', 'every', 'find', 'join', 'includes', 'indexOf', 'slice']);
const ARRAY_WRITES = new Set(['push', 'unshift', 'pop', 'shift']);
/** ADR-028: String.prototype methods that cannot throw or run code on a string receiver, by the
 * arguments they accept without conversion: none, strings, or numeric literals. */
const STRING_METHODS = new Map<string, {args: 'none' | 'text' | 'number'; text: boolean}>([
 ...['trim', 'trimStart', 'trimEnd', 'toUpperCase', 'toLowerCase'].map(name => [name, {args: 'none', text: true}] as const),
 ...['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf'].map(name => [name, {args: 'text', text: false}] as const),
 ['concat', {args: 'text', text: true}],
 ...['slice', 'substring', 'charAt'].map(name => [name, {args: 'number', text: true}] as const)
]);
/** ADR-028: reads and writes are recorded per object field; `*` stands for the whole object
 * (its creation, an array, or a write that may add a key and so change the key order). */
const WHOLE = '*';
const at = (object: string, field: string): string => object + '::' + field;
const objectOf = (key: string): string => key.slice(0, key.lastIndexOf('::'));
const ERRORS = new Set(['Error', 'TypeError', 'RangeError']);
/** Source text that lets a program change what property access or calls do. */
const REFLECTIVE = /\.prototype\b|__proto__|defineProperty|setPrototypeOf|\bReflect\b|\bProxy\b|Object\.assign|\bdelete\b/;

export function objectFootprints(list: readonly ts.Statement[], file: ts.SourceFile, compiler: Compiler, checker: ts.TypeChecker, host: FootprintHost): Map<ts.Statement, Footprint> {
 const result = new Map<ts.Statement, Footprint>();
 if (REFLECTIVE.test(file.text)) return result;
 const S = compiler.SyntaxKind;
 const unwrap = (expr: ts.Expression): ts.Expression => compiler.isParenthesizedExpression(expr) || compiler.isAsExpression(expr) || compiler.isSatisfiesExpression(expr) || compiler.isNonNullExpression(expr) || compiler.isTypeAssertionExpression(expr) ? unwrap(expr.expression) : expr;
 const nameOf = (name: ts.Node): string | undefined => compiler.isIdentifier(name) || compiler.isPrivateIdentifier(name) || compiler.isStringLiteral(name) ? name.text : undefined;
 const has = (node: ts.Node, kind: ts.SyntaxKind): boolean => (compiler.canHaveModifiers(node) ? compiler.getModifiers(node) ?? [] : []).some(modifier => modifier.kind === kind);

 const classes = new Map<ts.ClassDeclaration, ClassInfo | null>();
 /** A class whose instances behave exactly as its own body says: no heritage, decorators,
  * abstractness, auto-accessors or ambiguous member names. */
 function classInfo(declaration: ts.ClassDeclaration): ClassInfo | null {
  if (classes.has(declaration)) return classes.get(declaration)!;
  classes.set(declaration, null);
  if (declaration.heritageClauses?.some(clause => clause.token === S.ExtendsKeyword) || has(declaration, S.AbstractKeyword) || compiler.getDecorators(declaration)?.length) return null;
  const info: ClassInfo = {fields: new Map(), methods: new Map(), getters: new Map(), setters: new Map(), parameterFields: []};
  const names = new Set<string>(), claim = (name: string | undefined, accessor = false): string => {
   if (name === undefined || name === 'constructor' || !accessor && names.has(name)) return unknown();
   names.add(name);
   return name;
  };
  try {
   for (const member of declaration.members) {
    if (compiler.isSemicolonClassElement(member) || compiler.isIndexSignatureDeclaration(member)) continue;
    if (compiler.canHaveDecorators(member) && compiler.getDecorators(member)?.length) return null;
    if (has(member, S.StaticKeyword)) continue;
    if (compiler.isPropertyDeclaration(member)) {
     if (has(member, S.DeclareKeyword)) continue;
     if (has(member, S.AccessorKeyword)) return null;
     info.fields.set(claim(nameOf(member.name)), member.initializer);
    } else if (compiler.isMethodDeclaration(member)) {
     if (!member.body) continue; // an overload signature
     if (member.asteriskToken || has(member, S.AsyncKeyword)) return null;
     info.methods.set(claim(nameOf(member.name)), member);
    } else if (compiler.isGetAccessorDeclaration(member) && member.body) {
     const name = nameOf(member.name);
     if (name === undefined || info.getters.has(name) || info.fields.has(name) || info.methods.has(name)) return null;
     if (!info.setters.has(name)) claim(name);
     info.getters.set(name, member);
    } else if (compiler.isSetAccessorDeclaration(member) && member.body) {
     const name = nameOf(member.name);
     if (name === undefined || info.setters.has(name) || info.fields.has(name) || info.methods.has(name)) return null;
     if (!info.getters.has(name)) claim(name);
     info.setters.set(name, member);
    } else if (compiler.isConstructorDeclaration(member)) {
     if (!member.body) continue;
     info.ctor = member;
     for (const parameter of member.parameters) if (compiler.isIdentifier(parameter.name) && (compiler.getModifiers(parameter) ?? []).some(modifier => [S.PublicKeyword, S.PrivateKeyword, S.ProtectedKeyword, S.ReadonlyKeyword].includes(modifier.kind))) info.parameterFields.push(claim(parameter.name.text));
    } else return null;
   }
  } catch (error) {if (error instanceof Unknown) return null; throw error;}
  classes.set(declaration, info);
  return info;
 }
 const classOf = (expr: ts.Expression): ClassInfo | null => {
  const declaration = compiler.isIdentifier(expr) ? checker.getSymbolAtLocation(expr)?.declarations : undefined;
  return declaration?.length === 1 && compiler.isClassDeclaration(declaration[0]!) && declaration[0].getSourceFile() === file ? classInfo(declaration[0]) : null;
 };

 // Own objects of this list, by declaring statement and binding.
 const owned = new Map<ts.Symbol, {id: string; statement: ts.Statement; kind: Kind}>();
 for (const statement of list) {
  if (!compiler.isVariableStatement(statement)) continue;
  const declarations = statement.declarationList.declarations, declaration = declarations[0];
  if (declarations.length !== 1 || !declaration || (statement.declarationList.flags & compiler.NodeFlags.BlockScoped) !== compiler.NodeFlags.Const || !compiler.isIdentifier(declaration.name) || !declaration.initializer) continue;
  const symbol = checker.getSymbolAtLocation(declaration.name), init = unwrap(declaration.initializer);
  if (!symbol) continue;
  const id = 'L' + statement.pos;
  if (compiler.isNewExpression(init)) {const info = classOf(init.expression); if (info) owned.set(symbol, {id, statement, kind: {kind: 'class', info}});}
  else if (compiler.isArrayLiteralExpression(init)) owned.set(symbol, {id, statement, kind: {kind: 'array'}});
  else if (compiler.isObjectLiteralExpression(init)) owned.set(symbol, {id, statement, kind: {kind: 'object'}});
 }
 // ADR-031: in the body of a constructor of an analysable class, `this` is an own object too. Its
 // field initialisers and parameter properties ran before the body; a parameter is an outside value
 // that may be stored but not operated on (OTHER).
 const ctor = list[0]?.parent && compiler.isBlock(list[0].parent) && compiler.isConstructorDeclaration(list[0].parent.parent) ? list[0].parent.parent : undefined;
 const selfInfo = ctor && compiler.isClassDeclaration(ctor.parent) ? classInfo(ctor.parent) : null;
 const self = selfInfo ? 'T' + ctor!.pos : null;
 const parameters = new Set<ts.Symbol>(ctor ? ctor.parameters.flatMap(parameter => {const symbol = compiler.isIdentifier(parameter.name) ? checker.getSymbolAtLocation(parameter.name) : undefined; return symbol ? [symbol] : [];}) : []);
 if (!owned.size && !self) return result;

 // Abstract heap, collected flow-insensitively over every statement of the list.
 const kinds = new Map<string, Kind>([...owned.values()].map(entry => [entry.id, entry.kind]));
 if (self) kinds.set(self, {kind: 'class', info: selfInfo!});
 const fields = new Map<string, Map<string, Value>>(), elements = new Map<string, Value>();
 let changed = false;
 const addField = (object: string, name: string, value: Value): void => {
  const map = fields.get(object) ?? new Map<string, Value>(), before = map.get(name), after = before ? union(before, value) : value;
  if (!before || after.prim !== before.prim || after.text !== before.text || after.other !== before.other || after.objs.size !== before.objs.size) changed = true;
  map.set(name, after);fields.set(object, map);
 };
 const addElements = (object: string, value: Value): void => {
  const before = elements.get(object), after = before ? union(before, value) : value;
  if (!before || after.prim !== before.prim || after.text !== before.text || after.other !== before.other || after.objs.size !== before.objs.size) changed = true;
  elements.set(object, after);
 };
 const fresh = (owner: string, node: ts.Node, kind: Kind): string => {const id = owner + '|' + node.pos; if (!kinds.has(id)) {kinds.set(id, kind); changed = true;} return id;};

 interface Frame {self: string | null; env: Map<string, Value>; fp: Footprint; stack: Set<string>; budget: {steps: number};}
 const step = (frame: Frame): void => {if (++frame.budget.steps > 20_000) unknown();};
 const prim = (value: Value): void => {if (!value.prim || value.objs.size || value.other) unknown();};

 /** Runs a constructor, method or accessor body on `self` with the given arguments. */
 function invoke(body: ts.FunctionLikeDeclaration, self: string, args: Value[], frame: Frame): Value {
  const key = self + '@' + body.pos;
  if (frame.stack.has(key) || !body.body || !compiler.isBlock(body.body)) unknown();
  const env = new Map<string, Value>();
  body.parameters.forEach((parameter, index) => {
   if (!compiler.isIdentifier(parameter.name) || parameter.initializer || parameter.dotDotDotToken) unknown();
   env.set((parameter.name as ts.Identifier).text, args[index] ?? PRIM);
  });
  const inner: Frame = {...frame, self, env, stack: new Set([...frame.stack, key])};
  return block((body.body as ts.Block).statements, inner);
 }
 function construct(id: string, info: ClassInfo, args: Value[], frame: Frame): void {
  frame.fp.writes.add(at(id, WHOLE));
  const own: Frame = {...frame, self: id, env: new Map()};
  for (const [name, initializer] of info.fields) addField(id, name, initializer ? expression(initializer, own) : PRIM);
  if (!info.ctor) return;
  info.ctor.parameters.forEach((parameter, index) => {if (info.parameterFields.includes((parameter.name as ts.Identifier).text)) addField(id, (parameter.name as ts.Identifier).text, args[index] ?? PRIM);});
  invoke(info.ctor, id, args, frame);
 }
 function block(statements: readonly ts.Statement[], frame: Frame): Value {
  let returned: Value = PRIM;
  for (const statement of statements) {
   step(frame);
   if (compiler.isExpressionStatement(statement)) effect(statement.expression, frame);
   else if (compiler.isReturnStatement(statement)) returned = statement.expression ? union(returned, expression(statement.expression, frame)) : returned;
   else if (compiler.isIfStatement(statement)) {
    expression(statement.expression, frame);
    returned = union(returned, block([statement.thenStatement], frame), statement.elseStatement ? block([statement.elseStatement], frame) : PRIM);
   } else if (compiler.isBlock(statement)) returned = union(returned, block(statement.statements, frame));
   else if (compiler.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
     if (!compiler.isIdentifier(declaration.name) || (statement.declarationList.flags & compiler.NodeFlags.BlockScoped) === 0) unknown();
     frame.env.set((declaration.name as ts.Identifier).text, declaration.initializer ? expression(declaration.initializer, frame) : PRIM);
    }
   } else if (compiler.isThrowStatement(statement)) {
    const error = unwrap(statement.expression);
    if (!compiler.isNewExpression(error) || !compiler.isIdentifier(error.expression) || !ERRORS.has(error.expression.text) || checker.getSymbolAtLocation(error.expression)?.declarations?.some(declaration => declaration.getSourceFile() === file)) unknown();
    for (const argument of (error as ts.NewExpression).arguments ?? []) prim(expression(argument, frame));
    frame.fp.mayThrow = true;
   } else unknown();
  }
  return returned;
 }
 /** Assignments, updates and calls whose value is discarded. */
 function effect(raw: ts.Expression, frame: Frame): void {
  const expr = unwrap(raw);
  if (compiler.isBinaryExpression(expr) && expr.operatorToken.kind >= S.FirstAssignment && expr.operatorToken.kind <= S.LastAssignment) {
   const target = unwrap(expr.left);
   if (compiler.isIdentifier(target)) {
    if (!frame.env.has(target.text) || expr.operatorToken.kind !== S.EqualsToken) unknown();
    frame.env.set(target.text, union(frame.env.get(target.text)!, expression(expr.right, frame)));
    return;
   }
   if (!compiler.isPropertyAccessExpression(target)) unknown();
   const access = target as ts.PropertyAccessExpression, name = nameOf(access.name)!, base = expression(access.expression, frame);
   let value = expression(expr.right, frame);
   if (expr.operatorToken.kind !== S.EqualsToken) {prim(value); prim(read(base, name, frame)); value = PRIM;}
   write(base, name, value, frame);
   return;
  }
  if ((compiler.isPrefixUnaryExpression(expr) || compiler.isPostfixUnaryExpression(expr)) && (expr.operator === S.PlusPlusToken || expr.operator === S.MinusMinusToken)) {
   const target = unwrap(expr.operand);
   if (!compiler.isPropertyAccessExpression(target)) unknown();
   const access = target as ts.PropertyAccessExpression, base = expression(access.expression, frame), name = nameOf(access.name)!;
   prim(read(base, name, frame));write(base, name, PRIM, frame);
   return;
  }
  if (compiler.isCallExpression(expr)) {expression(expr, frame); return;}
  unknown();
 }
 function write(base: Value, name: string, value: Value, frame: Frame): void {
  if (base.prim || base.other || !base.objs.size) unknown();
  for (const object of base.objs) {
   const kind = kinds.get(object)!;
   if (kind.kind === 'array') unknown();
   if (kind.kind === 'class') {
    const setter = kind.info.setters.get(name);
    if (setter) {invoke(setter, object, [value], frame); continue;}
    // Assigning to a getter-only accessor or a method throws or replaces behaviour.
    if (kind.info.getters.has(name) || kind.info.methods.has(name)) unknown();
   }
   // A field the construction already created keeps the key order; any other name may add a key.
   // ADR-031: unless the program lists keys, adding a key is a write of that field alone.
   const existing = !host.enumeratedKeys || kind.kind === 'class' && (kind.info.fields.get(name) !== undefined || kind.info.parameterFields.includes(name));
   frame.fp.writes.add(at(object, existing ? name : WHOLE));addField(object, name, value);
  }
 }
 function read(base: Value, name: string, frame: Frame): Value {
  if (base.other || !base.objs.size && !base.prim) unknown();
  // `length` of null or undefined throws: only a value that can only be a string qualifies.
  if (base.prim) {if (name !== 'length' || !base.text || base.objs.size) unknown(); return PRIM;}
  const values: Value[] = [];
  for (const object of base.objs) {
   const kind = kinds.get(object)!;
   if (kind.kind === 'array') {if (name !== 'length') unknown(); frame.fp.reads.add(at(object, WHOLE)); values.push(PRIM); continue;}
   if (kind.kind === 'class') {
    const getter = kind.info.getters.get(name);
    if (getter) {values.push(invoke(getter, object, [], frame)); continue;}
    if (kind.info.methods.has(name) || kind.info.setters.has(name)) unknown();
   }
   const value = fields.get(object)?.get(name);
   // A property nobody defines may come from Object.prototype: not modelled.
   if (!value) unknown();
   frame.fp.reads.add(at(object, name));values.push(value!);
  }
  return union(...values);
 }
 function call(base: Value, name: string, args: readonly ts.Expression[], frame: Frame): Value {
  // ADR-028: a known String.prototype method on a value that can only be a string.
  if (base.prim && base.text && !base.objs.size && !base.other) {
   const method = STRING_METHODS.get(name);
   if (!method || (method.args === 'none') !== !args.length) unknown();
   for (const argument of args) {
    const value = method!.args === 'number' ? (compiler.isNumericLiteral(unwrap(argument)) ? PRIM : unknown()) : expression(argument, frame);
    if (method!.args === 'text' && (!value.prim || !value.text || value.objs.size || value.other)) unknown();
   }
   return method!.text ? STR : PRIM;
  }
  if (base.prim || base.other || !base.objs.size) unknown();
  const values: Value[] = [];
  for (const object of base.objs) {
   const kind = kinds.get(object)!;
   if (kind.kind === 'class') {
    const method = kind.info.methods.get(name);
    if (!method) unknown();
    values.push(invoke(method!, object, args.map(argument => expression(argument, frame)), frame));
    continue;
   }
   if (kind.kind !== 'array') unknown();
   if (ARRAY_WRITES.has(name)) {
    frame.fp.writes.add(at(object, WHOLE));frame.fp.reads.add(at(object, WHOLE));
    const pushed = args.map(argument => expression(argument, frame));
    if (name === 'push' || name === 'unshift') {pushed.forEach(value => addElements(object, value)); values.push(PRIM);}
    else {if (pushed.length) unknown(); values.push(union(PRIM, elements.get(object) ?? PRIM));}
    continue;
   }
   if (!ARRAY_READS.has(name)) unknown();
   frame.fp.reads.add(at(object, WHOLE));
   const items = elements.get(object) ?? PRIM;
   if (name === 'join') {args.forEach(argument => prim(expression(argument, frame))); prim(items); values.push(PRIM); continue;}
   if (name === 'includes' || name === 'indexOf') {args.forEach(argument => expression(argument, frame)); values.push(PRIM); continue;}
   if (name === 'slice') {args.forEach(argument => prim(expression(argument, frame))); values.push(OTHER); continue;}
   // map, filter, forEach, some, every, find: one synchronous callback per element.
   const callback = args[0] && unwrap(args[0]);
   if (args.length !== 1 || !callback || !compiler.isArrowFunction(callback) || callback.parameters.length > 2) unknown();
   const arrow = callback as ts.ArrowFunction, env = new Map(frame.env);
   arrow.parameters.forEach((parameter, index) => {if (!compiler.isIdentifier(parameter.name) || parameter.initializer || parameter.dotDotDotToken) unknown(); env.set((parameter.name as ts.Identifier).text, index ? PRIM : items);});
   const inner: Frame = {...frame, env};
   const returned = compiler.isBlock(arrow.body) ? block(arrow.body.statements, inner) : expression(arrow.body, inner);
   values.push(name === 'find' ? union(items, PRIM) : name === 'forEach' || name === 'some' || name === 'every' ? PRIM : (void returned, OTHER));
  }
  return union(...values);
 }
 function expression(raw: ts.Expression, frame: Frame): Value {
  step(frame);
  const expr = unwrap(raw);
  if (compiler.isStringLiteral(expr) || compiler.isNoSubstitutionTemplateLiteral(expr)) return STR;
  if (compiler.isNumericLiteral(expr) || [S.TrueKeyword, S.FalseKeyword, S.NullKeyword].includes(expr.kind)) return PRIM;
  if (expr.kind === S.ThisKeyword) return frame.self ? objects(frame.self) : self ? objects(self) : unknown();
  if (compiler.isIdentifier(expr)) {
   const local = frame.env.get(expr.text);
   if (local) return local;
   if (frame.self === null) {
    const symbol = checker.getSymbolAtLocation(expr), own = symbol && owned.get(symbol);
    if (own) return objects(own.id);
    if (symbol && parameters.has(symbol)) return OTHER;
    if (host.primitive(expr)) return PRIM;
   }
   if (expr.text === 'undefined' && !checker.getSymbolAtLocation(expr)?.declarations?.some(declaration => declaration.getSourceFile() === file)) return PRIM;
   return unknown();
  }
  if (compiler.isTemplateExpression(expr)) {expr.templateSpans.forEach(span => prim(expression(span.expression, frame))); return STR;}
  if (compiler.isPropertyAccessExpression(expr)) {
   if (expr.questionDotToken) unknown();
   return read(expression(expr.expression, frame), nameOf(expr.name)!, frame);
  }
  if (compiler.isCallExpression(expr)) {
   const callee = unwrap(expr.expression);
   if (expr.questionDotToken || !compiler.isPropertyAccessExpression(callee) || callee.questionDotToken || expr.arguments.some(argument => compiler.isSpreadElement(argument))) unknown();
   const access = callee as ts.PropertyAccessExpression;
   return call(expression(access.expression, frame), nameOf(access.name)!, expr.arguments, frame);
  }
  if (compiler.isBinaryExpression(expr)) {
   const operator = expr.operatorToken.kind, left = expression(expr.left, frame), right = expression(expr.right, frame);
   if (operator === S.AmpersandAmpersandToken || operator === S.BarBarToken || operator === S.QuestionQuestionToken) return union(left, right);
   if (operator === S.EqualsEqualsEqualsToken || operator === S.ExclamationEqualsEqualsToken) return PRIM;
   if (operator >= S.FirstAssignment && operator <= S.LastAssignment || operator === S.CommaToken || operator === S.InKeyword || operator === S.InstanceOfKeyword) unknown();
   prim(left);prim(right);
   // A string operand makes `+` a concatenation.
   return operator === S.PlusToken && (left.text || right.text) ? STR : PRIM;
  }
  if (compiler.isPrefixUnaryExpression(expr)) {
   const operand = expression(expr.operand, frame);
   if (expr.operator === S.ExclamationToken) return PRIM;
   if (expr.operator === S.PlusPlusToken || expr.operator === S.MinusMinusToken) unknown();
   prim(operand);
   return PRIM;
  }
  if (compiler.isTypeOfExpression(expr)) {expression(expr.expression, frame); return PRIM;}
  if (compiler.isConditionalExpression(expr)) {expression(expr.condition, frame); return union(expression(expr.whenTrue, frame), expression(expr.whenFalse, frame));}
  if (compiler.isArrayLiteralExpression(expr)) {
   const id = fresh(frame.self ?? 'S', expr, {kind: 'array'});
   for (const element of expr.elements) {if (compiler.isSpreadElement(element) || compiler.isOmittedExpression(element)) unknown(); addElements(id, expression(element, frame));}
   if (!elements.has(id)) elements.set(id, PRIM);
   return objects(id);
  }
  if (compiler.isObjectLiteralExpression(expr)) {
   const id = fresh(frame.self ?? 'S', expr, {kind: 'object'});
   for (const property of expr.properties) {
    if (!compiler.isPropertyAssignment(property)) unknown();
    const name = nameOf((property as ts.PropertyAssignment).name);
    if (name === undefined || name === '__proto__') unknown();
    addField(id, name!, expression((property as ts.PropertyAssignment).initializer, frame));
   }
   return objects(id);
  }
  return unknown();
 }

 /** One list-level statement: a construction, or an operation on own objects. */
 function statementFootprint(statement: ts.Statement, budget: {steps: number}): Footprint {
  const frame: Frame = {self: null, env: new Map(), fp: {reads: new Set(), writes: new Set(), mayThrow: false}, stack: new Set(), budget};
  if (compiler.isVariableStatement(statement)) {
   const declaration = statement.declarationList.declarations[0]!, symbol = checker.getSymbolAtLocation(declaration.name), own = symbol && owned.get(symbol);
   if (!own || own.statement !== statement) unknown();
   const init = unwrap(declaration.initializer!);
   if (own!.kind.kind === 'class') construct(own!.id, own!.kind.info, (init as ts.NewExpression).arguments?.map(argument => expression(argument, frame)) ?? [], frame);
   else if (compiler.isArrayLiteralExpression(init)) {frame.fp.writes.add(at(own!.id, WHOLE)); for (const element of init.elements) {if (compiler.isSpreadElement(element) || compiler.isOmittedExpression(element)) unknown(); addElements(own!.id, expression(element, frame));} if (!elements.has(own!.id)) elements.set(own!.id, PRIM);}
   else {
    frame.fp.writes.add(at(own!.id, WHOLE));
    for (const property of (init as ts.ObjectLiteralExpression).properties) {
     if (!compiler.isPropertyAssignment(property)) unknown();
     const name = nameOf((property as ts.PropertyAssignment).name);
     if (name === undefined || name === '__proto__') unknown();
     addField(own!.id, name!, expression((property as ts.PropertyAssignment).initializer, frame));
    }
   }
   return frame.fp;
  }
  // ADR-028: an if/else on own objects, both branches over-approximated; it must not leave the list early.
  if (compiler.isIfStatement(statement)) {
   if (leaves(statement)) unknown();
   expression(statement.expression, frame);
   block([statement.thenStatement, ...statement.elseStatement ? [statement.elseStatement] : []], frame);
   return frame.fp;
  }
  if (!compiler.isExpressionStatement(statement)) unknown();
  effect((statement as ts.ExpressionStatement).expression, frame);
  return frame.fp;
 }
 /** Whether a return inside `root` (outside nested functions) would leave the list's function. */
 function leaves(root: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
   if (found || compiler.isFunctionLike(node) || compiler.isClassLike(node)) return;
   if (compiler.isReturnStatement(node)) {found = true; return;}
   compiler.forEachChild(node, visit);
  };
  compiler.forEachChild(root, visit);
  return found;
 }

 // Identifier occurrences of own bindings, by top-level statement of the list.
 const occurrences = new Map<ts.Symbol, ts.Statement[]>();
 const inNested = (node: ts.Node, statement: ts.Statement): boolean => {
  for (let current = node.parent; current && current !== statement; current = current.parent) if (compiler.isFunctionLike(current) && !compiler.isArrowFunction(current) || compiler.isClassLike(current)) return true;
  return false;
 };
 let foreign = new Set<ts.Symbol>();
 const selfStatements = new Set<ts.Statement>();
 const scan = (node: ts.Node, statement: ts.Statement): void => {
  if (compiler.isIdentifier(node)) {
   const symbol = checker.getSymbolAtLocation(node);
   if (symbol && owned.has(symbol)) {
    if (inNested(node, statement)) foreign.add(symbol);
    (occurrences.get(symbol) ?? occurrences.set(symbol, []).get(symbol)!).push(statement);
   }
  }
  // The constructor's own `this`; a nested function or class has a `this` of its own.
  if (self && node.kind === S.ThisKeyword && !inNested(node, statement)) selfStatements.add(statement);
  compiler.forEachChild(node, child => scan(child, statement));
 };
 // A block-scoped const of this list is visible only to the list's statements; a use inside a nested function escapes.
 for (const statement of list) scan(statement, statement);
 const escaped = new Set<string>([...foreign].map(symbol => owned.get(symbol)!.id));
 const budget = {steps: 0};
 // ADR-031: the state the body starts from, as a construction leaves it.
 if (self) {
  try {
   const frame: Frame = {self, env: new Map(), fp: {reads: new Set(), writes: new Set(), mayThrow: false}, stack: new Set(), budget};
   for (const [name, initializer] of selfInfo!.fields) addField(self, name, initializer ? expression(initializer, frame) : PRIM);
   for (const name of selfInfo!.parameterFields) addField(self, name, OTHER);
  } catch (error) {if (!(error instanceof Unknown)) throw error; escaped.add(self);}
 }
 // Fixpoint: heap facts and footprints, escapes propagating through stored references.
 for (let round = 0; round < 12; round++) {
  changed = false;
  result.clear();
  for (const statement of list) {
   if (compiler.isReturnStatement(statement)) continue;
   try {
    const fp = statementFootprint(statement, budget);
    if ([...fp.reads, ...fp.writes].map(objectOf).some(id => escaped.has(id.split('|')[0]!) || escaped.has(id))) continue;
    result.set(statement, fp);
   } catch (error) {
    if (!(error instanceof Unknown)) throw error;
    if (budget.steps > 20_000) {result.clear(); return result;}
   }
  }
  // Own objects named by a statement without a footprint escape, and so does everything they hold.
  for (const [symbol, statements] of occurrences) if (statements.some(statement => !result.has(statement) && !compiler.isReturnStatement(statement))) if (!escaped.has(owned.get(symbol)!.id)) {escaped.add(owned.get(symbol)!.id); changed = true;}
  // Any statement naming `this` without a footprint, a return included, may hand it to unknown code.
  if (self && !escaped.has(self) && [...selfStatements].some(statement => !result.has(statement))) {escaped.add(self); changed = true;}
  for (const id of [...escaped]) {
   const held = [...fields.get(id)?.values() ?? [], ...elements.has(id) ? [elements.get(id)!] : []];
   for (const value of held) for (const object of value.objs) if (!escaped.has(object)) {escaped.add(object); changed = true;}
  }
  if (!changed) return result;
 }
 result.clear();
 return result;
}

/** Why two footprinted statements must keep their order; empty when they commute. */
export function footprintConflicts(a: Footprint, b: Footprint): string[] {
 // ADR-028: fields of one object meet when equal or when either side is the whole object.
 const field = (key: string): string => key.slice(key.lastIndexOf('::') + 2);
 const meets = (x: Set<string>, y: Set<string>): boolean => [...x].some(p => [...y].some(q => objectOf(p) === objectOf(q) && (field(p) === WHOLE || field(q) === WHOLE || field(p) === field(q))));
 const found: string[] = [];
 // ADR-028: only two possible throws race for the surfacing exception. A statement that cannot
 // throw touches only this list's own, unescaped objects, which no one observes once the other
 // throws out of the block, and any state the throw depends on is a read conflict below.
 if (a.mayThrow && b.mayThrow) found.push('may-throw');
 if (meets(a.writes, b.reads)) found.push('object-read-after-write');
 if (meets(a.reads, b.writes)) found.push('object-write-after-read');
 if (meets(a.writes, b.writes)) found.push('object-write-after-write');
 return found;
}
