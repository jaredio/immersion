/* Current public Kick banner/category markup, local routes, no account or network. */
import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';

const engine=process.env.KR_ENGINE||'chromium',browser=await playwright[engine].launch({headless:true});
const category=await readFile('tests/offline-category.html','utf8');
const categories=Array.from({length:6},(_,i)=>category.replaceAll('/category/irl',`/category/category${i}`).replaceAll('>IRL<',`>Category ${i+1}<`)).join('');
const fixture=`<!doctype html><html data-kr-enabled="true"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#09090b;color:#eee;font:14px system-ui}main{max-width:1260px;margin:0 auto}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;background:#202027;border:0;padding:10px;border-radius:6px;cursor:pointer}#channel-content{padding:24px 28px}.native-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px;background:#18181e}.native-identity{display:flex;align-items:center;gap:16px}.native-avatar img{width:80px;height:80px}.native-header h1,.native-header h2{margin:4px 0}.native-actions{display:flex;gap:8px}#native-banner{position:relative;height:134px;background:#53fc18;overflow:hidden}#native-art{position:absolute;inset:0}#native-art img{width:100%;height:100%;object-fit:cover}#native-copy{position:absolute;top:28px;left:28px;display:flex;align-items:center;gap:16px;background:#111;padding:20px}#native-copy p{margin:0;font-size:24px;font-weight:700}.native-status{background:white;color:black;padding:4px;text-transform:uppercase}.native-tabs{display:flex;gap:20px;margin-top:20px}#native-categories{margin:32px 28px}.native-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}[data-testid="category-card-root"]{display:flex;flex-direction:column;position:relative;min-width:0;padding-top:12px}[data-testid="category-card-root"]>a{position:relative;width:100%;aspect-ratio:3/4}[data-testid="category-card-root"]>a>div{height:100%;position:relative}[data-testid="category-card-root"]>a>[aria-hidden]{position:absolute;inset:0}[data-testid="category-card-root"]>a>[aria-hidden]>span{position:absolute;inset:0;border-radius:8px;background:#555;transform:translateY(-5px)}[data-testid="category-card-root"] img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}[data-testid="category-card-root"] h3{font-size:17px}[data-nosnippet]{position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:4px;background:#070707;padding:3px 6px}[data-testid="live-status-dot"]{width:8px;height:8px;border-radius:50%;background:#53fc18}[class*="group/tag"]{display:inline-flex;border-radius:99px;padding:2px 8px;background:#222}#native-categories h2{font-size:28px}[hidden]{display:none!important}
.invisible{visibility:hidden}
</style></head><body><main>
<div id="native-banner"><div id="native-art"><img src="/img/default-channel-banners/new-default-banner-3.webp" alt="dormant"></div><div id="native-copy"><div class="native-status">Offline</div><p>dormant is offline</p></div><div hidden id="native-ad"><video></video></div></div>
<div id="channel-content"><header class="native-header"><div class="native-identity"><button class="native-avatar"><img data-testid="channel-avatar" src="https://files.kick.com/avatar.svg" alt="dormant"></button><div><button><h1 data-testid="channel-username">dormant</h1></button><h2 data-testid="livestream-title">Offline</h2><a href="/category/just-chatting">Just Chatting</a></div></div><div class="native-actions"><button data-testid="follow-button" aria-label="Follow">Follow</button><button aria-label="Gift Subs">Gift Subs</button><button data-testid="sub-button" aria-label="Subscribe">Subscribe</button><button aria-label="Notifications">Notifications</button></div></header>
<nav class="native-tabs"><a href="/dormant" aria-current="page">Home</a><a href="/dormant/about">About</a><a href="/dormant/videos">Videos</a><a href="/dormant/clips">Clips</a><a href="/dormant/schedule">Schedule</a></nav><section id="native-about"><h2>About dormant</h2><p>20.5K Followers</p><p>Native channel bio.</p></section></div>
<section id="native-categories"><div><h2>Recently Streamed Categories</h2></div><div class="native-grid">${categories}</div></section></main></body></html>`;
try{
  const page=await browser.newPage({viewport:{width:1360,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://kick.com/**',route=>route.request().url().endsWith('/ui.css')?route.fulfill({path:'extension/ui.css'}):route.fulfill({contentType:'text/html',body:fixture}));
  await page.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#596851"/><stop offset="1" stop-color="#202432"/></linearGradient></defs><rect width="240" height="320" fill="url(#a)"/><circle cx="180" cy="70" r="70" fill="#829469" opacity=".3"/><path d="M0 320 240 150v170" fill="#252535"/><text x="22" y="274" fill="#eee" font-family="sans-serif" font-size="28">IRL</text></svg>'}));
  await page.goto('https://kick.com/dormant');
  for(const file of ['theme.css','polish.css','discovery.css'])await page.addStyleTag({path:`extension/${file}`});
  await page.evaluate(()=>window.chrome={runtime:{getURL:file=>`https://kick.com/${file}`}});
  for(const file of ['shared.js','dom.js','profile.js','channel-library.js','channel-page.js','channel-offline.js','channel-panel.js'])await page.addScriptTag({path:`extension/${file}`});
  await page.evaluate(()=>{
    window.calls=[];window.links=[];window.metadataReady=false;window.resolveMetadata=null;
    window.nativeCategory=document.querySelector('[data-testid="category-card-root"]');window.nativeVideo=document.querySelector('#native-ad video');
    window.nativeCount=nativeCategory.querySelector('span[title]').getAttribute('title');
    for(const button of document.querySelectorAll('.native-header button'))button.addEventListener('click',()=>calls.push(button.getAttribute('aria-label')));
    for(const link of document.querySelectorAll('[data-testid="category-card-root"] a'))link.addEventListener('click',event=>{event.preventDefault();links.push(link.getAttribute('href'));});
    const metadata={title:'dormant',live:'offline',followers:'20.5K',bio:'Independent creator.\n\nMusic, late nights, and good company.',socials:[{label:'Instagram',href:'https://www.instagram.com/example'}]};
    const pending=new Promise(resolve=>resolveMetadata=()=>{metadataReady=true;resolve(metadata);});
    const support={channel:()=>pending,panels:async()=>[{title:'About the channel',description:'New sessions every week. Make yourself at home.'}],makeButton:()=>Object.assign(document.createElement('button'),{className:'kr-support-button',textContent:'Donate'})};
    let scheduled=false;const schedule=()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;refreshPage();});}};
    window.channelPage=KickRefinedChannelPage.create({onChange:schedule,getProfileMount:tab=>panel.getProfileMount(tab)});
    window.panel=KickRefinedChannelPanel.create({support,integratedProfile:true,onChange:schedule});
    window.refreshPage=()=>{panel.refresh();channelPage.refresh();};refreshPage();
  });
  const header=page.locator('#kr-channel-root'),toggle=()=>header.getByRole('button',{name:'Channel details for dormant',exact:true});
  await header.locator('.channel-profile-region').waitFor();
  assert.equal(await toggle().getAttribute('aria-expanded'),'true','the native offline banner opens About before metadata arrives');
  assert.equal(await page.locator('[data-kr-offline-banner]').count(),1);assert.equal(await page.locator('[data-kr-offline-art]').isVisible(),false);
  assert.equal(await header.locator('.channel-offline-state').textContent(),'Offline');assert.equal(await header.locator('.channel-title').isVisible(),false,'duplicate Offline title is omitted');
  assert.equal(await header.locator('#kr-channel-library a[data-tab="about"]').getAttribute('aria-current'),'page','the initial offline profile selects About');
  await toggle().click();assert.equal(await toggle().getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>{resolveMetadata();for(let i=0;i<10;i++)refreshPage();});
  await page.waitForTimeout(60);assert.equal(await toggle().getAttribute('aria-expanded'),'false','metadata and repeated refreshes preserve a manual collapse');
  await toggle().click();await header.getByText('Independent creator.',{exact:false}).waitFor();
  assert.equal(await header.locator('.profile-panel h4').textContent(),'About the channel');
  await header.getByRole('button',{name:'Follow',exact:true}).click();assert.ok((await page.evaluate(()=>calls)).includes('Follow'),'Follow still invokes Kick');
  assert.equal(await page.evaluate(()=>nativeCategory===document.querySelector('[data-testid="category-card-root"]')&&nativeVideo===document.querySelector('#native-ad video')),true,'native category cards and player nodes are retained');
  assert.equal(await page.locator('[data-kr-offline-viewers]').count(),6);assert.equal(await page.locator('[data-kr-offline-viewers] span[title]').first().getAttribute('title'),await page.evaluate(()=>nativeCount));
  await page.locator('[data-kr-discovery-category] h3').first().click();assert.deepEqual(await page.evaluate(()=>links),['/category/category0']);
  for(const width of [1360,760,390]){
    await page.setViewportSize({width,height:1100});await page.evaluate(()=>refreshPage());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`no page overflow at ${width}px`);
    assert.equal(await header.locator('.channel-panel').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'the expanded header stays within its card');
    const card=page.locator('[data-kr-discovery-category]').first();
    assert.equal(await card.locator(':scope>a>[aria-hidden="true"]').isVisible(),false,'stacked cover layers are hidden');
    assert.ok(await page.locator('[data-kr-offline-section-title]').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))<=18);
    await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/${engine}-offline-${width}.png`,fullPage:true});
  }
  await page.evaluate(()=>{
    window.retiredBanner=document.getElementById('native-banner');
    const mobile=document.createElement('div');mobile.id='native-banner';mobile.className='relative';mobile.style.height='44px';
    mobile.innerHTML='<div id="native-art"><img src="/img/default-channel-banners/new-default-banner-3.webp" alt="dormant"></div><div hidden><video></video></div>';
    retiredBanner.replaceWith(mobile);refreshPage();
  });
  assert.equal(await page.locator('[data-kr-offline-compact]').isVisible(),false,'the text-free mobile strip gives way to the themed offline header');
  assert.equal(await page.evaluate(()=>retiredBanner.hasAttribute('data-kr-offline-banner')),false,'React banner replacements release old markers');
  await page.evaluate(()=>{document.querySelector('.native-tabs').remove();panel.setEnabled(false);panel.setEnabled(true);refreshPage();});
  await header.locator('.channel-profile-region .profile-bio').waitFor();
  assert.equal(await toggle().getAttribute('aria-expanded'),'true','About still opens on native offline pages without tab navigation');
  await page.evaluate(()=>{window.savedBanner=document.getElementById('native-banner');savedBanner.remove();const live=document.createElement('span');live.textContent='LIVE';document.querySelector('.native-avatar').append(live);panel.setEnabled(false);panel.setEnabled(true);refreshPage();});
  assert.equal(await header.locator('.channel-profile-region').count(),0,'live channels retain their collapsed default');
  assert.equal(await page.locator('[data-kr-channel-offline],[data-kr-offline-categories],[data-kr-discovery-category]').count(),0,'live transitions restore all native category attributes');
  await page.evaluate(()=>{document.querySelector('.native-avatar span').remove();document.querySelector('main').prepend(savedBanner);refreshPage();});
  await header.locator('.channel-profile-region').waitFor();assert.equal(await toggle().getAttribute('aria-expanded'),'true');
  await page.evaluate(()=>{panel.setEnabled(false);channelPage.refresh(false);});
  assert.equal(await page.locator('[data-kr-offline-banner],[data-kr-channel-offline],[data-kr-offline-art],[data-kr-discovery-category],[data-kr-offline-viewers]').count(),0,'disabling restores every offline marker');
  assert.equal(await page.locator('#native-art').isVisible(),true);assert.equal(await page.locator('#native-about').isVisible(),true);
  await page.evaluate(()=>{panel.destroy();channelPage.destroy();});assert.deepEqual(errors,[]);
  console.log(`${engine}: themed offline banner/categories, initial About, late metadata, manual collapse, native controls, responsive layout, live transitions and restoration passed`);
}finally{await browser.close();}
