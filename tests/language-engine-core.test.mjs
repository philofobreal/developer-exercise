import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import Ajv from 'ajv/dist/2020.js';
import { generateCodeLineExercise } from '../src/author/generator.mjs';
import { compileCodeLineExercise, compileCodeLineExerciseV3, compileVersionedExercise, compileDefinition, upgradeCodeLineExerciseV2, validateSubmission, prepareRenderPlan, projectDisplayRows } from '../dist/index.js';
import { validateIR, validateV3 } from '../dist/schema-check.js';
import { irExercise, suiteExercise, permutations } from './fixtures/language-ir.mjs';

const compile = m => {
  const c = compileCodeLineExerciseV3(m); assert.ok(!c.status, c.message); return c.compiled;
};
const submit = (c, lines, opts) => validateSubmission(c, { exerciseId: c.definition.id, revision: c.definition.revision, lines }, opts);

test('native suite: unit atomicity, virtual DEDENT, shared binding scope, exact indentation', () => {
  const m = suiteExercise(), c = compile(m), codes = m.ir.lines.map(l => l.code);
  assert.equal(submit(c, codes).status, 'accepted');
  assert.equal(submit(c, [codes[0], codes[4], ...codes.slice(1, 4), codes[5]]).status, 'accepted');
  assert.equal(submit(c, [codes[0], codes[1], codes[4], codes[2], codes[3], codes[5]]).status, 'rejected');
  assert.equal(submit(c, [codes[0], codes[2], codes[1], codes[3], codes[4], codes[5]]).status, 'rejected');
  assert.equal(submit(c, [codes[0], codes[1].trimStart(), ...codes.slice(2)]).status, 'rejected');
  assert.equal(c.definition.tokens.length, codes.length); // no fabricated close token
  assert.equal(m.ir.bindingScopes.length, 1);
  assert.equal(submit(c, codes, { maxStates: 1 }).status, 'indeterminate');
  m.ir.units[2].dependencies = [m.ir.units[1].id];
  assert.equal(submit(compile(m), [codes[0], codes[4], ...codes.slice(1, 4), codes[5]]).status, 'rejected');
});

test('all 720 physical-row permutations agree with an independent set of two legal unit arrangements', () => {
  const m = suiteExercise(), c = compile(m), [h, a, b, d, use, end] = m.ir.lines.map(l => l.code);
  const allowed = new Set([[h, a, b, d, use, end], [h, use, a, b, d, end]].map(xs => JSON.stringify(xs)));
  for (const lines of permutations(m.ir.lines.map(l => l.code))) assert.equal(submit(c, lines).accepted, allowed.has(JSON.stringify(lines)));
});

test('multiline literal unit retains empty payload rows, tabs, Unicode and duplicate text', () => {
  const codes = ['literal-start', '', '\t 😀', '', 'literal-end', 'other'];
  const m = irExercise(codes); m.ir.units[0].lineIds = m.ir.lines.slice(0, 5).map(l => l.id); m.ir.units.splice(1, 4);
  const c = compile(m);
  assert.equal(submit(c, ['other', ...codes.slice(0, 5)]).status, 'accepted');
  assert.equal(submit(c, ['other', 'literal-start', '', '  😀', '', 'literal-end']).status, 'rejected');
  assert.equal(prepareRenderPlan(m).units[0].rows.length, 5);
});

test('multiple ordered virtual closes at one source anchor and invalid event order', () => {
  const m = irExercise(['outer:', '    inner:', '        body', 'done']);
  m.ir.containers = [{ id: 'outer', parentId: null, kind: 'suite' }, { id: 'inner', parentId: 'outer', kind: 'suite' }];
  m.ir.units[1].containerId = 'outer'; m.ir.units[2].containerId = 'inner';
  m.ir.boundaries = [
    { containerId: 'outer', unitId: 'l0', phase: 'after', action: 'open', virtual: true },
    { containerId: 'inner', unitId: 'l1', phase: 'after', action: 'open', virtual: true },
    { containerId: 'inner', unitId: 'l3', phase: 'before', action: 'close', virtual: true },
    { containerId: 'outer', unitId: 'l3', phase: 'before', action: 'close', virtual: true }
  ];
  assert.equal(submit(compile(m), m.ir.lines.map(l => l.code)).status, 'accepted');
  [m.ir.boundaries[2], m.ir.boundaries[3]] = [m.ir.boundaries[3], m.ir.boundaries[2]];
  assert.equal(compileCodeLineExerciseV3(m).status, 'invalid_reference');
});

test('nested suites close at EOF after the final real unit, without a sentinel row', () => {
  const m = irExercise(['outer:', '    inner:', '        body']);
  m.ir.containers = [{ id: 'outer', parentId: null, kind: 'suite' }, { id: 'inner', parentId: 'outer', kind: 'suite' }];
  m.ir.units[1].containerId = 'outer'; m.ir.units[2].containerId = 'inner';
  m.ir.boundaries = [
    { containerId: 'outer', unitId: 'l0', phase: 'after', action: 'open', virtual: true },
    { containerId: 'inner', unitId: 'l1', phase: 'after', action: 'open', virtual: true },
    { containerId: 'inner', unitId: 'l2', phase: 'after', action: 'close', virtual: true },
    { containerId: 'outer', unitId: 'l2', phase: 'after', action: 'close', virtual: true }
  ];
  const c = compile(m); assert.equal(c.definition.tokens.length, 3);
  assert.equal(submit(c, m.ir.lines.map(l => l.code)).status, 'accepted');
  assert.equal(submit(c, ['outer:', '        body', '    inner:']).status, 'rejected');
});

test('one physical unit may close and open different syntactic containers', () => {
  const m = irExercise(['if (x) {', ' a();', '} else {', ' b();', '}']);
  m.ir.containers = ['then', 'else'].map(id => ({ id, parentId: null, kind: 'block' }));
  m.ir.units[1].containerId = 'then'; m.ir.units[3].containerId = 'else';
  m.ir.boundaries = [
    { containerId: 'then', unitId: 'l0', phase: 'after', action: 'open', virtual: false },
    { containerId: 'then', unitId: 'l2', phase: 'before', action: 'close', virtual: false },
    { containerId: 'else', unitId: 'l2', phase: 'after', action: 'open', virtual: false },
    { containerId: 'else', unitId: 'l4', phase: 'before', action: 'close', virtual: false }
  ];
  const c = compile(m);
  assert.equal(submit(c, m.ir.lines.map(l => l.code)).status, 'accepted');
  assert.equal(submit(c, ['if (x) {', ' b();', '} else {', ' a();', '}']).status, 'rejected');
});

test('v3 fixed pins physical unit slots without partitioning other units', () => {
  const m = irExercise(['a', 'pin1', 'pin2', 'b']);
  m.ir.units[1].lineIds.push('l2'); m.ir.units[1].fixed = true; m.ir.units.splice(2, 1);
  const c = compile(m);
  assert.equal(submit(c, ['b', 'pin1', 'pin2', 'a']).status, 'accepted');
  assert.equal(submit(c, ['pin1', 'pin2', 'a', 'b']).status, 'rejected');
});

test('profiles are OR, common dependencies AND; multiplicity and content remain bijective', () => {
  const m = irExercise(['a', 'b', 'c']);
  m.ir.profiles = [{ id: 'asc', edges: [{ before: 'l0', after: 'l1' }, { before: 'l1', after: 'l2' }] }, { id: 'desc', edges: [{ before: 'l2', after: 'l1' }, { before: 'l1', after: 'l0' }] }];
  const c = compile(m);
  for (const lines of permutations(['a', 'b', 'c'])) assert.equal(submit(c, lines).accepted, ['abc', 'cba'].includes(lines.join('')));
  const dup = irExercise(['same', 'same', 'other']), dc = compile(dup);
  assert.equal(submit(dc, ['same', 'other', 'same']).status, 'accepted');
  assert.equal(submit(dc, ['other', 'other', 'same']).status, 'rejected');
  assert.equal(submit(dc, ['same', 'other', 'changed']).status, 'rejected');
});

test('common unit dependencies apply to every alternate profile, with one shared search budget', () => {
  const m = irExercise(['a', 'b', 'c', 'd']); m.ir.units[3].dependencies = ['l0'];
  m.ir.profiles = [{ id: 'asc', edges: [{ before: 'l0', after: 'l1' }, { before: 'l1', after: 'l2' }] }, { id: 'desc', edges: [{ before: 'l2', after: 'l1' }, { before: 'l1', after: 'l0' }] }];
  const c = compile(m);
  for (const lines of permutations(['a', 'b', 'c', 'd'])) {
    const subsequence = lines.filter(x => x !== 'd').join('');
    assert.equal(submit(c, lines).accepted, ['abc', 'cba'].includes(subsequence) && lines.indexOf('a') < lines.indexOf('d'));
  }
  assert.equal(submit(c, ['c', 'b', 'a', 'd'], { maxStates: 6 }).status, 'indeterminate');
  assert.equal(submit(c, ['c', 'b', 'a', 'd'], { maxStates: 100 }).status, 'accepted');
});

test('v2 projection preserves all existing example rules, profiles and fixed semantics', async () => {
  for (const name of ['sum-js', 'sum-ts', 'profiles-js', 'dependencies-js']) {
    const m = JSON.parse(await readFile(new URL('../examples/' + name + '.json', import.meta.url), 'utf8'));
    const snapshot = structuredClone(m), v3 = upgradeCodeLineExerciseV2(m);
    assert.equal(v3.schemaVersion, 3, v3.message); assert.deepEqual(m, snapshot);
    const v2c = compileCodeLineExercise(m).compiled, v3c = compile(v3), codes = m.lines.map(l => l.code);
    assert.equal(submit(v2c, codes).status, submit(v3c, codes).status);
    for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) {
      const altered = [...codes]; [altered[i], altered[j]] = [altered[j], altered[i]];
      assert.equal(submit(v2c, altered).status, submit(v3c, altered).status, `${name} ${i}/${j}`);
    }
    assert.equal(v3.ir.analysis.sourceOrigin, 'reconstructed-v2');
    assert.equal(compileVersionedExercise(m).compiled.definition.id, m.id);
  }
  const model = generateCodeLineExercise({ source: 'const a = 1;\nconst b = 2;\nconst c = a + b;\nuse(c);' }, ts);
  const v2c = compileCodeLineExercise(model).compiled, v3c = compile(upgradeCodeLineExerciseV2(model));
  for (const lines of permutations(model.lines.map(l => l.code))) assert.equal(submit(v2c, lines).accepted, submit(v3c, lines).accepted);
});

test('full TS fixture retains scoped dependency policy, omitted-block decisions and original spans', async () => {
  const source = await readFile(new URL('./fixtures/copy-field-utility.service.ts', import.meta.url), 'utf8');
  const m = generateCodeLineExercise({ source, language: 'typescript' }, ts), v3 = upgradeCodeLineExerciseV2(m, source);
  assert.equal(v3.schemaVersion, 3, v3.message);
  assert.deepEqual(v3.ir.analysis.legacyAuthoring, m.authoring);
  assert.equal(v3.ir.analysis.legacyAuthoring.dependencyPolicy, 'scoped-primitive-dag-v2');
  assert.deepEqual(v3.ir.lines.map(l => l.sourceSpan.start.line), m.lines.map(l => l.sourceLine));
  assert.equal(submit(compile(v3), m.lines.map(l => l.code)).status, 'accepted');
});

test('UTF-16 physical spans preserve blank lines, CRLF mapping and astral characters', () => {
  const source = '// 😀\r\n\r\nconst x = 1;\r\n';
  const m = generateCodeLineExercise({ source }, ts), v3 = upgradeCodeLineExerciseV2(m, source);
  assert.equal(v3.schemaVersion, 3, v3.message);
  assert.equal(v3.ir.lines[1].sourceSpan.start.line, 3);
  assert.equal(v3.ir.lines[1].sourceSpan.start.offset, '// 😀\n\n'.length);
  assert.equal(v3.ir.source.includes('\r'), false);
});

test('IR runtime shape matches standalone Ajv; semantic admission rejects corrupt references', async () => {
  const schemas = await Promise.all(['schema.json', 'language-ir.schema.json', 'codeline-v3.schema.json'].map(async f => JSON.parse(await readFile(new URL('../docs/' + f, import.meta.url), 'utf8'))));
  const ajv = new Ajv({ strict: true }); schemas.forEach(s => ajv.addSchema(s));
  const shape = ajv.getSchema(schemas[2].$id);
  const base = suiteExercise(); assert.equal(validateIR(base.ir), true); assert.equal(shape(base), true);
  const mutations = [
    m => m.ir.irVersion = 2, m => m.schemaVersion = 4, m => m.ir.lines[0].extra = true, m => m.ir.lines[0].code += '\n',
    m => m.ir.lines[0].sourceSpan.start.offset++, m => m.ir.lines[1].sourceSpan.end.column++,
    m => m.ir.units[1].lineIds.push('l0'), m => m.ir.units[0].dependencies = ['missing'],
    m => m.ir.units[0].dependencies = ['l0'], m => m.ir.units[0].containerId = 'missing',
    m => m.ir.units[0].bindingScopeId = 'missing', m => m.ir.containers[0].parentId = 'suite',
    m => m.ir.bindingScopes[0].parentId = 'module', m => m.ir.boundaries.pop(),
    m => m.ir.boundaries.push(m.ir.boundaries[0]), m => m.ir.lines[1].normalization = 'indent',
    m => m.ir.indentPolicy.display = 'adapter', m => m.ir.units.reverse(),
    m => m.ir.profiles = [{ id: 'cycle', edges: [{ before: 'l0', after: 'l1' }, { before: 'l1', after: 'l0' }] }]
  ];
  for (const change of mutations) {
    const m = structuredClone(base); change(m);
    assert.equal(validateV3(m), shape(m));
    assert.equal(compileCodeLineExerciseV3(m).status, 'invalid_reference', change.toString());
  }
  for (const value of [null, {}, [], { schemaVersion: 99 }]) assert.equal(compileVersionedExercise(value).status, 'invalid_reference');
});

test('lowered structure is audited at the direct core entry point and admission snapshots are isolated', () => {
  const m = suiteExercise(), c = compile(m);
  m.ir.units[0].dependencies.push('missing'); m.ir.lines[0].code = 'changed';
  assert.equal(submit(c, c.definition.tokens.map(t => t.code)).status, 'accepted');
  for (const mutate of [d => d.structure.units[0].tokenIds.push('l1'), d => d.structure.containers[0].parentId = 'suite', d => d.structure.boundaries.pop(), d => d.structure.boundaries[0].tokenId = 'missing']) {
    const d = structuredClone(c.definition); mutate(d); assert.equal(compileDefinition(d).status, 'invalid_reference');
  }
});

test('render preparation hides grading rules and preserves unit/row boundaries and semantic indent', () => {
  const plan = prepareRenderPlan(suiteExercise()); assert.ok(!plan.status, plan.message);
  assert.equal(plan.units[1].rows.length, 3);
  assert.equal(JSON.stringify(plan).includes('dependencies'), false); assert.equal(JSON.stringify(plan).includes('bindingScope'), false);
  const unit = plan.units[1], original = unit.rows.map(l => l.code);
  assert.deepEqual(projectDisplayRows(unit, plan.indentPolicy, original.map(l => l.trimStart())), original);
  unit.rows.forEach(r => r.normalization = 'indent');
  const policy = { mode: 'presentation', tabWidth: 5, display: 'adapter' };
  assert.deepEqual(projectDisplayRows(unit, policy, original.map(l => l.trimStart())), original.map(l => l.trimStart()));
  for (const unsafe of [['merged'], original.map(l => l + '\n'), original.map(l => l + 'changed')]) assert.deepEqual(projectDisplayRows(unit, policy, unsafe), original);
  unit.rows[0].normalization = 'exact';
  assert.deepEqual(projectDisplayRows(unit, policy, original.map(l => l.trimStart())), original);
});
