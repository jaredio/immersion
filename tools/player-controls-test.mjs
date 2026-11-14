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
  await page.evaluate(()=>KickRefinedPlayerControls.clear(document.getElementById('player')));
  assert.equal(await page.locator('[data-kr-unified-row]').count(),0);
  assert.equal(await page.evaluate(()=>{document.querySelector('.z-controls').append(keptNativeSource);return keptNativeSource.hasAttribute('data-kr-unified-source');}),false,'retained native buttons have their markers restored after replacement/teardown');
  console.log(`${engine.name()}: total stream time, cached discovery, idle updates, native replacement and teardown passed`);
}finally{await browser.close();}
