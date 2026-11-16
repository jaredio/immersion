/* Opt-in public VOD smoke test. Uses a disposable browser, no user session.
 * Only the blank host page and local HLS module are fixtures; API/media are live.
 */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const engine=process.env.KR_ENGINE||'chromium',channel=process.env.KR_LIVE_CHANNEL||'nickwhite';
if(!/^[a-z0-9_]{1,40}$/i.test(channel))throw Error('Invalid channel');
const browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),requests=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/v1/video/')||url.hostname==='stream.kick.com')requests.push({host:url.hostname,path:url.pathname});});
  await page.route('https://kick.com/__immersion_vod_probe',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="background:#111;color:white"><button id="open">Preview public recording</button></body></html>'}));
  await page.route('https://kick.com/__extension/vendor/hls.light.mjs',route=>route.fulfill({path:'node_modules/hls.js/dist/hls.light.mjs',contentType:'text/javascript'}));
  await page.goto('https://kick.com/__immersion_vod_probe');
  const recording=await page.evaluate(async channel=>{
    const response=await fetch(`/api/v2/channels/${channel}/videos`,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Catalog HTTP ${response.status}`);
    const rows=await response.json(),item=rows.find(item=>!item.is_live&&item.source&&!item.video?.is_private&&!item.video?.is_pruned&&!item.video?.deleted_at&&item.video?.status==='public');
    if(!item)throw Error('No public completed VOD found');
    return {href:`https://kick.com/${channel}/videos/${item.video.uuid}`,title:item.session_title};
  },channel);
  await page.evaluate(()=>window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`}});
  for(const file of ['shared.js','dom.js','chat-clips.js','clip-preview.js'])await page.addScriptTag({path:`extension/${file}`});
  await page.evaluate(row=>{window.preview=KickRefinedClipPreview.create();document.getElementById('open').onclick=event=>{window.probeOpened=preview.open(row,event.currentTarget);};},recording);
  await page.locator('#open').click();
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.probeOpened),true);
  try{await page.waitForFunction(()=>{const video=document.getElementById('kr-clip-preview')?.shadowRoot.querySelector('video,.kr-chat-clip')?.shadowRoot?.querySelector('video');return video?.readyState>=2&&!video.paused&&video.currentTime>.2;},null,{timeout:45000});}
  catch(error){console.error(JSON.stringify({recording,errors,requests,url:page.url(),state:await page.evaluate(()=>({opened:window.probeOpened,text:document.getElementById('kr-clip-preview')?.shadowRoot.textContent}))}));throw error;}
  const video=page.locator('#kr-clip-preview video');
  const result={engine,href:recording.href,...await video.evaluate(video=>({ready:video.readyState,playing:!video.paused,time:video.currentTime,duration:video.duration,width:video.videoWidth,height:video.videoHeight})),apiRequests:requests.filter(row=>row.path.startsWith('/api/v1/video/')).length,mediaRequests:requests.filter(row=>row.host==='stream.kick.com').length};
  assert.equal(result.apiRequests,1);assert.ok(result.mediaRequests>=3);assert.deepEqual(errors,[]);
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/vod-live-${engine}.png`});
  await video.evaluate(video=>window.probeVideo=video);await page.keyboard.press('Escape');
  assert.equal(await page.locator('#kr-clip-preview').count(),0);assert.equal(await page.evaluate(()=>probeVideo.paused&&!probeVideo.isConnected&&!probeVideo.getAttribute('src')),true);
  await writeFile(`artifacts/vod-live-${engine}.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{await browser.close();}
