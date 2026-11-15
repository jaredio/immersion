/* Real DOM comparison against HEAD; synthetic replay is not live Kick CPU cost. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const ref=process.env.KR_BENCH_REF||'HEAD';if(!/^(?:[a-f0-9]{7,40}|HEAD(?:~\d+)?)$/i.test(ref))throw Error('Invalid baseline ref');
const args=['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`],commit=execFileSync('git',[...args,'rev-parse',ref],{encoding:'utf8',windowsHide:true}).trim();
const baseline=execFileSync('git',[...args,'show',`${commit}:extension/clip-replay.js`],{encoding:'utf8',windowsHide:true}),current=await readFile('extension/clip-replay.js','utf8');
const browser=await chromium.launch({headless:true}),samples=[];
try{
 for(let repeat=0;repeat<5;repeat++)for(const variant of repeat%2?['current','baseline']:['baseline','current']){
  const page=await browser.newPage();await page.setContent('<div id="replay"></div>');
  await page.evaluate(()=>{
   window.start=Date.parse('2026-11-15T00:00:00Z');window.time=0;window.createdRows=0;window.createdEmotes=0;
   const create=document.createElement.bind(document),src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
   const emote='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#b0ff8c"/></svg>');
   document.createElement=(tag,...args)=>{const node=create(tag,...args);if(tag==='p')createdRows++;if(tag==='img'){createdEmotes++;Object.defineProperty(node,'src',{get:()=>src.get.call(node),set:()=>src.set.call(node,emote)});}return node;};
   window.fetch=async url=>{const offset=(Date.parse(new URL(url).searchParams.get('start_time'))-start)/1000;const messages=Array.from({length:200},(_,i)=>{const at=offset+i/40;return {id:'message-'+Math.round(at*40),created_at:new Date(start+at*1000).toISOString(),type:'message',content:'Message '+at+' [emote:1:Hello]',sender:{username:'Viewer'}};});return new Response(JSON.stringify({data:{messages}}));};
   window.KickRefined={readText:response=>response.text()};window.video=document.createElement('video');Object.defineProperty(video,'currentTime',{get:()=>time});Object.defineProperty(video,'duration',{get:()=>40});
  });
  await page.addScriptTag({path:'extension/clip-tools.js'});await page.addScriptTag({content:variant==='baseline'?baseline:current});
  await page.evaluate(()=>window.controller=KickRefinedClipReplay.create({container:document.getElementById('replay'),video,data:{replay:{channelId:1,startedAt:start},duration:40},signal:new AbortController().signal,onClose(){}}));
  await page.waitForFunction(()=>!!document.querySelector('.replay-messages p'));
  const result=await page.evaluate(async()=>{
   const before=createdRows,emotes=createdEmotes,start=performance.now();
   for(let tick=1;tick<=300;tick++){time=tick/10;video.dispatchEvent(new Event('timeupdate'));if(tick%50===0)await new Promise(resolve=>setTimeout(resolve,0));}
   const ms=performance.now()-start,rows=[...document.querySelectorAll('.replay-messages p')],count=rows.length;
   window.lastMessageNode=rows.at(-1);time=30.1;video.dispatchEvent(new Event('timeupdate'));
   const retained=lastMessageNode.isConnected;
   time=2;video.dispatchEvent(new Event('seeking'));await new Promise(resolve=>setTimeout(resolve,0));
   const backwards=[...document.querySelectorAll('.replay-messages p')].map(row=>row.textContent);
   controller.destroy();return {ms,createdRows:createdRows-before,createdEmotes:createdEmotes-emotes,count,retained,backwards,remaining:document.querySelectorAll('.replay').length};
  });
  assert.ok(result.count<=200);assert.equal(result.remaining,0);if(variant==='current')assert.equal(result.retained,true,'new messages retain existing rows and emotes');samples.push({repeat,variant,...result});await page.close();
 }
}finally{await browser.close();}
const median=(variant,key)=>samples.filter(row=>row.variant===variant).map(row=>row[key]).sort((a,b)=>a-b)[2];
const summary={baselineCommit:commit,scenario:'300 playback updates, 40 messages/second, 200 visible rows, 5 alternating repeats',baseline:{ms:median('baseline','ms'),rows:median('baseline','createdRows'),emotes:median('baseline','createdEmotes')},current:{ms:median('current','ms'),rows:median('current','createdRows'),emotes:median('current','createdEmotes')}};
summary.rowCreationReductionPercent=100*(1-summary.current.rows/summary.baseline.rows);summary.scriptTimeReductionPercent=100*(1-summary.current.ms/summary.baseline.ms);
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/replay-performance.json',JSON.stringify({summary,note:'Synthetic DOM workload, not total browser CPU, video decoding or live Kick performance.',samples},null,2)+'\n');console.log(JSON.stringify(summary));
