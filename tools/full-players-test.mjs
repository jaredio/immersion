import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),engine=process.env.KR_ENGINE||'chromium';
const media=`data:audio/wav;base64,${(await readFile('tests/silence.wav')).toString('base64')}`;
const fixture=(await readFile('tests/fixture.html','utf8')).replace('</body>',`<script>${await readFile('tests/design-fixture.js','utf8')}</script></body>`);
const fullFixture=slug=>`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#202027;color:white;font:14px system-ui}nav{height:70px}main{margin-left:200px}.channel-player{position:relative;height:400px}.video-shell{height:100%;position:relative}.video-shell video{width:100%;height:100%;background:#202832}.z-controls{position:absolute;bottom:0;left:0;width:100%;display:flex;gap:6px;align-items:center;padding:8px}button{color:white;background:#333;cursor:pointer}.z-controls{box-sizing:border-box}.z-controls input[aria-label="Native volume"]{min-width:20px;width:40px;flex:1}.z-controls input[aria-label="Playback timeline"]{position:absolute;left:8px;bottom:100%;width:calc(100% - 16px)}aside{position:fixed;right:0;top:0}#clip-dialog{position:fixed;right:10px;top:20px;background:#222;z-index:30}</style></head><body><nav id="page-nav">Full Kick navigation</nav><div id="application"><aside id="page-sidebar">Sidebar</aside><main><div id="injected-channel-player" class="channel-player"><div class="video-shell"><video id="video-player" src="${media}" loop autoplay muted playsinline></video><div class="z-controls bottom-0"><button data-action="pause">Pause</button><input aria-label="Native volume" type="range" min="0" max="100" value="100"><input aria-label="Playback timeline" type="range" min="0" max="100" value="0"><button data-action="quality" aria-label="Quality" aria-haspopup="menu">Quality</button><button data-action="clip">Clip</button></div></div></div><section id="channel-content"><h1>${slug}</h1>Channel details</section></main><aside id="channel-chatroom"><header>Chat</header><div id="chatroom-messages">Hidden native chat</div></aside></div><script>
 window.playerMarkup=document.querySelector('#injected-channel-player').outerHTML;window.qualitySelections=0;
 document.addEventListener('click',event=>{const action=event.target.dataset.action,video=document.querySelector('video');if(action==='pause'){video.paused?video.play():video.pause();}if(action==='quality'){const portal=document.createElement('div');portal.setAttribute('data-radix-popper-content-wrapper','');portal.id='quality-portal';portal.style.cssText='position:fixed;right:12px;top:25px;z-index:30;background:#24242c;padding:12px';portal.innerHTML='<div role="menu"><button data-action="1080p">1080p</button></div>';document.body.append(portal);}if(action==='1080p'){qualitySelections++;document.getElementById('quality-portal').remove();}if(action==='clip'){const dialog=document.createElement('div');dialog.id='clip-dialog';dialog.setAttribute('role','dialog');dialog.textContent='Native clip dialog';document.body.append(dialog);}});
 document.addEventListener('input',event=>{const video=document.querySelector('video');if(event.target.getAttribute('aria-label')==='Native volume'){video.volume=Number(event.target.value)/100;video.muted=false;}if(event.target.getAttribute('aria-label')==='Playback timeline')video.currentTime=video.duration*Number(event.target.value)/100;});
 </script></body></html>`;
let browser,context;
if(engine==='chromium'){
 context=await playwright.chromium.launchPersistentContext(path.join(root,`tmp/full-players-profile-${Date.now()}`),{executablePath:playwright.chromium.executablePath(),headless:true,viewport:{width:1600,height:1000},args:[`--disable-extensions-except=${path.join(root,'dist/chrome')}`,`--load-extension=${path.join(root,'dist/chrome')}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 await worker.evaluate(async()=>{
  for(let attempt=0;attempt<40;attempt++){
   if(globalThis.chrome?.storage?.local){await chrome.storage.local.clear();return;}
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('Extension storage did not initialize');
 });
}else{
 browser=await playwright.firefox.launch({headless:true});context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.addInitScript(()=>{const values={};window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>values,set:async patch=>Object.assign(values,patch)},onChanged:{addListener(){}}}};});

}
try{
 await context.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#334438"/></svg>'}));
 await context.route('https://kick.com/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:path.join(root,'extension',url.pathname.split('/').pop())});
  if(['full','clip'].includes(url.searchParams.get('immersion-frame')))return route.fulfill({contentType:'text/html',...(url.pathname==='/blocked'?{headers:{'content-security-policy':"frame-ancestors 'none'"},body:'<h1>Frame blocked</h1>'}:{body:fullFixture(url.pathname.slice(1))})});
  if(url.pathname.startsWith('/api/v2/channels/')){const slug=url.pathname.split('/').pop();return route.fulfill({json:{slug,user:{username:slug,bio:'Channel'},livestream:{is_live:true,start_time:new Date(Date.now()-3*3600000).toISOString(),session_title:`${slug} live`,viewer_count:100,categories:[{name:'IRL'}]}}});}
  if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
  return route.fulfill({contentType:'text/html',body:fixture});
 });
 await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><video src="${media}" loop autoplay muted></video>`}));
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>{if(engine==='firefox'&&error.message==='RPMGetBoolPref is not defined'&&error.stack?.includes('chrome://global/content/aboutNetError.mjs'))return;errors.push(error.message);});await page.goto('https://kick.com/nightshift');
 if(engine==='firefox'){for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:`extension/${file}`});const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));for(const file of ['clip-tools.js','clip-catalog.js','clip-history.js','clip-window.js','clip-workspace.js','clip-studio.js',...manifest.content_scripts.find(script=>script.js?.includes('content.js')).js])await page.addScriptTag({path:`extension/${file}`});}
 await page.getByRole('button',{name:'Open multiview',exact:true}).click();const workspace=page.locator('#kr-multi-root');
 await workspace.getByRole('button',{name:'Manage',exact:true}).click();
 assert.equal(await workspace.getByRole('combobox',{name:'Player mode',exact:true}).inputValue(),'full','new multistreams default to Full Kick players');
 const add=async slug=>{await workspace.getByRole('combobox',{name:'Add channel to multiview',exact:true}).fill(slug);await workspace.getByRole('button',{name:'Add stream',exact:true}).click();};
 await add('alpha');await add('beta');
 const frameFor=slug=>page.frames().find(frame=>frame.url().includes(`/${slug}?immersion-frame=full`));
 await workspace.getByRole('group',{name:'Switch stream details'}).getByRole('button',{name:'beta',exact:true}).click();
 await workspace.locator('.channel-pool-title').filter({hasText:'beta live'}).waitFor();
 await page.evaluate(()=>{const root=document.getElementById('kr-multi-root').shadowRoot;window.keptDirectoryCard=root.querySelector('.multi-channel-card[data-channel="beta"]').closest('.channel-panel');window.keptChatOption=root.querySelector('#multi-chat-channel option[value="beta"]');});
 await workspace.getByRole('combobox',{name:'Multiview layout',exact:true}).selectOption('columns');
 assert.equal(await workspace.locator('[data-channel-pool] .channel-pool-avatar').count(),3,'Columns also shows the stream pool');
 assert.equal(await page.evaluate(()=>{const root=document.getElementById('kr-multi-root').shadowRoot;return keptDirectoryCard===root.querySelector('.multi-channel-card[data-channel="beta"]').closest('.channel-panel')&&keptChatOption===root.querySelector('#multi-chat-channel option[value="beta"]');}),true,'unrelated layout updates preserve directory cards and chat options');
 await workspace.getByRole('combobox',{name:'Multiview layout',exact:true}).selectOption('grid');
 await workspace.locator('.multi-player-loading:visible').waitFor({state:'detached'}).catch(()=>{});
 for(const slug of ['alpha','beta']){
  const frame=frameFor(slug);assert.ok(frame,`${slug} uses the full channel page`);
  if(engine==='firefox'){await frame.waitForSelector('video',{state:'attached'});for(const file of ['stream-clock.js','performance.js','full-player-frame.js','player-controls.js','player-frame.js'])await frame.addScriptTag({path:`extension/${file}`});}
  await frame.waitForSelector('[data-kr-full-player-root]');await frame.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await frame.waitForFunction(()=>document.querySelector('[data-kr-elapsed]')?.textContent?.startsWith('3:'));assert.match(await frame.locator('[data-kr-elapsed]').textContent(),/^3:\d{2}:\d{2}$/,'new players show total broadcast uptime');
  assert.equal(await frame.locator('#kr-root,#kr-multi-root').count(),0,'full frames do not recursively create Immersion workspaces');
  for(const selector of ['#page-nav','#page-sidebar','#channel-content','#channel-chatroom'])assert.equal(await frame.locator(selector).isVisible(),false,`${selector} is hidden in the player-only frame`);
  const geometry=await frame.locator('[data-kr-full-player-root]').evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};});
  assert.ok(Math.abs(geometry.x)<1&&Math.abs(geometry.y)<1&&Math.abs(geometry.width-geometry.viewportWidth)<2&&Math.abs(geometry.height-geometry.viewportHeight)<2,'the full player fills its pane');
  await frame.getByRole('button',{name:'Quality',exact:true}).click();await frame.getByRole('button',{name:'1080p',exact:true}).click();assert.equal(await frame.evaluate(()=>qualitySelections),1,'native quality menu remains interactive');
  await frame.getByRole('button',{name:'Clip',exact:true}).click();const studio=page.locator('#kr-clip-studio-root');await studio.getByRole('dialog').waitFor();assert.equal(await studio.getByRole('combobox',{name:'Stream to clip'}).inputValue(),slug,'full-player clipping opens the selected stream in the isolated studio');assert.equal(await frame.locator('#clip-dialog').count(),0,'the live frame never mounts a competing clip preview');await studio.getByRole('button',{name:'Close clip studio',exact:true}).click();
  await frame.getByRole('slider',{name:'Playback timeline',exact:true}).fill('50');assert.ok(await frame.locator('video').evaluate(video=>video.currentTime>0),'native timeline keeps its seeking handler');
  if(slug==='beta'){
   await frame.evaluate(()=>{document.querySelector('[data-action=quality]').remove();const overlay=document.createElement('div');overlay.className='z-controls top-0';overlay.innerHTML='<button data-action="quality" aria-label="Quality" aria-haspopup="menu">Quality</button><button aria-label="Pause">Pause</button>';document.querySelector('#injected-channel-player').append(overlay);});
   await frame.locator('.z-controls.top-0 [data-kr-unified-source]').first().waitFor({state:'attached'});assert.equal(await frame.locator('.z-controls.top-0').isVisible(),false,'compact top controls do not duplicate the shared strip');
   await frame.getByRole('button',{name:'Quality',exact:true}).click();await frame.getByRole('button',{name:'1080p',exact:true}).click();assert.equal(await frame.evaluate(()=>qualitySelections),2,'a native action from the compact top overlay works through the same bottom strip');
  }
 }
 const alpha=frameFor('alpha'),beta=frameFor('beta');
 await alpha.getByRole('button',{name:'Focus stream',exact:true}).click();await alpha.waitForFunction(()=>!document.querySelector('video').muted);assert.equal(await beta.locator('video').evaluate(video=>video.muted),true);
 const volume=alpha.getByRole('slider',{name:'Volume',exact:true});await volume.dispatchEvent('pointerdown');await volume.fill('29');await beta.getByRole('button',{name:'Focus stream',exact:true}).click();
 await beta.waitForFunction(()=>!document.querySelector('video').muted&&Math.abs(document.querySelector('video').volume-.29)<.001);assert.equal(await alpha.locator('video').evaluate(video=>video.muted),true,'focus mutes the previous full player');
 await alpha.evaluate(()=>{const video=document.querySelector('video');video.muted=false;});await alpha.waitForFunction(()=>document.querySelector('video').muted===true);
 await beta.evaluate(()=>{document.getElementById('injected-channel-player').outerHTML=window.playerMarkup;});await beta.waitForSelector('[data-kr-full-player-root]');await beta.waitForFunction(()=>!document.querySelector('video').muted&&Math.abs(document.querySelector('video').volume-.29)<.001);
 assert.equal(await beta.locator('#page-sidebar').isVisible(),false,'isolation recovers after React replaces the player');
 await beta.getByRole('button',{name:'Return to grid',exact:true}).click();assert.equal(frameFor('alpha'),alpha,'layout changes retain the same full player');
 // Reproduce Kick's narrow-pane layout: centre playback only, collapsed volume.
 await beta.evaluate(()=>{document.querySelector('[data-action=pause]').style.display='none';document.querySelector('[aria-label="Native volume"]').style.display='none';document.querySelector('.z-controls').append(document.createElement('span'));});
 const supplemental=beta.locator('[data-kr-unified-row]');await supplemental.getByRole('button',{name:'Pause',exact:true}).click();await beta.waitForFunction(()=>document.querySelector('video').paused);
 await supplemental.getByRole('button',{name:'Play',exact:true}).click();await beta.waitForFunction(()=>!document.querySelector('video').paused);
 await supplemental.getByRole('slider',{name:'Volume',exact:true}).fill('37');await beta.waitForFunction(()=>!document.querySelector('video').muted&&Math.abs(document.querySelector('video').volume-.37)<.001);
 assert.equal(await alpha.locator('video').evaluate(video=>video.muted),true,'supplemental volume keeps exclusive audio ownership');
 await beta.getByRole('button',{name:'Mute',exact:true}).hover();await beta.locator('[aria-label="Native volume"]').evaluate(node=>node.style.display='block');
 assert.equal(await beta.getByRole('slider',{name:'Volume',exact:true}).count(),1,'hover exposes exactly one volume slider');assert.equal(await beta.locator('[aria-label="Native volume"]').isVisible(),false,'Kick volume expansion stays hidden behind the shared strip');
 assert.equal(await beta.getByRole('button',{name:'Go live',exact:true}).evaluate(node=>node.getBoundingClientRect().height),24,'LIVE uses the compact shared sizing');
 assert.equal(await beta.getByRole('button',{name:'Clip',exact:true}).evaluate(node=>node.textContent.trim()),'','Clip uses the same padded icon treatment as other actions');
 const compact=await supplemental.locator('[data-kr-action=play]').evaluate(button=>({height:button.getBoundingClientRect().height,gap:getComputedStyle(button.parentElement).gap}));assert.equal(compact.height,28);assert.ok(['5px','8px'].includes(compact.gap));
 await workspace.getByRole('button',{name:'Manage',exact:true}).click();await workspace.getByRole('button',{name:'Manage',exact:true}).click();
 await add('blocked');await workspace.getByRole('button',{name:'Use embed for blocked',exact:true}).click();await workspace.locator('.multi-tile[data-channel=blocked][data-player-mode=embed-fallback]').waitFor();await workspace.locator('.multi-tile[data-channel=blocked] iframe').contentFrame().locator('video').waitFor({state:'attached'});assert.ok(page.frames().some(frame=>frame.url().startsWith('https://player.kick.com/blocked')),'a blocked full page can fall back without relaxing framing protections');
 await workspace.getByRole('button',{name:'Switch alpha to standard embed',exact:true}).click();await workspace.locator('.multi-tile[data-channel=alpha][data-player-mode=embed]').waitFor();
 await workspace.locator('.multi-tile[data-channel=alpha] iframe').contentFrame().locator('video').waitFor({state:'attached'});assert.ok(page.frames().some(frame=>frame.url().startsWith('https://player.kick.com/alpha')),'a loaded full player can also fall back');
 await workspace.getByRole('button',{name:'Use full player for alpha',exact:true}).click();
 await workspace.locator('iframe[name="kick-refined-full:alpha"]').contentFrame().locator('video').waitFor({state:'attached'});
 const retried=frameFor('alpha');if(engine==='firefox')for(const file of ['stream-clock.js','performance.js','full-player-frame.js','player-controls.js','player-frame.js'])await retried.addScriptTag({path:`extension/${file}`});
 await retried.waitForSelector('[data-kr-full-player-root]');await workspace.getByRole('button',{name:'Switch alpha to standard embed',exact:true}).waitFor({state:'visible'});
 await mkdir('artifacts',{recursive:true});await workspace.screenshot({path:`artifacts/${engine}-full-players.png`});
 await workspace.getByRole('combobox',{name:'Player mode',exact:true}).selectOption('embed');assert.equal(page.frames().some(frame=>frame.url().includes('immersion-frame=full')),false,'switching modes disposes full player pages');
 await workspace.getByRole('button',{name:'Use full player for beta',exact:true}).click();
 await workspace.locator('iframe[name="kick-refined-full:beta"]').contentFrame().locator('video').waitFor({state:'attached'});
 assert.ok(page.frames().some(frame=>frame.url().includes('/beta?immersion-frame=full')),'a pane can choose full mode while the workspace uses embeds');
 await workspace.getByRole('button',{name:'Close multiview',exact:true}).click();assert.equal(await page.locator('#kr-multi-root').count(),0);
 assert.deepEqual(errors,[]);console.log(`${engine}: full channel isolation, two concurrent players, native quality/timeline/dialogs, focus audio, carried volume, player replacement, embed fallback and teardown passed`);
}catch(error){for(const page of context.pages())if(page.url().startsWith('https://kick.com/'))await page.screenshot({path:`artifacts/${engine}-full-players-failure.png`}).catch(()=>{});throw error;}finally{await context.close();await browser?.close();}
