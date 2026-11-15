/* Repeatable local regression sweep. No live accounts, API keys or Kick traffic.
 * Browser processes run sequentially to limit contention on test machines.
 * KR_ENGINE selects one engine; KR_SOAK_CYCLES / KR_ENDURANCE_CYCLES tune churn. */
import {spawnSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const engines=process.env.KR_ENGINE?[process.env.KR_ENGINE]:['chromium','firefox'];
if(engines.some(engine=>!['chromium','firefox'].includes(engine)))throw Error('Use KR_ENGINE=chromium or firefox');
let checks=0;
function run(args,engine){
  console.log(`Running ${engine?engine+': ':''}${args.join(' ')}`);
  const result=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...(engine?{KR_ENGINE:engine}:{})},stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`${args.join(' ')} failed${result.signal?' ('+result.signal+')':''}: ${result.status}`);
  checks++;
}
const tests=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
run(['--test','--test-reporter=spec',...tests]);
run(['tools/release-test.mjs']);
for(const engine of engines){
  for(const file of ['browser-test','dom-test','search-test','retry-ux-test','queued-player-test','focus-layout-test','workspace-fullscreen-test','x-posts-test','media-test','review-checks','channel-page-test','offline-channel-test','clip-preview-test','workspace-soak-test','workspace-endurance-test'])run([`tools/${file}.mjs`],engine);
  if(engine==='chromium')run(['tools/session-sync-test.mjs'],engine);
}
console.log(`PASS ${checks} test commands across ${engines.join(' and ')}`);
