import playwright from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const engine=process.env.KR_ENGINE||'chromium',browser=await playwright[engine].launch({headless:true});
const avatar='<button class="native-avatar"><img data-testid="channel-avatar" src="https://files.kick.com/tall.svg" alt="Nick"><span>LIVE</span></button>';
const identity=`<div>${avatar}<div><button><h1 data-testid="channel-username">nickwhite</h1></button><a href="/category/irl">IRL</a><p>68.8K followers</p></div></div>`;
const videoCard=index=>`<article data-testid="vods-card"><div class="native-preview"><a data-testid="media-card-thumbnail" href="/nickwhite/videos/00000000-0000-0000-0000-${String(index).padStart(12,'0')}"><img data-thumbnail src="https://files.kick.com/thumb.svg" alt="Recording ${index}"><span title="${(index+1)*1000}">${index+1}K</span><div class="native-duration"><span>2:03:04</span></div></a></div><div class="native-info"><a href="/nickwhite"><img src="https://files.kick.com/tall.svg" alt="nickwhite"></a><div><a href="/nickwhite">nickwhite</a><a href="/nickwhite/videos/00000000-0000-0000-0000-${String(index).padStart(12,'0')}"><h3>Houston TX Collect A Con! ${index}</h3></a><p>IRL \u00b7 13 hours ago</p></div><button aria-label="Recording menu ${index}">...</button></div></article>`;
const clipCard=index=>`<article data-testid="clips-card"><button aria-label="Open clip modal"><img data-thumbnail src="https://files.kick.com/clip-thumb.svg" alt="nickwhite"><span title="${(index+1)*500}">${index+1}K</span><div>0:40</div></button><a href="/nickwhite"><img src="https://files.kick.com/tall.svg" alt="Avatar"></a><div><h3><button>A moment from the stream ${index}</button></h3><a href="/nickwhite/clips/clip_0000000000000000000000000${index}"><span>2 days ago</span></a></div></article>`;
const fixture=`<!doctype html><html data-kr-enabled="true"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#09090b;color:#eee;font:14px system-ui}main{max-width:1220px;margin:auto;padding:24px}.native-header{display:flex;justify-content:space-between;padding:20px}.native-header>div{display:flex;gap:12px}.native-avatar img{width:70px;height:70px}button,a{color:inherit}.native-tabs{display:flex;gap:20px;padding:20px 0}.native-grid{display:flex;gap:15px}.native-crop{max-height:350px;overflow:hidden}.native-preview{padding:16px}.native-info{display:flex;align-items:flex-start;gap:10px}.native-info>div{min-width:0;flex:1}.native-info img{width:56px;height:56px}.native-duration{position:absolute;left:8px;right:8px;bottom:8px;background:#111;text-align:center}.native-heading{display:flex;justify-content:space-between;align-items:center;margin-top:40px}.native-heading h2{font-size:30px}article{width:300px}article img{width:100%}</style></head><body><main><div id="channel-content"><div id="stream-header" class="native-header">${identity}<h2 data-testid="livestream-title">Houston TX Collect A Con!</h2><div><button data-testid="follow-button" aria-label="Follow" aria-pressed="false">Follow</button><span data-testid="viewer-count">1,990 watching</span></div></div></div><div id="profile-header" class="native-header">${identity}<div><button data-testid="follow-button" aria-label="Follow">Follow</button><button data-testid="sub-button" aria-label="Subscribe">Subscribe</button></div></div><nav class="native-tabs"><a href="/nickwhite" aria-current="page">Home</a><a href="/nickwhite/about">About</a><a href="/nickwhite/videos">Videos</a><a href="/nickwhite/clips">Clips</a><a href="/nickwhite/schedule">Schedule</a></nav><div class="native-collection"><div class="native-heading"><h2>Stream Videos</h2><a href="/nickwhite/videos">View all</a></div><section class="native-crop"><div class="native-grid">${Array.from({length:12},(_,index)=>videoCard(index)).join('')}</div></section></div><div class="native-collection"><div class="native-heading"><h2>Popular Clips</h2><a href="/nickwhite/clips">View all</a></div><section><div>${Array.from({length:6},(_,i)=>clipCard(i)).join('')}</div></section></div></main></body></html>`;
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://kick.com/**',route=>route.request().url().endsWith('/ui.css')?route.fulfill({path:'extension/ui.css'}):route.fulfill({contentType:'text/html',body:fixture}));
 await page.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:route.request().url().includes('tall')?'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="400"><rect width="20" height="400" fill="white"/></svg>':'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#263a32"/><text x="40" y="140" fill="#b0ff8c" font-size="32">Stream recording</text></svg>'}));
 await page.goto('https://kick.com/nickwhite');
 await page.evaluate(()=>{
  const tabs=document.querySelector('.native-tabs'),sticky=document.createElement('div');
  sticky.id='native-sticky-tabs';sticky.style.position='sticky';sticky.style.top='0';tabs.before(sticky);sticky.append(tabs);
 });
 for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:`extension/${file}`});
 await page.evaluate(()=>window.chrome={runtime:{getURL:file=>`https://kick.com/${file}`}});
 await page.addScriptTag({path:'extension/scroll.js'});
 for(const file of ['shared.js','dom.js','profile.js','channel-library.js','channel-page.js','channel-panel.js'])await page.addScriptTag({path:`extension/${file}`});
 await page.evaluate(()=>{
  window.nativeActionCalls=[];for(const button of document.querySelectorAll('.native-header button'))button.addEventListener('click',()=>{nativeActionCalls.push(button.getAttribute('aria-label'));if(button.dataset.testid==='follow-button')button.setAttribute('aria-pressed','true');});
  window.navigationCalls=[];for(const link of document.querySelectorAll('.native-tabs a,article a'))link.addEventListener('click',event=>{event.preventDefault();navigationCalls.push(link.getAttribute('href'));if(link.closest('.native-tabs')){history.pushState({},'',link.href);channelPage.refresh();panel.refresh();}});
  const support={channel:async()=>({title:'nickwhite',live:'live',streamTitle:'Houston TX Collect A Con!'}),panels:async()=>[],makeButton:()=>{const button=document.createElement('button');button.className='kr-support-button';button.textContent='Donate';return button;}};
  window.watched=[];window.dragged=[];window.channelPage=KickRefinedChannelPage.create({onWatch:async row=>{watched.push(row.href);return true;},onDrag:(event,row)=>{event.preventDefault();dragged.push(row.href);}});window.panel=KickRefinedChannelPanel.create({support,onChange:()=>panel.refresh()});channelPage.refresh();panel.refresh();window.originalCard=document.querySelector('article');window.originalTab=document.querySelector('.native-tabs');
 });
 const parsed=await page.evaluate(async()=>{const card=document.createElement('article');card.innerHTML='<a href="https://kick.com/nickwhite?clip=clip_00000000000000000000000000"><img><span title="a date"></span><span title="1200">1.2K</span><div>0:40</div></a><h3></h3><p>IRL \u00b7 13 hours ago</p>';card.querySelector('h3').textContent='<img onerror=bad()> Public title';Object.defineProperty(card.querySelector('img'),'src',{value:'https://kick.com/_next/image?url=thumb',configurable:true});const first=KickRefinedChannelLibrary.read(card,'nickwhite');await new Promise(resolve=>setTimeout(resolve,20));const second=KickRefinedChannelLibrary.read(card,'nickwhite');for(const link of card.querySelectorAll('a'))link.href='https://evil.test/video';return {type:first.type,image:first.image,views:first.views,duration:first.duration,date:first.date,title:first.title,stable:first.created===second.created,rejected:KickRefinedChannelLibrary.read(card,'nickwhite')===null};});assert.deepEqual(parsed,{type:'clip',image:'https://kick.com/_next/image?url=thumb',views:1200,duration:40,date:'13 hours ago',title:'<img onerror=bad()> Public title',stable:true,rejected:true});
 for(const image of await page.locator('#kr-channel-library .rail .thumb img').all()){await image.evaluate(image=>image.decode());assert.ok((await image.getAttribute('src')).endsWith('/clip-thumb.svg'),'clip thumbnails come from the preview button, not the avatar');}assert.equal(await page.locator('#kr-channel-library .rail .thumb img').count(),3);
 const header=page.locator('#kr-channel-root');await header.locator('.channel-title').waitFor();
 assert.equal(await page.locator('#profile-header').isVisible(),false,'profile identity is consolidated');assert.equal(await page.locator('#stream-header').isVisible(),false);assert.equal(await page.locator('#kr-channel-root').count(),1);
 await header.getByRole('button',{name:'Subscribe',exact:true}).click();assert.ok((await page.evaluate(()=>nativeActionCalls)).includes('Subscribe'),'missing subscription action forwards to the native profile header');
 await header.getByRole('button',{name:'Follow',exact:true}).click();assert.equal(await header.locator('[data-kind=follow]').getAttribute('aria-pressed'),'true');
 await header.locator('.channel-avatar img').evaluate(image=>image.decode());
 for(const width of [1360,760,390]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>{channelPage.refresh();panel.refresh();});
  assert.equal(await header.locator('.channel-avatar').evaluate(node=>{const outer=node.getBoundingClientRect(),image=node.querySelector('img').getBoundingClientRect();return Math.abs(outer.width-image.width)<1&&Math.abs(outer.height-image.height)<1&&Math.abs(image.width-image.height)<1&&image.bottom<=outer.bottom+1;}),true,'portrait avatars stay within their circular frame');
  assert.equal(await page.locator('main').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'channel collections fit the viewport');
 }
 await page.setViewportSize({width:1360,height:1000});

 const library=page.locator('#kr-channel-library');await library.getByRole('heading',{name:'Library',exact:true}).waitFor();assert.equal(await library.locator('.card').count(),4,'overview shows one recording and three highlights');assert.equal(await page.locator('.native-tabs').isVisible(),false);assert.equal(await page.locator('main article').first().isVisible(),false);
 assert.equal(await page.locator('#native-sticky-tabs #kr-channel-library').count(),0,'the library scrolls outside Kick’s sticky tab strip');
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/channel-overview-${engine}.png`,fullPage:true});
 await library.getByRole('link',{name:'Videos',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/nickwhite/videos');assert.equal(await library.locator('.items .card').count(),12);
 await page.evaluate(()=>{window.leakedLibraryKeys=0;window.addEventListener('keydown',()=>leakedLibraryKeys++,{capture:true});});await library.getByRole('searchbox',{name:'Find a video',exact:true}).pressSequentially('tmTM');assert.equal(await library.getByRole('searchbox',{name:'Find a video',exact:true}).inputValue(),'tmTM');assert.equal(await page.evaluate(()=>leakedLibraryKeys),0,'library typing does not trigger native player shortcuts');await library.getByRole('searchbox',{name:'Find a video',exact:true}).fill('');
 await library.getByRole('searchbox',{name:'Find a video',exact:true}).fill('Con! 11');assert.equal(await library.locator('.items .card').count(),1);await library.getByRole('searchbox',{name:'Find a video',exact:true}).fill('');
 await library.getByRole('combobox',{name:'Video length',exact:true}).selectOption('short');assert.equal(await library.getByText('No videos match these filters.',{exact:true}).count(),1);await library.getByRole('combobox',{name:'Video length',exact:true}).selectOption('all');
 await library.getByRole('combobox',{name:'Library sort',exact:true}).selectOption('views');assert.match(await library.locator('.items .title').first().textContent(),/11$/);
 await library.getByRole('combobox',{name:'Library sort',exact:true}).selectOption('title');
 assert.deepEqual(await library.locator('.items .title').allTextContents(),Array.from({length:12},(_,index)=>`Houston TX Collect A Con! ${index}`));
 await page.evaluate(()=>{
  const card=document.querySelectorAll('[data-testid="vods-card"]')[4];
  card.querySelector('.native-info p').innerHTML='<span>13 hours ago</span>';
  card.querySelector('.native-info p span').title=new Date(Date.now()-12.5*3600000).toLocaleString('en-US');
  const filters=document.createElement('div');filters.id='native-filters';filters.innerHTML='<label>Search recordings<input type="search"></label><div><span>Sort by:</span><button role="combobox" aria-label="Sort by:">Newest</button></div><p>No videos match your search.</p>';
  document.querySelector('.native-grid').before(filters);channelPage.refresh();
 });
 await library.getByRole('combobox',{name:'Library sort',exact:true}).selectOption('recent');
 assert.match(await library.locator('.items .title').first().textContent(),/4$/,'exact timestamps break ties between matching relative dates');
 await library.getByRole('searchbox',{name:'Find a video',exact:true}).fill('unmatched recording');
 assert.equal(await library.getByText('No videos match these filters.',{exact:true}).count(),1);
 for(const node of await page.locator('#native-filters input,#native-filters button,#native-filters p,main article').all())assert.equal(await node.isVisible(),false);
 await library.getByRole('searchbox',{name:'Find a video',exact:true}).fill('');
 await library.getByRole('button',{name:'List',exact:true}).click();assert.equal(await library.locator('.items').getAttribute('data-view'),'list');await library.getByRole('link',{name:'Clips',exact:true}).click();assert.equal(await library.locator('.items .card').count(),6);assert.equal(await library.locator('.items').getAttribute('data-view'),'list');await library.getByRole('button',{name:'Grid',exact:true}).click();
 await library.locator('.watch').first().click();assert.equal(await page.evaluate(()=>watched.length),1);await library.locator('.items .title').first().click();assert.ok((await page.evaluate(()=>navigationCalls)).some(path=>path.includes('/clips/')));await library.locator('.items .card').first().dispatchEvent('dragstart');assert.equal(await page.evaluate(()=>dragged.length),1);
 for(const width of [1360,760,390]){await page.setViewportSize({width,height:1000});assert.equal(await library.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'library fits each viewport');}
 await page.setViewportSize({width:1360,height:1000});await library.getByRole('link',{name:'Videos',exact:true}).click();await library.getByRole('button',{name:'Grid',exact:true}).click();await page.screenshot({path:`artifacts/channel-recordings-${engine}.png`,fullPage:true});
 await page.evaluate(markup=>{const button=document.createElement('button');button.textContent='Load more';document.querySelector('.native-grid').parentElement.append(button);button.addEventListener('click',()=>{document.querySelector('.native-grid').insertAdjacentHTML('beforeend',markup);channelPage.refresh();panel.refresh();});channelPage.refresh();},videoCard(12));await library.getByRole('button',{name:'Load more videos',exact:true}).click();assert.equal(await library.locator('.items .card').count(),13);
 const changes=await page.evaluate(async()=>{let count=0;const first=document.querySelector('#kr-channel-library').shadowRoot.querySelector('.items .card');const observer=new MutationObserver(records=>count+=records.length);observer.observe(document.querySelector('main'),{childList:true,attributes:true,subtree:true});for(let i=0;i<30;i++)channelPage.refresh();await Promise.resolve();observer.disconnect();return {count,card:originalCard===document.querySelector('article'),tabs:originalTab===document.querySelector('.native-tabs'),owned:first===document.querySelector('#kr-channel-library').shadowRoot.querySelector('.items .card')};});assert.deepEqual(changes,{count:0,card:true,tabs:true,owned:true});
 await page.evaluate(()=>{const source=document.getElementById('profile-header');source.replaceWith(source.cloneNode(true));document.querySelector('main').after(document.getElementById('profile-header'));channelPage.refresh();panel.refresh();});assert.equal(await page.locator('#profile-header').isVisible(),false,'React replacement is consolidated again');
 await page.evaluate(()=>{const source=document.getElementById('profile-header');source.querySelector('[data-testid=channel-username]').removeAttribute('data-testid');const image=source.querySelector('[data-testid=channel-avatar]');image.removeAttribute('data-testid');image.alt='nickwhite';document.getElementById('stream-header').remove();history.replaceState({},'','/nickwhite/videos');channelPage.refresh();panel.refresh();});assert.equal(await page.locator('#profile-header').isVisible(),false,'profile-only routes support semantic identity markup');assert.equal(await header.locator('.channel-name').textContent(),'nickwhite');assert.equal(await library.locator('.items .card').count(),13);
 await page.evaluate(()=>{history.replaceState({},'','/nickwhite/about');const about=document.createElement('section');about.id='about-section';about.innerHTML='<h2>About nickwhite</h2><p>Channel bio</p>';document.querySelector('main').append(about);channelPage.refresh();panel.refresh();});assert.equal(await page.locator('#about-section').isVisible(),true,'native About content remains available');assert.equal(await page.locator('#about-section').getAttribute('data-kr-channel-about'),'');
 await page.evaluate(()=>{history.replaceState({},'','/nickwhite');channelPage.refresh();panel.refresh();});assert.equal(await page.locator('#about-section').isVisible(),false);await page.evaluate(()=>{history.replaceState({},'','/nickwhite/about');channelPage.refresh();panel.refresh();});assert.equal(await page.locator('#about-section').isVisible(),true,'retained native About content is restored after a route round trip');
 await page.evaluate(()=>{history.replaceState({},'','/nickwhite/videos');for(const card of document.querySelectorAll('[data-testid=vods-card],[data-testid=clips-card]'))card.remove();const unsupported=document.createElement('article');unsupported.dataset.testid='vods-card';unsupported.innerHTML='<img><a href="https://evil.test/video">Unsupported source</a>';document.querySelector('.native-grid').append(unsupported);channelPage.refresh();});assert.equal(await page.locator('#kr-channel-library').count(),0,'unsupported media markup falls back to the original page');assert.equal(await page.locator('.native-tabs').isVisible(),true);
 await page.evaluate(()=>{panel.setEnabled(false);channelPage.refresh(false);});assert.equal(await page.locator('#profile-header').isVisible(),true);assert.equal(await page.locator('#kr-channel-root').count(),0);assert.equal(await page.locator('[data-kr-library-source],[data-kr-library-shell],#kr-channel-library').count(),0,'disabling restores all native surfaces');
 await page.evaluate(()=>{channelPage.destroy();panel.destroy();});assert.deepEqual(errors,[]);
 await page.route('https://kick.com/api/v2/channels/nickwhite/clips?**',route=>route.fulfill({json:{clips:[{id:`clip_${'1'.padStart(26,'0')}`,title:'Public highlight',duration:43,views:123}]}}));
 await page.addScriptTag({path:'extension/search.js'});
 await page.evaluate(()=>{
  history.replaceState({},'','/nickwhite');
  document.querySelector('.native-tabs [aria-current]').removeAttribute('aria-current');
  for(const card of document.querySelectorAll('main article'))card.remove();
  window.channelPage=KickRefinedChannelPage.create();channelPage.refresh();
 });
 await library.locator('.feature .title').getByText('Houston TX Collect A Con! 0',{exact:true}).waitFor();
 await library.locator('.rail .title').getByText('Public highlight',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.querySelectorAll('main article').length),0,'Overview loads independently of native cards');
 await page.evaluate(()=>channelPage.destroy());
 const requests=[];
 await page.route('https://kick.com/api/v2/channels/nickwhite/clips?**',route=>{
  const params=new URL(route.request().url()).searchParams,sort=params.get('sort'),cursor=params.get('cursor');
  requests.push(sort);
  const clip=(id,title,duration,views)=>({id:`clip_${String(id).padStart(26,'0')}`,title,duration,views,created_at:'2026-11-10T18:00:00Z'});
  return route.fulfill({json:sort==='view'?{clips:[clip(2,'Popular result',75,1000)]}:cursor?{clips:[clip(3,'Alphabetical result',15,5)]}:{clips:[clip(1,'Newest result',48,7)],nextCursor:'next'}});
 });
 await page.route('https://kick.com/api/v2/channels/nickwhite/videos',route=>route.fulfill({json:[{
  session_title:'Public recording',duration:180000,views:16,video:{uuid:'00000000-0000-0000-0000-000000000001',created_at:'2026-11-10T18:00:00Z',status:'public'}
 }]}));
 await page.route('https://kick.com/nickwhite/schedule',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><nav>Kick navigation</nav><main><div data-testid="schedule-viewer-page"><button>Next week</button></div></main></body></html>'}));
 await page.evaluate(()=>{
  const support={channel:async()=>({title:'nickwhite',bio:'Unified channel bio'}),panels:async()=>[],makeButton:()=>document.createElement('button')};
  const refresh=()=>{panel.refresh();channelPage.refresh();};
  window.panel=KickRefinedChannelPanel.create({support,integratedProfile:true,onChange:refresh});
  window.channelPage=KickRefinedChannelPage.create({getProfileMount:tab=>panel.getProfileMount(tab),onChange:refresh});
  refresh();
 });
 assert.equal(await library.count(),0,'visiting a stream does not open or load its profile');
 assert.deepEqual(requests,[]);
 await header.locator('.channel-name-button').click();
 await header.locator('#kr-channel-library .feature .title').waitFor();
 await library.getByRole('link',{name:'Clips',exact:true}).click();
 await library.getByRole('link',{name:'Newest result',exact:true}).waitFor();
 await library.getByRole('combobox',{name:'Library sort',exact:true}).selectOption('views');
 await library.getByRole('link',{name:'Popular result',exact:true}).waitFor();
 await library.getByRole('combobox',{name:'Library sort',exact:true}).selectOption('title');
 await library.getByRole('link',{name:'Alphabetical result',exact:true}).waitFor();
 assert.deepEqual(await library.locator('.items .title').allTextContents(),['Alphabetical result','Newest result']);
 await library.getByRole('combobox',{name:'Video length',exact:true}).selectOption('short');
 assert.deepEqual(await library.locator('.items .title').allTextContents(),['Alphabetical result']);
 await library.getByRole('link',{name:'Videos',exact:true}).click();
 await library.getByRole('link',{name:'Public recording',exact:true}).waitFor();
 await library.getByRole('link',{name:'About',exact:true}).click();
 await header.getByText('Unified channel bio',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/nickwhite','inline tabs preserve the stream route');
 await library.getByRole('link',{name:'Schedule',exact:true}).click();
 const calendar=library.frameLocator('iframe[title="nickwhite schedule"]');
 await calendar.getByRole('button',{name:'Next week'}).waitFor();
 assert.equal(await calendar.locator('nav').isVisible(),false);
 assert.equal(new URL(page.url()).pathname,'/nickwhite');
 await library.getByRole('link',{name:'Overview',exact:true}).click();
 assert.equal(await library.locator('iframe[title="nickwhite schedule"]').isVisible(),false);
 await header.getByRole('button',{name:'Channel details for nickwhite',exact:true}).click();
 assert.equal(await library.count(),0);
 await page.evaluate(()=>{channelPage.destroy();panel.destroy();});
 assert.deepEqual(errors,[]);
 console.log(`${engine}: owned overview/library, search/sort/length/grid/list, native routing/pagination, workspace actions, responsive layout and restoration passed`);
}finally{await browser.close();}
