import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';

const engine=process.env.KR_ENGINE==='firefox'?firefox:chromium,browser=await engine.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.setContent('<main id="player"><video></video><div class="z-controls bottom-0"><button aria-label="Quality" aria-haspopup="menu">Quality</button></div></main>');
  for(const file of ['stream-clock.js','performance.js','player-controls.js'])await page.addScriptTag({path:'extension/'+file});
  await page.evaluate(()=>{
    const now=Date.parse('2026-01-02T10:00:00Z');Date.now=()=>now;
    window.controlState={muted:true,volume:.4,focused:false,startedAt:now-3*3600000-12*60000-34000};
    window.options={getVideo:()=>document.querySelector('video'),getState:()=>controlState,onToggle(){},onVolume(){},onFocus(){}};
    KickRefinedPerf.configure(true);KickRefinedPlayerControls.sync(document.getElementById('player'),options);
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-kr-elapsed]').textContent(),'3:12:34');
  const discoveries=await page.evaluate(()=>KickRefinedPerf.snapshot().counters['controls.discoveries']);
  await page.evaluate(()=>{document.querySelector('video').currentTime=120;for(let i=0;i<100;i++)KickRefinedPlayerControls.sync(document.getElementById('player'),options);});
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('[data-kr-elapsed]').textContent(),'3:12:34','seeking/idle time does not become stream uptime');
  assert.equal(await page.evaluate(()=>KickRefinedPerf.snapshot().counters['controls.discoveries']),discoveries,'state updates and clock ticks do not rediscover controls');
  await page.evaluate(()=>{const old=document.querySelector('.z-controls');window.keptNativeSource=old.querySelector('button:not([data-kr-action])');old.replaceChildren(Object.assign(document.createElement('button'),{textContent:'Clip'}));});
  await page.locator('[data-kr-action=clip]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-kr-unified-row]').count(),1,'native replacement restores one control row');
  await page.evaluate(()=>{window.removedBar=document.querySelector('.z-controls');removedBar.remove();});
  await page.waitForFunction(()=>!removedBar.querySelector('[data-kr-unified-row]'));
  assert.equal(await page.evaluate(()=>removedBar.querySelectorAll('[data-kr-unified-source],[data-kr-unified-bar]').length),0,'a missing native bar releases its row and source markers before another bar appears');
  await page.evaluate(()=>{const next=document.createElement('div');next.className='z-controls bottom-0';next.innerHTML='<button aria-label="Quality">Quality</button>';document.getElementById('player').append(next);removedBar=null;});
  await page.locator('[data-kr-unified-row]').waitFor();
  await page.evaluate(()=>{controlState.startedAt=null;KickRefinedPlayerControls.sync(document.getElementById('player'),options);});
  assert.equal(await page.locator('[data-kr-elapsed]').isVisible(),false,'unknown start time stays hidden');
  await page.evaluate(()=>{
    window.clockIntervals=new Set();const start=window.setInterval.bind(window),stop=window.clearInterval.bind(window);
    window.setInterval=(...args)=>{const id=start(...args);clockIntervals.add(id);return id;};window.clearInterval=id=>{clockIntervals.delete(id);stop(id);};
    window.hiddenForTest=false;Object.defineProperty(document,'hidden',{get:()=>hiddenForTest,configurable:true});
    controlState.startedAt=Date.now()-10000;KickRefinedPlayerControls.sync(document.getElementById('player'),options);
  });
  assert.equal(await page.evaluate(()=>clockIntervals.size),1);
  await page.evaluate(()=>{hiddenForTest=true;document.dispatchEvent(new Event('visibilitychange'));for(let i=0;i<100;i++)KickRefinedPlayerControls.sync(document.getElementById('player'),options);});
  assert.equal(await page.evaluate(()=>clockIntervals.size),0,'hidden tabs have no player clock interval even during status updates');
  await page.evaluate(()=>{const before=Date.now();Date.now=()=>before+42000;hiddenForTest=false;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('[data-kr-elapsed]').textContent(),'0:00:52','returning to the tab catches up immediately');
  assert.equal(await page.evaluate(()=>clockIntervals.size),1,'returning starts exactly one shared clock');
  await page.evaluate(()=>KickRefinedPlayerControls.clear(document.getElementById('player')));
  assert.equal(await page.evaluate(()=>clockIntervals.size),0,'clearing the final controls releases the clock');
  assert.equal(await page.locator('[data-kr-unified-row]').count(),0);
  assert.equal(await page.evaluate(()=>{document.querySelector('.z-controls').append(keptNativeSource);return keptNativeSource.hasAttribute('data-kr-unified-source');}),false,'retained native buttons have their markers restored after replacement/teardown');
  console.log(`${engine.name()}: total stream time, cached discovery, idle updates, native replacement and teardown passed`);
}finally{await browser.close();}
