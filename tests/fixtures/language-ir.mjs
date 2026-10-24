/** Hand-authored structural fixtures only: no Python parser or adapter. */
export function irExercise(codes, options = {}) {
  let offset = 0;
  const lines = codes.map((code, i) => {
    const start = { offset, line: i + 1, column: 0 }; offset += code.length;
    const end = { offset, line: i + 1, column: code.length }; offset++;
    return { id: 'l' + i, code, normalization: 'exact', sourceSpan: { start, end } };
  });
  const ir = {
    irVersion: 1, language: 'indent-fixture', source: codes.join('\n'), lines,
    units: lines.map(l => ({ id: l.id, lineIds: [l.id], containerId: null, bindingScopeId: 'module', dependencies: [], fixed: false })),
    containers: [], bindingScopes: [{ id: 'module', kind: 'module', parentId: null }], boundaries: [], edges: [], profiles: [],
    indentPolicy: { mode: 'semantic', tabWidth: 4, display: 'preserve' },
    analysis: { strategy: 'native', sourceOrigin: 'original', semanticEquivalenceProven: false }, ...options
  };
  return { schemaVersion: 3, id: 'fixture', revision: 1, title: '', description: '', ir };
}

export function suiteExercise() {
  const m = irExercise(['if flag:', '    value = (', '        1 +', '        2)', '    use(value)', 'done()']);
  const [header, a, b, c, use, done] = m.ir.units;
  a.lineIds.push(...b.lineIds, ...c.lineIds); a.containerId = use.containerId = 'suite';
  m.ir.units = [header, a, use, done];
  m.ir.containers = [{ id: 'suite', kind: 'suite', parentId: null }];
  m.ir.boundaries = [
    { containerId: 'suite', unitId: header.id, phase: 'after', action: 'open', virtual: true },
    { containerId: 'suite', unitId: done.id, phase: 'before', action: 'close', virtual: true }
  ];
  return m;
}

export function* permutations(xs) {
  if (!xs.length) { yield []; return; }
  for (let i = 0; i < xs.length; i++) for (const tail of permutations(xs.filter((_, j) => i !== j))) yield [xs[i], ...tail];
}
