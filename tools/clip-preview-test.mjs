import {kickIdleScripts} from './kick-content-scripts.mjs';
/* Profile clips and recordings use the real engine; pages/media are local fixtures. */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';
import {extensionWorker} from './extension-worker.mjs';
import {execFileSync} from 'node:child_process';

const engine=process.env.KR_ENGINE||'chromium',root=process.cwd(),assets=await workspaceFixtures();
const ids=[1,2,3].map(value=>'clip_'+String(value).padStart(26,'0'));
const vod='00000000-0000-0000-0000-000000000001',vodHref=`https://kick.com/native/videos/${vod}`;
const rows=ids.map((id,i)=>({id,title:['Clip one','Clip two','Clip three'][i],duration:2,views:100+i,privacy:'public',channel:{slug:'native'},thumbnail_url:`https://clips.kick.com/${id}/thumbnail.webp`,creator:{slug:'creator'},created_at:'2026-11-14T12:00:00Z'}));
const card=(row,i)=>`<article data-testid="clips-card"><a data-testid="media-card-thumbnail" href="/native/clips/${row.id}"><img data-thumbnail src="${row.thumbnail_url}" alt=""><span>0:02</span></a><a href="/native/clips/${row.id}"><h3>${row.title}</h3></a></article>`;
const vodCard=`<article data-testid="vods-card"><a data-testid="media-card-thumbnail" href="${vodHref}"><img data-thumbnail src="https://clips.kick.com/recording.webp" alt=""><span>2:03:04</span></a><a href="${vodHref}"><h3>Profile recording</h3></a></article>`;
const profile=`<div id="channel-content"><header class="native-header"><div><button><img data-testid="channel-avatar" src="https://clips.kick.com/avatar.webp"><span class="live-badge">LIVE</span></button><button><h1 data-testid="channel-username">native</h1></button><h2 data-testid="livestream-title">Profile preview fixture</h2><a href="/category/music">Music</a></div><div><button data-testid="follow-button" aria-label="Follow">Follow</button></div></header><nav class="native-tabs"><a href="/native">Home</a><a href="/native/about">About</a><a href="/native/videos">Videos</a><a href="/native/clips" aria-current="page">Clips</a></nav><div>${rows.map(card).join('')}</div></div>`;
const fixture=assets.fixture.replace(/<div class="stream-info">.*?<\/div>/,'').replace('</main>',profile.replace('</nav>','</nav>'+vodCard)+'</main>').replace('<div id="chatroom-messages"></div>',`<div id="chatroom-messages"><div data-index="1"><a href="https://kick.com/native/clips/${ids[0]}">A clip in chat</a></div></div>`).replace('<head>','<head><style>.native-header{display:flex;justify-content:space-between}.native-header img{width:50px;height:50px}.native-tabs{display:flex;gap:20px}article img{width:200px}@media(max-width:900px){main{width:calc(100% - 24px)!important;margin:12px!important}#channel-chatroom{display:none}}</style>');
let browser,context,offline=false,remoteCatalog=false,metadataRequests=0,vodRequests=0,segments=0,hold=false,releaseMetadata,fail=false,replayRequests=0,replayFail=false,replayStatus=503;
let denseReplay=false;
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
    if(url.pathname==='/api/v2/channels/native/videos')return route.fulfill({json:remoteCatalog?[{session_title:'Profile recording',duration:7384000,thumbnail:{src:'https://clips.kick.com/recording.webp'},video:{uuid:vod,status:'public',created_at:'2026-11-14T12:00:00Z'}}]:[]});
    if(url.pathname===`/api/v1/video/${vod}`){vodRequests++;return route.fulfill(fail?{status:503,body:'Unavailable'}:{json:{uuid:vod,created_at:'2026-11-14T12:00:00Z',source:'https://stream.kick.com/recording/media/hls/master.m3u8',status:'public',livestream:{views:12345,session_title:'Profile recording',duration:7384000,channel:{slug:'native',user:{username:'Native',profilepic:'https://files.kick.com/avatar.webp'}}}}});}
    if(url.href===vodHref)return route.fulfill({status:404,contentType:'text/html',body:'<!doctype html><title>Video Not Found - KICK Streaming</title>'});
    if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
    if(url.pathname.startsWith('/api/v2/clips/')){
      metadataRequests++;const id=url.pathname.split('/').pop();
      if(hold)await new Promise(resolve=>releaseMetadata=resolve);
      return route.fulfill(fail?{status:503,body:'Unavailable'}:{json:{clip:{id,title:rows.find(row=>row.id===id)?.title||'Clip',views:5432,created_at:'2026-11-14T12:00:00Z',channel_id:123,started_at:'2026-11-15T00:00:00Z',duration:4,channel:{slug:'native',username:'Native',profile_picture:'https://files.kick.com/avatar.webp'},creator:{username:'ClipCreator'},video_url:`https://clips.kick.com/${id}/playlist.m3u8`}}}).catch(()=>{});
    }
    return route.fulfill({contentType:'text/html',body:offline?fixture.replace('<span class="live-badge">LIVE</span>',''):fixture});
  });
  await context.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#83b7a2"/></svg>'}));
  await context.route('https://web.kick.com/api/v1/chat/123/history?*',route=>{
    replayRequests++;
    return route.fulfill(replayFail?{status:replayStatus,body:'Unavailable',headers:{'access-control-allow-origin':'*'}}:{headers:{'access-control-allow-origin':'*'},json:{data:{messages:[{id:'a',created_at:'2026-11-15T00:00:00Z',content:'First replay message <script>evil</script>',sender:{username:'FirstViewer',identity:{color:'#b0ff8c'}}},{id:'b',created_at:'2026-11-15T00:00:02Z',content:'Later message [emote:1:Hello]',sender:{username:'SecondViewer'}},...(denseReplay?Array.from({length:60},(_,i)=>({id:`dense-${i}`,created_at:'2026-11-15T00:00:02Z',content:`A busy replay message ${i} with some text that can wrap and an emote [emote:1:Hello]`,sender:{username:`Viewer${i}`}})):[])]}}});
  });
  await context.route(/^https:\/\/(?:clips|stream)\.kick\.com\//,route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop(),headers={'access-control-allow-origin':'*'};
    if(name.endsWith('.webp'))return route.fulfill({headers,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#263a32"/><text x="35" y="100" fill="#b0ff8c" font-family="sans-serif" font-size="25">Clip preview</text></svg>'});
    const mediaRoot=path.join(root,'tests/clip-media',engine==='chromium'?'vp9':'');
    if(name==='playlist.m3u8'||name==='master.m3u8')return route.fulfill({headers,contentType:'application/vnd.apple.mpegurl',path:path.join(mediaRoot,'playlist.m3u8')});
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
      for(const file of kickIdleScripts(manifest))await page.addScriptTag({path:'extension/'+file});
    }
    await page.locator('#kr-channel-library .items .card').nth(2).waitFor({state:workspace?'attached':'visible'});
  };
  const preview=page.locator('#kr-clip-preview'),library=page.locator('#kr-channel-root #kr-channel-library');
  const video=()=>preview.locator('video');
  const waitVideo=()=>page.waitForFunction(()=>document.getElementById('kr-clip-preview')?.shadowRoot.querySelector('.kr-chat-clip')?.shadowRoot.querySelector('video')?.readyState>=2);
  const nativePlaying=()=>page.evaluate(()=>document.querySelector('main video').play());
  // Inspect cancellation after the app's delegated handler, then stop the test
  // click before it leaves the fixture page (Chromium popups can bypass routing).
  const modifiedLinks=async(target,href)=>{
    for(const modifier of ['ctrlKey','metaKey','shiftKey','altKey']){
      const result=await target.evaluate((node,modifier)=>new Promise(resolve=>{
        node.getRootNode().addEventListener('click',event=>{resolve({prevented:event.defaultPrevented,href:node.href});event.preventDefault();},{once:true});
        node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,[modifier]:true}));
      }),modifier);
      assert.deepEqual(result,{prevented:false,href},`${modifier} retains native link handling`);assert.equal(await preview.count(),0);
    }
  };
  await load();assert.equal(metadataRequests,0,'profile arrival never loads clip metadata or players');assert.equal(replayRequests,0,'profile arrival never requests replay');
  // Starting a workspace with an expanded profile transfers its selected tab.
  await page.getByRole('button',{name:'Immersion settings',exact:true}).click();
  await page.getByRole('button',{name:'Multiview',exact:true}).click();
  const profileWorkspace=page.locator('#kr-multi-root');
  await profileWorkspace.locator('.channel-profile-region .items .card').first().waitFor();
  assert.equal(await page.locator('#kr-channel-root').isVisible(),false,'expanded native profile is hidden while the workspace owns details');
  assert.equal(await profileWorkspace.locator('.channel-profile-region .nav [aria-current="page"]').textContent(),'Clips');
  await profileWorkspace.getByRole('button',{name:'Manage',exact:true}).click();
  await profileWorkspace.locator('#multi-add').fill('second');
  await profileWorkspace.getByRole('button',{name:'Add stream',exact:true}).click();
  await profileWorkspace.locator('.multi-tile[data-channel="second"]').waitFor();
  assert.equal(await profileWorkspace.locator('.channel-profile-region').count(),1,'adding a stream keeps one expanded workspace profile');
  assert.equal(await profileWorkspace.locator('.channel-profile-region .nav [aria-current="page"]').textContent(),'Clips','adding a stream preserves the expanded profile tab');
  assert.equal(await page.locator('#kr-channel-root').isVisible(),false,'adding a stream never reveals a duplicate native profile');
  await profileWorkspace.getByRole('button',{name:'Close multiview',exact:true}).click();
  await page.locator('#kr-channel-root').waitFor({state:'visible'});
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
    assert.equal(await preview.locator('footer .media-detail-creator').textContent(),'Clipped by ClipCreator');
    assert.equal(await preview.locator('footer .media-detail-views').textContent(),'5,432 views');
    assert.equal(await preview.locator('footer .media-detail-date time').getAttribute('datetime'),'2026-11-14T12:00:00.000Z');
    assert.equal(await preview.locator('footer .media-detail svg').count(),3,'view, date and clipper details each have an icon');
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
  for(const state of [false,true]){
    offline=state;await load();const original=page.url(),pages=context.pages().length,before=vodRequests;
    await library.getByRole('link',{name:'Videos',exact:true}).click();
    const query=library.getByRole('searchbox',{name:'Find a video'});await query.fill('Profile recording');
    const thumb=library.locator('.items .thumb').first();await thumb.waitFor();assert.equal(vodRequests,before,'browsing recordings never loads playback metadata');
    await nativePlaying();await thumb.click();await waitVideo();
    assert.equal(page.url(),original);assert.equal(context.pages().length,pages,'recording preview stays on the profile');
    assert.equal(await preview.locator('.eyebrow small').textContent(),'Recording');
    assert.equal(await preview.locator('dialog').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(17, 17, 21)','recordings share the clip styling');
    assert.equal(await video().getAttribute('aria-label'),'Kick recording video');assert.equal(await video().evaluate(node=>node.muted),false);
    assert.equal(await page.evaluate(()=>document.querySelector('main video').paused),true);
    assert.equal(await preview.getByRole('link',{name:'Open on Kick'}).getAttribute('href'),vodHref);
    assert.equal(await preview.locator('.footer-actions button:visible').count(),0,'clip-only actions stay hidden for recordings');
    assert.equal(await preview.locator('footer .media-detail-views').textContent(),'12,345 views');
    assert.equal(await preview.locator('footer .media-detail-date time').getAttribute('datetime'),'2026-11-14T12:00:00.000Z');
    assert.equal(await preview.locator('footer .media-detail-creator').count(),0,'recordings do not show a clipper');
    await video().evaluate(node=>window.closedRecordingVideo=node);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      assert.equal(await preview.locator('dialog').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),true);
      await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/${engine}-recording-preview-${state?'offline':'online'}-${width}.png`});
    }
    await preview.getByRole('button',{name:'Close recording preview',exact:true}).click();await preview.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>closedRecordingVideo.paused&&!closedRecordingVideo.isConnected&&!closedRecordingVideo.getAttribute('src')),true);
    assert.equal(await query.inputValue(),'Profile recording');assert.equal(await thumb.evaluate(node=>node.getRootNode().activeElement===node),true);
    await page.waitForFunction(()=>!document.querySelector('main video').paused);await page.setViewportSize({width:1440,height:1000});
    await library.locator('.items .title').first().click();await waitVideo();await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});
    await library.getByRole('link',{name:'Overview',exact:true}).click();await library.getByRole('link',{name:'Watch recording',exact:true}).click();await waitVideo();
    await page.mouse.click(2,2);await preview.waitFor({state:'detached'});
    await library.getByRole('link',{name:'Videos',exact:true}).click();
    await modifiedLinks(library.locator('.items .thumb').first(),vodHref);
  }
  await load();
  {
  // Profile media stays independent of the chat-clips preference (disabled above).
  const workspace=()=>page.locator('#kr-multi-root'),floating=()=>page.locator('.kr-clip-floating');
  const waitFloat=async()=>{try{await page.waitForFunction(()=>document.querySelector('.kr-clip-floating')?.shadowRoot.querySelector('video')?.readyState>=2);}catch(error){console.error(JSON.stringify({errors,state:await page.evaluate(()=>{const root=document.querySelector('.kr-clip-floating')?.shadowRoot,video=root?.querySelector('video');return {exists:!!root,status:root?.querySelector('.status')?.textContent,video:!!video,src:video?.currentSrc,error:video?.error?.message};})}));throw error;}};
  const checkControls=async()=>{
    for(const width of [1440,760,390]){
      await page.setViewportSize({width,height:1000});
      const clear=await workspace().locator('.multi-clip-tile .multi-tile-header').evaluate(header=>{const controls=[...header.querySelectorAll('button')].map(node=>node.getBoundingClientRect()),box=header.getBoundingClientRect();return controls.every((a,i)=>a.left>=box.left&&a.right<=box.right+1&&a.top>=box.top&&a.bottom<=box.bottom+1&&controls.every((b,j)=>i===j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5));});
      assert.equal(clear,true,'workspace clip buttons never overlap at any width');
      if(width===390)await page.screenshot({path:`artifacts/${engine}-workspace-media-controls-390.png`});
    }
    await page.setViewportSize({width:1440,height:1000});
  };
  for(const [tab,title,kind]of [['Clips','Clip one','clip'],['Videos','Profile recording','vod']]){
    console.log(`${engine}: checking ${kind} card drag and floating player`);
    await library.getByRole('link',{name:tab,exact:true}).click();
    const card=library.locator('.items .card').filter({hasText:title}).first();
    await card.locator('.thumb').hover({position:{x:30,y:30}});const cardBox=await card.locator('.thumb').boundingBox(),mainBox=await page.locator('main').boundingBox(),before=metadataRequests+vodRequests;
    await page.mouse.move(cardBox.x+30,cardBox.y+30);await page.mouse.down();await page.mouse.move(cardBox.x+70,cardBox.y+30,{steps:8});
    await page.locator('#kr-multi-drop').waitFor();assert.equal(metadataRequests+vodRequests,before,'dragging a card does not load a player');
    if(kind==='vod'){
      await page.evaluate(()=>{const time=document.createElement('time');time.dateTime='2026-11-15T12:00:00Z';time.textContent='Today';document.querySelector('[data-testid="vods-card"]').append(time);});
      await page.waitForTimeout(100);assert.equal(await page.locator('#kr-multi-drop').count(),1,'feed refreshes preserve an active card drag');
    }
    await page.mouse.move(mainBox.x+100,12,{steps:12});await page.waitForFunction(()=>window.scrollY===0&&document.querySelector('main').scrollTop===0);
    const targetBox=await page.locator('main').boundingBox();await page.mouse.move(targetBox.x+100,targetBox.y+100,{steps:8});await page.mouse.up();
    const tile=workspace().locator(`.multi-tile[data-kind="${kind}"]`);await tile.locator('video').waitFor();
    await checkControls();await workspace().getByRole('button',{name:'Close multiview',exact:true}).click();
    await card.getByRole('button',{name:`Open floating player: ${title}`,exact:true}).click();await waitFloat();
    assert.equal(await preview.count(),0,'the floating player leaves the page usable');
    await floating().locator('video').evaluate(video=>{video.pause();video.currentTime=1;window.floatingOriginalVideo=video;});
    const old=await floating().boundingBox(),grip=await floating().getByRole('button',{name:'Resize player window',exact:true}).boundingBox();
    await page.mouse.move(grip.x+7,grip.y+7);await page.mouse.down();await page.mouse.move(grip.x-60,grip.y-40,{steps:8});await page.mouse.up();
    const resized=await floating().boundingBox();assert.ok(resized.width<old.width-40&&resized.height<old.height-20,'the window resizes from its grip');
    await page.screenshot({path:`artifacts/${engine}-${kind}-floating-window.png`});
    const header=floating().locator('header'),headerBox=await header.boundingBox();
    await page.mouse.move(headerBox.x+35,headerBox.y+18);await page.mouse.down();await page.mouse.move(headerBox.x+55,headerBox.y+18,{steps:6});await page.mouse.up();
    assert.ok((await floating().boundingBox()).x>resized.x+10,'small header drags move the window without docking it');
    const moved=await header.boundingBox(),destination=await page.locator('main').boundingBox();
    await page.mouse.move(moved.x+35,moved.y+18);await page.mouse.down();await page.mouse.move(destination.x+100,destination.y+100,{steps:18});
    await page.locator('#kr-multi-drop').waitFor();await page.mouse.up();
    await tile.locator('video').waitFor();await floating().waitFor({state:'detached'});
    assert.equal(await tile.locator('video').evaluate(video=>video===window.floatingOriginalVideo),true,'docking moves the existing decoder into the workspace');
    assert.ok(await tile.locator('video').evaluate(video=>video.currentTime>=.9),'docking retains playback position');
    await checkControls();await workspace().getByRole('button',{name:'Close multiview',exact:true}).click();
    await card.getByRole('button',{name:`Open floating player: ${title}`,exact:true}).click();await waitFloat();
    await floating().getByRole('button',{name:'Add to workspace',exact:true}).click();await tile.locator('video').waitFor();await floating().waitFor({state:'detached'});
    await workspace().getByRole('button',{name:'Close multiview',exact:true}).click();
    await card.getByRole('button',{name:`Open floating player: ${title}`,exact:true}).click();await waitFloat();
    await floating().locator('video').evaluate(video=>window.closedWindowVideo=video);
    await floating().getByRole('button',{name:`Close ${kind==='vod'?'recording':'clip'} player`,exact:true}).click();
    assert.equal(await page.evaluate(()=>closedWindowVideo.paused&&!closedWindowVideo.isConnected&&!closedWindowVideo.getAttribute('src')),true);
  }
  remoteCatalog=true;await load(true);
  const expandRemote=workspace().getByRole('button',{name:'Channel details for native',exact:true});
  if(await expandRemote.getAttribute('aria-expanded')!=='true')await expandRemote.click();
  const remote=workspace().locator('.channel-profile-region #kr-channel-library');await remote.waitFor();
  for(const [tab,title,kind]of [['Clips','Clip two','clip'],['Videos','Profile recording','vod']]){
    await remote.getByRole('link',{name:tab,exact:true}).click();
    const card=remote.locator('.items .card').filter({hasText:title}).first();
    await card.locator('.thumb').hover({position:{x:30,y:30}});const box=await card.locator('.thumb').boundingBox();
    await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+65,box.y+30,{steps:6});await page.locator('#kr-multi-drop').waitFor();
    await page.mouse.move(100,12,{steps:10});
    await page.waitForFunction(()=>{const stage=document.querySelector('#kr-multi-root')?.shadowRoot.querySelector('.multi-stage');return stage&&stage.getBoundingClientRect().top>=0;});
    const stage=await workspace().locator('.multi-stage').boundingBox();await page.mouse.move(stage.x+70,stage.y+70,{steps:12});await page.mouse.up();
    await workspace().locator(`.multi-tile[data-kind="${kind}"] video`).waitFor();
    const details=workspace().locator(`.multi-tile[data-kind="${kind}"] > .multi-clip-details`);
    await details.locator('.media-detail-views').filter({hasText:kind==='vod'?'12,345 views':'5,432 views'}).waitFor();
    assert.equal(await details.isVisible(),true,'dragged media shows its metadata below the player');
    assert.equal(await details.locator('.media-detail-date time').getAttribute('datetime'),'2026-11-14T12:00:00.000Z');
    assert.equal(await details.locator('.media-detail-creator').count(),kind==='clip'?1:0);
    await card.getByRole('button',{name:`Open floating player: ${title}`,exact:true}).click();await waitFloat();
    assert.equal(await floating().locator('.float > .media-details .media-detail-views').textContent(),kind==='vod'?'12,345 views':'5,432 views');
    await floating().getByRole('button',{name:`Close ${kind==='vod'?'recording':'clip'} player`,exact:true}).click();
  }
  await workspace().getByRole('button',{name:'Close multiview',exact:true}).click();
  }
  await load();
  await library.locator('.items .thumb').first().click();await waitVideo();
  await video().evaluate(node=>{node.pause();node.currentTime=0;window.replayOriginalVideo=node;});
  denseReplay=true;
  await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();
  await preview.getByText('FirstViewer',{exact:true}).waitFor();
  const replaySizes=()=>preview.locator('.body').evaluate(node=>[node,node.querySelector('.stage'),node.querySelector('.replay')].map(element=>{const box=element.getBoundingClientRect();return {width:Math.round(box.width),height:Math.round(box.height)};}));
  const initialReplaySizes=await replaySizes();
  assert.ok((await preview.locator('.replay-messages').textContent()).includes('<script>evil</script>'),'messages render as text');assert.equal(await preview.locator('.replay-messages script').count(),0);
  assert.equal(await preview.getByText('SecondViewer',{exact:true}).count(),0,'future messages stay hidden');
  await preview.getByText('FirstViewer',{exact:true}).evaluate(node=>window.retainedReplayRow=node.parentElement);
  await video().evaluate(node=>{node.currentTime=2.5;node.dispatchEvent(new Event('timeupdate'));});await preview.getByText('SecondViewer',{exact:true}).waitFor();
  await preview.getByText('Viewer59',{exact:true}).waitFor();
  assert.deepEqual(await replaySizes(),initialReplaySizes,'incoming replay messages never stretch the video, chat panel or dialog body');
  assert.equal(await preview.locator('.replay-messages').evaluate(node=>node.scrollHeight>node.clientHeight),true,'busy replay scrolls inside its panel');
  await page.screenshot({path:`artifacts/${engine}-busy-clip-replay.png`});
  assert.equal(await preview.getByText('FirstViewer',{exact:true}).evaluate(node=>node.parentElement===retainedReplayRow),true,'new replay messages preserve existing rows');
  await video().evaluate(node=>{node.currentTime=0;node.dispatchEvent(new Event('timeupdate'));});await preview.getByText('SecondViewer',{exact:true}).waitFor({state:'detached'});
  assert.equal(await preview.getByText('FirstViewer',{exact:true}).evaluate(node=>node.parentElement===retainedReplayRow),true,'backward seeks preserve rows that remain visible');
  const replayCount=replayRequests;await preview.getByRole('button',{name:'Collapse chat replay',exact:true}).click();assert.equal(await preview.locator('.replay').count(),0);assert.equal(await video().evaluate(node=>node===window.replayOriginalVideo),true,'closing replay preserves the clip player');assert.equal(replayRequests,replayCount);
  replayFail=true;await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();await preview.getByText('Chat replay is temporarily unavailable. Try again.',{exact:true}).waitFor();assert.equal(await preview.locator('.replay-note').isVisible(),false,'failed replay never claims to be synced');replayFail=false;await preview.getByRole('button',{name:'Retry chat replay'}).click();await preview.getByText('FirstViewer',{exact:true}).waitFor();await preview.getByRole('button',{name:'Collapse chat replay',exact:true}).click();
  replayFail=true;replayStatus=404;await preview.getByRole('button',{name:'Pop out chat replay',exact:true}).click();await preview.getByText('Kick no longer has chat replay for this clip.',{exact:true}).waitFor();assert.equal(await preview.getByRole('button',{name:'Retry chat replay'}).isVisible(),false);assert.equal(await preview.locator('.replay-note').isVisible(),false);await preview.getByRole('button',{name:'Collapse chat replay',exact:true}).click();replayFail=false;replayStatus=503;
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
    assert.equal(await preview.getByRole('button',{name:'Collapse chat replay',exact:true}).evaluate(button=>{const icon=button.querySelector('svg').getBoundingClientRect(),box=button.getBoundingClientRect();return Math.abs(icon.x+icon.width/2-box.x-box.width/2)<.5&&Math.abs(icon.y+icon.height/2-box.y-box.height/2)<.5;}),true,'chat close icon stays centered at every viewport');
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
  await modifiedLinks(library.locator('.items .thumb').first(),`https://kick.com/native/clips/${ids[0]}`);
  await library.locator('.items .thumb').first().click();await waitVideo();
  await page.evaluate(()=>{history.pushState({},'','/another-channel');window.dispatchEvent(new PopStateEvent('popstate'));});await preview.waitFor({state:'detached'});
  await load(true);const workspace=page.locator('#kr-multi-root');await workspace.locator('.multi-tile[data-channel="a"] iframe').waitFor();
  const other=page.frames().find(frame=>frame.url().startsWith('https://player.kick.com/a'))||await page.waitForEvent('framenavigated',{predicate:frame=>frame.url().startsWith('https://player.kick.com/a')});
  if(engine==='firefox')for(const file of ['stream-clock.js','performance.js','player-dom.js','player-controls.js','player-frame.js'])await other.addScriptTag({path:'extension/'+file});
  await other.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await workspace.locator('.multi-tile[data-channel="a"] .multi-audio-toggle').evaluate(node=>node.click());await other.waitForFunction(()=>!document.querySelector('video').muted);
  const workspaceExpand=workspace.getByRole('button',{name:'Channel details for native',exact:true});
  if(await workspaceExpand.getAttribute('aria-expanded')!=='true')await workspaceExpand.click();
  const workspaceLibrary=workspace.locator('.channel-profile-region #kr-channel-library');
  await workspaceLibrary.getByRole('link',{name:'Clips',exact:true}).click();
  await workspaceLibrary.locator('.items .thumb').first().click();await waitVideo();await other.waitForFunction(()=>document.querySelector('video').muted);
  await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});await other.waitForFunction(()=>!document.querySelector('video').muted);
  await load();await library.locator('.items .thumb').first().click();await waitVideo();
  if(engine==='chromium')await (await extensionWorker(context)).evaluate(()=>chrome.storage.local.set({settings:{enabled:false,chatClips:false}}));
  else await page.evaluate(()=>browser.storage.local.set({settings:{enabled:false,chatClips:false}}));
  await preview.waitFor({state:'detached'});assert.equal(await page.locator('#kr-channel-root video').count(),0);assert.ok(segments>0,'real HLS media played');assert.deepEqual(errors,[]);
  console.log(`${engine}: online/offline previews, card dragging, feed refresh during drag, movable/resizable windows, same-player docking, expanded-profile drag, edge scrolling, nonoverlapping workspace controls, MP4/replay and cleanup passed`);
}finally{await context.close();await browser?.close();}
