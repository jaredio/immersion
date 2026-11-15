import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('extension/multi-startup.js','utf8');
function setup(limit=2){
  const microtasks=[],timers=new Map(),errors=[];let next=0;
  const context=vm.createContext({performance,queueMicrotask:fn=>microtasks.push(fn),setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);const queue=context.KickRefinedMultiStartup.create({limit});
  return {queue,timers,errors,flush(){while(microtasks.length){try{microtasks.shift()();}catch(error){errors.push(error);}}}};
}

test('synchronous readiness can drain a thousand queued startups without retaining timers',()=>{
  const s=setup(),started=[];
  for(let i=0;i<1000;i++)s.queue.enqueue({start:job=>{started.push(i);s.queue.complete(job);}});
  s.flush();assert.equal(started.length,1000);assert.deepEqual(started,Array.from({length:1000},(_,i)=>i));
  assert.equal(s.queue.snapshot().running,0);assert.equal(s.queue.snapshot().queued,0);assert.equal(s.timers.size,0);s.queue.destroy();
});

test('completion and cancellation of unknown or finished jobs cannot release another startup slot',()=>{
  const s=setup(1),a=s.queue.enqueue({start(){}}),b=s.queue.enqueue({start(){}});s.flush();
  s.queue.complete({});s.queue.cancel(null);s.queue.cancel(b);s.queue.complete(b);s.flush();
  assert.equal(s.queue.snapshot().running,1);assert.equal(a.state,'running');assert.equal(s.timers.size,1);
  s.queue.complete(a);s.queue.cancel(a);s.flush();assert.equal(s.queue.snapshot().running,0);assert.equal(s.timers.size,0);s.queue.destroy();
});

test('a stale timeout callback cannot time out a finished job or its replacement',()=>{
  const s=setup(1);let timeouts=0;
  const a=s.queue.enqueue({start(){},onTimeout:()=>timeouts++}),b=s.queue.enqueue({start(){}});s.flush();
  const stale=[...s.timers.values()][0];s.queue.complete(a);s.flush();stale();s.flush();
  assert.equal(a.state,'done');assert.equal(b.state,'running');assert.equal(timeouts,0);assert.equal(s.queue.snapshot().running,1);s.queue.destroy();assert.equal(s.timers.size,0);
});

test('destroying the queue from a startup callback prevents all later mounts',()=>{
  const s=setup();let started=0;
  s.queue.enqueue({start(){started++;s.queue.destroy();}});const b=s.queue.enqueue({start(){started++;}});
  s.flush();assert.equal(started,1);assert.equal(b.state,'canceled');assert.equal(s.timers.size,0);assert.equal(s.queue.snapshot().running,0);
});

test('throwing start and timeout callbacks do not block healthy players',()=>{
  const s=setup(1),started=[];
  s.queue.enqueue({start(){throw Error('mount failed');}});
  const stalled=s.queue.enqueue({start(){started.push('stalled');},onTimeout(){throw Error('timeout UI failed');}});
  const healthy=s.queue.enqueue({start(){started.push('healthy');}});s.flush();assert.equal(s.errors.length,1);
  [...s.timers.values()][0]();s.flush();assert.equal(stalled.state,'timedout');assert.equal(healthy.state,'running');
  assert.deepEqual(started,['stalled','healthy']);assert.equal(s.errors.length,2);s.queue.destroy();assert.equal(s.timers.size,0);
});

test('priority changes preserve FIFO among equal-priority jobs and never restart running mounts',()=>{
  const s=setup(1),started=[];
  const jobs=Array.from({length:8},(_,i)=>s.queue.enqueue({start:()=>started.push(i)}));s.flush();
  s.queue.prioritize(jobs[6]);s.queue.prioritize(jobs[4]);s.queue.prioritize(jobs[0]);
  s.queue.complete(jobs[0]);s.flush();assert.deepEqual(started,[0,4]);
  s.queue.complete(jobs[4]);s.flush();assert.deepEqual(started,[0,4,6]);s.queue.destroy();assert.equal(s.timers.size,0);
});
