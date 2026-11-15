import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({KickRefined:{}});
vm.runInContext(await readFile('extension/multi-layout.js','utf8'),context);
const box={chromeHeight:36,borderWidth:2,aspectRatio:16/9};
const planFor=(count,focusSize=74,width=1155)=>context.KickRefinedMultiLayout.focusPlan({width,focusSize,gap:8,featured:box,rail:Array(count-1).fill(box)});

test('five streams use two aligned side panes and a balanced pair underneath',()=>{
  const plan=planFor(5);
  assert.equal(plan.sideCount,2);
  assert.equal(plan.rail[0].column,plan.rail[1].column);
  assert.equal(plan.rail[2].row,plan.rail[3].row);
  assert.equal(plan.rail[2].column,'1 / 2');assert.equal(plan.rail[3].column,'2 / 4');
  assert.ok(Math.abs(plan.rail[0].height+8+plan.rail[1].height-plan.mainHeight)<.001);
});
test('four streams fill the side column at the default split; a wider side column uses two slots',()=>{
  assert.equal(planFor(4).sideCount,3);
  assert.equal(planFor(4,66).sideCount,2);
  assert.equal(planFor(4,66).rail[2].row,'3');
});
test('overflow rows divide the full width without narrow orphan columns or negative tracks',()=>{
  for(const width of [641,850,1155,1600,2200])for(const focusSize of [45,50,60,66,67,74,75,80])for(let count=2;count<=12;count++){
    const plan=planFor(count,focusSize,width),columns=plan.templateColumns.split(' ').map(parseFloat);
    assert.ok(columns.every(value=>value>0));
    assert.ok(Math.abs(columns.reduce((sum,value)=>sum+value,0)+8*(columns.length-1)-width)<.001);
    assert.equal(plan.rail.length,count-1);
    assert.ok(plan.rail.slice(0,plan.sideCount).every(position=>position.height>36));
    const overflow=plan.rail.slice(plan.sideCount),rows=new Set(overflow.map(position=>position.row));
    for(const row of rows){const positions=overflow.filter(position=>position.row===row);if(positions.length>1){assert.ok(positions[0].column.startsWith('1 / '));assert.ok(positions.at(-1).column.endsWith(` / ${columns.length+1}`));}}
    if(count>=5&&plan.sideCount>1)assert.notEqual(overflow.length,1);
  }
});
test('empty rails need no packing',()=>{
  assert.equal(planFor(1),null);
});

test('a lone side pane keeps its natural video height without collapsing the grid row',()=>{
  for(const width of [641,850,1155,1600,2200])for(const focusSize of [45,50,66,74,80]){
    const plan=planFor(2,focusSize,width),mainWidth=width*focusSize/100-4,sideWidth=width-mainWidth-8;
    const naturalHeight=Math.ceil(box.chromeHeight+(sideWidth-box.borderWidth)/box.aspectRatio);
    assert.equal(plan.sideCount,1);assert.equal(plan.rail[0].height,naturalHeight);
    assert.equal(parseFloat(plan.templateRows),Math.max(plan.mainHeight,naturalHeight));
    if(focusSize>50)assert.ok(plan.rail[0].height<plan.mainHeight,'the thumbnail never inherits the featured height');
  }
});

test('a lone side pane accounts for its own header and clip details',()=>{
  const side={chromeHeight:100,borderWidth:4,aspectRatio:4/3};
  const plan=context.KickRefinedMultiLayout.focusPlan({width:1200,focusSize:80,gap:8,featured:box,rail:[side]});
  assert.equal(plan.rail[0].height,100+(236-4)/(4/3));
  assert.equal(parseFloat(plan.templateRows),plan.mainHeight);
});
