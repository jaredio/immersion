import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';

const sources=new Map(await Promise.all(['theme-start','page-ready','native-search-bridge'].map(async name=>[name,await readFile(`extension/${name}.js`,'utf8')])));
function run(name,globals){const context=vm.createContext(globals);vm.runInContext(sources.get(name),context);return context;}
function theme({frame=false,name='',pathname='/',ready=true,settings={}}={}){
  const values=new Map(),root={dataset:{},style:{setProperty:(key,value)=>values.set(key,value)}};
  const window={name};window.top=frame?{}:window;
  const document={documentElement:ready?root:null};let reads=0,callback,disconnected=false;
  const context=run('theme-start',{window,document,location:{pathname},chrome:{storage:{local:{get(){reads++;if(settings instanceof Error)throw settings;return {settings};}}}},
    MutationObserver:class{constructor(fn){callback=fn;}observe(target,options){assert.equal(target,document);assert.equal(options.childList,true);}disconnect(){disconnected=true;}}});
  return {context,root,values,reads:()=>reads,disconnected:()=>disconnected,appear(){document.documentElement=root;callback();}};
}

test('early theme applies clamped saved preferences when documentElement appears',async()=>{
  const ctx=theme({ready:false,settings:{enabled:false,performance:'no',fastChat:true,compact:true,hideRecommended:true,textOnly:true,accent:'violet',chatWidth:999,fontSize:8}});
  const saved=await ctx.context.KickRefinedThemeSettings;
  assert.equal(saved.settings.enabled,false);assert.deepEqual(ctx.root.dataset,{});
  ctx.appear();await setImmediate();
  assert.deepEqual(ctx.root.dataset,{krEnabled:'false',krPerformance:'true',krFastChat:'true',krCompact:'true',krHideRecommended:'true',krTextOnly:'true',krAccent:'violet'});
  assert.deepEqual([...ctx.values],[['--kr-chat-width','440px'],['--kr-font-size','12px']]);
  assert.equal(ctx.reads(),1);assert.equal(ctx.disconnected(),true);
});

test('early theme falls back to defaults after storage failure',async()=>{
  const ctx=theme({settings:new Error('storage offline')});await setImmediate();
  assert.equal(ctx.root.dataset.krEnabled,'true');assert.equal(ctx.root.dataset.krAccent,'mint');
  assert.deepEqual([...ctx.values],[['--kr-chat-width','340px'],['--kr-font-size','14px']]);
});

for(const [label,frame,active]of [
  ['unrelated embedded player',{frame:true,pathname:'/channel'},false],
  ['named workspace chat',{frame:true,name:'kick-refined-chat'},true],
  ['ordinary chat popout',{frame:true,pathname:'/popout/channel/chat/'},true]
])test(`early theme handles ${label}`,async()=>{
  const ctx=theme(frame);await setImmediate();assert.equal(ctx.reads(),Number(active));
  assert.equal(ctx.root.dataset.krEnabled,active?'true':undefined);
});

test('the hydration gate waits for React only on Next.js pages',()=>{
  class Element{}
  let detected=false,listener;
  const document={querySelector:()=>detected?{}:null,addEventListener(type,fn,capture){assert.equal(type,'kick-refined:surface-ready');assert.equal(capture,true);listener=fn;}};
  run('page-ready',{window:{},document,Element});
  const ready=node=>{let blocked=false;listener({target:node,preventDefault(){blocked=true;}});return !blocked;};
  const markup=new Element();assert.equal(ready(markup),true);
  detected=true;assert.equal(ready(markup),false);assert.equal(ready(null),false);
  markup.__reactFiber$fixture={};assert.equal(ready(markup),true);
  detected=false;assert.equal(ready(new Element()),false);
});

test('native search bridge preserves keyboard intent and leaves other inputs alone',()=>{
  class Input extends EventTarget{hasAttribute(key){return key==='data-kr-native-search'&&this.marked;}}
  class KeyboardEvent extends Event{constructor(type,{key,code,ctrlKey,isComposing,...options}){super(type,options);Object.assign(this,{key,code,ctrlKey,isComposing});}}
  const window=new EventTarget();window.top=window;
  const root={dataset:{krEnabled:'true'}};
  run('native-search-bridge',{window,document:{documentElement:root},HTMLInputElement:Input,KeyboardEvent,CustomEvent});
  const input=Object.assign(new Input(),{marked:true}),calls=[];
  input.addEventListener('kick-refined-native-search-keydown',event=>{calls.push([event.key,event.code,event.ctrlKey,event.isComposing]);event.preventDefault();});
  for(const type of ['keydown','input'])window.addEventListener(type,()=>calls.push('native '+type));
  function dispatch(type,target=input,details={}){
    const event=Object.assign(new Event(type,{cancelable:true}),{composedPath:()=>[target],...details});window.dispatchEvent(event);return event.defaultPrevented;
  }
  assert.equal(dispatch('keydown',input,{key:'Enter',code:'Enter',ctrlKey:true,isComposing:true}),true);
  assert.equal(dispatch('input',new Input()),false);
  assert.equal(dispatch('submit',{querySelector:()=>input}),true);
  root.dataset.krEnabled='false';assert.equal(dispatch('keydown'),false);
  assert.deepEqual(calls,[['Enter','Enter',true,true],'native input','native keydown']);
});
