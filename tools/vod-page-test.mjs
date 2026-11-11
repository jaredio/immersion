import playwright from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const engine=process.env.KR_ENGINE||'chromium',browser=await playwright[engine].launch({headless:true});
const card=index=>`<article data-testid="vods-card"><a href="/nickwhite/videos/recording-${index}"><img data-thumbnail src="https://files.kick.com/thumbnail.svg"><span>2:03:04</span></a><a href="/nickwhite/videos/recording-${index}"><h3>Recording ${index}</h3></a><p>2 days ago</p></article>`;
const fixture=`<!doctype html><html data-kr-enabled="true"><head><style>body{margin:20px;background:#09090b;color:#eee;font:14px system-ui}main{max-width:1100px;margin:auto}video{width:100%;height:180px;background:#202025}#native-header{display:flex;justify-content:space-between;padding:20px 0}.identity{display:flex;gap:16px}img{width:60px}a{color:inherit}#recommendations>div{display:flex}</style></head><body><main><video id="video-player" controls></video><section id="native-header"><div class="identity"><a href="/nickwhite"><img data-testid="channel-avatar" src="https://files.kick.com/avatar.svg"><span>LIVE</span></a><div><a href="/nickwhite"><span data-testid="channel-username">nickwhite</span></a><h1 data-testid="livestream-title">Friday Livestream</h1><div><a href="/category/irl">IRL</a><button aria-disabled="true">English</button></div></div></div><div><button data-testid="follow-button" aria-label="Follow">Follow</button><button data-testid="sub-button" aria-label="Subscribe">Subscribe</button><div><span title="11500">11.5K</span> Views · <span title="2026-11-06T12:00:00Z">2 days ago</span><button aria-label="Share via">Share</button></div></div></section><section id="recommendations"><h2>More videos from nickwhite</h2><div>${Array.from({length:4},(_,i)=>card(i)).join('')}</div></section></main></body></html>`;
try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://kick.com/**',route=>route.request().url().endsWith('ui.css')?route.fulfill({path:'extension/ui.css'}):route.fulfill({contentType:'text/html',body:fixture}));
  await page.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#293b32"/></svg>'}));
  await page.goto('https://kick.com/nickwhite/videos/current-recording');
  for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:`extension/${file}`});
  await page.evaluate(()=>window.chrome={runtime:{getURL:file=>`https://kick.com/${file}`}});
  for(const file of ['shared.js','dom.js','profile.js','channel-library.js','channel-page.js','channel-panel.js'])await page.addScriptTag({path:`extension/${file}`});
  await page.evaluate(()=>{
    window.originalPlayer=document.querySelector('video');window.followCalls=0;document.querySelector('[data-testid="follow-button"]').onclick=()=>followCalls++;
    window.adapter=KickRefinedChannelPage.create();const support={channel:async()=>({title:'nickwhite',live:'live',viewers:'2000',bio:'Bio [My photos](https://instagram.com/nickwhite) and [custom](https://example.com)',socials:[{label:'Twitter',href:'https://x.com/nickwhite'},{label:'YouTube',href:'https://youtube.com/@nickwhite'}]}),panels:async()=>[],makeButton:()=>document.createElement('span')};window.panel=KickRefinedChannelPanel.create({support,onChange:()=>panel.refresh()});adapter.refresh();panel.refresh();
  });
  const header=page.locator('#kr-channel-root'),library=page.locator('#kr-channel-library');await header.locator('.channel-title').waitFor();
  assert.equal(await header.locator('.channel-title').textContent(),'Friday Livestream');assert.equal(await header.locator('.channel-live').count(),0,'recordings never show a live playback badge');
  assert.equal(await header.locator('.channel-viewers').textContent(),'Recording \u00b7 11.5K views \u00b7 2 days ago');assert.doesNotMatch(await header.locator('.channel-viewers').textContent(),/watching/);
  await header.getByRole('button',{name:'Follow',exact:true}).click();assert.equal(await page.evaluate(()=>followCalls),1);
  await library.getByRole('heading',{name:'More videos from nickwhite',exact:true}).waitFor();assert.equal(await library.locator('.nav').isVisible(),false);assert.equal(await library.locator('.card').count(),4);
  await library.getByRole('searchbox').fill('Recording 2');assert.equal(await library.locator('.card').count(),1);await library.getByRole('searchbox').fill('');await library.getByRole('button',{name:'List',exact:true}).click();assert.equal(await library.locator('.items').getAttribute('data-view'),'list');
  await header.getByRole('button',{name:'Channel details for nickwhite',exact:true}).click();await header.locator('[data-social-platform="X"]').waitFor();
  for(const name of ['Instagram','X','YouTube'])assert.equal(await header.locator(`[data-social-platform="${name}"] svg`).count(),1);
  const instagram=header.locator('[data-social-platform="Instagram"]');
  assert.equal(await instagram.textContent(),'Instagram');
  const initial=await instagram.evaluate(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor}));
  assert.equal(initial.color,'rgb(228, 64, 139)');
  await instagram.hover();
  await page.waitForFunction(background=>getComputedStyle(document.querySelector('#kr-channel-root').shadowRoot.querySelector('[data-social-platform=Instagram]')).backgroundColor!==background,initial.background);
  assert.equal(await header.getByRole('link',{name:'custom',exact:true}).getAttribute('href'),'https://example.com/');
  assert.equal(await page.evaluate(()=>originalPlayer===document.querySelector('video')),true,'native player identity is preserved');
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/vod-page-${engine}.png`});
  await page.evaluate(()=>{adapter.refresh(false);panel.setEnabled(false);});assert.equal(await page.locator('#native-header').isVisible(),true);assert.equal(await page.locator('#recommendations h2').isVisible(),true);assert.equal(await library.count(),0);assert.deepEqual(errors,[]);
  console.log(`${engine}: themed VOD header/library, recording metadata, native player/actions, social icons/colors and restoration passed`);
}finally{await browser.close();}
