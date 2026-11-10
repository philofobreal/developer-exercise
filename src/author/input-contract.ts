/** The input contract of an exercise (ADR-050, policy v26). Author-only: it reads the reference
 * source and never runs for learner submissions.
 *
 * `any` (the default): a caller may pass any value, accessors, proxies and conversion hooks
 * included. `valid`: outside values are valid plain data (primitives, plain arrays and objects,
 * Set/Map, callbacks as direct parameters), well formed for the code, so reading a property,
 * converting or spreading a value and calling a listed built-in run no code and cannot throw.
 * This module hides what the contract lets the analysis assume in one program, and what the
 * program itself takes back: source text that can change what a read does disables it; the
 * program's own accessor names, conversion methods, generators and member names keep the reads,
 * conversions, spreads and calls they could reach.
 */
import type ts from 'typescript';
import {namesMatch, unspelledNames} from './property-names.js';
type Compiler = typeof ts;

export type InputContract = 'any' | 'valid';
/** ADR-126 (NY-29): what in the source keeps the `valid` contract from applying, and where, when it is known. */
export interface InputBlocker {readonly reason: 'hook' | 'computed-accessor' | 'computed-name'; readonly line?: number; readonly text?: string;}
export interface InputFacts {
 /** `valid` was asked for and nothing in the source can change what a read does. */
 readonly applies: boolean;
 /** `valid` was asked for but the program can change what a read does, so the analysis stays strict. */
 readonly unavailable: boolean;
 /** Why it is unavailable (the first cause found: a hook in the text, a computed accessor, a name reached unspelled). */
 readonly blocker?: InputBlocker;
 /** Converting an object runs only built-in code: the program names no conversion method. */
 readonly conversions: boolean;
 /** Reading this property name may run the program's own accessor. */
 accessor(name: string): boolean;
 /** A computed read or an object spread may reach one of the program's accessors. */
 readonly anyAccessor: boolean;
 /** Spreading or iterating may run the body of one of the program's generators. */
 readonly generators: boolean;
 /** `name(…)` of an undeclared global is a listed built-in function. */
 builtinFunction(name: string): boolean;
 /** `owner.name(…)` of an undeclared global owner is a listed built-in with this many arguments. */
 builtinStatic(owner: string, name: string, count: number): boolean;
 /** `x.name(…)` is a listed built-in method that no member of the program shadows. */
 builtinMethod(name: string): boolean;
 /** v51 (ADR-099): `value.name(callback, …)` is a listed array method that calls a read-only callback
  * on each element and writes nothing; `reduce` and `reduceRight` only with an initial value. */
 callbackMethod(name: string, count: number): boolean;
 /** `new name(…)` of an undeclared global is a listed built-in constructor with this many arguments. */
 builtinConstructor(name: string, count: number): boolean;
}

/** Built-ins that, on valid plain data, call no callback, write nothing and cannot throw. */
const GLOBAL_FUNCTIONS = new Set(['Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite']);
const STATIC_FUNCTIONS: Partial<Record<string, readonly string[]>> = {
 Math: ['abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'sqrt', 'cbrt', 'pow', 'max', 'min', 'hypot', 'log', 'log2', 'log10', 'exp'],
 Number: ['isInteger', 'isFinite', 'isNaN', 'isSafeInteger', 'parseInt', 'parseFloat'],
 Object: ['keys', 'values', 'entries'],
 Array: ['isArray', 'from']
};
const CALLBACK_METHODS = new Set(['map', 'filter', 'some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'reduce', 'reduceRight']);
const BUILTIN_METHODS = new Set(['join', 'slice', 'indexOf', 'lastIndexOf', 'includes', 'at', 'concat', 'flat', 'charAt', 'charCodeAt', 'codePointAt', 'startsWith', 'endsWith', 'trim', 'trimStart', 'trimEnd', 'toUpperCase', 'toLowerCase', 'padStart', 'padEnd', 'repeat', 'split', 'substring', 'toFixed', 'has', 'get']);
/** Source text that lets a program change what property access, iteration or conversion does. */
const HOOKS = /\bProxy\b|\bReflect\b|defineProperty|defineProperties|setPrototypeOf|__proto__|__define[GS]etter__|\.prototype\b|\bSymbol\.|\beval\b|\bFunction\b|\bwith\s*\(/;
const CONVERSIONS = /\b(?:valueOf|toString|toPrimitive|toJSON)\b/;

/** The first thing that keeps `valid` from applying: a hook spelled in the text, else a computed accessor name, else a
 *  name the program reaches without spelling it out (no single place to point at). */
function blockerOf(file: ts.SourceFile, computedAccessorAt: ts.Node | undefined): InputBlocker {
 const lineOf = (position: number): number => file.getLineAndCharacterOfPosition(position).line + 1;
 const hook = HOOKS.exec(file.text);
 if (hook) return {reason: 'hook', line: lineOf(hook.index), text: hook[0].replace(/\s+/g, ' ').trim().slice(0, 40)};
 if (computedAccessorAt) return {reason: 'computed-accessor', line: lineOf(computedAccessorAt.getStart(file))};
 return {reason: 'computed-name'};
}
export function inputFacts(file: ts.SourceFile, compiler: Compiler, inputs: InputContract = 'any'): InputFacts {
 const accessors = new Set<string>(), defined = new Set<string>();
 let computedAccessor = false, generators = false, computedAccessorAt: ts.Node | undefined;
 const plain = (name: ts.Node | undefined): name is ts.Identifier | ts.PrivateIdentifier | ts.StringLiteral | ts.NumericLiteral => !!name && (compiler.isIdentifier(name) || compiler.isPrivateIdentifier(name) || compiler.isStringLiteral(name) || compiler.isNumericLiteral(name));
 const auto = (node: ts.Node): boolean => compiler.isPropertyDeclaration(node) && (compiler.getModifiers(node) ?? []).some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
 const visit = (node: ts.Node): void => {
  // A member, an object literal key or an assigned property: a call by that name may run the program's own function.
  if ((compiler.isClassElement(node) || compiler.isObjectLiteralElementLike(node) || compiler.isTypeElement(node)) && plain(node.name)) defined.add(node.name.text);
  if (compiler.isBinaryExpression(node) && compiler.isPropertyAccessExpression(node.left)) defined.add(node.left.name.text);
  if (compiler.isGetAccessorDeclaration(node) || compiler.isSetAccessorDeclaration(node) || auto(node)) {
   const name = (node as ts.AccessorDeclaration | ts.PropertyDeclaration).name;
   if (plain(name)) accessors.add(name.text); else {computedAccessor = true; computedAccessorAt ??= node;}
  }
  if ((compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isMethodDeclaration(node)) && node.asteriskToken) generators = true;
  compiler.forEachChild(node, visit);
 };
 const asked = inputs === 'valid';
 if (asked) visit(file);
 // ADR-052, ADR-053: names the program reaches without spelling them out count as named.
 const applies = asked && !computedAccessor && !namesMatch(file, unspelledNames(file, compiler), HOOKS);
 return {
  applies, unavailable: asked && !applies, ...(asked && !applies ? {blocker: blockerOf(file, computedAccessorAt)} : {}), conversions: applies && !CONVERSIONS.test(file.text),
  accessor: name => accessors.has(name), anyAccessor: accessors.size > 0, generators,
  builtinFunction: name => GLOBAL_FUNCTIONS.has(name),
  // Array.from calls a second argument back and iterates a generator.
  builtinStatic: (owner, name, count) => !!STATIC_FUNCTIONS[owner]?.includes(name) && !(owner === 'Array' && (generators || name === 'from' && count !== 1)),
  builtinMethod: name => BUILTIN_METHODS.has(name) && !defined.has(name),
  callbackMethod: (name, count) => CALLBACK_METHODS.has(name) && !defined.has(name) && (name.startsWith('reduce') ? count === 2 : count === 1),
  builtinConstructor: (name, count) => (name === 'Set' || name === 'Map') && count <= 1 && (count === 0 || !generators)
 };
}
