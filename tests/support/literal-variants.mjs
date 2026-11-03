/** Value perturbation for the measurement (ADR-067; author tooling, fixed fixtures only).
 * Policy A (ADR-043) judges a write as if it wrote another value and a comparison as if it
 * compared another: a rejected order that runs alike only because the values happen to
 * coincide keeps the reference's data dependency. This module finds the literals a source
 * spells out and builds one variant per (literal, value): the same rows with that one literal
 * replaced by another value of the same kind the program spells (or a fresh one). Two
 * arrangements of the variant are compared by the same oracle as the original.
 * Not perturbed: type positions, module specifiers, directives, member and key names,
 * multi-row literals. Numbers stay non-negative, so the source never changes shape. */
import ts from 'typescript';

const COMPARISONS=new Set([ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken,ts.SyntaxKind.LessThanToken,ts.SyntaxKind.LessThanEqualsToken,ts.SyntaxKind.GreaterThanToken,ts.SyntaxKind.GreaterThanEqualsToken]);
const NAME_PARENTS=new Set([ts.SyntaxKind.PropertyAssignment,ts.SyntaxKind.PropertyDeclaration,ts.SyntaxKind.MethodDeclaration,ts.SyntaxKind.GetAccessor,ts.SyntaxKind.SetAccessor,ts.SyntaxKind.EnumMember,ts.SyntaxKind.PropertySignature,ts.SyntaxKind.MethodSignature]);

/** Every perturbable literal: its 0-based row, columns, kind and value. */
export function literalsOf(source,language){
 const text=Array.isArray(source)?source.join('\n'):source;
 const file=ts.createSourceFile(language==='typescript'?'fixture.ts':'fixture.js',text,ts.ScriptTarget.Latest,true,language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
 const found=[];
 const visit=(node,inType)=>{
  if(ts.isTypeNode(node)&&!ts.isExpressionWithTypeArguments(node))inType=true;
  const kind=ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)?'string':ts.isNumericLiteral(node)?'number':node.kind===ts.SyntaxKind.TrueKeyword||node.kind===ts.SyntaxKind.FalseKeyword?'boolean':null;
  const parent=node.parent;
  const excluded=inType||!parent||ts.isImportDeclaration(parent)||ts.isExportDeclaration(parent)||ts.isExternalModuleReference(parent)||ts.isImportTypeNode(parent)
   ||(NAME_PARENTS.has(parent.kind)&&parent.name===node)||(ts.isElementAccessExpression(parent)&&parent.argumentExpression===node&&kind!=='number')
   ||(ts.isExpressionStatement(parent)&&kind==='string');
  if(kind&&!excluded){
   const start=file.getLineAndCharacterOfPosition(node.getStart(file)),end=file.getLineAndCharacterOfPosition(node.getEnd());
   const value=kind==='string'?node.text:kind==='number'?Number(node.text):node.kind===ts.SyntaxKind.TrueKeyword;
   // A decision value: compared by an equality or relational operator or a `case` label.
   const decides=ts.isCaseClause(parent)||(ts.isBinaryExpression(parent)&&COMPARISONS.has(parent.operatorToken.kind));
   if(start.line===end.line&&(kind!=='number'||Number.isFinite(value)))found.push({row:start.line,from:start.character,to:end.character,kind,value,decides});
  }
  ts.forEachChild(node,child=>visit(child,inType));
 };
 visit(file,false);
 return found;
}

const spell=(kind,value)=>kind==='string'?JSON.stringify(value):String(value);
const fresh={string:'§perturbed',number:value=>value+1000,boolean:value=>!value};

/** The values one literal is replaced with: those the program spells for its kind, decision
 * values first (what a comparison or `case` could match), then a fresh value. */
export function valuesFor(literal,literals){
 const same=literals.filter(other=>other.kind===literal.kind&&other.value!==literal.value);
 const ranked=[...same.filter(other=>other.decides),...same.filter(other=>!other.decides)].map(other=>other.value);
 const freshValue=literal.kind==='string'?fresh.string:fresh[literal.kind](literal.value);
 return [...new Set([...ranked,freshValue])].filter(value=>value!==literal.value);
}

/** The source rows with one literal replaced. */
export function replaced(rows,literal,value){
 const out=[...rows],row=out[literal.row];
 out[literal.row]=row.slice(0,literal.from)+spell(literal.kind,value)+row.slice(literal.to);
 return out;
}
