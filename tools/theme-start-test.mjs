import playwright from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const engine=process.env.KR_ENGINE||'chromium',browser=await playwright[engine].launch({headless:true});
const script=await readFile('extension/theme-start.js','utf8');
try{
  for(const settings of [{enabled:true,accent:'violet',chatWidth:400,fontSize:16},{enabled:false,accent:'blue'}]){
    const context=await browser.newContext();
    await context.addInitScript({content:`window.chrome={storage:{local:{get:async()=>({settings:${JSON.stringify(settings)}})}}};\n${script}`});
    let release;const gate=new Promise(resolve=>release=resolve);
    await context.route('https://kick.com/**',async route=>{
      if(new URL(route.request().url()).pathname==='/slow.js'){await gate;return route.fulfill({body:'window.parserFinished=true',contentType:'application/javascript'});}
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><script src="/slow.js"></script></head><body>Kick</body></html>'});
    });
    const page=await context.newPage();await page.goto('https://kick.com/test',{waitUntil:'commit'});
    try{
      await page.waitForFunction(()=>document.documentElement?.dataset.krEnabled!==undefined);
      const state=await page.evaluate(()=>({ready:document.readyState,enabled:document.documentElement.dataset.krEnabled,accent:document.documentElement.dataset.krAccent,width:document.documentElement.style.getPropertyValue('--kr-chat-width')}));
      assert.equal(state.ready,'loading','theme preferences apply while the native parser is still blocked');
      assert.equal(state.enabled,String(settings.enabled));assert.equal(state.accent,settings.accent);
      assert.equal(state.width,`${settings.chatWidth||340}px`);
    }finally{release();await context.close();}
  }
  console.log(`${engine}: saved theme applies before DOMContentLoaded; disabled preference is respected`);
}finally{await browser.close();}
