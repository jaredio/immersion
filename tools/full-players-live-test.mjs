/* Opt-in, anonymous smoke test of real Kick channel pages in isolated frames.
 * Uses a disposable extension profile. Does not use the user's browser session. */
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const slugs=(process.env.KR_LIVE_CHANNELS||'clavicular,trainwreckstv').split(',').map(s=>s.trim().toLowerCase()).filter(s=>/^[a-z0-9_]{1,40}$/.test(s)).slice(0,2);
if(slugs.length!==2)throw Error('Set KR_LIVE_CHANNELS to two public Kick channel names.');
const context=await chromium.launchPersistentContext(path.join(root,`tmp/full-players-live-${Date.now()}`),{executablePath:chromium.executablePath(),headless:true,viewport:{width:1500,height:900},args:[`--disable-extensions-except=${path.join(root,'dist/chrome')}`,`--load-extension=${path.join(root,'dist/chrome')}`]});
try{
 await context.route('https://kick.com/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#09090b}main{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}iframe{width:100%;height:410px;border:0}</style></head><body><main id="live-probe"></main></body></html>'}));
 const page=await context.newPage();let failures=0;page.on('requestfailed',request=>{if(request.resourceType()==='document'&&failures++<4)console.log(JSON.stringify({documentFailure:new URL(request.url()).pathname,error:request.failure()?.errorText}));});await page.goto('https://kick.com/');
 await page.evaluate(slugs=>{
  window.probeRevisions=new Map();
  function control(frame){const revision=(probeRevisions.get(frame)||0)+1;probeRevisions.set(frame,revision);frame.contentWindow.postMessage({type:'kick-refined:control',session:'full-player-live-test',revision,muted:true,volume:.2,focused:false,action:'play'},location.origin);}
  window.addEventListener('message',event=>{const frame=[...document.querySelectorAll('iframe')].find(frame=>frame.contentWindow===event.source);if(frame&&event.origin===location.origin&&event.data?.type==='kick-refined:ready')control(frame);});
  for(const slug of slugs){const frame=document.createElement('iframe');frame.name=`kick-refined-full:${slug}`;frame.allow='autoplay; fullscreen; picture-in-picture';frame.src=`https://kick.com/${slug}?immersion-frame=full`;frame.addEventListener('load',()=>control(frame));document.getElementById('live-probe').append(frame);}
 },slugs);
 let results=[];
 for(let attempt=0;attempt<8;attempt++){
  await page.waitForTimeout(5000);results=[];
  for(const slug of slugs){const frame=page.frames().find(frame=>frame.name()===`kick-refined-full:${slug}`);let result={slug,loaded:false,frameState:frame?.url().startsWith('chrome-error:')?'network-error':frame?.url().startsWith('about:')?'pending':'unavailable'};
   if(frame?.url().startsWith('https://kick.com/'))result={slug,...await frame.evaluate(()=>{const video=document.querySelector('[data-kr-full-player-root] video');return {isolated:!!document.querySelector('[data-kr-full-player-root]'),hasVideo:!!video,ready:video?.readyState||0,playing:!!video&&!video.paused,muted:video?.muted??true,nativeControls:!!document.querySelector('.z-controls.bottom-0:has(button)'),timeline:!!document.querySelector('[data-kr-full-player-root] [role="slider"]'),nestedWorkspace:!!document.querySelector('#kr-multi-root'),seekable:video?[...Array(video.seekable.length)].map((_,i)=>Math.round(video.seekable.end(i)-video.seekable.start(i))):[]};}).catch(()=>({loaded:false}))};
   results.push(result);
  }
  console.log(JSON.stringify({seconds:(attempt+1)*5,results}));
  if(results.every(result=>result.isolated&&result.ready>=2&&result.playing&&result.muted&&!result.nestedWorkspace))break;
 }
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/full-players-live.png',fullPage:true});
 if(!results.every(result=>result.isolated&&result.ready>=2&&result.playing&&result.muted&&!result.nestedWorkspace))throw Error('Live playback was not proven for both channels; inspect artifacts/full-players-live.png.');
 console.log('PASS real Kick pages: two isolated, playing, muted full players with no nested workspace. Native DVR availability remains channel-dependent.');
}finally{await context.close();}
