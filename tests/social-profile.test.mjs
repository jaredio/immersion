import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const media=await readFile('extension/media-data.js','utf8'),source=await readFile('extension/social-profile-data.js','utf8');
const context=vm.createContext({URL});vm.runInContext(media,context);vm.runInContext(source,context);
const data=context.KickRefinedSocialData;
const embed=user=>`<script type="application/json">${JSON.stringify({contextJSON:JSON.stringify({context:user})})}</script>`;
const user={username:'creator',full_name:'Creator Name',is_verified:true,profile_pic_url:'https://scontent.cdninstagram.com/avatar.jpg',biography:'Actual bio <script>literal text</script>',followers_count:1234,following_count:0,posts_count:12,graphql_media:[{shortcode_media:{shortcode:'ABC_123',display_url:'https://scontent.cdninstagram.com/post.jpg',owner:{username:'creator'},edge_media_to_caption:{edges:[{node:{text:'A public post'}}]}}}]};

test('social requests accept account pages without accepting arbitrary fetch targets or post routes',()=>{
  for(const [href,provider]of [['https://instagram.com/creator','instagram'],['https://discord.gg/server-code','discord'],['https://discord.com/invite/server-code','discord'],['https://www.youtube.com/@Creator','youtube'],['https://youtube.com/channel/UC123456','youtube'],['https://twitch.tv/creator','twitch'],['https://facebook.com/creator','facebook'],['https://x.com/creator','x'],['https://www.tiktok.com/@creator','tiktok']])assert.equal(data.parse(href).provider,provider);
  for(const href of ['https://instagram.com.evil.test/creator','https://user:pass@instagram.com/creator','http://discord.gg/server','https://discord.com/api/v10/invites/server','https://instagram.com/p/ABC','https://twitch.tv/directory','https://youtube.com/watch?v=dQw4w9WgXcQ','https://facebook.com/login','https://x.com/creator/status/123','https://instagram.com:444/creator'])assert.equal(data.parse(href),null,href);
});

test('Instagram profile embeds provide real identity, counters and a validated recent-post grid',()=>{
  const item=data.parse('https://instagram.com/creator'),profile=data.instagram(embed(user),item);
  assert.equal(profile.author,'Creator Name');assert.equal(profile.verified,true);assert.equal(profile.stats.followers,1234);assert.equal(profile.stats.following,0);assert.equal(profile.description,user.biography);assert.equal(profile.posts[0].href,'https://www.instagram.com/p/ABC_123/');assert.equal(profile.posts[0].title,'A public post');
  assert.throws(()=>data.instagram(embed({...user,username:'another'}),item));assert.throws(()=>data.instagram(embed({...user,is_private:true}),item));assert.throws(()=>data.instagram('<script>execute()</script>',item));
  const invalid=data.instagram(embed({...user,profile_pic_url:'https://evil.test/avatar.jpg',followers_count:-1,graphql_media:[{shortcode_media:{...user.graphql_media[0].shortcode_media,owner:{username:'another'}}}]}),item);
  assert.equal(invalid.avatar,'');assert.equal(invalid.stats.followers,null);assert.equal(invalid.posts.length,0);
});

test('Discord previews resolve the actual server behind an invite with its banner and member counts',()=>{
  const item=data.parse('https://discord.gg/community'),raw={code:'community',guild:{id:'123456789',name:'Creator Community',description:'Community description',icon:'a_1234567890abcdef1234567890abcdef',banner:'1234567890abcdef1234567890abcdef',features:['VERIFIED']},approximate_member_count:12345,approximate_presence_count:0};
  const value=data.discord(raw,item);assert.equal(value.author,'Creator Community');assert.equal(value.stats.members,12345);assert.equal(value.stats.online,0);assert.ok(value.banner.startsWith('https://cdn.discordapp.com/banners/123456789/'));assert.equal(value.verified,true);
  assert.throws(()=>data.discord({...raw,code:'other'},item));assert.throws(()=>data.discord({...raw,guild:{...raw.guild,id:'../../../evil'}},item));
  assert.equal(data.discord({...raw,guild:{...raw.guild,icon:'malicious',banner:'https://evil.test/x'}},item).avatar,'');
  const upper=data.parse('https://discord.gg/COMMUNITY');
  assert.equal(data.discord({...raw,guild:{...raw.guild,vanity_url_code:'community'}},upper).author,'Creator Community','Discord canonicalizes the casing of real vanity invites');
  assert.throws(()=>data.discord(raw,upper),'ordinary invite codes remain case sensitive');
  assert.throws(()=>data.discord({...raw,guild:{...raw.guild,vanity_url_code:'unrelated'}},upper));
});

test('public profile pages validate the canonical account and decode metadata as text',()=>{
  const item=data.parse('https://twitch.tv/creator'),html='<meta content="https://www.twitch.tv/creator" property="og:url"><meta property="og:title" content="Creator &amp; Friends - Twitch"><meta name="description" content="A &#39;real&#39; bio"><meta content="https://static-cdn.jtvnw.net/creator.jpg" property="og:image">';
  const profile=data.page(html,item);assert.equal(profile.author,'Creator & Friends');assert.equal(profile.description,"A 'real' bio");assert.equal(profile.avatar,'https://static-cdn.jtvnw.net/creator.jpg');assert.deepEqual(Object.keys(profile.stats),[]);
  assert.throws(()=>data.page(html.replace('/creator"','/another"'),item));assert.throws(()=>data.page('<meta property="og:title" content="Log in">',item));
  assert.equal(data.image('https://scontent.cdninstagram.com.evil.test/avatar.jpg','instagram'),'');assert.equal(data.image('https://p16.tiktokcdn.com/avatar.jpg','instagram'),'');
  assert.equal(data.post('https://instagram.com/p/ABC123','instagram'),'https://instagram.com/p/ABC123');assert.equal(data.post('https://evil.test/p/ABC123','instagram'),'');
});

async function worker(fetch){
  let listener;const handlers=[],context=vm.createContext({URL,AbortController,TextDecoder,setTimeout,clearTimeout,chrome:{runtime:{id:'extension',onMessage:{addListener:fn=>{listener=fn;handlers.push(fn);}}}},fetch});
  for(const file of ['shared','preview-queue','media-data','social-profile-data','social-profile-background'])vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),context);
  const sender={id:'extension',tab:{id:1},url:'https://kick.com/creator'};
  return {listener,sender,advance:ms=>vm.runInContext(`Date.now=()=>${Date.now()+ms}`,context),cancel:requestId=>handlers.forEach(fn=>fn({type:'immersion:preview-cancel',requestId},sender,()=>{})),ask:(href,patch={})=>new Promise(resolve=>listener({type:'immersion:social-profile',href,...patch},sender,resolve))};
}

test('social worker uses fixed public endpoints, omits cookies, deduplicates and blocks unrelated senders',async()=>{
  let reads=0;const options=[];
  const service=await worker(async(url,opts)=>{reads++;options.push([url,opts]);return new Response(embed(user));});
  const values=await Promise.all([service.ask('https://instagram.com/creator'),service.ask('https://www.instagram.com/creator/')]);
  assert.equal(reads,1);assert.ok(values.every(value=>value.ok));assert.equal(options[0][0],'https://www.instagram.com/creator/embed/');assert.equal(options[0][1].credentials,'omit');assert.equal(options[0][1].redirect,'error');
  await service.ask('https://instagram.com/creator');assert.equal(reads,1);
  for(const sender of [{...service.sender,id:'evil'},{...service.sender,url:'https://evil.test'},{...service.sender,tab:null}])assert.equal(service.listener({type:'immersion:social-profile',href:'https://instagram.com/creator'},sender,()=>assert.fail()),undefined);
  assert.equal((await service.ask('https://evil.test/profile')).ok,false);assert.equal(reads,1);
});

test('profile retry bypasses failed cache entries and uses the current X profile endpoint',async()=>{
  let fail=true,reads=0,lastURL='';const service=await worker(async url=>{reads++;lastURL=url;return fail?new Response('',{status:503}):Response.json({code:200,user:{screen_name:'creator',name:'Creator',tweets:21,followers:123,banner_url:'https://pbs.twimg.com/profile_banners/123/456',verification:{verified:true}}});});
  assert.equal((await service.ask('https://x.com/creator')).ok,false);fail=false;assert.equal((await service.ask('https://x.com/creator')).ok,false);assert.equal(reads,3);
  const result=await service.ask('https://x.com/creator',{retry:true});assert.equal(result.ok,true);assert.equal(result.item.stats.posts,21);assert.equal(result.item.verified,true);assert.equal(result.item.banner,'https://pbs.twimg.com/profile_banners/123/456');assert.equal(lastURL,'https://api.fxtwitter.com/2/profile/creator');
});

test('social hovers recover from one transient server or network failure without a manual retry',async()=>{
  for(const failure of [()=>new Response('',{status:503}),()=>{throw new TypeError('Network interrupted');}]){
    let reads=0;const service=await worker(async()=>++reads===1?failure():new Response(embed(user)));
    const result=await service.ask('https://instagram.com/creator');assert.equal(result.ok,true);assert.equal(result.item.author,'Creator Name');assert.equal(reads,2);
    await service.ask('https://instagram.com/creator');assert.equal(reads,2,'successful recovery is cached');
  }
});

test('social retry is bounded, respects long rate limits and never retries a missing profile',async()=>{
  for(const [status,headers,expected]of [[503,{},2],[404,{},1],[429,{'Retry-After':'60'},1]]){
    let reads=0;const service=await worker(async()=>{reads++;return new Response('',{status,headers});});
    assert.equal((await service.ask('https://instagram.com/creator')).ok,false);assert.equal(reads,expected);
  }
});

test('leaving a hover cancels retry backoff without poisoning the next hover',async()=>{
  let reads=0,started;const firstRead=new Promise(resolve=>started=resolve);
  const service=await worker(async()=>{reads++;started();return reads===1?new Response('',{status:503}):new Response(embed(user));});
  const first=service.ask('https://instagram.com/creator',{requestId:'first-hover'});await firstRead;
  await new Promise(resolve=>setTimeout(resolve,30));service.cancel('first-hover');assert.equal((await first).cancelled,true);assert.equal(reads,1);
  assert.equal((await service.ask('https://instagram.com/creator',{requestId:'second-hover'})).ok,true);assert.equal(reads,2);
});

test('a brief outage does not pin later hovers to a failed response for fifteen seconds',async()=>{
  let fail=true,reads=0;const service=await worker(async()=>{reads++;return fail?new Response('',{status:503}):new Response(embed(user));});
  assert.equal((await service.ask('https://instagram.com/creator')).ok,false);assert.equal(reads,2);
  fail=false;service.advance(3000);assert.equal((await service.ask('https://instagram.com/creator')).ok,true);assert.equal(reads,3);
  service.advance(300000);await service.ask('https://instagram.com/creator');assert.equal(reads,3,'healthy profile data remains reusable across repeated visits');
});

test('X bio hovers resolve Twitter aliases with current profile data and reject mismatched accounts',async()=>{
  const requests=[];const service=await worker(async url=>{
    requests.push(url);
    if(!url.includes('/2/profile/'))return Response.json({code:404,message:'User not found'},{status:404});
    return Response.json({code:200,user:{type:'profile',screen_name:'GEWNZILLA',name:'GEWN',description:'Public profile bio',statuses:7649,followers:3382,following:230,avatar_url:'https://pbs.twimg.com/profile_images/123/avatar.jpg',banner_url:'https://pbs.twimg.com/profile_banners/123/456',verification:{verified:false}}});
  });
  const result=await service.ask('https://www.twitter.com/gewnzilla?lang=en');
  assert.equal(result.ok,true);assert.equal(result.item.id,'gewnzilla');assert.equal(result.item.description,'Public profile bio');assert.equal(result.item.stats.posts,7649);assert.equal(result.item.stats.followers,3382);assert.ok(result.item.avatar);
  assert.deepEqual(requests,['https://api.fxtwitter.com/2/profile/gewnzilla']);
  assert.equal((await service.ask('https://x.com/other')).ok,false,'another account must never appear under the requested handle');
});

test('X hovers tolerate independently available v2 and legacy profile routes with either counter schema',async()=>{
  for(const legacyOnly of [false,true]){
    const requests=[];const service=await worker(async url=>{
      requests.push(url);if(legacyOnly&&url.includes('/2/profile/'))return Response.json({code:404,message:'User not found'},{status:404});
      return Response.json({code:200,user:{screen_name:'Creator',name:'Creator',followers:100,...legacyOnly?{tweets:25}:{statuses:25}}});
    });
    const result=await service.ask('https://x.com/creator');assert.equal(result.ok,true);assert.equal(result.item.stats.posts,25);assert.equal(result.item.id,'creator');
    assert.deepEqual(requests,legacyOnly?['https://api.fxtwitter.com/2/profile/creator','https://api.fxtwitter.com/creator']:['https://api.fxtwitter.com/2/profile/creator']);
  }
  const service=await worker(async()=>Response.json({code:200,user:{screen_name:'another',name:'Wrong account'}}));
  assert.equal((await service.ask('https://x.com/creator')).ok,false,'neither fallback can bypass account identity validation');
  const requests=[],limited=await worker(async url=>{requests.push(url);return new Response('',{status:429,headers:{'Retry-After':'60'}});});
  assert.equal((await limited.ask('https://x.com/creator')).ok,false);assert.deepEqual(requests,['https://api.fxtwitter.com/2/profile/creator'],'a provider rate limit must not trigger alternate-route requests');
});

test('Instagram requests normalize uppercase Kick handles before fetching the profile embed',async()=>{
  let endpoint;const service=await worker(async url=>{endpoint=url;return new Response(embed({...user,username:'gewnzilla'}));});
  const result=await service.ask('https://www.instagram.com/GEWNZILLA/');
  assert.equal(result.ok,true);assert.equal(endpoint,'https://www.instagram.com/gewnzilla/embed/');assert.equal(result.item.id,'gewnzilla');
});

test('TikTok creator embeds expose real recent videos and reject private or mismatched owners',()=>{
 const item=data.parse('https://www.tiktok.com/@CREATOR'),raw={source:{data:{'/embed/@creator':{userInfo:{uniqueId:'creator',nickname:'Creator',avatarThumbUrl:'https://p16.tiktokcdn.com/avatar.jpg',followerCount:100,heartCount:200,followingCount:0,code:200},videoList:[{id:'7701411034199805214',authorUniqueId:'creator',coverUrl:'https://p16.tiktokcdn.com/cover.jpg',desc:'Latest upload'}]}}}};
 const html=value=>`<script id="__FRONTITY_CONNECT_STATE__" type="application/json">${JSON.stringify(value)}</script>`;
 const profile=data.tiktokEmbed(html(raw),item);assert.equal(profile.posts.length,1);assert.equal(profile.posts[0].href,'https://www.tiktok.com/@creator/video/7701411034199805214');assert.equal(profile.posts[0].title,'Latest upload');assert.equal(profile.stats.following,0);
 const page=raw.source.data['/embed/@creator'];page.videoList[0].authorUniqueId='another';assert.equal(data.tiktokEmbed(html(raw),item).posts.length,0);page.userInfo.privateAccount=true;assert.throws(()=>data.tiktokEmbed(html(raw),item));
});

test('YouTube profile video grids support classic, current and Shorts renderers without executing scripts',()=>{
 const item=data.parse('https://www.youtube.com/@Creator'),metadata='<meta property="og:url" content="https://www.youtube.com/channel/UCcreator"><meta property="og:title" content="Creator - YouTube">';
 const initial={contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,content:{items:[
  {videoRenderer:{videoId:'dQw4w9WgXcQ',title:{runs:[{text:'First } upload'}]},lengthText:{simpleText:'3:21'},thumbnail:{thumbnails:[{url:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'}]}}},
  {lockupViewModel:{contentId:'abcdefghijk',metadata:{lockupMetadataViewModel:{title:{content:'Second upload'}}},contentImage:{thumbnailViewModel:{image:{sources:[{url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'}]}}}}},
  {shortsLockupViewModel:{onTap:{innertubeCommand:{reelWatchEndpoint:{videoId:'12345678901'}}},overlayMetadata:{primaryText:{content:'A Short'}},thumbnail:{sources:[{url:'https://i.ytimg.com/vi/12345678901/hqdefault.jpg'}]}}}
 ]}}}]}}};
 const result=data.youtube(metadata+`<script>var ytInitialData = ${JSON.stringify(initial)}; window.mustNotRun=true;</script>`,item);
 assert.equal(result.posts.length,3);assert.equal(result.posts[0].title,'First } upload');assert.equal(result.posts[0].duration,'3:21');assert.equal(result.posts[2].href,'https://www.youtube.com/shorts/12345678901');assert.equal(context.mustNotRun,undefined);
 assert.equal(data.post('https://www.youtube.com/watch?v=dQw4w9WgXcQ&ref=tracking','youtube'),'https://www.youtube.com/watch?v=dQw4w9WgXcQ');assert.equal(data.post('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','youtube'),'');
 assert.equal(data.youtube(metadata+'<script>var ytInitialData = {"contents":{"channelOwnerEmptyStateRenderer":{}}};</script>',item).postsEmpty,true);
});

test('TikTok fallback requests use the lowercase account that its oEmbed endpoint requires',async()=>{
 const requests=[];const service=await worker(async url=>{requests.push(url);return url.includes('/oembed?')?Response.json({title:"Creator's Profile",author_name:'Creator',author_url:'https://www.tiktok.com/@xgewnx'}):new Response('',{status:503});});
 const result=await service.ask('https://www.tiktok.com/@xGEWNx');assert.equal(result.ok,true);assert.equal(new URL(requests.at(-1)).searchParams.get('url'),'https://www.tiktok.com/@xgewnx');
});
