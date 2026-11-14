import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
const engine=process.env.KR_ENGINE||'chromium',browser=await (engine==='firefox'?firefox:chromium).launch({headless:true});
try{
  const page=await browser.newPage();
  await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
  await page.goto('https://kick.com/example');
  await page.setContent('<div id="unrelated">Other content</div><aside id="ancestor"><div id="chatroom-messages" style="height:500px;width:350px"><div data-index="0"><button class="text-white/40"><span><span>alice</span><span class="inline">Original message</span></span></button></div><div data-index="1" id="other-message">Another message</div></div></aside>');
  await page.evaluate(()=>{
    const Original=MutationObserver;window.replyMutations=0;window.replyObservations=[];
    window.MutationObserver=class extends Original{constructor(callback){super(records=>{replyMutations++;callback(records);});}observe(target,options){replyObservations.push({target:target.nodeName,...options});return super.observe(target,options);}};
  });
  await page.addScriptTag({path:'extension/reply-preview.js'});
  await page.evaluate(()=>window.replies=KickRefinedReplies.create());
  const trigger=page.locator('button'),tooltip=page.locator('.kr-reply-preview');
  await trigger.focus();await tooltip.waitFor();
  await page.waitForTimeout(30);const before=await page.evaluate(()=>replyMutations);
  await page.evaluate(()=>{document.getElementById('unrelated').firstChild.textContent='Changed';document.getElementById('other-message').firstChild.textContent='Another change';});
  await page.waitForTimeout(30);
  assert.equal(await page.evaluate(()=>replyMutations),before,'unrelated text changes do not invoke the preview observer');
  assert.equal(await page.evaluate(()=>replyObservations.some(item=>item.target==='HTML'&&item.subtree)),false,'no document-wide subtree observation');
  await trigger.locator('.inline').evaluate(node=>node.textContent='Updated original');await tooltip.waitFor({state:'detached'});
  const focus=async()=>{await trigger.evaluate(node=>node.blur());await trigger.focus();await tooltip.waitFor();};
  await focus();await page.locator('[data-index="0"]').evaluate(node=>node.dataset.index='2');await tooltip.waitFor({state:'detached'});
  await focus();await page.locator('#ancestor').evaluate(node=>node.remove());await tooltip.waitFor({state:'detached'});
  await page.evaluate(()=>replies.destroy());
  console.log(`${engine}: reply preview ignores unrelated text and closes on edits, row reuse and ancestor removal`);
}finally{await browser.close();}
