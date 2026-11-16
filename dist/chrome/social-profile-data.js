/* Public account metadata only. Never execute provider HTML or accept fetch URLs from it. */
(() => {
  const text=(value,max=1000)=>typeof value==='string'?value.slice(0,max):'';
  function parse(href){
    const media=globalThis.KickRefinedMediaData?.parse(href);
    if(media?.kind==='profile')return {...media,key:`social:${media.key}`};
    try{
      const url=new URL(href);if(url.protocol!=='https:'||url.username||url.password||url.port||url.href.length>2048)return null;
      const host=url.hostname.replace(/^www\./,''),parts=url.pathname.split('/').filter(Boolean);let provider='',handle='',route='';
      if(host==='instagram.com'&&parts.length===1&&!/^(p|reels?|stories|explore|accounts|direct)$/i.test(parts[0])){provider='instagram';handle=parts[0];route=`https://www.instagram.com/${handle}/`;}
      if((host==='discord.gg'&&parts.length===1||host==='discord.com'&&parts.length===2&&parts[0]==='invite')){provider='discord';handle=parts.at(-1);route=`https://discord.gg/${handle}`;}
      if(host==='youtube.com'&&(parts.length===1&&parts[0].startsWith('@')||parts.length===2&&['channel','c','user'].includes(parts[0]))){provider='youtube';handle=parts.at(-1).replace(/^@/,'');route=`https://www.youtube.com/${parts.join('/')}`;}
      if(host==='twitch.tv'&&parts.length===1&&!/^(directory|downloads|jobs|settings|subscriptions|wallet|videos)$/i.test(parts[0])){provider='twitch';handle=parts[0];route=`https://www.twitch.tv/${handle}`;}
      if(['facebook.com','fb.com'].includes(host)&&parts.length===1&&!/^(watch|groups|share|profile\.php|login|help|plugins)$/i.test(parts[0])){provider='facebook';handle=parts[0];route=`https://www.facebook.com/${handle}`;}
      if(!provider||!/^[-\p{L}\p{N}_.]{1,100}$/u.test(handle))return null;
      const id=provider==='discord'||provider==='youtube'&&parts[0]==='channel'?handle:handle.toLowerCase();
      return {provider,kind:'profile',handle,id,href:route,key:`social:${provider}:${id}`};
    }catch{return null;}
  }
  function image(value,provider){
    const media=['x','tiktok','youtube'].includes(provider)?globalThis.KickRefinedMediaData?.image(value,provider):'';if(media)return media;
    try{
      const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.href.length>4096)return '';
      const domains={instagram:['cdninstagram.com','fbcdn.net'],discord:['cdn.discordapp.com','media.discordapp.net'],youtube:['yt3.ggpht.com','yt3.googleusercontent.com'],twitch:['static-cdn.jtvnw.net','static.twitchcdn.net'],facebook:['fbcdn.net','fbsbx.com']}[provider]||[];
      return domains.some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain))?url.href:'';
    }catch{return '';}
  }
  function instagram(html,item){
    const match=/"contextJSON"\s*:\s*("(?:\\.|[^"\\])*")/.exec(html);if(!match)throw Error('Instagram profile unavailable');
    let user;try{user=JSON.parse(JSON.parse(match[1])).context;}catch{throw Error('Instagram profile unavailable');}
    if(user?.username?.toLowerCase()!==item.handle.toLowerCase()||user.is_private)throw Error('Instagram profile unavailable');
    const posts=(Array.isArray(user.graphql_media)?user.graphql_media:[]).slice(0,6).flatMap(entry=>{
      const post=entry?.shortcode_media,thumbnail=image(post?.display_resources?.[0]?.src||post?.display_url,'instagram');
      if(!thumbnail||!/^[-\w]{1,40}$/.test(post.shortcode||'')||post.owner?.username?.toLowerCase()!==item.handle.toLowerCase())return [];
      return [{href:`https://www.instagram.com/p/${post.shortcode}/`,image:thumbnail,title:text(post.edge_media_to_caption?.edges?.[0]?.node?.text,300)||'Instagram post'}];
    });
    return {...item,author:text(user.full_name,100)||user.username,handle:user.username,avatar:image(user.profile_pic_url,'instagram'),banner:'',description:text(user.biography||user.bio,3000),verified:user.is_verified===true||user.verified===true,stats:{followers:KickRefinedMediaData.count(user.followers_count),following:KickRefinedMediaData.count(user.following_count),posts:KickRefinedMediaData.count(user.posts_count)},posts};
  }
  function discord(value,item){
    const guild=value?.guild,vanity=typeof guild?.vanity_url_code==='string'&&guild.vanity_url_code.toLowerCase()===item.handle.toLowerCase()&&value?.code?.toLowerCase()===guild.vanity_url_code.toLowerCase();
    if(value?.code!==item.handle&&!vanity||!/^\d{5,25}$/.test(guild?.id||'')||typeof guild.name!=='string')throw Error('Discord server unavailable');
    const asset=(kind,hash)=>/^(?:a_)?[a-f0-9]{16,64}$/i.test(hash||'')?`https://cdn.discordapp.com/${kind}/${guild.id}/${hash}.png?size=512`:'';
    return {...item,author:text(guild.name,100),avatar:asset('icons',guild.icon),banner:asset('banners',guild.banner)||asset('splashes',guild.splash),description:text(guild.description,3000),verified:Array.isArray(guild.features)&&guild.features.includes('VERIFIED'),stats:{members:KickRefinedMediaData.count(value.approximate_member_count),online:KickRefinedMediaData.count(value.approximate_presence_count)},posts:[]};
  }
  function tiktokEmbed(html,item){
    const match=/<script\b[^>]*\bid=["']__FRONTITY_CONNECT_STATE__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);if(!match)throw Error('TikTok profile unavailable');
    const state=JSON.parse(match[1]),entry=Object.values(state?.source?.data||{}).find(value=>value?.userInfo?.uniqueId?.toLowerCase()===item.handle.toLowerCase()),user=entry?.userInfo;
    if(!user||entry.isError||user.privateAccount||user.code!==undefined&&![0,200].includes(user.code))throw Error('TikTok profile unavailable');
    const posts=(Array.isArray(entry.videoList)?entry.videoList:[]).slice(0,6).flatMap(video=>{
      const src=image(video?.coverUrl||video?.originCoverUrl,'tiktok');if(!src||video.privateItem||video.authorUniqueId?.toLowerCase()!==item.handle.toLowerCase()||!/^\d{10,25}$/.test(video.id||''))return [];
      return [{href:`https://www.tiktok.com/@${user.uniqueId}/video/${video.id}`,image:src,title:text(video.desc,300)||'TikTok video',kind:'video'}];
    });
    return {...item,handle:user.uniqueId,author:text(user.nickname,100)||user.uniqueId,avatar:image(user.avatarThumbUrl,'tiktok'),banner:'',description:text(user.signature,3000),verified:user.verified===true,stats:{followers:KickRefinedMediaData.count(user.followerCount),following:KickRefinedMediaData.count(user.followingCount),likes:KickRefinedMediaData.count(user.heartCount)},posts,postsEmpty:Array.isArray(entry.videoList)&&entry.videoList.length===0};
  }
  function assignedJSON(html){
    const match=/\bytInitialData\s*=\s*/.exec(html);if(!match)return null;const start=match.index+match[0].length;if(html[start]!=='{')return null;
    let depth=0,quoted=false,escaped=false;
    for(let index=start;index<html.length;index++){
      const char=html[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"')quoted=true;else if(char==='{'||char==='[')depth++;else if(char==='}'||char===']'){depth--;if(depth===0){try{return JSON.parse(html.slice(start,index+1));}catch{return null;}}}
    }
    return null;
  }
  function youtube(html,item){
    const profile=page(html,item),initial=assignedJSON(html);if(!initial)return profile;
    const tabs=initial.contents?.twoColumnBrowseResultsRenderer?.tabs,selected=tabs?.map(tab=>tab.tabRenderer).find(tab=>tab?.selected);
    const queue=[selected?.content||initial.contents],posts=[],seen=new Set();let empty=false;
    const readable=value=>typeof value?.simpleText==='string'?value.simpleText:typeof value?.content==='string'?value.content:Array.isArray(value?.runs)?value.runs.map(run=>text(run.text,300)).join(''):'';
    for(let index=0;index<queue.length&&index<25000&&posts.length<6;index++){
      const node=queue[index];if(!node||typeof node!=='object')continue;if(node.channelOwnerEmptyStateRenderer)empty=true;
      const video=node.videoRenderer||node.gridVideoRenderer||node.compactVideoRenderer,lockup=node.lockupViewModel,short=node.shortsLockupViewModel||node.reelItemRenderer;
      const id=video?.videoId||lockup?.contentId||short?.videoId||short?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      const thumbnails=video?.thumbnail?.thumbnails||lockup?.contentImage?.thumbnailViewModel?.image?.sources||short?.thumbnail?.sources||short?.thumbnail?.thumbnails;
      const source=Array.isArray(thumbnails)?thumbnails.filter(value=>!value.width||value.width<=640).at(-1)||thumbnails[0]:null,src=image(source?.url,'youtube');
      if(/^[\w-]{11}$/.test(id||'')&&src&&!seen.has(id)){
        seen.add(id);const title=readable(video?.title||lockup?.metadata?.lockupMetadataViewModel?.title||short?.overlayMetadata?.primaryText||short?.headline)||'YouTube video';
        posts.push({href:`https://www.youtube.com/${short?'shorts/':'watch?v='}${id}`,image:src,title:text(title,300),kind:'video',duration:text(readable(video?.lengthText),20)});
      }
      for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))queue.push(...value);else queue.push(value);}
    }
    return {...profile,posts,postsEmpty:empty&&!posts.length};
  }
  const decode=value=>value.replace(/&(?:amp|quot|apos|lt|gt|#\d{1,7}|#x[\da-f]{1,6});/gi,entity=>{
    const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
    const number=parseInt(entity.slice(entity[2]?.toLowerCase()==='x'?3:2,-1),entity[2]?.toLowerCase()==='x'?16:10);return number>0&&number<=0x10ffff?String.fromCodePoint(number):'';
  });
  function page(html,item){
    const meta=new Map();for(const match of html.matchAll(/<meta\b[^>]{0,10000}>/gi)){
      const attrs=new Map();for(const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs.set(attr[1].toLowerCase(),decode(attr[2]??attr[3]));
      const name=attrs.get('property')||attrs.get('name');if(name&&attrs.has('content'))meta.set(name.toLowerCase(),attrs.get('content'));
    }
    const canonical=parse(meta.get('og:url')),title=meta.get('og:title')||meta.get('twitter:title');
    if(!canonical||canonical.provider!==item.provider||canonical.id!==item.id&&!(item.provider==='youtube'&&canonical.href.includes('/channel/'))||!title||/^(?:log\s?in|sign\s?in)$/i.test(title.trim()))throw Error('Profile unavailable');
    return {...item,author:text(title.replace(/\s*(?:[-|·]\s*)?(?:YouTube|Twitch|Facebook)\s*$/i,''),100)||item.handle,avatar:image(meta.get('og:image')||meta.get('twitter:image'),item.provider),banner:'',description:text(meta.get('og:description')||meta.get('description')||meta.get('twitter:description'),3000),stats:{},posts:[]};
  }
  function post(value,provider){
    try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return '';const host=url.hostname.replace(/^www\./,'');
      if(provider==='youtube'&&host==='youtube.com'){const short=/^\/shorts\/([\w-]{11})\/?$/.exec(url.pathname),id=short?.[1]||url.pathname==='/watch'&&url.searchParams.get('v');return /^[\w-]{11}$/.test(id||'')?`https://www.youtube.com/${short?'shorts/':'watch?v='}${id}`:'';}
      return provider==='instagram'&&host==='instagram.com'&&/^\/(?:p|reel)\/[-\w]{1,40}\/?$/.test(url.pathname)||provider==='tiktok'&&host==='tiktok.com'&&/^\/@[\w.-]{1,32}\/video\/\d{10,25}\/?$/.test(url.pathname)?url.href:'';
    }catch{return '';}
  }
  globalThis.KickRefinedSocialData=Object.freeze({parse,image,instagram,discord,tiktokEmbed,youtube,page,post});
})();
