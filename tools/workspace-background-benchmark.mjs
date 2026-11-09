/* Native CDP avoids Playwright's always-focused-page emulation. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {nativeChromium} from './native-cdp.mjs';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';

const list=(key,fallback,allowed)=>[...new Set((process.env[key]||fallback).split(',').filter(item=>allowed.includes(item)))];
const counts=list('KR_BENCH_COUNTS','1,2,4,6',['1','2','4','6']).map(Number),modes=list('KR_BENCH_MODES','full,embed',['full','embed']);
const layouts=list('KR_BENCH_LAYOUTS','grid,focus,columns',['grid','focus','columns']),chats=list('KR_BENCH_CHAT','idle,busy',['idle','busy']);
const repeats=Math.floor(Math.max(1,Math.min(10,Number(process.env.KR_BENCH_REPEAT)||2))),duration=Math.max(250,Math.min(10000,Number(process.env.KR_BENCH_MS)||1000));
if([counts,modes,layouts,chats].some(values=>!values.length))throw Error('No valid benchmark scenarios');
const profile=path.resolve(`tmp/background-benchmark-${Date.now()}`),downloads=path.join(profile,'downloads');await mkdir(downloads,{recursive:true});
const browser=await nativeChromium({extension:path.resolve('dist/chrome'),profile}),assets=await workspaceFixtures();
const sessions=new Map(),results=[];let downloaded=null;
const evaluate=async(sessionId,expression)=>{const response=await browser.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result.value;};
async function wait(get,message){for(let i=0;i<1000;i++){if(browser.errors.length)throw browser.errors[0];const result=await get();if(result)return result;await new Promise(resolve=>setTimeout(resolve,20));}throw Error(message);}
browser.on('Target.attachedToTarget',async({sessionId,targetInfo})=>{
  const item={sessionId,...targetInfo,ready:false};sessions.set(targetInfo.targetId,item);
  if(['page','iframe'].includes(targetInfo.type)){
    await browser.send('Fetch.enable',{patterns:[{urlPattern:'https://kick.com/*'},{urlPattern:'https://player.kick.com/*'}]},sessionId);
    await browser.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);
  }
  await browser.send('Runtime.runIfWaitingForDebugger',{},sessionId);item.ready=true;
});
browser.on('Target.detachedFromTarget',({sessionId})=>{for(const [id,item]of sessions)if(item.sessionId===sessionId)sessions.delete(id);});
browser.on('Fetch.requestPaused',async({requestId,request},sessionId)=>{
  const url=new URL(request.url);let body=assets.fixture,contentType='text/html';
  if(url.hostname==='player.kick.com'||url.searchParams.get('immersion-frame')==='full')body=assets.frame;
  else if(url.pathname.startsWith('/api/v2/channels/')){const slug=url.pathname.split('/').pop();body=JSON.stringify({slug,user:{username:slug},livestream:{is_live:true,start_time:new Date(Date.now()-10800000).toISOString(),session_title:'Benchmark stream',viewer_count:100,categories:[{name:'Music'}]}});contentType='application/json';}
  else if(url.pathname.endsWith('/links')){body='[]';contentType='application/json';}
  await browser.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:contentType}],body:Buffer.from(body).toString('base64')},sessionId);
});
browser.on('Browser.downloadProgress',({guid,state})=>{if(state==='completed')downloaded=guid;});
try{
  await browser.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
  await browser.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  const worker=await wait(()=>[...sessions.values()].find(item=>item.ready&&item.type==='service_worker'&&item.url.startsWith('chrome-extension://')),'Extension worker did not start');
  await wait(()=>evaluate(worker.sessionId,"typeof chrome!=='undefined'&&!!chrome.storage?.local"),'Extension storage did not initialize');
  const total=counts.length*modes.length*layouts.length*chats.length*repeats;
  for(let repeat=0;repeat<repeats;repeat++)for(const count of counts)for(const mode of modes)for(const layout of layouts)for(const chat of chats){
    await evaluate(worker.sessionId,"chrome.storage.local.set({settings:{diagnostics:true},multiview:{},multiSessions:[]})");
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});let backgroundId;
    try{
      const page=await wait(()=>{const item=sessions.get(targetId);return item?.ready&&item;},'Page did not attach');
      const channels=['native','a','b','c','d','e'].slice(0,count);
      await browser.send('Page.navigate',{url:`https://kick.com/native?refined-multi=${channels}&immersion-player=${mode}&refined-layout=${layout}`},page.sessionId);
      await wait(()=>evaluate(page.sessionId,`(()=>{const root=document.getElementById('kr-multi-root')?.shadowRoot;return root?.querySelectorAll('.multi-player iframe').length===${count-1}&&document.querySelector('main video')?.readyState>=2&&[...root.querySelectorAll('.multi-player iframe')].every(frame=>Number(frame.closest('.multi-tile').dataset.readyState)>=2);})()`),'Players did not become ready');
      await browser.send('Performance.enable',{},page.sessionId);
      const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics',{},page.sessionId)).metrics.map(item=>[item.name,item.value]));
      const before=await metrics();
      if(chat==='busy')await evaluate(page.sessionId,"window.benchIndex=0;window.benchTimer=setInterval(()=>{const list=document.getElementById('chatroom-messages');for(let i=0;i<20;i++){const row=document.createElement('div');row.dataset.index=String(benchIndex++);const link=document.createElement('a');link.href='https://example.com/message';link.textContent='Benchmark message';row.append(link);list.append(row);}while(list.children.length>160)list.firstElementChild.remove();},25)");
      backgroundId=(await browser.send('Target.createTarget',{url:'about:blank'})).targetId;
      await wait(()=>sessions.get(backgroundId)?.ready,'Background tab did not attach');
      await browser.send('Target.activateTarget',{targetId:backgroundId});
      await wait(()=>evaluate(page.sessionId,"document.visibilityState==='hidden'"),'Native page did not enter the background');
      await new Promise(resolve=>setTimeout(resolve,duration));
      const after=await metrics(),chatMessages=await evaluate(page.sessionId,'clearInterval(window.benchTimer);window.benchIndex||0');
      await browser.send('Target.closeTarget',{targetId:backgroundId});backgroundId=null;await browser.send('Target.activateTarget',{targetId});
      downloaded=null;
      await evaluate(page.sessionId,"document.getElementById('kr-root').shadowRoot.querySelector('#kr-settings').click();[...document.getElementById('kr-root').shadowRoot.querySelectorAll('button')].find(button=>button.textContent==='Export this tab’s diagnostics').click()");
      const guid=await wait(()=>downloaded,'Diagnostic download did not complete');
      const diagnostics=JSON.parse(await readFile(path.join(downloads,guid),'utf8'));
      if((diagnostics.counters['startup.peakConcurrent']||0)>2)throw Error('Startup limit exceeded');
      results.push({repeat,count,mode,layout,chat,visibility:'background',actualVisibility:'hidden',durationMs:duration,chatMessages,taskMs:(after.TaskDuration-before.TaskDuration)*1000,jsHeapBytes:after.JSHeapUsedSize,diagnostics});
      if(results.length%8===0||results.length===total)console.log(`Native background benchmark: ${results.length}/${total} samples`);
    }finally{if(backgroundId)await browser.send('Target.closeTarget',{targetId:backgroundId}).catch(()=>{});await browser.send('Target.closeTarget',{targetId}).catch(()=>{});}
  }
}finally{
  await browser.close();await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/workspace-benchmark-background.json',JSON.stringify({schema:1,capturedAt:new Date().toISOString(),note:'Native Chromium CDP, genuine hidden tabs, local silent-WAV fixtures. Main-target metrics are not whole-browser cost, live Kick performance or video decoder measurements. Native background throttling may reduce generated chat activity; chatMessages records actual generation.',results},null,2)+'\n');
}
