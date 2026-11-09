/* Deterministic installed-extension benchmark. No real Kick account or network. */
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {workspaceFixtures} from './workspace-benchmark-fixture.mjs';

const list=(key,fallback,allowed)=>[...new Set((process.env[key]||fallback).split(',').filter(value=>allowed.includes(value)))];
const counts=list('KR_BENCH_COUNTS','1,2,4,6',['1','2','4','6']).map(Number);
const modes=list('KR_BENCH_MODES','full,embed',['full','embed']);
const layouts=list('KR_BENCH_LAYOUTS','grid,focus,columns',['grid','focus','columns']);
const chats=list('KR_BENCH_CHAT','idle,busy',['idle','busy']);
const visibility=['foreground'];if(process.env.KR_BENCH_VISIBILITY&&process.env.KR_BENCH_VISIBILITY!=='foreground')throw Error('Use npm run benchmark:background for native background sampling');
const repeats=Math.floor(Math.max(1,Math.min(10,Number(process.env.KR_BENCH_REPEAT)||2)));
const duration=Math.max(250,Math.min(10000,Number(process.env.KR_BENCH_MS)||1000));
if([counts,modes,layouts,chats,visibility].some(values=>!values.length))throw Error('Benchmark configuration contains no valid scenarios');
const reportName=process.env.KR_BENCH_NAME||'workspace-benchmark';
if(!/^[a-zA-Z0-9_-]{1,60}$/.test(reportName))throw Error('Invalid report name');
const root=process.cwd(),extension=path.join(root,'dist/chrome');
const {frame,fixture}=await workspaceFixtures();
const context=await chromium.launchPersistentContext(path.join(root,`tmp/workspace-benchmark-${Date.now()}`),{
  executablePath:chromium.executablePath(),headless:true,viewport:{width:1600,height:1000},acceptDownloads:true,
  args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
});
const results=[];
const browserVersion=context.browser()?.version();
try{
  const worker=context.serviceWorkers().find(worker=>worker.url().startsWith('chrome-extension://'))||await context.waitForEvent('serviceworker',{predicate:worker=>worker.url().startsWith('chrome-extension://')});
  await context.route('https://kick.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/v2/channels/')){const slug=url.pathname.split('/').pop();return route.fulfill({json:{slug,user:{username:slug},livestream:{is_live:true,start_time:new Date(Date.now()-3*3600000).toISOString(),session_title:'Benchmark stream',viewer_count:100,categories:[{name:'Music'}]}}});}
    if(url.pathname.endsWith('/links'))return route.fulfill({json:[]});
    return route.fulfill({contentType:'text/html',body:url.searchParams.get('immersion-frame')==='full'?frame:fixture});
  });
  await context.route('https://player.kick.com/**',route=>route.fulfill({contentType:'text/html',body:frame}));
  const total=counts.length*modes.length*layouts.length*chats.length*visibility.length*repeats;
  for(let repeat=0;repeat<repeats;repeat++)for(const count of counts)for(const mode of modes)for(const layout of layouts)for(const chat of chats)for(const state of visibility){
    await worker.evaluate(()=>chrome.storage.local.set({settings:{diagnostics:true},multiview:{},multiSessions:[]}));
    const page=await context.newPage(),cdp=await context.newCDPSession(page);
    try{
      const channels=['native','a','b','c','d','e'].slice(0,count);
      await page.goto(`https://kick.com/native?refined-multi=${channels}&immersion-player=${mode}&refined-layout=${layout}`,{waitUntil:'domcontentloaded'});
      const workspace=page.locator('#kr-multi-root');await workspace.waitFor();
      await page.waitForFunction(count=>{const root=document.getElementById('kr-multi-root')?.shadowRoot;return root?.querySelectorAll('.multi-player iframe').length===count-1&&document.querySelector('main video')?.readyState>=2&&[...root.querySelectorAll('.multi-player iframe')].every(frame=>Number(frame.closest('.multi-tile').dataset.readyState)>=2)&&![...root.querySelectorAll('.multi-player-loading')].some(node=>!node.hidden);},count);
      await cdp.send('Performance.enable');
      const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item=>[item.name,item.value]));
      const before=await metrics();
      if(chat==='busy')await page.evaluate(()=>{
        window.benchIndex=0;window.benchTimer=setInterval(()=>{
          const list=document.getElementById('chatroom-messages');
          for(let i=0;i<20;i++){const row=document.createElement('div');row.dataset.index=String(benchIndex++);const link=document.createElement('a');link.href='https://example.com/message';link.textContent='Benchmark message';row.append(link);list.append(row);}
          while(list.children.length>160)list.firstElementChild.remove();
        },25);
      });
      const actualVisibility=await page.evaluate(()=>document.visibilityState);
      await page.waitForTimeout(duration);
      const after=await metrics();const chatMessages=await page.evaluate(()=>{clearInterval(window.benchTimer);return window.benchIndex||0;});
      await page.bringToFront();
      const download=page.waitForEvent('download');
      await page.locator('#kr-root').getByRole('button',{name:'Immersion settings',exact:true}).click();
      await page.locator('#kr-root').getByRole('button',{name:'Export this tab’s diagnostics',exact:true}).click();
      const diagnostics=JSON.parse(await readFile(await (await download).path(),'utf8'));
      if((diagnostics.counters['startup.peakConcurrent']||0)>2)throw Error('Startup concurrency exceeded two');
      results.push({repeat,count,mode,layout,chat,visibility:state,actualVisibility,durationMs:duration,chatMessages,taskMs:(after.TaskDuration-before.TaskDuration)*1000,layoutMs:(after.LayoutDuration-before.LayoutDuration)*1000,jsHeapBytes:after.JSHeapUsedSize,diagnostics});
      if(results.length%8===0||results.length===total)console.log(`Workspace benchmark: ${results.length}/${total} samples`);
    }finally{await page.close();}
  }
}finally{
  await context.close();await mkdir('artifacts',{recursive:true});
  const report={schema:1,capturedAt:new Date().toISOString(),environment:{browserVersion,platform:process.platform,cpus:os.cpus().length,cpu:os.cpus()[0]?.model},note:'Local fixtures with silent WAV media: not live Kick page cost or video decoder performance. CDP metrics cover the main target, not whole-browser CPU/memory; embeds may run in separate renderers. Diagnostics counters include setup; CDP durations cover the sample window.',results};
  await writeFile(`artifacts/${reportName}.json`,JSON.stringify(report,null,2)+'\n');
  const groups=new Map();for(const result of results){const key=[result.count,result.mode,result.layout,result.chat,result.visibility].join(' / ');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(result.taskMs);}
  const lines=['# Workspace fixture benchmark','','Configuration | Samples | Task time p50 (ms) | Task time p95 (ms)','--- | ---: | ---: | ---:'];
  for(const [key,values]of groups){values.sort((a,b)=>a-b);lines.push(`${key} | ${values.length} | ${values[Math.floor((values.length-1)*.5)].toFixed(2)} | ${values[Math.ceil((values.length-1)*.95)].toFixed(2)}`);}
  await writeFile(`artifacts/${reportName}.md`,lines.join('\n')+'\n');
}
