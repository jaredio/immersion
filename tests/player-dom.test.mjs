import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('player subscribers share one observer and ignore chat, text and owned chrome changes',async()=>{
  let dispatch,options,observes=0,disconnects=0;const calls=[];
  const context=vm.createContext({document:{},MutationObserver:class{constructor(cb){dispatch=cb;}observe(_document,config){options=config;observes++;}disconnect(){disconnects++;}}});
  vm.runInContext(await readFile('extension/player-dom.js','utf8'),context);
  assert.equal(observes,0,'loading the module does not observe a top-level page');
  const api=context.KickRefinedPlayerDOM;
  const a=api.subscribe(()=>calls.push('isolation')),b=api.subscribe(()=>calls.push('playback'));
  assert.equal(observes,1);
  const element={nodeType:1,matches:()=>false},text={nodeType:3};
  dispatch([{target:{closest:()=>({})},addedNodes:[element],removedNodes:[]}]);
  dispatch([{target:{},addedNodes:[text],removedNodes:[]}]);assert.deepEqual(calls,[]);
  dispatch([{target:{},addedNodes:[element],removedNodes:[]}]);assert.deepEqual(calls,['isolation','playback']);
  assert.deepEqual([...options.attributeFilter],['data-kr-full-player-root']);
  dispatch([{target:{},type:'attributes'}]);assert.deepEqual(calls,['isolation','playback','isolation','playback']);
  a();assert.equal(disconnects,0);b();assert.equal(disconnects,1);
});

test('full-player isolation updates changed siblings, exposes late portals, and rediscovers replaced players',async()=>{
  let notify,lookups=0;
  const timers=[];
  function element(tag,role){
    const attrs=new Set();
    return {tag,role,nodeType:1,parentElement:null,children:[],
      get firstElementChild(){return this.children[0];},
      get isConnected(){return this.closest('html')!==null;},
      append(node){this.children.push(node);node.parentElement=this;return node;},
      remove(node){this.children.splice(this.children.indexOf(node),1);node.parentElement=null;return node;},
      matches(selector){
        return selector===tag||selector==='script,style,link,meta'&&tag==='style'||
          selector.includes('#video-player')&&tag==='player'||selector.includes('[role="dialog"]')&&role==='dialog';
      },
      closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;},
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
      querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);},
      contains(target){for(let node=target;node;node=node.parentElement)if(node===this)return true;return false;},
      dispatchEvent(){return true;},
      setAttribute(name){attrs.add(name);},removeAttribute(name){attrs.delete(name);},hasAttribute(name){return attrs.has(name);}
    };
  }
  const html=element('html'),head=html.append(element('head')),body=html.append(element('body')),main=body.append(element('main'));
  const first=main.append(element('div')),player=first.append(element('player')),shell=player.append(element('div'));shell.append(element('video'));
  const original=main.append(element('aside'));
  const document={documentElement:html,head,body,createElement:element,querySelectorAll(selector){lookups++;return html.querySelectorAll(selector);}};
  const context=vm.createContext({document,Event,window:{name:'kick-refined-full:demo',top:{},addEventListener(){}},
    location:{hostname:'kick.com',pathname:'/demo'},KickRefinedPlayerDOM:{subscribe(fn){notify=fn;}},
    setTimeout(fn){timers.push(fn);return timers.length;}});
  vm.runInContext(await readFile('extension/full-player-frame.js','utf8'),context);
  assert.ok(first.hasAttribute('data-kr-full-player-root'));
  assert.ok(shell.hasAttribute('data-kr-full-video-shell'));
  assert.ok(original.hasAttribute('data-kr-full-hidden'));
  const change=(target,addedNodes=[],removedNodes=[])=>{notify([{type:'childList',target,addedNodes,removedNodes}]);while(timers.length)timers.shift()();};
  const added=main.append(element('aside'));change(main,[added]);
  assert.ok(added.hasAttribute('data-kr-full-hidden'));
  const dialog=added.append(element('div','dialog'));change(added,[dialog]);
  assert.equal(added.hasAttribute('data-kr-full-hidden'),false);
  change(added,[],[added.remove(dialog)]);
  assert.ok(added.hasAttribute('data-kr-full-hidden'));
  assert.equal(lookups,1,'sibling and nested portal changes reuse the isolated root');
  const newRoot=main.append(element('div')),newPlayer=newRoot.append(element('player'));
  newPlayer.append(element('video'));
  change(main,[newRoot],[main.remove(first)]);
  assert.equal(lookups,2);
  assert.ok(newRoot.hasAttribute('data-kr-full-player-root'));
  assert.equal(first.hasAttribute('data-kr-full-player-root'),false);
  assert.equal(shell.hasAttribute('data-kr-full-video-shell'),false);
});
