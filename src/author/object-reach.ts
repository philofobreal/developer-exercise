/** NY-36 (v56, ADR-130): whether an object the program creates can reach code outside the program, which may then list
 * its keys. Under the author's key-order setting „Számít” (ADR-055) the creation order of an object's keys is part of
 * its behaviour whenever anyone can list them: the program itself (enumeratesKeys, ADR-029) or a caller, a test, a
 * console that receives the object. So a key order is free only where the object provably stays inside the program.
 *
 * Hidden here: which references keep an object inside, and how a class's instances and the class value itself stay
 * inside. The decisions, deliberately narrow (the error is always towards keeping an order):
 *  - an object literal stays inside its variable: a `const`/`let`/`var` in a function or block (a top-level binding is
 *    reachable from outside: an export, another script, a caller), whose every reference is the object of a member
 *    access that is not called;
 *  - a class's instances stay inside: a named class declaration that code outside cannot reach (not exported, and in
 *    a script not at the top level, where it is a global binding a caller may instantiate itself), whose name the file uses only as
 *    `new C(…)` into such a variable (where a call of one of the chain's own methods is also allowed), as the object
 *    of a static member access, or as the base of a class whose instances stay inside too; every class of its chain
 *    (`extends` a class declared once in this file, not exported, transitively) keeps its `this` (outside nested
 *    non-arrow functions and classes) as the object of a member access, called only for the chain's own methods
 *    (the base constructor and methods receive the instance);
 *  - the class value (whose static fields are keys) stays inside: no `extends` either way, used only as `new C(…)`
 *    or as the object of a static member access, its `this` kept the same way;
 *  - nothing stays inside in a file with `eval` or `with`.
 * Type positions (annotations, `implements`, type queries) are not references: they do not run. */
import type ts from 'typescript';

export interface ObjectReach {
 /** The literal is the initialiser of a variable that never hands it on. */
 literalStays(node: ts.ObjectLiteralExpression): boolean;
 /** No instance of the class can reach code outside the program. */
 instancesStay(declaration: ts.ClassLikeDeclaration): boolean;
 /** The class value (its static keys) cannot reach code outside the program. */
 classStays(declaration: ts.ClassLikeDeclaration): boolean;
}

const cache = new WeakMap<ts.SourceFile, ObjectReach>();

export function objectReach(file: ts.SourceFile, compiler: typeof ts): ObjectReach {
 const known = cache.get(file);
 if (known) return known;
 const evaluates = /\beval\b|\bwith\s*\(/.test(file.text);
 /** In a type position: an annotation, a type argument, a type declaration, `implements`. It does not run. */
 const inType = (node: ts.Node): boolean => {
  for (let current: ts.Node | undefined = node.parent; current && !compiler.isSourceFile(current); current = current.parent) {
   if (compiler.isTypeNode(current) && !compiler.isExpressionWithTypeArguments(current) || compiler.isInterfaceDeclaration(current) || compiler.isTypeAliasDeclaration(current)) return true;
   if (compiler.isHeritageClause(current)) return current.token === compiler.SyntaxKind.ImplementsKeyword || compiler.isInterfaceDeclaration(current.parent);
   if (compiler.isStatement(current) || compiler.isClassElement(current)) return false;
  }
  return false;
 };
 const references = new Map<string, ts.Identifier[]>();
 const collect = (node: ts.Node): void => {if (compiler.isIdentifier(node) && !inType(node)) references.set(node.text, [...references.get(node.text) ?? [], node]); compiler.forEachChild(node, collect);};
 collect(file);
 /** The local variable `value` initialises, when it is a plain name in a function or a block. */
 const localVariable = (value: ts.Expression): ts.Identifier | undefined => {
  const declaration = value.parent;
  if (!compiler.isVariableDeclaration(declaration) || declaration.initializer !== value || !compiler.isIdentifier(declaration.name)) return undefined;
  const statement = declaration.parent.parent;
  if (!compiler.isVariableStatement(statement) || compiler.isSourceFile(statement.parent) || compiler.isModuleBlock(statement.parent)) return undefined;
  return declaration.name;
 };
 const called = (access: ts.Node): boolean => compiler.isCallExpression(access.parent) && access.parent.expression === access;
 const memberName = (access: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | undefined => compiler.isPropertyAccessExpression(access) ? access.name.text : undefined;
 /** Every other reference to `own` is the object of a member access; a call only of one of `methods`. */
 const usedAsMember = (own: ts.Identifier, methods: ReadonlySet<string>): boolean => (references.get(own.text) ?? []).every(reference => {
  if (reference === own) return true;
  const access = reference.parent;
  if (!(compiler.isPropertyAccessExpression(access) || compiler.isElementAccessExpression(access)) || access.expression !== reference) return false;
  return !called(access) || methods.has(memberName(access) ?? '');
 });
 const methodsOf = (declaration: ts.ClassLikeDeclaration): Set<string> => new Set(declaration.members.flatMap(member => compiler.isMethodDeclaration(member) && member.name && (compiler.isIdentifier(member.name) || compiler.isStringLiteral(member.name)) ? [member.name.text] : []));
 /** Every `this` of the class body (outside nested non-arrow functions and classes) is the object of a member access,
  *  called only for one of the class's own methods. */
 const thisStays = (declaration: ts.ClassLikeDeclaration, methods: ReadonlySet<string>): boolean => {
  let stays = true;
  const visit = (node: ts.Node, top: boolean): void => {
   if (!stays) return;
   if (!top && (compiler.isClassLike(node) || compiler.isFunctionLike(node) && !compiler.isArrowFunction(node) && !compiler.isClassElement(node))) return;
   if (node.kind === compiler.SyntaxKind.ThisKeyword) {
    const access = node.parent;
    if (!(compiler.isPropertyAccessExpression(access) || compiler.isElementAccessExpression(access)) || access.expression !== node || called(access) && !methods.has(memberName(access) ?? '')) stays = false;
   }
   compiler.forEachChild(node, child => visit(child, false));
  };
  for (const member of declaration.members) visit(member, true);
  return stays;
 };
 const classes = new Map<string, ts.ClassDeclaration[]>();
 const gather = (node: ts.Node): void => {if (compiler.isClassDeclaration(node) && node.name) classes.set(node.name.text, [...classes.get(node.name.text) ?? [], node]); compiler.forEachChild(node, gather);};
 gather(file);
 const base = (declaration: ts.ClassLikeDeclaration): ts.Expression | undefined => declaration.heritageClauses?.find(clause => clause.token === compiler.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
 /** The class and its ancestors, when every ancestor is a class declared once in this file; undefined otherwise. */
 const chainOf = (declaration: ts.ClassLikeDeclaration): ts.ClassLikeDeclaration[] | undefined => {
  const chain = [declaration];
  for (let heritage = base(declaration); heritage; heritage = base(chain.at(-1)!)) {
   const found = compiler.isIdentifier(heritage) ? classes.get(heritage.text) ?? [] : [];
   if (found.length !== 1 || chain.includes(found[0]!)) return undefined;
   chain.push(found[0]!);
  }
  return chain;
 };
 const exportedOnly = (declaration: ts.ClassLikeDeclaration): boolean => !!compiler.canHaveModifiers(declaration) && !!compiler.getModifiers(declaration)?.some(modifier => modifier.kind === compiler.SyntaxKind.ExportKeyword || modifier.kind === compiler.SyntaxKind.DefaultKeyword);
 const script = !compiler.isExternalModule(file);
 /** Code outside the program can name the class: an export, or a script's top-level (global) binding. */
 const exported = (declaration: ts.ClassLikeDeclaration): boolean => exportedOnly(declaration) || script && compiler.isSourceFile(declaration.parent);
 /** The class's name as the file uses it: a static member access (not called) or what `use` admits. */
 const usedOnly = (declaration: ts.ClassLikeDeclaration, use: (reference: ts.Identifier) => boolean): boolean => (references.get(declaration.name!.text) ?? []).every(reference => {
  if (reference === declaration.name) return true;
  const parent = reference.parent;
  if ((compiler.isPropertyAccessExpression(parent) || compiler.isElementAccessExpression(parent)) && parent.expression === reference) return !called(parent);
  return use(reference);
 });
 const created = (reference: ts.Identifier): ts.NewExpression | undefined => compiler.isNewExpression(reference.parent) && reference.parent.expression === reference ? reference.parent : undefined;
 /** The class a reference names as its base (`class D extends C`). */
 const extendedBy = (reference: ts.Identifier): ts.ClassLikeDeclaration | undefined => {
  const heritage = reference.parent;
  return compiler.isExpressionWithTypeArguments(heritage) && heritage.expression === reference && compiler.isHeritageClause(heritage.parent) && heritage.parent.token === compiler.SyntaxKind.ExtendsKeyword && compiler.isClassLike(heritage.parent.parent) ? heritage.parent.parent : undefined;
 };
 const staying = new Map<ts.ClassLikeDeclaration, boolean>();
 const instancesStay = (declaration: ts.ClassLikeDeclaration): boolean => {
  const known = staying.get(declaration);
  if (known !== undefined) return known;
  staying.set(declaration, false);
  const chain = evaluates || !compiler.isClassDeclaration(declaration) || !declaration.name ? undefined : chainOf(declaration);
  const methods = new Set(chain?.flatMap(link => [...methodsOf(link)]) ?? []);
  const stays = !!chain && chain.every(link => !exported(link) && thisStays(link, methods)) && usedOnly(declaration, reference => {
   const subclass = extendedBy(reference);
   if (subclass) return instancesStay(subclass);
   const creation = created(reference), own = creation && localVariable(creation);
   return !!own && usedAsMember(own, methods);
  });
  staying.set(declaration, stays);
  return stays;
 };
 const reach: ObjectReach = {
  literalStays: node => {
   if (evaluates) return false;
   const own = localVariable(node);
   return !!own && usedAsMember(own, new Set());
  },
  instancesStay,
  classStays: declaration => !evaluates && compiler.isClassDeclaration(declaration) && !!declaration.name && !exported(declaration) && !base(declaration) && thisStays(declaration, methodsOf(declaration)) && usedOnly(declaration, reference => !!created(reference)),
 };
 cache.set(file, reach);
 return reach;
}
