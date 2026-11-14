/* Active-workspace churn plus post-GC retention checks. Local media, no live accounts. */
import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';

const engine=process.env.KR_ENGINE||'chromium';
const cycles=Number(process.env.KR_ENDURANCE_CYCLES||160),minutes=Number(process.env.KR_ENDURANCE_MINUTES||0);
assert.ok(Number.isInteger(cycles)&&cycles>0&&cycles<=10000&&Number.isFinite(minutes)&&minutes>=0&&minutes<=1440,'Invalid endurance duration');
const browser=await playwright[engine].launch({headless:true}),context=await browser.newContext({viewport:{width:1600,height:1000}});
const {fixture,frame}=await workspaceFixtures(),manifest=JSON.parse(await readFile('dist/chrome/manifest.json','utf8'));
const scripts=manifest.content_scripts.find(group=>group.js?.includes('content.js')).js;
const frameScripts=(await Promise.all(['stream-clock.js','performance.js','player-dom.js','full-player-frame.js','player-controls.js','player-frame.js'].map(file=>readFile(`extension/${file}`,'utf8')))).join('\n');
const samples=[],started=Date.now(),errors=[];let baseline,initialRenders,loadingGate,releaseLoading,layoutChecks;
try{
  await context.addInitScript(()=>{
    const values={};window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>values,set:async patch=>Object.assign(values,patch)}}};
    window.observed={mutation:new Set(),resize:new Map()};
    const Mutation=MutationObserver,Resize=ResizeObserver;
    window.MutationObserver=class extends Mutation{observe(...args){observed.mutation.add(this);return super.observe(...args);}disconnect(){observed.mutation.delete(this);return super.disconnect();}};
    window.ResizeObserver=class extends Resize{observe(node,...args){if(!observed.resize.has(this))observed.resize.set(this,new Set());observed.resize.get(this).add(node);return super.observe(node,...args);}unobserve(node){const nodes=observed.resize.get(this);nodes?.delete(node);if(!nodes?.size)observed.resize.delete(this);return super.unobserve(node);}disconnect(){observed.resize.delete(this);return super.disconnect();}};
  });
  await context.route('https://kick.com/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:`extension/${url.pathname.split('/').pop()}`});
    const framed=route.request().frame().parentFrame();if(framed&&loadingGate)await loadingGate;
    return route.fulfill({contentType:'text/html',body:framed?frame.replace('</body>',`<script>${frameScripts}</script></body>`):fixture});
  });
  await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:frame.replace('</body>',`<script>${frameScripts}</script></body>`)}));
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://kick.com/native');await page.addStyleTag({path:'extension/theme.css'});
  for(const file of scripts.slice(0,scripts.indexOf('multiview.js')+1))await page.addScriptTag({path:`extension/${file}`});
  await page.evaluate(()=>{
    KickRefinedPerf.configure(true);window.retired=[];window.extra=[];window.pendingMetadata=new Map();window.holdMetadata=false;
    window.remember=(kind,node)=>{if(node)retired.push({kind,cycle:window.cycleIndex,ref:new WeakRef(node)});};
    window.channels=()=>['native','alpha','beta',...extra].map(slug=>({slug,title:slug,live:'live'}));
    window.workspace=KickRefinedMulti.create({getChannels:channels,onKeydown(){},support:{channel:slug=>holdMetadata?new Promise(resolve=>pendingMetadata.set(slug,resolve)):Promise.resolve(channels().find(channel=>channel.slug===slug)||{slug,title:slug}),panels:async()=>[]},channelPanel:{version:0,card:slug=>Object.assign(document.createElement('div'),{className:'channel-panel',textContent:slug})}});
    window.measure=()=>({lifetime:KickRefinedLifetime.snapshot(),workspace:workspace.snapshot(),mutation:observed.mutation.size,resizeTargets:[...observed.resize.values()].reduce((sum,nodes)=>sum+nodes.size,0)});
    window.nativeBar=()=>{const bar=document.createElement('div');bar.className='z-controls bottom-0';bar.style.cssText='position:absolute;bottom:0;width:100%';bar.innerHTML='<button aria-label="Quality" aria-haspopup="menu">Quality</button>';return bar;};
    document.getElementById('injected-channel-player').addEventListener('click',event=>{
      if(event.target.closest('[data-kr-unified-row]')||event.target.getAttribute('aria-label')!=='Quality')return;
      const menu=document.createElement('div');menu.id='endurance-menu';menu.setAttribute('data-radix-popper-content-wrapper','');menu.innerHTML='<div role="menu"><button>1080p</button></div>';document.body.append(menu);event.target.setAttribute('aria-controls','endurance-menu');
    });
  });
  const cdp=engine==='chromium'?await context.newCDPSession(page):null;
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const ready=()=>page.waitForFunction(()=>[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-tile:not([data-native-player])')].every(tile=>tile.dataset.playerState==='ready'));
  async function memory(cycle){
    await settle();
    let heap=null,dom=null;
    if(cdp){await page.waitForTimeout(100);for(let i=0;i<2;i++)await cdp.send('HeapProfiler.collectGarbage');heap=await cdp.send('Runtime.getHeapUsage');dom=await cdp.send('Memory.getDOMCounters');}
    const retained=await page.evaluate(()=>{const counts={};for(const item of retired)if(item.ref.deref())counts[item.kind]=(counts[item.kind]||0)+1;retired=retired.filter(item=>item.ref.deref());return counts;});
    const sample={cycle,elapsedMs:Date.now()-started,owned:await page.evaluate(()=>measure()),frames:page.frames().length,heap,dom,retained};samples.push(sample);return sample;
  }
  await page.evaluate(()=>workspace.open(['alpha','beta'],'native',{channels:['native'],layout:'focus',playerMode:'full',chat:'native',chatVisible:false}));
  await ready();await settle();
  initialRenders=await page.evaluate(()=>KickRefinedPerf.snapshot().counters['workspace.renders']);
  assert.equal(initialRenders,2,'one initial render and one batched metadata render for all seeded channels');
  const geometry=()=>page.evaluate(()=>[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-tile')].map(card=>{const rect=card.getBoundingClientRect(),player=card.querySelector('.multi-player').getBoundingClientRect();return {slug:card.dataset.channel,x:rect.x,y:rect.y,width:rect.width,height:rect.height,playerHeight:player.height};}));
  await page.evaluate(()=>workspace.close());
  loadingGate=new Promise(resolve=>releaseLoading=resolve);
  await page.evaluate(async()=>{extra=['slowone','slowtwo','queuedone','queuedtwo'];holdMetadata=true;await workspace.open(extra,'native',{channels:['native'],layout:'focus',playerMode:'full',chat:'native',chatVisible:false});});
  await settle();const beforeMetadata=await geometry();
  assert.equal(await page.locator('#kr-multi-root .multi-tile[data-player-state="queued"]').count(),2);
  const renderStart=await page.evaluate(async()=>{
    const start=KickRefinedPerf.snapshot().counters['workspace.renders'];
    for(const message of document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player-loading p'))message.textContent='Loading a very long status message '.repeat(150);
    for(let round=0;round<20;round++){
      for(const [slug,resolve]of pendingMetadata){pendingMetadata.delete(slug);resolve({slug,title:'UnbrokenChannelName'.repeat(80),live:'live',category:'Updated category',image:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>'});}
      await Promise.resolve();
    }
    return start;
  });
  await settle();assert.deepEqual(await geometry(),beforeMetadata,'long titles, avatars, metadata and oversized loading messages do not move or resize panes');
  assert.equal((await page.locator('#kr-multi-root .multi-tile-identity a').allTextContents()).filter(title=>title.startsWith('UnbrokenChannelName')).length,4,'all four metadata replies reach their panes');
  const metadataRenders=await page.evaluate(()=>KickRefinedPerf.snapshot().counters['workspace.renders'])-renderStart;
  assert.equal(metadataRenders,1,'four metadata replies share one workspace render');
  const recovery=await page.locator('#kr-multi-root .multi-player-loading').first().evaluate(loading=>{loading.scrollTop=loading.scrollHeight;const box=loading.getBoundingClientRect(),button=loading.querySelector('button').getBoundingClientRect();return {overflow:loading.scrollHeight>loading.clientHeight,reachable:button.top>=box.top&&button.bottom<=box.bottom+1};});
  assert.equal(recovery.overflow,true);assert.equal(recovery.reachable,true,'recovery controls remain reachable when a loading message overflows a small pane');
  releaseLoading();loadingGate=null;await ready();await settle();
  assert.deepEqual(await geometry(),beforeMetadata,'ready players use the same reserved geometry as queued and loading panes');
  layoutChecks={panes:beforeMetadata.length,metadataRenders,recovery};
  console.log(`${engine}: stable queued/loading/ready panes, long titles, avatars and one render for four metadata replies passed`);
  await page.evaluate(()=>{for(const frame of document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe'))remember('frame',frame);workspace.close();holdMetadata=false;extra=[];});
  await page.evaluate(()=>workspace.open(['alpha','beta'],'native',{channels:['native'],layout:'focus',playerMode:'full',chat:'native',chatVisible:false}));await ready();await settle();
  baseline=(await memory(0)).owned;
  const root=page.locator('#kr-multi-root');
  let cycle=0;
  while(cycle<cycles||Date.now()-started<minutes*60000){
    await page.evaluate(async cycle=>{
      window.cycleIndex=cycle;
      const previous=document.querySelector('main>.stream-info'),next=document.createElement('section');next.className='stream-info';next.textContent='Replacement channel information '+cycle;
      previous.replaceWith(next);remember('info',previous);workspace.refresh();
      extra=[`guest${cycle%70}`,`other${cycle%70}`];await workspace.drop(extra[0],'native');await workspace.drop(extra[1],'native');
    },cycle);
    await ready();await settle();
    await root.getByRole('button',{name:'Player settings native',exact:true,includeHidden:true}).dispatchEvent('click');await settle();
    assert.equal(await page.locator('#endurance-menu').count(),1);
    await page.evaluate(()=>{const menu=document.getElementById('endurance-menu');remember('menu',menu);menu.remove();workspace.refresh();const bar=document.querySelector('#injected-channel-player .z-controls');remember('bar',bar);bar.remove();workspace.refresh();});
    await settle();
    await page.evaluate(()=>{document.getElementById('injected-channel-player').append(nativeBar());workspace.refresh();});await settle();
    for(const index of [1,0]){
      await page.evaluate(index=>{const tile=document.getElementById('kr-multi-root').shadowRoot.querySelector(`.multi-tile[data-channel="${extra[index]}"]`);remember('frame',tile.querySelector('iframe'));},index);
      await root.getByRole('button',{name:`Remove ${index?`other${cycle%70}`:`guest${cycle%70}`}`,exact:true}).dispatchEvent('click');
    }
    if(cycle%10===9){
      await page.evaluate(()=>{const old=document.querySelector('#injected-channel-player video');remember('video',old);old.replaceWith(old.cloneNode(true));workspace.refresh();});
      await root.getByRole('button',{name:'Manage',exact:true}).click();
      const mode=root.getByRole('combobox',{name:'Player mode',exact:true});
      for(const target of ['embed','full']){
        await page.evaluate(()=>{for(const frame of document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe'))remember('frame',frame);});
        await mode.selectOption(target);await ready();
      }
      await root.getByRole('button',{name:'Manage',exact:true}).click();
    }
    await settle();cycle++;
    const current=await page.evaluate(()=>measure());assert.deepEqual(current,baseline,`cycle ${cycle}: active resource ownership stays bounded`);
    assert.equal(page.frames().length,3,'only the two current secondary frames remain');
    if(cycle%20===0||cycle===cycles){
      const sample=await memory(cycle);
      if(cdp){if(Object.keys(sample.retained).length)console.error(await page.evaluate(()=>retired.map(({kind,cycle})=>({kind,cycle}))));assert.deepEqual(sample.retained,{},`cycle ${cycle}: removed nodes are collectible after GC`);}
      console.log(`${engine}: ${cycle} active cycles; retired=${JSON.stringify(sample.retained)}; heap=${sample.heap?.usedSize??'not measured'}`);
      if(minutes&&cycle>=cycles)await page.waitForTimeout(1000);
    }
  }
  const measured=samples.filter(sample=>sample.heap&&sample.cycle>=Math.min(40,cycles/2));
  if(measured.length>1){
    const first=measured[0],last=measured.at(-1);assert.ok(last.heap.usedSize-first.heap.usedSize<Math.max(8*1024*1024,first.heap.usedSize*.35),'post-warmup main-target JS heap stays within the endurance budget');
    assert.ok(last.dom.documents-first.dom.documents<=4&&last.dom.nodes-first.dom.nodes<1000&&last.dom.jsEventListeners-first.dom.jsEventListeners<250,'post-GC documents, DOM nodes and listeners stay within the endurance budget');
  }
  await page.evaluate(()=>workspace.close());await settle();assert.equal(page.frames().length,1);
  await page.evaluate(()=>workspace.destroy());assert.deepEqual(await page.evaluate(()=>KickRefinedLifetime.snapshot()),{scopes:0,resources:0});
  assert.deepEqual(errors,[]);
  await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/workspace-endurance-${engine}-${cycle}-cycles.json`,JSON.stringify({engine,cycles:cycle,durationMs:Date.now()-started,initialRenders,layoutChecks,samples,note:'Local silent-media fixtures, active workspace churn. Chromium GC/heap and DOM counters cover the main CDP target, not whole-browser/video-decoder memory. Firefox checks ownership and frame counts without forced GC. Accelerated cycles are not elapsed hours or proof of live Kick stability.'},null,2));
  console.log(`${engine}: active workspace cleanup, replacement menus/controls, mode changes and frame teardown passed`);
}finally{releaseLoading?.();await context.close();await browser.close();}
