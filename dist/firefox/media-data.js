/* Public URL/metadata validation. Provider HTML is parsed as data, never executed. */
(() => {
  const reserved=new Set(['home','explore','search','settings','notifications','messages','compose','i','intent','share','login','logout','signup','tos','privacy','help','about','jobs','hashtag','download','account']);
  const text=(value,max=300)=>typeof value==='string'?value.slice(0,max):'';
  function count(value){if(typeof value==='string'&&/^\d{1,16}$/.test(value))value=Number(value);return Number.isSafeInteger(value)&&value>=0?value:null;}
  function parse(href){
    try{
      if(typeof href!=='string'||href.length>2048)return null;
      const url=new URL(href);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
      const host=url.hostname.replace(/^www\./,''),path=url.pathname;let match,item;
      if(['x.com','twitter.com','mobile.twitter.com'].includes(host)){
        match=/^\/([a-zA-Z0-9_]{1,15})\/?$/.exec(path);if(!match||reserved.has(match[1].toLowerCase()))return null;
        item={provider:'x',kind:'profile',handle:match[1],id:match[1].toLowerCase(),href:`https://x.com/${match[1]}`};
      }else if(['youtube.com','m.youtube.com','youtu.be'].includes(host)){
        const parts=path.split('/').filter(Boolean),id=host==='youtu.be'?parts.length===1?parts[0]:null:parts[0]==='watch'&&parts.length===1?url.searchParams.get('v'):['shorts','live','embed'].includes(parts[0])&&parts.length===2?parts[1]:null;
        if(!/^[a-zA-Z0-9_-]{11}$/.test(id||''))return null;
        const shorts=parts[0]==='shorts',stamp=url.searchParams.get('t')||url.searchParams.get('start')||'';
        const clock=/^(?:(\d{1,2})h)?(?:(\d{1,3})m)?(?:(\d{1,5})s)?$/.exec(stamp);
        const start=Math.min(86400,/^\d{1,5}$/.test(stamp)?Number(stamp):clock?(Number(clock[1]||0)*3600+Number(clock[2]||0)*60+Number(clock[3]||0)):0);
        const canonical=new URL(shorts?`https://www.youtube.com/shorts/${id}`:`https://www.youtube.com/watch?v=${id}`);if(start)canonical.searchParams.set('t',String(start));
        item={provider:'youtube',kind:'video',id,shorts,start,href:canonical.href};
      }else if(['tiktok.com','m.tiktok.com'].includes(host)){
        if((match=/^\/@([a-zA-Z0-9._]{1,32})\/video\/(\d{10,25})\/?$/.exec(path)))item={provider:'tiktok',kind:'video',handle:match[1],id:match[2],href:`https://www.tiktok.com/@${match[1]}/video/${match[2]}`};
        else if((match=/^\/@([a-zA-Z0-9._]{1,32})\/?$/.exec(path)))item={provider:'tiktok',kind:'profile',handle:match[1],id:match[1].toLowerCase(),href:`https://www.tiktok.com/@${match[1]}`};
        else if((match=/^\/t\/([a-zA-Z0-9]{5,80})\/?$/.exec(path)))item={provider:'tiktok',kind:'shortlink',id:match[1],href:`https://www.tiktok.com/t/${match[1]}/`};
      }else if(['vt.tiktok.com','vm.tiktok.com'].includes(host)&&(match=/^\/([a-zA-Z0-9]{5,80})\/?$/.exec(path)))item={provider:'tiktok',kind:'shortlink',id:match[1],href:`https://${host}/${match[1]}/`};
      if(!item)return null;return {...item,key:`${item.provider}:${item.kind}:${item.id}${item.provider==='youtube'?`:${item.start}:${Number(item.shorts)}`:item.kind==='shortlink'?`:${host}`:''}`};
    }catch{return null;}
  }
  function image(value,provider){
    try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.href.length>4096)return '';
      const host=url.hostname,allowed=provider==='x'?host==='pbs.twimg.com':provider==='youtube'?['i.ytimg.com','img.youtube.com'].includes(host):['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','ibytedtos.com','byteoversea.com','ttwstatic.com'].some(domain=>host===domain||host.endsWith('.'+domain));return allowed?url.href:'';
    }catch{return '';}
  }
  function profile(data,item){
    const user=data?.user;if(data?.code!==200||user?.screen_name?.toLowerCase()!==item.handle.toLowerCase())throw Error('Profile unavailable');
    return {...item,href:`https://x.com/${user.screen_name}`,author:text(user.name,100)||user.screen_name,handle:user.screen_name,title:text(user.name,100)||user.screen_name,description:text(user.description,3000),avatar:image(user.avatar_url,'x'),stats:{followers:count(user.followers),following:count(user.following),posts:count(user.statuses)}};
  }
  function tiktokPage(html,item){
    const match=/<script\b[^>]*\bid=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if(!match)return null;let scope;try{scope=JSON.parse(match[1]).__DEFAULT_SCOPE__;}catch{return null;}
    if(item.kind==='video'){
      const video=scope?.['webapp.video-detail']?.itemInfo?.itemStruct,user=video?.author;
      if(video?.id!==item.id||user?.uniqueId?.toLowerCase()!==item.handle.toLowerCase()||video.privateItem||video.takeDown||user.isEmbedBanned)throw Error('Video unavailable');
      const stats=video.stats||video.statsV2||{};
      return {...item,title:text(video.desc,300)||'TikTok video',description:'',author:text(user.nickname,100)||item.handle,handle:user.uniqueId,avatar:image(user.avatarThumb,'tiktok'),thumbnail:image(video.video?.cover,'tiktok'),duration:count(video.video?.duration),stats:{likes:count(stats.diggCount),shares:count(stats.shareCount),views:count(stats.playCount)}};
    }
    const info=scope?.['webapp.user-detail']?.userInfo,user=info?.user;if(!user||user.uniqueId?.toLowerCase()!==item.handle.toLowerCase())return null;
    const stats=info.stats||info.statsV2||{};
    return {...item,title:text(user.nickname,100)||item.handle,author:text(user.nickname,100)||item.handle,description:text(user.signature,3000),avatar:image(user.avatarThumb,'tiktok'),stats:{followers:count(stats.followerCount),likes:count(stats.heartCount),videos:count(stats.videoCount)}};
  }
  function oembed(data,item){
    if(!data||typeof data.title!=='string'||typeof data.author_name!=='string')throw Error('Preview unavailable');
    const authorURL=item.provider==='tiktok'?parse(data.author_url):null;
    if(item.provider==='tiktok'&&(!authorURL||authorURL.provider!=='tiktok'||authorURL.kind!=='profile'||authorURL.handle.toLowerCase()!==item.handle.toLowerCase()))throw Error('Creator mismatch');
    let authorHref=authorURL?.href||'';
    if(item.provider==='youtube')try{const author=new URL(data.author_url);if(author.protocol==='https:'&&['www.youtube.com','youtube.com'].includes(author.hostname)&&!author.username&&!author.password&&!author.port)authorHref=author.href;}catch{}
    return {...item,title:text(data.title,500),author:text(data.author_name,100),authorHref,description:'',thumbnail:image(data.thumbnail_url,item.provider),avatar:'',stats:{}};
  }
  function player(item){
    if(item.kind!=='video')return '';
    if(item.provider==='youtube'){const url=new URL(`https://www.youtube-nocookie.com/embed/${item.id}`);url.search='autoplay=1&playsinline=1&rel=0';if(item.start)url.searchParams.set('start',String(item.start));return url.href;}
    if(item.provider==='tiktok')return `https://www.tiktok.com/player/v1/${item.id}?autoplay=1&controls=1&description=0&music_info=0`;
    return '';
  }
  globalThis.KickRefinedMediaData=Object.freeze({parse,image,count,profile,tiktokPage,oembed,player});
})();
