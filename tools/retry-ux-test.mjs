import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
const engine=process.env.KR_ENGINE||'chromium',browser=await (engine==='firefox'?firefox:chromium).launch({headless:true});
try{
  const page=await browser.newPage();
  await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:'<div id="chatroom-messages"><div data-index="0"><a href="https://x.com/creator/status/2114650564600688817">Post</a></div></div>'}));
  await page.goto('https://kick.com/example');
  await page.evaluate(()=>{window.messages=[];window.chrome={runtime:{sendMessage:async message=>{messages.push(message);if(message.type==='immersion:preview-cancel')return {ok:true};if(!message.retry)return {ok:false};return new Promise(resolve=>window.retryReply=resolve);}}};});
  for(const name of ['shared','dom','x-post-data','x-posts'])await page.addScriptTag({path:`extension/${name}.js`});
  await page.evaluate(()=>window.posts=KickRefinedX.create());
  const retry=page.locator('.kr-x-post .retry');await retry.waitFor();
  await retry.focus();await retry.press('Enter');assert.equal(await retry.isDisabled(),true);
  assert.equal(await page.locator('.kr-x-post .card').getAttribute('aria-busy'),'true');
  await page.evaluate(()=>retryReply({ok:true,post:KickRefinedXData.metadata({code:200,tweet:{id:'2114650564600688817',text:'Recovered post',author:{screen_name:'creator',name:'Creator'}}},KickRefinedXData.parse('https://x.com/creator/status/2114650564600688817'))}));
  await page.locator('.kr-x-post').getByText('Recovered post',{exact:true}).waitFor();
  assert.equal(await page.locator('.kr-x-post').evaluate(host=>host.shadowRoot.activeElement?.tagName),'A','keyboard focus survives recovery');
  await page.evaluate(()=>{posts.destroy();const row=document.querySelector('[data-index]');row.innerHTML='<a href="https://x.com/creator/status/2114650564600688817">Post</a>';posts=KickRefinedX.create();});
  await retry.waitFor();await retry.click();
  await page.locator('[data-index]').evaluate(row=>row.remove());
  await page.waitForFunction(()=>messages.some(message=>message.type==='immersion:preview-cancel'));
  assert.equal(await page.evaluate(()=>messages.find(message=>message.type==='immersion:preview-cancel').requestId),await page.evaluate(()=>messages.filter(message=>message.type==='immersion:x-post').at(-1).requestId));
  await page.evaluate(()=>{retryReply({ok:false,cancelled:true});posts.destroy();});
  await page.addScriptTag({path:'extension/channel-library.js'});
  await page.evaluate(()=>{window.failWatch=true;const library=KickRefinedChannelLibrary.create({onWatch:async()=>!failWatch});document.body.append(library.host);library.update({slug:'example',tab:'videos'},[{key:'vod:test',type:'vod',title:'Video',href:'https://kick.com/example/videos/test',views:0,duration:60,created:1,order:0}]);});
  const watch=page.locator('#kr-channel-library').getByRole('button',{name:'Watch together: Video',exact:true}),notice=page.locator('#kr-channel-library .notice');
  await watch.click();await notice.waitFor();await page.evaluate(()=>window.failWatch=false);await watch.click();await notice.waitFor({state:'hidden'});
  console.log(`${engine}: Retry focus/loading, removed-message cancellation and stale watch-error recovery passed`);
}finally{await browser.close();}
