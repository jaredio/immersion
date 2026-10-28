import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),engine=process.env.KR_ENGINE||'chromium';
const id='2114650564600688817',ttId='7700270863769210126',ytId='dQw4w9WgXcQ';
const links={x:`https://x.com/creator/status/${id}`,tt:'https://vt.tiktok.com/ZSg44YD1X/',tt2:'https://www.tiktok.com/t/ZTfqXW8Cn/',yt:`https://www.youtube.com/watch?v=${ytId}&t=62`,short:`https://www.youtube.com/shorts/${ytId}`,xp:'https://x.com/creator',tp:'https://www.tiktok.com/@creator'};
const user={screen_name:'creator',name:'Creator',description:'Public profile <script>no()</script>',avatar_url:'https://pbs.twimg.com/avatar.jpg',followers:1200,following:50,statuses:83};
const tweet={code:200,tweet:{id,text:'Video post',author:user,likes:45,retweets:2,views:1000,media:{videos:[{url:'https://video.twimg.com/demo.mp4',thumbnail_url:'https://pbs.twimg.com/poster.jpg',duration:3,formats:[{url:'https://video.twimg.com/avc1/1280x720/broken.mp4',codec:'h264'},{url:'https://video.twimg.com/avc1/640x360/good.mp4',codec:'h264'}]}]}}};
const item={id:ttId,desc:'TikTok video title',author:{uniqueId:'creator',nickname:'Creator',avatarThumb:'https://p16.tiktokcdn.com/avatar.jpg'},video:{cover:'https://p16.tiktokcdn.com/cover.jpg',duration:12},stats:{diggCount:12,shareCount:3,playCount:100}};
const publicHTML=scope=>`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({__DEFAULT_SCOPE__:scope})}</script><script>window.providerScriptRan=true</script>`;
const ttVideo=publicHTML({'webapp.video-detail':{itemInfo:{itemStruct:item}}}),ttProfile=publicHTML({'webapp.user-detail':{userInfo:{user:{uniqueId:'creator',nickname:'Creator',signature:'A public creator profile',avatarThumb:'https://p16.tiktokcdn.com/avatar.jpg'},stats:{followerCount:500,heartCount:1200,videoCount:33}}}});
const youtube={title:'A YouTube video <script>no()</script>',author_name:'Creator',author_url:'https://www.youtube.com/@creator',thumbnail_url:`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,html:'<script>window.providerScriptRan=true</script>'};
const html=`<!doctype html><html><head><style>body{margin:0;background:#0b0b0e;color:#eee;font:14px system-ui}aside{width:360px;margin:10px auto}#chatroom-messages{height:730px;overflow:auto}[data-index]{padding:6px 10px}a{color:#a3eed2;overflow-wrap:anywhere}.sender{padding:0;border:0;background:none;color:#b8a2ff;font:600 13px system-ui;cursor:pointer}.message-body{line-height:1.55}</style></head><body><aside><div id="chatroom-messages">${Object.entries(links).map(([key,href],index)=>`<div id="row-${key}" data-index="${index}"><div class="native-message"><button class="sender" data-prevent-expand="true">viewer_${key}</button> <span class="message-body">${key==='tt'?'look at this ':''}<a href="${href}">${href}</a>${key==='tt'?' the ending is good':''}</span></div></div>`).join('')}</div></aside></body></html>`;
const video=Buffer.concat(await Promise.all(['init.mp4','segment-0.m4s','segment-1.m4s'].map(name=>readFile(path.join(root,'tests/clip-media/vp9',name)))));
let browser,context,playerRequests=0,videoRequests=0,failedVideoRequests=0,failAllVideos=false;
if(engine==='chromium')context=await playwright.chromium.launchPersistentContext(path.join(root,'tmp/media-profile'),{executablePath:playwright.chromium.executablePath(),headless:true,viewport:{width:900,height:800},args:[`--disable-extensions-except=${path.join(root,'dist/chrome')}`,`--load-extension=${path.join(root,'dist/chrome')}`]});
else{browser=await playwright.firefox.launch({headless:true});context=await browser.newContext({viewport:{width:900,height:800}});}
try{
 if(engine==='chromium'){
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.clear());
  await worker.evaluate(({tweet,user,ttVideo,ttProfile,youtube,ttId})=>{
   globalThis.fetch=async(url,options)=>{
    let body,finalURL=url;
    if(url.includes('/status/'))body=JSON.stringify(tweet);
    else if(url.includes('/2/profile/'))body=JSON.stringify({code:200,user});
    else if(url.includes('youtube.com/oembed'))body=JSON.stringify(youtube);
    else if(url.includes('tiktok.com/@creator')&&!url.includes('/video/'))body=ttProfile;
    else{body=ttVideo;finalURL=`https://www.tiktok.com/@creator/video/${ttId}`;}
    const response=new Response(body);Object.defineProperty(response,'url',{value:finalURL});return response;
   };
  },{tweet,user,ttVideo,ttProfile,youtube,ttId});
 }else{
  await context.addInitScript(({tweet,user,ttVideo,ttProfile,youtube,links,ttId})=>{
   window.browser={runtime:{sendMessage:async message=>{
    if(message.type==='immersion:x-post')return {ok:true,post:KickRefinedXData.metadata(tweet,KickRefinedXData.parse(message.href))};
    let parsed=KickRefinedMediaData.parse(message.href),value;
    if(parsed.provider==='x')value=KickRefinedMediaData.profile({code:200,user},parsed);
    else if(parsed.provider==='youtube')value=KickRefinedMediaData.oembed(youtube,parsed);
    else if(parsed.kind==='profile')value=KickRefinedMediaData.tiktokPage(ttProfile,parsed);
    else{parsed=KickRefinedMediaData.parse(`https://www.tiktok.com/@creator/video/${ttId}`);value=KickRefinedMediaData.tiktokPage(ttVideo,parsed);}
    return {ok:true,item:value};
   }}};
  },{tweet,user,ttVideo,ttProfile,youtube,links,ttId});
 }
 await context.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:html}));
 await context.route('https://video.twimg.com/**',route=>{videoRequests++;assert.equal(route.request().headers().referer,undefined,'X video requests omit Kick referrer to avoid CDN 403');if(failAllVideos||route.request().url().includes('broken.mp4')){failedVideoRequests++;return route.fulfill({contentType:'text/html',body:'Video unavailable'});}return route.fulfill({contentType:'video/mp4',body:video});});
 const image='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#263b35"/></svg>';
 for(const pattern of ['https://pbs.twimg.com/**','https://p16.tiktokcdn.com/**','https://i.ytimg.com/**'])await context.route(pattern,route=>route.fulfill({contentType:'image/svg+xml',body:image}));
 const player=route=>{playerRequests++;assert.ok(route.request().headers().referer?.startsWith('https://kick.com/'),'embed players receive a referrer');return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#111;color:#eee">Provider player fixture</body></html>'});};
 await context.route('https://www.tiktok.com/player/v1/**',player);await context.route('https://www.youtube-nocookie.com/embed/**',player);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('https://kick.com/popout/test/chat');
 await page.evaluate(()=>{window.senderClicks=0;document.querySelector('#row-tt .sender').addEventListener('click',()=>window.senderClicks++);});
 if(engine==='firefox'){
  for(const file of ['shared.js','x-post-data.js','x-posts.js','media-data.js','media-embeds.js'])await page.addScriptTag({path:path.join(root,'extension',file)});
  await page.evaluate(()=>{document.documentElement.dataset.krEnabled='true';window.testX=KickRefinedX.create();window.testMedia=KickRefinedMedia.create();});
 }
 const x=page.locator('#row-x .kr-x-post');await x.locator('.name').waitFor();assert.equal(videoRequests,0,'X videos do not preload on arrival');assert.equal(playerRequests,0,'external players do not load on arrival');
 await x.getByRole('button',{name:'Play X video'}).click();
 await page.waitForFunction(()=>{const video=document.querySelector('#row-x .kr-x-post').shadowRoot.querySelector('iframe')?.contentDocument?.querySelector('video');return video?.readyState>=2&&!video.paused;});
 assert.ok(videoRequests>0,'X video plays from a native video element');
 assert.equal(failedVideoRequests,1,'unsupported first rendition automatically falls back');
 const tt=page.locator('#row-tt .kr-media-embed');await page.locator('#row-tt').scrollIntoViewIfNeeded();await tt.locator('.name').waitFor();
 const previewHeight=await tt.locator('.video-preview').evaluate(node=>node.getBoundingClientRect().height);assert.equal(previewHeight,190,'TikTok preview has a compact height');
 assert.equal(await tt.locator('.video-preview img').evaluate(node=>getComputedStyle(node).objectFit),'contain','portrait previews retain the whole image');
 assert.equal(await page.locator('#row-tt .message-body').innerText(),'look at this the ending is good','surrounding text stays together in the native message');
 assert.equal(await page.locator('#row-tt').getAttribute('data-kr-embed-row'),'','embed is grouped with its native sender and text');
 await page.locator('#row-tt .sender').click();assert.equal(await page.evaluate(()=>window.senderClicks),1,'native sender actions remain clickable');
 await page.locator('#row-tt').evaluate(node=>{node.scrollIntoView({block:'start'});document.getElementById('chatroom-messages').scrollTop+=100;});
 await x.locator('iframe').waitFor({state:'detached'});assert.equal(await tt.locator('[aria-label="12 likes"]').count(),1);assert.equal(await tt.locator('[aria-label="3 shares"]').count(),1);assert.equal(await tt.locator('[aria-label="100 views"]').count(),1);
 assert.equal(await tt.locator('.brand.tiktok svg').count(),1);await tt.getByRole('button',{name:'Play TikTok video'}).click();
 await tt.locator('iframe').waitFor();assert.ok((await tt.locator('iframe').getAttribute('src')).includes(`/player/v1/${ttId}`));
 assert.equal(await tt.locator('.player').evaluate(node=>node.getBoundingClientRect().height),300,'inline TikTok playback stays compact');assert.equal(await tt.locator('iframe').getAttribute('allowfullscreen'),'');
 await tt.getByRole('button',{name:'Close embedded player'}).click();assert.equal(await tt.locator('iframe').count(),0);
 const yt=page.locator('#row-yt .kr-media-embed');await page.locator('#row-yt').scrollIntoViewIfNeeded();await yt.locator('.name').waitFor();
 assert.equal(await yt.locator('.brand.youtube svg').count(),1);assert.equal(await yt.locator('.stat').count(),0,'YouTube does not receive invented view/like counts');
 assert.equal(await yt.locator('.embed-title').textContent(),youtube.title);await yt.getByRole('button',{name:'Play YouTube video'}).click();
 await yt.locator('iframe').waitFor();assert.ok((await yt.locator('iframe').getAttribute('src')).includes('start=62'));assert.equal(await yt.locator('iframe').getAttribute('allowfullscreen'),'');
 const shorts=page.locator('#row-short .kr-media-embed');await page.locator('#row-short').scrollIntoViewIfNeeded();await shorts.locator('.name').waitFor();await shorts.getByRole('button',{name:'Play YouTube Short'}).click();assert.equal(await shorts.locator('.portrait iframe').count(),1);
 for(const [key,label] of [['xp','1,200 followers'],['tp','500 followers']]){await page.locator(`#row-${key}`).scrollIntoViewIfNeeded();await page.locator(`#row-${key} .kr-media-embed [aria-label="${label}"]`).waitFor();assert.equal(await page.locator(`#row-${key} iframe`).count(),0,'profile cards do not load video players');}
 await page.locator('#row-tt2').scrollIntoViewIfNeeded();await page.locator('#row-tt2 .kr-media-embed .name').waitFor();
 for(const width of [360,300]){
  await page.locator('aside').evaluate((node,width)=>node.style.width=`${width}px`,width);
  const widths=await page.locator('.kr-x-post,.kr-media-embed').evaluateAll(nodes=>nodes.map(node=>({host:node.getBoundingClientRect().width,card:node.shadowRoot.querySelector('.card').getBoundingClientRect().width})));
  for(const item of widths){assert.ok(item.host-item.card>=15,'every embed is inset from both chat edges');assert.ok(Math.abs(item.card-widths[0].card)<1,'all provider cards use the same width');}
 }
 await page.locator('aside').evaluate(node=>node.style.width='360px');await page.locator('#row-tt').scrollIntoViewIfNeeded();
 await mkdir(path.join(root,'artifacts'),{recursive:true});await page.screenshot({path:path.join(root,`artifacts/${engine}-media.png`)});
 assert.equal(await page.evaluate(()=>window.providerScriptRan),undefined,'provider HTML/scripts are never executed in Kick');
 failAllVideos=true;await page.locator('#row-x').scrollIntoViewIfNeeded();await x.getByRole('button',{name:'Play X video'}).click();
 await x.getByRole('status').waitFor();assert.equal(await x.locator('iframe').count(),0,'failed video is replaced by the preview and source link');
 assert.equal(await x.getByRole('link',{name:'Open on X',exact:true}).getAttribute('href'),links.x);
 if(engine==='chromium'){const worker=context.serviceWorkers()[0];await worker.evaluate(()=>chrome.storage.local.set({settings:{textOnly:true}}));}
 else await page.evaluate(()=>{testX.setEnabled(false);testMedia.setOptions({media:false,profiles:false});});
 await page.locator('.kr-media-embed,.kr-x-post').first().waitFor({state:'detached'});assert.equal(await page.locator('.kr-media-embed,.kr-x-post').count(),0);assert.equal(await page.locator('#row-tt .message-body>a').isVisible(),true,'disabling restores the original links');
 assert.equal(await page.locator('[data-kr-embed-row]').count(),0,'disabling removes message grouping');
 assert.deepEqual(errors,[]);console.log(`${engine}: X video playback, TikTok short links/stats/profile, X profiles, YouTube videos/Shorts, lazy players, referrer, uniform widths and cleanup passed`);
}finally{await context.close();await browser?.close();}
