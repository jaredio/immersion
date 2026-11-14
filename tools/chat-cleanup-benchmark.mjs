import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const results=[];
try{
  for(const feature of ['x','media','clip']){
    const page=await browser.newPage();
    await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:'<div id="chatroom-messages"></div>'}));
    await page.goto('https://kick.com/example');
    await page.evaluate(()=>{
      window.counts={};window.KickRefinedPerf={count:(key,n=1)=>counts[key]=(counts[key]||0)+n,sample(){}};
      window.chrome={runtime:{sendMessage:async()=>({ok:false})}};
      const list=document.getElementById('chatroom-messages');
      for(let i=0;i<60;i++){const row=document.createElement('div');row.dataset.index=i;list.append(row);}
    });
    for(const name of ['shared','dom','x-post-data','x-posts',...(feature==='media'?['media-data','media-embeds']:feature==='clip'?['chat-clips']:[])])await page.addScriptTag({path:`extension/${name}.js`});
    await page.evaluate(feature=>{
      const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      document.querySelectorAll('[data-index]').forEach((row,i)=>{const link=document.createElement('a');link.href=feature==='x'?`https://x.com/example/status/${100000000000000000n+BigInt(i)}`:feature==='clip'?`https://kick.com/example/clips/clip_01M5VG3B8WEFY068DP0GCHKS${alphabet[Math.floor(i/32)]}${alphabet[i%32]}`:`https://www.youtube.com/watch?v=example${String(i).padStart(4,'0')}`;link.textContent='Preview';row.append(link);});
      window.feature=feature==='x'?KickRefinedX.create({enabled:true}):feature==='clip'?KickRefinedClips.create({enabled:true}):KickRefinedMedia.create({media:true,profiles:false});
    },feature);
    await page.waitForTimeout(600);
    const hosts=await page.locator(feature==='x'?'.kr-x-post':feature==='clip'?'.kr-chat-clip':'.kr-media-embed').count();
    if(hosts!==60)throw Error(`Expected 60 ${feature} previews, received ${hosts}`);
    const metric=`chat.${feature}RecordsChecked`,before=await page.evaluate(metric=>counts[metric]||0,metric);
    for(let i=0;i<20;i++){await page.locator('[data-index]').first().evaluate((row,i)=>row.dataset.index=String(1000+i),i);await page.waitForTimeout(85);}
    await page.waitForTimeout(100);
    results.push({feature,retainedPreviews:hosts,changedRows:20,recordsChecked:await page.evaluate(({metric,before})=>(counts[metric]||0)-before,{metric,before})});
    await page.close();
  }
}finally{await browser.close();}
await mkdir('artifacts',{recursive:true});
const label=process.env.KR_BENCH_NAME||'chat-cleanup';
if(!/^[a-z0-9_-]+$/i.test(label))throw Error('Invalid report name');
await writeFile(`artifacts/${label}.json`,JSON.stringify(results,null,2)+'\n');
console.log(results);
