import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('extension/preview-queue.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settled(promise){
  let result;promise.then(value=>result=value);await tick();
  assert.notEqual(result,undefined,'every consumer must receive a result without waiting for abandoned work');
  return result;
}
function setup({ignoreAbort=false,run,complete}={}){
  const handlers=[],jobs=[],completed=[],timers=new Map();let removed,next=0;
  const api={runtime:{id:'extension',onMessage:{addListener:fn=>handlers.push(fn)}},tabs:{onRemoved:{addListener:fn=>removed=fn}}};
  const context=vm.createContext({URL,AbortController,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);
  const queue=context.KickRefinedPreviewQueue.create({api,run:run||((item,signal)=>new Promise((resolve,reject)=>{
    jobs.push({item,signal,resolve,reject});
    if(!ignoreAbort)signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
  })),complete:(key,result)=>{completed.push([key,result]);complete?.(key,result);}});
  const from=(tab=1,frame=0,documentId='document')=>({id:'extension',tab:{id:tab},frameId:frame,documentId,url:'https://kick.com/example'});
  return {queue,jobs,completed,timers,from,close:tab=>removed(tab),cancel:(sender,requestId)=>handlers.forEach(fn=>fn({type:'immersion:preview-cancel',requestId},sender)),expire(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}

test('timeouts settle consumers and start queued previews even when a provider ignores abort',async()=>{
  const s=setup({ignoreAbort:true}),a=s.queue.request('a','a',s.from(),'a');
  s.queue.request('b','b',s.from(),'b');s.queue.request('c','c',s.from(),'c');await tick();
  s.expire();await tick();
  assert.equal((await settled(a)).ok,false);assert.equal(s.jobs[0].signal.aborted,true);
  assert.deepEqual(s.jobs.map(job=>job.item),['a','b','c']);
  s.close(1);await tick();assert.equal(s.timers.size,0);
});

test('last-consumer cancellation releases a slot without cooperation from the provider',async()=>{
  const s=setup({ignoreAbort:true}),a=s.queue.request('a','a',s.from(),'a');
  s.queue.request('b','b',s.from(),'b');s.queue.request('c','c',s.from(),'c');await tick();
  s.cancel(s.from(),'a');await tick();assert.equal((await a).cancelled,true);
  assert.deepEqual(s.jobs.map(job=>job.item),['a','b','c']);assert.equal(s.completed.length,0);
  s.close(1);await tick();assert.equal(s.timers.size,0);
});

test('late success after timeout cannot overwrite a retry or cache stale metadata',async()=>{
  const s=setup({ignoreAbort:true}),old=s.queue.request('same','old',s.from(),'old');await tick();s.expire();
  assert.equal((await settled(old)).ok,false);
  const retry=s.queue.request('same','retry',s.from(),'retry');await tick();
  s.jobs[0].resolve({ok:true,value:'stale'});await tick();
  assert.equal(s.completed.length,1,'only the timeout has been cached');
  const shared=s.queue.request('same','duplicate',s.from(2),'shared');await tick();assert.equal(s.jobs.length,2);
  s.jobs[1].resolve({ok:true,value:'fresh'});
  assert.equal((await retry).value,'fresh');assert.equal((await shared).value,'fresh');await tick();
  assert.equal(s.completed.at(-1)[1].value,'fresh');assert.equal(s.timers.size,0);
});

test('late rejection after cancellation is consumed and cannot affect a replacement',async()=>{
  const s=setup({ignoreAbort:true}),old=s.queue.request('same','old',s.from(),'old');await tick();
  s.cancel(s.from(),'old');assert.equal((await old).cancelled,true);
  const retry=s.queue.request('same','retry',s.from(),'retry');await tick();
  s.jobs[0].reject(Error('late failure'));await tick();assert.equal(s.completed.length,0);
  s.jobs[1].resolve({ok:true});assert.equal((await retry).ok,true);await tick();assert.equal(s.timers.size,0);
});

test('cache callback exceptions cannot strand consumers or block the queue',async()=>{
  const s=setup({complete(){throw Error('cache unavailable');}});
  const a=s.queue.request('a','a',s.from(),'a');await tick();s.jobs[0].resolve({ok:true});
  assert.equal((await settled(a)).ok,true);
  const b=s.queue.request('b','b',s.from(),'b');await tick();s.jobs[1].resolve({ok:true});
  assert.equal((await settled(b)).ok,true);assert.equal(s.timers.size,0);
});

for(const [label,run]of [['synchronous exceptions',()=>{throw Error('sync');}],['rejected promises',()=>Promise.reject(Error('async'))]]){
  test(`preview ${label} settle as failures and leave no timers`,async()=>{
    const s=setup({run}),result=await s.queue.request('a','a',s.from(),'a');await tick();
    assert.equal(result.ok,false);assert.equal(s.completed.length,1);assert.equal(s.timers.size,0);
  });
}

test('queue saturation rejects new work but still accepts consumers of existing jobs',async()=>{
  const s=setup(),requests=[];
  for(let i=0;i<42;i++)requests.push(s.queue.request(String(i),i,s.from(),'r'+i));
  await tick();assert.equal(s.jobs.length,2);
  assert.equal((await s.queue.request('overflow','overflow',s.from(),'overflow')).ok,false);
  const shared=s.queue.request('41','shared',s.from(2),'shared');
  s.close(1);assert.equal((await requests[41]).cancelled,true);await tick();
  assert.equal(s.jobs.at(-1).item,41);s.jobs.at(-1).resolve({ok:true});
  assert.equal((await shared).ok,true);await tick();assert.equal(s.timers.size,0);
});

test('duplicate request IDs share one lease and become reusable after settlement',async()=>{
  const s=setup(),first=s.queue.request('a','a',s.from(),'same');
  assert.equal(s.queue.request('a','duplicate',s.from(),'same'),first);await tick();assert.equal(s.jobs.length,1);
  s.jobs[0].resolve({ok:true});await first;await tick();
  const next=s.queue.request('b','b',s.from(),'same');assert.notEqual(next,first);await tick();
  s.jobs[1].resolve({ok:true});assert.equal((await next).ok,true);await tick();assert.equal(s.timers.size,0);
});

for(const [label,sender]of [
  ['another frame',s=>s.from(1,1)],['another document',s=>s.from(1,0,'old-document')],
  ['another tab',s=>s.from(2)],['another extension',s=>({...s.from(),id:'foreign'})],
  ['a lookalike origin',s=>({...s.from(),url:'https://kick.com.evil.test/'})],
  ['a malformed URL',s=>({...s.from(),url:'invalid'})],['a missing tab',s=>({...s.from(),tab:null})]
]){
  test(`cancellation from ${label} cannot release another consumer`,async()=>{
    const s=setup(),pending=s.queue.request('a','a',s.from(),'id');await tick();
    s.cancel(sender(s),'id');assert.equal(s.jobs[0].signal.aborted,false);
    s.jobs[0].resolve({ok:true});assert.equal((await pending).ok,true);await tick();assert.equal(s.timers.size,0);
  });
}

test('closing the same tab repeatedly cancels all frames and leaves other tabs intact',async()=>{
  const s=setup(),a=s.queue.request('same','a',s.from(1,0),'id'),b=s.queue.request('same','b',s.from(1,1),'id'),c=s.queue.request('same','c',s.from(2),'id');
  await tick();s.close(1);s.close(1);assert.equal((await a).cancelled,true);assert.equal((await b).cancelled,true);
  assert.equal(s.jobs[0].signal.aborted,false);s.jobs[0].resolve({ok:true});assert.equal((await c).ok,true);await tick();assert.equal(s.timers.size,0);
});

test('a completion callback can request the same key without joining an already completed job',async()=>{
  let next;const s=setup({complete(key){if(!next)next=s.queue.request(key,'replacement',s.from(2),'replacement');}});
  const first=s.queue.request('same','first',s.from(),'first');await tick();s.jobs[0].resolve({ok:true});await first;await tick();
  assert.deepEqual(s.jobs.map(job=>job.item),['first','replacement']);s.jobs[1].resolve({ok:true});
  assert.equal((await settled(next)).ok,true);assert.equal(s.timers.size,0);
});

for(const seed of [1,7,42,12345,65535,0xdeadbeef]){
  test(`seed ${seed}: 500 interleaved preview operations settle every lease and keep logical work bounded`,async()=>{
    let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const s=setup({ignoreAbort:true}),requests=[];const completed=new Set();
    for(let step=0;step<500;step++){
      const action=random();
      if(action<.5){
        const key='key'+Math.floor(random()*10),sender=s.from(1+Math.floor(random()*3),Math.floor(random()*3)),id='r'+step;
        const entry={key,sender,id,result:null};requests.push(entry);
        s.queue.request(key,key,sender,id).then(result=>entry.result=result);
      }else if(action<.68&&requests.length){
        const entry=requests[Math.floor(random()*requests.length)];s.cancel(entry.sender,entry.id);
      }else if(action<.82){
        const job=s.jobs.find(job=>!completed.has(job)&&!job.signal.aborted);
        if(job){completed.add(job);job.resolve({ok:true,value:job.item});}
      }else if(action<.9&&s.timers.size)s.expire();
      else s.close(1+Math.floor(random()*3));
      await tick();
      const running=s.jobs.filter(job=>!completed.has(job)&&!job.signal.aborted);
      assert.ok(running.length<=2);assert.equal(new Set(running.map(job=>job.item)).size,running.length);
      assert.ok(s.timers.size<=2);
      for(const entry of requests)if(entry.result?.ok)assert.equal(entry.result.value,entry.key);
    }
    for(let tab=1;tab<=3;tab++)s.close(tab);await tick();
    assert.ok(requests.every(entry=>entry.result!==null),'all request promises settle on tab closure');assert.equal(s.timers.size,0);
    const before=s.completed.length;
    for(const job of s.jobs)if(!completed.has(job))job.resolve({ok:true,value:'stale'});
    await tick();assert.equal(s.completed.length,before,'late completions cannot populate the cache');
  });
}
