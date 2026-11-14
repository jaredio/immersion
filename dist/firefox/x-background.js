/* Event-driven metadata proxy, restricted to public X post IDs from Kick tabs. */
(() => {
  const api=typeof browser!=='undefined'?browser:chrome;
  const {parse,metadata}=KickRefinedXData,cache=new Map();
  async function fetchPost(post,signal){
    const response=await fetch(`https://api.fxtwitter.com/${post.handle}/status/${post.id}`,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal});
    if(!response.ok){await response.body?.cancel();throw Error('Post unavailable');}
    return metadata(JSON.parse(await KickRefined.readText(response,{maxBytes:1048576,signal})),post);
  }
  const jobs=KickRefinedPreviewQueue.create({api,timeout:8000,run:async(post,signal)=>({ok:true,post:await fetchPost(post,signal)}),complete:(key,result)=>{cache.set(key,{result,until:Date.now()+(result.ok?120000:15000)});while(cache.size>80)cache.delete(cache.keys().next().value);}});
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='immersion:x-post')return;
    let origin;try{origin=new URL(sender.url).origin;}catch{return;}
    if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(origin))return;
    const post=parse(message.href);if(!post){respond({ok:false});return;}
    const hit=cache.get(post.id);if(hit?.until>Date.now()&&(hit.result.ok||message.retry!==true)){respond(hit.result);return;}
    jobs.request(post.id,post,sender,message.requestId).then(respond);return true;
  });
})();
