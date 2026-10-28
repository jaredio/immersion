import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),engine=process.env.KR_ENGINE||'chromium',live=process.argv.includes('--live');
const fixture=(await readFile(path.join(root,'tests/fixture.html'),'utf8')).replace('</body>',`<script>${await readFile(path.join(root,'tests/design-fixture.js'),'utf8')}</script></body>`).replace('<button>Follow</button>','<div id="channel-actions" style="display:flex;gap:0;margin-left:auto"><button type="button" class="native-channel-button" data-testid="follow-button">Follow</button><button type="button" class="native-channel-button" data-testid="sub-button">Subscribe</button></div>');
const form=`<!doctype html><html><head><title>Powerchat</title></head><body><div class="nav-container">Provider navigation</div><div class="page-container"><div class="paid-chat-page"><div class="card"><div class="card-body"><h2 class="paid-chat-name">cobbruvs</h2><div class="donations-container"><form><div class="input-row"><label>Username</label><input name="username" placeholder="Leave blank to chat as Anonymous"></div><div class="input-row"><label>Optional Message</label><input name="message" maxlength="250"></div><div class="input-row"><label>Amount (USD)</label><input name="amount"></div><div class="paid-chat-disclaimer"><input name="paid-chat-disclaimer" type="checkbox"><label>I agree to the <a href="/terms-of-service">Terms of Service</a></label></div><div class="payment-container disabled">Select Payment Method</div></form></div></div></div></div></div><div class="footer-container">Provider navigation</div></body></html>`;
let browser,context;
if(engine==='chromium')context=await playwright.chromium.launchPersistentContext(path.join(root,live?'tmp/support-live-profile':'tmp/support-test-profile'),{executablePath:playwright.chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${path.join(root,'dist/chrome')}`,`--load-extension=${path.join(root,'dist/chrome')}`],viewport:{width:1500,height:1000}});
else{
 browser=await playwright.firefox.launch({headless:true});context=await browser.newContext({viewport:{width:1500,height:1000}});
 await context.addInitScript(()=>{const listeners=[];let stored={};window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>structuredClone(stored),set:async patch=>{const changes=Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,{oldValue:stored[key],newValue:value}]));stored={...stored,...patch};listeners.forEach(fn=>fn(changes,'local'));}},onChanged:{addListener:fn=>listeners.push(fn)}}};});
 await context.route('https://kick.com/__extension/*',route=>route.fulfill({path:path.join(root,'extension',new URL(route.request().url()).pathname.split('/').pop())}));
}
const counts={panels:0,channel:0,provider:0};let viewerOnly=false;
try{
 if(engine==='chromium'){const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await worker.evaluate(()=>chrome.storage.local.clear());}
 await context.route('https://kick.com/**',route=>{
  const url=new URL(route.request().url());if(url.pathname.startsWith('/__extension/'))return route.fallback();
  if(url.pathname.startsWith('/api/v2/channels/')){counts.channel++;return route.fulfill({json:{user:{username:'aurora',bio:''},livestream:null}});}
  if(url.pathname.endsWith('/links')){counts.panels++;return route.fulfill({json:viewerOnly?[]:[{title:'Support',link:'https://powerchat.live/cobbruvs?tab=donation'},{description:'[Tip](https://kickbot.com/tips/custom-brand)'},{title:'Tips',link:'https://streamelements.com/xqc/tip'}]});}
  return route.fulfill({contentType:'text/html',body:fixture});
 });
 if(!live){
  await context.route('https://powerchat.live/**',route=>{counts.provider++;return route.fulfill({contentType:'text/html',body:form});});
  await context.route('https://kickbot.com/**',route=>{counts.provider++;return route.fulfill({headers:{'content-type':'text/html','x-frame-options':'DENY','content-security-policy':"frame-ancestors 'none'"},body:'<!doctype html><html><head><title>KickBot checkout</title></head><body><h1>KickBot checkout</h1></body></html>'});});
 }
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 if(engine==='firefox')page.on('framenavigated',async frame=>{
  if(frame===page.mainFrame()||!/^https:\/\/(?:powerchat.live|kickbot.com)\//.test(frame.url()))return;
  await frame.waitForLoadState('domcontentloaded');await frame.addStyleTag({path:path.join(root,'extension/support-form.css')});for(const file of ['support-data.js','support-frame.js'])await frame.addScriptTag({path:path.join(root,'extension',file)});
 });
 await page.goto('https://kick.com/aurora');
 if(engine==='firefox'){
  for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:path.join(root,'extension',file)});
  const manifest=JSON.parse(await readFile(path.join(root,'dist/firefox/manifest.json'),'utf8'));
  for(const file of manifest.content_scripts.find(item=>item.js?.includes('content.js')).js)await page.addScriptTag({path:path.join(root,'extension',file)});
 }
 const button=page.locator('main [data-kr-support]:visible');
 await button.waitFor();
 assert.equal(await button.count(),1,'one support action beside follow/subscribe');
 assert.equal(await button.evaluate(node=>node.classList.contains('native-channel-button')),false,'support never inherits native utility classes');
 const subscribe=page.locator('#kr-channel-root .channel-action[data-kind="subscribe"]');
 const subscribeBox=await subscribe.boundingBox(),supportBox=await button.boundingBox();
 assert.ok(supportBox.x-subscribeBox.x-subscribeBox.width>=7,'channel actions have visible spacing');
 assert.ok(supportBox.width>=90&&supportBox.height>=36,'support retains a complete button shape');
 const group=page.locator('#kr-channel-root .channel-primary-actions');
 await mkdir(path.join(root,'artifacts'),{recursive:true});await group.screenshot({path:path.join(root,`artifacts/${engine}-support-buttons.png`)});
 await group.evaluate(node=>node.style.maxWidth='180px');
 const compactSubscribe=await subscribe.boundingBox(),compactSupport=await button.boundingBox();
 assert.ok(compactSupport.y>=compactSubscribe.y+compactSubscribe.height+7,'support wraps with spacing when the action row is narrow');
 await group.evaluate(node=>node.style.removeProperty('max-width'));
 assert.equal(counts.provider,0,'no third-party page is loaded before clicking');
 await button.click();const dialog=page.locator('#kr-support-root').getByRole('dialog');
 await dialog.locator('#support-provider option').nth(1).waitFor({state:'attached'});
 let provider=page.frameLocator('#kr-support-root iframe');await provider.locator('input[name="username"]').waitFor({timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#kr-support-root').shadowRoot.querySelector('#support-status').hidden,{timeout:30000});
 assert.equal(await provider.locator('html').getAttribute('data-immersion-tip'),'powerchat','the authenticated frame bridge applies the provider stylesheet');
 assert.equal(await provider.locator('.nav-container').isVisible(),false);
 assert.equal(await provider.locator('input[name="paid-chat-disclaimer"]').isChecked(),false,'the extension never accepts provider terms');
 await provider.locator('input[name="username"]').fill('preview-only');await provider.locator('input[name="message"]').fill('Form preview — no donation submitted');
 assert.equal(await provider.locator('input[name="username"]').inputValue(),'preview-only');
 await provider.locator('input[name="username"]').evaluate(element=>element.blur());
 await page.waitForTimeout(250);
 assert.equal(await provider.locator('input[name="username"]').evaluate(element=>getComputedStyle(element).borderRadius),'9px');
 const panelRect=await dialog.boundingBox();assert.ok(panelRect.width>=418&&panelRect.width<=422,'support panel uses a compact side sheet');
 const openerBox=await button.boundingBox();assert.ok(Math.abs(panelRect.x+panelRect.width-openerBox.x-openerBox.width)<2,'support aligns to its channel action');
 assert.ok(panelRect.height<=620,'support popover stays compact');
 await mkdir(path.join(root,'artifacts'),{recursive:true});await page.screenshot({path:path.join(root,`artifacts/${engine}-support${live?'-live':''}.png`)});
 await provider.locator('.payment-container').scrollIntoViewIfNeeded();assert.equal(await provider.locator('.payment-container').isVisible(),true,'provider payment controls remain accessible');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
 const mobile=await dialog.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=391&&mobile.height<=844,'the form fits a narrow viewport');
 await page.setViewportSize({width:1500,height:1000});
 if(live){console.log('Live Powerchat form loaded and restyled inside the installed extension; no payment submitted.');}
 else{
  assert.equal(counts.panels,1,'opening support shares the cached panel request');
  await page.evaluate(()=>{history.pushState({},'', '/nightshift');document.querySelector('h1').textContent='nightshift';});
  await page.waitForFunction(()=>document.querySelector('main [data-kr-support]')?.dataset.krSupport==='nightshift');
  assert.equal(await dialog.locator('#support-title').textContent(),'Support aurora','navigation cannot retarget an open form');
  const providerBefore=counts.provider;
  await dialog.locator('#support-provider').selectOption('1');await dialog.getByRole('button',{name:'Open KickBot checkout'}).waitFor();
  assert.equal(await dialog.locator('iframe').count(),0,'KickBot never loads a blocked iframe');
  assert.equal(counts.provider,providerBefore,'selecting KickBot makes no embedding request');
  assert.equal(await dialog.locator('#support-external').getAttribute('href'),'https://kickbot.com/tips/custom-brand');
  const checkoutReady=context.waitForEvent('page');await dialog.getByRole('button',{name:'Open KickBot checkout'}).click();
  const checkout=await checkoutReady;await checkout.waitForURL('https://kickbot.com/tips/custom-brand#immersion-checkout');await checkout.getByRole('heading',{name:'KickBot checkout'}).waitFor();
  if(engine==='firefox'){await checkout.addStyleTag({path:path.join(root,'extension/support-form.css')});for(const file of ['support-data.js','support-frame.js'])await checkout.addScriptTag({path:path.join(root,'extension',file)});}
  assert.equal(await checkout.locator('html').getAttribute('data-immersion-tip'),'kickbot','Immersion popouts receive the matching provider skin');
  assert.equal(await checkout.evaluate(()=>window.opener),null,'checkout cannot control the Kick page');await checkout.close();
  assert.equal(new URL(page.url()).pathname,'/nightshift','the original Kick page stays open');
  await dialog.locator('#support-provider').selectOption('2');
  await dialog.getByRole('button',{name:'Open StreamElements checkout'}).waitFor();
  assert.equal(await dialog.locator('#support-external').getAttribute('href'),'https://streamelements.com/xqc/tip','the published StreamElements destination is retained');
  assert.equal(await dialog.locator('#support-provider option').count(),3,'all published services remain separate choices');
  await dialog.locator('#support-provider').selectOption('1');
  await dialog.getByRole('button',{name:'Open KickBot checkout'}).waitFor();
  // Forged page messages cannot replace the separate-window checkout state.
  await page.evaluate(()=>window.postMessage({type:'immersion:tip-ready',token:'fake'},location.origin));
  assert.equal(await dialog.getByRole('button',{name:'Open KickBot checkout'}).isVisible(),true);
  await dialog.getByRole('button',{name:'Close support'}).click();await page.locator('#kr-support-root iframe').waitFor({state:'detached'});
  viewerOnly=true;
  await page.evaluate(()=>{history.pushState({},'', '/third');document.querySelector('h1').textContent='third';const pin=document.createElement('div');pin.id='test-pin';pin.innerHTML='<div data-testid="sent-by">ordinary viewer</div><div><div data-testid="pinned-message-content"><a href="https://powerchat.live/viewer">tip me</a></div></div>';document.querySelector('#channel-chatroom').prepend(pin);});
  await page.waitForFunction(()=>document.querySelector('main [data-kr-support]')?.dataset.krSupport==='third');await button.click();
  await dialog.getByText('No supported tip link found.',{exact:false}).waitFor();
  assert.equal(await dialog.locator('iframe').count(),0,'a viewer pin does not become the channel payment destination');
  await dialog.locator('#support-link').fill('https://powerchat.live.evil.test/fake');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await dialog.locator('#support-link-error').getByText('Use a public Powerchat',{exact:false}).waitFor();
  await dialog.locator('#support-link').fill('https://powerchat.live/manual-alias?tab=donation');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')?.src==='https://powerchat.live/manual-alias?tab=donation');
  await dialog.getByRole('button',{name:'Close support'}).click();await button.click();
  await dialog.locator('#support-provider').waitFor();assert.equal(await dialog.locator('#support-provider option').textContent(),'Powerchat · manual-alias','manual URL persists per channel');
  await dialog.locator('.support-link-editor summary').click();await dialog.getByRole('button',{name:'Remove saved link'}).click();await dialog.getByText('No supported tip link found.',{exact:false}).waitFor();
  await dialog.getByRole('button',{name:'Close support'}).click();
  await page.locator('#test-pin [data-testid="sent-by"]').evaluate(element=>element.innerHTML='<span data-testid="identity-badge-moderator"></span>Channel moderator');
  await button.click();await dialog.locator('#support-source').getByText('Channel-pinned message').waitFor();
  assert.equal(await dialog.locator('#support-provider option').textContent(),'Powerchat · viewer','a moderator-endorsed pin is discoverable');
  await dialog.getByRole('button',{name:'Close support'}).click();
  if(engine==='chromium'){const worker=context.serviceWorkers()[0];await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:false}}));}
  else await page.evaluate(()=>browser.storage.local.set({settings:{enabled:false}}));
  await button.waitFor({state:'detached'});assert.equal(await page.locator('[data-testid="follow-button"]').isVisible(),true,'disabling restores the native channel actions');
  assert.equal(await page.locator('[data-kr-support-actions]').count(),0,'action-row styling is removed when disabled');
  const standalone=await context.newPage();await standalone.goto('https://powerchat.live/creator');
  assert.equal(await standalone.locator('html').getAttribute('data-immersion-tip'),null,'standalone provider pages are never restyled');await standalone.close();
  // Workspace cards can be constructed while their shadow host is detached.
  // Housekeeping must not disable a button that gets attached later.
  const detached=await context.newPage();
  await detached.route('https://support-test.invalid/**',route=>{
   if(route.request().url().endsWith('/ui.css'))return route.fulfill({contentType:'text/css',path:path.join(root,'extension/ui.css')});
   if(route.request().url().includes('/api/'))return route.fulfill({json:[]});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><main></main></body></html>'});
  });
  await detached.goto('https://support-test.invalid/aurora');
  await detached.evaluate(()=>window.browser={runtime:{getURL:file=>`https://support-test.invalid/${file}`},storage:{local:{get:async()=>({})}}});
  for(const file of ['shared.js','profile.js','support-data.js','support.js'])await detached.addScriptTag({path:path.join(root,'extension',file)});
  await detached.evaluate(()=>{
   window.detachedSupport=KickRefinedSupport.create();
   const button=detachedSupport.makeButton('aurora');
   detachedSupport.makeButton('nightshift');detachedSupport.refresh();
   document.body.append(button);
  });
  await detached.getByRole('button',{name:'Support aurora',exact:true}).click();
  await detached.getByRole('dialog').waitFor({timeout:2500});
  assert.equal(await detached.locator('#kr-support-root').locator('#support-title').textContent(),'Support aurora','detached buttons keep their recipient and click handler');
  await detached.close();
  assert.deepEqual(errors,[]);console.log(`${engine}: support discovery, lazy embedded form, styling, recipient binding, error fallback, manual links, trusted pins and cleanup passed.`);
 }
}finally{await context.close();await browser?.close();}
