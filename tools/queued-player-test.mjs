import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';
const engine=process.env.KR_ENGINE||'chromium',root=process.cwd(),{fixture,frame}=await workspaceFixtures();
let browser,context;
if(engine==='firefox'){
  browser=await firefox.launch({headless:true});context=await browser.newContext({viewport:{width:1600,height:1000}});
  await context.addInitScript(()=>{const values={};window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>values,set:async patch=>Object.assign(values,patch)},onChanged:{addListener(){},removeListener(){}}}};});
}else{
  const extension=path.join(root,'dist/chrome');context=await chromium.launchPersistentContext(path.join(root,`tmp/queued-player-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1600,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  if(!context.serviceWorkers().length)await context.waitForEvent('serviceworker');
}
try{
  await context.route('https://kick.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:path.join(root,'extension',url.pathname.split('/').pop())});
    if(url.pathname.startsWith('/api/v2/channels/')){const slug=url.pathname.split('/').pop();return route.fulfill({json:{slug,user:{username:slug},livestream:{is_live:true,session_title:slug,categories:[{name:'Music'}]}}});}
    if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
    return route.fulfill({contentType:'text/html',body:url.searchParams.has('immersion-frame')?'<main>Still loading the native player</main>':fixture});
  });
  await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:frame}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://kick.com/native?refined-multi=native,slowone,slowtwo,waiting,tail&immersion-player=full');
  if(engine==='firefox'){
    for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:`extension/${file}`});
    const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));
    for(const file of manifest.content_scripts.find(group=>group.js?.includes('content.js')).js)await page.addScriptTag({path:`extension/${file}`});
  }
  const workspace=page.locator('#kr-multi-root'),waiting=workspace.locator('.multi-tile[data-channel="waiting"]');
  await workspace.locator('iframe[name="kick-refined-full:slowtwo"]').waitFor();
  assert.equal(await waiting.getAttribute('data-player-state'),'queued');assert.equal(await waiting.locator('iframe').count(),0);
  await page.evaluate(()=>{window.retainedNative=document.querySelector('#injected-channel-player');window.retainedSlow=[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe')];});
  const fallback=waiting.getByRole('button',{name:'Use embed for waiting',exact:true});await fallback.focus();await fallback.press('Enter');
  const embed=waiting.locator('iframe');await embed.waitFor();
  if(engine==='firefox'){await embed.contentFrame().locator('video').waitFor({state:'attached'});const child=page.frames().find(frame=>frame.url().startsWith('https://player.kick.com/waiting'));for(const file of ['stream-clock.js','player-dom.js','player-controls.js','player-frame.js'])await child.addScriptTag({path:`extension/${file}`});}
  await page.waitForFunction(()=>document.getElementById('kr-multi-root').shadowRoot.querySelector('.multi-tile[data-channel="waiting"]').dataset.playerState==='ready');
  assert.ok((await embed.getAttribute('src')).startsWith('https://player.kick.com/waiting'));
  assert.equal(await workspace.locator('iframe[name^="kick-refined-full:"]').count(),2,'fallback does not consume or free a running full-player slot');
  assert.equal(await workspace.locator('.multi-tile[data-channel="tail"] iframe').count(),0);
  assert.equal(await page.evaluate(()=>retainedNative===document.querySelector('#injected-channel-player')&&retainedSlow.every(frame=>frame.isConnected)),true,'other players are not reloaded');
  assert.equal(await waiting.locator('.multi-tile-header a').evaluate(node=>node.getRootNode().activeElement===node),true,'keyboard focus is retained after the switch');
  await workspace.getByRole('button',{name:'Remove slowone',exact:true}).click();
  await workspace.locator('iframe[name="kick-refined-full:tail"]').waitFor();
  assert.equal(await workspace.locator('iframe[name="kick-refined-full:waiting"]').count(),0,'canceled queued full page never starts later');
  assert.deepEqual(errors,[]);console.log(`${engine}: immediate queued fallback, queue cancellation, frame preservation and keyboard focus passed`);
}finally{await context.close();await browser?.close();}
