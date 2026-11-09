import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function setup(){
  const timers=new Map(),frames=new Map();let next=0;
  const context=vm.createContext({AggregateError,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)});
  for(const file of ['lifetime.js','player-state.js'])vm.runInContext(await readFile(`extension/${file}`,'utf8'),context);
  return {...context,timers,frames};
}
test('nested pane lifetimes release listeners and scheduled work across repeated disposal',async()=>{
  const {KickRefinedLifetime:life,timers,frames}=await setup();
  let attached=0,calls=0;const target={addEventListener(){attached++;},removeEventListener(){attached--;}};
  for(let cycle=0;cycle<100;cycle++){
    const root=life.create(),pane=root.child(),mount=pane.child();
    mount.listen(target,'event',()=>calls++);mount.timeout(()=>calls++,10);mount.frame(()=>calls++);
    const stale=mount.guard(()=>calls++);
    if(cycle%2)pane.dispose();root.dispose();pane.dispose();mount.dispose();stale();
    assert.equal(attached,0);assert.equal(timers.size,0);assert.equal(frames.size,0);
    assert.deepEqual(JSON.parse(JSON.stringify(life.snapshot())),{scopes:0,resources:0});
  }
  assert.equal(calls,0);
});
test('completed work unlinks itself; cleanup continues after a failing disposer',async()=>{
  const {KickRefinedLifetime:life,timers}=await setup();const scope=life.create();let done=0;
  scope.timeout(()=>done++,10);[...timers.values()][0]();assert.equal(done,1);assert.equal(life.snapshot().resources,0);
  scope.defer(()=>done++);scope.defer(()=>{throw Error('cleanup');});
  assert.throws(()=>scope.dispose(),/Resource cleanup failed/);assert.equal(done,2);assert.equal(life.snapshot().resources,0);
});
test('player states reject replaced generations and preserve playback intent across retries',async()=>{
  const {KickRefinedPlayerState:players}=await setup();const state=players.create();
  const first=state.begin('full',{queued:true});assert.equal(state.phase,'queued');state.start(first);
  state.status({hasVideo:true,playing:true,readyState:0,fullPlayerIsolated:true});assert.equal(state.phase,'loading');
  state.fail(first);assert.equal(state.phase,'failed');assert.equal(state.playing,true);
  const replacement=state.begin('embed',{retrying:true});assert.equal(state.phase,'retrying');
  assert.equal(state.status({hasVideo:true,playing:false,readyState:4},{token:first}),false);assert.equal(state.playing,true);
  state.start(replacement);state.status({hasVideo:true,playing:false,readyState:4});assert.equal(state.phase,'ready');
  state.dispose();assert.equal(state.status({playing:true}),false);assert.equal(state.begin('full'),null);assert.equal(state.phase,'disposed');
});
test('offline and autoplay-blocked players have distinct terminal startup states',async()=>{
  const {KickRefinedPlayerState:players}=await setup();const state=players.create();state.begin('full');
  state.status({hasVideo:false,fullPlayerIsolated:false},{live:'offline'});assert.equal(state.phase,'loading');
  state.status({hasVideo:false,fullPlayerIsolated:true},{live:'offline'});assert.equal(state.phase,'offline');
  state.begin('full');state.status({hasVideo:true,readyState:4,fullPlayerIsolated:true,error:'NotAllowedError'});assert.equal(state.phase,'blocked');
  state.status({hasVideo:true,readyState:4,fullPlayerIsolated:true,playing:true});assert.equal(state.phase,'ready');
});
