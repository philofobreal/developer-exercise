/** ADR-152 (G2): the technology labels of the practice list. The filter module is headless: how a label reads, how
 * versions are ordered, which labels the list holds, when an exercise matches, and the sentence under a title with
 * its Hungarian suffix. The list draws chips and the filter from it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVersions,matchesTechnology,technologiesOf,technologyGroups,technologyLabel,technologyNote,toggleTechnology} from '../public/app/technology-filter.js';
import {createFieldRenderer,renderTechnologyFilter,technologyChips} from '../public/app/fields.js';

const es=version=>({id:'ecmascript',version}),tsv=version=>({id:'typescript',version});
const item=(id,language,technologies,extra={})=>({id,revision:1,language,title:id,description:'',lines:[],...(technologies?{technologies}:{}),...extra});
const LIST=[item('a','javascript',[es('2015')],{level:'beginner'}),item('b','javascript',[es('2015')],{level:'beginner'}),item('c','javascript',[es('2020')],{level:'intermediate'}),item('d','typescript',[es('5'),tsv('1.0')],{level:'beginner'}),
 item('e','typescript',[es('2018'),tsv('2.0')],{level:'intermediate'}),item('f','typescript',[es('2015'),tsv('4.10')],{level:'advanced'}),item('g','javascript',undefined,{level:'advanced'})];

test('a label reads short; versions order by their parts',()=>{
 assert.deepEqual([es('5'),es('2020'),tsv('2.0'),tsv('4.10')].map(technologyLabel),['ES5','ES2020','TS 2.0','TS 4.10']);
 assert.equal(technologyLabel({id:'rxjs',version:'7.8'}),'rxjs 7.8','a technology this module does not name yet still reads');
 assert.ok(compareVersions('4.9','4.10')<0);assert.ok(compareVersions('2020','5')>0);assert.equal(compareVersions('5','5.0'),0);
 // TypeScript before ECMAScript: the narrower statement first, whatever order the model holds.
 assert.deepEqual(technologiesOf(LIST[4]).map(technologyLabel),['TS 2.0','ES2018']);assert.deepEqual(technologiesOf(LIST[6]),[]);
});

test('the list\'s labels: grouped by technology, oldest first, with the number of exercises',()=>{
 assert.deepEqual(technologyGroups(LIST),[
  {id:'ecmascript',name:'JavaScript (ECMAScript)',facets:[{id:'ecmascript',version:'5',label:'ES5',count:1},{id:'ecmascript',version:'2015',label:'ES2015',count:3},{id:'ecmascript',version:'2018',label:'ES2018',count:1},{id:'ecmascript',version:'2020',label:'ES2020',count:1}]},
  {id:'typescript',name:'TypeScript',facets:[{id:'typescript',version:'1.0',label:'TS 1.0',count:1},{id:'typescript',version:'2.0',label:'TS 2.0',count:1},{id:'typescript',version:'4.10',label:'TS 4.10',count:1}]}]);
 assert.deepEqual(technologyGroups([]),[]);
});

test('an exercise matches the chosen label, or with `earlier` an older version of the same technology',()=>{
 const ids=filter=>LIST.filter(exercise=>matchesTechnology(exercise,filter)).map(exercise=>exercise.id).join('');
 assert.equal(ids(undefined),'abcdefg','no filter: everything, the unlabelled one too');
 assert.equal(ids({...es('2015'),earlier:false}),'abf');assert.equal(ids({...es('2015'),earlier:true}),'abdf','ES5 is older');
 assert.equal(ids({...es('2020'),earlier:true}),'abcdef');assert.equal(ids({...tsv('2.0'),earlier:false}),'e');
 assert.equal(ids({...tsv('4.10'),earlier:true}),'def','4.10 is newer than 2.0');assert.equal(ids({...tsv('1.0'),earlier:true}),'d');
 // Pressing a label chooses it and keeps the `earlier` choice; pressing the chosen one again lets go.
 assert.deepEqual(toggleTechnology(undefined,es('2015')),{...es('2015'),earlier:false});
 assert.deepEqual(toggleTechnology({...es('2015'),earlier:true},tsv('2.0')),{...tsv('2.0'),earlier:true});
 assert.equal(toggleTechnology({...es('2015'),earlier:true},es('2015')),undefined);
});

test('the sentence under a title: from which versions, with the suffix as the number is read',()=>{
 const note=(technologies,checkedWith)=>technologyNote({technologies,...(checkedWith?{checkedWith}:{})});
 assert.equal(note([es('2018'),tsv('2.0')],'5.8'),'TypeScript 2.0-tól · ES2018-tól · ellenőrizve: TypeScript 5.8');
 assert.equal(note([es('2020')]),'ES2020-tól');assert.equal(note([es('2015')],undefined),'ES2015-től');assert.equal(note(undefined,'5.8'),'','no labels, nothing to say');
 // öt, hat, hét, nyolc, kilenc, húsz, egy, kettő, három, négy; tíz, harminc, negyven; nulla.
 const suffix=Object.fromEntries(['5','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026','2030','2040'].map(version=>[version,note([es(version)]).split('-')[1]]));
 assert.deepEqual(suffix,{5:'től',2015:'től',2016:'tól',2017:'től',2018:'tól',2019:'től',2020:'tól',2021:'től',2022:'től',2023:'tól',2024:'től',2025:'től',2026:'tól',2030:'tól',2040:'től'});
 const minor=Object.fromEntries(['1.0','1.3','1.6','2.1','2.7','2.8','3.4','4.9','4.10','5.2','5.5'].map(version=>[version,note([tsv(version)]).split('-')[1]]));
 assert.deepEqual(minor,{'1.0':'tól','1.3':'tól','1.6':'tól','2.1':'től','2.7':'től','2.8':'tól','3.4':'től','4.9':'től','4.10':'től','5.2':'től','5.5':'től'});
});

test('the list draws the labels as chips where the language name stood, and narrows to the chosen label',()=>{
 assert.equal(technologyChips(LIST[4]),'<span class="tech-chip typescript">TS 2.0</span><span class="tech-chip ecmascript">ES2018</span>');
 assert.equal(technologyChips(LIST[6]),'');
 const html=createFieldRenderer(LIST,value=>String(value),'e');
 assert.match(html,/data-task="e"[^>]*><span class="task-file ts" role="img" aria-label="TypeScript" title="TypeScript">TS<\/span><span class="task-content"><strong>e<\/strong><small><span class="tech-chip typescript">TS 2\.0<\/span><span class="tech-chip ecmascript">ES2018<\/span> · v1<\/small>/);
 assert.match(html,/data-task="g"[^>]*><span class="task-file js" role="img" aria-label="JavaScript" title="JavaScript">JS<\/span><span class="task-content"><strong>g<\/strong><small>JavaScript · v1<\/small>/,'an unlabelled exercise keeps its language name');
 const tasks=text=>[...text.matchAll(/data-task="([^"]+)"/g)].map(match=>match[1]).join(''),groups=text=>[...text.matchAll(/<h3 class="side-title">([^<]+)<span>(\d+)</g)].map(match=>match[1]+' '+match[2]);
 assert.equal(tasks(html),'abdcefg');assert.deepEqual(groups(html),['Kezdő 3','Közepes 2','Haladó 2']);
 const narrowed=createFieldRenderer(LIST,value=>String(value),'e',{...es('2015'),earlier:false});
 assert.equal(tasks(narrowed),'abf');assert.deepEqual(groups(narrowed),['Kezdő 2','Haladó 1'],'an emptied group is not drawn, the counts follow');
 // A label the list no longer holds filters nothing: no empty list by a stale choice.
 assert.equal(tasks(createFieldRenderer(LIST,value=>String(value),'e',{...es('2019'),earlier:false})),'abdcefg');
});

test('the filter is the list\'s summary: every label with its count, the chosen one pressed',()=>{
 const html=renderTechnologyFilter(LIST,{...tsv('2.0'),earlier:true});
 assert.match(html,/^<div class="tech-filter" role="group" aria-label="Szűrés technológia és verzió szerint">/);
 // The accessible name is the visible text and what the number counts („ES2015 3 feladat”): no `aria-label` that
 // would hide the visible label from a voice command.
 const facets=[...html.matchAll(/<button type="button" class="tech-facet" data-technology="([^"]+)" aria-pressed="(true|false)"><span>([^<]+)<\/span> <b>(\d+)<\/b><span class="sr-only"> feladat<\/span><\/button>/g)].map(match=>match.slice(1));
 assert.deepEqual(facets.map(([value,pressed,label,count])=>`${value}|${pressed}|${label}|${count}`),['ecmascript 5|false|ES5|1','ecmascript 2015|false|ES2015|3','ecmascript 2018|false|ES2018|1','ecmascript 2020|false|ES2020|1','typescript 1.0|false|TS 1.0|1','typescript 2.0|true|TS 2.0|1','typescript 4.10|false|TS 4.10|1']);
 assert.doesNotMatch(html,/class="tech-facet"[^>]*aria-label/);
 assert.deepEqual([...html.matchAll(/<div class="tech-group" role="group" aria-labelledby="(tech-group-[a-z]+)"><span class="tech-group-name" id="\1">([^<]+)<\/span>/g)].map(match=>match[2]),['JavaScript (ECMAScript)','TypeScript'],'each technology is a named group of its labels');
 assert.match(html,/<label class="tech-earlier"><input type="checkbox" data-technology-earlier checked ><span>és a korábbi verziók<\/span><\/label>/);
 // Without a choice the `earlier` box has nothing to act on; a stale choice is no choice.
 assert.match(renderTechnologyFilter(LIST,undefined),/data-technology-earlier  disabled>/);
 assert.doesNotMatch(renderTechnologyFilter(LIST,{...es('2019'),earlier:true}),/aria-pressed="true"|data-technology-earlier checked/);
 // A list with one label, or none, has nothing to choose between.
 assert.equal(renderTechnologyFilter([LIST[0],LIST[1],LIST[6]],undefined),'');assert.equal(renderTechnologyFilter([],undefined),'');
 // Escaped like everything the list draws.
 assert.doesNotMatch(renderTechnologyFilter([item('x','javascript',[{id:'<b>',version:'"1'}]),LIST[0]],undefined),/<b>"|data-technology="<b>/);
});
