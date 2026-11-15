import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context=vm.createContext({});vm.runInContext(await readFile('extension/channel-offline.js','utf8'),context);
function setup(){
  const attributes=new Map();let writes=0,queries=0;
  const main={getAttribute:name=>attributes.get(name)??null,setAttribute:(name,value)=>{writes++;attributes.set(name,value);},removeAttribute:name=>{writes++;attributes.delete(name);},querySelectorAll:()=>{queries++;return [];}};
  const view=context.KickRefinedOffline.create();return {main,view,attributes,get writes(){return writes;},get queries(){return queries;}};
}

for(const live of [undefined,'unknown','live']){
  test(`an unconfirmed offline avatar with metadata ${live} cannot restyle a channel`,()=>{
    const s=setup();assert.equal(s.view.refresh({main:s.main,slug:'creator',nativeLive:'offline',live}),false);assert.equal(s.attributes.size,0);
  });
}

test('confirmed offline metadata enables the surface even without a banner or category shelf',()=>{
  const s=setup();assert.equal(s.view.refresh({main:s.main,slug:'creator',nativeLive:'offline',live:'offline'}),true);
  assert.equal(s.attributes.get('data-kr-channel-offline'),'');s.view.destroy();assert.equal(s.attributes.size,0);
});

test('a native live transition overrides stale offline metadata and skips offline DOM scans',()=>{
  const s=setup();s.view.refresh({main:s.main,slug:'creator',live:'offline'});const before=s.queries;
  assert.equal(s.view.refresh({main:s.main,slug:'creator',nativeLive:'live',live:'offline'}),false);
  assert.equal(s.queries,before);assert.equal(s.attributes.size,0);
});

test('repeated offline refreshes do not write unchanged DOM attributes',()=>{
  const s=setup();for(let i=0;i<500;i++)s.view.refresh({main:s.main,slug:'creator',live:'offline'});
  assert.equal(s.writes,1);s.view.clear();s.view.clear();assert.equal(s.writes,2);
});

test('offline teardown restores previous attribute values and releases retired main nodes',()=>{
  const s=setup();s.attributes.set('data-kr-channel-offline','previous');s.view.refresh({main:s.main,slug:'creator',live:'offline'});
  s.view.refresh({});assert.equal(s.attributes.get('data-kr-channel-offline'),'previous');const before=s.writes;
  s.view.destroy();assert.equal(s.writes,before,'retired main nodes are no longer retained for teardown');
});
