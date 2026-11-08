/* Real MutationObserver regression: sharing, filtering, replacement and disposal. */
import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';

const engine=process.env.KR_ENGINE==='firefox'?firefox:chromium;
const browser=await engine.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.setContent('<main><div id="chatroom-messages"></div><section id="outside"></section></main>');
  await page.evaluate(()=>{
    const Native=window.MutationObserver;window.domObservers=[];
    window.MutationObserver=class extends Native{
      constructor(callback){super(callback);this.targets=new Set();this.owner=callback.name;domObservers.push(this);}
      observe(target,options){super.observe(target,options);this.targets.add(target);}
      disconnect(){super.disconnect();this.targets.clear();}
    };
  });
  await page.addScriptTag({path:'extension/dom.js'});
  await page.evaluate(()=>{
    window.log={pages:0,containers:[[],[],[]],changes:[0,0,0]};
    window.stopPage=KickRefinedDOM.subscribePage(()=>log.pages++);
    window.clients=[0,1,2].map(index=>KickRefinedDOM.subscribeChat({
      onContainer:node=>log.containers[index].push(node?.id||null),
      onMutations:records=>log.changes[index]+=records.length,
      attributes:index===0?['href','src','data-index']:['href','data-index']
    }));
    clients.forEach(client=>client.setEnabled(true));
  });
  const active=()=>page.evaluate(()=>domObservers.filter(observer=>observer.targets.size&&['dispatchPage','dispatchChat'].includes(observer.owner)).length);
  assert.equal(await active(),2,'three features share one document and one chat observer');
  await page.addScriptTag({path:'extension/dom.js'});
  assert.equal(await page.evaluate(()=>domObservers.filter(observer=>['dispatchPage','dispatchChat'].includes(observer.owner)).length),2,'repeated script loading retains the same subscription service');
  await page.waitForTimeout(30);
  const before=await page.evaluate(()=>log.pages);
  await page.evaluate(()=>{const row=document.createElement('div');row.dataset.index='1';row.innerHTML='<a href="https://example.com">link</a><img>';document.getElementById('chatroom-messages').append(row);});
  await page.waitForFunction(()=>log.changes.every(count=>count>0));
  assert.equal(await page.evaluate(()=>log.pages),before,'message arrival does not invoke page subscribers');
  const previous=await page.evaluate(()=>[...log.changes]);
  await page.evaluate(()=>document.querySelector('#chatroom-messages img').setAttribute('src','data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'));
  await page.waitForFunction(count=>log.changes[0]>count,previous[0]);
  assert.deepEqual(await page.evaluate(()=>log.changes.slice(1)),previous.slice(1),'each feature receives only its requested attributes');
  await page.evaluate(()=>clients[1].setEnabled(false));
  const disabled=await page.evaluate(()=>log.changes[1]);
  await page.evaluate(()=>document.querySelector('#chatroom-messages a').href='https://example.org');
  await page.waitForFunction(count=>log.changes[2]>count,previous[2]);
  assert.equal(await page.evaluate(()=>log.changes[1]),disabled);
  await page.evaluate(()=>{
    document.getElementById('chatroom-messages').id='old-chat';
    const next=document.createElement('div');next.id='late-chat';document.querySelector('main').prepend(next);
  });
  await page.waitForFunction(()=>KickRefinedDOM.chat===null);
  await page.evaluate(()=>document.getElementById('late-chat').id='chatroom-messages');
  await page.waitForFunction(()=>KickRefinedDOM.chat===document.getElementById('chatroom-messages'));
  assert.equal(await page.locator('#old-chat').count(),1,'replacement is detected while the old container remains mounted');
  await page.evaluate(()=>{clients[1].setEnabled(true);clients.forEach(client=>client.destroy());stopPage();});
  assert.equal(await active(),0,'last unsubscribe disconnects both observers');
  assert.equal(await page.evaluate(()=>KickRefinedDOM.chat),null);
  console.log(`${engine.name()}: two shared observers, message isolation, per-feature filters, toggles, retained-container replacement and disposal passed`);
}finally{await browser.close();}
