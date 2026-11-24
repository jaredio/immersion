import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('extension/dom.js','utf8');
function setup(enabled=true){
 let next=0,time=0;const timers=new Map(),frames=new Map(),events=new Map(),observers=[],errors=[];
 const document={hidden:false,documentElement:{dataset:{krEnabled:'true',krFastChat:String(enabled)}},getElementById:()=>null,addEventListener:(type,callback)=>events.set(type,callback)};
 const context=vm.createContext({URL,Event,document,performance:{now:()=>time},queueMicrotask:fn=>{try{fn();}catch(error){errors.push(error);}},setTimeout:callback=>{timers.set(++next,callback);return next;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id),MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}takeRecords(){return [];}}});
 vm.runInContext(source,context);
 const run=map=>{const item=map.entries().next().value;if(item){map.delete(item[0]);item[1]();}};
 return {api:context.KickRefinedDOM,context,document,timers,frames,errors,events,observers,tick(ms){time+=ms;},timer:()=>run(timers),frame:()=>run(frames)};
}
test('ordinary mode keeps timer scheduling without creating animation-frame work',()=>{
 const s=setup(false);let calls=0;s.api.deferChatWork(()=>calls++,50);assert.equal(calls,0);s.timer();assert.equal(calls,1);assert.equal(s.frames.size,0);
});
test('experimental enhancements share a soft two-millisecond frame budget and retain FIFO fairness',()=>{
 const s=setup(),calls=[];for(const name of ['clips','posts','media'])s.api.deferChatWork(()=>{calls.push(name);s.tick(1.1);});while(s.timers.size)s.timer();assert.deepEqual(calls,[]);assert.equal(s.frames.size,1);
 s.frame();assert.deepEqual(calls,['clips','posts']);assert.equal(s.frames.size,1);s.frame();assert.deepEqual(calls,['clips','posts','media']);assert.equal(s.frames.size,0);
});
test('cancellation releases queued callbacks and the last pending frame',()=>{
 const s=setup(),job=s.api.deferChatWork(()=>assert.fail('cancelled callback ran'));s.timer();assert.equal(s.frames.size,1);s.api.cancelChatWork(job);assert.equal(s.frames.size,0);assert.equal(s.timers.size,0);
 const delayed=s.api.deferChatWork(()=>assert.fail('cancelled delay ran'));s.api.cancelChatWork(delayed);assert.equal(s.timers.size,0);
});
test('a failed enhancement does not strand other work in the shared queue',()=>{
 const s=setup();let calls=0;s.api.deferChatWork(()=>{throw Error('failed');});s.api.deferChatWork(()=>calls++);while(s.timers.size)s.timer();s.frame();assert.equal(calls,1);assert.equal(s.errors.length,1);
});
test('hidden chat cleanup uses a timer and returns to frame scheduling when visible',()=>{
 const s=setup();let calls=0;s.api.deferChatWork(()=>calls++);s.timer();s.document.hidden=true;s.events.get('visibilitychange')();assert.equal(s.frames.size,0);assert.equal(s.timers.size,1);
 s.document.hidden=false;s.events.get('visibilitychange')();assert.equal(s.timers.size,0);assert.equal(s.frames.size,1);s.frame();assert.equal(calls,1);
});
test('switching the experiment off drains existing work and restores ordinary scheduling',()=>{
 const s=setup(),calls=[];for(let i=0;i<3;i++)s.api.deferChatWork(()=>{calls.push(i);s.tick(5);});while(s.timers.size)s.timer();s.document.documentElement.dataset.krFastChat='false';s.frame();assert.deepEqual(calls,[0,1,2]);assert.equal(s.frames.size,0);
});
test('recycled rows are discarded without yielding them to the enhancement controllers',()=>{
 const s=setup(),live=[{isConnected:true},{isConnected:true}],dirty=new Set([...Array.from({length:1000},()=>({isConnected:false})),...live]);const processed=[];while(dirty.size)processed.push(...s.api.drainRows(dirty));assert.deepEqual(processed,live);
});
test('shared link candidates preserve every supported provider route, including encoded legacy clips',async()=>{
 const s=setup();for(const file of ['chat-clips','x-post-data','media-data'])vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),s.context);
 const id='clip_01M5VG3B8WEFY068DP0GCHKSGW',values=[`https://kick.com/a/clips/${id}`,`https://www.kick.com/a?clip=${id.replace('_','%5F')}`,`https://kick.com/a/CLIPS/${id}`,'https://x.com/viewer/status/123','https://www.twitter.com/viewer/status/123','https://mobile.twitter.com/viewer/status/123','https://x.com/viewer','https://www.youtube.com/watch?v=abcdefghijk','https://m.youtube.com/shorts/abcdefghijk','https://www.youtu.be/abcdefghijk','https://www.tiktok.com/@viewer/video/1234567890123456789','https://m.tiktok.com/@viewer','https://vt.tiktok.com/ZM12345/','https://vm.tiktok.com/ZM12345/','https://www.tiktok.com/t/ZM12345/','https://kick.com/viewer','javascript:alert(1)','https://example.com/'];
 const anchors=values.map(href=>({href})),row={querySelectorAll:()=>anchors};
 for(const [parser,kind]of [[s.context.KickRefinedClips.parseClip,'clips'],[s.context.KickRefinedXData.parse,'x'],[s.context.KickRefinedMediaData.parse,'media']])for(const anchor of anchors)if(parser(anchor.href))assert.ok(s.api.links(row,kind).includes(anchor),anchor.href);
 assert.equal(s.api.links(row,'clips'),s.api.links(row,'clips'),'candidate arrays are reused');assert.ok(!s.api.links(row,'clips').includes(anchors.at(-2)));
});
test('experimental emote-only changes keep the link cache warm while added links invalidate it',()=>{
 const s=setup();let scans=0;const anchors=[{href:'https://x.com/viewer/status/123'}],row={nodeType:1,closest:()=>row,querySelectorAll:selector=>selector==='a[href]'?(scans++,[...anchors]):[]};
 s.api.subscribeChat({onRows:rows=>{for(const row of rows)s.api.links(row,'x');}}).setEnabled(true);const before=s.api.links(row,'x');
 const image={nodeType:1,closest:()=>row,querySelectorAll:()=>[],matches:()=>false,querySelector:()=>null};s.observers[0].callback([{type:'childList',target:row,addedNodes:[image],removedNodes:[]}]);assert.equal(scans,1);assert.equal(s.api.links(row,'x'),before);
 const link={...image,href:'https://x.com/viewer/status/124',matches:()=>true};anchors.push(link);s.observers[0].callback([{type:'childList',target:row,addedNodes:[link],removedNodes:[]}]);assert.equal(scans,2);assert.equal(s.api.links(row,'x').length,2);
});
test('removed links invalidate candidates even when href was cleared before the observer runs',()=>{
 const s=setup();let present=true,hasHref=true;const anchor={href:'https://x.com/viewer/status/123',hasAttribute:()=>hasHref},row={nodeType:1,closest:()=>row,querySelectorAll:selector=>selector==='a[href]'&&present&&hasHref?[anchor]:[],contains:node=>node===anchor&&present};
 s.api.subscribeChat({onRows:rows=>{for(const row of rows)s.api.links(row,'x');}}).setEnabled(true);assert.equal(s.api.links(row,'x').length,1);present=false;hasHref=false;
 s.observers[0].callback([{type:'childList',target:row,addedNodes:[],removedNodes:[{nodeType:1}]}]);assert.equal(s.api.links(row,'x').length,0);
});
