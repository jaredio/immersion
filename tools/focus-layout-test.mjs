import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';

const root=process.cwd(),engine=process.env.KR_ENGINE||'chromium';
const {frame,fixture}=await workspaceFixtures();
const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));
let browser,context;
if(engine==='firefox'){
  browser=await firefox.launch({headless:true});context=await browser.newContext({viewport:{width:1500,height:1000}});
  await context.addInitScript(()=>{const values={};window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>values,set:async patch=>Object.assign(values,patch)},onChanged:{addListener(){},removeListener(){}}}};});
}else{
  const extension=path.join(root,'dist/chrome');
  context=await chromium.launchPersistentContext(path.join(root,`tmp/focus-layout-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1500,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  if(!context.serviceWorkers().length)await context.waitForEvent('serviceworker');
}
try{
  await context.route('https://kick.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:path.join(root,'extension',url.pathname.split('/').pop())});
    if(url.pathname.startsWith('/api/v2/channels/')){const slug=url.pathname.split('/').pop();return route.fulfill({json:{slug,user:{username:slug},livestream:{is_live:true,session_title:slug,viewer_count:100,categories:[{name:'Music'}]}}});}
    if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
    return route.fulfill({contentType:'text/html',body:url.searchParams.get('immersion-frame')==='full'?frame:fixture});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://kick.com/native?refined-multi=native,a,b,c,d,e&immersion-player=full&refined-layout=focus');
  if(engine==='firefox'){
    for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:`extension/${file}`});
    for(const file of manifest.content_scripts.find(script=>script.js?.includes('content.js')).js)await page.addScriptTag({path:`extension/${file}`});
  }
  const workspace=page.locator('#kr-multi-root');
  await workspace.locator('.multi-tile').nth(5).waitFor({timeout:10000});
  await page.waitForFunction(()=>document.getElementById('kr-multi-root').shadowRoot.querySelector('#multi-grid').style.gridTemplateColumns.includes('px'));
  if(engine==='firefox')for(const child of page.frames().filter(frame=>frame!==page.mainFrame()&&frame.url().includes('immersion-frame=full'))){
    for(const file of ['stream-clock.js','performance.js','player-dom.js','full-player-frame.js','player-controls.js','player-frame.js'])await child.addScriptTag({path:`extension/${file}`});
  }
  await page.waitForTimeout(500);
  const inspect=()=>workspace.locator('#multi-grid').evaluate(grid=>{
    const cards=[...grid.children].filter(card=>card.matches('.multi-tile'));
    const box=card=>{const r=card.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const featured=cards.find(card=>card.dataset.featured==='true'),main=box(featured);
    return {main,others:cards.filter(card=>card!==featured).map(box),dividerHeight:grid.parentElement.querySelector('.multi-divider').getBoundingClientRect().height};
  });
  const verify=async()=>{
    const {main,others,dividerHeight}=await inspect();
    const below=others.filter(box=>box.y>=main.bottom-1),side=others.filter(box=>box.y<main.bottom-1);
    assert.ok(below.some(box=>box.x<main.right-1),'overflow streams occupy the space beneath the focused stream');
    assert.ok(side.length>0&&side.every(box=>box.x>=main.right),'side panes stay beside the focused stream');
    assert.ok(Math.abs(side.at(-1).bottom-main.bottom)<2,'the side column ends at the focused bottom');
    assert.ok(Math.abs(Math.min(...below.map(box=>box.y))-main.bottom-8)<2,'overflow starts directly below the focused player');
    for(const [i,a]of others.entries())for(const b of others.slice(i+1))assert.ok(a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1,'stream panes never overlap');
    assert.ok(Math.abs(dividerHeight-main.height)<2,`divider ends with the focused stream: ${JSON.stringify({main,dividerHeight})}`);
  };
  await verify();
  await page.evaluate(()=>{window.keptFrames=[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe')];});
  const divider=workspace.getByRole('separator',{name:'Resize featured stream',exact:true});
  // The divider is also available while the workspace toolbar is collapsed.
  await divider.evaluate(node=>{node.focus();node.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));});
  await page.waitForTimeout(250);await verify();
  await workspace.locator('.multi-tile[data-channel="a"] .multi-tile-header').dblclick({position:{x:5,y:5}});
  await page.waitForTimeout(250);await verify();
  assert.equal(await page.evaluate(()=>keptFrames.every(frame=>frame.isConnected&&[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe')].includes(frame))),true,'repacking and refocusing preserve iframe instances');
  await page.setViewportSize({width:850,height:1000});await page.waitForTimeout(250);
  assert.equal(await workspace.locator('#multi-grid').evaluate(grid=>grid.style.gridTemplateColumns),'','narrow layouts release desktop placement');
  await page.setViewportSize({width:1500,height:1000});await page.waitForTimeout(250);await verify();
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/${engine}-focus-wrap.png`,fullPage:true});
  await workspace.getByRole('button',{name:'Remove e',exact:true}).click();
  await divider.evaluate(node=>{node.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));for(let i=0;i<29;i++)node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
  await page.waitForTimeout(250);await verify();
  const five=await inspect(),bottom=five.others.filter(box=>box.y>=five.main.bottom-1);
  assert.equal(bottom.length,2,'five streams have a balanced pair below the main player');
  assert.ok(Math.abs(bottom[0].width-bottom[1].width)<2,'the lower panes share the full width evenly');
  assert.ok(bottom[0].width>five.others[0].width*1.5,'overflow panes are larger than rail thumbnails');
  await page.waitForTimeout(250);assert.deepEqual(await inspect(),five,'fitted pane heights stabilize instead of feeding back into measurements');
  await page.screenshot({path:`artifacts/${engine}-focus-five-balanced.png`,fullPage:true});
  await workspace.getByRole('button',{name:'Remove d',exact:true}).click();
  await divider.evaluate(node=>{node.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));for(let i=0;i<21;i++)node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
  await page.waitForTimeout(250);await verify();
  const four=await inspect();assert.equal(four.others.filter(box=>box.y<four.main.bottom-1).length,2,'four streams at a two-thirds split fill two right-side slots');
  await page.screenshot({path:`artifacts/${engine}-focus-four-66.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`${engine}: focus overflow, resizing, refocusing, iframe preservation and responsive reset passed`);
}finally{await context.close();await browser?.close();}
