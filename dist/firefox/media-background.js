/* Public previews only. No cookies, provider scripts, private APIs or unrestricted fetch proxy. */
(() => {
  const api=typeof browser!=='undefined'?browser:chrome,data=KickRefinedMediaData;
  const cache=new Map();
  async function preview(item,signal){
    async function read(url,redirect='error'){
      const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect,signal});
      if(!response.ok){await response.body?.cancel();throw Error('Preview unavailable');}
      const body=await KickRefined.readText(response,{signal});return {body,url:response.url||url};
    }
    if(item.provider==='x')return data.profile(JSON.parse((await read(`https://api.fxtwitter.com/2/profile/${item.handle}`)).body),item);
    if(item.provider==='youtube')return data.oembed(JSON.parse((await read(`https://www.youtube.com/oembed?url=${encodeURIComponent(item.href)}&format=json`)).body),item);
    let target=item;
    let page=null;
    try{
      page=await read(item.href,'follow');
    }catch{if(target.kind==='shortlink'||signal.aborted)throw Error('TikTok link unavailable');}
    if(page){
      const resolved=data.parse(page.url);
      if(!resolved||resolved.provider!=='tiktok'||!['video','profile'].includes(resolved.kind))throw Error('Not a public TikTok page');
      target=resolved;const metadata=data.tiktokPage(page.body,target);if(metadata)return metadata;
    }
    return data.oembed(JSON.parse((await read(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target.href)}`)).body),target);
  }
  const jobs=KickRefinedPreviewQueue.create({api,run:async(item,signal)=>({ok:true,item:await preview(item,signal)}),complete:(key,result)=>{cache.set(key,{result,until:Date.now()+(result.ok?120000:15000)});while(cache.size>80)cache.delete(cache.keys().next().value);}});
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='immersion:media-preview')return;
    let origin;try{origin=new URL(sender.url).origin;}catch{return;}
    if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(origin))return;
    const item=data.parse(message.href);if(!item){reply({ok:false});return;}
    const hit=cache.get(item.key);if(hit?.until>Date.now()&&(hit.result.ok||message.retry!==true)){reply(hit.result);return;}
    jobs.request(item.key,item,sender,message.requestId).then(reply);return true;
  });
})();
