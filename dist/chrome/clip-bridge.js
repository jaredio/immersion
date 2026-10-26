/* Only the workspace's selected Kick chat frame may hand a clip to its parent.
 * Transfer metadata and playback position, never remote HTML or media URLs. */
(() => {
  function create({getClips,multi=null,startDrag=null,endDrag=null}={}){
    const pending=new Map(),requests=new Map(),origins=['https://kick.com','https://www.kick.com'];let disposed=false;
    const available=window.parent!==window;
    let parentOrigin=location.origin;try{const origin=new URL(document.referrer).origin;if(origins.includes(origin))parentOrigin=origin;}catch{}
    const sendParent=data=>window.parent.postMessage(data,parentOrigin);
    function register(item){const token=crypto.randomUUID(),timer=setTimeout(()=>{const entry=pending.get(token);if(entry?.state)entry.item.resume(entry.state);pending.delete(token);},30000);pending.set(token,{item,timer});return token;}
    function request(source,origin,token,mode){
      source.postMessage({type:'immersion:clip-snapshot-request',token,mode},origin);
      const timer=setTimeout(()=>requests.delete(token),8000);requests.set(token,{source,origin,mode,timer});
    }
    async function install(source,origin,token,state,mode){
      let ok=false,item;
      try{const clip=KickRefinedClips.parseClip(state?.href);if(clip&&multi.canAddClip(clip.id)){item=getClips().importItem(state);ok=await multi.addClip(item,mode);if(!ok)item.release();}}catch{item?.release();}
      if(!disposed)source.postMessage({type:'immersion:clip-transfer-result',token,ok},origin);
    }
    function onMessage(event){
      const data=event.data;if(disposed||!origins.includes(event.origin)||!data||typeof data.token!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.token))return;
      if(multi){
        if(!multi.isChatSource(event.source))return;
        if(data.type==='immersion:clip-drag-start'){
          const clip=KickRefinedClips.parseClip(data.href);if(!clip)return;
          const rect=multi.chatFrameRect();
          startDrag?.(null,{...clip,title:typeof data.title==='string'?data.title.slice(0,300):'Kick clip',x:(rect?.left||0)+(Number.isFinite(data.x)?data.x:0),y:(rect?.top||0)+(Number.isFinite(data.y)?data.y:0),commit:mode=>request(event.source,event.origin,data.token,mode)});
        }else if(data.type==='immersion:clip-drag-end')endDrag?.();
        else if(data.type==='immersion:clip-add')void install(event.source,event.origin,data.token,data.state,'alongside');
        else if(data.type==='immersion:clip-snapshot'){
          const waiting=requests.get(data.token);if(!waiting||waiting.source!==event.source)return;requests.delete(data.token);clearTimeout(waiting.timer);void install(event.source,event.origin,data.token,data.state,waiting.mode);
        }
      }else if(available&&event.source===window.parent){
        const entry=pending.get(data.token);if(!entry)return;
        if(data.type==='immersion:clip-snapshot-request'){
          entry.state=entry.item.freeze();sendParent({type:'immersion:clip-snapshot',token:data.token,state:entry.state});
        }else if(data.type==='immersion:clip-transfer-result'){
          clearTimeout(entry.timer);pending.delete(data.token);if(data.ok===true)entry.item.accepted();else if(entry.state)entry.item.resume(entry.state);
        }
      }
    }
    window.addEventListener('message',onMessage);
    return {available,
      add(item){if(!available)return;const token=register(item),entry=pending.get(token);entry.state=item.freeze();sendParent({type:'immersion:clip-add',token,state:entry.state});},
      drag(event,item){if(!available)return;const token=register(item),canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;canvas.style.cssText='position:fixed;width:1px;height:1px;pointer-events:none';document.body.append(canvas);event.dataTransfer.setDragImage(canvas,0,0);sendParent({type:'immersion:clip-drag-start',token,href:item.href,title:item.title,x:event.clientX,y:event.clientY});event.target.addEventListener('dragend',()=>{canvas.remove();sendParent({type:'immersion:clip-drag-end',token});},{once:true});},
      destroy(){disposed=true;window.removeEventListener('message',onMessage);for(const entry of pending.values()){clearTimeout(entry.timer);if(entry.state)entry.item.resume(entry.state);}for(const entry of requests.values())clearTimeout(entry.timer);pending.clear();requests.clear();},
    };
  }
  globalThis.KickRefinedClipBridge=Object.freeze({create});
})();
