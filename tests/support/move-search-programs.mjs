/** ADR-030: a scalable program shape for the move search: a class with k one-statement methods
 * (k + 1 identical `}` rows) and a function of k calls; 4k + 7 rows. */
export function program(k){
 const rows=['class Box {','  items: number[] = [];'];
 for(let i=0;i<k;i++)rows.push(`  m${i}(): number {`,`    return this.items.length + ${i};`,'  }');
 rows.push('}','function run(box: Box): number {','  let total = 0;');
 for(let i=0;i<k;i++)rows.push(`  total = total + box.m${i}();`);
 rows.push('  return total;','}');
 return rows.join('\n');
}
