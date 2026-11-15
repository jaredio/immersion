/* Visibility changes defer new preview work without touching stream playback. */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const engine=process.env.KR_ENGINE||'chromium',browser=await ({chromium,firefox}[engine]).launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const media='data:audio/wav;base64,'+(await readFile('tests/silence.wav')).toString('base64');
 await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:`<video id="stream" muted autoplay loop src="${media}"></video><div id="chatroom-messages"></div>`}));
 await page.goto('https://kick.com/creator');
 await page.evaluate(()=>{
  window.hiddenForTest=true;Object.defineProperty(document,'hidden',{get:()=>hiddenForTest,configurable:true});
  window.observers=[];window.IntersectionObserver=class{constructor(callback){this.callback=callback;this.nodes=new Set();observers.push(this);}observe(node){this.nodes.add(node);queueMicrotask(()=>{if(this.nodes.has(node))this.callback([{target:node,isIntersecting:true}]);});}unobserve(node){this.nodes.delete(node);}disconnect(){this.nodes.clear();}};
  window.requests=[];window.chrome={runtime:{sendMessage:async message=>{requests.push(message);return message.type==='immersion:x-post'?{ok:true,post:{id:message.href.split('/').pop(),href:message.href,handle:'viewer',name:'Viewer',text:'A post',media:[],likes:0,reposts:0,views:0}}:{ok:true,item:{provider:'youtube',kind:'video',id:'abcdefghijk',href:message.href,title:'Video',author:'Creator',stats:{}}};}}};
  window.addRow=(index,kind)=>{const row=document.createElement('div');row.dataset.index=String(index);row.id=`row-${kind}-${index}`;const link=document.createElement('a');link.href=kind==='x'?`https://x.com/viewer/status/${100000000000000000n+BigInt(index)}`:`https://www.youtube.com/watch?v=video${String(index).padStart(6,'0')}`;link.textContent='Preview';row.append(link);document.getElementById('chatroom-messages').append(row);};
  addRow(0,'x');addRow(0,'media');
 });
 for(const file of ['shared','dom','x-post-data','x-posts','media-data','media-embeds'])await page.addScriptTag({path:`extension/${file}.js`});
 await page.evaluate(()=>{window.posts=KickRefinedX.create({enabled:true});window.media=KickRefinedMedia.create({media:true,profiles:false});});
 await page.waitForFunction(()=>document.querySelectorAll('.kr-x-post,.kr-media-embed').length===2);await page.waitForTimeout(80);
 assert.equal(await page.evaluate(()=>requests.length),0,'hidden arrivals never start rich-preview requests');
 await page.evaluate(()=>{for(let i=1;i<=10;i++){addRow(i,'x');addRow(i,'media');}});
 await page.waitForFunction(()=>document.querySelectorAll('.kr-x-post,.kr-media-embed').length===22);await page.waitForTimeout(80);
 assert.equal(await page.evaluate(()=>requests.length),0,'chat churn while hidden remains deferred');
 await page.evaluate(()=>{document.getElementById('row-x-1').remove();const host=document.querySelector('#row-media-1 .kr-media-embed');for(const observer of observers)if(observer.nodes.has(host))observer.callback([{target:host,isIntersecting:false}]);});await page.waitForTimeout(100);
 await page.evaluate(()=>{window.originalStream=document.getElementById('stream');hiddenForTest=false;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>requests.length===20);assert.equal(await page.evaluate(()=>new Set(requests.map(message=>message.href)).size),20,'resume loads each surviving visible card exactly once');
 await page.evaluate(()=>{const host=document.querySelector('#row-media-1 .kr-media-embed');for(const observer of observers)if(observer.nodes.has(host))observer.callback([{target:host,isIntersecting:true}]);});await page.waitForFunction(()=>requests.length===21);
 assert.equal(await page.evaluate(()=>document.getElementById('stream')===originalStream&&!originalStream.paused),true,'visibility work never pauses or replaces stream playback');
 await page.evaluate(()=>{hiddenForTest=true;document.dispatchEvent(new Event('visibilitychange'));addRow(11,'x');addRow(11,'media');});await page.waitForFunction(()=>document.querySelector('#row-x-11 .kr-x-post')&&document.querySelector('#row-media-11 .kr-media-embed'));await page.waitForTimeout(80);
 await page.evaluate(()=>{posts.setEnabled(false);media.setOptions({media:false,profiles:false});hiddenForTest=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>requests.filter(message=>message.type!=='immersion:preview-cancel').length),21,'disabled features never resume deferred requests');
 await page.evaluate(()=>{posts.destroy();media.destroy();document.dispatchEvent(new Event('visibilitychange'));});assert.deepEqual(errors,[]);
 console.log(`PASS ${engine}: hidden preview requests deferred, removed/offscreen cards skipped, visible cards resumed once, playback preserved, disable and destroy release pending work`);
}finally{await browser.close();}
