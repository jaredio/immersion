import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const engine=process.env.KR_ENGINE==='firefox'?firefox:chromium,browser=await engine.launch({headless:true});
const native=await readFile('tests/clip-editor-fixture.html','utf8');
const scripts=(await Promise.all(['clip-tools.js','clip-catalog.js','clip-history.js','clip-window.js','clip-workspace.js','clip-studio.js','clip-native-bridge.js','clip-studio-frame.js'].map(file=>readFile('extension/'+file,'utf8')))).join('\n');
const liveId='12345678-1234-7234-8234-123456789abc',pastId='22345678-1234-7234-8234-123456789abc';
const payload={queries:[{state:{data:{slug:'alpha',id:42,livestream:{vod_id:liveId,channel_id:42,session_title:'Currently live',is_live:true,start_time:'2026-01-02T10:00:00Z'}}}},{state:{data:{data:[{id:pastId,channel:{slug:'alpha',id:42},title:'A previous broadcast',is_live:false,duration:7200,status:'public',start_time:'2026-01-01T10:00:00Z'},{id:liveId,channel:{slug:'alpha',id:42},title:'Currently live',is_live:true,duration:0,status:'public',start_time:'2026-01-02T10:00:00Z'}]}}}]};
const text='a:'+JSON.stringify(payload)+'\n',cut=Math.floor(text.length/2);
const profile='<html><body><h1>Alpha videos</h1><script>self.__next_f=[];</script>'+[text.slice(0,cut),text.slice(cut)].map(value=>'<script>self.__next_f.push('+JSON.stringify([1,value])+')</script>').join('')+'</body></html>';
const withScripts=html=>html.replace('</body>',`<script>${scripts}</script></body>`);
try{
 const context=await browser.newContext({viewport:{width:1400,height:1000}});let scenario='inline';
 await context.route('https://kick.com/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname.startsWith('/api/')){
   if(scenario==='mixed')return route.fulfill({json:url.pathname.endsWith('/videos')?[{video:{uuid:'32345678-1234-4234-8234-123456789abc',status:'public'},is_live:true,session_title:'Currently live',duration:0},{video:{uuid:'42345678-1234-4234-8234-123456789abc',status:'public'},session_title:'A previous broadcast',duration:7200000}]:{livestream:null}});
   return route.fulfill({status:403,json:{error:'Request blocked by security policy'}});
  }
  if(url.pathname==='/alpha/videos'){
   if(request.resourceType()!=='document'&&!['inline','mixed'].includes(scenario))return route.fulfill({status:403,body:'Request blocked by security policy'});
   return route.fulfill({contentType:'text/html',body:withScripts(scenario==='empty'?'<html><body><h1>Alpha</h1></body></html>':profile)});
  }
  return route.fulfill({contentType:'text/html',body:withScripts(native)});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('https://kick.com/alpha');
 await page.evaluate(()=>window.studio=KickRefinedClipStudio.create({getSources:()=>[{slug:'alpha',title:'Alpha'}],isWorkspace:()=>true}));
 const studio=page.locator('#kr-clip-studio-root');
 const open=async()=>{await page.evaluate(()=>studio.open('alpha'));await studio.getByRole('button',{name:'Stream history',exact:true}).click();};
 for(const type of ['inline','mixed','frame']){
  scenario=type;await open();const picker=studio.getByRole('combobox',{name:'Stream recording',exact:true});
  await picker.locator('option').filter({hasText:'Current broadcast'}).waitFor({state:'attached'});assert.equal(await picker.locator('option').count(),2);
  assert.match(await picker.locator('option:checked').textContent(),/Current broadcast/);
  await studio.getByRole('button',{name:'Clip selection',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.getElementById('kr-clip-studio-root').shadowRoot.querySelector('[data-act=clip]').disabled);
  await picker.selectOption('1');await page.waitForFunction(id=>document.getElementById('kr-clip-studio-root').shadowRoot.querySelector('iframe').src.includes('/videos/'+id),pastId);
  await studio.getByRole('button',{name:'Close clip studio',exact:true}).click();
 }
 scenario='empty';await open();await studio.getByText('Kick did not return recording data. Retry discovery or use a replay link.',{exact:true}).first().waitFor({timeout:15000});
 assert.equal(await studio.getByRole('group',{name:'Full stream timeline',exact:true}).isVisible(),false,'an unloaded source does not show a pretend three-minute timeline');
 scenario='inline';await studio.getByRole('button',{name:'Retry',exact:true}).click();await studio.getByRole('combobox',{name:'Stream recording',exact:true}).locator('option').filter({hasText:'Current broadcast'}).waitFor({state:'attached'});
 assert.deepEqual(errors,[]);console.log(`${engine.name()}: blocked legacy APIs, current streamed recording metadata, ongoing archive, multiple recordings, native-page fallback, empty-state controls and discovery retry passed`);
}finally{await browser.close();}
