import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL,location:{origin:'https://kick.com'}});vm.runInContext(await readFile(new URL('../extension/clip-history.js',import.meta.url),'utf8'),context);
const {recording,seconds,time,thumbnail,zoomAt}=context.KickRefinedClipHistory;
test('historical sources accept only same-streamer Kick recordings',()=>{
 const id='12345678-1234-1234-1234-123456789abc';assert.equal(recording('https://www.kick.com/alpha/videos/'+id+'?t=10','alpha').href,'https://kick.com/alpha/videos/'+id);
 for(const value of ['https://kick.com.evil.test/alpha/videos/'+id,'https://user:pass@kick.com/alpha/videos/'+id,'https://kick.com/beta/videos/'+id,'https://kick.com/alpha/videos/nope','http://kick.com/alpha/videos/'+id])assert.equal(recording(value,'alpha'),null);
 assert.equal(seconds('2:13:42'),8022);assert.equal(seconds('15:30'),930);assert.equal(seconds('5:80'),null);assert.equal(seconds('NaN'),null);assert.equal(time(8022),'2:13:42');
});
test('timeline thumbnails use actual Kick replay sheets and bounded cells',()=>{
 const base='https://stream.kick.com/path/media/hls/master.m3u8';const first=thumbnail(base,3600,10800);assert.equal(first.href,'https://stream.kick.com/path/media/thumbnails/thumbnail-sheet-0.webp');assert.equal(Math.abs(first.x),0);assert.equal(first.y,-1212);
 assert.equal(thumbnail('https://evil.test/media/hls/master.m3u8',0,10800),null);assert.equal(thumbnail(base,Infinity,10800),null);assert.equal(thumbnail(base,0,Infinity),null);
 const template='https://stream.kick.com/current/media/thumbnails/thumbnail-sheet-{index}.webp?token=keep';
 const later=thumbnail(template,18061,30000);assert.equal(later.href,'https://stream.kick.com/current/media/thumbnails/thumbnail-sheet-1.webp?token=keep');assert.equal(later.x,-180);assert.equal(later.y,-1010);
 assert.equal(thumbnail(template.replace('{index}','%7Bindex%7D'),18061,30000).href,later.href);
 assert.equal(thumbnail('https://stream.kick.com/current/media/thumbnails/thumbnail-sheet-0.webp?token=keep',18061,30000).href,later.href,'rendered native sheet URLs can navigate to later sheets');
 assert.equal(thumbnail('https://stream.kick.com/unrelated/{index}.webp',0,100),null);
});
test('wheel zoom keeps the timestamp under the cursor fixed and clamps at stream edges',()=>{
 for(const ratio of [0,.2,.75,1]){const view=zoomAt(3600,600,30000,-160,ratio);assert.ok(view.size<600);assert.ok(Math.abs(view.start+ratio*view.size-(3600+ratio*600))<.001);}
 const left=zoomAt(0,120,30000,400,0);assert.equal(left.start,0);
 const full=zoomAt(1000,5000,6000,400,.5);assert.equal(full.start,0);assert.equal(full.size,6000);
 let view={start:0,size:30000};for(let i=0;i<40;i++)view=zoomAt(view.start,view.size,30000,-400,.5);assert.equal(view.size,20);assert.ok(view.start>=0&&view.start+view.size<=30000);
 assert.equal(zoomAt(0,NaN,30000,10,.5),null);
});
test('native clip bridge validates the frame route and source position without publishing',async()=>{
 let listener;const requests=[];class Node{constructor(start){this.id='kr-clip-native-request';this.dataset={start};}}
 const bridge=vm.createContext({window:{name:'kick-refined-clip:alpha',top:{},dispatchEvent:event=>requests.push(event)},location:{pathname:'/alpha/videos/12345678-1234-1234-1234-123456789abc'},document:{addEventListener:(_,fn)=>listener=fn},HTMLElement:Node,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 vm.runInContext(await readFile(new URL('../extension/clip-native-bridge.js',import.meta.url),'utf8'),bridge);
 for(const value of ['NaN','Infinity','-1','999999999'])listener({target:new Node(value),preventDefault(){throw Error('Invalid requests must not be accepted');}});
 let accepted=false;listener({target:new Node('7200'),preventDefault(){accepted=true;}});assert.equal(accepted,true);assert.equal(requests.length,1);assert.equal(requests[0].type,'openClipCreator');assert.equal(requests[0].detail.mode,'vod');assert.equal(requests[0].detail.startTime,7350);
});
