import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('queued fallback preserves a pending pause and cancels the old mount without retaining resources',async()=>{
  const root={activeElement:null};
  class Node extends EventTarget{
    constructor(){super();this.dataset={};this.children=[];}
    setAttribute(){}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this.append(...children);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
    getRootNode(){return root;}
    focus(){root.activeElement=this;}
    querySelector(){return title;}
  }
  const title=new Node(),jobs=[],canceled=[];
  const context=vm.createContext({setTimeout,clearTimeout,document:{createElement:()=>new Node()},location:{origin:'https://kick.com'}});
  for(const file of ['lifetime','player-state','multi-stream-player'])vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),context);
  const tile={slug:'waiting',card:new Node(),player:new Node(),scope:context.KickRefinedLifetime.create(),lifecycle:context.KickRefinedPlayerState.create(),pendingAction:'pause',playing:false,everLoaded:false};
  const service=context.KickRefinedMultiStreamPlayer.create({
    startup:{enqueue:job=>{jobs.push(job);return job;},cancel:job=>{if(job)canceled.push(job);},complete(){}},
    bus:{attach(){},detach(){}},resize:{observe(){}},isNative:()=>false,isCurrent:()=>true,
    getMode:tile=>tile.embedFallback?'embed':'full',priority:()=>1,command(){},isMuted:()=>true,onRemount(){},onState(){}
  });
  service.mount(tile);assert.equal(tile.lifecycle.phase,'queued');assert.equal(tile.frame,undefined);
  const fallback=tile.loading.children[1];fallback.focus();fallback.dispatchEvent(new Event('click'));
  assert.equal(tile.frameMode,'embed');assert.equal(tile.pendingAction,'pause','the user request wins over default autoplay');
  assert.equal(canceled[0],jobs[0]);assert.equal(root.activeElement,title);
  const frame=tile.frame;jobs[0].start();assert.equal(tile.frame,frame,'a canceled job cannot replace the embed');
  service.drop(tile);tile.embedFallback=false;service.mount(tile);jobs[1].start();
  tile.frame.dispatchEvent(new Event('error'));assert.equal(tile.retry.hidden,false);
  tile.retry.focus();tile.retry.dispatchEvent(new Event('click'));
  assert.equal(root.activeElement,title,'keyboard focus survives retrying a failed full page');
  assert.equal(tile.lifecycle.phase,'retrying');assert.equal(tile.pendingAction,'pause');
  service.drop(tile);tile.scope.dispose();
  assert.equal(context.KickRefinedLifetime.snapshot().scopes,0);assert.equal(context.KickRefinedLifetime.snapshot().resources,0);
});
