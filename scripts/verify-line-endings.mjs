/** Line-ending gate: every tracked text file is LF in the index AND in the working tree, as
 * .gitattributes (`* text=auto eol=lf`) and .editorconfig require; only *.bat/*.cmd are CRLF.
 * A tool that writes CRLF on Windows (for example Python text mode) fails `npm run check` here
 * instead of surfacing later as phantom "modified" files. Usage: node scripts/verify-line-endings.mjs */
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

/** Offending entries of `git ls-files --eol` output: CRLF or mixed in index or working tree. */
export function lineEndingViolations(listing){
 return listing.split('\n').filter(Boolean).flatMap(row=>{
  const [index,worktree]=row.split(/\s+/),file=row.slice(row.indexOf('\t')+1);
  const crlfAllowed=/\.(bat|cmd)$/i.test(file);
  const bad=[index,worktree].filter(eol=>!crlfAllowed&&/^(i|w)\/(crlf|mixed)$/.test(eol));
  return bad.length?[`${file}: ${bad.join(', ')}`]:[];
 });
}

// Runs only as a script; the test imports lineEndingViolations without the git call.
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const violations=lineEndingViolations(execFileSync('git',['ls-files','--eol'],{encoding:'utf8'}));
 if(violations.length){
  console.error('CRLF line endings in tracked text files (LF required, see .gitattributes):\n'+violations.join('\n'));
  console.error("Fix: rewrite the file with LF; in Python write with open(path, 'w', newline='\\n').");
  process.exit(1);
 }
 console.log('Line endings verified: every tracked text file is LF.');
}
