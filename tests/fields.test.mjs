import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldRenderer} from '../public/fields.js';
test('Vanilla dynamic registry renders each exercise under the root container',()=>{
 const output=createFieldRenderer([{id:'one',title:'A',language:'javascript',revision:1},{id:'two',title:'B',language:'typescript',revision:2}],s=>s,'two');
 assert.match(output,/data-task="one"/);assert.match(output,/data-task="two"/);assert.match(output,/class="task selected" data-task="two"/);
});
