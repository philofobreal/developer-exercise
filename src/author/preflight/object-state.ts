/** Local object state of an author reference (ADR-108, E4, option `objectState: local`). Author-only.
 *
 * Finds two definite `TypeError`s on local bindings whose value is known from their declaration:
 *  - OS001: a member access, call, `new`, destructuring, iteration or array spread on a binding that is
 *    certainly `null` or `undefined` there (`let o;`, `const o = null`, `= undefined`, `= void …`);
 *  - OS002: a call or `new` of a binding that is certainly not callable (a number, string, template,
 *    boolean, object, array or regular expression literal).
 * The value is known only up to the binding's first write: a binding written inside any function is
 * skipped entirely (a call could change it at any time), and an access after the first write in source
 * order is not considered. The access must be certainly evaluated when its statement runs (flow-paths.ts),
 * in a reachable statement of the declaration's block after the declaration. Optional chaining never
 * throws and is never reported; an object spread of null does not throw and is not a site.
 */
import type ts from 'typescript';
import type {ReferenceFacts} from './flow-paths.js';
import type {RuntimeAnalysis, RuntimeFinding} from './binding-safety.js';

export function objectStateOf(facts: ReferenceFacts): RuntimeAnalysis {
 const {compiler, file, checker} = facts, S = compiler.SyntaxKind;
 type Kind = {nullish: boolean; label: string};
 const strip = (node: ts.Expression): ts.Expression => compiler.isParenthesizedExpression(node) || compiler.isAsExpression(node) || compiler.isSatisfiesExpression(node) ? strip(node.expression) : node;
 const kindOf = (declaration: ts.VariableDeclaration): Kind | undefined => {
  if (!declaration.initializer) return declaration.parent.flags & compiler.NodeFlags.Let ? {nullish: true, label: 'undefined'} : undefined;
  const value = strip(declaration.initializer);
  switch (value.kind) {
   case S.NullKeyword: return {nullish: true, label: 'null'};
   case S.VoidExpression: return {nullish: true, label: 'undefined'};
   // The built-in `undefined` has a symbol but no declaration; a parameter or binding named so shadows it.
   case S.Identifier: return (value as ts.Identifier).text === 'undefined' && !checker.getSymbolAtLocation(value)?.declarations?.length ? {nullish: true, label: 'undefined'} : undefined;
   case S.NumericLiteral: case S.BigIntLiteral: return {nullish: false, label: 'szám'};
   case S.StringLiteral: case S.NoSubstitutionTemplateLiteral: case S.TemplateExpression: return {nullish: false, label: 'szöveg'};
   case S.TrueKeyword: case S.FalseKeyword: return {nullish: false, label: 'logikai érték'};
   case S.ObjectLiteralExpression: return {nullish: false, label: 'objektum'};
   case S.ArrayLiteralExpression: return {nullish: false, label: 'tömb'};
   case S.RegularExpressionLiteral: return {nullish: false, label: 'reguláris kifejezés'};
   default: return undefined;
  }
 };
 const optional = (node: ts.Node): boolean => (node.flags & compiler.NodeFlags.OptionalChain) !== 0 || ('questionDotToken' in node && !!(node as ts.PropertyAccessExpression).questionDotToken);
 /** The operation that throws on the read `id`, and whether it needs a nullish (vs. non-callable) value. */
 const site = (id: ts.Identifier): {node: ts.Node; nullish: boolean; callable: boolean} | undefined => {
  let read: ts.Node = id;
  while (compiler.isParenthesizedExpression(read.parent) || compiler.isNonNullExpression(read.parent) || compiler.isAsExpression(read.parent)) read = read.parent;
  const p = read.parent;
  if ((compiler.isPropertyAccessExpression(p) || compiler.isElementAccessExpression(p)) && p.expression === read && !optional(p)) return {node: p, nullish: true, callable: false};
  if ((compiler.isCallExpression(p) || compiler.isNewExpression(p)) && p.expression === read && !optional(p)) return {node: p, nullish: true, callable: true};
  if (compiler.isVariableDeclaration(p) && p.initializer === read && !compiler.isIdentifier(p.name)) return {node: p, nullish: true, callable: false};
  if (compiler.isForOfStatement(p) && p.expression === read) return {node: read, nullish: true, callable: false};
  if (compiler.isSpreadElement(p) && compiler.isArrayLiteralExpression(p.parent)) return {node: p, nullish: true, callable: false};
  return undefined;
 };
 const insideFunction = (node: ts.Node, block: ts.Node): boolean => {for (let n = node.parent; n && n !== block; n = n.parent) if (compiler.isFunctionLike(n) || compiler.isClassLike(n)) return true; return false;};

 const findings: RuntimeFinding[] = [];
 const visitStatements = (node: ts.Node): void => {
  if (facts.spent()) return;
  if (compiler.isVariableStatement(node) && (node.declarationList.flags & (compiler.NodeFlags.Let | compiler.NodeFlags.Const))) {
   const block = facts.blockOf(node);
   if (block) for (const declaration of node.declarationList.declarations) {
    if (!compiler.isIdentifier(declaration.name)) continue;
    const kind = kindOf(declaration), symbol = checker.getSymbolAtLocation(declaration.name);
    if (!kind || !symbol) continue;
    const references = facts.references.get(symbol) ?? [], writes = references.filter(id => facts.isWrite(id));
    if (writes.some(id => insideFunction(id, block))) continue;
    const firstWrite = Math.min(...writes.map(id => id.pos), Number.POSITIVE_INFINITY), name = declaration.name.text, where = facts.lineOf(declaration);
    const sites = references.filter(id => id.pos > declaration.end && id.pos < firstWrite && !facts.isWrite(id)).flatMap(id => {const s = site(id); return s && (kind.nullish ? s.nullish : s.callable) ? [s.node] : [];});
    if (!sites.length) continue;
    const own = block.statements.indexOf(node);
    for (const statement of block.statements.slice(own)) {
     if (facts.spent() || !facts.reachable(statement, block)) break;
     const hit = facts.mustEvaluate(statement, candidate => sites.includes(candidate) && candidate.pos > declaration.end);
     if (!hit) continue;
     const at = hit[0]!, text = at.getText(file).replace(/\s+/g, ' '), shown = text.length > 40 ? text.slice(0, 37) + '…' : text;
     findings.push(kind.nullish
      ? {line: facts.lineOf(at), code: 'OS001', certainty: 'definite', origin: 'runtime-value', binding: name, message: `A(z) „${name}” értéke itt biztosan ${kind.label} (${where}. sor), ezért a(z) „${shown}” futáskor biztosan TypeError.`}
      : {line: facts.lineOf(at), code: 'OS002', certainty: 'definite', origin: 'runtime-value', binding: name, message: `A(z) „${name}” nem függvény, hanem ${kind.label} (${where}. sor), ezért a(z) „${shown}” futáskor biztosan TypeError.`});
     break;
    }
   }
  }
  compiler.forEachChild(node, visitStatements);
 };
 visitStatements(file);
 findings.sort((a, b) => a.line - b.line);
 return {completeness: facts.spent() ? 'budget-exceeded' : 'within-supported-scope', findings};
}
