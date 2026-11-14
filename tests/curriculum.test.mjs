/** ADR-154 (G3): the curriculum tree of the practice list. The manifest (curriculum/curriculum.json) names topics, their
 * modules and the exercises of a module in teaching order; the headless module reads it, places the list's exercises
 * and says which branches are open; the list renderer draws it. An exercise does not say where it stands. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readCurriculum,curriculumTree,toggleBranch} from '../public/app/curriculum.js';
import {createFieldRenderer} from '../public/app/fields.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {publishExamples} from '../scripts/publish-examples.mjs';

const root=new URL('../',import.meta.url);
const shipped=JSON.parse(await readFile(new URL('curriculum/curriculum.json',root),'utf8'));
const module=(id,title,exercises)=>({id,title,exercises}),topic=(id,title,...modules)=>({id,title,modules});
const SAMPLE={topics:[topic('js','JavaScript',module('basics','Alapok',['a','b','c']),module('lists','Gyűjtemények',['d','e'])),topic('ts','TypeScript',module('warm','Ráhangoló',['f']))]};
const list=ids=>[...ids].map(id=>({id}));
const shape=tree=>tree.branches.map(branch=>`${branch.id}:${branch.count}:${branch.open?'open':'closed'}`+(branch.branches.length?'['+branch.branches.map(inner=>`${inner.id}:${inner.exercises.join('')}:${inner.open?'open':'closed'}`).join(' ')+']':branch.exercises.length?'{'+branch.exercises.join('')+'}':''));

test('a well formed manifest is read as it stands; the shipped one loses nothing',()=>{
 assert.deepEqual(readCurriculum(SAMPLE),SAMPLE);
 assert.deepEqual(readCurriculum(shipped),shipped,'the shipped manifest is well formed');
});

test('whatever is not well formed is left out, never thrown',()=>{
 for(const nothing of [undefined,null,'text',7,[],{},{topics:'x'},{topics:[null,7,'x',[]]}])assert.deepEqual(readCurriculum(nothing),{topics:[]},JSON.stringify(nothing));
 const read=topics=>readCurriculum({topics});
 // a topic or a module without a usable id or title
 assert.deepEqual(read([{title:'No id',modules:[]},{id:'Upper',title:'x',modules:[]},{id:'a b',title:'x',modules:[]},{id:'ok',title:'  ',modules:[]},{id:'ok',title:7,modules:[]},{id:'fine',title:' Fine ',modules:'x'}]),{topics:[{id:'fine',title:'Fine',modules:[]}]});
 assert.deepEqual(read([topic('t','T',{id:'m',title:''},{title:'x'},module('m','M',['a']),module('m','Again',['b']))]).topics[0].modules,[module('m','M',['a'])],'a repeated module id: the first holds');
 assert.deepEqual(read([topic('t','First'),topic('t','Second')]).topics.map(item=>item.title),['First'],'a repeated topic id: the first holds');
 // an exercise named a second time keeps its first place; what is not a name is dropped
 assert.deepEqual(read([topic('t','T',module('one','One',['a','b','a',7,null,'']),module('two','Two',['b','c']))]).topics[0].modules.map(item=>item.exercises),[['a','b'],['c']]);
 // the same module id may stand under two topics
 assert.deepEqual(read([topic('x','X',module('basics','B',['a'])),topic('y','Y',module('basics','B',['b']))]).topics.map(item=>item.modules[0].id),['basics','basics']);
});

test('the tree holds the list\'s exercises in the curriculum\'s order, with their number; an empty branch is not drawn',()=>{
 assert.deepEqual(shape(curriculumTree(readCurriculum(SAMPLE),list('fedcba'))),['js:5:closed[js/basics:abc:closed js/lists:de:closed]','ts:1:closed[ts/warm:f:closed]']);
 assert.deepEqual(shape(curriculumTree(readCurriculum(SAMPLE),list('bd'))),['js:2:closed[js/basics:b:closed js/lists:d:closed]'],'a topic and a module the list has nothing of are left out');
 assert.deepEqual(shape(curriculumTree(readCurriculum(SAMPLE),list('f'))),['ts:1:closed[ts/warm:f:closed]']);
});

test('an exercise the manifest does not name stands in a last branch; a list it names nothing of has no tree',()=>{
 assert.deepEqual(shape(curriculumTree(readCurriculum(SAMPLE),list('xayb'))),['js:2:closed[js/basics:ab:closed]','@rest:2:closed{xy}'],'the rest keeps the list\'s own order');
 assert.deepEqual(curriculumTree(readCurriculum(SAMPLE),list('xyz')),{branches:[],flat:true});
 assert.deepEqual(curriculumTree(readCurriculum(null),list('abc')),{branches:[],flat:true});
 assert.deepEqual(curriculumTree(readCurriculum(SAMPLE),[]),{branches:[],flat:true});
});

test('a branch is open when it holds the open exercise, when a filter narrowed the list, or as the reader left it',()=>{
 const tree=view=>shape(curriculumTree(readCurriculum(SAMPLE),list('abcdefx'),view));
 assert.deepEqual(tree({activeId:'d'}),['js:5:open[js/basics:abc:closed js/lists:de:open]','ts:1:closed[ts/warm:f:closed]','@rest:1:closed{x}']);
 assert.deepEqual(tree({activeId:'x'}),['js:5:closed[js/basics:abc:closed js/lists:de:closed]','ts:1:closed[ts/warm:f:closed]','@rest:1:open{x}']);
 assert.deepEqual(tree({activeId:'d',filtering:true}),['js:5:open[js/basics:abc:open js/lists:de:open]','ts:1:open[ts/warm:f:open]','@rest:1:open{x}']);
 // the reader's choice wins over both
 assert.deepEqual(tree({activeId:'d',opened:{js:false,'ts':true,'ts/warm':true}}),['js:5:closed[js/basics:abc:closed js/lists:de:open]','ts:1:open[ts/warm:f:open]','@rest:1:closed{x}']);
 assert.deepEqual(tree({activeId:'d',filtering:true,opened:{'js/lists':false}}),['js:5:open[js/basics:abc:open js/lists:de:closed]','ts:1:open[ts/warm:f:open]','@rest:1:open{x}']);
});

test('pressing a branch turns what is shown: open closes, closed opens; other choices stay',()=>{
 assert.deepEqual(toggleBranch(undefined,'js',true),{js:false});
 assert.deepEqual(toggleBranch({js:false},'js',false),{js:true});
 assert.deepEqual(toggleBranch({js:false},'js/lists',false),{js:false,'js/lists':true});
 const before={js:false};toggleBranch(before,'ts',false);assert.deepEqual(before,{js:false},'the earlier choices are not changed in place');
});

const item=(id,level,extra={})=>({id,revision:1,language:id==='f'?'typescript':'javascript',title:'T '+id,description:'',lines:[],...(level?{level}:{}),technologies:[{id:'ecmascript',version:id==='d'?'2020':'2015'}],...extra});
const LIST=[item('a','beginner'),item('b','beginner'),item('c','intermediate'),item('d','advanced'),item('e'),item('f','intermediate'),item('x','beginner')];
const draw=(activeId,opened,filter,all=LIST)=>createFieldRenderer(all,value=>String(value),activeId,filter,{curriculum:readCurriculum(SAMPLE),...(opened?{opened}:{})});
const branches=html=>[...html.matchAll(/<button type="button" class="branch" data-branch="([^"]+)" aria-expanded="(true|false)"( aria-controls="[^"]+")?><span class="branch-title">([^<]+)<\/span><span class="branch-count">(\d+)<span class="sr-only"> feladat<\/span><\/span><\/button>/g)].map(m=>`${m[1]}|${m[2]}|${m[4]}|${m[5]}`);
const tasks=html=>[...html.matchAll(/data-task="([^"]+)"/g)].map(match=>match[1]).join('');

test('the list draws the tree: a button per branch, the open exercise\'s path open, a closed branch without its content',()=>{
 const html=draw('d');
 assert.deepEqual(branches(html),['js|true|JavaScript|5','js/basics|false|Alapok|3','js/lists|true|Gyűjtemények|2','ts|false|TypeScript|1','@rest|false|További feladatok|1']);
 assert.equal(tasks(html),'de','only the open module\'s exercises are drawn');
 assert.doesNotMatch(html,/class="side-title"/,'the level groups are gone where there is a tree');
 // a topic is a level 3 heading, its module a level 4 one; an open branch names the body it opens, a closed one has none
 assert.match(html,/<section class="tree-branch depth-1"><h3 class="tree-heading"><button type="button" class="branch" data-branch="js" aria-expanded="true" aria-controls="branch-js">/);
 assert.match(html,/<section class="tree-branch depth-2"><h4 class="tree-heading"><button type="button" class="branch" data-branch="js\/lists" aria-expanded="true" aria-controls="branch-js-lists">.*?<\/h4><div class="tree-body" id="branch-js-lists"><button type="button" class="task selected" data-task="d"/);
 assert.match(html,/data-branch="js\/basics" aria-expanded="false"><span class="branch-title">Alapok<\/span><span class="branch-count">3<span class="sr-only"> feladat<\/span><\/span><\/button><\/h4><\/section>/,'closed: no aria-controls, no body');
 assert.equal((html.match(/ id="/g)??[]).length,new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1])).size,'every id is its own');
});

test('in the tree an exercise names its own level after its labels; without a level it names none',()=>{
 const html=draw('d',{js:true,'js/basics':true,'js/lists':true});
 assert.match(html,/data-task="a"[^>]*>.*?<small><span class="tech-chip ecmascript">ES2015<\/span> · Kezdő · v1<\/small>/);
 assert.match(html,/data-task="c"[^>]*>.*?<small><span class="tech-chip ecmascript">ES2015<\/span> · Közepes · v1<\/small>/);
 assert.match(html,/data-task="d"[^>]*>.*?<small><span class="tech-chip ecmascript">ES2020<\/span> · Haladó · v1<\/small>/);
 assert.match(html,/data-task="e"[^>]*>.*?<small><span class="tech-chip ecmascript">ES2015<\/span> · v1<\/small>/);
 // without a tree the level is the group's heading, as before (ADR-101), and the item does not repeat it
 const flat=createFieldRenderer(LIST,value=>String(value),'d');
 assert.match(flat,/<h3 class="side-title">Kezdő<span>3<\/span><\/h3>/);assert.doesNotMatch(flat,/· Kezdő ·|data-branch/);
 assert.equal(createFieldRenderer(LIST,value=>String(value),'d',undefined,{curriculum:readCurriculum(null)}),flat,'an empty curriculum draws the list as no curriculum does');
});

test('the reader\'s choices are drawn; a narrowed list shows what it found, with the numbers of the narrowed list',()=>{
 assert.deepEqual(branches(draw('d',{js:false,ts:true})),['js|false|JavaScript|5','ts|true|TypeScript|1','ts/warm|false|Ráhangoló|1','@rest|false|További feladatok|1']);
 assert.equal(tasks(draw('d',{js:false,ts:true})),'');
 const narrowed=draw('d',undefined,{id:'ecmascript',version:'2015',earlier:false});
 assert.deepEqual(branches(narrowed),['js|true|JavaScript|4','js/basics|true|Alapok|3','js/lists|true|Gyűjtemények|1','ts|true|TypeScript|1','ts/warm|true|Ráhangoló|1','@rest|true|További feladatok|1']);
 assert.equal(tasks(narrowed),'abcefx');
});

test('the author\'s own previews stand in a group of their own after the tree, outside it',()=>{
 const html=draw('author-1',undefined,undefined,[...LIST,item('author-1','beginner'),item('p','beginner',{previewOnly:true})]);
 assert.deepEqual(branches(html).map(text=>text.split('|')[0]),['js','ts','@rest']);
 assert.match(html,/<\/section><section class="field-group"><h3 class="side-title">Saját előnézet<span>2<\/span><\/h3><div class="task-list"><button type="button" class="task selected" data-task="author-1"/);
 assert.equal(tasks(html),'author-1p');
});

test('what the manifest says is escaped where it is drawn',()=>{
 const html=createFieldRenderer([item('a','beginner')],value=>String(value),'a',undefined,{curriculum:readCurriculum({topics:[topic('t','<b>&"T"</b>',module('m','<i>M</i>',['a']))]})});
 assert.match(html,/<span class="branch-title">&lt;b&gt;&amp;&quot;T&quot;&lt;\/b&gt;<\/span>/);assert.match(html,/<span class="branch-title">&lt;i&gt;M&lt;\/i&gt;<\/span>/);assert.doesNotMatch(html,/<b>|<i>/);
});

test('drift: every shipped exercise stands in the shipped curriculum exactly once, and the curriculum names no other',async()=>{
 const ids=(await Promise.all((await readdir(new URL('examples/',root))).filter(name=>name.endsWith('.json')).map(async name=>JSON.parse(await readFile(new URL('examples/'+name,root),'utf8')).id))).sort();
 const named=shipped.topics.flatMap(item=>item.modules.flatMap(inner=>inner.exercises));
 assert.deepEqual([...named].sort(),ids);assert.equal(new Set(named).size,named.length);
 assert.deepEqual(shipped.topics.map(item=>`${item.title}: ${item.modules.map(inner=>`${inner.title} ${inner.exercises.length}`).join(', ')}`),['JavaScript: Alapok 5, Gyűjtemények 5, Algoritmusok 2','TypeScript: Ráhangoló 4']);
 const tree=curriculumTree(readCurriculum(shipped),list(ids),{activeId:'celsius-js'});
 assert.equal(tree.flat,false);assert.deepEqual(tree.branches.map(branch=>`${branch.id} ${branch.count} ${branch.open}`),['javascript 12 true','typescript 4 false'],'the shipped list has no rest');
});

test('the catalog serves the manifest as it stands in its file; a catalog opened without one has none; the Pages build publishes it',async()=>{
 const examples=new URL('examples/',root).pathname,file=new URL('curriculum/curriculum.json',root).pathname;
 assert.deepEqual((await ExerciseCatalog.open(examples,{curriculumFile:file})).curriculum,shipped);
 assert.equal((await ExerciseCatalog.open(examples)).curriculum,null);
 const out=await mkdtemp(path.join(tmpdir(),'curriculum-'));
 try{
  await publishExamples(examples,out,{curriculumFile:file});assert.deepEqual(JSON.parse(await readFile(path.join(out,'curriculum.json'),'utf8')),shipped);
  const bare=await mkdtemp(path.join(tmpdir(),'curriculum-bare-'));
  try{await publishExamples(examples,bare);assert.ok(!(await readdir(bare)).includes('curriculum.json'),'no manifest, no file');}finally{await rm(bare,{recursive:true,force:true});}
 }finally{await rm(out,{recursive:true,force:true});}
});
