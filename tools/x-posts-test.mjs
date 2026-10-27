import playwright from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const engine=process.env.KR_ENGINE||'chromium';
const id='2114650564600688817',href=`https://x.com/binji_x/status/${id}`;
const fixture={code:200,tweet:{id,text:'headed to mumbai next week\n\nwho’s there? <script>window.injected=true</script>',author:{screen_name:'binji_x',name:'binji',avatar_url:'https://pbs.twimg.com/avatar.jpg'},likes:1245,retweets:32,views:125000,media:{photos:[{url:'https://pbs.twimg.com/media/post.jpg'}]}}};
const body=`<!doctype html><html><head><style>body{background:#0b0b0e;color:#eee;font:14px system-ui;margin:0}aside{width:380px;margin:20px auto;padding:12px;background:#101014;border-radius:12px}#chatroom-messages{height:680px;overflow:auto}[data-index]{padding:8px 0}a{color:#a3eed2;overflow-wrap:anywhere}</style></head><body><aside><h3>Stream chat</h3><div id="chatroom-messages"><div data-index="1" id="message"><b>viewer</b> check this out <a href="${href}?s=20">${href}?s=20</a> <a href="${href}">same post</a></div><div data-index="2" id="failure"><b>another viewer</b> <a href="https://x.com/person/status/404">deleted post</a></div><div style="height:1000px"></div><div data-index="3" id="offscreen"><a href="https://x.com/person/status/123">offscreen post</a></div></div></aside></body></html>`;
let browser,context;
if(engine==='chromium')context=await playwright.chromium.launchPersistentContext(path.join(root,'tmp/x-posts-profile'),{executablePath:playwright.chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${path.join(root,'dist/chrome')}`,`--load-extension=${path.join(root,'dist/chrome')}`],viewport:{width:800,height:800}});
else{browser=await playwright.firefox.launch({headless:true});context=await browser.newContext({viewport:{width:800,height:800}});}
try{
 if(engine==='chromium'){
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(({fixture})=>{globalThis.xTestRequests=[];globalThis.fetch=async(url,options)=>{xTestRequests.push({url,credentials:options.credentials});if(url.endsWith('/404'))return new Response('{}',{status:404});return new Response(JSON.stringify(fixture));};},{fixture});
 }else{
  await context.addInitScript(({fixture})=>{globalThis.xTestRequests=[];window.browser={runtime:{sendMessage:async message=>{xTestRequests.push(message);if(message.href.endsWith('/404'))return {ok:false};return {ok:true,post:KickRefinedXData.metadata(fixture,KickRefinedXData.parse(message.href))};}}};},{fixture});
 }
 const clipRow='<div data-index="4" id="clip-size"><div style="padding:0 12px"><div style="padding:0 8px"><b>clip viewer</b><a href="https://kick.com/sweatergxd/clips/clip_01M5VG3B8WEFY068DP0GCHKSGW">Kick clip</a><button class="native-clip-preview"><img src="https://clips.kick.com/clips/test/clip_01M5VG3B8WEFY068DP0GCHKSGW/thumbnail.webp" alt="Clip preview"><span class="text-neutral">Clipped by NativeClipper</span></button></div></div></div>';
 await context.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:body.replace('<div style="height:1000px"></div>',clipRow+'<div style="height:1000px"></div>')}));
 await context.route('https://pbs.twimg.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220"><rect width="400" height="220" fill="#273a39"/><text x="100" y="120" fill="#a3eed2" font-size="24">Post media</text></svg>'}));
 await context.route('https://clips.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225"><rect width="400" height="225" fill="#273a39"/></svg>'}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://kick.com/popout/test/chat');
 if(engine==='firefox')for(const name of ['shared.js','chat-clips.js','x-post-data.js','x-posts.js'])await page.addScriptTag({path:path.join(root,'extension',name)});
 if(engine==='firefox')await page.evaluate(()=>{document.documentElement.dataset.krEnabled='true';window.testX=KickRefinedX.create();window.testClips=KickRefinedClips.create();});
 // Real Chrome uses the packaged popout content script; settings can be changed in its worker.
 const setEnabled=async enabled=>{
  if(engine==='firefox')return page.evaluate(value=>testX.setEnabled(value),enabled);
  const worker=context.serviceWorkers()[0];await worker.evaluate(value=>chrome.storage.local.set({settings:{xEmbeds:value}}),enabled);
 };
 const card=page.locator('#message .kr-x-post');await card.locator('.name').waitFor();
 assert.equal(await card.count(),1,'query variants share a single card');assert.equal(await card.locator('.name').textContent(),'binji');assert.equal(await card.locator('.handle').textContent(),'@binji_x');
 assert.equal(await card.locator('[aria-label="1,245 likes"]').count(),1);assert.equal(await card.locator('[aria-label="32 reposts"]').count(),1);assert.equal(await card.locator('[aria-label="125,000 views"]').count(),1);assert.equal(await card.locator('.brand svg.filled').count(),1);
 assert.equal(await card.locator('.text').textContent(),fixture.tweet.text);assert.equal(await page.evaluate(()=>window.injected),undefined);
 assert.equal(await page.locator('#message > a').first().isVisible(),false);assert.equal(await page.locator('#message > b').isVisible(),true);
 assert.equal(await card.getByRole('link',{name:'Open post on X'}).getAttribute('href'),href);
 await page.locator('#failure .kr-x-post').getByText('X preview unavailable').waitFor();assert.equal(await page.locator('#failure > a').isVisible(),true);
 assert.equal(await page.locator('#offscreen .kr-x-post .name').count(),0,'offscreen cards remain unloaded');
 const clipCard=page.locator('#clip-size .kr-chat-clip .card');await clipCard.waitFor();
 assert.equal(await page.locator('#clip-size .native-clip-preview').isVisible(),false,'native preview is replaced');
 assert.equal(await page.locator('#clip-size > .kr-chat-clip').count(),1,'clip card sits outside native nested padding, just like an X card');
 for(const width of [380,300]){
  await page.locator('aside').evaluate((el,width)=>el.style.width=`${width}px`,width);
  assert.equal((await clipCard.boundingBox()).width,(await card.locator('.card').boundingBox()).width,'clip and X card widths match across chat sizes');
 }
 await page.locator('aside').evaluate(el=>el.style.width='380px');
 for(const panel of [card.locator('.card'),clipCard]){
  await page.mouse.move(0,0);await page.waitForTimeout(180);
  const before=await panel.evaluate(el=>({border:getComputedStyle(el).borderColor,width:el.getBoundingClientRect().width}));
  await panel.hover();await page.waitForTimeout(180);
  const after=await panel.evaluate(el=>({border:getComputedStyle(el).borderColor,width:el.getBoundingClientRect().width}));
  assert.notEqual(after.border,before.border,'hover subtly highlights either embed');assert.equal(after.width,before.width,'hover never shifts the layout');
 }
 await page.mouse.move(0,0);await page.locator('#chatroom-messages').evaluate(el=>el.scrollTop=0);
 await mkdir(path.join(root,'artifacts'),{recursive:true});await page.screenshot({path:path.join(root,`artifacts/${engine}-x-posts.png`)});
 await setEnabled(false);await card.waitFor({state:'detached'});assert.equal(await page.locator('#message > a').first().isVisible(),true);
 await setEnabled(true);await card.locator('.name').waitFor();
 await page.locator('#message > a').evaluateAll(links=>links.forEach(link=>link.href='https://example.com/no-post'));await card.waitFor({state:'detached'});
 assert.equal(await page.locator('#message > a').first().isVisible(),true,'recycled message links are restored');
 if(engine==='chromium'){
  await page.goto('https://kick.com/test');
  await page.locator('#message .kr-x-post .name').waitFor();
  assert.equal(await page.locator('#message .kr-x-post').count(),1,'regular chat uses the same cards as popout chat');
 }
 assert.deepEqual(errors,[]);console.log(`${engine}: X cards, metadata, fallback, lazy loading, settings and recycled messages passed`);
}finally{await context.close();await browser?.close();}
