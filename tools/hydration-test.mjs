import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const engine=process.env.KR_ENGINE||'chromium';
const root=process.cwd();
let browser,context;
if(engine==='chromium'){
  context=await playwright.chromium.launchPersistentContext(path.join(root,'tmp/hydration-'+Date.now()),{
    headless:true,executablePath:playwright.chromium.executablePath(),args:['--disable-extensions-except='+path.join(root,'dist/chrome'),'--load-extension='+path.join(root,'dist/chrome')]
  });
}else{
  browser=await playwright.firefox.launch({headless:true});
  context=await browser.newContext();
}
const fixture=await readFile('tests/fixture.html','utf8');
try{
  await context.addInitScript(()=>{
    window.__next_f=[];
    window.browser={runtime:{getURL:file=>'https://kick.com/__extension/'+file},storage:{local:{get:async()=>({}),set:async()=>{}},onChanged:{addListener(){},removeListener(){}}}};
  });
  await context.addInitScript({path:'extension/page-ready.js'});
  await context.route('https://kick.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:'extension/'+url.pathname.split('/').pop()});
    if(url.pathname.includes('/api/'))return route.fulfill({json:[]});
    return route.fulfill({contentType:'text/html',body:fixture.replace('<h1>','<h1 data-testid="livestream-title">')});
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://kick.com/aurora');
  if(engine==='firefox'){
    const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));
    for(const file of manifest.content_scripts.find(item=>item.js?.includes('content.js')).js)await page.addScriptTag({path:'extension/'+file});
  }
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#kr-root').count(),0,'startup waits while Kick has not hydrated the native page');
  await page.evaluate(()=>{document.querySelector('main').__reactFiber$fixture={};});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#kr-root').count(),0,'a hydrated main does not release an unhydrated channel header');
  await page.evaluate(()=>{
    for(const node of document.querySelectorAll('body *'))node.__reactFiber$fixture={};
  });
  await page.locator('#kr-root').waitFor({state:'attached'});
  await page.addScriptTag({path:'extension/player-controls.js'});
  await page.evaluate(()=>{
    const player=document.createElement('section');player.id='readiness-player';
    player.innerHTML='<video></video><div class="z-controls bottom-0"><button aria-label="Quality">Quality</button></div>';
    document.querySelector('main').append(player);
    window.options={getVideo:()=>player.querySelector('video'),getState:()=>({muted:true,volume:1}),onToggle(){},onVolume(){},onFocus(){}};
    window.initialSync=KickRefinedPlayerControls.sync(player,options);
  });
  assert.equal(await page.evaluate(()=>initialSync),false);
  assert.equal(await page.locator('#readiness-player [data-kr-unified-row]').count(),0);
  await page.evaluate(()=>{
    document.querySelector('#readiness-player .z-controls').__reactFiber$fixture={};
    KickRefinedPlayerControls.sync(document.getElementById('readiness-player'),options);
  });
  assert.equal(await page.locator('#readiness-player [data-kr-unified-row]').count(),1);
  assert.deepEqual(errors,[]);
  console.log(engine+': delayed hydration blocks DOM enhancements and player chrome until native surfaces are ready');
}finally{await context.close();await browser?.close();}
