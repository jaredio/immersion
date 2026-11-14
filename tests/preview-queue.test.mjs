import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(){
  const handlers=[];let removed;const jobs=[],completed=[];
  const api={runtime:{id:'extension',onMessage:{addListener:fn=>handlers.push(fn)}},tabs:{onRemoved:{addListener:fn=>removed=fn}}};
  const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout});vm.runInContext(await readFile('extension/preview-queue.js','utf8'),ctx);
  const queue=ctx.KickRefinedPreviewQueue.create({api,run:(item,signal)=>new Promise((resolve,reject)=>{jobs.push({item,signal,resolve});signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});}),complete:(key,value)=>completed.push([key,value])});
  const from=(tab,frame=0)=>({id:'extension',tab:{id:tab},frameId:frame,url:'https://kick.com/example'});
  return {queue,jobs,completed,from,cancel:(sender,requestId)=>handlers.forEach(fn=>fn({type:'immersion:preview-cancel',requestId},sender)),close:tab=>removed(tab)};
}
test('canceling one consumer preserves shared work; wrong tabs cannot cancel another frame',async()=>{
  const s=await setup(),a=s.queue.request('same','item',s.from(1),'a'),b=s.queue.request('same','item',s.from(2),'b');await tick();
  assert.equal(s.jobs.length,1);s.cancel(s.from(3),'a');assert.equal(s.jobs[0].signal.aborted,false);
  s.cancel(s.from(1),'a');assert.equal((await a).cancelled,true);assert.equal(s.jobs[0].signal.aborted,false);
  s.jobs[0].resolve({ok:true});assert.equal((await b).ok,true);await tick();assert.equal(s.completed.length,1);
});
test('tab closure removes queued work and aborts running work only after its last consumer leaves',async()=>{
  const s=await setup();const a=s.queue.request('a','a',s.from(1),'a'),b=s.queue.request('b','b',s.from(2),'b'),c=s.queue.request('c','c',s.from(1),'c');await tick();
  assert.equal(s.jobs.length,2);s.close(1);assert.equal((await a).cancelled,true);assert.equal((await c).cancelled,true);await tick();
  assert.equal(s.jobs[0].signal.aborted,true);assert.equal(s.jobs.length,2,'abandoned queued request never starts');
  s.jobs[1].resolve({ok:true});await b;await tick();assert.deepEqual(s.completed.map(item=>item[0]),['b'],'cancellation never caches a failure');
});
