import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { LanguageEngine, createLegacyJSTSBridge, AdapterContractError } from '../dist/author/engine.js';
import { generateCodeLineExercise } from '../src/author/generator.mjs';
import { auditReference } from '../src/author/audit.mjs';
import { getLanguageAdapter } from '../src/author/languages.mjs';
import { compileCodeLineExercise, validateSubmission } from '../dist/index.js';
import { irExercise, permutations, suiteExercise } from './fixtures/language-ir.mjs';

function legacyEngine() {
  const engine = new LanguageEngine();
  const ports = {
    generate: input => generateCodeLineExercise(input, ts),
    audit: model => auditReference(model, ts),
    format: (source, language) => getLanguageAdapter(language).format(source, ts)
  };
  for (const language of ['javascript', 'typescript']) engine.register(createLegacyJSTSBridge(language, ports));
  return engine;
}
function nativePlugin() {
  return { contractVersion: 1, id: 'indent-fixture', adapterVersion: 'fixture/1', capabilities: { analysis: 'native-ir', format: false }, indentPolicy: { mode: 'semantic', tabWidth: 4, display: 'preserve' }, analyze: () => suiteExercise().ir };
}

for (const language of ['javascript', 'typescript']) test(language + ' bridge keeps the existing dependency analysis and formatting', async () => {
  const engine = legacyEngine(), source = language === 'typescript' ? 'function f(a: number) {\n const x = 1;\n return a + x;\n}' : 'const a = 1;\nconst b = 2;\nconst c = a + b;\nuse(c);';
  const { model, compiled, renderPlan } = await engine.generate(language, { source }, { id: 'contract', revision: 2 });
  assert.equal(model.ir.language, language); assert.equal(model.ir.analysis.strategy, 'legacy-v2-projection');
  assert.equal(renderPlan.units.length, model.ir.lines.length);
  const legacy = compileCodeLineExercise({ ...generateCodeLineExercise({ source, language }, ts), id: 'contract', revision: 2 }).compiled;
  for (const lines of permutations(model.ir.lines.map(l => l.code))) {
    const body = { exerciseId: 'contract', revision: 2, lines };
    assert.equal(validateSubmission(compiled, body).status, validateSubmission(legacy, body).status);
  }
  const formatted = await engine.format(language, 'const n = 1;\n'); assert.match(formatted.code, /const n/);
  await assert.rejects(() => engine.generate(language, { source: 'const = ;' }));
  if (language === 'javascript') await assert.rejects(() => engine.generate(language, { source: 'const x: number = 1;' }));
});

test('bridge handles the existing final trim behavior without changing original-source coordinates or grading', async () => {
  const source = 'const x = 1;  \n\n', engine = legacyEngine();
  const { model } = await engine.generate('javascript', { source });
  assert.equal(model.ir.source, source);
  assert.equal(model.ir.lines[0].code, 'const x = 1;');
  assert.equal(model.ir.lines[0].sourceSpan.end.offset, 'const x = 1;'.length);
});

test('full service crosses the new bridge using the unchanged legacy audit', async () => {
  const source = await readFile(new URL('./fixtures/copy-field-utility.service.ts', import.meta.url), 'utf8');
  const { model, compiled } = await legacyEngine().generate('typescript', { source });
  assert.equal(model.ir.lines.length, 436);
  assert.equal(validateSubmission(compiled, { exerciseId: model.id, revision: 1, lines: model.ir.lines.map(l => l.code) }).status, 'accepted');
});

test('native async plugin uses the same compiler and learner evaluation never calls the plugin', async () => {
  const engine = new LanguageEngine(), plugin = nativePlugin(); let analyses = 0;
  plugin.analyze = async () => { analyses++; return suiteExercise().ir; };
  engine.register(plugin);
  const source = suiteExercise().ir.source, { model, compiled } = await engine.generate(plugin.id, { source });
  plugin.analyze = () => { throw Error('Never evaluate learner code'); };
  const before = analyses;
  assert.equal(validateSubmission(compiled, { exerciseId: model.id, revision: 1, lines: model.ir.lines.map(l => l.code), dependencies: [] }).status, 'accepted');
  assert.equal(analyses, before);
  assert.deepEqual(engine.languages(), ['indent-fixture']);
  assert.equal(engine.languages().includes('python'), false);
  await assert.rejects(() => engine.format(plugin.id, source), /formázást/);
});

test('registry rejects duplicate IDs, incompatible versions, missing methods and unsafe indentation capabilities', () => {
  const engine = new LanguageEngine(), plugin = nativePlugin(); engine.register(plugin);
  for (const p of [plugin, { ...plugin, id: 'other', contractVersion: 2 }, { ...plugin, id: 'other', analyze: null }, { ...plugin, id: 'other', capabilities: { analysis: 'native-ir', format: true } }, { ...plugin, id: 'other', indentPolicy: { mode: 'semantic', tabWidth: 4, display: 'adapter' } }]) assert.throws(() => engine.register(p), AdapterContractError);
  assert.throws(() => createLegacyJSTSBridge('python', {}), AdapterContractError);
});

test('adapter output is audited for source, language, capabilities, version and identity before admission', async () => {
  for (const mutate of [ir => ir.language = 'other', ir => ir.source += '\n', ir => ir.irVersion = 2, ir => ir.units[0].dependencies.push('missing'), ir => ir.indentPolicy.tabWidth = 8, ir => ir.analysis.strategy = 'legacy-v2-projection']) {
    const engine = new LanguageEngine(), plugin = nativePlugin();
    plugin.analyze = () => { const ir = suiteExercise().ir; mutate(ir); return ir; }; engine.register(plugin);
    await assert.rejects(() => engine.generate(plugin.id, { source: suiteExercise().ir.source }), AdapterContractError);
  }
  const engine = new LanguageEngine(); engine.register(nativePlugin());
  await assert.rejects(() => engine.generate('python', { source: 'pass' }), /Nem támogatott/);
  await assert.rejects(() => engine.generate('indent-fixture', { source: ' ' }), AdapterContractError);
  await assert.rejects(() => engine.generate('indent-fixture', { source: 'x'.repeat(50001) }), AdapterContractError);
  await assert.rejects(() => engine.generate('indent-fixture', { source: suiteExercise().ir.source }, { id: 'bad', revision: 0 }), AdapterContractError);
});

test('compiled and render snapshots do not share mutable rule state with returned adapter models', async () => {
  const engine = new LanguageEngine(), plugin = nativePlugin(), originalIR = suiteExercise().ir;
  plugin.analyze = () => originalIR; engine.register(plugin);
  const { model, compiled, renderPlan } = await engine.generate(plugin.id, { source: originalIR.source });
  originalIR.lines[0].code = 'mutated'; model.ir.lines[0].code = 'another mutation';
  assert.equal(compiled.definition.tokens[0].code, 'if flag:'); assert.equal(renderPlan.units[0].rows[0].code, 'if flag:');
});

test('IR fixture is data, not a Python parser: class-style trusted plugin works without exposing its AST', async () => {
  class FixturePlugin {
    contractVersion = 1; id = 'indent-fixture'; adapterVersion = 'test/1';
    capabilities = { analysis: 'native-ir', format: false };
    indentPolicy = { mode: 'semantic', tabWidth: 4, display: 'preserve' };
    analyze() { return irExercise(['one']).ir; }
  }
  const engine = new LanguageEngine(); engine.register(new FixturePlugin());
  assert.equal((await engine.generate('indent-fixture', { source: 'one' })).model.ir.units.length, 1);
});
