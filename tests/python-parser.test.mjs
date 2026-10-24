import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {createNodePythonParser} from '../dist/python/node-parser.js';
import {createParserClient} from '../dist/python/client.js';
import {createAuditRuntime} from '../dist/python/runtime.js';
import {decodePythonAudit, decodePythonReply, normalizePythonSource, isPythonRequest, PYODIDE_VERSION, PYTHON_VERSION} from '../dist/author/python-parser.js';

const corpus = JSON.parse(await readFile(new URL('./fixtures/python-parser-corpus.json', import.meta.url), 'utf8'));
function kinds(value, result = new Set()) {
 if (value && typeof value === 'object') { if (value.kind) result.add(value.kind); for (const child of Object.values(value)) kinds(child, result); }
 return result;
}
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);

test('runtime manifest, lockfile and protocol pins agree', async () => {
 const manifest = JSON.parse(await readFile(new URL('../docs/python-runtime-manifest.json', import.meta.url)));
 const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
 assert.equal(manifest.pyodideVersion, PYODIDE_VERSION); assert.equal(manifest.pythonVersion, PYTHON_VERSION);
 assert.equal(lock.packages['node_modules/pyodide'].version, PYODIDE_VERSION);
 assert.equal(lock.packages['node_modules/pyodide'].integrity, manifest.npmIntegrity);
 assert.deepEqual(manifest.files.map(file => file.name).toSorted(), ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'].toSorted());
});

test('pinned CPython corpus: syntax, tokens, bindings, mixed structures and no author execution', {timeout: 60_000}, async t => {
 const parser = createNodePythonParser(); t.after(() => parser.close());
 for (const item of corpus) await t.test(item.id, async () => {
  if (item.error) return rejectsCode(parser.audit(item.source), item.error);
  const audit = await parser.audit(item.source), found = kinds(audit.tree);
  assert.equal(audit.runtimeVersion, '3.14.2'); assert.equal(audit.grammarVersion, '3.14');
  assert.equal(audit.source, item.source.replace(/\r\n?/g, '\n'));
  for (const kind of item.kinds ?? []) assert.ok(found.has(kind), `${item.id}: ${kind}`);
  if (item.scopeKinds) assert.deepEqual(audit.scopes.map(scope => scope.kind), item.scopeKinds);
 });
 await assert.rejects(access('MUST_NOT_CREATE'), {code: 'ENOENT'});
 const unicode = await parser.audit("árvíz = '😀'\n结果 = árvíz\n");
 const firstName = unicode.tree.fields.body[0].fields.targets[0];
 assert.equal(firstName.end.column, 7); // UTF-8 bytes, not code points or UTF-16.
 assert.equal(unicode.tokens[0].end.column, 5);
 assert.equal(unicode.tree.fields.body[0].end.column, 16);
 const combining = await parser.audit("a\u0301 = '😀e\u0301'\n");
 assert.equal(combining.tree.fields.body[0].fields.targets[0].fields.id, 'á'); // Python's identifier normalization is not source normalization.
 assert.equal(combining.tokens[0].text, 'a\u0301');
 const literal = await parser.audit("x = '''a\n\t  b  \n\nc'''\n");
 assert.equal(literal.tree.fields.body[0].fields.value.fields.value, 'a\n\t  b  \n\nc');
 const scope = await parser.audit(corpus.find(item => item.id === 'function-nonlocal-global').source);
 const inner = scope.scopes.find(scope => scope.kind === 'function' && scope.name === 'inner');
 assert.ok(inner.symbols.find(symbol => symbol.name === 'local').flags.includes('nonlocal'));
 assert.ok(inner.symbols.find(symbol => symbol.name === 'value').flags.includes('declared_global'));
 const classLookup = await parser.audit('x = 1\nclass C:\n    x = 2\n    def method(self):\n        return x\n');
 assert.ok(classLookup.scopes.find(scope => scope.kind === 'function' && scope.name === 'method').symbols.find(symbol => symbol.name === 'x').flags.includes('global'));
 const tokens = await parser.audit('if True:\n    x = (\n        1\n    )\n');
 assert.equal(tokens.tokens.filter(token => token.kind === 'INDENT').length, 1);
 assert.equal(tokens.tokens.filter(token => token.kind === 'DEDENT').length, 1);
 // Bounded generated variations supplement the readable corpus without claiming grammar completeness.
 for (const newline of ['\n', '\r\n', '\r']) for (const indent of [' ', '    ', '\t']) for (const literal of ["'😀'", "'\\t  '", '999999999999999999999999']) {
  const source = ['if True:', `${indent}value = (${literal})`, `${indent}# kept`, ''].join(newline);
  const audit = await parser.audit(source); assert.equal(audit.tree.fields.body[0].kind, 'If');
 }
});

test('protocol and payloads reject before admission; valid parser DTO cannot change source/runtime', async t => {
 const parser = createNodePythonParser(); t.after(() => parser.close());
 const audit = await parser.audit('x = 1\n');
 for (const mutate of [value => value.runtimeVersion = '3.13.0', value => value.source = 'x=2', value => value.tokens[0].start.line = 0, value => value.scopes[0].parentId = 'missing', value => value.tree.fields = null, value => value.tree.fields.body.push(123)]) {
  const bad = structuredClone(audit); mutate(bad); assert.throws(() => decodePythonAudit(bad, audit.source), error => error.code === 'invalid_protocol');
 }
 const request = {protocolVersion: 1, requestId: 1, grammarVersion: '3.14', source: audit.source};
 assert.throws(() => decodePythonReply({protocolVersion: 1, requestId: 2, ok: true, audit}, request), error => error.code === 'invalid_protocol');
 assert.throws(() => decodePythonReply({protocolVersion: 1, requestId: 1, ok: false, error: {code: 'invented', message: ''}}, request), error => error.code === 'invalid_protocol');
 assert.equal(isPythonRequest({...request, source: 'x\r\n'}), false);
 for (const source of ['x'.repeat(50_001), '\n'.repeat(501), 'x'.repeat(2049), 'x\0', 'x\u2028', 'x\u2029', 'x\ud800', 'x\udfff']) {
  assert.throws(() => normalizePythonSource(source), error => error.code === 'resource_limit');
  await rejectsCode(parser.audit(source), 'resource_limit');
 }
 assert.equal(normalizePythonSource('x\r\ny\rz'), 'x\ny\nz');
 const aborted = new AbortController(); aborted.abort(); await rejectsCode(parser.audit('x=1', {signal: aborted.signal}), 'aborted');
 await rejectsCode(parser.audit('x=1', {timeoutMs: 0}), 'resource_limit');
});

test('real process timeout, cancellation of shared runtime, restart, close', {timeout: 30_000}, async t => {
 const parser = createNodePythonParser(); t.after(() => parser.close());
 await rejectsCode(parser.audit('x = 1', {timeoutMs: 1}), 'timeout');
 const abort = new AbortController();
 const one = rejectsCode(parser.audit('x = 1', {signal: abort.signal}), 'aborted');
 const two = rejectsCode(parser.audit('y = 2'), 'aborted');
 abort.abort(); await Promise.all([one, two]);
 assert.equal((await parser.audit('x = 1')).tree.kind, 'Module');
 parser.close(); await rejectsCode(parser.audit('x = 1'), 'closed');
});

test('transport identity, malformed replies, late response isolation and queue budget', async () => {
 let receive, terminated = 0, sent = [];
 const parser = createParserClient(reply => { receive = reply; return {send: request => sent.push(request), terminate: () => terminated++}; });
 try {
  const invalid = rejectsCode(parser.audit('x=1'), 'invalid_protocol'); receive({requestId: 999}); await invalid;
  assert.equal(terminated, 1);
  const old = receive;
  const current = rejectsCode(parser.audit('x=2'), 'invalid_protocol');
  old({requestId: sent[0].requestId}); // old generation cannot corrupt a new request.
  receive({requestId: sent[1].requestId, protocolVersion: 666}); await current;
  const queue = Array.from({length: 8}, () => rejectsCode(parser.audit('x=3'), 'closed'));
  await rejectsCode(parser.audit('x=4'), 'resource_limit'); parser.close(); await Promise.all(queue);
 } finally { parser.close(); }
});

test('runtime version is checked; source is only an audit argument and malformed Python JSON is rejected', async t => {
 const parser = createNodePythonParser(); t.after(() => parser.close());
 const audit = await parser.audit('x = 1\n');
 let bootstrapCalls = 0, argument;
 const runtime = await createAuditRuntime(async () => ({version: '314.0.7', runPython: script => { bootstrapCalls++; assert.ok(script.startsWith('\nimport ast')); }, globals: {get: name => { assert.equal(name, '_ng_audit'); return source => { argument = source; return JSON.stringify({ok: true, audit}); }; }}}), '/local/');
 const request = {protocolVersion: 1, requestId: 1, grammarVersion: '3.14', source: audit.source};
 assert.deepEqual(runtime(request).audit, audit); assert.equal(bootstrapCalls, 1); assert.equal(argument, audit.source);
 assert.throws(() => runtime({...request, source: 'changed'}), error => error.code === 'invalid_protocol');
 await rejectsCode(createAuditRuntime(async () => ({version: 'other'}), '/local/'), 'runtime_error');
 const broken = await createAuditRuntime(async () => ({version: '314.0.7', runPython: () => {}, globals: {get: () => () => '{"ok":false,"error":{"code":"invented"}}'}}), '/local/');
 assert.throws(() => broken(request), error => error.code === 'invalid_protocol');
 const badJSON = await createAuditRuntime(async () => ({version: '314.0.7', runPython: () => {}, globals: {get: () => () => '{unfinished'}}), '/local/');
 assert.throws(() => badJSON(request), error => error.code === 'invalid_protocol');
});

test('synchronous transport failure is cleaned up without sending; input failure never opens a transport', async () => {
 let started = 0, stopped = 0;
 const parser = createParserClient((reply, failed) => { started++; failed(new Error('transport failed')); return {send: () => assert.fail('must not send'), terminate: () => stopped++}; });
 try {
  await rejectsCode(parser.audit('x\0'), 'resource_limit'); assert.equal(started, 0);
  await assert.rejects(parser.audit('x=1'), /transport failed/); assert.equal(started, 1); assert.equal(stopped, 1);
 } finally { parser.close(); }
});
