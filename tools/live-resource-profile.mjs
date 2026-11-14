/* Anonymous, disposable live-player profile. No user browser or account session. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const slugs=(process.env.KR_LIVE_CHANNELS||'iceposeidon,greatwhitemike').split(',').map(value=>value.trim().toLowerCase());
if(slugs.length<1||slugs.length>6||slugs.some(slug=>!/^[a-z0-9_]{1,40}$/.test(slug)))throw Error('Provide one to six public channels.');
const extension=path.join(process.cwd(),'dist/chrome');
const context=await chromium.launchPersistentContext(path.join(process.cwd(),`tmp/live-profile-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1500,height:900},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
const report={capturedAt:new Date().toISOString(),channels:slugs,anonymous:true,sampleSeconds:5};
try{
  if(!context.serviceWorkers().length)await context.waitForEvent('serviceworker');
  const cdp=await context.browser().newBrowserCDPSession();
  const processes=async()=>(await cdp.send('SystemInfo.getProcessInfo')).processInfo;
  const memory=items=>{
    if(process.platform!=='win32')return null;
    const ids=items.map(item=>Number(item.id)).filter(id=>Number.isSafeInteger(id)&&id>0);
    if(!ids.length)return null;
    const output=execFileSync('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64 | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true});
    const rows=output.trim()?JSON.parse(output):[];
    return [rows].flat().reduce((sum,item)=>sum+Number(item.WorkingSet64||0),0);
  };
  await context.route('https://kick.com/',route=>route.fulfill({contentType:'text/html',body:'<html><body><main style="display:flex"></main></body></html>'}));
  const page=await context.newPage();
  await page.goto('https://kick.com/');
  await page.evaluate(slugs=>{
    let revision=0;
    const send=frame=>frame.contentWindow.postMessage({type:'kick-refined:control',session:'live-resource-profile',revision:++revision,muted:true,volume:.1,focused:false,action:'play'},location.origin);
    window.addEventListener('message',event=>{const frame=[...document.querySelectorAll('iframe')].find(frame=>frame.contentWindow===event.source);if(frame&&event.origin===location.origin&&event.data?.type==='kick-refined:ready')send(frame);});
    for(const slug of slugs){const frame=document.createElement('iframe');frame.name=`kick-refined-full:${slug}`;frame.allow='autoplay; fullscreen';frame.style.cssText='width:700px;height:400px;border:0';frame.src=`https://kick.com/${slug}?immersion-frame=full`;frame.onload=()=>send(frame);document.querySelector('main').append(frame);}
  },slugs);
  const states=async()=>Promise.all(slugs.map(async slug=>{
    const frame=page.frames().find(frame=>frame.name()===`kick-refined-full:${slug}`);
    if(!frame?.url().startsWith('https://kick.com/'))return {slug,playbackProven:false,state:'unavailable'};
    return frame.evaluate(slug=>{const video=document.querySelector('[data-kr-full-player-root] video');return {slug,playbackProven:!!video&&video.readyState>=2&&!video.paused,width:video?.videoWidth||0,height:video?.videoHeight||0};},slug).catch(()=>({slug,playbackProven:false,state:'unavailable'}));
  }));
  for(let attempt=0;attempt<6;attempt++){await page.waitForTimeout(4000);report.playback=await states();if(report.playback.every(item=>item.playbackProven))break;}
  const before=await processes(),beforeCPU=new Map(before.map(item=>[item.id,item.cpuTime]));
  const started=performance.now();await page.waitForTimeout(report.sampleSeconds*1000);
  const after=await processes(),elapsed=(performance.now()-started)/1000;
  report.playback=await states();report.livePlaybackProven=report.playback.every(item=>item.playbackProven);
  report.processes=after.map(item=>({pid:item.id,type:item.type,cpuSeconds:Math.max(0,item.cpuTime-(beforeCPU.get(item.id)||0))}));
  report.cpuSeconds=report.processes.reduce((sum,item)=>sum+item.cpuSeconds,0);
  report.cpuPercentOneCore=report.cpuSeconds/elapsed*100;report.elapsedSeconds=elapsed;
  report.sumWorkingSetBytes=memory(after);
  report.note='Headless disposable browser, full Kick page players. CPU covers browser-reported live processes, including renderer/GPU/utility work; exited processes are omitted. Summed Windows working sets can count shared pages more than once. Not an extension-only measurement or before/after comparison. If playback is unproven, these numbers are page-loading cost, not streaming performance.';
}catch(error){report.error=error.message;report.livePlaybackProven=false;}
finally{await context.close();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/live-resource-profile.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
if(!report.livePlaybackProven)process.exitCode=2;
