import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {extensionWorker} from '../tools/extension-worker.mjs';

test('the Chrome worker loads shared modules in the same dependency order as Firefox',async()=>{
  const dependencies=[];
  const src=await readFile('extension/background.js','utf8');
  const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));
  vm.runInNewContext(src,{importScripts:(...scripts)=>dependencies.push(...scripts)});
  assert.deepEqual(dependencies,manifest.background.scripts.filter(file=>!['support-data.js','support-background.js'].includes(file)));
});

test('browser harness waits for both worker bindings and script initialization',async()=>{
  let checks=0;const worker={url:()=> 'chrome-extension://test/background.js',evaluate:async()=>++checks>=3};
  const result=await extensionWorker({serviceWorkers:()=>[worker]},{pollMs:0});assert.equal(result,worker);assert.equal(checks,3);
});

test('browser harness ignores unrelated service workers and filters newly created workers',async()=>{
  const worker={url:()=> 'chrome-extension://test/background.js',evaluate:async()=>true};let waits=0;
  const context={serviceWorkers:()=>[{url:()=> 'https://kick.com/service-worker.js'}],waitForEvent:async(type,{predicate})=>{
    waits++;assert.equal(type,'serviceworker');assert.equal(predicate({url:()=> 'https://other.test/worker.js'}),false);assert.equal(predicate(worker),true);return worker;
  }};
  assert.equal(await extensionWorker(context),worker);assert.equal(waits,1);
});

test('browser harness fails clearly when extension APIs never initialize',async()=>{
  const worker={url:()=> 'chrome-extension://test/background.js',evaluate:async()=>false};
  await assert.rejects(extensionWorker({serviceWorkers:()=>[worker]},{timeout:0}),/did not initialize/);
});

test('browser harness surfaces closed-worker errors without hiding them as retries',async()=>{
  const worker={url:()=> 'chrome-extension://test/background.js',evaluate:async()=>{throw Error('worker closed');}};
  await assert.rejects(extensionWorker({serviceWorkers:()=>[worker]}),/worker closed/);
});
