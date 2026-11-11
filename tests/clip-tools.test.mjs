import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../extension/clip-tools.js',import.meta.url),'utf8'),context);
const {range,format}=context.KickRefinedClipTools;
test('clip ranges respect source bounds, minimum and maximum duration',()=>{
 for(const [start,end,total]of [[-5,40,180],[170,500,180],[0,999,500],[99,0,180]]){
  const value=range(start,end,total);assert.ok(value.start>=0&&value.end<=total&&value.duration>=10&&value.duration<=180);
 }
 for(const args of [[NaN,30,180],[0,Infinity,180],[0,10,9],[0,10,Infinity]])assert.equal(range(...args),null);
 assert.equal(format(180),'3:00');assert.equal(format(65),'1:05');
});
test('cropper geometry reads inline coordinates without counting the timeline border',()=>{
 const track={nextElementSibling:{textContent:'60s / 180s'},getBoundingClientRect:()=>({left:100,width:600})};
 const selection={parentElement:track,style:{left:'400px',width:'200px'},getBoundingClientRect:()=>({left:501,width:200})};
 const middle={parentElement:selection},dialog={querySelector:()=>middle};
 const value=context.KickRefinedClipTools.read(dialog);assert.equal(value.start,120);assert.equal(value.end,180);
 selection.style={left:'50%',width:'25%'};const percent=context.KickRefinedClipTools.read(dialog);assert.equal(percent.start,90);assert.equal(percent.end,135);
});
