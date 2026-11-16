/* Hover-only public profile reads. Fixed provider URLs, no cookies or publisher scripts. */
(() => {
  const api=typeof browser!=='undefined'?browser:chrome,data=KickRefinedSocialData,media=KickRefinedMediaData,cache=new Map();
  async function profile(item,signal){
    const read=async(url,redirect='error')=>{
      const controller=new AbortController(),stop=()=>controller.abort(),timer=setTimeout(stop,4500);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
      try{
        const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect,signal:controller.signal});if(!response.ok){await response.body?.cancel();throw Error('Profile unavailable');}
        const body=await KickRefined.readText(response,{maxBytes:4194304,signal:controller.signal});return {body,url:response.url||url};
      }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);}
    };
    if(item.provider==='x'){
      const value=JSON.parse((await read(`https://api.fxtwitter.com/2/profile/${item.handle}`)).body),user=value?.user;
      return {...media.profile({...value,user:{...user,statuses:user?.statuses??user?.tweets}},item),banner:data.image(user?.banner_url||user?.banner,'x'),verified:user?.verification?.verified===true||user?.verified===true,location:typeof user?.location==='string'?user.location.slice(0,100):'',posts:[]};
    }
    if(item.provider==='instagram')return data.instagram((await read(`https://www.instagram.com/${item.handle.toLowerCase()}/embed/`)).body,item);
    if(item.provider==='discord')return data.discord(JSON.parse((await read(`https://discord.com/api/v10/invites/${item.handle}?with_counts=true&with_expiration=true`)).body),item);
    if(item.provider==='tiktok'){
      try{
        return data.tiktokEmbed((await read(`https://www.tiktok.com/embed/@${item.handle.toLowerCase()}`)).body,item);
      }catch{signal.throwIfAborted();}
      const canonical=`https://www.tiktok.com/@${item.handle.toLowerCase()}`;
      try{
        const page=await read(canonical,'follow'),resolved=data.parse(page.url);if(resolved?.provider!=='tiktok'||resolved.handle.toLowerCase()!==item.handle.toLowerCase())throw Error('Profile unavailable');
        const value=media.tiktokPage(page.body,item);if(value)return {...value,posts:[],postsEmpty:value.stats?.videos===0,banner:''};
      }catch{signal.throwIfAborted();}
      const value=JSON.parse((await read(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`)).body);
      return {...media.oembed(value,item),avatar:media.image(value.thumbnail_url,'tiktok'),posts:[],banner:''};
    }
    if(item.provider==='youtube'){
      const result=data.youtube((await read(item.href+'/videos')).body,item);
      if(result.posts.length)return result;
      try{return data.youtube((await read(item.href+'/shorts')).body,item);}catch{signal.throwIfAborted();return result;}
    }
    return data.page((await read(item.href)).body,item);
  }
  const jobs=KickRefinedPreviewQueue.create({api,timeout:15000,run:async(item,signal)=>({ok:true,item:await profile(item,signal)}),complete:(key,result)=>{cache.set(key,{result,until:Date.now()+(result.ok?120000:15000)});while(cache.size>50)cache.delete(cache.keys().next().value);}});
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='immersion:social-profile')return;
    try{if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(new URL(sender.url).origin))return;}catch{return;}
    const item=data.parse(message.href);if(!item){reply({ok:false});return;}
    const hit=cache.get(item.key);if(hit?.until>Date.now()&&(hit.result.ok||message.retry!==true)){reply(hit.result);return;}
    jobs.request(item.key,item,sender,message.requestId).then(reply);return true;
  });
})();
