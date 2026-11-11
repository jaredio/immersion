import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),fixture=await readFile('tests/clip-editor-fixture.html','utf8'),recordingId='12345678-1234-1234-1234-123456789abc';
const context=await chromium.launchPersistentContext(path.join(root,'tmp/clip-installed-'+Date.now()),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+path.join(root,'dist/chrome'),'--load-extension='+path.join(root,'dist/chrome')]});
try{
 await context.route('https://stream.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="5050"><rect width="900" height="5050" fill="#34473c"/></svg>'}));
 await context.route('https://kick.com/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname.endsWith('/videos')?[{video:{uuid:recordingId,status:'public'},duration:10800000,session_title:'Three-hour broadcast'}]:{slug:'alpha',user:{username:'Alpha'},livestream:{is_live:true,session_title:'Live studio test'}}});
  const playback=url.pathname.includes('/videos/')?`<script>document.addEventListener('DOMContentLoaded',()=>{const slider=document.querySelector('main [aria-label="Current video time"]'),parent=slider.parentElement;slider.remove();setTimeout(()=>parent.append(slider),1000);const image=new Image();image.hidden=true;document.querySelector('main').append(image);setTimeout(()=>image.src='https://stream.kick.com/installed/media/thumbnails/thumbnail-sheet-0.webp',200);});</script>`:'';
  return route.fulfill({contentType:'text/html',body:url.searchParams.has('immersion-frame')?fixture.replace('</body>',playback+'</body>'):fixture.replace('<body>','<body><aside id="sidebar-wrapper" style="position:fixed;right:0;top:60px;width:220px;height:700px;background:#141419"></aside>')});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.log('Page error:',error.message);});await page.goto('https://kick.com/alpha');
 await page.getByRole('button',{name:'Open multiview',exact:true}).click();
 await page.locator('main[data-kr-multi-active="true"]').waitFor();
 await page.evaluate(()=>window.keptLivePlayer=document.querySelector('#injected-channel-player'));
 await page.locator('main').click({position:{x:20,y:5}});await page.keyboard.press('c');
 const studio=page.locator('#kr-clip-studio-root');await studio.locator('dialog[open]').waitFor();
 await studio.locator('iframe').waitFor();
 const frameFor=async()=>{for(let i=0;i<150;i++){const frame=page.frames().find(frame=>frame.name()==='kick-refined-clip:alpha'&&frame.url().startsWith('https://kick.com'));if(frame)return frame;await page.waitForTimeout(30);}throw Error('No clipping frame');};
 let frame=await frameFor();await frame.locator('#clip-creator-dialog[data-kr-clip-studio]').waitFor({timeout:10000});
 assert.equal(await frame.locator('#kr-root,#kr-multi-root').count(),0,'the clip frame cannot recursively start a workspace');
 await studio.getByRole('button',{name:'Stream history',exact:true}).click();frame=await frameFor();await frame.waitForURL('**/videos/'+recordingId+'?immersion-frame=clip');
 await page.waitForFunction(()=>!document.getElementById('kr-clip-studio-root').shadowRoot.querySelector('[data-act=clip]').disabled);
 await page.waitForFunction(()=>document.getElementById('kr-clip-studio-root').shadowRoot.querySelector('.history-film img')?.src.includes('/installed/'));
 await page.waitForFunction(()=>document.getElementById('kr-clip-studio-root').shadowRoot.querySelector('.history-track').dataset.preview==='ready');
 await studio.getByRole('textbox',{name:'History in point',exact:true}).fill('2:00:00');await studio.getByRole('textbox',{name:'History in point',exact:true}).press('Tab');
 await studio.getByRole('button',{name:'Clip selection',exact:true}).click();
 await frame.locator('#clip-creator-dialog').waitFor();await frame.waitForFunction(()=>Math.abs(rangeState.start)<.2&&Math.abs(rangeState.end-30)<.2);
 assert.deepEqual(await frame.evaluate(()=>receivedNativeClip),{mode:'vod',startTime:7350},'installed isolated script reaches Kick’s MAIN-world clip provider');
 assert.equal(await frame.evaluate(()=>clipCalls.publishes),0,'preparing historical footage never publishes it');
 await studio.getByRole('button',{name:'Close clip studio',exact:true}).click();
 assert.equal(await page.evaluate(()=>keptLivePlayer===document.querySelector('#injected-channel-player')),true,'the live workspace player is retained');
 assert.equal(page.frames().filter(frame=>frame.name().startsWith('kick-refined-clip:')).length,0,'closing releases the clipping page and its workers');
 assert.deepEqual(errors,[]);console.log('Installed Chromium: workspace entry, isolated clip page, replay navigation, MAIN-world historical request, native trim and teardown passed.');
}finally{await context.close();}
