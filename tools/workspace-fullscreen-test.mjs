/* Exercise real fullscreen transitions, including the secondary frame document. */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';
import {extensionWorker} from './extension-worker.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const engine=process.env.KR_ENGINE||'chromium',assets=await workspaceFixtures(),extension=path.resolve('dist/chrome');let browser,context;
if(engine==='chromium'){
 context=await chromium.launchPersistentContext(path.resolve(`tmp/fullscreen-test-${Date.now()}`),{headless:true,executablePath:chromium.executablePath(),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});await extensionWorker(context);
}else{
 browser=await firefox.launch({headless:true});context=await browser.newContext();
 await context.addInitScript(()=>{window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>({}),set:async()=>{}},onChanged:{addListener(){},removeListener(){}}}};});
}
try{
 const frame=assets.frame.replace('</body>',`<script>
  window.nativeFullscreenCalls=0;const button=document.createElement('button');button.setAttribute('aria-label','Fullscreen');button.setAttribute('data-testid','video-player-fullscreen');
  button.onclick=()=>{nativeFullscreenCalls++;document.getElementById('injected-channel-player').requestFullscreen();};document.querySelector('.z-controls').append(button);
 </script></body>`);
 await context.route('https://kick.com/**',route=>{
  const url=new URL(route.request().url());if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:'extension/'+url.pathname.split('/').pop()});
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname.endsWith('/links')?[]:{slug:url.pathname.split('/').pop(),user:{username:url.pathname.split('/').pop()},livestream:{is_live:true}}});
  return route.fulfill({contentType:'text/html',body:url.searchParams.has('immersion-frame')?frame:assets.fixture});
 });
 await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:frame}));
 for(const mode of ['full','embed'])for(const layout of ['focus','grid','columns']){
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1920,height:1080});
  await page.goto(`https://kick.com/native?refined-multi=native,secondary&refined-layout=${layout}&refined-focus=native&immersion-player=${mode}`);
  if(engine==='firefox'){
   for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:'extension/'+file});
   const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));for(const file of manifest.content_scripts.find(item=>item.js?.includes('content.js')).js)await page.addScriptTag({path:'extension/'+file});
  }
  const pane=page.locator('#kr-multi-root .multi-tile[data-channel="secondary"]');await pane.locator('iframe').waitFor();
  const child=page.frames().find(frame=>frame.url().includes('/secondary'))||await page.waitForEvent('framenavigated',{predicate:frame=>frame.url().includes('/secondary')});
  if(engine==='firefox')for(const file of ['stream-clock.js','performance.js','player-dom.js','full-player-frame.js','player-controls.js','player-frame.js'])await child.addScriptTag({path:'extension/'+file});
  await child.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await child.evaluate(()=>window.originalVideo=document.querySelector('video'));await pane.locator('iframe').evaluate(node=>window.originalStreamFrame=node);
  const original=await pane.locator('iframe').boundingBox();
  for(let cycle=0;cycle<3;cycle++){
   const fullscreen=child.locator('[data-kr-action="fullscreen"]');await fullscreen.click();
   await child.waitForFunction(()=>document.fullscreenElement===document.documentElement);
   assert.equal(await child.evaluate(()=>nativeFullscreenCalls),0,'secondary fullscreen never forwards to the replaceable native player container');
   assert.equal(await child.evaluate(()=>document.querySelector('video')===originalVideo),true,'entering fullscreen keeps the video element');
   assert.equal(await child.locator('video').evaluate(node=>node.getBoundingClientRect().width>0),true);
   if(cycle%2)await page.evaluate(()=>document.exitFullscreen());else await fullscreen.click();
   await page.waitForFunction(()=>!document.fullscreenElement);await child.waitForFunction(()=>!document.fullscreenElement);
   assert.equal(await pane.locator('iframe').evaluate(node=>node===originalStreamFrame),true,'exiting fullscreen never replaces the iframe');
   assert.equal(await child.evaluate(()=>document.querySelector('video')===originalVideo&&originalVideo.readyState>=2&&!originalVideo.paused),true,'playback survives exiting fullscreen');
   await page.waitForFunction(()=>{const pane=document.getElementById('kr-multi-root')?.shadowRoot.querySelector('.multi-tile[data-channel="secondary"]');return !!pane&&pane.getBoundingClientRect().width<innerWidth-10;});
   const restored=await pane.locator('iframe').boundingBox();assert.ok(restored.width>0&&restored.height>0);assert.ok(Math.abs(restored.width-original.width)<2&&Math.abs(restored.height-original.height)<2,'workspace geometry restores after fullscreen');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`PASS ${engine}: secondary full/embed players survive repeated fullscreen entry and exit across focus, grid and columns; iframe, video, playback and geometry preserved`);
}finally{await context.close();await browser?.close();}
