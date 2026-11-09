/* Deterministic lifecycle soak. Real browser media + controller, explicit API shim. */
import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';

const engine=process.env.KR_ENGINE||'chromium',cycles=Number(process.env.KR_SOAK_CYCLES)||24;
const browser=await playwright[engine].launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000}});
const {fixture,frame}=await workspaceFixtures();
const manifest=JSON.parse(await readFile('dist/chrome/manifest.json','utf8'));
const scripts=manifest.content_scripts.find(item=>item.js?.includes('content.js')).js;
const frameScripts=(await Promise.all(['stream-clock.js','full-player-frame.js','player-controls.js','player-frame.js'].map(file=>readFile(`extension/${file}`,'utf8')))).join('\n');
const samples=[];
try{
  await context.addInitScript(()=>{
    const values={};window.browser={runtime:{getURL:file=>`https://kick.com/__extension/${file}`},storage:{local:{get:async()=>values,set:async patch=>Object.assign(values,patch)}}};
    // Count observing instances, not DOM nodes held by the test itself.
    window.observed={mutation:new Set(),resize:new Set()};
    for(const [name,key]of [['MutationObserver','mutation'],['ResizeObserver','resize']]){
      const Original=window[name];window[name]=class extends Original{observe(...args){observed[key].add(this);return super.observe(...args);}disconnect(){observed[key].delete(this);return super.disconnect();}unobserve(...args){return super.unobserve?.(...args);}};
    }
  });
  await context.route('https://kick.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/__extension/'))return route.fulfill({path:`extension/${url.pathname.split('/').pop()}`});
    const framed=route.request().frame().parentFrame();
    return route.fulfill({contentType:'text/html',body:framed?frame.replace('</body>',`<script>${frameScripts}</script></body>`):fixture});
  });
  await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:frame.replace('</body>',`<script>${frameScripts}</script></body>`)}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
await page.goto('https://kick.com/native');await page.addStyleTag({path:'extension/theme.css'});
  for(const file of scripts.slice(0,scripts.indexOf('multiview.js')+1))await page.addScriptTag({path:`extension/${file}`});
  await page.evaluate(()=>{
    const channels=['native','alpha','beta','gamma'].map(slug=>({slug,title:slug,live:'live',image:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>'}));
    window.workspace=KickRefinedMulti.create({getChannels:()=>channels,onKeydown:()=>{},support:{channel:async slug=>channels.find(item=>item.slug===slug),panels:async()=>[]},channelPanel:{version:0,card:slug=>{const element=document.createElement('div');element.className='channel-panel';element.textContent=slug;return element;}}});
    window.KickRefinedClips={parseClip:()=>({}),parseVOD:()=>null};window.KickRefinedSearch={duration:String};
    window.clipReleased=0;window.staleCallbacks=[];
    window.measure=()=>({lifetime:KickRefinedLifetime.snapshot(),workspace:workspace.snapshot(),mutation:observed.mutation.size,resize:observed.resize.size,frames:document.querySelectorAll('iframe').length});
  });
const baseline=await page.evaluate(()=>measure());
  const root=page.locator('#kr-multi-root');
  for(let cycle=0;cycle<cycles;cycle++){
    await page.evaluate(async()=>{history.replaceState({},'','/native');await workspace.open(['alpha','beta'],'native',{channels:['native','alpha','beta'],playerMode:'full'});});
    await page.waitForFunction(()=>[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('[data-channel].multi-tile:not([data-native-player])')].every(tile=>tile.dataset.playerState==='ready'));

    await root.getByRole('button',{name:'Manage',exact:true}).click();
    for(const layout of ['columns','focus','grid'])await root.getByRole('combobox',{name:'Multiview layout',exact:true}).selectOption(layout);
    await root.getByRole('combobox',{name:'Player mode',exact:true}).selectOption('embed');
    await page.waitForFunction(()=>[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe')].every(frame=>frame.closest('.multi-tile').dataset.playerState==='ready'));
    await root.getByRole('button',{name:'Use full player for alpha',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('kr-multi-root').shadowRoot.querySelector('[data-channel=alpha].multi-tile').dataset.playerState==='ready');
    await root.locator('.multi-tile[data-channel=beta] .multi-audio-toggle').dispatchEvent('click');
    // Focus selects one audio source; prior players must be muted.
    await root.locator('.multi-tile[data-channel=alpha] .multi-tile-header').dispatchEvent('dblclick');
    await page.waitForFunction(()=>{const tiles=[...document.getElementById('kr-multi-root').shadowRoot.querySelectorAll('.multi-tile[data-audio=true]')];return tiles.length===1&&tiles[0].dataset.channel==='alpha';});
    const picker=page.locator('#kr-multi-chat-picker');await picker.getByRole('button',{name:'Chat channel',exact:true}).click();
    const menu=await picker.locator('[role=listbox]').evaluate(node=>({width:node.getBoundingClientRect().width,trigger:node.previousElementSibling.getBoundingClientRect().width,avatars:node.querySelectorAll('.option img:not([hidden])').length,rows:[...node.children].map(row=>row.getBoundingClientRect().width),inner:node.clientWidth}));
    if(cycle===0&&engine==='chromium'){await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/workspace-chat-menu-chromium.png'});}
    assert.ok(Math.abs(menu.width-menu.trigger)<1);assert.equal(menu.avatars,3);assert.ok(menu.rows.every(width=>Math.abs(width-(menu.inner-8))<1));
    await picker.locator('[role=option][data-channel=beta]').click();
    assert.equal(await page.locator('#kr-multi-chat iframe').getAttribute('name'),'kick-refined-chat');
    await picker.getByRole('button',{name:'Chat channel',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await picker.getByRole('listbox').isVisible(),false);
    await page.evaluate(async()=>{
      const callbacks=[];
      const item={id:'soak',href:'https://kick.com/native?clip=soak',title:'Soak clip',mount(node,handlers){callbacks.push(handlers);node.append(document.createElement('video'));handlers.info({title:'Soak clip'});},release(){clipReleased++;for(const handlers of callbacks){handlers.remove();handlers.audio(true);}},snapshot:()=>({paused:false,volume:1}),setMuted(){},resume(){},popout(){}};
      await workspace.addClip(item,'featured');staleCallbacks.push(...callbacks);
      const old=document.querySelector('main video');old.replaceWith(old.cloneNode(true));workspace.refresh();old.dispatchEvent(new Event('volumechange'));
    });
    await root.getByRole('button',{name:'Remove clip soak',exact:true}).click();
    if(cycle%2)await page.evaluate(()=>{history.pushState({},'','/other');workspace.refresh();});else await page.evaluate(()=>workspace.close());
    await page.waitForFunction(()=>!document.querySelector('#kr-multi-root'));
    await page.evaluate(()=>{for(const handlers of staleCallbacks.splice(0)){handlers.info({title:'stale'});handlers.audio(true);handlers.focus();}document.querySelector('main video').dispatchEvent(new Event('volumechange'));});
    const sample=await page.evaluate(()=>measure());samples.push(sample);
    assert.deepEqual(sample,baseline,`cycle ${cycle+1}: resources return to the closed workspace baseline`);
    assert.equal(page.frames().length,1);assert.equal(await page.locator('[data-kr-unified-row],[data-kr-native-player],#kr-multi-chat-picker,#kr-multi-chat').count(),0);
    assert.equal(await page.locator('#channel-chatroom header').isVisible(),true);
    if((cycle+1)%8===0)console.log(`${engine}: ${cycle+1}/${cycles} workspace lifecycle cycles passed`);
  }
  assert.equal(await page.evaluate(()=>clipReleased),cycles,'each media lease is released exactly once, including reentrant callbacks');
  await page.evaluate(()=>workspace.destroy());assert.deepEqual(await page.evaluate(()=>KickRefinedLifetime.snapshot()),{scopes:0,resources:0});
  assert.deepEqual(errors,[]);
  await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/workspace-soak-${engine}.json`,JSON.stringify({engine,cycles,baseline,samples,note:'Local fixtures with API shim and silent WAV media. Counts cover owned resources and observing instances, not whole-browser heap or real stream decoding.'},null,2));
  console.log(`${engine}: lifecycle, mode/layout/chat switching, native replacement, navigation, exclusive audio and reentrant clip cleanup passed`);
}finally{await context.close();await browser.close();}
