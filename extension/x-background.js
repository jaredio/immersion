/* Event-driven metadata proxy, restricted to public X post IDs from Kick tabs. */
if(typeof importScripts==='function')importScripts('x-post-data.js');
(() => {
  const api=typeof browser!=='undefined'?browser:chrome;
  const {parse,metadata}=KickRefinedXData,cache=new Map(),pending=new Map(),queue=[];
  let active=0;
  async function fetchPost(post){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(`https://api.fxtwitter.com/${post.handle}/status/${post.id}`,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
      if(!response.ok||Number(response.headers.get('content-length'))>1048576)throw Error('Post unavailable');
      const reader=response.body.getReader(),decoder=new TextDecoder();let body='',size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();throw Error('Post too large');}body+=decoder.decode(value,{stream:true});}
      body+=decoder.decode();return metadata(JSON.parse(body),post);
    }finally{clearTimeout(timer);}
  }
  function drain(){
    while(active<2&&queue.length){const {post,resolve}=queue.shift();active++;
      fetchPost(post).then(value=>({ok:true,post:value}),()=>({ok:false})).then(result=>{
        cache.set(post.id,{result,until:Date.now()+(result.ok?120000:15000)});
        while(cache.size>80)cache.delete(cache.keys().next().value);
        pending.delete(post.id);resolve(result);
      }).finally(()=>{active--;drain();});
    }
  }
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='immersion:x-post')return;
    let origin;try{origin=new URL(sender.url).origin;}catch{return;}
    if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(origin))return;
    const post=parse(message.href);if(!post){respond({ok:false});return;}
    const hit=cache.get(post.id);if(hit?.until>Date.now()){respond(hit.result);return;}
    if(!pending.has(post.id)){
      if(queue.length>=40){respond({ok:false});return;}
      pending.set(post.id,new Promise(resolve=>queue.push({post,resolve})));drain();
    }
    pending.get(post.id).then(respond);return true;
  });
})();
if(typeof importScripts==='function')importScripts('media-background.js');
