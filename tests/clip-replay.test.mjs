import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';

const sources=await Promise.all(['clip-tools','clip-replay'].map(file=>readFile(`extension/${file}.js`,'utf8')));
const startedAt=Date.parse('2026-11-15T00:00:00Z');
const message=(id,time,content=id)=>({id,created_at:new Date(startedAt+time*1000).toISOString(),content});
const payload=(...messages)=>Response.json({data:{messages}});

class Element extends EventTarget {
  children=[];
  parent=null;
  style={};
  get firstChild(){return this.children[0]??null;}
  get nextSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]??null;}
  get scrollHeight(){return this.children.length*10;}
  scrollTop=0;
  clientHeight=50;
  constructor(text=''){super();this.textContent=text;}
  setAttribute(){}
  append(...nodes){for(const node of nodes)this.insertBefore(node,null);}
  insertBefore(node,before){
    node.remove();node.parent=this;
    this.children.splice(before===null?this.children.length:this.children.indexOf(before),0,node);
  }
  remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
  replaceWith(node){this.parent?.insertBefore(node,this);this.remove();}
}

function setup(fetch,{initial=0,duration=120,abort=new AbortController()}={}){
  const container=new Element(),video=Object.assign(new EventTarget(),{currentTime:initial,duration}),calls=[];
  const document={createElement:()=>new Element(),createTextNode:text=>new Element(text)};
  const context=vm.createContext({document,AbortController,AbortSignal,URL,KickRefined:{readText:response=>response.text()},fetch(url,options){
    const start=new URL(url).searchParams.get('start_time'),bucket=(Date.parse(start)-startedAt)/5000;
    calls.push({bucket,options});return fetch(bucket,options);
  }});
  for(const source of sources)vm.runInContext(source,context);
  let closes=0;
  const controller=context.KickRefinedClipReplay.create({container,video,data:{replay:{startedAt,channelId:42},duration},signal:abort.signal,onClose:()=>closes++});
  const [pane]=container.children;
  return {abort,container,calls,controller,pane,list:pane?.children[1],status:pane?.children[2],retry:pane?.children[3],closes:()=>closes,
    seek(value,type='seeking'){video.currentTime=value;video.dispatchEvent(new Event(type));}};
}
const texts=list=>list.children.map(row=>row.children[3].textContent);

test('replay includes exact timestamps, deduplicates overlapping pages and preserves row identity through seeks',async()=>{
  const replay=setup(bucket=>bucket===0?payload(message('zero',0),message('five',5,'five [emote:3:Wave]')):payload(message('five',5,'five [emote:3:Wave]'),message('ten',10)));
  await setImmediate();assert.deepEqual(texts(replay.list),['zero']);
  const first=replay.list.firstChild;
  replay.seek(5,'timeupdate');await setImmediate();assert.deepEqual(texts(replay.list),['zero','five ']);
  const emote=replay.list.children[1].children[4];assert.equal(emote.alt,'Wave');
  replay.seek(10);await setImmediate();assert.deepEqual(texts(replay.list),['zero','five ','ten']);
  assert.equal(replay.list.firstChild,first);assert.equal(replay.list.children[1].children[4],emote);
  emote.dispatchEvent(new Event('error'));assert.equal(replay.list.children[1].children[4].textContent,'Wave');
  replay.seek(0);assert.deepEqual(texts(replay.list),['zero']);assert.equal(replay.list.firstChild,first);
  replay.pane.children[0].children[1].dispatchEvent(new Event('click'));assert.equal(replay.closes(),1);
  assert.ok(replay.calls.every(({options})=>options.credentials==='omit'&&options.referrerPolicy==='no-referrer'));
  replay.controller.destroy();assert.equal(replay.container.children.length,0);
});

test('replay keeps the most recent 200 rows and drops old rows past the 60-second boundary',async()=>{
  const messages=Array.from({length:251},(_,i)=>message(String(i),i===0?0:59+i/1000));
  const replay=setup(bucket=>bucket===12?payload(...messages):payload(),{initial:60});
  await setImmediate();assert.equal(replay.list.children.length,200);
  assert.equal(texts(replay.list)[0],'51');assert.equal(texts(replay.list).at(-1),'250');
  replay.seek(119.21);await setImmediate();assert.equal(texts(replay.list)[0],'210');assert.equal(replay.list.children.length,41);
  replay.seek(120);assert.equal(replay.list.children.length,0);replay.controller.destroy();
});

test('seeking prefers the current replay bucket over previously queued speculative work',async()=>{
  const releases=new Map();
  const replay=setup(bucket=>new Promise(resolve=>releases.set(bucket,resolve)),{initial:5});
  assert.deepEqual(replay.calls.map(call=>call.bucket),[1,0]);
  replay.seek(15);releases.get(0)(payload());await setImmediate();
  assert.deepEqual(replay.calls.map(call=>call.bucket),[1,0,3]);
  releases.get(1)(payload());await setImmediate();
  assert.deepEqual(replay.calls.map(call=>call.bucket),[1,0,3,2]);
  replay.abort.abort();assert.equal(replay.container.children.length,0);
  assert.ok(replay.calls.at(-1).options.signal.aborted);
  releases.get(3)(payload());releases.get(2)(payload());await setImmediate();
  assert.equal(replay.calls.length,4);replay.controller.destroy();
});

test('retry preserves a neighboring terminal failure and clears a transient current failure',async()=>{
  let attempts=0;
  const replay=setup(bucket=>bucket===0?new Response(null,{status:404}):bucket===1&&++attempts===1?new Response(null,{status:429}):payload(message('recovered',5)),{initial:5});
  await setImmediate();assert.equal(replay.retry.hidden,false);assert.match(replay.status.textContent,/limiting/);
  replay.retry.dispatchEvent(new Event('click'));await setImmediate();
  assert.equal(replay.retry.hidden,true);assert.equal(replay.status.textContent,'');
  assert.deepEqual(texts(replay.list),['recovered']);
  replay.seek(0);assert.equal(replay.retry.hidden,true);assert.match(replay.status.textContent,/no longer/);
  assert.equal(replay.calls.filter(call=>call.bucket===0).length,1);replay.controller.destroy();
});

test('a pre-aborted replay retains neither DOM nor requests',()=>{
  const abort=new AbortController();abort.abort();
  const replay=setup(()=>assert.fail('unexpected fetch'),{abort});
  replay.seek(5);replay.controller.destroy();assert.equal(replay.container.children.length,0);assert.equal(replay.calls.length,0);
});

test('replay matches a reference window across 400 forward and backward seeks',async()=>{
  let random=123456789;
  const next=limit=>{random=(Math.imul(1664525,random)+1013904223)>>>0;return random%limit;};
  const rows=Array.from({length:480},(_,index)=>({id:`message-${index}`,time:next(12001)/100}));
  const fixture=rows.map(row=>message(row.id,row.time));
  const replay=setup(()=>payload(...fixture));await setImmediate();
  const ordered=[...rows].sort((a,b)=>a.time-b.time);
  for(let index=0;index<400;index++){
    const time=next(12001)/100;
    replay.seek(time);
    const expected=ordered.filter(row=>row.time<=time&&row.time>=Math.max(0,time-60)).slice(-200).map(row=>row.id);
    assert.deepEqual(texts(replay.list),expected,`replay position ${time}`);
  }
  assert.equal(replay.calls.length,4,'rapid seeks keep only two in-flight reads');
  await setImmediate();
  assert.ok(replay.calls.length<=7,'the queue retains at most three buckets for the latest position');
  replay.controller.destroy();
});
