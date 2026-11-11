import playwright from 'playwright';
import assert from 'node:assert/strict';

const engine=process.env.KR_ENGINE||'chromium';
const browser=await playwright[engine].launch({headless:true});
const clipId=index=>'clip_'+String(index).padStart(26,'0');
const card=index=>`<article data-testid="clips-card"><button aria-label="Open clip modal"><img data-thumbnail src="https://clips.kick.com/thumb.svg"><span title="${index*100}">${index*100}</span><span>0:30</span></button><h3><button>Related clip ${index}</button></h3><a href="/soultravels/clips/${clipId(index)}"><span title="11/10/2026, 05:00 PM">1 day ago</span></a></article>`;
const fixture=`<!doctype html><html data-kr-enabled="true"><head><style>body{margin:20px;background:#09090b;color:white;font:14px system-ui}main{max-width:1100px;margin:auto}video{width:100%;height:220px;background:#17171b}.native-header{display:flex;justify-content:space-between;gap:20px;padding:20px 0}.identity{display:flex;gap:16px}img{width:56px}a{color:inherit}button{cursor:pointer}#related>div{display:flex;gap:20px}article{width:260px}</style></head><body><main><video controls id="video-player"></video><section class="native-header"><div class="identity"><a href="/soultravels"><img data-testid="channel-avatar" src="https://files.kick.com/avatar.svg"><span>LIVE</span></a><div><a href="/soultravels"><span data-testid="channel-username">SoulTravels</span></a><h1 data-testid="livestream-title" title="A clip title">A clip title</h1><div><a href="/category/irl">IRL</a></div></div></div><div><div><button data-testid="follow-button" aria-label="Follow">Follow</button><button aria-label="Subscribe">Subscribe</button></div><div><span title="3">3</span> views <span>24 minutes ago</span><button aria-label="Share via">Share</button><button><svg data-ds-icon="Download"></svg></button><button aria-label="Report">Report</button><a href="/soultravels">Watch livestream</a><a href="/soultravels/videos/recording?t=120">Watch full video</a></div></div></section><section id="related"><h2>More clips from SoulTravels</h2><div id="native-filters"><div><span>Sort by:</span><button role="combobox" aria-label="Sort by:">Views</button></div><div><span>Filter by:</span><button role="combobox" aria-label="Filter by:">All Time</button></div></div><div>${[1,2,3].map(card).join('')}</div></section></main></body></html>`;
try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://kick.com/**',route=>route.request().url().endsWith('/ui.css')?route.fulfill({path:'extension/ui.css'}):route.fulfill({contentType:'text/html',body:fixture}));
  for(const host of ['files','clips'])await page.route(`https://${host}.kick.com/**`,route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#263a32"/></svg>'}));
  await page.goto('https://kick.com/soultravels/clips/'+clipId(99));
  for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:'extension/'+file});
  await page.evaluate(()=>window.chrome={runtime:{getURL:file=>'https://kick.com/'+file}});
  for(const file of ['shared.js','dom.js','profile.js','channel-library.js','channel-page.js','channel-panel.js'])await page.addScriptTag({path:'extension/'+file});
  await page.evaluate(()=>{
    window.originalPlayer=document.querySelector('video');
    window.nativeCalls=[];
    for(const node of document.querySelectorAll('.native-header button,.native-header a'))node.addEventListener('click',event=>{event.preventDefault();nativeCalls.push(node.getAttribute('href')||node.getAttribute('aria-label')||node.querySelector('svg')?.getAttribute('data-ds-icon'));});
    window.adapter=KickRefinedChannelPage.create();
    const support={channel:async()=>({title:'SoulTravels',live:'live',viewers:'1200'}),panels:async()=>[],makeButton:()=>document.createElement('span')};
    window.panel=KickRefinedChannelPanel.create({support,onChange:()=>panel.refresh()});
    adapter.refresh();panel.refresh();
  });
  const header=page.locator('#kr-channel-root'),library=page.locator('#kr-channel-library');
  await header.getByText('A clip title',{exact:true}).waitFor();
  assert.equal(await page.locator('.native-header').isVisible(),false);
  assert.equal(await header.locator('.channel-live').count(),0);
  assert.equal(await header.locator('.channel-viewers').textContent(),'Clip · 3 views · 24 minutes ago');
  for(const name of ['Follow','Share via','Download clip','Watch livestream','Watch full video'])await header.getByRole('button',{name,exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>nativeCalls),['Follow','Share via','Download','/soultravels','/soultravels/videos/recording?t=120']);
  await library.getByRole('heading',{name:'More clips from soultravels',exact:true}).waitFor();
  assert.equal(await library.locator('.items .card').count(),3);
  for(const node of await page.locator('#native-filters button,#related [data-testid="clips-card"]').all())assert.equal(await node.isVisible(),false);
  await library.getByRole('combobox',{name:'Library sort'}).selectOption('views');
  assert.equal(await library.locator('.items .title').first().textContent(),'Related clip 3');
  await library.getByRole('searchbox').fill('Related clip 2');
  assert.equal(await library.locator('.items .card').count(),1);
  await library.getByRole('searchbox').fill('');
  await library.getByRole('button',{name:'List',exact:true}).click();
  assert.equal(await library.locator('.items').getAttribute('data-view'),'list');
  await page.evaluate(()=>{history.replaceState({},'','/soultravels/clips/'+('clip_'+String(98).padStart(26,'0')));document.querySelector('[data-testid="livestream-title"]').textContent='Next clip title';document.querySelector('[data-testid="livestream-title"]').title='Next clip title';adapter.refresh();panel.refresh();});
  await header.getByText('Next clip title',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.querySelector('video')===originalPlayer),true);
  for(const width of [1360,760,390]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await library.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
    assert.equal(await header.locator('.channel-panel').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
  }
  await page.evaluate(()=>{adapter.destroy();panel.destroy();});
  assert.equal(await page.locator('.native-header').isVisible(),true);
  assert.equal(await page.locator('#native-filters button').first().isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log(engine+': clip header/library, native actions, filtering, sorting, navigation, player preservation and restoration passed');
}finally{await browser.close();}
