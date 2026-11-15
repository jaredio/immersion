/* Real card construction with local data; does not measure Kick network or video. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const baselineRef=process.env.KR_BENCH_REF||'HEAD';
if(!/^(?:[a-f0-9]{7,40}|HEAD(?:~\d+)?)$/i.test(baselineRef))throw Error('Invalid baseline ref');
const gitArgs=['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`];
const baselineCommit=execFileSync('git',[...gitArgs,'rev-parse',baselineRef],{encoding:'utf8',windowsHide:true}).trim();
const baseline=execFileSync('git',[...gitArgs,'show',`${baselineCommit}:extension/channel-library.js`],{encoding:'utf8',windowsHide:true});
const current=await readFile('extension/channel-library.js','utf8');
const browser=await chromium.launch({headless:true}),samples=[];
try{
  for(let repeat=0;repeat<7;repeat++)for(const variant of repeat%2?['current','baseline']:['baseline','current']){
    const page=await browser.newPage();
    await page.setContent('<main></main>');
    await page.evaluate(()=>{
      window.formatters=0;Intl.NumberFormat=new Proxy(Intl.NumberFormat,{construct(target,args){formatters++;return Reflect.construct(target,args);}});
    });
    await page.addScriptTag({content:variant==='baseline'?baseline:current});
    const result=await page.evaluate(()=>{
      const rows=Array.from({length:300},(_,i)=>({key:String(i),href:`https://kick.com/alpha/videos/${i}`,type:'vod',title:`Recording ${i}`,image:'',clock:'1:00',duration:60,views:12345+i,date:'today',created:i,category:'IRL',order:i}));
      const render=()=>{
        const library=KickRefinedChannelLibrary.create();document.querySelector('main').append(library.host);
        library.update({slug:'alpha',tab:'videos',catalogStatus:'ready'},rows);
        const count=library.host.shadowRoot.querySelectorAll('.card').length,example=library.host.shadowRoot.querySelector('.meta').textContent;
        library.destroy();return {count,example};
      };
      render();const before=formatters,start=performance.now();let output;
      for(let i=0;i<5;i++)output=render();
      return {ms:performance.now()-start,formatters:formatters-before,...output};
    });
    assert.equal(result.count,300);assert.match(result.example,/12\.6K views/);
    samples.push({repeat,variant,...result});await page.close();
  }
}finally{await browser.close();}
const median=variant=>samples.filter(sample=>sample.variant===variant).map(sample=>sample.ms).sort((a,b)=>a-b)[3];
const before=median('baseline'),after=median('current');
const summary={baselineMedianMs:+before.toFixed(2),currentMedianMs:+after.toFixed(2),reductionPercent:+((1-after/before)*100).toFixed(1),baselineFormatters:samples.find(s=>s.variant==='baseline').formatters,currentFormatters:samples.find(s=>s.variant==='current').formatters};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/library-performance.json',JSON.stringify({baselineRef,baselineCommit,note:'Seven alternating samples per version; five renders of 300 real cards per sample. Card construction fixture, not whole-page or live Kick CPU.',summary,samples},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
