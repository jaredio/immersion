/* Hover-only public profile reads. Fixed provider URLs, no cookies or publisher scripts. */
(() => {
  const api=typeof browser!=='undefined'?browser:chrome,data=KickRefinedSocialData,media=KickRefinedMediaData,cache=new Map();
  async function profile(item,signal){
    let retries=1;
    const pause=delay=>new Promise((resolve,reject)=>{
      const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(Error('Profile request cancelled'));},timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},delay);
      signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
    });
    const read=async(url,redirect='error')=>{
      for(;;){
        const controller=new AbortController(),stop=()=>controller.abort(),timer=setTimeout(stop,6000);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();let retryDelay=300;
        try{
          const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect,signal:controller.signal});
          if(!response.ok){
            const error=Error('Profile unavailable');error.status=response.status;error.retryable=[408,429,500,502,503,504].includes(response.status);
            const after=response.headers?.get('Retry-After');if(after)retryDelay=Math.max(300,/^\d+(?:\.\d+)?$/.test(after)?Number(after)*1000:Date.parse(after)-Date.now());
            await response.body?.cancel();throw error;
          }
          const body=await KickRefined.readText(response,{maxBytes:4194304,signal:controller.signal});return {body,url:response.url||url};
        }catch(error){
          signal.throwIfAborted();
          if(!retries||!(error.retryable||error.name==='TypeError'||controller.signal.aborted)||!Number.isFinite(retryDelay)||retryDelay>2000)throw error;
          retries--;
        }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);}
        await pause(retryDelay);
      }
    };
    if(item.provider==='x'){
      // The provider can deploy/cache its v2 and legacy routes independently.
      // Validate the same requested account on either route before showing it.
      for(const route of ['2/profile/',''])try{
        const value=JSON.parse((await read(`https://api.fxtwitter.com/${route}${item.handle}`)).body),user=value?.user;
        return {...media.profile({...value,user:{...user,statuses:user?.statuses??user?.tweets}},item),banner:data.image(user?.banner_url||user?.banner,'x'),verified:user?.verification?.verified===true||user?.verified===true,location:typeof user?.location==='string'?user.location.slice(0,100):'',posts:[]};
      }catch(error){signal.throwIfAborted();if(error.status===429)throw error;}
      throw Error('X profile unavailable');
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
  const jobs=KickRefinedPreviewQueue.create({api,timeout:20000,run:async(item,signal)=>({ok:true,item:await profile(item,signal)}),complete:(key,result)=>{cache.set(key,{result,until:Date.now()+(result.ok?600000:2000)});while(cache.size>50)cache.delete(cache.keys().next().value);}});
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='immersion:social-profile')return;
    try{if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(new URL(sender.url).origin))return;}catch{return;}
    const item=data.parse(message.href);if(!item){reply({ok:false});return;}
    const hit=cache.get(item.key);if(hit?.until>Date.now()&&(hit.result.ok||message.retry!==true)){reply(hit.result);return;}
    jobs.request(item.key,item,sender,message.requestId).then(reply);return true;
  });
})();
