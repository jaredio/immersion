/* Exercise Chrome's actual rule matcher; no requests to third-party trackers. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

const extension=path.resolve('dist/chrome');
const context=await chromium.launchPersistentContext(path.resolve('tmp/privacy-test-profile'),{
  executablePath:chromium.executablePath(),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
});
try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({settings:{}}));
  const enabled=()=>worker.evaluate(()=>chrome.declarativeNetRequest.getEnabledRulesets());
  const waitEnabled=async expected=>{for(let i=0;i<50;i++){if((await enabled()).includes('kick-telemetry')===expected)return;await new Promise(resolve=>setTimeout(resolve,50));}assert.fail('Telemetry preference did not apply');};
  await waitEnabled(true);
  const matches=(url,initiator='https://kick.com',type='xmlhttprequest')=>worker.evaluate(async({url,initiator,type})=>(await chrome.declarativeNetRequest.testMatchOutcome({url,initiator,type})).matchedRules.length,{url,initiator,type});
  for(const url of ['https://www.google-analytics.com/g/collect','https://www.googletagmanager.com/gtag/js?id=test','https://analytics.tiktok.com/api/v2/pixel','https://www.facebook.com/tr/?id=test','https://www.datadoghq-browser-agent.com/us1/v6/datadog-rum.js']){
    assert.ok(await matches(url),'observed telemetry is blocked');
    assert.equal(await matches(url,'https://example.com'),0,'other sites are unaffected');
    assert.equal(await matches(url,'https://kick.com','main_frame'),0,'direct navigation is unaffected');
    assert.ok(await matches(url,'https://player.kick.com'),'player frames are covered');
  }
  for(const url of ['https://web.kick.com/api/v1/analytics/leaderboard','https://kick.com/api/v2/channels/xqc','https://websockets.kick.com/connection','https://www.google.com/recaptcha/enterprise.js','https://js.stripe.com/v3/','https://cdn-au.onetrust.com/consent.js','https://prod.ivs-device-config.live-video.net/config','https://example.playback.live-video.net/stream.m3u8','https://www.youtube.com/oembed?url=test','https://www.tiktok.com/player/v1/123'])assert.equal(await matches(url),0,`functional endpoint remains available: ${url}`);
  await worker.evaluate(()=>chrome.storage.local.set({settings:{blockTelemetry:false}}));await waitEnabled(false);
  assert.equal(await matches('https://www.google-analytics.com/g/collect'),0);
  await worker.evaluate(()=>chrome.storage.local.set({settings:{enabled:false}}));await waitEnabled(false);
  await worker.evaluate(()=>chrome.storage.local.set({settings:{}}));await waitEnabled(true);
  console.log('Chromium: telemetry blocking, Kick-only scope, functional endpoints and settings toggles passed');
}finally{await context.close();}
