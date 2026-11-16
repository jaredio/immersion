import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('extension/multi-fullscreen.js','utf8');
function setup(){
 let next=0,clock=0;const frames=new Map(),shadow={fullscreenElement:null},changes=[],errors=[];
 const document={exitFullscreen:async()=>{shadow.fullscreenElement=null;}};
 const context=vm.createContext({document,performance:{now:()=>clock},requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id)});vm.runInContext(source,context);
 const helper=context.KickRefinedMultiFullscreen.create({shadow,onChange:(tile,locked,scale)=>changes.push({tile,locked,scale}),onError:error=>errors.push(error)});
 const values=new Map([['width',{value:'100%',priority:'important'}]]),style={getPropertyValue:key=>values.get(key)?.value||'',getPropertyPriority:key=>values.get(key)?.priority||'',setProperty:(key,value,priority)=>values.set(key,{value,priority}),removeProperty:key=>values.delete(key),get transform(){return values.get('transform')?.value||'';}};
 const card={dataset:{},requestFullscreen:async()=>{shadow.fullscreenElement=card;}},frame={clientWidth:640,clientHeight:360,isConnected:true,style},player={getBoundingClientRect:()=>({width:1920,height:1080})},tile={card,frame,player};
 return {helper,shadow,changes,errors,frames,card,frame,tile,values,frameTick(){clock+=17;const entry=frames.entries().next().value;if(entry){frames.delete(entry[0]);entry[1]();}}};
}
test('fullscreen locks the original viewport and restores inline values and priorities on exit',async()=>{
 const s=setup();await s.helper.toggle(s.tile,{width:640,height:360});assert.equal(s.frame.style.getPropertyValue('width'),'640px');assert.equal(s.frame.style.getPropertyValue('height'),'360px');assert.equal(s.shadow.fullscreenElement,s.card);assert.equal(s.changes.at(-1).scale,3);
 s.shadow.fullscreenElement=null;s.helper.changed();while(s.frames.size)s.frameTick();assert.equal(s.frame.style.getPropertyValue('width'),'100%');assert.equal(s.frame.style.getPropertyPriority('width'),'important');assert.equal(s.frame.style.getPropertyValue('height'),'');assert.equal(s.card.dataset.krViewportLocked,undefined);assert.equal(s.changes.at(-1).locked,false);
});
test('failed fullscreen requests release the viewport lock and report the failure',async()=>{
 const s=setup();s.card.requestFullscreen=()=>Promise.reject(Error('Denied'));await s.helper.toggle(s.tile);assert.equal(s.errors.length,1);assert.equal(s.changes.at(-1).locked,false);assert.equal(s.frame.style.getPropertyValue('width'),'100%');assert.equal(s.card.dataset.krViewportLocked,undefined);
});
test('closing while a request is pending prevents late callbacks from reapplying styles',async()=>{
 const s=setup();let finish;s.card.requestFullscreen=()=>new Promise(resolve=>finish=resolve);const pending=s.helper.toggle(s.tile);s.helper.close();finish();await pending;assert.equal(s.frame.style.getPropertyValue('width'),'100%');assert.equal(s.frames.size,0);assert.equal(s.changes.at(-1).locked,false);
});
test('removing the stream during fullscreen releases its lock and pending settlement frames',async()=>{
 const s=setup();await s.helper.toggle(s.tile);s.shadow.fullscreenElement=null;s.helper.changed();assert.ok(s.frames.size);s.helper.forget(s.tile);assert.equal(s.frames.size,0);assert.equal(s.frame.style.getPropertyValue('width'),'100%');assert.equal(s.changes.at(-1).locked,false);
});
test('untrusted viewport dimensions cannot create oversized or invalid inline geometry',async()=>{
 const s=setup();await s.helper.toggle(s.tile,{width:Infinity,height:-1});assert.equal(s.frame.style.getPropertyValue('width'),'640px');assert.equal(s.frame.style.getPropertyValue('height'),'360px');s.helper.close();
});

test('fullscreen window resizes change only the display scale and keep the media viewport fixed',async()=>{
 const s=setup();await s.helper.toggle(s.tile);s.tile.player.getBoundingClientRect=()=>({width:1280,height:720});s.helper.refresh();assert.equal(s.changes.at(-1).scale,2);assert.equal(s.frame.style.getPropertyValue('width'),'640px');assert.equal(s.frame.style.getPropertyValue('height'),'360px');s.helper.close();
});

test('repeated Escape exit requests cannot reopen a fullscreen pane',async()=>{
 const s=setup();let requests=0;s.card.requestFullscreen=async()=>{requests++;s.shadow.fullscreenElement=s.card;};await s.helper.toggle(s.tile);await s.helper.exit(s.tile);await s.helper.exit(s.tile);assert.equal(s.shadow.fullscreenElement,null);assert.equal(requests,1);s.helper.changed();while(s.frames.size)s.frameTick();assert.equal(s.card.dataset.krViewportLocked,undefined);
});
