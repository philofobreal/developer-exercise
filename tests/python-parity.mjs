// Fixed test corpus only. The oracle measures the same runtime in-process, without executing source.
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createRequire} from 'node:module';
import {loadPyodide} from 'pyodide';
import {createAuditRuntime} from '../dist/python/runtime.js';
import {failureReply} from '../dist/python/worker-protocol.js';
import {normalizePythonSource} from '../dist/author/python-parser.js';
const corpus = JSON.parse(await readFile(new URL('./fixtures/python-parser-corpus.json', import.meta.url), 'utf8'));
const before = process.memoryUsage(), start = performance.now(); let instance;
const audit = await createAuditRuntime(async options => (instance = await loadPyodide(options)), dirname(createRequire(import.meta.url).resolve('pyodide')) + '/');
const coldMs = performance.now() - start, replies = [], times = [];
for (const [index, item] of corpus.entries()) {
 const request = {protocolVersion: 1, grammarVersion: '3.14', requestId: index + 1, source: normalizePythonSource(item.source)};
 const begin = performance.now();
 try { replies.push(audit(request)); } catch (error) { replies.push(failureReply(request, error)); }
 times.push(performance.now() - begin);
}
const sorted = times.toSorted((a, b) => a - b);
console.log(JSON.stringify({replies, metrics: {coldMs, warmP95Ms: sorted[Math.floor(sorted.length * .95)], rssBeforeBytes: before.rss, rssAfterBytes: process.memoryUsage().rss, wasmHeapBytes: instance._module.HEAPU8.byteLength}}));
