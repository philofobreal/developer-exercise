/** The line-ending gate (scripts/verify-line-endings.mjs): CRLF or mixed endings in the index or
 * the working tree fail, except in Windows command scripts; the repository passes today. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {lineEndingViolations} from '../scripts/verify-line-endings.mjs';

const row=(index,worktree,file)=>`${index}  ${worktree}  attr/text=auto eol=lf \t${file}`;

test('CRLF or mixed endings in the index or the working tree are violations',()=>{
 assert.deepEqual(lineEndingViolations([
  row('i/lf','w/lf','ok.mjs'),
  row('i/lf','w/crlf','tests/written by python.py'),
  row('i/crlf','w/crlf','legacy.md'),
  row('i/mixed','w/lf','half.ts'),
  row('i/-text','w/-text','image.png'),
  row('i/none','w/none','empty.map'),
 ].join('\n')),['tests/written by python.py: w/crlf','legacy.md: i/crlf, w/crlf','half.ts: i/mixed']);
});

test('Windows command scripts may be CRLF',()=>{
 assert.deepEqual(lineEndingViolations([row('i/crlf','w/crlf','run.cmd'),row('i/crlf','w/crlf','setup.BAT')].join('\n')),[]);
});

test('the repository has no CRLF in any tracked text file, and the rules are in place',async()=>{
 assert.deepEqual(lineEndingViolations(execFileSync('git',['ls-files','--eol'],{encoding:'utf8'})),[]);
 assert.match(await readFile(new URL('../.gitattributes',import.meta.url),'utf8'),/^\* text=auto eol=lf$/m);
 assert.match(await readFile(new URL('../.editorconfig',import.meta.url),'utf8'),/^end_of_line = lf$/m);
});
