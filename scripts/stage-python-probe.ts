/** Local-only parser fixture: verify exact npm assets before copying to an ignored host. */
import {readFile, mkdir, copyFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
interface Manifest {pyodideVersion: string; files: {name: string; bytes: number; sha256: string}[];}
const manifest: Manifest = JSON.parse(await readFile('docs/python-runtime-manifest.json', 'utf8'));
const metadata: {version: string} = JSON.parse(await readFile('node_modules/pyodide/package.json', 'utf8'));
if (manifest.pyodideVersion !== metadata.version) throw Error('Pinned Python runtime version mismatch.');
const root = path.resolve('test-results/python-site');
async function copy(source: string, destination: string): Promise<void> {
 const target = path.resolve(root, destination);
 if (!target.startsWith(root + path.sep)) throw Error('Python fixture target escaped its directory.');
 await mkdir(path.dirname(target), {recursive: true}); await copyFile(source, target);
}
for (const file of manifest.files) {
 if (!/^[a-zA-Z0-9_.-]+$/.test(file.name)) throw Error('Invalid runtime asset name.');
 const source = 'node_modules/pyodide/' + file.name, data = await readFile(source);
 if (data.length !== file.bytes || createHash('sha256').update(data).digest('hex') !== file.sha256) throw Error('Python runtime hash mismatch: ' + file.name);
 await copy(source, 'vendor/python/' + file.name);
}
for (const file of await readdir('dist/python')) if (file.endsWith('.js')) await copy('dist/python/' + file, 'dist/python/' + file);
await copy('dist/author/python-parser.js', 'dist/author/python-parser.js');
for (const file of ['LICENSE-pyodide.txt', 'LICENSE-cpython.txt']) await copy('docs/licenses/' + file, 'vendor/python/' + file);
await copy('tests/fixtures/python-parser-corpus.json', 'corpus.json');
await copy('tests/fixtures/python-probe.html', 'index.html');
console.log(`Pinned Python probe staged locally: ${manifest.files.length} verified runtime assets; existing Pages artifact unchanged.`);
