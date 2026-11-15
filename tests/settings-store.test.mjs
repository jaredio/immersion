import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
async function setup(extra={}){const ctx=vm.createContext({URL,setTimeout,clearTimeout,...extra});for(const name of ['shared','settings-store'])vm.runInContext(await readFile(`extension/${name}.js`,'utf8'),ctx);return ctx;}
test('serialized settings patches from different tabs preserve unrelated keys and recover from errors',async()=>{
  const ctx=await setup();let stored={},fail=false;
  const storage={get:async()=>structuredClone(stored),set:async patch=>{await new Promise(resolve=>setImmediate(resolve));if(fail){fail=false;throw Error('storage');}Object.assign(stored,structuredClone(patch));}};
  const repo=ctx.KickRefinedSettings.createRepository(storage);
  await Promise.all([repo.patch({accent:'blue'}),repo.patch({chatWidth:400})]);assert.equal(stored.settings.accent,'blue');assert.equal(stored.settings.chatWidth,400);
  fail=true;await assert.rejects(repo.patch({fontSize:16}));await repo.patch({textOnly:true,unknown:'ignored'});assert.equal(stored.settings.textOnly,true);assert.equal(stored.settings.unknown,undefined);
});
test('incoming settings cannot erase local edits awaiting persistence',async()=>{
  let stored={},latest;const api={runtime:{},storage:{local:{get:async()=>structuredClone(stored),set:async patch=>Object.assign(stored,structuredClone(patch))}}};
  const ctx=await setup(),store=ctx.KickRefinedSettings.create({api,onUpdate:value=>latest=value,delay:60000});
  store.accept({accent:'mint'});store.patch({chatWidth:400});store.accept({accent:'blue'});assert.equal(latest.chatWidth,400);assert.equal(latest.accent,'blue');
  stored.settings={accent:'blue'};await store.flush();assert.equal(stored.settings.chatWidth,400);assert.equal(stored.settings.accent,'blue');await store.destroy();
});

test('save failure restores committed UI values and later success clears the failure state',async()=>{
  let fail=true,latest,saved=0,errors=0;const api={runtime:{},storage:{local:{get:async()=>({settings:{accent:'mint'}}),set:async()=>{if(fail)throw Error('storage');}}}};
  const ctx=await setup(),store=ctx.KickRefinedSettings.create({api,delay:60000,onUpdate:value=>latest=value,onError:()=>errors++,onSaved:()=>saved++});
  store.accept({accent:'mint'});store.patch({accent:'blue'});await store.flush();assert.equal(errors,1);assert.equal(saved,0);assert.equal(latest.accent,'mint');
  fail=false;store.patch({accent:'blue'});await store.flush();assert.equal(saved,1);assert.equal(latest.accent,'blue');await store.destroy();
});

test('settings worker accepts only own popup or Kick tabs and ignores unknown keys',async()=>{
  let listener,stored={};const browser={runtime:{id:'extension',getURL:file=>'chrome-extension://extension/'+file,onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>structuredClone(stored),set:async patch=>Object.assign(stored,structuredClone(patch))}}};
  const ctx=await setup({browser});vm.runInContext(await readFile('extension/settings-background.js','utf8'),ctx);
  const message={type:'immersion:settings-patch',patch:{accent:'blue',unexpected:'ignored'}};
  assert.equal(listener(message,{id:'extension',url:'https://evil.test',tab:{id:1}},()=>assert.fail()),undefined);
  const result=await new Promise(resolve=>listener(message,{id:'extension',url:'chrome-extension://extension/popup.html'},resolve));
  assert.equal(result.ok,true);assert.equal(stored.settings.accent,'blue');assert.equal(stored.settings.unexpected,undefined);
});

test('no-op settings patches avoid disk writes and cross-tab change broadcasts',async()=>{
  const ctx=await setup();let settings={accent:'blue',pinned:['alpha']},writes=0;
  const storage={get:async()=>({settings:structuredClone(settings)}),set:async value=>{writes++;settings=structuredClone(value.settings);}};
  const repo=ctx.KickRefinedSettings.createRepository(storage);
  await repo.patch({accent:'blue'});await repo.patch({pinned:['ALPHA','alpha']});await repo.patch({unknown:true});
  assert.equal(writes,0);
  await Promise.all([repo.patch({accent:'violet'}),repo.patch({accent:'violet'}),repo.patch({chatWidth:400}),repo.patch({chatWidth:400})]);
  assert.equal(writes,2);assert.equal(settings.accent,'violet');assert.equal(settings.chatWidth,400);
});

test('queued settings writes read current storage before deciding a patch is unchanged',async()=>{
  const ctx=await setup();let settings={accent:'mint'},writes=0;
  const storage={get:async()=>({settings:structuredClone(settings)}),set:async value=>{writes++;settings=structuredClone(value.settings);}};
  const repo=ctx.KickRefinedSettings.createRepository(storage);
  await repo.patch({accent:'blue'});settings={...settings,accent:'violet',fontSize:18};
  const result=await repo.patch({accent:'blue'});assert.equal(result.accent,'blue');assert.equal(result.fontSize,18);assert.equal(writes,2);
});

test('an old settings reply cannot overwrite newer storage events or pending optimistic edits',async()=>{
  const ctx=await setup(),replies=[],sent=[];let latest;
  const api={runtime:{sendMessage:message=>{sent.push(message);return new Promise(resolve=>replies.push(resolve));}}};
  const store=ctx.KickRefinedSettings.create({api,delay:60000,onUpdate:value=>latest=value});
  store.accept({accent:'mint'});store.patch({accent:'blue'});const first=store.flush();await new Promise(resolve=>setImmediate(resolve));
  store.patch({fontSize:18});store.accept({accent:'violet',chatWidth:420});
  replies.shift()({ok:true,settings:{accent:'blue'}});await first;
  assert.equal(latest.accent,'violet');assert.equal(latest.chatWidth,420);assert.equal(latest.fontSize,18);
  const second=store.flush();await new Promise(resolve=>setImmediate(resolve));
  replies.shift()({ok:true,settings:{accent:'violet',chatWidth:420,fontSize:18}});await second;
  assert.equal(sent.length,2);assert.equal(sent[1].patch.fontSize,18);assert.equal(sent[1].patch.accent,undefined);await store.destroy();
});

test('destroy flushes pending settings once and suppresses late rendering and saved callbacks',async()=>{
  const ctx=await setup();let reply,updates=0,saved=0;
  const api={runtime:{sendMessage:()=>new Promise(resolve=>reply=resolve)}};
  const store=ctx.KickRefinedSettings.create({api,delay:60000,onUpdate:()=>updates++,onSaved:()=>saved++});
  store.patch({accent:'blue'});const closing=store.destroy();await new Promise(resolve=>setImmediate(resolve));
  store.patch({accent:'violet'});store.accept({accent:'neutral'});reply({ok:true,settings:{accent:'blue'}});await closing;
  await store.destroy();assert.equal(updates,1);assert.equal(saved,0);
});

test('failed saves roll back only the failed patch while later optimistic edits remain visible',async()=>{
  const ctx=await setup(),replies=[];let latest,errors=0;
  const store=ctx.KickRefinedSettings.create({api:{runtime:{sendMessage:()=>new Promise(resolve=>replies.push(resolve))}},delay:60000,onUpdate:value=>latest=value,onError:()=>errors++});
  store.accept({accent:'mint'});store.patch({accent:'blue'});const first=store.flush();await new Promise(resolve=>setImmediate(resolve));
  store.patch({fontSize:18});const second=store.flush();replies.shift()({ok:false});await first;
  assert.equal(latest.accent,'mint');assert.equal(latest.fontSize,18);assert.equal(errors,1);await new Promise(resolve=>setImmediate(resolve));
  replies.shift()({ok:true,settings:{accent:'mint',fontSize:18}});await second;assert.equal(latest.fontSize,18);await store.destroy();
});
