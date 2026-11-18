/* Exhaustive local browser matrix; leaves concise logs in ignored tmp/codebase-audit. */
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {finished} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'tmp','codebase-audit');await mkdir(out,{recursive:true});
const defaults=['browser-test','dom-test','search-test','retry-ux-test','queued-player-test','focus-layout-test','workspace-fullscreen-test','background-ui-test','player-controls-test','x-posts-test','media-test','review-checks','channel-page-test','offline-channel-test','channel-panel-test','channel-header-current-test','profile-social-test','profile-hover-reliability-test','clip-preview-test','chat-clips-test','discovery-test','hydration-test','theme-start-test','vod-page-test','clip-page-test','chat-notices-test','checkouts-test','support-test','reply-preview-test','full-players-test','workspace-soak-test','workspace-endurance-test'];
const engines=process.env.KR_ENGINE?[process.env.KR_ENGINE]:['chromium','firefox'];
if(engines.some(engine=>!['chromium','firefox'].includes(engine)))throw Error('Unknown browser engine');
const chromiumOnly=['session-sync-test','privacy-test'];
const cases=process.env.KR_AUDIT_CASES?process.env.KR_AUDIT_CASES.split(','):[...defaults,...chromiumOnly];
if(cases.some(file=>!defaults.includes(file)&&!chromiumOnly.includes(file)))throw Error('Unknown audit case');
const report=process.env.KR_AUDIT_REPORT||'browser-matrix.json';
if(!/^[\w-]+\.json$/.test(report))throw Error('Invalid audit report name');
const logs=path.join(out,path.basename(report,'.json'));await mkdir(logs,{recursive:true});
const results=[],started=new Date().toISOString();
for(const engine of engines)for(const file of cases){
  if(engine!=='chromium'&&chromiumOnly.includes(file))continue;
  const name=`${engine}-${file}`,stream=createWriteStream(path.join(logs,`${name}.log`)),start=Date.now();
  console.log(`START ${name}`);
  const coverage=engine==='chromium'&&!['workspace-soak-test','workspace-endurance-test'].includes(file);
  const child=spawn(process.execPath,['--import','./tools/audit-browser-hooks.mjs',`tools/${file}.mjs`],{cwd:root,windowsHide:true,env:{...process.env,KR_ENGINE:engine,KR_SOAK_CYCLES:process.env.KR_SOAK_CYCLES||'64',KR_ENDURANCE_CYCLES:process.env.KR_ENDURANCE_CYCLES||'320',KR_AUDIT_COVERAGE:coverage?path.join(logs,`${name}-coverage.json`):''},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');},360000);
  const result=await new Promise(resolve=>{
    let error;child.once('error',failure=>{error=failure.message;});
    child.once('close',(code,signal)=>resolve({code,signal,...(error?{error}:{})}));
  });
  clearTimeout(timer);stream.end();await finished(stream);
  const entry={engine,file,...result,timedOut,seconds:Math.round((Date.now()-start)/100)/10};results.push(entry);
  await writeFile(path.join(out,report),JSON.stringify({started,updated:new Date().toISOString(),results},null,2));
  console.log(`${entry.code===0&&!timedOut?'PASS':'FAIL'} ${name} (${entry.seconds}s)`);
}
const failed=results.filter(result=>result.code!==0||result.timedOut);console.log(`Completed ${results.length} browser checks; ${failed.length} failed.`);process.exitCode=failed.length?1:0;
