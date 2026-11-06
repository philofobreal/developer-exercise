/** ADR-105: the theme boot script and the theme module agree on the storage key and the values, and the
 *  boot script stays a classic script (a module would be deferred and the stored theme would flash). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THEME_KEY,THEME_LABEL} from '../public/app/theme.js';

test('the boot script reads the key the theme module writes, and is not a module',async()=>{
 const boot=await readFile(new URL('../public/app/theme-boot.js',import.meta.url),'utf8');
 assert.ok(boot.includes(`'${THEME_KEY}'`),'same storage key');
 assert.doesNotMatch(boot,/^\s*(import|export)\b/m);
 for(const value of ['light','dark'])assert.ok(boot.includes(`'${value}'`));
 assert.deepEqual(Object.keys(THEME_LABEL),['system','light','dark']);
 const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const head=index.slice(0,index.indexOf('</head>'));
 assert.match(head,/<script src="\/app\/theme-boot\.js"><\/script>/,'loaded in <head>, synchronously');
 assert.ok(head.indexOf('theme-boot.js')<head.indexOf('style.css'),'before the stylesheet');
});
