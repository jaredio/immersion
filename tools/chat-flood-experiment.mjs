/* Local-only flood experiment: native insertion/typography and eventual previews. */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const name=process.env.KR_ENGINE||'chromium',browser=await ({chromium,firefox}[name]).launch({headless:true}),results=[];
try{
 for(let repeat=0;repeat<3;repeat++)for(const enabled of repeat%2?[true,false]:[false,true]){
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html data-kr-enabled="true" data-kr-performance="true"><head><style>body{background:#09090b;color:#ededf5;font:14px/1.5 Inter,system-ui,sans-serif}#channel-chatroom{width:340px}#chatroom-messages{height:650px;overflow:auto}[data-index]{padding:4px;overflow-wrap:anywhere}.username{font:600 14px/1.5 Inter,system-ui,sans-serif;color:#f2708a;border:0;background:transparent;padding:0}.text{font-weight:400}.emote{width:24px;height:24px;vertical-align:middle}</style></head><body><aside id="channel-chatroom"><div id="chatroom-messages"></div></aside></body></html>'}));
  await page.goto('https://kick.com/creator');for(const file of ['theme.css','polish.css'])await page.addStyleTag({path:'extension/'+file});
  await page.evaluate(enabled=>{document.documentElement.dataset.krFastChat=String(enabled);window.chrome={runtime:{sendMessage:async()=>({ok:false})}};},enabled);
  for(const file of ['performance','shared','dom','chat-clips','x-post-data','x-posts','media-data','media-embeds'])await page.addScriptTag({path:`extension/${file}.js`});
  await page.evaluate(()=>{KickRefinedPerf.configure(true);window.controllers=[KickRefinedClips.create(),KickRefinedX.create(),KickRefinedMedia.create({media:true,profiles:true})];});
  const result=await page.evaluate(async()=>{
   const list=document.getElementById('chatroom-messages'),seen=[],frames=[],arrival=[];let running=true,last=performance.now(),immediate=true;
   const emote='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="9" fill="#b0ff8c"/></svg>');
   function paint(now){frames.push(now-last);last=now;if(running)requestAnimationFrame(paint);}requestAnimationFrame(paint);
   for(let batch=0;batch<100;batch++){
    for(let j=0;j<12;j++){
     const id=batch*12+j,row=document.createElement('div');row.dataset.index=String(id);
     const user=document.createElement('button');user.className='username';user.textContent='Viewer'+id%50;
     const text=document.createElement('span');text.className='text';text.textContent=' Message '+id+' ';const image=document.createElement('img');image.className='emote';image.alt='emote';image.src=emote;row.append(user,text,image);
     if(id%20===0){row.dataset.withLink='true';const link=document.createElement('a');link.textContent=' Link';link.href=id%60===0?'https://kick.com/creator/clips/clip_'+String(id).padStart(26,'0'):id%60===20?'https://x.com/viewer/status/'+(100000000000000000n+BigInt(id)):'https://www.youtube.com/watch?v=video'+String(id).padStart(6,'0');row.append(link);}
     const at=performance.now();list.append(row);arrival.push(performance.now()-at);immediate&&=row.isConnected&&row.textContent.includes('Message '+id+' ');seen.push(id);
    }
    while(list.children.length>160)list.firstElementChild.remove();list.scrollTop=list.scrollHeight;
    await new Promise(resolve=>setTimeout(resolve,8));
   }
   running=false;const user=list.querySelector('.username'),text=list.querySelector('.text'),style=node=>{const css=getComputedStyle(node);return {font:css.font,color:css.color,lineHeight:css.lineHeight,letterSpacing:css.letterSpacing};};
   const sorted=values=>[...values].sort((a,b)=>a-b),p95=values=>sorted(values)[Math.floor(values.length*.95)]||0;
   return {total:seen.length,immediate,arrivalP95Ms:p95(arrival),frameP95Ms:p95(frames),frameMaxMs:Math.max(...frames),styles:{username:style(user),message:style(text)},last:list.lastElementChild.dataset.index};
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-with-link]')].every(row=>row.querySelector('.kr-chat-clip,.kr-x-post,.kr-media-embed')),{},{timeout:15000});
  const data=await page.evaluate(()=>KickRefinedPerf.snapshot());assert.equal(result.total,1200);assert.equal(result.immediate,true,'every native message is inserted synchronously');assert.equal(result.last,'1199');
  await page.evaluate(()=>controllers.forEach(controller=>controller.destroy()));assert.equal(await page.locator('.kr-chat-clip,.kr-x-post,.kr-media-embed').count(),0);assert.deepEqual(errors,[]);
  results.push({repeat,experimental:enabled,...result,diagnostics:data});await page.screenshot({path:`artifacts/${name}-chat-flood-${enabled?'experimental':'normal'}.png`});await page.close();
 }
 for(const result of results)assert.deepEqual(result.styles,results[0].styles,'experimental scheduling never changes username or message typography');
 await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/${name}-chat-flood.json`,JSON.stringify({note:'Synthetic native DOM fixture; does not model Kick server delivery or all React rendering costs.',results},null,2));
 console.log(JSON.stringify({engine:name,results:results.map(({experimental,total,immediate,arrivalP95Ms,frameP95Ms,frameMaxMs,diagnostics})=>({experimental,total,immediate,arrivalP95Ms,frameP95Ms,frameMaxMs,enhancementBatch:diagnostics.timings['chat.batchMs']}))}));
}finally{await browser.close();}
