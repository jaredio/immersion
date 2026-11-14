import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';
const extension=path.join(process.cwd(),'dist/chrome'),{fixture}=await workspaceFixtures();
const context=await chromium.launchPersistentContext(path.join(process.cwd(),`tmp/session-sync-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1500,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
  const worker=context.serviceWorkers().find(worker=>worker.url().startsWith('chrome-extension:'))||await context.waitForEvent('serviceworker',{predicate:worker=>worker.url().startsWith('chrome-extension:')});
  let ready=false;for(let i=0;i<40;i++){if(await worker.evaluate(()=>!!globalThis.chrome?.storage?.local)){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}if(!ready)throw Error('Storage not ready');
  await worker.evaluate(async()=>{await chrome.storage.local.clear();await chrome.storage.local.set({multiSessions:[{name:'Legacy',state:{channels:['native']}}]});});
  await context.route('https://kick.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/v2/channels/'))return route.fulfill({json:{slug:'native',user:{username:'Native'},livestream:null}});
    if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
    return route.fulfill({contentType:'text/html',body:fixture});
  });
  const pages=await Promise.all([context.newPage(),context.newPage()]);
  for(const page of pages){await page.goto('https://kick.com/native?refined-multi=native&immersion-player=embed');await page.locator('#kr-multi-root .multi-tile').waitFor();await page.locator('#kr-multi-root').getByRole('button',{name:'Manage',exact:true}).click();}
  const roots=pages.map(page=>page.locator('#kr-multi-root'));
  const save=async(root,name)=>{await root.getByRole('textbox',{name:'Layout name',exact:true}).fill(name);await root.getByRole('button',{name:'Save',exact:true}).click();await root.locator('#multi-notice').filter({hasText:`Saved “${name}”`}).waitFor();};
  await Promise.all([save(roots[0],'Alpha'),save(roots[1],'Beta')]);
  const stored=async()=>(await worker.evaluate(()=>chrome.storage.local.get('multiSessions'))).multiSessions;
  assert.deepEqual((await stored()).map(item=>item.name).sort(),['Alpha','Beta','Legacy']);
  const picker=roots[0].getByRole('combobox',{name:'Saved multiview sessions',exact:true});
  await picker.selectOption({label:'Alpha'});const selected=await picker.inputValue();
  assert.ok(selected&&!/^\d+$/.test(selected),'selected session has a stable ID');
  await save(roots[1],'Gamma');await picker.locator('option').filter({hasText:'Gamma'}).waitFor({state:'attached'});
  assert.equal(await picker.inputValue(),selected,'inserting another session does not change the selected session');
  const second=roots[1].getByRole('combobox',{name:'Saved multiview sessions',exact:true});
  await second.selectOption({label:'Beta'});await roots[1].getByRole('button',{name:'Delete saved',exact:true}).click();await roots[1].locator('#multi-notice').filter({hasText:'Saved session deleted.'}).waitFor();
  await picker.locator('option').filter({hasText:'Beta'}).waitFor({state:'detached'});
  assert.equal(await picker.inputValue(),selected,'deleting a different session preserves selection');
  await roots[0].getByRole('button',{name:'Hide settings bar',exact:true}).click();await pages[0].waitForTimeout(180);
  assert.deepEqual((await stored()).map(item=>item.name).sort(),['Alpha','Gamma','Legacy'],'ordinary workspace saves preserve named sessions');
  for(const page of pages)await page.locator('#kr-root').getByRole('button',{name:'Immersion settings',exact:true}).click();
  const dialogs=pages.map(page=>page.locator('#kr-root #settings-dialog'));
  const popup=await context.newPage();await popup.goto(worker.url().replace(/\/[^/]*$/,'/popup.html'));
  await popup.locator('#accent').waitFor();
  await Promise.all([dialogs[0].locator('#chatWidth').fill('400'),popup.locator('#accent').selectOption('blue'),dialogs[1].locator('#hideRecommended').check()]);
  await popup.waitForFunction(async()=>{const {settings}=await chrome.storage.local.get('settings');return settings?.chatWidth===400&&settings?.accent==='blue'&&settings?.hideRecommended===true;});
  assert.equal(await dialogs[0].locator('#chatWidth').inputValue(),'400');
  console.log('PASS installed Chromium: cross-tab sessions, stable selection, and concurrent popup/tab settings patches');
}finally{await context.close();}
