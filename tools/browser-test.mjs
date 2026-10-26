import playwright from './playwright.mjs';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = (await readFile(path.join(root, 'tests/fixture.html'), 'utf8')).replace('</body>', `<script>${await readFile(path.join(root, 'tests/design-fixture.js'), 'utf8')}</script></body>`);
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const report = [];
const mediaFixture=`data:audio/wav;base64,${(await readFile(path.join(root,'tests/silence.wav'))).toString('base64')}`;

// Keep browser runtimes in separate processes. On this Windows runner, starting
// Firefox immediately after Chromium in one process races Firefox target creation.
if (!process.env.KR_ENGINE) {
  for (const engine of ['chromium', 'firefox']) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      cwd: root, env: { ...process.env, KR_ENGINE: engine }, stdio: 'inherit', windowsHide: true
    });
    if (run.status !== 0) process.exit(run.status || 1);
    report.push(...JSON.parse(await readFile(path.join(root, `artifacts/${engine}-results.json`), 'utf8')));
  }
  await writeFile(path.join(root, 'artifacts/browser-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

for (const engine of (process.env.KR_ENGINE ? [process.env.KR_ENGINE] : ['chromium', 'firefox'])) {
  let context, browser;
  const errors = [];
  const extension = path.join(root, 'dist/chrome');
  if (engine === 'chromium') {
    context = await playwright.chromium.launchPersistentContext(path.join(root, 'tmp/test-profile'), {
      executablePath: process.env.KR_CHROMIUM || playwright.chromium.executablePath(),
      headless: true, viewport: { width: 1600, height: 1000 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
  } else {
    browser = await playwright.firefox.launch({ executablePath: process.env.KR_FIREFOX || playwright.firefox.executablePath(), headless: true });
    context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.addInitScript({path:path.join(root,'extension/scroll.js')});
    // Firefox engine check. The API shim is explicit: this does not claim a signed add-on install test.
    await context.addInitScript(() => {
      const listeners = [];
      let stored = {};
      window.browser = {
        runtime: { getURL: file => `https://kick.com/__extension/${file}` },
        storage: {
          local: {
            get: async () => structuredClone(stored),
            set: async patch => { const oldValue = stored.settings; stored = structuredClone({ ...stored, ...patch }); for (const cb of listeners) cb({ settings: { oldValue, newValue: stored.settings } }, 'local'); }
          }, onChanged: { addListener: cb => listeners.push(cb) }
        }
      };
    });
    await context.route('https://kick.com/__extension/ui.css', route => route.fulfill({ contentType: 'text/css', path: path.join(root, 'extension/ui.css') }));
  }
  let panelFetches=0;
  try {
    await context.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180"><rect width="640" height="180" fill="#263b45"/><text x="32" y="105" font-family="sans-serif" font-size="30" fill="#b8e8df">TEST CHANNEL PANEL</text></svg>'}));
    await context.route('https://kick.com/**', route => {
      if (route.request().url().includes('/__extension/')) return route.fallback();
      if(/^\/api\/v1\/channels\/[^/]+\/links$/.test(new URL(route.request().url()).pathname)){
        panelFetches++;return route.fulfill({json:[{title:'Studio',image:{url:'https://files.kick.com/test-panel.webp'},link:'https://example.com/studio',description:'# Welcome\n\n**Live music** and [studio updates](https://example.com).\n\n- Weekly sets\n- New tracks'},{title:'Info',description:'<p>Readable <strong>formatted text</strong></p><img src="javascript:alert(1)" onerror="window.badProfileMarkup=true"><script>window.badProfileMarkup=true</script><iframe src="https://evil.test"></iframe>'}]});
      }
      if(new URL(route.request().url()).pathname.startsWith('/api/v2/channels/')){
        const slug=new URL(route.request().url()).pathname.split('/').pop();
        if(slug==='third')return route.fulfill({status:403,body:'Unavailable'});
        return route.fulfill({json:{slug,user:{username:slug,bio:`**About ${slug}**\n\nLive sessions and new music.`,twitter:`${slug}_live`,instagram:'https://evil.test/untrusted'},livestream:{is_live:true,session_title:`${slug} live session`,viewer_count:1428,categories:[{name:slug==='aurora'?'Music':'Just Chatting'}]}}});
      }
      if (new URL(route.request().url()).pathname.startsWith('/popout/')) return route.fulfill({ contentType: 'text/html', body: '<html><body><div id="chatroom-messages">Native chat fixture</div></body></html>' });
      return route.fulfill({ contentType: 'text/html', body: fixture });
    });
    await context.route('https://player.kick.com/**', route => route.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0;background:#0b0b0e;color:#858592;display:grid;place-items:center;font:12px system-ui"><div>Kick player fixture · silent local audio</div><video src="${mediaFixture}" loop autoplay muted playsinline style="width:1px;height:1px;position:absolute;opacity:0"></video><script>
      window.controlMessages=0;
      window.addEventListener('message',e=>{if(e.data?.type==='kick-refined:control')window.controlMessages++;});
    </script></body></html>` }));
    const pageReady = context.waitForEvent('page');
    const page = await context.newPage().catch(error => {
      // Firefox 142 can return its target ID before Playwright registers the page.
      // The page was created; await its public event rather than creating another.
      if (engine === 'firefox' && error.message.includes("reading '_page'")) return pageReady;
      throw error;
    });
    await pageReady;
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://kick.com/aurora');
    if (engine === 'firefox') {
      await page.addStyleTag({ path: path.join(root, 'extension/theme.css') });
      await page.addStyleTag({ path: path.join(root, 'extension/polish.css') });
      for (const file of ['shared.js', 'ui.js', 'profile.js', 'multiview.js', 'content.js']) await page.addScriptTag({ path: path.join(root, 'extension', file) });
    }
    await page.locator('#kr-root').waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.krEnabled === 'true');
    if (engine === 'chromium') {
      const extensionURL = await page.locator('#kr-root').evaluate(el => el.shadowRoot.querySelector('link').href.replace('ui.css', 'popup.html'));
      const setup = await context.newPage(); await setup.goto(extensionURL);
      // This is the project-owned test profile, never the user's extension store.
      await setup.evaluate(() => chrome.storage.local.clear()); await setup.close();
      await page.reload(); await page.locator('#kr-root').waitFor();
      await page.waitForFunction(() => document.documentElement.dataset.krEnabled === 'true');
    }
    const button = page.locator('#kr-root').getByRole('button', { name: 'Immersion settings' });
    await page.waitForFunction(() => document.querySelector('[data-kr-search-field]'));
    // Extension controls must not compete with the native account area.
    assert.equal(await page.evaluate(() => document.querySelector('nav').contains(document.getElementById('kr-root'))), false);
    const profile = page.getByRole('button', { name: 'Your profile', exact: true });
    await profile.click();
    await page.getByRole('menuitem', { name: 'Profile settings' }).waitFor({ state: 'visible' });
    await profile.click();
    await page.getByRole('searchbox', { name: 'Search Kick' }).fill('music');
    assert.equal(await page.getByRole('searchbox', { name: 'Search Kick' }).inputValue(), 'music');
    const surface = await page.locator('#chat-input-wrapper').evaluate(el => ({ border: getComputedStyle(el).borderTopWidth, editorBorder: getComputedStyle(el.querySelector('[data-testid="chat-input"]')).borderTopWidth }));
    assert.deepEqual(surface, { border: '1px', editorBorder: '0px' });
    await page.getByRole('button', { name: 'Emotes', exact: true }).hover();
    assert.equal(await page.locator('#fixture-tooltip').evaluate(el => getComputedStyle(el).color), 'rgb(220, 220, 228)');
    await page.screenshot({ path: path.join(root, `artifacts/${engine}-tooltip-v2.png`) });
    await page.locator('#chatroom-messages button[data-prevent-expand]').click();
    await page.locator('#user-identity').waitFor({ state: 'visible' });
    await page.locator('#fixture-card-reply').click(); await page.locator('#fixture-card-mute').click();
    assert.deepEqual(await page.evaluate(() => window.nativeCardActions), ['reply', 'mute']);
    await page.screenshot({ path: path.join(root, `artifacts/${engine}-usercard-v2.png`) });
    await page.getByRole('button', { name: 'Close user card' }).click();
    await page.locator('#fixture-reply-trigger').hover();
    const quoteColor=await page.locator('#fixture-reply-tooltip .text-neutralInverse-fg-default').evaluate(el=>getComputedStyle(el).color);
    assert.equal(quoteColor,'rgb(232, 232, 240)','original replied-to messages remain readable on dark previews');
    await page.screenshot({path:path.join(root,`artifacts/${engine}-reply-preview-v4.png`)});
    await button.click();
    const settings = page.locator('#kr-root #settings-dialog');
    await settings.waitFor({ state: 'visible' });
    assert.equal(await settings.locator('#compat-status').textContent(), '● Native chat detected · Sidebar detected');
    await settings.locator('#compact').check();
    await settings.locator('#hideRecommended').check();
    await page.waitForFunction(() => document.documentElement.dataset.krHideRecommended === 'true');
    assert.equal(await page.locator('[data-kr-section="recommended"]').isVisible(), false);
    await settings.locator('#accent').selectOption('violet');
    await settings.locator('#chatWidth').fill('400');
    await settings.locator('#fontSize').fill('16');
    await page.waitForFunction(() => document.querySelector('#channel-chatroom').getBoundingClientRect().width === 400);
    await page.screenshot({ path: path.join(root, `artifacts/${engine}-settings.png`) });
    await settings.getByRole('button', { name: 'Close settings' }).click();

    assert.equal(await page.locator('#kr-sidebar-filter').count(),0,'the sidebar search and label are removed');

    await page.keyboard.press('Alt+k');
    const palette = page.locator('#kr-root #switch-dialog');
    await palette.waitFor({ state: 'visible' });
    const search = palette.getByRole('combobox');
    await page.evaluate(()=>{window.nativeHotkeys=[];});
    await search.pressSequentially('tmTM');
    assert.equal(await search.inputValue(),'tmTM');
    assert.deepEqual(await page.evaluate(()=>window.nativeHotkeys),[],'Kick capture-phase T/M shortcuts are isolated from the switcher');
    await search.fill('');
    assert.ok(await palette.locator('.option .avatar img').count() > 0);
    assert.ok(await palette.locator('.live-status[data-live="live"]').count() > 0);
    assert.ok(await palette.locator('.live-status[data-live="offline"]').count() > 0);
    const searchGeometry = await palette.locator('.search').evaluate(el => {
      const outer = el.getBoundingClientRect(), input = el.querySelector('input').getBoundingClientRect(), esc = el.querySelector('kbd').getBoundingClientRect();
      return { fits: input.right <= esc.left && esc.right < outer.right, outline: getComputedStyle(el.querySelector('input')).outlineStyle };
    });
    assert.equal(searchGeometry.fits, true, 'Escape hint has its own space beside the focus highlight');
    assert.equal(searchGeometry.outline, 'none');
    assert.equal(await page.locator('[data-testid="sidebar-following-channel-1"] img').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await page.locator('[data-testid="sidebar-following-channel-1"]').evaluate(el => getComputedStyle(el).boxShadow), 'none');
    await search.fill('night');
    assert.equal(await palette.getByRole('option').count(), 1);
    await palette.getByRole('button', { name: 'Pin selected' }).click();
    await palette.getByRole('button', { name: 'Unpin selected' }).waitFor();
    await search.press('Enter');
    assert.equal(new URL(page.url()).pathname, '/nightshift');
    assert.equal(await page.evaluate(() => window.nativeNavigations), 1, 'uses native link handler');
    await page.keyboard.press('Alt+k');
    await palette.waitFor({ state: 'visible' });
    assert.match(await palette.getByRole('option').first().textContent(), /nightshift/);
    await page.screenshot({ path: path.join(root, `artifacts/${engine}-switcher.png`) });
    await search.press('Escape');
    await page.locator('main').click({position:{x:20,y:20}});
    await page.keyboard.press('t'); await page.keyboard.press('m');
    assert.deepEqual(await page.evaluate(()=>window.nativeHotkeys),['KeyT','KeyM'],'native shortcuts still work outside Refined');

    // Native sidebar dragging starts inline multiview, without navigation/reload.
    assert.equal(await page.locator('#kr-multi-root').count(), 0);
    let originalTabTitle=await page.title();
    const source=page.locator('[data-testid="sidebar-following-channel-1"]');
    const dragSource=await source.boundingBox(),dragDestination=await page.locator('main').boundingBox();
    await page.mouse.move(dragSource.x+30,dragSource.y+20);await page.mouse.down();
    await page.mouse.move(dragSource.x+80,dragSource.y+20,{steps:5});await page.mouse.move(dragDestination.x+180,dragDestination.y+120,{steps:8});
    const dragPreview=page.locator('#kr-multi-drop');await dragPreview.waitFor();
    assert.equal(await dragPreview.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','the overlay stays transparent above the playing stream');
    assert.equal(await page.locator('#kr-multi-root').count(),0,'preview does not activate or load multiview');
    assert.equal(await dragPreview.locator('.preview-tile,.multi-header,.multi-grid').count(),0,'dragging does not clone a fake workspace');
    assert.equal(await dragPreview.locator('.stream-drop-zone[data-allowed="true"]').count(),1);
    assert.match(await dragPreview.locator('.stream-drop-cue').textContent(),/Drop to start multistream/);
    assert.equal(await dragPreview.locator('iframe,video').count(),0,'dragging never creates media players');
    assert.equal(await dragPreview.locator('.stream-drop-zone').evaluate(el=>getComputedStyle(el).backdropFilter),'none','dragging does not blur the playing stream');
    assert.equal(await page.locator('#kr-drag-chip').isVisible(),true);
    await page.screenshot({path:path.join(root,`artifacts/${engine}-drag-preview-v9.png`)});
    await page.mouse.up();
    const multi = page.locator('#kr-multi-root .multiview');
    await multi.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(()=>document.querySelector('main').contains(document.getElementById('kr-multi-root'))),true);
    assert.equal(await page.locator('dialog.multiview').count(),0);
    assert.equal(new URL(page.url()).pathname,'/nightshift');
    assert.equal(await page.evaluate(()=>window.nativeNavigations),1);
    assert.equal(await page.evaluate(()=>document.getElementById('video-player')===window.originalVideo && window.originalVideo.parentElement===window.originalPlayer),true);
    assert.equal(await page.locator('.stream-info').isVisible(),false,'single-channel info is hidden in multiview');
    assert.equal(await page.locator('main .below').isVisible(),false,'the original channel bio panels are hidden');
    assert.equal(await multi.locator('.multi-summary-channel').count(),0);
    await page.waitForFunction(()=>document.title.startsWith('Multistream:')&&document.title.includes('aurora')&&document.title.includes('nightshift'));
    await page.evaluate(()=>{document.title='Updated original channel title';});
    originalTabTitle='Updated original channel title';
    await page.waitForFunction(()=>document.title.startsWith('Multistream:'));
    await multi.locator('.multi-channel-card').filter({hasText:'aurora live session'}).waitFor();
    const detailsButton=multi.getByRole('button',{name:'Channel details for aurora',exact:true});
    await detailsButton.hover();assert.equal(await multi.locator('.multi-expanded-profile').count(),0,'hover never opens the channel profile');
    assert.equal(panelFetches,0,'panel images and descriptions are not fetched until expansion');
    await detailsButton.click();const expanded=multi.getByRole('region',{name:'About aurora',exact:true});await expanded.waitFor();
    await expanded.locator('.profile-panel').first().waitFor();assert.equal(panelFetches,1);
    assert.match(await expanded.textContent(),/1,428 viewers/);
    assert.equal(await expanded.locator('.profile-socials a').count(),2,'only the validated social and channel link render');
    assert.equal(await expanded.getByRole('link',{name:'X',exact:true}).getAttribute('href'),'https://x.com/aurora_live');
    assert.equal(await expanded.locator('.profile-bio strong').textContent(),'About aurora');
    assert.equal(await expanded.locator('.profile-panel li').count(),2,'panel markdown lists are formatted');
    assert.equal(await expanded.locator('script,iframe,[onerror]').count(),0,'publisher markup cannot introduce active content');
    assert.equal(await page.evaluate(()=>window.badProfileMarkup),undefined);
    // Larger workspace controls can place lazy panel images below the viewport.
    await expanded.locator('.profile-panel').first().scrollIntoViewIfNeeded();
    await expanded.locator('.profile-panel img').first().waitFor();
    await page.waitForTimeout(180);await expanded.screenshot({path:path.join(root,`artifacts/${engine}-expanded-profile-v10.png`)});
    await detailsButton.click();assert.equal(await multi.locator('.multi-expanded-profile').count(),0);
    assert.equal(await multi.locator('#multi-audio-source').count(),0);
    for(const slug of ['aurora','nightshift'])for(const action of ['Remove','Fullscreen','Move left','Move right'])assert.equal(await multi.getByRole('button',{name:`${action} ${slug}`,exact:true}).isVisible(),true);
    assert.doesNotMatch(await multi.textContent(),/Watching together|Drag channels here to add streams/);
    await page.waitForFunction(()=>{
      const native=window.originalPlayer.getBoundingClientRect(),target=document.getElementById('kr-multi-root').shadowRoot.querySelector('[data-channel="nightshift"] .multi-player').getBoundingClientRect();
      return Math.abs(native.left-target.left)<2&&Math.abs(native.top-target.top)<2&&Math.abs(native.width-target.width)<2&&Math.abs(native.height-target.height)<2;
    });
    await profile.click(); await page.getByRole('menuitem',{name:'Profile settings'}).waitFor({state:'visible'}); await profile.click();
    await source.dragTo(page.locator('main'), { targetPosition: { x:180,y:120 } });
    assert.equal(await multi.locator('.multi-tile').count(),2,'duplicate drops do not add players');
    const transfer=await page.evaluateHandle(()=>new DataTransfer());
    await source.dispatchEvent('dragstart',{dataTransfer:transfer});
    await page.locator('#kr-multi-drop').waitFor();
    assert.equal(await page.locator('#kr-multi-drop .stream-drop-zone').getAttribute('data-allowed'),'false','duplicate streams are rejected before dropping');
    assert.match(await page.locator('#kr-multi-drop .stream-drop-cue').textContent(),/Already in this workspace/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#kr-multi-drop').count(),0,'canceling a drag removes its drop target');
    assert.equal(await page.locator('#kr-drag-chip').count(),0,'canceling also removes the custom drag card');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.krDragging),undefined);
    await multi.getByRole('button',{name:'Manage',exact:true}).click();
    const multiInput=multi.getByRole('combobox',{name:'Add channel to multiview'});
    await multiInput.fill(''); await page.evaluate(()=>{window.nativeHotkeys=[];}); await multiInput.pressSequentially('tm');
    assert.equal(await multiInput.inputValue(),'tm');assert.deepEqual(await page.evaluate(()=>window.nativeHotkeys),[]);
    await multiInput.fill('');
    const addStream = async slug => { await multi.getByRole('combobox', { name: 'Add channel to multiview' }).fill(slug); await multi.getByRole('button', { name: 'Add stream', exact: true }).click(); };
    assert.equal(await multi.locator('.multi-player iframe').count(), 1,'the current stream reuses its native player');
    await page.waitForFunction(() => [...document.querySelector('#kr-multi-root').shadowRoot.querySelectorAll('.multi-player iframe')].every(f => !!f.contentWindow));
    for (const frame of page.frames().filter(f => f.url().startsWith('https://player.kick.com/'))) {
      await frame.waitForSelector('video', { state: 'attached' });
      if (engine === 'firefox') await frame.addScriptTag({ path: path.join(root, 'extension/player-frame.js') });
    }
    const auroraPlayer = page.frames().find(f => f.url().startsWith('https://player.kick.com/aurora'));
    assert.equal(page.frames().some(f=>f.url().startsWith('https://player.kick.com/nightshift')),false);
    await auroraPlayer.evaluate(() => { window.playerSentinel = 71; });
    await multi.getByRole('button', { name: 'Listen to aurora', exact: true }).click();
    await auroraPlayer.waitForFunction(() => document.querySelector('video').muted === false);
    await multi.getByRole('button', { name: 'Listen to nightshift', exact: true }).click();
    await auroraPlayer.waitForFunction(() => document.querySelector('video').muted === true);
    await page.waitForFunction(() => document.getElementById('video-player').muted === false);
    await multi.getByRole('slider',{name:'Volume for aurora',exact:true}).fill('37');
    await auroraPlayer.waitForFunction(()=>Math.abs(document.querySelector('video').volume-.37)<.01);
    await multi.getByRole('button',{name:'Pause aurora',exact:true}).click();
    await auroraPlayer.waitForFunction(()=>document.querySelector('video').paused);
    await multi.getByRole('button',{name:'Play aurora',exact:true}).click();
    await auroraPlayer.waitForFunction(()=>!document.querySelector('video').paused);
    assert.equal(await multi.locator('.multi-player iframe').count(),1,'pause/play retains the same player');
    // Delayed SDK media events must not take ownership or generate reply storms.
    await multi.getByRole('button',{name:'Listen to nightshift',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('video-player').muted===false);
    await auroraPlayer.evaluate(()=>{for(let i=0;i<150;i++)document.querySelector('video').dispatchEvent(new Event('volumechange'));});
    await page.waitForTimeout(180);
    assert.equal(await multi.getByRole('button',{name:'Listen to nightshift',exact:true}).getAttribute('aria-pressed'),'true');
    const quietCount=await auroraPlayer.evaluate(()=>window.controlMessages);
    await page.waitForTimeout(180);
    assert.equal(await auroraPlayer.evaluate(()=>window.controlMessages),quietCount,'passive reports do not cause commands');
    for(let i=0;i<12;i++)await multi.getByRole('button',{name:`Listen to ${i%2?'nightshift':'aurora'}`,exact:true}).click();
    await page.waitForTimeout(180);
    assert.equal(await multi.getByRole('button',{name:'Listen to nightshift',exact:true}).getAttribute('aria-pressed'),'true');
    assert.ok(await auroraPlayer.evaluate(()=>window.controlMessages)<70,'audio switching stays bounded');
    const streamAction=async(slug,action)=>{await multi.getByRole('button',{name:`${action} ${slug}`,exact:true}).click();};
    await multi.getByRole('button',{name:'Mix audio',exact:true}).click();
    await multi.getByRole('button',{name:'Listen to aurora',exact:true}).click();
    await auroraPlayer.waitForFunction(()=>!document.querySelector('video').muted);
    assert.equal(await page.evaluate(()=>document.getElementById('video-player').muted),false,'mixing keeps native audio enabled');
    await multi.locator('.multi-tile[data-channel="aurora"] .multi-audible').waitFor({state:'visible'});
    await multi.getByRole('button',{name:'Mute all',exact:true}).click();
    await auroraPlayer.waitForFunction(()=>document.querySelector('video').muted);
    await multi.getByRole('button',{name:'Mix audio',exact:true}).click();
    await streamAction('aurora','Focus');
    assert.equal(await multi.locator('#multi-chat-channel').inputValue(),'aurora','focusing a stream follows its chat');
    assert.equal(await multi.locator('.multi-channel-card').count(),1,'only the focused channel appears beneath the players');
    assert.equal(await multi.locator('.multi-channel-card').getAttribute('data-channel'),'aurora');
    await streamAction('aurora','Move left');
    assert.equal(await auroraPlayer.evaluate(() => window.playerSentinel), 71, 'layout and reordering do not reload players');
    const featured=multi.locator('.multi-tile[data-channel="aurora"]');
    const featuredBefore=await featured.evaluate(el=>el.getBoundingClientRect().width);
    const divider=multi.getByRole('separator',{name:'Resize featured stream'});
    const split=await divider.boundingBox();await page.mouse.move(split.x+split.width/2,split.y+40);await page.mouse.down();await page.mouse.move(split.x-95,split.y+40,{steps:8});await page.mouse.up();
    assert.ok(await featured.evaluate(el=>el.getBoundingClientRect().width)<featuredBefore-40,'dragging divider resizes the featured stream');
    await divider.focus();await page.keyboard.press('End');
    assert.equal(await divider.getAttribute('aria-valuenow'),'80','keyboard resize works through the shortcut isolation layer');
    await multi.getByRole('slider',{name:'Featured stream size'}).fill('72');await multi.getByRole('slider',{name:'Featured stream size'}).dispatchEvent('change');
    assert.equal(await divider.getAttribute('aria-valuenow'),'72');
    await featured.locator('.multi-tile-header').dblclick({position:{x:12,y:12}});
    assert.equal(await multi.locator('#multi-grid').getAttribute('data-layout'),'grid');
    await featured.locator('.multi-tile-header').dblclick({position:{x:12,y:12}});
    assert.equal(await multi.locator('#multi-grid').getAttribute('data-layout'),'focus');
    assert.equal(await multi.locator('#multi-chat-channel').inputValue(),'aurora');
    assert.equal(await multi.locator('.multi-channel-card').count(),1);
    assert.equal(await multi.getByRole('button',{name:'Quiet view',exact:true}).count(),0);
    assert.equal(await multi.locator('.multi-header button span').count(),0,'settings actions use icons with accessible names');
    assert.equal(await multi.getByRole('button',{name:'Mute all',exact:true}).getAttribute('title'),'Mute all');
    const expandedHeaderHeight=await multi.evaluate(el=>el.getBoundingClientRect().height);
    await multi.getByRole('button',{name:'Hide settings bar',exact:true}).click();
    assert.equal(await multi.locator('.multi-header').isVisible(),false);
    assert.equal(await multi.locator('.multi-options').isVisible(),false);
    assert.ok(await multi.evaluate(el=>el.getBoundingClientRect().height)<expandedHeaderHeight-40,'hiding settings saves vertical space');
    assert.equal(await multi.getByRole('button',{name:'Listen to aurora',exact:true}).isVisible(),true);
    await multi.getByRole('button',{name:'Show settings bar',exact:true}).click();
    assert.equal(await multi.locator('.multi-header').isVisible(),true);
    assert.equal(await multi.locator('.multi-options').isVisible(),true,'expanded management controls are restored');
    assert.equal(await multi.locator('.multi-tile-identity span').first().isVisible(),true);
    assert.equal(await auroraPlayer.evaluate(()=>window.playerSentinel),71,'hiding and showing settings retains the player');
    await multi.getByRole('button', { name: 'Show aurora chat', exact: true }).click();
    assert.match(await page.locator('#kr-multi-chat iframe').getAttribute('src'), /\/popout\/aurora\/chat$/);
    await multi.getByRole('button',{name:'Show nightshift chat',exact:true}).click();
    assert.equal(await page.locator('#kr-multi-chat iframe').count(),0);
    assert.equal(await page.evaluate(()=>document.getElementById('channel-chatroom')===window.originalChat),true,'switching back preserves the native chat connection');
    await multi.getByRole('combobox',{name:'Multiview layout'}).selectOption('grid');
    const edge=multi.getByRole('separator',{name:'Resize aurora',exact:true}),edgeRect=await edge.boundingBox();
    await page.mouse.move(edgeRect.x+6,edgeRect.y+6);await page.mouse.down();await page.mouse.move(edgeRect.x+150,edgeRect.y+6,{steps:8});await page.mouse.up();
    assert.ok(Number(await featured.getAttribute('data-span'))>3,'dragging a tile edge changes its snapped grid width');
    assert.equal(await auroraPlayer.evaluate(()=>window.playerSentinel),71,'resizing keeps the same player');
    await multi.getByRole('combobox',{name:'Multiview layout'}).selectOption('focus');
    await multi.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Evening duo');
    await multi.getByRole('button', { name: 'Save', exact: true }).click();
    await addStream('pixelgarden');
    await page.waitForFunction(()=>document.title.includes('pixelgarden'));
    const geometry=await featured.evaluate(card=>{
      const header=card.querySelector('.multi-tile-header').getBoundingClientRect(),player=card.querySelector('.multi-player').getBoundingClientRect(),controls=card.querySelector('.multi-tile-controls').getBoundingClientRect();
      return {excess:card.getBoundingClientRect().height-header.height-player.height-controls.height,ratio:player.width/player.height};
    });
    assert.ok(geometry.excess<5,'a featured tile never stretches to the combined height of its neighbours');
    assert.ok(Math.abs(geometry.ratio-16/9)<.03,'video keeps its natural aspect ratio');
    await page.screenshot({path:path.join(root,`artifacts/${engine}-focus-three-v10.png`)});
    await streamAction('nightshift','Focus');
    assert.equal(await multi.locator('.multi-tile[data-channel="nightshift"]').getAttribute('data-featured'),'true','native-player options can actually receive clicks');
    await streamAction('aurora','Focus');
    for(const width of [1280,1024,820]){
      await page.setViewportSize({width,height:900});
      const overflow=await multi.locator('.multi-tile-controls').evaluateAll(bars=>bars.some(bar=>[...bar.children].some(child=>child.getBoundingClientRect().right>bar.getBoundingClientRect().right+1)));
      assert.equal(overflow,false,`three-stream player controls fit at ${width}px`);
    }
    await page.setViewportSize({width:1600,height:1000});
    for (const slug of ['third','fourth','fifth']) await addStream(slug);
    await addStream('seventh');
    assert.equal(await multi.locator('.multi-tile').count(), 6);
    assert.equal(await multi.locator('.multi-player iframe').count(), 5);
    assert.match(await multi.locator('#multi-notice').textContent(), /Six streams/);
    await multi.getByRole('combobox', { name: 'Saved multiview sessions' }).selectOption('0');
    await page.waitForFunction(()=>document.title.startsWith('Multistream:')&&!document.title.includes('pixelgarden'));
    assert.equal(await multi.locator('.multi-player iframe').count(), 1);
    assert.equal(await divider.getAttribute('aria-valuenow'),'72','session retains the custom split');
    for(const width of [1280,1024,820,390]) {
      await page.setViewportSize({width,height:900});
      await page.waitForFunction(()=>{
        const root=document.getElementById('kr-multi-root'),target=root.shadowRoot.querySelector('[data-native="true"]').getBoundingClientRect(),actual=window.originalPlayer.getBoundingClientRect();
        return Math.abs(target.width-actual.width)<2&&Math.abs(target.left-actual.left)<2&&Math.abs(target.top-actual.top)<2;
      });
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`inline overflow at ${width}`);
    }
    await page.setViewportSize({width:1600,height:1000});
    await multi.getByRole('button',{name:'Manage',exact:true}).click();
    await page.screenshot({ path: path.join(root, `artifacts/${engine}-immersion-multiview-v10.png`) });
    await multi.getByRole('button', { name: 'Close multiview', exact: true }).click();
    await page.waitForFunction(() => !document.getElementById('kr-multi-root'));
    assert.equal(await page.title(),originalTabTitle,'the original tab title returns after closing multistream');
    assert.equal(await page.evaluate(()=>document.getElementById('video-player')===window.originalVideo && getComputedStyle(window.originalPlayer).position==='relative'),true);
    assert.equal(await page.locator('.stream-info').isVisible(),true,'single-channel info returns on exit');
    assert.equal(await page.locator('main .below').isVisible(),true);
    // Recommendations use the same drag behavior, and removing the last added
    // stream returns directly to the original single-stream page.
    await button.click(); await settings.locator('#hideRecommended').uncheck();
    await settings.getByRole('button',{name:'Close settings'}).click();
    await page.locator('[data-testid="sidebar-recommended-channel-1"]').dragTo(page.locator('main'),{targetPosition:{x:160,y:100}});
    await multi.waitFor({state:'visible'});
    assert.equal(await multi.locator('.multi-tile').count(),2);
    await streamAction('pixelgarden','Remove');
    await page.waitForFunction(()=>!document.getElementById('kr-multi-root'));

    const chat = page.locator('[data-testid="chat-input"]');
    await chat.click();
    await page.keyboard.press('Control+k');
    assert.equal(await palette.isVisible(), false, 'does not hijack Ctrl+K while composing chat');
    await page.keyboard.press('Alt+k');
    await palette.waitFor({ state: 'visible' });
    await palette.getByRole('combobox').press('Escape');
    // Burst of messages must not create an extension-owned duplicate message list.
    await page.evaluate(() => {
      const list = document.getElementById('chatroom-messages');
      for (let i = 80; i < 500; i++) { const row = document.createElement('div'); row.dataset.index = i; row.textContent = 'fixture burst message'; list.append(row); }
    });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#chatroom-messages [data-index]').count(), 500);
    assert.equal(await page.locator('#kr-root').count(), 1);
    // Recover when a late document hydration removes an extension attribute/control.
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-kr-enabled');
      document.getElementById('kr-root').remove();
    });
    await page.waitForFunction(() => document.documentElement.dataset.krEnabled === 'true' && document.getElementById('kr-root'));
    await button.click();
    await settings.locator('#enabled').uncheck();
    await page.waitForFunction(() => document.documentElement.dataset.krEnabled === 'false');
    assert.equal(await page.locator('#kr-sidebar-filter').count(),0);
    // Disable is reversible with no reload and does not remove native nodes.
    assert.equal(await page.locator('#chatroom-messages [data-index]').count(), 500);
    await settings.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.krEnabled === 'true' && document.documentElement.dataset.krAccent === 'mint');
    await settings.getByRole('button', { name: 'Close settings' }).click();

    if (engine === 'chromium') {
      // A real extension storage round trip across page reload, then popup -> tab propagation.
      await button.click(); await settings.locator('#compact').check();
      await page.waitForTimeout(250); await page.reload(); await page.locator('#kr-root').waitFor();
      await page.waitForFunction(() => document.documentElement.dataset.krCompact === 'true');
      const extensionURL = await page.locator('#kr-root').evaluate(el => el.shadowRoot.querySelector('link').href.replace('ui.css', 'popup.html'));
      const popup = await context.newPage(); await popup.goto(extensionURL);
      await popup.locator('#accent').selectOption('blue');
      await page.waitForFunction(() => document.documentElement.dataset.krAccent === 'blue');
      await popup.screenshot({ path: path.join(root, 'artifacts/popup.png') });
      await popup.getByRole('button', { name: 'Reset', exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.krAccent === 'mint');
      await popup.close();
    }
    // Restore a short transcript for screenshots.
    await page.evaluate(() => { const list = document.getElementById('chatroom-messages'); [...list.children].slice(80).forEach(n => n.remove()); list.scrollTop = list.scrollHeight; });
    await page.screenshot({ path: path.join(root, `artifacts/${engine}-workspace.png`) });
    for (const width of [1280, 1024, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(220);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${engine} horizontal overflow at ${width}`);
      await profile.click();
      await page.getByRole('menuitem', { name: 'Profile settings' }).waitFor({ state: 'visible' });
      await profile.click();
      await page.keyboard.press('Alt+k');
      await palette.waitFor({ state: 'visible' });
      assert.equal(await palette.evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
      if (width === 390) await page.screenshot({ path: path.join(root, `artifacts/${engine}-mobile.png`) });
      await palette.getByRole('combobox').press('Escape');
    }
    assert.deepEqual(errors, []);
    report.push({ engine, passed: true, version:'0.10.0', mode: engine === 'chromium' ? 'installed unpacked extension' : 'Firefox engine with extension API shim', checks:['sidebar drag/drop','minimal drop cue without media loads','custom drag chip and cancellation cleanup','native player/chat preservation','responsive layout','reply contrast and keyboard isolation','audio feedback regressions','playback and volume controls','pointer and keyboard resizing','double-click focus','collapsible settings bar','chat tabs','saved custom split','natural video height with three streams','direct close/fullscreen/reorder actions','multiple audio sources','click-expanded formatted profiles and safe image panels','focus follows chat','focused-only channel summary','tile edge resizing','tab title restoration','no redundant multistream banner'] });
    console.log(`PASS ${engine}: settings, switcher photos/status, focus geometry, sidebar, native actions, multiview audio/layout/session/limit/cleanup, responsive`);
  } finally { await context.close(); if (browser) await browser.close(); }
}
await writeFile(path.join(root, `artifacts/${process.env.KR_ENGINE}-results.json`), `${JSON.stringify(report, null, 2)}\n`);
