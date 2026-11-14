import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({KickRefined:{}});
vm.runInContext(await readFile('extension/multi-layout.js','utf8'),context);
const box={width:302,height:204.75,playerWidth:300,playerHeight:168.75};
test('focus placement wraps excess streams and reserves only the featured height',()=>{
  const plan=context.KickRefinedMultiLayout.focusPlan({width:1200,focusSize:74,gap:8,featured:box,rail:Array(5).fill(box)});
  assert.equal(plan.columns,3);
  const beside=plan.rail.filter(position=>position.column==='4'&&Number(position.row)<=3);
  assert.equal(beside.length,3);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.rail[3])),{column:'1',row:'4'});
  assert.ok(plan.mainHeight<540);
});
test('a split near two thirds fills the right column before wrapping',()=>{
  const plan=context.KickRefinedMultiLayout.focusPlan({width:1155,focusSize:66,gap:10,featured:box,rail:Array(3).fill(box)});
  assert.equal(plan.rail[0].column,plan.rail[1].column);
  assert.equal(plan.rail[1].row,'2');
  assert.equal(plan.rail[2].column,'1');
});
test('focus placement handles one secondary and a wider focused pane',()=>{
  const plan=context.KickRefinedMultiLayout.focusPlan({width:1200,focusSize:80,gap:8,featured:box,rail:[box]});
  assert.equal(plan.columns,4);
  assert.equal(plan.rail[0].column,'5');
  assert.equal(plan.featured.row,'1 / span 1');
});
