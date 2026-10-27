import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const dataSource=await readFile(new URL('../extension/x-post-data.js',import.meta.url),'utf8');
const workerSource=await readFile(new URL('../extension/x-background.js',import.meta.url),'utf8');
const context=vm.createContext({URL});vm.runInContext(dataSource,context);
const {parse,metadata}=context.KickRefinedXData;
const id='2114650564600688817',href=`https://x.com/binji_x/status/${id}`;
const fixture={code:200,tweet:{id,text:'<img onerror=alert(1)>',author:{screen_name:'binji_x',name:'binji',avatar_url:'https://pbs.twimg.com/avatar.jpg'},likes:45,retweets:1,views:1701,media:{photos:[{url:'https://evil.test/photo'},{url:'https://pbs.twimg.com/media/photo.jpg'}]}}};
test('X URLs normalize tracking queries and reject lookalikes and non-posts',()=>{
  for(const url of [href,href+'?s=20',href+'?s=20&t=tracking',href.replace('x.com','twitter.com')])assert.equal(parse(url).href,href);
  for(const url of [href.replace('https:','http:'),href.replace('x.com','x.com.evil.test'),href.replace('x.com','user:pass@x.com'),href.replace('x.com','x.com:444'),href+'/photo/1','https://x.com/binji_x','javascript:alert(1)'])assert.equal(parse(url),null,url);
});
test('metadata validates post identity, counts, and image hosts',()=>{
  const result=metadata(fixture,parse(href));assert.equal(result.likes,45);assert.equal(result.reposts,1);assert.equal(result.views,1701);assert.equal(result.text,fixture.tweet.text);assert.deepEqual(Array.from(result.photos),['https://pbs.twimg.com/media/photo.jpg']);
  assert.throws(()=>metadata({...fixture,tweet:{...fixture.tweet,id:'12'}},parse(href)));
  const bad=metadata({...fixture,tweet:{...fixture.tweet,likes:-5,retweets:'42',views:'1701',author:{screen_name:'binji_x',avatar_url:'https://pbs.twimg.com.evil.test/img'}}},parse(href));assert.equal(bad.likes,null);assert.equal(bad.reposts,null);assert.equal(bad.views,null);assert.equal(metadata({...fixture,tweet:{...fixture.tweet,views:undefined}},parse(href)).views,null);assert.equal(metadata({...fixture,tweet:{...fixture.tweet,views:0}},parse(href)).views,0);assert.equal(bad.avatar,'');
});
test('X videos use only the native video CDN and prefer a bounded MP4 rendition',()=>{
 const item={url:'https://video.twimg.com/large.mp4',thumbnail_url:'https://pbs.twimg.com/poster.jpg',duration:15,formats:[{url:'https://video.twimg.com/large.mp4',height:1080,codec:'h264'},{url:'https://video.twimg.com/medium.mp4?tag=12',height:720,codec:'h264'},{url:'https://evil.test/video.mp4',height:720,codec:'h264'}]};
 const result=metadata({...fixture,tweet:{...fixture.tweet,media:{videos:[item,{url:'https://video.twimg.com.evil.test/file.mp4'},null]}}},parse(href));assert.equal(result.videos.length,1);assert.equal(result.videos[0].src,'https://video.twimg.com/medium.mp4?tag=12');assert.equal(result.videos[0].duration,15);
});
test('X video renditions infer missing dimensions and fall back without selecting HEVC',()=>{
 const root='https://video.twimg.com/amplify_video/123/vid/';
 const url=path=>root+path+'/clip.mp4?tag=29';
 const item={url:url('hvc1/3840x2160'),formats:[
  {url:url('avc1/480x270'),codec:'h264'},
  {url:url('avc1/1280x720'),codec:'h264'},
  {url:url('avc1/640x360'),codec:'h264'},
  {url:url('hvc1/3840x2160'),codec:'hevc'},
  {url:url('avc1/1920x1080'),codec:'h264'},null
 ]};
 const result=metadata({...fixture,tweet:{...fixture.tweet,media:{videos:[item]}}},parse(href)).videos[0];
 assert.equal(result.src,url('avc1/1280x720'));
 assert.deepEqual(Array.from(result.sources),['avc1/1280x720','avc1/640x360','avc1/480x270','avc1/1920x1080'].map(url));
 assert.equal(metadata({...fixture,tweet:{...fixture.tweet,media:{videos:[{url:url('hvc1/1920x1080'),codec:'hevc'}]}}},parse(href)).videos.length,0);
});
test('background restricts senders, deduplicates, caches, and omits cookies',async()=>{
  let listener,requests=0,options,endpoint;
  const worker=vm.createContext({URL,AbortController,TextDecoder,setTimeout,clearTimeout,chrome:{runtime:{id:'extension',onMessage:{addListener:fn=>listener=fn}}},fetch:async(url,opts)=>{requests++;options=opts;endpoint=url;return new Response(JSON.stringify(fixture));}});
  vm.runInContext(dataSource,worker);vm.runInContext(workerSource,worker);
  const sender={id:'extension',tab:{id:1},url:'https://kick.com/popout/channel/chat'};
  const request=url=>new Promise(resolve=>assert.equal(listener({type:'immersion:x-post',href:url},sender,resolve),true));
  const replies=await Promise.all([request(href),request(href+'?s=20')]);assert.equal(requests,1);assert.ok(replies.every(r=>r.ok));
  let cached;listener({type:'immersion:x-post',href},sender,r=>cached=r);assert.equal(cached.post.id,id);assert.equal(requests,1);
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(endpoint,`https://api.fxtwitter.com/binji_x/status/${id}`);
  for(const invalid of [{...sender,url:'https://evil.test'},{...sender,id:'other'},{...sender,tab:null}])assert.equal(listener({type:'immersion:x-post',href},invalid,()=>assert.fail('Untrusted sender')),undefined);
});
test('background caps concurrent requests and returns a clean failure for unavailable posts',async()=>{
  let listener,active=0,max=0;const releases=[];
  const worker=vm.createContext({URL,AbortController,TextDecoder,setTimeout,clearTimeout,chrome:{runtime:{id:'extension',onMessage:{addListener:fn=>listener=fn}}},fetch:async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>releases.push(resolve));active--;return new Response('{}',{status:404});}});
  vm.runInContext(dataSource,worker);vm.runInContext(workerSource,worker);
  const requests=[1,2,3,4].map(id=>new Promise(resolve=>listener({type:'immersion:x-post',href:`https://x.com/person/status/${id}`},{id:'extension',tab:{id:1},url:'https://kick.com/test'},resolve)));
  assert.equal(releases.length,2);releases.splice(0).forEach(resolve=>resolve());await new Promise(resolve=>setTimeout(resolve,0));assert.equal(releases.length,2);releases.splice(0).forEach(resolve=>resolve());assert.ok((await Promise.all(requests)).every(r=>!r.ok));assert.equal(max,2);
});
