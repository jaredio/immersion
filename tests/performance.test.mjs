import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('broadcast uptime uses UTC metadata and is independent of player playback time',async()=>{
  const context=vm.createContext({Date});
  vm.runInContext(await readFile('extension/stream-clock.js','utf8'),context);
  const clock=context.KickRefinedStreamClock,start=clock.parse('2026-01-02 03:04:05');
  assert.equal(start,Date.parse('2026-01-02T03:04:05Z'));
  assert.equal(clock.parse('2026-01-02T05:04:05+02:00'),start);
  assert.equal(clock.format(start,start+3*3600000+12*60000+34000),'3:12:34');
  assert.equal(clock.parse('invalid'),null);assert.equal(clock.parse('2999-01-01T00:00:00Z'),null);
  assert.equal(clock.format(null),'');
  vm.runInContext(await readFile('extension/shared.js','utf8'),context);
  assert.equal(context.KickRefined.channelDetails({slug:'a',livestream:{start_time:'2026-01-02 03:04:05',is_live:true}},'a').startedAt,start);
  assert.equal(context.KickRefined.channelDetails({slug:'a',livestream:null},'a').startedAt,null);
});

test('diagnostics are opt-in, bounded, local and cleared when disabled',async()=>{
  let observations=0,disconnections=0;
  const context=vm.createContext({Date,PerformanceObserver:class{observe(){observations++;}disconnect(){disconnections++;}}});
  vm.runInContext(await readFile('extension/performance.js','utf8'),context);
  const perf=context.KickRefinedPerf;perf.count('test.work');assert.deepEqual(Object.keys(perf.snapshot().counters),[]);
  perf.configure(true);perf.count('test.work');perf.count('https://private.example/token');
  for(let i=0;i<1000;i++){perf.count('counter'+i);perf.sample('test.ms',i);}
  const result=perf.snapshot();assert.equal(Object.keys(result.counters).length,64);assert.equal(result.timings['test.ms'].samples,256);
  assert.equal(result.counters['test.work'],1);assert.equal(observations,1);
  perf.configure(false);assert.equal(disconnections,1);assert.equal(Object.keys(perf.snapshot().counters).length,0);
});

test('full-player startup is prioritized, concurrency-limited and cancelable',async()=>{
  const context=vm.createContext({queueMicrotask,performance,setTimeout,clearTimeout});
  vm.runInContext(await readFile('extension/multi-startup.js','utf8'),context);
  const queue=context.KickRefinedMultiStartup.create(),started=[];
  const jobs=Array.from({length:6},(_,index)=>queue.enqueue({priority:index===4?0:1,start:()=>started.push(index)}));
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(started,[4,0]);assert.equal(queue.snapshot().running,2);
  queue.cancel(jobs[5]);queue.prioritize(jobs[3]);queue.complete(jobs[4]);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(started,[4,0,3]);assert.equal(queue.snapshot().running,2);
  queue.destroy();await new Promise(resolve=>setImmediate(resolve));assert.equal(queue.snapshot().running,0);assert.equal(queue.snapshot().queued,0);
  assert.equal(queue.enqueue({start:()=>assert.fail()}),null);
});

test('per-pane lightweight choices are validated and retained in shared sessions',async()=>{
  const context=vm.createContext({URL});vm.runInContext(await readFile('extension/shared.js','utf8'),context);
  const state=context.KickRefined.multiState({channels:['a','b'],playerModes:{a:'embed',b:'full',c:'embed'}});
  const special=context.KickRefined.multiState({channels:['constructor','__proto__']});assert.equal(special.playerModes.constructor,undefined);assert.equal(Object.getPrototypeOf(special.playerModes),null);
  assert.equal(state.playerMode,'full');assert.deepEqual(JSON.parse(JSON.stringify(state.playerModes)),{a:'embed',b:'full'});
  assert.deepEqual(JSON.parse(new URL(context.KickRefined.multiURL(state)).searchParams.get('immersion-players')),{a:'embed',b:'full'});
});

test('a stalled initialization times out independently of video-element discovery',async()=>{
  const timers=new Map();let next=0,starts=0,timeouts=0;
  const context=vm.createContext({queueMicrotask,performance,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(await readFile('extension/multi-startup.js','utf8'),context);
  const queue=context.KickRefinedMultiStartup.create({limit:1});
  const stalled=queue.enqueue({start:job=>{job.hasVideoElement=true;starts++;},onTimeout:()=>timeouts++});
  queue.enqueue({start:()=>starts++});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(starts,1);[...timers.values()][0]();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stalled.state,'timedout');assert.equal(timeouts,1);assert.equal(starts,2,'queued players are not stuck behind a non-decoding video element');
  queue.destroy();assert.equal(timers.size,0);
});
