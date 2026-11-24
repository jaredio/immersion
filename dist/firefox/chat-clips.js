/* Click-to-load clip cards. Observe only chat rows; never load a player on arrival. */
(() => {
  const metadataCSS=`.media-details{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;min-width:0;color:#9292a5;font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}.media-details:empty{display:none}.media-detail{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow-wrap:anywhere}.media-detail svg{display:block;width:14px;height:14px;flex:none;color:#77778c}.media-detail time{white-space:nowrap}`;
  function mediaDetails(data={}){
    const rawViews=data.views??data.view_count,views=typeof rawViews==='number'?rawViews:typeof rawViews==='string'&&/^\d+$/.test(rawViews)?Number(rawViews):null;
    const rawDate=data.created??data.created_at,created=typeof rawDate==='number'?rawDate:typeof rawDate==='string'?Date.parse(rawDate):0;
    return {views:Number.isSafeInteger(views)&&views>=0?views:null,created:Number.isFinite(created)&&created>0&&created<=8640000000000000?created:0,date:typeof data.date==='string'?data.date.trim().slice(0,100):'',creator:typeof data.creator==='string'?data.creator.trim().slice(0,80):''};
  }
  function renderDetails(parent,data){
    const details=mediaDetails(data),nodes=[];
    const add=(kind,path,label,text,date)=>{const node=document.createElement('span');node.className=`media-detail media-detail-${kind}`;node.title=label;node.setAttribute('aria-label',label);node.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;const value=document.createElement(date?'time':'span');value.textContent=text;if(date)value.dateTime=new Date(date).toISOString();node.append(value);nodes.push(node);};
    if(details.views!==null){const count=details.views.toLocaleString('en-US');add('views','<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',`${count} views`,`${count} views`);}
    if(details.created||details.date){const date=details.created?new Date(details.created):null,text=date?date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):details.date;add('date','<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',date?`Published ${date.toLocaleString('en-US')}`:`Published ${text}`,text,details.created);}
    if(details.creator)add('creator','<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',`Clipped by ${details.creator}`,`Clipped by ${details.creator}`);
    parent.classList.add('media-details');parent.replaceChildren(...nodes);
  }
  function parseClip(value) {
    try {
      const url=new URL(value);
      if(url.protocol!=='https:'||!['kick.com','www.kick.com'].includes(url.hostname)||url.port||url.username||url.password)return null;
      const match=url.pathname.match(/^\/([a-z0-9_]{1,40})\/clips\/(clip_[a-z0-9]{26})\/?$/i);
      const legacy=url.pathname.match(/^\/([a-z0-9_]{1,40})\/?$/i);
      const id=match?.[2]||(legacy&&/^clip_[a-z0-9]{26}$/i.test(url.searchParams.get('clip')||'')?url.searchParams.get('clip'):null);
      const channel=match?.[1]||legacy?.[1];
      return id?{id,channel,href:`https://kick.com/${channel}/clips/${id}`}:null;
    }catch{return null;}
  }
  function mediaURL(value,id) {
    try {
      const url=new URL(value);
      return url.protocol==='https:'&&url.hostname==='clips.kick.com'&&!url.port&&!url.username&&!url.password&&url.pathname.split('/').includes(id)?url.href:'';
    }catch{return '';}
  }
  function metadata(value,clip) {
    const data=value?.clip||value?.data;
    const src=mediaURL(data?.video_url||data?.clip_url||data?.playback_url,clip.id);
    if(!data||data.id!==clip.id||!src)throw Error('This clip is unavailable.');
    const creator=data.creator?.username||data.creator?.slug;
    return {...mediaDetails(data),src,poster:mediaURL(data.thumbnail_url,clip.id),title:typeof data.title==='string'?data.title.slice(0,300):'Kick clip',creator:typeof creator==='string'?creator.trim().slice(0,80):'',duration:Number.isFinite(data.duration)&&data.duration>0?data.duration:0,...globalThis.KickRefinedClipTools?.details(data,clip)};
  }
  function parseVOD(value){
    try{const url=new URL(value),match=url.pathname.match(/^\/([a-z0-9_]{1,40})\/videos\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\/?$/i);return url.protocol==='https:'&&['kick.com','www.kick.com'].includes(url.hostname)&&!url.port&&!url.username&&!url.password&&match?{id:match[2],channel:match[1],kind:'vod',href:`https://kick.com/${match[1]}/videos/${match[2]}`}:null;}catch{return null;}
  }
  function vodMetadata(data,vod){
    const stream=data?.livestream,channel=stream?.channel;
    if(data?.uuid?.toLowerCase()!==vod.id.toLowerCase()||channel?.slug?.toLowerCase()!==vod.channel.toLowerCase()||data.is_private||data.is_pruned||data.deleted_at||data.status&&data.status!=='public')throw Error('Recording unavailable');
    const url=new URL(data.source);
    if(url.protocol!=='https:'||url.hostname!=='stream.kick.com'||url.port||url.username||url.password||!url.pathname.endsWith('/media/hls/master.m3u8'))throw Error('Recording unavailable');
    const image=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.endsWith('.kick.com')&&!url.port&&!url.username&&!url.password?url.href:'';}catch{return '';}};
    return {...mediaDetails({views:stream.views??data.views??stream.view_count??data.view_count,created_at:data.created_at??stream.created_at}),src:url.href,title:typeof stream.session_title==='string'?stream.session_title.slice(0,300):'Kick recording',creator:'',credit:vod.channel,duration:Number.isFinite(stream.duration)&&stream.duration>0?stream.duration/1000:0,channelName:typeof channel.user?.username==='string'?channel.user.username.slice(0,80):vod.channel,channelImage:image(channel.user?.profilepic),poster:image(stream.thumbnail?.src)};
  }
  let hlsModule;
  function create({enabled=true,onWorkspace=null,onWorkspaceDrag=null,observeChat=true}={}) {
    const {api}=KickRefined;
    let list=null,timer=0,active=null,floating=null,disposed=false,visibility=null;
    const records=new Set(),dirty=new Set(),cache=new Map(),feedbackTimers=new Set();
    const paths={workspace:'M3 4h18v16H3zM15 4v16M18 8v8m-3-4h6',play:'m8 5 11 7-11 7z',copy:'M9 9h12v12H9zM15 9V3H3v12h6',check:'m5 12 4 4L19 6',pop:'M8 3h13v13H8zM3 8v13h13v-5M8 7h13',external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',full:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',close:'m6 6 12 12M18 6 6 18',dock:'M3 4h18v16H3zM7 15h10v5H7z'};
    const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
    const css=`
      :host{display:block;font:12px/1.4 Inter,system-ui,sans-serif;color:#ededf5;--clip-accent:var(--kr-accent,#b0ff8c);color-scheme:dark}*{box-sizing:border-box}
      button,a{font:inherit}button{cursor:pointer;color:inherit;border:1px solid #ffffff12;background:#ffffff05;border-radius:7px;padding:6px;display:inline-flex;align-items:center;justify-content:center;gap:7px}button:hover{background:#ffffff10;border-color:#ffffff28}button:disabled{opacity:.4;cursor:default}button:focus-visible,a:focus-visible{outline:2px solid var(--clip-accent);outline-offset:2px}svg{width:16px;height:16px;flex-shrink:0}a{color:#b7b7c7;text-decoration:none}a:hover{color:var(--clip-accent)}
      .card{margin:8px auto 6px;width:calc(100% - 4px);max-width:360px;border:1px solid #ffffff15;border-radius:11px;overflow:hidden;background:#131318;text-align:left}.viewport,.media{position:relative;aspect-ratio:16/9;width:100%;min-width:0;background:#09090c}.media{display:flex;align-items:center;justify-content:center}.preview{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;border-radius:0;background:linear-gradient(145deg,#1c2328,#111116);overflow:hidden}.preview img{position:absolute;width:100%;height:100%;object-fit:cover;opacity:.72}.play-mark{position:relative;display:flex;align-items:center;gap:8px;border:1px solid #ffffff30;background:#101015e8;color:#fff;font-weight:600}video{display:block;width:100%;height:100%;object-fit:contain;background:#000}.media:fullscreen{width:100vw;height:100dvh;aspect-ratio:auto}.media:fullscreen video{width:100%;height:100%}
      .info{align-items:center}.words{flex:1;min-width:0}.title{font-weight:550;font-size:12px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.channel{font-size:10px;color:#9595a6;margin-top:3px}.actions{display:flex;flex-shrink:0}.actions button,.actions a{display:inline-flex;align-items:center;justify-content:center}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;padding:14px;color:#b6b6c6;background:#111116;font-size:12px}.message[hidden], [hidden]{display:none!important}.status{padding:0 10px 9px;color:#acacbd;font-size:11px}.status:empty{display:none}.outside{display:grid;place-content:center;gap:10px;height:100%;text-align:center;color:#a7a7b8}
      .float{display:flex;flex-direction:column;width:100%;height:100%;border:1px solid #ffffff26;border-radius:12px;overflow:hidden;background:#101015;box-shadow:0 12px 45px #0008;resize:none;position:relative;min-width:260px;min-height:190px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.float header{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:move;touch-action:none;background:#1a1a21;user-select:none}.float header strong{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px}.float .media{flex:1;min-height:0;aspect-ratio:auto}.float header button{width:28px;height:28px}.float .media video{position:absolute;inset:0}.float header svg{pointer-events:none}
      .resize-grip{position:absolute;right:4px;bottom:4px;width:16px;height:16px;z-index:3;cursor:nwse-resize;touch-action:none;border-right:2px solid #85859a;border-bottom:2px solid #85859a;opacity:.7}.resize-grip:focus-visible{outline:2px solid var(--clip-accent)}
      .play-mark{width:44px;height:44px;padding:0;justify-content:center;border-radius:50%}.play-mark svg{width:22px;height:22px;margin-left:2px}.credit{font-size:10px;line-height:1.4;color:#a2a2b3;margin-top:3px;overflow-wrap:anywhere}.credit:empty{display:none}.float-heading{flex:1;min-width:0}.float-heading strong{display:block}.float-heading .credit{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      [draggable=true]{cursor:grab}:host([data-workspace]) .card{max-width:none;margin:0;border:0;border-radius:0}:host([data-workspace]) .info .words{display:none}:host([data-workspace]) .info{justify-content:flex-end}:host([data-workspace]) .workspace-add,:host([data-workspace]) .pop-button{display:none}.location{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid #ffffff14;border-radius:9px;margin-top:8px;color:#a8a8ba;font-size:11px}
      :host([data-workspace]){display:block;height:100%}:host([data-workspace]) .card{height:100%;display:flex;flex-direction:column}:host([data-workspace]) .viewport{flex:1 1 auto;min-height:0}:host([data-workspace]) .viewport>.media{position:absolute;inset:0;height:100%;aspect-ratio:auto}:host([data-workspace]) .info{flex:0 0 auto}
      .workspace-focus-surface{position:absolute;inset:0 0 48px;z-index:1;cursor:pointer}
      .float .workspace-focus-surface{display:none}
      :host([data-clip-preview]) .info,:host([data-clip-preview]) .workspace-focus-surface{display:none}
      .info{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;padding:8px 10px}.info>.title{grid-column:1/-1}.words{min-width:0}.words .channel,.words .credit{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.actions{grid-column:2;grid-row:2;align-self:center;gap:2px}.actions button,.actions a{width:24px;height:24px;padding:4px;border-radius:6px}.actions svg{width:14px;height:14px}:host([data-workspace]) .card{width:100%}:host([data-workspace]) .info>.title{display:none}:host([data-workspace]) .info{grid-template-columns:1fr}:host([data-workspace]) .actions{grid-column:1;grid-row:auto;justify-self:end}
    `;
    const byRow=new WeakMap();
    function shadow(host){const root=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=css+metadataCSS+'.float>.media-details{flex:none;padding:9px 10px;border-top:1px solid #ffffff0c}'+KickRefined.chatEmbedCSS;root.append(style);return root;}
    function button(label,symbol,action){const el=document.createElement('button');el.type='button';el.title=label;el.setAttribute('aria-label',label);el.innerHTML=icon(symbol);el.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();action(el);});return el;}
    function status(record,text=''){record.status.textContent=text;}
    function setCredit(record,text){record.credit.textContent=text;if(floating?.record===record)floating.credit.textContent=text;}
    function nativeCredit(native){return native?.querySelector('.text-neutral')?.textContent.trim().slice(0,160)||'';}
    function hideLink(record,anchor){anchor.setAttribute('data-kr-clip-link','');record.links.add(anchor);}
    async function copyLink(record,control){
      try{
        await navigator.clipboard.writeText(record.clip.href);
        if(disposed)return;
        control.innerHTML=icon('check');control.title='Link copied';control.setAttribute('aria-label','Link copied');
        const timer=setTimeout(()=>{feedbackTimers.delete(timer);if(control.isConnected){control.innerHTML=icon('copy');control.title=record.clip.kind==='vod'?'Copy recording link':'Copy clip link';control.setAttribute('aria-label',control.title);}},2000);feedbackTimers.add(timer);
      }catch{status(record,'Could not copy the link. Open the clip on Kick to copy its address.');}
    }
    function reset(record){
      clearTimeout(record.surfaceTimer);
      record.revision++;record.controller?.abort();record.controller=null;
      record.hls?.destroy();record.hls=null;
      if(record.video){record.lastSnapshot=snapshot(record);record.video.pause();record.video.removeAttribute('src');record.video.load();record.video.remove();record.video=null;}
      record.full.disabled=true;record.media.replaceChildren(record.preview);status(record);
      if(active===record)active=null;
    }
    function closeFloating(){
      if(!floating)return;
      const {record,host,cancel}=floating;floating=null;cancel?.();reset(record);host.remove();record.workspace?.ended();
      if(record.host.isConnected){record.viewport.replaceChildren(record.media);record.card.append(record.status);record.pop.disabled=false;}
      else if(record.imported&&!record.workspace){record.releaseMessage?.();record.releaseMessage=null;records.delete(record);byRow.get(record.row)?.delete(record.clip.id);}
    }
    async function fullscreen(record){
      try{if(record.media.requestFullscreen)await record.media.requestFullscreen();else record.video?.webkitEnterFullscreen?.();}
      catch{status(record,'Fullscreen is unavailable. Try the video controls.');}
    }
    function dock(record,allowDetached=false){
      if(floating?.record!==record)return;
      if(!record.host.isConnected&&!allowDetached){closeFloating();return;}
      const {host,cancel}=floating;floating=null;cancel?.();record.viewport.replaceChildren(record.media);record.card.append(record.status);record.pop.disabled=false;host.remove();if(!allowDetached)record.host.scrollIntoView({block:'nearest'});
    }
    function popout(record){
      if(floating?.record===record)return;
      closeFloating();
      const startPlayback=!record.video;
      const host=document.createElement('div');host.className='kr-clip-floating';host.style.cssText='position:fixed;right:20px;bottom:20px;width:min(440px,calc(100vw - 24px));height:290px;min-width:260px;min-height:190px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);resize:both;overflow:hidden;z-index:2147483645';
      const root=shadow(host),panel=document.createElement('div');panel.className='float';panel.setAttribute('role','region');panel.setAttribute('aria-label',record.clip.kind==='vod'?'Floating recording player':'Floating clip player');
      const header=document.createElement('header'),heading=document.createElement('div'),title=document.createElement('strong'),credit=document.createElement('div');heading.className='float-heading';credit.className='credit';title.textContent=record.title.textContent;credit.textContent=record.credit.textContent;heading.append(title,credit);header.append(heading);
      const noun=record.clip.kind==='vod'?'recording':'clip',returnLabel=record.workspace?`Return ${noun} to workspace`:`Return ${noun} to chat`;
      const standalone=record.imported&&!record.workspace;
      const back=button(standalone?'Add to workspace':returnLabel,standalone?'workspace':'dock',async()=>{if(!standalone){dock(record);return;}back.disabled=true;try{if(await onWorkspace?.(workspaceItem(record),'alongside')===false)status(record,'This video is already in the workspace, or the workspace is full.');}catch{status(record,'Could not add this video to the workspace.');}finally{back.disabled=false;}});back.disabled=standalone?!onWorkspace:!record.host.isConnected;
      header.append(back,button(`Copy ${noun} link`,'copy',control=>copyLink(record,control)),button(`Fullscreen ${noun}`,'full',()=>fullscreen(record)),button(`Close ${noun} player`,'close',closeFloating));
      const details=document.createElement('div');renderDetails(details,record.info);credit.hidden=!!record.info?.creator;
      panel.append(header,record.media,details,record.status);root.append(panel);document.body.append(host);floating={record,host,back,title,credit,details};record.pop.disabled=true;
      const outside=document.createElement('div');outside.className='outside';outside.textContent='Playing in popout';const restore=button(returnLabel,'dock',()=>dock(record));outside.append(restore);record.viewport.replaceChildren(outside);
      let position=null,drop=null;header.tabIndex=0;header.setAttribute('aria-label','Move player window');header.title='Drag to move; drop over the workspace to add this video';
      const clamp=rect=>{const width=Math.max(0,Math.min(Math.max(260,rect.width),innerWidth-16)),height=Math.max(0,Math.min(Math.max(190,rect.height),innerHeight-16));Object.assign(host.style,{right:'auto',bottom:'auto',width:`${width}px`,height:`${height}px`,left:`${Math.max(8,Math.min(innerWidth-width-8,rect.left))}px`,top:`${Math.max(8,Math.min(innerHeight-height-8,rect.top))}px`});};
      const finish=event=>{if(!position)return;const old=position;position=null;if(event?.type==='pointerup'&&drop)drop.finish(event);else drop?.cancel();drop=null;if(old.element.hasPointerCapture(old.id))old.element.releasePointerCapture(old.id);};
      const events=new AbortController();floating.cancel=()=>{finish();events.abort();};
      window.addEventListener('resize',()=>{finish();clamp(host.getBoundingClientRect());},{signal:events.signal});
      window.addEventListener('blur',()=>finish(),{signal:events.signal});
      root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeFloating();}},{signal:events.signal});
      const grip=document.createElement('div');grip.className='resize-grip';grip.tabIndex=0;grip.setAttribute('role','button');grip.setAttribute('aria-label','Resize player window');grip.title='Drag to resize';panel.append(grip);host.style.resize='none';
      const begin=(element,kind)=>{
        element.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();finish();const rect=host.getBoundingClientRect();position={x:event.clientX,y:event.clientY,rect,element,id:event.pointerId,kind};element.setPointerCapture(event.pointerId);});
        element.addEventListener('pointermove',event=>{if(!position||position.element!==element)return;const {rect,x,y,kind}=position,dx=event.clientX-x,dy=event.clientY-y;
          if(kind==='resize'){clamp({...rect.toJSON(),width:rect.width+dx,height:rect.height+dy});return;}
          clamp({...rect.toJSON(),left:rect.left+dx,top:rect.top+dy});
          if(!drop&&onWorkspaceDrag&&!record.workspace&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))drop=onWorkspaceDrag(event,{...workspaceItem(record),fromWindow:true,windowHost:host});
          drop?.move(event);
        });
        for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,finish);
        element.addEventListener('keydown',event=>{if(event.target!==element||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const rect=host.getBoundingClientRect().toJSON(),step=event.shiftKey?40:10,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;clamp(kind==='resize'?{...rect,width:rect.width+dx,height:rect.height+dy}:{...rect,left:rect.left+dx,top:rect.top+dy});});
      };
      begin(header,'move');begin(grip,'resize');
      if(startPlayback)void play(record);
    }
    async function play(record){
      // Only ordinary chat previews are exclusive. Workspace tiles own their
      // players independently; multiview controls which of them are audible.
      if(active&&active!==record&&!active.workspace){if(floating?.record===active)closeFloating();else reset(active);}
      reset(record);if(!record.workspace)active=record;
      const revision=record.revision,video=document.createElement('video');record.video=video;video.controls=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-label',record.clip.kind==='vod'?'Kick recording video':'Kick clip video');record.media.replaceChildren(video);record.full.disabled=false;focusSurface(record);
      const valid=()=>!disposed&&enabled&&record.revision===revision&&!!record.video&&(record.host.isConnected||floating?.record===record||!!record.workspace);
      const fail=reason=>{if(valid()){const detail=typeof reason==='string'?reason:video.error?.message||'Video playback failed';reset(record);record.status.title=detail;status(record,/codec|SourceBuffer|not supported/i.test(detail)?'This browser could not decode the video. Open it on Kick or try another browser.':'Could not load this video. Retry Play or open it on Kick.');}};
      video.addEventListener('error',()=>fail(),{once:true});status(record,record.clip.kind==='vod'?'Loading recording…':'Loading clip…');
      video.addEventListener('volumechange',()=>{if(record.workspace&&record.video===video&&video.muted!==record.workspaceMuted){record.workspaceMuted=video.muted;record.workspace.audio(!video.muted);}});
      video.addEventListener('ended',()=>record.workspace?.ended());
      video.addEventListener('loadedmetadata',()=>{if(record.workspace&&Number.isFinite(video.duration))record.workspace.info({...record.info,duration:video.duration});});
      video.addEventListener('play',()=>{if(record.workspace)record.workspace.audio(true);});
      video.volume=record.lastSnapshot?.volume??1;
      if(record.workspace){video.muted=record.workspaceMuted??true;}
      try {
        let data=cache.get(record.clip.id);
        if(!data||Date.now()-data.time>300000){
          const controller=new AbortController();record.controller=controller;const timeout=setTimeout(()=>controller.abort(),10000);
          try{const vod=record.clip.kind==='vod',response=await fetch(`${location.origin}/api/${vod?'v1/video':'v2/clips'}/${record.clip.id}`,{credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});if(!response.ok)throw Error('Media unavailable');const body=await response.text();if(body.length>3000000)throw Error('Response too large');data={...(vod?vodMetadata(JSON.parse(body),record.clip):metadata(JSON.parse(body),record.clip)),time:Date.now()};cache.set(record.clip.id,data);if(cache.size>50)cache.delete(cache.keys().next().value);}
          finally{clearTimeout(timeout);if(record.controller===controller)record.controller=null;}
        }
        if(!valid())return;
        data={...data,views:data.views??record.info?.views??null,created:data.created||record.info?.created||0,date:data.date||record.info?.date||'',creator:data.creator||record.info?.creator||''};
        record.info=data;record.title.textContent=data.title;if(data.creator)setCredit(record,`Clipped by ${data.creator}`);if(floating?.record===record){floating.title.textContent=data.title;floating.credit.hidden=!!data.creator;renderDetails(floating.details,data);}if(data.poster)video.poster=data.poster;record.workspace?.info(data);
        if(record.resume){const resume=record.resume;video.addEventListener('loadedmetadata',()=>{if(valid()&&Number.isFinite(video.duration))video.currentTime=Math.min(resume.time,Math.max(0,video.duration-.05));},{once:true});}
        const start=()=>{if(!valid())return;if(record.resume?.paused){status(record);return;}video.play().then(()=>{if(valid())status(record);}).catch(()=>{if(valid())status(record,'Press Play in the video controls to start.');});};
        if(/\.mp4(?:\?|$)/i.test(data.src)){video.src=data.src;start();}
        else {
          hlsModule ||= import(api.runtime.getURL('vendor/hls.light.mjs')).catch(error=>{hlsModule=null;throw error;});
          const {default:Hls}=await hlsModule;if(!valid())return;
          if(!Hls.isSupported()){if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=data.src;start();return;}throw Error('Playback unsupported');}
          // Firefox's imported-module XHR cannot attach an Origin. Fetch from the
          // content script instead; preserve HLS byte ranges and abort on teardown.
          class MediaLoader extends Hls.DefaultConfig.loader {
            load(context,config,callbacks){
              this.context=context;this.callbacks=callbacks;this.controller=new AbortController();this.stats.loading.start=performance.now();
              const headers={...context.headers};if(context.rangeEnd)headers.Range=`bytes=${context.rangeStart||0}-${context.rangeEnd-1}`;
              this.requestTimeout=setTimeout(()=>{this.stats.aborted=true;this.controller.abort();callbacks.onTimeout(this.stats,context,this.response);},config.loadPolicy?.maxLoadTimeMs||config.timeout||20000);
              fetch(context.url,{headers,credentials:'omit',referrerPolicy:'no-referrer',signal:this.controller.signal}).then(async response=>{
                this.response=response;if(!response.ok)throw Error(`HTTP ${response.status}`);this.stats.loading.first=performance.now();
                const data=context.responseType==='arraybuffer'?await response.arrayBuffer():await response.text();if(this.stats.aborted)return;
                clearTimeout(this.requestTimeout);this.stats.loading.end=performance.now();this.stats.loaded=this.stats.total=typeof data==='string'?data.length:data.byteLength;
                this.stats.bwEstimate=this.stats.total*8000/Math.max(1,this.stats.loading.end-this.stats.loading.first);
                callbacks.onProgress?.(this.stats,context,data,response);
                callbacks.onSuccess({url:response.url,data,code:response.status},this.stats,context,response);
              }).catch(error=>{clearTimeout(this.requestTimeout);if(!this.stats.aborted)callbacks.onError({code:this.response?.status||0,text:error.message},context,this.response,this.stats);});
            }
            abort(){if(this.stats.aborted)return;this.stats.aborted=true;clearTimeout(this.requestTimeout);this.controller?.abort();this.callbacks?.onAbort?.(this.stats,this.context,this.response);}
            destroy(){this.callbacks=null;if(!this.stats.loading.end)this.abort();this.context=this.response=null;}
            getResponseHeader(name){return this.response?.headers.get(name)||null;}
            getCacheAge(){return Number(this.getResponseHeader('age'))||0;}
          }
          const hls=new Hls({loader:MediaLoader,enableWorker:false,maxBufferLength:15,maxMaxBufferLength:30});record.hls=hls;
          hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){console.warn('[Immersion] Video playback failed:',data.details,data.error?.message||data.reason||'');fail(`${data.details}: ${data.error?.message||data.reason||''}`);}});
          hls.on(Hls.Events.MANIFEST_PARSED,start);hls.loadSource(data.src);hls.attachMedia(video);
        }
      }catch(error){console.warn('[Immersion] Video setup failed:',record.clip.kind||'clip',error?.message||String(error));fail(error?.message||String(error));}
    }
    function release(record){
      record.releaseMessage?.();record.releaseMessage=null;
      visibility?.unobserve(record.host);
      for(const anchor of record.links)anchor.removeAttribute('data-kr-clip-link');
      record.native?.removeAttribute('data-kr-clip-native');record.placeholder?.remove();
      if(record.workspace)return;
      records.delete(record);byRow.get(record.row)?.delete(record.clip.id);
      record.host.remove();
      if(floating?.record===record){floating.back.disabled=true;return;}
      reset(record);
    }
    function add(row,anchor,clip){
      const native=[...row.querySelectorAll('button')].find(el=>[...el.querySelectorAll('img')].some(img=>mediaURL(img.src,clip.id)));
      const image=native?.querySelector('img');
      const host=document.createElement('div');host.className='kr-chat-clip';const root=shadow(host),card=document.createElement('div');card.className='card';
      const viewport=document.createElement('div');viewport.className='viewport';const media=document.createElement('div');media.className='media';
      const preview=document.createElement('button');preview.type='button';preview.className='preview';preview.setAttribute('aria-label',`Play ${clip.channel} clip`);
      const poster=mediaURL(image?.src,clip.id);if(poster){const img=document.createElement('img');img.src=poster;img.alt='';img.loading='lazy';preview.append(img);}
      const mark=document.createElement('span');mark.className='play-mark';mark.innerHTML=icon('play');preview.title='Play clip';preview.append(mark);media.append(preview);viewport.append(media);
      const info=document.createElement('div');info.className='info';const words=document.createElement('div');words.className='words';const title=document.createElement('div');title.className='title';title.textContent=image?.alt||'Kick clip';const channel=document.createElement('div');channel.className='channel';channel.textContent=clip.channel;words.append(channel);
      const credit=document.createElement('div');credit.className='credit';words.append(credit);
      const actions=document.createElement('div');actions.className='actions';const record={row,anchor,clip,host,card,native,viewport,media,preview,title,credit,links:new Set(),status:document.createElement('div'),revision:0};record.status.className='status';record.status.setAttribute('role','status');setCredit(record,nativeCredit(native));hideLink(record,anchor);
      const cached=cache.get(clip.id);if(cached&&Date.now()-cached.time<300000){title.textContent=cached.title;if(cached.creator)setCredit(record,`Clipped by ${cached.creator}`);}
      record.pop=button('Pop out clip player','pop',()=>popout(record));record.full=button('Fullscreen clip','full',()=>fullscreen(record));record.full.disabled=true;
      const link=document.createElement('a');link.href=clip.href;link.target='_blank';link.rel='noopener noreferrer';link.title='Open clip on Kick';link.setAttribute('aria-label','Open clip on Kick');link.innerHTML=icon('external');
      record.pop.className='pop-button';record.add=button('Add clip to workspace','workspace',()=>{if(onWorkspace)void onWorkspace(workspaceItem(record),'alongside');});record.add.className='workspace-add';record.add.hidden=!onWorkspace;
      actions.append(record.add,record.pop,button('Copy clip link','copy',control=>copyLink(record,control)),record.full,link);info.append(title,words,actions);card.append(viewport,info,record.status);root.append(card);
      for(const handle of [preview,title,words,record.add]){handle.draggable=!!onWorkspaceDrag;handle.addEventListener('dragstart',event=>{if(!onWorkspaceDrag||record.workspace)return;record.dragging=true;record.suppressClick=performance.now()+1000;event.stopPropagation();event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-immersion-clip',clip.href);event.dataTransfer.setData('text/uri-list',clip.href);onWorkspaceDrag(event,workspaceItem(record));});handle.addEventListener('dragend',()=>{record.dragging=false;record.suppressClick=performance.now()+500;});}
      preview.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(performance.now()<(record.suppressClick||0))return;record.resume=null;void play(record);});
      // Isolate controls from Kick's message double-click/reply actions.
      for(const type of ['click','dblclick','keydown','keyup'])root.addEventListener(type,event=>event.stopPropagation());
      if(native)native.setAttribute('data-kr-clip-native','');
      // Match X cards at the virtual row level, outside Kick's padded message body.
      row.append(host);
      record.releaseMessage=KickRefined.chatEmbedMessage(row);
      records.add(record);if(!byRow.has(record.row))byRow.set(record.row,new Map());byRow.get(record.row).set(record.clip.id,record);
      visibility?.observe(host);
      return record;
    }
    function focusSurface(record){
      if(!record.workspace||!record.video||record.media.querySelector('.workspace-focus-surface'))return;
      // Firefox's native video controls consume double-clicks. A transparent
      // surface handles the picture area while leaving the control bar exposed.
      const surface=document.createElement('div');surface.className='workspace-focus-surface';surface.setAttribute('aria-hidden','true');surface.title='Double-click to focus clip';
      surface.addEventListener('click',event=>{event.stopPropagation();clearTimeout(record.surfaceTimer);if(event.detail!==1)return;const video=record.video;record.surfaceTimer=setTimeout(()=>{if(record.video!==video||!record.workspace)return;if(video.paused)void video.play().catch(()=>{});else video.pause();},250);});
      surface.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();clearTimeout(record.surfaceTimer);record.workspace?.focus?.();});record.media.append(surface);
    }
    function snapshot(record){const video=record.video;return {href:record.clip.href,time:video?(video.ended?0:video.currentTime||0):record.lastSnapshot?.time||0,paused:video?!video.ended&&video.paused:record.lastSnapshot?.paused??false,volume:video?.volume??record.lastSnapshot?.volume??1};}
    function workspaceItem(record){
      return {id:record.clip.id,kind:record.clip.kind||'clip',href:record.clip.href,title:record.title.textContent,
        popout:()=>popout(record),
        snapshot:()=>snapshot(record),
        freeze:()=>{const state=snapshot(record);record.video?.pause();return state;},
        resume:state=>{if(!state.paused)record.video?.play().catch(()=>{});},
        accepted:()=>{reset(record);status(record,'Added to workspace.');},
        mount(container,hooks){
          if(disposed||!enabled)throw Error('Clip players are disabled');
          if(record.workspace)throw Error('Clip is already in a workspace');
          if(floating?.record===record)dock(record,true);
          const before=snapshot(record);record.workspace=hooks;record.workspaceMuted=true;if(active===record)active=null;
          const placeholder=document.createElement('div');placeholder.className='kr-clip-location';const root=shadow(placeholder),label=document.createElement('div');label.className='location';label.textContent='Clip is in the workspace';const show=button('Show clip in workspace','workspace',()=>record.host.scrollIntoView({block:'nearest'}));label.append(show);root.append(label);
          if(record.host.isConnected)record.host.before(placeholder);record.placeholder=placeholder;
          record.host.dataset.workspace='true';container.append(record.host);hooks.info({...record.info,title:record.title.textContent,credit:record.credit.textContent,duration:Number.isFinite(record.video?.duration)?record.video.duration:record.info?.duration||0});
          if(record.video){focusSurface(record);record.video.muted=true;record.video.volume=before.volume;if(!before.paused)void record.video.play().catch(()=>{});}
          else {record.resume=record.resume||before;void play(record);}
        },
        setMuted(value){record.workspaceMuted=value;if(record.video&&record.video.muted!==value)record.video.muted=value;},
        release(){if(floating?.record===record)closeFloating();record.workspace=null;record.suppressClick=0;reset(record);delete record.host.dataset.workspace;record.placeholder?.remove();if(record.row.isConnected&&record.row.contains(record.anchor)&&parseClip(record.anchor.href)?.id===record.clip.id){record.row.append(record.host);}else{record.releaseMessage?.();record.releaseMessage=null;record.host.remove();records.delete(record);byRow.get(record.row)?.delete(record.clip.id);}},
      };
    }
    function importItem(state){
      if(disposed||!enabled)throw Error('Clip players are disabled');
      const clip=parseClip(state?.href)||parseVOD(state?.href);if(!clip||!Number.isFinite(state.time)||state.time<0||state.time>86400||typeof state.paused!=='boolean'||!Number.isFinite(state.volume)||state.volume<0||state.volume>1)throw Error('Invalid media transfer');
      const row=document.createElement('div'),anchor=document.createElement('a');anchor.href=clip.href;row.append(anchor);const record=add(row,anchor,clip);record.info=mediaDetails(state);record.imported=true;if(clip.kind==='vod')for(const element of record.host.shadowRoot.querySelectorAll('[aria-label],[title]'))for(const name of ['aria-label','title'])if(element.hasAttribute(name))element.setAttribute(name,element.getAttribute(name).replace(/clip/g,'recording'));record.title.textContent=typeof state.title==='string'?state.title.slice(0,300):clip.kind==='vod'?'Kick recording':'Kick clip';if(record.info.creator)setCredit(record,`Clipped by ${record.info.creator}`);record.resume={time:state.time,paused:state.paused};record.lastSnapshot={...state};return workspaceItem(record);
    }
    function flush(){
      timer=0;if(disposed||!enabled)return;
      for(const row of dirty){
        const previews=byRow.get(row);
        if(!previews?.size)continue;
        const inChat=list?.contains(row)&&row.hasAttribute('data-index');
        for(const record of previews.values()){
          globalThis.KickRefinedPerf?.count('chat.clipRecordsChecked');
          const sourceValid=inChat&&row.contains(record.anchor)&&parseClip(record.anchor.href)?.id===record.clip.id;
          if(!record.workspace&&!record.imported&&(!sourceValid||!record.host.isConnected)){release(record);continue;}
          if(record.workspace&&!sourceValid)record.placeholder?.remove();
          for(const anchor of record.links)if(!row.contains(anchor)||parseClip(anchor.href)?.id!==record.clip.id){anchor.removeAttribute('data-kr-clip-link');record.links.delete(anchor);}
        }
      }
      for(const row of KickRefinedDOM.drainRows(dirty)){
        if(!list?.contains(row)||!row.hasAttribute('data-index'))continue;
        const seen=new Set(byRow.get(row)?.keys());
        for(const anchor of KickRefinedDOM.links(row,'clips')){
          const clip=parseClip(anchor.href);if(!clip)continue;
          const existing=byRow.get(row)?.get(clip.id);
          if(existing){hideLink(existing,anchor);seen.add(clip.id);if(!existing.native?.isConnected){const native=[...row.querySelectorAll('button')].find(el=>[...el.querySelectorAll('img')].some(img=>mediaURL(img.src,clip.id)));if(native){existing.native=native;if(!existing.credit.textContent)setCredit(existing,nativeCredit(native));}}existing.native?.setAttribute('data-kr-clip-native','');continue;}
          if(seen.has(clip.id)||seen.size>=2)continue;seen.add(clip.id);
          if(records.size<80)add(row,anchor,clip);
        }
      }
      if(dirty.size)schedule(0);
    }
    function schedule(delay=50){if(!timer&&!disposed&&enabled)timer=KickRefinedDOM.deferChatWork(flush,delay);}
    function queue(node){
      if(node.nodeType!==1)return;
      const row=node.closest('[data-index]');if(row)dirty.add(row);
      for(const child of node.querySelectorAll('[data-index]'))dirty.add(child);
    }
    const subscription=KickRefinedDOM.subscribeChat({onContainer:refresh,onRows:rows=>{for(const row of rows)dirty.add(row);schedule();},attributes:['href','src','data-index']});
    function refresh(){
      if(disposed)return;
      const next=enabled&&observeChat?KickRefinedDOM.chat:null;
      if(next===list)return;
      visibility?.disconnect();for(const record of [...records])if(!record.workspace)release(record);dirty.clear();list=next;
      if(list){visibility=new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting&&active?.host===entry.target&&floating?.record!==active&&!active.workspace&&!active.dragging)reset(active);},{root:list});queue(list);schedule();}
    }
    function setEnabled(value){if(enabled===value)return;enabled=value;if(!enabled){for(const record of [...records])record.workspace?.remove();closeFloating();KickRefinedDOM.cancelChatWork(timer);timer=0;}subscription.setEnabled(enabled&&observeChat);refresh();}
    function destroy(){disposed=true;subscription.destroy();KickRefinedDOM.cancelChatWork(timer);for(const timer of feedbackTimers)clearTimeout(timer);feedbackTimers.clear();visibility?.disconnect();closeFloating();for(const record of [...records]){record.workspace?.remove();release(record);}cache.clear();dirty.clear();}
    const nativeStyle=document.createElement('style');nativeStyle.textContent='html[data-kr-enabled="true"] :is([data-kr-clip-native],[data-kr-clip-link]){display:none!important}';if(observeChat)document.head.append(nativeStyle);
    subscription.setEnabled(enabled&&observeChat);
    refresh();
    return {setEnabled,importItem,destroy(){destroy();nativeStyle.remove();}};
  }
  globalThis.KickRefinedClips=Object.freeze({parseClip,parseVOD,vodMetadata,mediaURL,metadata,mediaDetails,renderDetails,metadataCSS,create});
})();
