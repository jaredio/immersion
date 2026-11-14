// Regression checks for the review fixes; no account or live network.
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const engine=process.env.KR_ENGINE||'chromium';
const browser=await (engine==='firefox'?firefox:chromium).launch({headless:true});
try{
  const page=await browser.newPage();
  await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><div data-testid="schedule-viewer-page">Schedule fixture</div></body></html>'}));
  await page.goto('https://kick.com/alpha');
  await page.addScriptTag({path:'extension/channel-library.js'});
  const schedule=await page.evaluate(()=>{
    const library=KickRefinedChannelLibrary.create();document.body.append(library.host);
    library.update({slug:'alpha',tab:'schedule',inlineSchedule:true},[]);
    const previous=library.host.shadowRoot.querySelector('iframe');
    library.update({slug:'beta',tab:'schedule',inlineSchedule:true},[]);
    previous.dispatchEvent(new Event('load'));
    const frame=library.host.shadowRoot.querySelector('iframe');
    const result={src:frame.src,title:frame.title,count:library.host.shadowRoot.querySelectorAll('iframe').length,oldConnected:previous.isConnected};
    library.update({slug:'beta',tab:'home',inlineSchedule:true},[]);
    if(frame.isConnected||library.host.shadowRoot.querySelector('iframe'))throw Error('Hidden schedule was not unloaded');
    frame.dispatchEvent(new Event('load'));
    library.update({slug:'beta',tab:'schedule',inlineSchedule:true},[]);
    if(library.host.shadowRoot.querySelector('iframe')===frame)throw Error('Returning to Schedule reused a disposed frame');
    library.destroy();previous.dispatchEvent(new Event('load'));return result;
  });
  assert.deepEqual(schedule,{src:'https://kick.com/beta/schedule',title:'beta schedule',count:1,oldConnected:false});
  for(const feature of ['x','media','clip']){
  await page.goto('https://kick.com/alpha');
  await page.evaluate(()=>{window.chrome={runtime:{},storage:{}};});
  for(const name of ['shared','dom','x-post-data','x-posts',...(feature==='media'?['media-data','media-embeds']:feature==='clip'?['chat-clips']:[])])await page.addScriptTag({path:`extension/${name}.js`});
  const counts=await page.evaluate(async feature=>{
    const list=document.createElement('div');list.id='chatroom-messages';document.body.append(list);
    const row=document.createElement('div');row.dataset.index='0';list.append(row);
    const posts=feature==='x'?KickRefinedX.create({enabled:true}):feature==='clip'?KickRefinedClips.create({enabled:true}):KickRefinedMedia.create({media:true,profiles:false});
    const selector=feature==='x'?'.kr-x-post':feature==='clip'?'.kr-chat-clip':'.kr-media-embed',counts=[];
    const settle=()=>new Promise(resolve=>setTimeout(resolve,180));
    const add=id=>{const link=document.createElement('a');link.href=feature==='x'?`https://x.com/example/status/${id}`:feature==='clip'?`https://kick.com/example/clips/clip_01M5VG3B8WEFY068DP0GCHKS${id.slice(-2)}`:`https://www.youtube.com/watch?v=example${id.slice(-4)}`;link.textContent='post';if(id.endsWith('003'))row.prepend(link);else row.append(link);};
    add('100000000000000001');add('100000000000000002');await new Promise(resolve=>setTimeout(resolve,180));
    add('100000000000000003');await new Promise(resolve=>setTimeout(resolve,180));
    counts.push(row.querySelectorAll(selector).length);
    row.querySelector('a').remove();await settle();counts.push(row.querySelectorAll(selector).length);
    row.replaceChildren();row.dataset.index='1';add('100000000000000004');await settle();counts.push(row.querySelectorAll(selector).length);
    row.querySelector('a').href='https://example.com';await settle();counts.push(row.querySelectorAll(selector).length);
    add('100000000000000005');await settle();counts.push(row.querySelectorAll(selector).length);
    row.remove();await settle();counts.push(row.querySelectorAll(selector).length);posts.destroy();return counts;
  },feature);
  assert.deepEqual(counts,[2,2,1,0,1,0],`${feature}: cap, slot reuse, recycled rows, changed hrefs and removal`);
  }
}finally{await browser.close();}
const context=vm.createContext({});vm.runInContext(await readFile('extension/multi-metadata.js','utf8'),context);
const calls=[];let release;
const service=context.KickRefinedMultiMetadata.create({support:{channel:slug=>{calls.push(slug);return slug==='slow'?new Promise(resolve=>release=resolve):Promise.resolve({});}},isWanted:()=>true,onChannel(){}});
service.requestChannel('slow');service.requestChannel('healthy');await new Promise(resolve=>setImmediate(resolve));
console.log('metadata while first channel is slow:',calls);release({});await new Promise(resolve=>setImmediate(resolve));service.destroy();
assert.deepEqual(calls,['slow','healthy']);
console.log(`${engine}: schedule replacement and incremental X/media/clip preview regressions passed`);
