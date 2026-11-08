import {chromium,firefox} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const engine=process.env.KR_ENGINE==='firefox'?firefox:chromium;
const browser=await engine.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1180,height:600}});
  const header=await readFile('tests/channel-header-current.html','utf8');
  const goal=(kind,title,count,time='')=>`<article class="native-goal" data-goal="${kind}"><h3>${title}</h3><p>${time}</p><button aria-label="${kind} goal">Act</button><div><img src="https://files.kick.com/contributor.webp" alt="Latest supporter"><span class="native-count">${count}</span></div></article>`;
  const goals=goal('follow','378 followers to go!','7,622 / 8K')+goal('gift','1,958 KICKs to go!','42 / 2K','in 22 hours')+goal('subscribe','5 subscriptions to go!','0 / 5','in 22 hours');
  await page.route('https://kick.com/**',route=>route.request().url().endsWith('/ui.css')
    ?route.fulfill({path:path.resolve('extension/ui.css')})
    :route.fulfill({contentType:'text/html',body:`<!doctype html><html data-kr-enabled="true"><head><meta charset="utf-8"><style>body{margin:20px;background:#09090b;font:14px system-ui}#workspace{margin-top:24px}</style></head><body><main><div id="channel-content"><div class="contents mobile-header">${header}</div><div id="captured-native" class="contents desktop-header">${header}</div><div id="native-goals">${goals}</div></div></main><div id="workspace"></div></body></html>`}));
  await page.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#333"/></svg>'}));
  await page.goto('https://kick.com/soultravels');
  await page.addStyleTag({path:'extension/theme.css'});
  await page.evaluate(()=>{window.chrome={runtime:{getURL:file=>`https://kick.com/${file}`}};});
  for(const file of ['shared.js','dom.js','profile.js','channel-panel.js'])await page.addScriptTag({path:`extension/${file}`});
  const result=await page.evaluate(()=>{
    const original=document.querySelector('[data-ds-icon=VerifiedBadge] path').getAttribute('d');
    const meta={title:'SoulTravels',live:'live',verified:true};
    const support={channel:async()=>meta,panels:async()=>[],makeButton:()=>{const button=document.createElement('button');button.className='kr-support-button';button.textContent='Donate';return button;}};
    window.testPanel=KickRefinedChannelPanel.create({support});
    window.goalActions=[];for(const button of document.querySelectorAll('.native-goal button'))button.addEventListener('click',()=>goalActions.push(button.closest('[data-goal]').dataset.goal));
    const fallback=testPanel.card('another-channel',meta,{});
    testPanel.refresh();
    const single=document.getElementById('kr-channel-root').shadowRoot;
    const workspace=document.getElementById('workspace').attachShadow({mode:'open'});
    const css=document.createElement('link');css.rel='stylesheet';css.href=chrome.runtime.getURL('ui.css');
    const style=document.createElement('style');style.textContent=KickRefinedChannelPanel.styles;
    workspace.append(css,style,testPanel.card('soultravels',meta,{}));
    return {original,single:single.querySelector('.channel-name-button svg path').getAttribute('d'),multi:workspace.querySelector('.channel-name-button svg path').getAttribute('d'),fallback:fallback.querySelector('.channel-name-button svg path').getAttribute('d')};
  });
  assert.equal(result.single,result.original,'single stream retains the exact native verification path');
  assert.equal(result.multi,result.original,'multistream retains the exact native verification path');
  assert.equal(result.fallback,result.original,'other channels use the exact native badge too');
  const mentions=await page.evaluate(()=>{
    const text='‼ 🌴 MIAMI IRL 🌴 ‼ w/ @sheep_xing, (@Other-Channel)! mail@example.com <b> @Third';
    const card=testPanel.card('mentions',{title:'Mentions',streamTitle:text,live:'live'},{}),title=card.querySelector('.channel-title');
    return {text:title.textContent,markup:title.querySelector('b')!==null,links:[...title.querySelectorAll('a')].map(a=>[a.textContent,a.href])};
  });
  assert.equal(mentions.text,'‼ 🌴 MIAMI IRL 🌴 ‼ w/ @sheep_xing, (@Other-Channel)! mail@example.com <b> @Third');
  assert.equal(mentions.markup,false,'title content remains plain text');
  assert.deepEqual(mentions.links,[['@sheep_xing','https://kick.com/sheep_xing'],['@Other-Channel','https://kick.com/other-channel'],['@Third','https://kick.com/third']]);
  assert.equal(await page.locator('#captured-native>[data-kr-channel-source]').isVisible(),false,'the actual native desktop header is replaced');
  const single=page.locator('#kr-channel-root'),multi=page.locator('#workspace');
  assert.equal(await single.evaluate(node=>node.parentElement.id),'channel-content','replacement mounts outside responsive native wrappers');
  // Reproduce styles arriving after the first header render, then React replacing its desktop header.
  await page.addStyleTag({content:'@media(min-width:1000px){.mobile-header{display:none}}'});
  await page.evaluate(()=>{const desktop=document.querySelector('#captured-native');desktop.replaceChildren(desktop.firstElementChild.cloneNode(true));for(let i=0;i<5;i++)testPanel.refresh();const workspace=document.getElementById('workspace').shadowRoot;workspace.querySelector('.channel-panel').replaceWith(testPanel.card('soultravels',{title:'SoulTravels',live:'live',verified:true},{}));});
  assert.equal(await single.isVisible(),true,'header survives delayed responsive styles and React replacement');
  assert.equal(await page.locator('#kr-channel-root').count(),1,'refreshing leaves one replacement');
  await single.locator('.channel-title').waitFor();
  assert.equal(await single.locator('.channel-title').textContent(),await multi.locator('.channel-title').textContent());
  assert.deepEqual(await single.locator('.channel-tag').allTextContents(),['English','18+'],'nested native tags are retained');
  assert.equal(await single.locator('.channel-name-button svg path').evaluate(node=>getComputedStyle(node).fill),'rgb(176, 255, 140)');
  for(const selector of ['.multi-channel-card','.channel-identity','.channel-title','.channel-tags','.channel-actions']){
    const box=panel=>panel.locator(selector).evaluate(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height};});
    assert.deepEqual(await box(single),await box(multi),`${selector} has the same dimensions in both views`);
  }
  for(const panel of [single,multi]){
    assert.deepEqual(await panel.locator('.channel-goal-title').allTextContents(),['378 followers to go!','1,958 KICKs to go!','5 subscriptions to go!']);
    assert.deepEqual(await panel.locator('.channel-goal-count').allTextContents(),['7,622 / 8K','42 / 2K','0 / 5']);
    assert.equal(await panel.locator('.channel-goal progress').count(),3);
    for(const button of await panel.locator('.channel-goal-action').all())await button.click();
  }
  assert.deepEqual(await page.evaluate(()=>goalActions),['follow','gift','subscribe','follow','gift','subscribe'],'goal actions keep their native handlers in both views');
  assert.equal(await page.locator('.native-goal:visible').count(),0,'native goal cards do not remain duplicated');
  await page.evaluate(()=>{document.querySelector('[data-goal=gift] .native-count').textContent='50 / 2K';testPanel.refresh();});
  assert.equal(await single.locator('.channel-goal-count').nth(1).textContent(),'50 / 2K','live goal counts update');
  await page.evaluate(()=>{window.savedGoals=document.createDocumentFragment();const native=document.getElementById('native-goals');while(native.firstChild)savedGoals.append(native.firstChild);testPanel.refresh();});
  assert.equal(await single.locator('.channel-goals').count(),0,'channels without active goals have no empty goals row');
  await page.evaluate(()=>{document.getElementById('native-goals').append(savedGoals);testPanel.refresh();});
  assert.equal(await single.locator('.channel-goal').count(),3,'goals loaded after the header appear automatically');
  for(const width of [760,430]){await page.setViewportSize({width,height:900});await page.evaluate(()=>testPanel.refresh());assert.equal(await single.isVisible(),true);assert.equal(await single.locator('.channel-panel').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'goals fit narrow layouts');}
  await page.setViewportSize({width:1180,height:900});
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:`artifacts/${engine.name()}-current-native-header.png`,fullPage:true});
  await page.evaluate(()=>{const workspace=document.getElementById('workspace').shadowRoot,list=document.createElement('div');list.id='multi-channel-list';list.append(testPanel.card('soultravels',{title:'SoulTravels',live:'live',verified:true},{}),testPanel.card('other-channel',{title:'Other channel',streamTitle:'Channel without active goals',live:'live'},{}));workspace.querySelector('.channel-panel').replaceWith(list);});
  const gridCards=multi.locator('#multi-channel-list>.channel-panel');
  const tall=await gridCards.nth(0).boundingBox(),short=await gridCards.nth(1).boundingBox();
  assert.ok(Math.abs(tall.y-short.y)<1,'grid cards share their top edge');
  assert.ok(short.height<tall.height-100,'a channel without goals keeps its natural height beside one with goals');
  await multi.screenshot({path:`artifacts/${engine.name()}-channel-grid-natural-heights.png`});
  await page.evaluate(()=>testPanel.setEnabled(false));assert.equal(await page.locator('.native-goal:visible').count(),3,'disabling restores native goals');
  console.log(`${engine.name()}: persistent responsive header, React replacement, matching layouts, exact badge, goal progress, native goal actions, live updates and restoration passed`);
}finally{await browser.close();}
