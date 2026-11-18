import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';

const source=await readFile('extension/clip-bridge.js','utf8');
const href='https://kick.com/native/clips/clip_01M5VG3B8WEFY068DP0GCHKSGW';
const id=href.split('/').at(-1);
const kick='https://kick.com',www='https://www.kick.com';
function setup({asParent=false,options={}}={}){
  const window=new EventTarget(),messages=[],timers=new Map(),canvases=new Set();
  const peer={postMessage:(data,origin)=>messages.push({data,origin})};
  window.parent=asParent?window:peer;
  let sequence=0;
  const context=vm.createContext({URL,window,location:{origin:kick},crypto:{randomUUID:()=>`transfer-${++sequence}`},
    setTimeout:fn=>{const timer=++sequence;timers.set(timer,fn);return timer;},clearTimeout:timer=>timers.delete(timer),
    document:{referrer:www+'/native',createElement:()=>({style:{},remove(){canvases.delete(this);}}),body:{append:canvas=>canvases.add(canvas)}},
    KickRefinedClips:{parseClip:value=>value===href?{href,id}:null}});
  vm.runInContext(source,context);
  const bridge=context.KickRefinedClipBridge.create(typeof options==='function'?options(peer):options);
  return {bridge,messages,timers,canvases,send(type,token,extra={},origin=www,sender=peer){
    window.dispatchEvent(Object.assign(new Event('message'),{data:{type:`immersion:clip-${type}`,token,...extra},origin,source:sender}));
  }};
}

function item(){
  const state={href,paused:false,time:2},resumed=[];let freezes=0,accepts=0;
  return {href,state,resumed,counts:()=>[freezes,accepts],freeze(){freezes++;return freezes===1?state:{...state,paused:true};},resume:value=>resumed.push(value),accepted:()=>accepts++};
}

test('child snapshots remain stable across duplicate requests and resume after rejection',()=>{
  const ctx=setup(),clip=item();ctx.bridge.add(clip);
  const {data:{token},origin}=ctx.messages[0];assert.equal(origin,www);
  ctx.send('snapshot-request',token,{},kick);assert.equal(ctx.messages.length,1);
  ctx.send('snapshot-request',token);ctx.send('snapshot-request',token);
  assert.deepEqual(ctx.messages.map(({data})=>data.state),[clip.state,clip.state,clip.state]);
  ctx.send('transfer-result',token,{ok:false});ctx.send('transfer-result',token,{ok:true});
  assert.deepEqual(clip.counts(),[1,0]);assert.deepEqual(clip.resumed,[clip.state]);assert.equal(ctx.timers.size,0);
  ctx.bridge.destroy();ctx.bridge.add(clip);assert.equal(ctx.messages.length,3);
});

for(const cleanup of ['dragend','timeout','destroy'])test(`child releases the drag canvas on ${cleanup}`,()=>{
  const ctx=setup(),clip=item(),target=new EventTarget();
  ctx.bridge.drag({target,dataTransfer:{setDragImage:canvas=>assert.ok(ctx.canvases.has(canvas))},clientX:10,clientY:20},clip);
  assert.equal(ctx.canvases.size,1);
  if(cleanup==='dragend')target.dispatchEvent(new Event('dragend'));
  else if(cleanup==='timeout')[...ctx.timers.values()][0]();
  else ctx.bridge.destroy();
  assert.equal(ctx.canvases.size,0);
  target.dispatchEvent(new Event('dragend'));
  assert.equal(ctx.messages.filter(({data})=>data.type==='immersion:clip-drag-end').length,cleanup==='dragend'?1:0);
  ctx.bridge.destroy();assert.equal(ctx.timers.size,0);
});

test('parent imports only the expected clip frame snapshot and releases a failed tile',async()=>{
  let drag,releases=0,installs=0;
  const ctx=setup({asParent:true,options:peer=>({
    multi:{isChatSource:source=>source===peer,chatFrameRect:()=>({left:100,top:50}),canAddClip:key=>key===id,
      async addClip(item,mode){installs++;assert.equal(mode,'alongside');return false;}},
    startDrag:(event,value)=>{drag=value;},getClips:()=>({importItem:()=>({release:()=>releases++})})
  })});
  ctx.send('drag-start','token',{href,x:20,y:5});assert.equal(drag.x,120);assert.equal(drag.y,55);
  drag.commit('alongside');drag.commit('alongside');assert.equal(ctx.messages.length,1);
  ctx.send('snapshot','token',{state:{href}},kick);
  ctx.send('snapshot','token',{state:{href}},www,{});
  assert.equal(installs,0);
  ctx.send('snapshot','token',{state:{href}});await setImmediate();
  assert.equal(installs,1);assert.equal(releases,1);assert.equal(ctx.messages.at(-1).data.ok,false);assert.equal(ctx.timers.size,0);
  ctx.bridge.destroy();
});
