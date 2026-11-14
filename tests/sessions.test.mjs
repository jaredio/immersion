import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
async function setup(extra={}){
  const context=vm.createContext({URL,setTimeout,clearTimeout,...extra});
  for(const name of ['shared','session-data','multi-session'])vm.runInContext(await readFile(`extension/${name}.js`,'utf8'),context);
  return context;
}
test('two tabs cannot erase saved sessions through stale workspace snapshots',async()=>{
  const ctx=await setup();let stored={};
  const storage={get:async()=>structuredClone(stored),set:async patch=>{await new Promise(resolve=>setImmediate(resolve));Object.assign(stored,structuredClone(patch));}};
  const repository=ctx.KickRefinedSessionData.createRepository(storage);
  const a=ctx.KickRefinedMultiSession.create({storage,repository}),b=ctx.KickRefinedMultiSession.create({storage,repository});
  const stale=await b.load();
  await Promise.all([a.upsertSession({id:'a',name:'Alpha',state:{channels:['alpha']}}),b.upsertSession({id:'b',name:'Beta',state:{channels:['beta']}})]);
  b.save({...stale,multiToolbarHidden:true});await b.flush();
  assert.deepEqual(stored.multiSessions.map(item=>item.id).sort(),['a','b']);
  await a.deleteSession('a');
  b.save(stale);await b.flush();assert.deepEqual(stored.multiSessions.map(item=>item.id),['b'],'stale autosaves cannot resurrect deleted sessions');
  await a.destroy();await b.destroy();
});
test('late mutation replies cannot replace a newer synchronized session list',async()=>{
  let changed,reply;
  const storage={get:async()=>({}),set:async()=>{}};
  const browser={runtime:{sendMessage:()=>new Promise(resolve=>reply=resolve)},storage:{local:storage,onChanged:{addListener:fn=>changed=fn,removeListener(){}}}};
  const ctx=await setup({browser}),store=ctx.KickRefinedMultiSession.create();
  const pending=store.upsertSession({id:'a',name:'Alpha',state:{}});
  const newer=[{id:'b',name:'Beta',state:{}},{id:'a',name:'Alpha',state:{}}];
  changed({multiSessions:{newValue:newer}},'local');reply({ok:true,sessions:[newer[1]]});
  assert.deepEqual(Array.from(await pending,item=>item.id),['b','a']);await store.destroy();
});
test('legacy sessions have deterministic identities and concurrent same-name saves preserve identity',async()=>{
  const ctx=await setup(),data=ctx.KickRefinedSessionData;
  let stored={multiSessions:[{name:'Old session',state:{channels:['alpha']}}]};
  const storage={get:async()=>structuredClone(stored),set:async patch=>Object.assign(stored,structuredClone(patch))};
  const id=data.normalize(stored.multiSessions)[0].id;
  assert.equal(data.normalize(stored.multiSessions)[0].id,id);
  const repo=data.createRepository(storage);
  await Promise.all([repo.mutate({action:'upsert',session:{id:'new-a',name:'Old session',state:{channels:['beta']}}}),repo.mutate({action:'upsert',session:{id:'new-b',name:'Other session',state:{channels:['other']}}})]);
  assert.equal(stored.multiSessions.find(item=>item.name==='Old session').id,id);
  assert.equal(stored.multiSessions.length,2);
});

test('background session mutations reject unrelated senders and recover after invalid operations',async()=>{
  let handler,stored={},writes=0;
  const browser={runtime:{id:'test-extension',onMessage:{addListener:fn=>handler=fn}},storage:{local:{get:async()=>structuredClone(stored),set:async patch=>{writes++;Object.assign(stored,structuredClone(patch));}}}};
  const ctx=await setup({browser});vm.runInContext(await readFile('extension/session-background.js','utf8'),ctx);
  const message={type:'immersion:session-mutation',operation:{action:'upsert',session:{id:'a',name:'Alpha',state:{}}}};
  const sender={id:'test-extension',tab:{id:1},url:'https://kick.com/example'};
  assert.equal(handler(message,{...sender,url:'https://evil.test/'},()=>assert.fail('untrusted sender replied')),undefined);
  assert.equal(handler(message,{...sender,id:'another-extension'},()=>assert.fail('wrong extension replied')),undefined);
  const send=operation=>new Promise(resolve=>{assert.equal(handler({...message,operation},sender,resolve),true);});
  assert.equal((await send({action:'unknown'})).ok,false);
  assert.equal((await send(message.operation)).ok,true);assert.equal(writes,1);
  assert.equal(stored.multiSessions[0].id,'a');
});
