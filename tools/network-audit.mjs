/* Anonymous A/B diagnostic. Stores host counts, never cookies or URL queries. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const channel=(process.env.KR_AUDIT_CHANNEL||'xqc').toLowerCase();
if(!/^[a-z0-9_]{1,40}$/.test(channel))throw Error('Invalid audit channel');
const results=[];
// Isolate Chromium runtimes: sequential contexts in one Windows process can
// briefly report stale service-worker targets from the preceding browser.
if(!process.env.KR_AUDIT_PROTECTION){
  for(const mode of ['off','on']){
    const run=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,KR_AUDIT_PROTECTION:mode},stdio:'inherit',windowsHide:true});
    if(run.status!==0)process.exit(run.status||1);
    results.push(JSON.parse(await readFile(`artifacts/network-audit-${mode}.json`,'utf8')));
  }
}else for(const protection of [process.env.KR_AUDIT_PROTECTION==='on']){
  const extension=path.resolve('dist/chrome');
  const context=await chromium.launchPersistentContext(path.resolve(`tmp/network-audit-${Date.now()}-${protection}`),{
    executablePath:chromium.executablePath(),headless:true,
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
  });
  try{
    const isExtension=worker=>worker.url().startsWith('chrome-extension://');
    const worker=context.serviceWorkers().find(isExtension)||await context.waitForEvent('serviceworker',{predicate:isExtension,timeout:30000});
    await worker.evaluate(blockTelemetry=>chrome.storage.local.set({settings:{blockTelemetry}}),protection);
    for(let i=0;i<50;i++){
      const enabled=await worker.evaluate(()=>chrome.declarativeNetRequest.getEnabledRulesets());
      if(enabled.includes('kick-telemetry')===protection)break;
      if(i===49)throw Error('Telemetry preference did not apply');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const page=await context.newPage(),hosts=new Map();let bytes=0;
    const hostFor=request=>{try{const host=new URL(request.url()).hostname;if(!host||!request.url().startsWith('https://'))return;let data=hosts.get(host);if(!data){data={requests:0,blocked:0,failed:0};hosts.set(host,data);}return data;}catch{}};
    page.on('request',request=>{const host=hostFor(request);if(host)host.requests++;});
    page.on('requestfailed',request=>{const host=hostFor(request);if(host){host.failed++;if(/ERR_BLOCKED_BY_CLIENT/.test(request.failure()?.errorText||''))host.blocked++;}});
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Network.enable');
    cdp.on('Network.loadingFinished',event=>{bytes+=event.encodedDataLength;});
    const response=await page.goto(`https://kick.com/${channel}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(15000);
    const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    const playback=await page.locator('video').evaluateAll(videos=>videos.map(v=>({readyState:v.readyState,playing:!v.paused&&!v.ended,error:v.error?.code||null})));
    const result={protection,status:response?.status(),requests:[...hosts.values()].reduce((n,h)=>n+h.requests,0),blocked:[...hosts.values()].reduce((n,h)=>n+h.blocked,0),encodedBytes:bytes,mainThreadSeconds:metrics.TaskDuration,jsHeapBytes:metrics.JSHeapUsedSize,playback,hosts:Object.fromEntries([...hosts].sort())};
    results.push(result);console.log(JSON.stringify({...result,hosts:undefined}));
    await mkdir('artifacts',{recursive:true});
    await writeFile(`artifacts/network-audit-${process.env.KR_AUDIT_PROTECTION}.json`,JSON.stringify(result,null,2)+'\n');
  }finally{await context.close();}
}
await mkdir('artifacts',{recursive:true});
if(!process.env.KR_AUDIT_PROTECTION)await writeFile('artifacts/network-audit.json',JSON.stringify({channel,capturedAt:new Date().toISOString(),note:'Two sequential anonymous samples; stream, ads and network vary. Not a controlled speed benchmark.',results},null,2)+'\n');
