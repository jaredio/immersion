import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function contextFor(file,extra={}){
  const context=vm.createContext({URL,setTimeout,clearTimeout,...extra});
  vm.runInContext(await readFile('extension/shared.js','utf8'),context);
  vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),context);
  return context;
}

test('workspace saves coalesce bursts, preserve write order and recover after storage failure',async()=>{
  const context=await contextFor('multi-session');
  const writes=[],releases=[];let failed=false,errors=0;
  const storage={get:async()=>({}),set:async data=>{writes.push(data);await new Promise(resolve=>releases.push(resolve));if(failed){failed=false;throw Error('storage unavailable');}}};
  const store=context.KickRefinedMultiSession.create({storage,onError:()=>errors++,delay:60000});
  for(let i=0;i<100;i++)store.save({multiVolume:i/100,multiview:{channels:['a','b']}});
  const first=store.flush();await tick();
  assert.equal(writes.length,1);assert.equal(writes[0].multiVolume,.99);
  store.save({multiVolume:.4,multiview:{channels:['b','c']}});
  const second=store.flush();await tick();assert.equal(writes.length,1,'a slow storage write is never overtaken');
  releases.shift()();await first;await tick();assert.equal(writes.length,2);
  failed=true;releases.shift()();await second;assert.equal(errors,1);
  store.save({multiVolume:.7,multiview:{channels:['c','d']}});
  const destroyed=store.destroy();await tick();assert.equal(writes.at(-1).multiVolume,.7,'teardown flushes the latest pending state');
  store.save({multiVolume:.1});releases.shift()();await destroyed;
  assert.equal(writes.length,3,'disposed stores reject late writes');
});

test('metadata requests deduplicate, recover independently and ignore late responses after teardown',async()=>{
  const context=await contextFor('multi-metadata');
  let reads=0,panelReads=0,channelChanges=0,panelChanges=0,release;
  const service=context.KickRefinedMultiMetadata.create({
    support:{channel:async slug=>{reads++;if(slug==='bad')throw Error('unavailable');if(slug==='late')await new Promise(resolve=>release=resolve);return {title:slug};},panels:async()=>{panelReads++;return []; }},
    isWanted:()=>true,onChannel:()=>channelChanges++,onPanels:()=>panelChanges++
  });
  service.requestChannel('a');service.requestChannel('a');await tick();
  service.requestChannel('a');await tick();assert.equal(reads,1);assert.equal(service.channel('a').title,'a');
  service.requestChannel('bad');service.requestChannel('b');await tick();
  assert.equal(service.channel('bad'),null);assert.equal(service.channel('b').title,'b');
  service.requestPanels('a');service.requestPanels('a');await tick();assert.equal(panelReads,1);assert.equal(panelChanges,1);
  service.requestChannel('late');await tick();service.destroy();release();await tick();
  assert.equal(service.channel('late'),undefined);assert.equal(channelChanges,2,'late completions do not render disposed workspaces');
});

test('player bus rejects spoofed, stale and detached messages while preserving the handshake',async()=>{
  let listener;const sent=[],events=[];
  const window={addEventListener:(type,fn)=>listener=fn,removeEventListener:(type,fn)=>{assert.equal(fn,listener);listener=null;}};
  const context=await contextFor('multi-player-bus',{window,crypto:{randomUUID:()=> 'test-session'}});
  let active=true;
  const bus=context.KickRefinedMultiPlayerBus.create({isActive:()=>active,onReady:()=>events.push('ready'),onStatus:()=>events.push('status'),onAudioIntent:()=>events.push('audio'),onFocus:()=>events.push('focus'),onHover:()=>events.push('hover'),onClip:()=>events.push('clip')});
  const source={postMessage:(data,origin)=>sent.push({data,origin})};
  const tile={frame:{contentWindow:source},frameOrigin:'https://kick.com',commandRevision:bus.nextRevision()};bus.attach(tile);
  const send=(data,overrides={})=>listener({source,origin:'https://kick.com',data:{session:'test-session',revision:tile.commandRevision,...data},...overrides});
  send({type:'kick-refined:ready'});bus.send(tile,{muted:true,volume:.4});assert.equal(sent[0].data.session,'test-session');
  send({type:'kick-refined:status'});assert.deepEqual(events,['ready','status']);
  send({type:'kick-refined:status'},{source:{}});send({type:'kick-refined:status'},{origin:'https://evil.test'});
  send({type:'kick-refined:status',session:'wrong'});send({type:'kick-refined:status',revision:0});
  send({type:'kick-refined:audio-intent',muted:'false',volume:.5});send({type:'kick-refined:audio-intent',muted:false,volume:NaN});
  assert.equal(events.length,2);
  send({type:'kick-refined:audio-intent',muted:false,volume:.5});assert.equal(events.at(-1),'audio');
  send({type:'kick-refined:clip'},{source:{}});send({type:'kick-refined:clip',session:'wrong'});assert.equal(events.length,3);send({type:'kick-refined:clip'});assert.equal(events.at(-1),'clip');active=false;send({type:'kick-refined:clip'});active=true;bus.detach(tile);send({type:'kick-refined:ready'});assert.equal(events.length,4);
  bus.destroy();assert.equal(listener,null);
});

test('layout scheduling coalesces frames and restores original native styles',async()=>{
  const frames=new Map();let next=0,runs=0,active=true;
  const context=await contextFor('multi-layout',{
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},
    cancelAnimationFrame:id=>frames.delete(id)
  });
  const scheduler=context.KickRefinedMultiLayout.createScheduler({isActive:()=>active,run:()=>runs++});
  for(let i=0;i<50;i++)scheduler.schedule();assert.equal(frames.size,1);
  const run=[...frames.values()][0];frames.clear();run();assert.equal(runs,1);
  active=false;scheduler.schedule();assert.equal(frames.size,0);
  active=true;scheduler.schedule();scheduler.destroy();assert.equal(frames.size,0);
  scheduler.schedule();assert.equal(frames.size,0);
  const values=new Map([['display',{value:'flex',priority:'important'}]]);
  const element={style:{getPropertyValue:key=>values.get(key)?.value||'',getPropertyPriority:key=>values.get(key)?.priority||'',setProperty:(key,value,priority)=>values.set(key,{value,priority}),removeProperty:key=>values.delete(key)}};
  const layout=context.KickRefinedMultiLayout.createStyles();
  layout.style(element,'display','none');layout.style(element,'display','block');layout.style(element,'left','100px');
  assert.equal(layout.originalStyle(element,'display').value,'flex');layout.restoreStyles();
  assert.deepEqual(values.get('display'),{value:'flex',priority:'important'});assert.equal(values.has('left'),false);
  assert.equal(layout.originalStyle(element,'display'),undefined,'restoration releases native node references');
});
