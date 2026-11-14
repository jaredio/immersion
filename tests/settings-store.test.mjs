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
