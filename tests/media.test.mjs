import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/media-data.js',import.meta.url),'utf8'),workerSource=await readFile(new URL('../extension/media-background.js',import.meta.url),'utf8');
const context=vm.createContext({URL});vm.runInContext(source,context);const {parse,profile,tiktokPage,oembed,player}=context.KickRefinedMediaData;
const tt='https://www.tiktok.com/@creator/video/7700270863769210126',yt='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const ttItem={id:'7700270863769210126',desc:'Public video <script>',author:{uniqueId:'creator',nickname:'Creator',avatarThumb:'https://p16.tiktokcdn.com/avatar.jpg'},video:{cover:'https://p16.tiktokcdn-us.com/cover.jpg',duration:12},stats:{diggCount:10,shareCount:2,playCount:100}};
const html=item=>`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{itemInfo:{itemStruct:item}}}})}</script>`;
test('parses public profile/video URLs, Shorts, timestamps and TikTok share links without lookalikes',()=>{
 assert.equal(parse('https://youtu.be/dQw4w9WgXcQ?t=1m2s').start,62);assert.equal(parse(yt+'&t=62').start,62);assert.equal(parse('https://www.youtube.com/shorts/dQw4w9WgXcQ').shorts,true);
 assert.equal(parse('https://vt.tiktok.com/ZSg44YD1X/').kind,'shortlink');assert.equal(parse('https://www.tiktok.com/t/ZTfqXW8Cn/').kind,'shortlink');
 assert.equal(parse('https://www.tiktok.com/@creator').kind,'profile');assert.equal(parse('https://x.com/creator?s=20').kind,'profile');
 for(const url of ['https://x.com/home','https://x.com/creator/status/123','https://youtube.com/watch?v=bad','https://youtube.com/playlist?list=abc','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://www.youtube.com:4430/watch?v=dQw4w9WgXcQ','https://user:pass@www.tiktok.com/@creator','http://vt.tiktok.com/ZSg44YD1X/','https://vt.tiktok.com/ZSg44YD1X/extra','https://www.tiktok.com/search?q=test'])assert.equal(parse(url),null,url);
 assert.notEqual(parse(yt).key,parse(yt+'&t=62').key,'timestamps must not be overwritten by cached metadata');
});
test('reads TikTok public metadata and real counts without executing HTML',()=>{
 const value=tiktokPage(html(ttItem),parse(tt));assert.equal(value.title,ttItem.desc);assert.equal(value.stats.likes,10);assert.equal(value.stats.shares,2);assert.equal(value.stats.views,100);assert.ok(value.thumbnail.startsWith('https://p16.tiktokcdn-us.com/'));
 assert.throws(()=>tiktokPage(html({...ttItem,id:'123'}),parse(tt)));assert.throws(()=>tiktokPage(html({...ttItem,privateItem:true}),parse(tt)));
 const empty=tiktokPage(html({...ttItem,stats:{playCount:-1,diggCount:'0',shareCount:'not a count'},video:{cover:'https://evil.test/a.jpg'}}),parse(tt));assert.equal(empty.stats.likes,0);assert.equal(empty.stats.views,null);assert.equal(empty.stats.shares,null);assert.equal(empty.thumbnail,'');
 assert.equal(tiktokPage('<script>window.bad=true</script>',parse(tt)),null);
 const page=`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify({__DEFAULT_SCOPE__:{'webapp.user-detail':{userInfo:{user:{uniqueId:'creator',nickname:'Creator',signature:'Bio'},stats:{followerCount:45,heartCount:123,videoCount:7}}}}})}</script>`;
 assert.equal(tiktokPage(page,parse('https://www.tiktok.com/@creator')).stats.followers,45);
});
test('profile and oEmbed metadata validate identity and never invent counters',()=>{
 const user={screen_name:'creator',name:'Name',description:'<b>Bio</b>',followers:12,following:1,statuses:5,avatar_url:'https://pbs.twimg.com/a.jpg'};
 const value=profile({code:200,user},parse('https://x.com/creator'));assert.equal(value.stats.followers,12);assert.equal(value.description,user.description);assert.throws(()=>profile({code:200,user:{...user,screen_name:'another'}},parse('https://x.com/creator')));
 const video=oembed({title:'Video',author_name:'Author',thumbnail_url:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',html:'<script>bad()</script>'},parse(yt));assert.deepEqual(Object.keys(video.stats),[]);assert.equal(video.html,undefined);
 assert.throws(()=>oembed({title:'Video',author_name:'Wrong',author_url:'https://www.tiktok.com/@another'},parse(tt)));
 assert.ok(player(parse(yt+'&t=62')).includes('start=62'));assert.ok(player(parse(tt)).startsWith('https://www.tiktok.com/player/v1/'));assert.equal(player(parse('https://x.com/creator')),'');
});
test('metadata worker resolves short links, deduplicates and restricts senders',async()=>{
 let listener,requests=0;const options=[];
 const worker=vm.createContext({URL,AbortController,TextDecoder,setTimeout,clearTimeout,chrome:{runtime:{id:'extension',onMessage:{addListener:fn=>listener=fn}}},fetch:async(url,opts)=>{
  requests++;options.push(opts);const response=new Response(html(ttItem));Object.defineProperty(response,'url',{value:tt});return response;
 }});vm.runInContext(source,worker);vm.runInContext(workerSource,worker);
 const sender={id:'extension',tab:{id:1},url:'https://kick.com/channel'},message={type:'immersion:media-preview',href:'https://vt.tiktok.com/ZSg44YD1X/'};
 const ask=()=>new Promise(resolve=>assert.equal(listener(message,sender,resolve),true));const values=await Promise.all([ask(),ask()]);assert.equal(requests,1);assert.ok(values.every(value=>value.ok));assert.equal(values[0].item.id,ttItem.id);assert.equal(options[0].credentials,'omit');
 let hit;listener(message,sender,value=>hit=value);assert.equal(hit.ok,true);assert.equal(requests,1);
 for(const from of [{...sender,id:'evil'},{...sender,url:'https://evil.test'},{...sender,tab:null}])assert.equal(listener(message,from,()=>assert.fail('untrusted sender')),undefined);
 let invalid;listener({...message,href:'https://evil.test'},sender,value=>invalid=value);assert.equal(invalid.ok,false);
});
