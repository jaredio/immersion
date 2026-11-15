/* Profile clips use the real playback engine; all pages/media are local fixtures. */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';
import {extensionWorker} from './extension-worker.mjs';
import {execFileSync} from 'node:child_process';

const engine=process.env.KR_ENGINE||'chromium',root=process.cwd(),assets=await workspaceFixtures();
const ids=[1,2,3].map(value=>'clip_'+String(value).padStart(26,'0'));
const rows=ids.map((id,i)=>({id,title:['Clip one','Clip two','Clip three'][i],duration:2,views:100+i,privacy:'public',channel:{slug:'native'},thumbnail_url:`https://clips.kick.com/${id}/thumbnail.webp`,creator:{slug:'creator'},created_at:'2026-11-14T12:00:00Z'}));
const card=(row,i)=>`<article data-testid="clips-card"><a data-testid="media-card-thumbnail" href="/native/clips/${row.id}"><img data-thumbnail src="${row.thumbnail_url}" alt=""><span>0:02</span></a><a href="/native/clips/${row.id}"><h3>${row.title}</h3></a></article>`;
const profile=`<div id="channel-content"><header class="native-header"><div><button><img data-testid="channel-avatar" src="https://clips.kick.com/avatar.webp"><span class="live-badge">LIVE</span></button><button><h1 data-testid="channel-username">native</h1></button><h2 data-testid="livestream-title">Profile preview fixture</h2><a href="/category/music">Music</a></div><div><button data-testid="follow-button" aria-label="Follow">Follow</button></div></header><nav class="native-tabs"><a href="/native">Home</a><a href="/native/about">About</a><a href="/native/videos">Videos</a><a href="/native/clips" aria-current="page">Clips</a></nav><div>${rows.map(card).join('')}</div></div>`;
const fixture=assets.fixture.replace(/<div class="stream-info">.*?<\/div>/,'').replace('</main>',profile+'</main>').replace('<div id="chatroom-messages"></div>',`<div id="chatroom-messages"><div data-index="1"><a href="https://kick.com/native/clips/${ids[0]}">A clip in chat</a></div></div>`).replace('<head>','<head><style>.native-header{display:flex;justify-content:space-between}.native-header img{width:50px;height:50px}.native-tabs{display:flex;gap:20px}article img{width:200px}@media(max-width:900px){main{width:calc(100% - 24px)!important;margin:12px!important}#channel-chatroom{display:none}}</style>');
let browser,context,offline=false,metadataRequests=0,segments=0,hold=false,releaseMetadata,fail=false,replayRequests=0,replayFail=false,replayStatus=503;
if(engine==='chromium'){
  const extension=path.join(root,'dist/chrome');context=await chromium.launchPersistentContext(path.join(root,`tmp/clip-preview-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=await extensionWorker(context);await worker.evaluate(()=>chrome.storage.local.set({settings:{chatClips:false}}));
}else{
  browser=await firefox.launch({headless:true});context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{const values={settings:{chatClips:false}},listeners=[];window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>values,set:async patch=>{Object.assign(values,patch);if(patch.settings)for(const fn of listeners)fn({settings:{newValue:patch.settings}},'local');}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}}}};});
  for(const file of ['scroll.js','native-search-bridge.js'])await context.addInitScript({path:'extension/'+file});
}
try{
  await context.route('https://kick.com/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:url.pathname.endsWith('/mux.mjs')?'dist/firefox/vendor/mux.mjs':url.pathname.includes('/vendor/')?'node_modules/hls.js/dist/hls.light.mjs':'extension/'+url.pathname.split('/').pop(),headers:{'access-control-allow-origin':'*'}});
    if(/^\/api\/v2\/channels\/[^/]+$/.test(url.pathname)){const slug=url.pathname.split('/').pop();return route.fulfill({json:{slug,user:{username:slug},livestream:offline&&slug==='native'?null:{is_live:true,session_title:'Live fixture'}}});}
    if(url.pathname.endsWith('/clips')&&url.pathname.startsWith('/api/'))return route.fulfill({json:{clips:rows}});
    if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
    if(url.pathname.startsWith('/api/v2/clips/')){
      metadataRequests++;const id=url.pathname.split('/').pop();
      if(hold)await new Promise(resolve=>releaseMetadata=resolve);
      return route.fulfill(fail?{status:503,body:'Unavailable'}:{json:{clip:{id,title:rows.find(row=>row.id===id)?.title||'Clip',channel_id:123,started_at:'2026-11-15T00:00:00Z',duration:4,channel:{slug:'native',username:'Native',profile_picture:'https://files.kick.com/avatar.webp'},creator:{username:'ClipCreator'},video_url:`https://clips.kick.com/${id}/playlist.m3u8`}}}).catch(()=>{});
    }
    return route.fulfill({contentType:'text/html',body:offline?fixture.replace('<span class="live-badge">LIVE</span>',''):fixture});
  });
  await context.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#83b7a2"/></svg>'}));
  await context.route('https://web.kick.com/api/v1/chat/123/history?*',route=>{
    replayRequests++;
    return route.fulfill(replayFail?{status:replayStatus,body:'Unavailable',headers:{'access-control-allow-origin':'*'}}:{headers:{'access-control-allow-origin':'*'},json:{data:{messages:[{id:'a',created_at:'2026-11-15T00:00:00Z',content:'First replay message <script>evil</script>',sender:{username:'FirstViewer',identity:{color:'#b0ff8c'}}},{id:'b',created_at:'2026-11-15T00:00:02Z',content:'Later message [emote:1:Hello]',sender:{username:'SecondViewer'}}]}}});
  });
  await context.route('https://clips.kick.com/**',route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop(),headers={'access-control-allow-origin':'*'};
    if(name.endsWith('.webp'))return route.fulfill({headers,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#263a32"/><text x="35" y="100" fill="#b0ff8c" font-family="sans-serif" font-size="25">Clip preview</text></svg>'});
    const mediaRoot=path.join(root,'tests/clip-media',engine==='chromium'?'vp9':'');
    if(name==='playlist.m3u8')return route.fulfill({headers,contentType:'application/vnd.apple.mpegurl',path:path.join(mediaRoot,name)});
    if(name==='init.mp4')return route.fulfill({headers,contentType:'video/mp4',path:path.join(mediaRoot,name)});
    if(/^segment-\d\.(?:ts|m4s)$/.test(name)){segments++;return route.fulfill({headers,contentType:name.endsWith('.ts')?'video/mp2t':'video/mp4',path:path.join(mediaRoot,name)});}
    return route.abort();
  });
  await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:assets.frame}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  const load=async(workspace=false)=>{
    const url=new URL('https://kick.com/native/clips');if(offline)url.searchParams.set('offline','1');
    if(workspace){url.searchParams.set('refined-multi','native,a');url.searchParams.set('immersion-player','embed');}
    await page.goto(url.href);
    if(engine==='firefox'){
      for(const file of ['theme.css','polish.css','discovery.css'])await page.addStyleTag({path:'extension/'+file});
      const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));
      for(const file of manifest.content_scripts.find(item=>item.js?.includes('content.js')).js)await page.addScriptTag({path:'extension/'+file});
    }
    await page.locator('#kr-channel-library .items .card').nth(2).waitFor();
  };
  const preview=page.locator('#kr-clip-preview'),library=page.locator('#kr-channel-library');
  const video=()=>preview.locator('video');
  const waitVideo=()=>page.waitForFunction(()=>document.getElementById('kr-clip-preview')?.shadowRoot.querySelector('.kr-chat-clip')?.shadowRoot.querySelector('video')?.readyState>=2);
  const nativePlaying=()=>page.evaluate(()=>document.querySelector('main video').play());
  await load();assert.equal(metadataRequests,0,'profile arrival never loads clip metadata or players');assert.equal(replayRequests,0,'profile arrival never requests replay');
  for(const state of [false,true]){
    offline=state;if(state)await load();
    await nativePlaying();const original=page.url(),pages=context.pages().length;
    const query=library.getByRole('searchbox',{name:'Find a video'});await query.fill('one');const thumb=library.locator('.items .thumb').first();
    await thumb.click();await preview.getByRole('dialog').waitFor();await waitVideo();
    assert.equal(page.url(),original);assert.equal(context.pages().length,pages,'plain clicks never create a page');
    assert.equal(await page.evaluate(()=>document.querySelector('main video').paused),true,'background playback pauses while previewing');
    assert.equal(await video().evaluate(node=>node.muted),false,'profile playback is independent of disabled chat clips');
    assert.equal(await page.locator('#chatroom-messages .kr-chat-clip').count(),0,'preview playback never enables chat scanning');
    assert.equal(await preview.locator('dialog').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(17, 17, 21)');
    assert.equal(await preview.locator('footer .credit').textContent(),'Clipped by ClipCreator');
    assert.equal(await preview.locator('.eyebrow > span').textContent(),'Native');
    assert.equal(await preview.locator('.avatar img').getAttribute('src'),'https://files.kick.com/avatar.webp');
    assert.equal(await preview.locator('.avatar').evaluate(node=>getComputedStyle(node).borderRadius),'50%');
    assert.equal(await preview.getByRole('link',{name:'Open on Kick'}).getAttribute('href'),`https://kick.com/native/clips/${ids[0]}`);
    await video().evaluate(node=>window.closedPreviewVideo=node);
    await preview.getByRole('button',{name:'Close clip preview',exact:true}).click();await preview.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>closedPreviewVideo.paused&&!closedPreviewVideo.isConnected&&!closedPreviewVideo.getAttribute('src')),true,'close stops and disconnects the media');
    assert.equal(await query.inputValue(),'one');assert.equal(await thumb.evaluate(node=>node.getRootNode().activeElement===node),true,'close restores the clip focus without resetting filters');
    await page.waitForFunction(()=>!document.querySelector('main video').paused);
    await thumb.click();await waitVideo();await video().focus();await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});
    await page.waitForFunction(()=>!document.querySelector('main video').paused);
    await query.fill('');
  }
  await library.locator('.items .thumb').first().click();await waitVideo();
  await video().evaluate(node=>{node.pause();node.currentTime=0;window.replayOriginalVideo=node;});
  await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();
  await preview.getByText('FirstViewer',{exact:true}).waitFor();
  assert.ok((await preview.locator('.replay-messages').textContent()).includes('<script>evil</script>'),'messages render as text');assert.equal(await preview.locator('.replay-messages script').count(),0);
  assert.equal(await preview.getByText('SecondViewer',{exact:true}).count(),0,'future messages stay hidden');
  await video().evaluate(node=>{node.currentTime=2.5;node.dispatchEvent(new Event('timeupdate'));});await preview.getByText('SecondViewer',{exact:true}).waitFor();
  await video().evaluate(node=>{node.currentTime=0;node.dispatchEvent(new Event('timeupdate'));});await preview.getByText('SecondViewer',{exact:true}).waitFor({state:'detached'});
  const replayCount=replayRequests;await preview.getByRole('button',{name:'Close chat replay',exact:true}).click();assert.equal(await preview.locator('.replay').count(),0);assert.equal(await video().evaluate(node=>node===window.replayOriginalVideo),true,'closing replay preserves the clip player');assert.equal(replayRequests,replayCount);
  replayFail=true;await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();await preview.getByText('Chat replay is temporarily unavailable. Try again.',{exact:true}).waitFor();assert.equal(await preview.locator('.replay-note').isVisible(),false,'failed replay never claims to be synced');replayFail=false;await preview.getByRole('button',{name:'Retry chat replay'}).click();await preview.getByText('FirstViewer',{exact:true}).waitFor();await preview.getByRole('button',{name:'Close chat replay',exact:true}).click();
  replayFail=true;replayStatus=404;await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();await preview.getByText('Kick no longer has chat replay for this clip.',{exact:true}).waitFor();assert.equal(await preview.getByRole('button',{name:'Retry chat replay'}).isVisible(),false);assert.equal(await preview.locator('.replay-note').isVisible(),false);await preview.getByRole('button',{name:'Close chat replay',exact:true}).click();replayFail=false;replayStatus=503;
  const downloadEvent=page.waitForEvent('download',{timeout:30000}).catch(async error=>{console.error('Download status:',await preview.locator('.action-status').textContent());throw error;});await preview.getByRole('button',{name:'Download clip',exact:true}).click();const downloaded=await downloadEvent;
  assert.ok(downloaded.suggestedFilename().endsWith('.mp4'));const downloadPath=path.join(root,`artifacts/${engine}-profile-clip.mp4`);await downloaded.saveAs(downloadPath);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json',downloadPath],{encoding:'utf8',windowsHide:true}));
  assert.ok(probe.streams.some(stream=>stream.codec_type==='video'),'download contains a playable video track');assert.ok(Number(probe.format.duration)>=3.9,'download includes the whole clip');
  assert.equal(await preview.locator('.action-status').textContent(),'MP4 ready. Your download has started.');
  await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});
  await library.locator('.items .thumb').first().click();await waitVideo();
  await page.mouse.click(2,2);await preview.waitFor({state:'detached'});
  for(const width of [1440,760,390]){
    await page.setViewportSize({width,height:900});await library.locator('.items .thumb').first().click();await waitVideo();
    await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();await preview.getByText('FirstViewer',{exact:true}).waitFor();
    assert.equal(await preview.getByRole('button',{name:'Close chat replay',exact:true}).evaluate(button=>{const icon=button.querySelector('svg').getBoundingClientRect(),box=button.getBoundingClientRect();return Math.abs(icon.x+icon.width/2-box.x-box.width/2)<.5&&Math.abs(icon.y+icon.height/2-box.y-box.height/2)<.5;}),true,'chat close icon stays centered at every viewport');
    assert.equal(await preview.locator('dialog').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),true,'preview stays within the viewport');
    await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/${engine}-clip-preview-${width}.png`});
    await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await nativePlaying();await library.locator('.items .thumb').first().click();await waitVideo();
  await video().evaluate(node=>window.replacedPreviewVideo=node);
  await library.locator('.items .thumb').nth(1).evaluate(node=>node.click());await preview.getByRole('heading',{name:'Clip two',exact:true}).waitFor();await waitVideo();
  assert.equal(await preview.count(),1);assert.equal(await page.evaluate(()=>replacedPreviewVideo.paused&&!replacedPreviewVideo.isConnected),true,'replacing a preview releases its old player');
  await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('main video').paused);
  hold=true;const requested=page.waitForRequest(request=>request.url().includes('/api/v2/clips/'+ids[2]));
  await library.locator('.items .thumb').nth(2).click();await requested;
  const aborted=page.waitForEvent('requestfailed',{predicate:request=>request.url().includes('/api/v2/clips/'+ids[2])});
  await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});await aborted;
  hold=false;releaseMetadata();await page.waitForTimeout(50);assert.equal(await preview.count(),0,'late replies never reopen the dialog');
  fail=true;await library.locator('.items .thumb').nth(2).click();
  await preview.getByText('Could not load this video. Retry Play or open it on Kick.',{exact:true}).waitFor();
  assert.ok(await preview.getByRole('button',{name:'Close clip preview'}).isVisible());await page.keyboard.press('Escape');fail=false;
  const popup=context.waitForEvent('page');await library.locator('.items .thumb').first().click({modifiers:['Control']});const separate=await popup;
  await separate.waitForURL(`**/${ids[0]}`);await separate.close();assert.equal(await preview.count(),0,'modified clicks preserve native new-tab behavior');
  await library.locator('.items .thumb').first().click();await waitVideo();
  await page.evaluate(()=>{history.pushState({},'','/another-channel');window.dispatchEvent(new PopStateEvent('popstate'));});await preview.waitFor({state:'detached'});
  await load(true);const workspace=page.locator('#kr-multi-root');await workspace.locator('.multi-tile[data-channel="a"] iframe').waitFor();
  const other=page.frames().find(frame=>frame.url().startsWith('https://player.kick.com/a'))||await page.waitForEvent('framenavigated',{predicate:frame=>frame.url().startsWith('https://player.kick.com/a')});
  if(engine==='firefox')for(const file of ['stream-clock.js','performance.js','player-dom.js','player-controls.js','player-frame.js'])await other.addScriptTag({path:'extension/'+file});
  await other.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await workspace.locator('.multi-tile[data-channel="a"] .multi-audio-toggle').evaluate(node=>node.click());await other.waitForFunction(()=>!document.querySelector('video').muted);
  await library.locator('.items .thumb').first().click();await waitVideo();await other.waitForFunction(()=>document.querySelector('video').muted);
  await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});await other.waitForFunction(()=>!document.querySelector('video').muted);
  await load();await library.locator('.items .thumb').first().click();await waitVideo();
  if(engine==='chromium')await (await extensionWorker(context)).evaluate(()=>chrome.storage.local.set({settings:{enabled:false,chatClips:false}}));
  else await page.evaluate(()=>browser.storage.local.set({settings:{enabled:false,chatClips:false}}));
  await preview.waitFor({state:'detached'});assert.equal(await page.locator('#kr-channel-root video').count(),0);assert.ok(segments>0,'real HLS media played');assert.deepEqual(errors,[]);
  console.log(`${engine}: clip identity, MP4 download, synchronized/retryable replay, online/offline previews, playback, focus/filter retention, close, responsive sizing, cancellation, failures, modified links and teardown passed`);
}finally{await context.close();await browser?.close();}
