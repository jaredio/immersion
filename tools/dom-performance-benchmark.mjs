/* Compare the checked-out chat dispatcher with HEAD using real DOM nodes.
 * Synthetic observer records isolate JS dispatch cost, not live Kick or rendering. */
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const baselineRef=process.env.KR_BENCH_REF||'HEAD';
if(!/^(?:[a-f0-9]{7,40}|HEAD(?:~\d+)?)$/i.test(baselineRef))throw Error('Invalid baseline ref');
const gitArgs=['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`];
const baselineCommit=execFileSync('git',[...gitArgs,'rev-parse',baselineRef],{encoding:'utf8',windowsHide:true}).trim();
const baseline=execFileSync('git',[...gitArgs,'show',`${baselineCommit}:extension/dom.js`],{encoding:'utf8',windowsHide:true});
const current=await readFile('extension/dom.js','utf8');
const browser=await chromium.launch({headless:true}),samples=[];
try{
  for(let repeat=0;repeat<7;repeat++)for(const variant of repeat%2?['current','baseline']:['baseline','current']){
    const page=await browser.newPage();
    await page.setContent('<div id="chatroom-messages"></div>');
    await page.evaluate(()=>{
      const Native=MutationObserver;
      window.MutationObserver=class extends Native{constructor(callback){super(callback);if(callback.name==='dispatchChat')window.dispatchChat=callback;}};
      const list=document.getElementById('chatroom-messages');
      for(let i=0;i<160;i++){const row=document.createElement('div');row.dataset.index=i;row.innerHTML='<a href="https://example.com">message</a><img><span>text</span>';list.append(row);}
      window.counts={};window.KickRefinedPerf={count:(key,n=1)=>counts[key]=(counts[key]||0)+n};
    });
    await page.addScriptTag({content:variant==='baseline'?baseline:current});
    const result=await page.evaluate(()=>{
      const list=document.getElementById('chatroom-messages'),rows=[...list.children];let delivered=0;
      for(const attributes of [['href','src','data-index'],['href','data-index'],['href','data-index']]){
        const onRows=affected=>{delivered+=affected.size;for(const row of affected)KickRefinedDOM.links(row);};
        const client=KickRefinedDOM.subscribeChat({attributes,onRows,onMutations(_records,{rows}){onRows(rows);}});client.setEnabled(true);
      }
      for(const row of rows)KickRefinedDOM.links(row);
      const scenarios={};
      for(const scenario of ['attribute churn','repeated child mutations','new messages']){
        const batches=Array.from({length:80},(_,batch)=>Array.from({length:100},(_,i)=>{
          const row=rows[(batch*13+i)%rows.length];
          if(scenario==='attribute churn')return {type:'attributes',attributeName:i%2?'src':'data-index',target:i%2?row.querySelector('img'):row,addedNodes:[],removedNodes:[]};
          return {type:'childList',target:scenario==='new messages'?list:row,addedNodes:[scenario==='new messages'?row:row.querySelector('span').firstChild],removedNodes:[]};
        }));
        for(const records of batches.slice(0,5))dispatchChat(records);
        const before=counts['chat.rowIndexBuilds']||0,start=performance.now();
        for(const records of batches)dispatchChat(records);
        scenarios[scenario]={ms:performance.now()-start,rowIndexBuilds:(counts['chat.rowIndexBuilds']||0)-before};
      }
      return {scenarios,delivered};
    });
    samples.push({repeat,variant,...result});await page.close();
  }
}finally{await browser.close();}
const summary={};
for(const scenario of Object.keys(samples[0].scenarios)){
  const values=variant=>samples.filter(sample=>sample.variant===variant).map(sample=>sample.scenarios[scenario].ms).sort((a,b)=>a-b);
  const before=values('baseline')[3],after=values('current')[3];
  summary[scenario]={baselineMedianMs:+before.toFixed(2),currentMedianMs:+after.toFixed(2),reductionPercent:+((1-after/before)*100).toFixed(1),baselineRowScans:samples.find(s=>s.variant==='baseline').scenarios[scenario].rowIndexBuilds,currentRowScans:samples.find(s=>s.variant==='current').scenarios[scenario].rowIndexBuilds};
}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/dom-performance.json',JSON.stringify({baselineRef,baselineCommit,note:'Seven alternating samples per version; 8,000 records per scenario, 160 real rows, three subscribers. Dispatch-only fixture, not whole-page or live Kick CPU.',summary,samples},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
