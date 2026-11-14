/* Bounded shared requests with one lease per requesting message/frame. */
(() => {
  const allowed=(api,sender)=>{try{return sender.id===api.runtime.id&&!!sender.tab&&['https://kick.com','https://www.kick.com'].includes(new URL(sender.url).origin);}catch{return false;}};
  const token=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value);
  const owner=(sender,id)=>`${sender.tab.id}:${sender.frameId||0}:${sender.documentId||''}:${id}`;
  function create({api,run,complete,timeout=10000}){
    const pending=new Map(),leases=new Map(),queued=[];let active=0,sequence=0;
    function cancel(key){
      const lease=leases.get(key);if(!lease)return;
      leases.delete(key);lease.job.consumers.delete(key);lease.resolve({ok:false,cancelled:true});
      const job=lease.job;if(job.consumers.size)return;
      job.cancelled=true;if(pending.get(job.key)===job)pending.delete(job.key);
      const index=queued.indexOf(job);if(index>=0)queued.splice(index,1);job.controller.abort();
    }
    function drain(){while(active<2&&queued.length){
      const job=queued.shift();active++;const timer=setTimeout(()=>job.controller.abort(),timeout);
      Promise.resolve().then(()=>run(job.item,job.controller.signal)).catch(()=>({ok:false})).then(result=>{
        if(!job.cancelled)complete(job.key,result);
        if(pending.get(job.key)===job)pending.delete(job.key);
        for(const key of job.consumers){const lease=leases.get(key);if(lease){leases.delete(key);lease.resolve(result);}}
      }).finally(()=>{clearTimeout(timer);active--;drain();});
    }}
    api.runtime.onMessage.addListener((message,sender)=>{
      if(message?.type!=='immersion:preview-cancel'||!allowed(api,sender)||!token(message.requestId))return;
      cancel(owner(sender,message.requestId));
    });
    api.tabs?.onRemoved?.addListener(tabId=>{for(const [key,lease]of leases)if(lease.tabId===tabId)cancel(key);});
    return {request(key,item,sender,requestId){
      const id=token(requestId)?requestId:`legacy-${++sequence}`,leaseKey=owner(sender,id);
      if(leases.has(leaseKey))return leases.get(leaseKey).promise;
      let job=pending.get(key);
      if(!job){if(queued.length>=40)return Promise.resolve({ok:false});job={key,item,controller:new AbortController(),consumers:new Set(),cancelled:false};pending.set(key,job);queued.push(job);}
      let resolve;const promise=new Promise(done=>resolve=done);
      leases.set(leaseKey,{job,resolve,promise,tabId:sender.tab.id});job.consumers.add(leaseKey);drain();return promise;
    }};
  }
  globalThis.KickRefinedPreviewQueue=Object.freeze({create});
})();
