import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL});
for(const file of ['chat-clips','clip-tools'])vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),context);
const tools=context.KickRefinedClipTools,id='clip_01M5VG3B8WEFY068DP0GCHKSGW',base=`https://clips.kick.com/clips/ab/${id}/playlist.m3u8`,clip={id,channel:'native'};
const parse=text=>tools.playlist('#EXTM3U\n'+text,base,id);
for(const status of [404,410])test(`expired replay (${status}) is terminal and does not offer pointless retries`,()=>{
 const failure=tools.replayFailure({status});assert.equal(failure.retryable,false);assert.match(failure.message,/no longer has chat replay/);
});
for(const [label,error,pattern]of [['blocked',{status:403},/blocked/],['rate limited',{status:429},/limiting/],['timeout',{name:'TimeoutError'},/timed out/],['cross-origin failure',{name:'TypeError'},/Reload the updated extension/],['server failure',{status:503},/temporarily unavailable/]])test(`replay reports ${label} and allows recovery`,()=>{
 const failure=tools.replayFailure(error);assert.equal(failure.retryable,true);assert.match(failure.message,pattern);
});
test('channel identity comes from the broadcaster, with bounded names and trusted images',()=>{
 const data=tools.details({channel_id:3,started_at:'2026-11-15T04:29:20Z',channel:{slug:'NATIVE',username:'Native',profile_picture:'https://files.kick.com/avatar.webp'}},clip);
 assert.equal(data.channelName,'Native');assert.equal(data.channelImage,'https://files.kick.com/avatar.webp');assert.equal(data.replay.channelId,3);
 assert.equal(tools.details({channel:{slug:'clipper',username:'Wrong',profile_picture:'https://files.kick.com/other'}},clip).channelName,'native');
 for(const value of ['https://files.kick.com.evil.test/x','javascript:alert(1)','https://user@files.kick.com/x','http://files.kick.com/x'])assert.equal(tools.image(value),'');
});
test('missing or malformed replay anchors cannot query another channel or date',()=>{
 for(const data of [{},{channel_id:-1,started_at:'2026-11-15T00:00:00Z'},{channel_id:1,started_at:'bad'},{channel_id:'1/other',started_at:'2026-11-15T00:00:00Z'}])assert.equal(tools.details(data,clip).replay,null);
});
test('HLS byte ranges retain implicit offsets only for the same resource',()=>{
 const data=parse('#EXT-X-BYTERANGE:10@20\n#EXTINF:1,\n1.ts\n#EXT-X-BYTERANGE:12\n#EXTINF:1,\n1.ts\n#EXT-X-ENDLIST');
 assert.equal(data.segments[0].range.start,20);assert.equal(data.segments[1].range.start,30);assert.equal(data.segments[1].range.end,41);
 assert.throws(()=>parse('#EXT-X-BYTERANGE:10\n#EXTINF:1,\n1.ts\n#EXT-X-ENDLIST'),/range/);
 assert.throws(()=>parse('#EXT-X-BYTERANGE:10@20\n#EXTINF:1,\n1.ts\n#EXT-X-BYTERANGE:12\n#EXTINF:1,\n2.ts\n#EXT-X-ENDLIST'),/range/);
});
test('MP4 initialization and master rendition selection preserve approved clip URLs',()=>{
 const media=parse('#EXT-X-MAP:URI="init.mp4",BYTERANGE="100@0"\n#EXTINF:1,\nsegment.m4s\n#EXT-X-ENDLIST');assert.equal(media.init.range.end,99);
 assert.equal(parse('#EXT-X-STREAM-INF:BANDWIDTH=500\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000\nhigh.m3u8').variant,new URL('high.m3u8',base).href);
});
for(const [name,text] of Object.entries({external:'#EXTINF:1,\nhttps://evil.test/segment.ts\n#EXT-X-ENDLIST',traversal:'#EXTINF:1,\n../../another/segment.ts\n#EXT-X-ENDLIST',encrypted:'#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:1,\n1.ts\n#EXT-X-ENDLIST',live:'#EXTINF:1,\n1.ts',duration:'#EXTINF:601,\n1.ts\n#EXT-X-ENDLIST',discontinuity:'#EXT-X-DISCONTINUITY\n#EXTINF:1,\n1.ts\n#EXT-X-ENDLIST',audio:'#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nvideo.m3u8',overflow:'#EXT-X-BYTERANGE:9007199254740992@0\n#EXTINF:1,\n1.ts\n#EXT-X-ENDLIST'}))test(`unsupported ${name} playlists fail without requesting media`,()=>assert.throws(()=>parse(text)));
test('download filenames strip path separators, control characters and invalid Windows filename characters',()=>{
 const filename=tools.filename(clip,'a/b\\c:<x>?\u0000');assert.match(filename,/^native-abcx-/);assert.ok(filename.endsWith('.mp4'));assert.ok(tools.filename(clip,'x'.repeat(1000)).length<180);
});
test('replay messages are bounded, ordered, deduplicated and restricted to the clip timeline',()=>{
 const replay={startedAt:Date.parse('2026-11-15T00:00:00Z')},message=(id,time,content='hi')=>({id,created_at:new Date(replay.startedAt+time*1000).toISOString(),content,sender:{username:'Viewer',identity:{color:'red;display:none'}}});
 const rows=tools.messages({data:{messages:[message('b',2),message('a',1,'<img onerror=alert(1)>'),message('a',1),message('before',-1),message('after',61)]}},replay,60);
 assert.equal(rows.length,2);assert.equal(rows[0].id,'a');assert.equal(rows[0].content,'<img onerror=alert(1)>');assert.equal(rows[0].color,'#b8b8c8');assert.throws(()=>tools.messages({},replay,60));
});

async function downloader(fetch){
 const ctx=vm.createContext({URL,Blob,Response,Uint8Array,AbortController,setTimeout,clearTimeout,fetch});
 ctx.KickRefined={readText:response=>response.text()};
 for(const file of ['chat-clips','clip-tools'])vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),ctx);
 return ctx.KickRefinedClipTools.download;
}
test('MP4 downloads keep initialization and every fragment in playlist order',async()=>{
 const calls=[],download=await downloader(async url=>{calls.push(url);return new Response(url.endsWith('.m3u8')?'#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:1,\n1.m4s\n#EXTINF:1,\n2.m4s\n#EXT-X-ENDLIST':url.endsWith('init.mp4')?'init':url.endsWith('1.m4s')?'first':'second');});
 const progress=[],blob=await download({src:base},clip,{signal:new AbortController().signal,onProgress:value=>progress.push(value)});
 assert.equal(await blob.text(),'initfirstsecond');assert.equal(blob.type,'video/mp4');assert.deepEqual(progress,[50,100]);assert.equal(calls.length,4);
});
test('range downloads send exact headers and handle servers returning the full object',async()=>{
 const ranges=[],download=await downloader(async(url,options)=>{
  if(url.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-BYTERANGE:3@2\n#EXTINF:1,\n1.m4s\n#EXT-X-ENDLIST');
  if(url.endsWith('init.mp4'))return new Response('init');ranges.push(options.headers.Range);return new Response('xxABCzzz');
 });
 const blob=await download({src:base},clip,{signal:new AbortController().signal});assert.equal(await blob.text(),'initABC');assert.deepEqual(ranges,['bytes=2-4']);
});
test('incorrect partial-content responses fail instead of saving corrupt MP4 files',async()=>{
 const download=await downloader(async url=>new Response(url.endsWith('.m3u8')?'#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-BYTERANGE:3@2\n#EXTINF:1,\n1.m4s\n#EXT-X-ENDLIST':'bad',url.endsWith('.m4s')?{status:206,headers:{'content-range':'bytes 1-3/10'}}:{}));
 await assert.rejects(download({src:base},clip,{signal:new AbortController().signal}),/byte range/);
});
test('cancelled downloads stop before fetching any later fragments',async()=>{
 const abort=new AbortController(),calls=[],download=await downloader(async url=>{calls.push(url);return new Response(url.endsWith('.m3u8')?'#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:1,\n1.m4s\n#EXTINF:1,\n2.m4s\n#EXT-X-ENDLIST':'data');});
 await assert.rejects(download({src:base},clip,{signal:abort.signal,onProgress:()=>abort.abort()}));assert.equal(calls.length,3);
});
test('an already cancelled download never starts a request',async()=>{
 const abort=new AbortController();abort.abort();let calls=0;const download=await downloader(async()=>{calls++;return new Response('data');});await assert.rejects(download({src:base},clip,{signal:abort.signal}));assert.equal(calls,0);
});

test('cancelling a pending media read rejects promptly even if source cancellation never settles',async()=>{
 const abort=new AbortController();let startRead,cancelled=false;
 const reading=new Promise(resolve=>{startRead=resolve;});
 const body=new ReadableStream({pull(){startRead();return new Promise(()=>{});},cancel(){cancelled=true;return new Promise(()=>{});}},{highWaterMark:0});
 const download=await downloader(async()=>new Response(body));
 const reason=Error('Closed the clip panel');
 const result=assert.rejects(download({src:new URL('clip.mp4',base).href},clip,{signal:abort.signal}),error=>error===reason);
 await reading;abort.abort(reason);await result;
 assert.equal(cancelled,true);assert.equal(body.locked,false);
});

for(const [name,response]of [['empty',()=>new Response('')],['missing',()=>new Response(null,{status:204})]])test(`${name} media cannot produce a successful download`,async()=>{
 const download=await downloader(async()=>response());
 await assert.rejects(download({src:new URL('clip.mp4',base).href},clip,{signal:new AbortController().signal}),/no media/);
});
