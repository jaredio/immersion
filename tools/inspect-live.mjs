import playwright from './playwright.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const executablePath = process.env.KR_CHROMIUM || playwright.chromium.executablePath();
const extension = path.join(root, 'dist/chrome');
const context = await playwright.chromium.launchPersistentContext(path.join(root, 'tmp/live-profile'), {
  headless: true, executablePath, viewport: { width: 1600, height: 1000 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
try {
  const page = await context.newPage();
  // Inspect UI surfaces without repeatedly decoding live video during screenshots.
  await page.route('**/*', route => {
    const request = route.request();
    if (request.resourceType() === 'media' || /\.m3u8(?:\?|$)/.test(request.url())) return route.abort();
    return route.continue();
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://kick.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#kr-root').waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(root, 'artifacts/live-home.png'), fullPage: false });
  const home = await page.evaluate(() => ({ title: document.title, extension: document.documentElement.dataset.krEnabled, sidebar: !!document.querySelector('#sidebar-wrapper'), links: document.querySelectorAll('#sidebar-wrapper a[data-testid*="-channel-"]').length }));
  console.log(JSON.stringify({ home, errors: errors.slice(0, 10) }, null, 2));
  await writeFile(path.join(root, 'artifacts/live-home.html'), await page.content());
  await page.locator('#kr-root').getByRole('button', { name: 'Switch channel', exact: true }).click();
  await page.screenshot({ path: path.join(root, 'artifacts/live-switcher-v3.png') });
  await page.locator('#kr-root #channel-search').press('Escape');
  const liveHref = await page.locator('#sidebar-wrapper a[data-testid*="-channel-"]').evaluateAll(links => links.find(link => !link.textContent.trim().endsWith('LIVE'))?.getAttribute('href'));
  const channel = liveHref ? page.locator('#sidebar-wrapper a').filter({ hasNotText: /^$/ }).and(page.locator(`a[href="${liveHref}"]`)).first() : page.locator('#sidebar-wrapper a[data-testid*="-channel-"]').first();
  if (await channel.count()) {
    await channel.click();
    await page.locator('#channel-chatroom').waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(root, 'artifacts/live-channel.png') });
    await writeFile(path.join(root, 'artifacts/live-channel.html'), await page.content());
    console.log(JSON.stringify(await page.evaluate(() => ({ path: location.pathname, chat: !!document.querySelector('#chatroom-messages'), sidebar: !!document.querySelector('#sidebar-wrapper'), chatWidth: document.querySelector('#channel-chatroom')?.getBoundingClientRect().width })), null, 2));
    const native = await page.evaluate(() => {
      window.inlineOriginalVideo=[...document.querySelectorAll('main #video-player')].find(v=>v.getBoundingClientRect().width>0);
      window.inlineOriginalParent=window.inlineOriginalVideo?.parentElement;
      window.inlineOriginalChat=document.querySelector('#channel-chatroom');
      return !!window.inlineOriginalVideo;
    });
    const current=new URL(page.url()).pathname;
    const shortcutBefore=await page.evaluate(()=>({theatre:document.querySelector('[data-theatre]')?.getAttribute('data-theatre'),muted:window.inlineOriginalVideo?.muted}));
    await page.keyboard.press('Alt+k');
    const search=page.locator('#kr-root #channel-search');await search.waitFor({state:'visible'});await search.pressSequentially('tm');
    const shortcutAfter=await page.evaluate(()=>({theatre:document.querySelector('[data-theatre]')?.getAttribute('data-theatre'),muted:window.inlineOriginalVideo?.muted}));
    console.log('Refined keyboard isolation',JSON.stringify({query:await search.inputValue(),before:shortcutBefore,after:shortcutAfter}));
    await search.press('Escape');
    const source=page.locator('#sidebar-wrapper a[data-testid*="-channel-"]').filter({hasNot:page.locator('a[href="'+current+'"]')});
    const candidate=await page.locator('#sidebar-wrapper a[data-testid*="-channel-"]').evaluateAll((links,current)=>links.find(l=>l.pathname!==current)?.getAttribute('href'),current);
    if(candidate && native) {
      const dragSource=await page.locator('#sidebar-wrapper a[href="'+candidate+'"]').boundingBox(),dragDest=await page.locator('main:has(#video-player):visible').first().boundingBox();
      await page.mouse.move(dragSource.x+20,dragSource.y+20);await page.mouse.down();await page.mouse.move(dragSource.x+60,dragSource.y+20,{steps:5});await page.mouse.move(dragDest.x+180,dragDest.y+120,{steps:8});
      await page.locator('#kr-multi-drop').waitFor();await page.waitForTimeout(180);await page.screenshot({path:path.join(root,'artifacts/live-drag-preview-v9.png')});await page.mouse.up();
      await page.locator('#kr-multi-root .inline-multi').waitFor({state:'visible'});
      await page.waitForTimeout(2000);
      const workspace=page.locator('#kr-multi-root');
      await workspace.getByRole('button',{name:'Manage',exact:true}).click();
      if(!await workspace.locator('.multi-tile[data-channel="adinross"]').count()){
        await workspace.getByRole('combobox',{name:'Add channel to multiview'}).fill('adinross');await workspace.getByRole('button',{name:'Add stream',exact:true}).click();
      }
      await workspace.getByRole('button',{name:'Manage',exact:true}).click();
      await workspace.getByRole('combobox',{name:'Multiview layout'}).selectOption('grid');
      await workspace.getByRole('button',{name:'Focus adinross',exact:true}).click();
      await workspace.getByRole('button',{name:'Channel details for adinross',exact:true}).click();
      const profile=workspace.locator('.multi-expanded-profile');await profile.locator('.profile-panel img').first().waitFor({timeout:20000});
      await profile.locator('.profile-identity').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'artifacts/live-expanded-profile-v10.png')});
      console.log('PROFILE',JSON.stringify({focusedCards:await workspace.locator('.multi-channel-card').count(),chat:await workspace.locator('#multi-chat-channel').inputValue(),panels:await profile.locator('.profile-panel').count(),images:await profile.locator('.profile-panel img').count()}));
      await workspace.getByRole('button',{name:'Channel details for adinross',exact:true}).click();
      const separator=workspace.getByRole('separator',{name:'Resize featured stream'}),rect=await separator.boundingBox();
      await page.mouse.move(rect.x+rect.width/2,rect.y+30);await page.mouse.down();await page.mouse.move(rect.x-70,rect.y+30,{steps:8});await page.mouse.up();
      await workspace.getByRole('button',{name:'Quiet view',exact:true}).click();
      const quietHidden=!(await workspace.locator('.multi-tile-identity span').first().isVisible());
      await workspace.getByRole('button',{name:'Quiet view',exact:true}).click();
      await page.waitForTimeout(300);
      const metrics=await page.evaluate(()=>{
        const root=document.getElementById('kr-multi-root'),v=window.inlineOriginalVideo;
        const target=root.shadowRoot.querySelector('.multi-player[data-native]')?.getBoundingClientRect();
        const player=v?.closest('main')?.querySelector('[data-kr-native-player]')?.getBoundingClientRect();
        return {inMain:!!root.closest('main'),tiles:root.shadowRoot.querySelectorAll('.multi-tile').length,extraFrames:root.shadowRoot.querySelectorAll('.multi-player iframe').length,nativeVideoPreserved:v?.isConnected&&v.parentElement===window.inlineOriginalParent,chatPreserved:document.querySelector('#channel-chatroom')===window.inlineOriginalChat,positionError:target&&player?Math.max(Math.abs(target.left-player.left),Math.abs(target.top-player.top),Math.abs(target.width-player.width),Math.abs(target.height-player.height)):null};
      });
      const controls=await page.evaluate(()=>{
        const root=document.getElementById('kr-multi-root').shadowRoot;
        return {channelCards:root.querySelectorAll('.multi-channel-card').length,tabTitle:document.title,volumeSliders:root.querySelectorAll('input[type="range"]').length,
          playbackButtons:[...root.querySelectorAll('button')].filter(b=>/^(Play|Pause) /.test(b.getAttribute('aria-label')||'')).length,
          originalInfoHidden:[...document.querySelectorAll('main > [data-kr-single-info="true"]')].every(el=>getComputedStyle(el).display==='none')};
      });
      const layout={featuredSize:Number(await separator.getAttribute('aria-valuenow')),quietHidden,chatTabs:await workspace.locator('#multi-chat-tabs button').count()};
      console.log('INLINE MULTIVIEW',JSON.stringify({...metrics,...controls,...layout}));
      await writeFile(path.join(root,'artifacts/live-inline-validation-v10.json'),JSON.stringify({...metrics,...controls,...layout},null,2));
      await page.screenshot({path:path.join(root,'artifacts/live-immersion-multiview-v10.png')});
      for(const width of [1280,1024,390]) {
        await page.setViewportSize({width,height:900});await page.waitForTimeout(600);
        console.log('Inline viewport',await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,active:!!document.getElementById('kr-multi-root')})));
      }
      await page.setViewportSize({width:1600,height:1000});
      if(await page.locator('#kr-multi-root').count())await page.locator('#kr-multi-root').getByRole('button',{name:'Close multiview',exact:true}).click();
    }
  }
  await page.locator('#kr-root').getByRole('button', { name: 'Immersion settings' }).click();
  await page.locator('#kr-root #settings-dialog').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(root, 'artifacts/live-settings.png') });
  await page.locator('#kr-root').getByRole('button', { name: 'Close settings' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(root, 'artifacts/live-mobile.png') });
  console.log('Mobile', await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, toolbar: !!document.querySelector('#kr-root') })));
} finally { await context.close(); }
// Baseline comparison: site-owned exceptions must not be attributed to the add-on.
const baseline = await playwright.chromium.launch({ headless: true, executablePath });
try {
  const page = await baseline.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://kick.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  console.log(JSON.stringify({ baselineErrors: errors.slice(0, 10) }, null, 2));
} finally { await baseline.close(); }
