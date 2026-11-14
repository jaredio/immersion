import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('player subscribers share one observer and ignore chat, text and owned chrome changes',async()=>{
  let dispatch,observes=0,disconnects=0;const calls=[];
  const context=vm.createContext({document:{},MutationObserver:class{constructor(cb){dispatch=cb;}observe(){observes++;}disconnect(){disconnects++;}}});
  vm.runInContext(await readFile('extension/player-dom.js','utf8'),context);
  assert.equal(observes,0,'loading the module does not observe a top-level page');
  const api=context.KickRefinedPlayerDOM;
  const a=api.subscribe(()=>calls.push('isolation')),b=api.subscribe(()=>calls.push('playback'));
  assert.equal(observes,1);
  const element={nodeType:1,matches:()=>false},text={nodeType:3};
  dispatch([{target:{closest:()=>({})},addedNodes:[element],removedNodes:[]}]);
  dispatch([{target:{},addedNodes:[text],removedNodes:[]}]);assert.deepEqual(calls,[]);
  dispatch([{target:{},addedNodes:[element],removedNodes:[]}]);assert.deepEqual(calls,['isolation','playback']);
  a();assert.equal(disconnects,0);b();assert.equal(disconnects,1);
});
