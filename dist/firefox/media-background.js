/* Public previews only. No cookies, provider scripts, private APIs or unrestricted fetch proxy. */
if(typeof importScripts==='function')importScripts('media-data.js');
(() => {
  const api=typeof browser!=='undefined'?browser:chrome,data=KickRefinedMediaData;
  const cache=new Map(),pending=new Map(),queue=[];let active=0;
  async function preview(item){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    async function read(url,redirect='error'){
      const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect,signal:controller.signal});
      if(!response.ok||Number(response.headers.get('content-length'))>2097152)throw Error('Preview unavailable');
      const reader=response.body.getReader(),decoder=new TextDecoder();let body='',size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2097152){await reader.cancel();throw Error('Preview too large');}body+=decoder.decode(value,{stream:true});}
      body+=decoder.decode();return {body,url:response.url||url};
    }
    try{
      if(item.provider==='x')return data.profile(JSON.parse((await read(`https://api.fxtwitter.com/2/profile/${item.handle}`)).body),item);
      if(item.provider==='youtube')return data.oembed(JSON.parse((await read(`https://www.youtube.com/oembed?url=${encodeURIComponent(item.href)}&format=json`)).body),item);
      let target=item;
      let page=null;
      try{
        page=await read(item.href,'follow');
      }catch{if(target.kind==='shortlink'||controller.signal.aborted)throw Error('TikTok link unavailable');}
      if(page){
        const resolved=data.parse(page.url);
        if(!resolved||resolved.provider!=='tiktok'||!['video','profile'].includes(resolved.kind))throw Error('Not a public TikTok page');
        target=resolved;const metadata=data.tiktokPage(page.body,target);if(metadata)return metadata;
      }
      return data.oembed(JSON.parse((await read(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target.href)}`)).body),target);
    }finally{clearTimeout(timer);}
  }
  function drain(){while(active<2&&queue.length){const job=queue.shift();active++;
    preview(job.item).then(item=>({ok:true,item}),()=>({ok:false})).then(result=>{
      cache.set(job.item.key,{result,until:Date.now()+(result.ok?120000:15000)});while(cache.size>80)cache.delete(cache.keys().next().value);pending.delete(job.item.key);job.resolve(result);
    }).finally(()=>{active--;drain();});
  }}
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='immersion:media-preview')return;
    let origin;try{origin=new URL(sender.url).origin;}catch{return;}
    if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(origin))return;
    const item=data.parse(message.href);if(!item){reply({ok:false});return;}
    const hit=cache.get(item.key);if(hit?.until>Date.now()&&(hit.result.ok||message.retry!==true)){reply(hit.result);return;}
    if(!pending.has(item.key)){if(queue.length>=40){reply({ok:false});return;}pending.set(item.key,new Promise(resolve=>queue.push({item,resolve})));drain();}
    pending.get(item.key).then(reply);return true;
  });
})();
