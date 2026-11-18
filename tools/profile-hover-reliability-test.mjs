import {chromium,firefox} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const engine=process.env.KR_ENGINE==='firefox'?firefox:chromium,browser=await engine.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1180,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const header=await readFile('tests/channel-header-current.html','utf8');
  await page.route('https://kick.com/**',route=>route.request().url().endsWith('/ui.css')?route.fulfill({path:'extension/ui.css'}):route.fulfill({contentType:'text/html',body:`<!doctype html><html data-kr-enabled="true"><head><meta charset="utf-8"><style>body{margin:20px;background:#09090b;color:#eee;font:14px system-ui}</style></head><body><main><div id="channel-content">${header}</div></main><div id="workspace"></div></body></html>`}));
  await page.route('https://files.kick.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>'}));
  await page.goto('https://kick.com/soultravels');
  await page.evaluate(()=>{
    const viewers=document.createElement('div');viewers.dataset.testid='viewer-count';viewers.textContent='200 watching';document.querySelector('#channel-content > div').append(viewers);
    window.profileRequests=[];window.profileCancels=[];window.pendingProfiles=new Map();
    window.chrome={runtime:{getURL:file=>`https://kick.com/${file}`,sendMessage:async message=>{
      if(message.type==='immersion:social-profile'){
        profileRequests.push(message);return new Promise(resolve=>pendingProfiles.set(message.requestId,{message,resolve}));
      }
      if(message.type==='immersion:preview-cancel'){
        profileCancels.push(message.requestId);pendingProfiles.get(message.requestId)?.resolve({ok:false,cancelled:true});pendingProfiles.delete(message.requestId);
      }
      return {};
    }}};
    window.finishProfiles=()=>{for(const {message,resolve}of pendingProfiles.values()){
      const item=KickRefinedSocialData.parse(message.href);resolve({ok:true,item:{...item,author:`Profile ${item.handle}`,description:'Real public profile details',stats:{followers:25},posts:[]}});
    }pendingProfiles.clear();};
    window.KickRefinedChannelPage={routeSlug:()=> 'soultravels',watchSlug:()=>null,clipSlug:()=>null,profileTab:()=> 'about',findHeaders:()=>[],create:()=>({host:document.createElement('div'),refresh(){},selectTab(){},destroy(){}})};
  });
  for(const name of ['shared','dom','media-data','social-profile-data','profile','channel-panel','lifetime','multi-view','multi-directory'])await page.addScriptTag({path:`extension/${name}.js`});
  // Exercise actual native header refreshes while the public profile request is still pending.
  for(const integrated of [false,true]){
    const handle=integrated?'singlemanaged':'singlelegacy';
    await page.evaluate(({integrated,handle})=>{
      window.meta={title:'SoulTravels',live:'live',followers:'100',bio:`Bio [X](https://twitter.com/${handle}?lang=en)`,socials:[{label:'X',href:`https://x.com/${handle}`}]};
      window.support={channel:async()=>meta,panels:async()=>[],makeButton:()=>document.createElement('button')};
      window.testPanel=KickRefinedChannelPanel.create({support,integratedProfile:integrated,onChange:()=>testPanel.refresh()});testPanel.refresh();
    },{integrated,handle});
    const single=page.locator('#kr-channel-root');await single.waitFor({state:'visible'});
    if(await single.locator('.channel-expand').getAttribute('aria-expanded')!=='true')await single.locator('.channel-expand').click();
    const source=single.locator('.profile-socials [data-social-platform="X"]'),popup=page.locator('#kr-social-preview');
    await source.waitFor();await source.evaluate(node=>window.originalAnchor=node);await source.hover();
    await popup.locator('.card[aria-busy="true"]').waitFor();
    const before=await page.evaluate(()=>({requests:profileRequests.length,cancels:profileCancels.length}));
    await page.evaluate(()=>{
      for(let count=1;count<=5;count++){
        document.querySelector('[data-testid="viewer-count"]').textContent=`${200+count} watching`;
        document.querySelector('[data-testid="livestream-title"]').textContent=`Live title ${count}`;testPanel.refresh();
      }
      meta.followers='101';document.querySelector('[data-testid="viewer-count"]').textContent='206 watching';testPanel.refresh();
    });
    assert.equal(await source.evaluate(node=>node===originalAnchor),true,'viewer, title and follower updates retain the original hover target');
    assert.equal(await popup.isVisible(),true,'live updates keep the loading tooltip open');
    assert.equal(await single.locator('.profile-followers strong').textContent(),'101','other profile details continue updating');
    assert.deepEqual(await page.evaluate(()=>({requests:profileRequests.length,cancels:profileCancels.length})),before,'refresh never cancels or restarts the pending request');
    await page.evaluate(()=>finishProfiles());await popup.getByText(`Profile ${handle}`,{exact:true}).waitFor();
    await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
    await single.locator('.profile-bio [data-social-platform="X"]').hover();await popup.getByText(`Profile ${handle}`,{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>profileRequests.length),before.requests,'Twitter aliases and tracking queries share the successful hover cache');
    await page.evaluate(()=>testPanel.destroy());await popup.waitFor({state:'detached'});
  }
  // Workspace metadata refreshes have their own card owner and must retain its expanded bio too.
  await page.evaluate(async()=>{
    const shadow=document.getElementById('workspace').attachShadow({mode:'open'}),sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='https://kick.com/ui.css';
    const style=document.createElement('style');style.textContent=KickRefinedChannelPanel.styles;const directory=document.createElement('div');directory.innerHTML='<div id="multi-channel-list"></div>';shadow.append(sheet,style,directory);
    window.remoteMeta={title:'Remote',live:'live',viewers:'1',followers:'20',bio:'Remote creator bio',socials:[{label:'X',href:'https://x.com/remotecreator'}]};window.remotePanels=[];
    const catalog=new Map([['remote',remoteMeta]]),state={channels:['remote'],layout:'grid',focus:'remote'};
    window.directoryScope=KickRefinedLifetime.create();window.directoryPanel=KickRefinedChannelPanel.create({support,enabled:false});
    window.KickRefinedChannelLibrary={};
    window.testDirectory=KickRefinedMultiDirectory.create({scope:directoryScope,getState:()=>state,getCatalog:()=>catalog,getContext:()=>({slug:'soultravels'}),channelPanel:directoryPanel,metadata:{requestChannel(){},requestPanels(){},panels:()=>remotePanels},directory,shadow,$:selector=>shadow.querySelector(selector),onPosition(){}});
    testDirectory.select('remote','about',{reveal:false});
  });
  const workspace=page.locator('#workspace'),source=workspace.locator('.profile-socials [data-social-platform="X"]'),popup=page.locator('#kr-social-preview');
  await source.evaluate(node=>window.originalAnchor=node);await source.hover();await popup.locator('.card[aria-busy="true"]').waitFor();
  const before=await page.evaluate(()=>({requests:profileRequests.length,cancels:profileCancels.length}));
  await page.evaluate(()=>{for(let count=1;count<=5;count++){remoteMeta.viewers=String(100+count);remoteMeta.streamTitle=`Remote live title ${count}`;testDirectory.render();}remoteMeta.followers='21';remotePanels=[{title:'Updated panel',description:'New public details'}];testDirectory.render();});
  assert.equal(await source.evaluate(node=>node===originalAnchor),true,'workspace metadata updates preserve the hover target');
  assert.equal(await workspace.locator('.profile-followers strong').textContent(),'21');assert.equal(await workspace.locator('.profile-panel h4').textContent(),'Updated panel');
  assert.deepEqual(await page.evaluate(()=>({requests:profileRequests.length,cancels:profileCancels.length})),before);
  await page.evaluate(()=>finishProfiles());await popup.getByText('Profile remotecreator',{exact:true}).waitFor();
  await page.evaluate(()=>{remoteMeta.socials=[{label:'X',href:'https://x.com/different'}];testDirectory.render();});await popup.waitFor({state:'detached'});
  assert.equal(await source.getAttribute('href'),'https://x.com/different','real social link changes still replace the preview target');
  await page.evaluate(()=>{directoryScope.dispose();directoryPanel.destroy();});
  assert.deepEqual(errors,[]);console.log(`${engine.name()}: pending hovers survive native and workspace updates; bio links share canonical caches; changed links clean up correctly`);
}finally{await browser.close();}
