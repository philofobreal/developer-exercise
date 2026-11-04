/** ADR-080: the reference with every object it creates kept and observed when the probe ends. Each
 * array literal, object literal and `new` expression (not an assignment pattern) is wrapped in
 * `__keep(…)`, on the same rows, so the variant's rows map one to one onto the reference's rows and a
 * learner order can be replayed on it. Two helper rows are appended: `__keep` collects the objects, and
 * `__seen` records them after the probe, so the oracle's trace serialises their final state. A write
 * to an object that is later dropped (nothing refers to it) is then visible. Measurement only: the
 * fixed, generated programs run, never a learner submission. */
import ts from 'typescript';

export const HEAP_HELPERS=['function __keep(o) { (__keep.all ??= []).push(o); return o; }',"function __seen(v) { record('__kept', ...(__keep.all ?? [])); return v; }"];

const assignment=kind=>kind>=ts.SyntaxKind.FirstAssignment&&kind<=ts.SyntaxKind.LastAssignment;
/** Whether a literal is (part of) a destructuring target, which wrapping would break. */
function pattern(node){
 let at=node;
 while(ts.isParenthesizedExpression(at.parent)||ts.isArrayLiteralExpression(at.parent)||ts.isObjectLiteralExpression(at.parent)||ts.isSpreadElement(at.parent)||ts.isSpreadAssignment(at.parent)||ts.isShorthandPropertyAssignment(at.parent)||ts.isPropertyAssignment(at.parent)&&at.parent.initializer===at)at=at.parent;
 const parent=at.parent;
 return ts.isBinaryExpression(parent)&&parent.left===at&&assignment(parent.operatorToken.kind)||(ts.isForOfStatement(parent)||ts.isForInStatement(parent))&&parent.initializer===at;
}

/** The variant's rows (same count as `rows`), or null when the reference creates no object. */
export function observedHeap(rows,language){
 const text=rows.join('\n'),file=ts.createSourceFile('heap.'+(language==='typescript'?'ts':'js'),text,ts.ScriptTarget.Latest,true);
 const inserts=[];
 const visit=node=>{
  if((ts.isArrayLiteralExpression(node)||ts.isObjectLiteralExpression(node))&&!pattern(node)||ts.isNewExpression(node)){inserts.push([node.getStart(file),'__keep('],[node.end,')']);}
  ts.forEachChild(node,visit);
 };
 visit(file);
 if(!inserts.length)return null;
 // Later positions first. Pieces inserted at one position end up in reverse order, so an opening
 // `__keep(` is inserted before a closing `)`: the text then reads `…)__keep(…`.
 inserts.sort((a,b)=>b[0]-a[0]||(a[1]===')'?1:0)-(b[1]===')'?1:0));
 let out=text;
 for(const [at,piece] of inserts)out=out.slice(0,at)+piece+out.slice(at);
 const variant=out.split('\n');
 return variant.length===rows.length?variant:null;
}

/** The probe of a heap variant: the original probe, then the kept objects recorded. */
export const observedProbe=probe=>`__seen(${probe})`;
