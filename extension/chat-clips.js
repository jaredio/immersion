/* Click-to-load clip cards. Observe only chat rows; never load a player on arrival. */
(() => {
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
    return {src,poster:mediaURL(data.thumbnail_url,clip.id),title:typeof data.title==='string'?data.title.slice(0,300):'Kick clip',creator:typeof creator==='string'?creator.trim().slice(0,80):'',duration:Number.isFinite(data.duration)&&data.duration>0?data.duration:0};
  }
  let hlsModule;
  function create({enabled=true,onWorkspace=null,onWorkspaceDrag=null}={}) {
    const {api}=KickRefined;
    let list=null,timer=0,active=null,floating=null,disposed=false,visibility=null;
    const records=new Set(),dirty=new Set(),cache=new Map(),feedbackTimers=new Set();
    const paths={workspace:'M3 4h18v16H3zM15 4v16M18 8v8m-3-4h6',play:'m8 5 11 7-11 7z',copy:'M9 9h12v12H9zM15 9V3H3v12h6',check:'m5 12 4 4L19 6',pop:'M8 3h13v13H8zM3 8v13h13v-5M8 7h13',external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',full:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',close:'m6 6 12 12M18 6 6 18',dock:'M3 4h18v16H3zM7 15h10v5H7z'};
    const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
    const css=`
      :host{display:block;font:12px/1.4 Inter,system-ui,sans-serif;color:#ededf5;--clip-accent:var(--kr-accent,#b0ff8c);color-scheme:dark}*{box-sizing:border-box}
      button,a{font:inherit}button{cursor:pointer;color:inherit;border:1px solid #ffffff12;background:#ffffff05;border-radius:7px;padding:6px;display:inline-flex;align-items:center;justify-content:center;gap:7px}button:hover{background:#ffffff10;border-color:#ffffff28}button:disabled{opacity:.4;cursor:default}button:focus-visible,a:focus-visible{outline:2px solid var(--clip-accent);outline-offset:2px}svg{width:16px;height:16px;flex-shrink:0}a{color:#b7b7c7;text-decoration:none}a:hover{color:var(--clip-accent)}
      .card{margin:8px auto 6px;width:calc(100% - 4px);max-width:360px;border:1px solid #ffffff15;border-radius:11px;overflow:hidden;background:#131318;text-align:left}.viewport,.media{position:relative;aspect-ratio:16/9;width:100%;min-width:0;background:#09090c}.media{display:flex;align-items:center;justify-content:center}.preview{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;border-radius:0;background:linear-gradient(145deg,#1c2328,#111116);overflow:hidden}.preview img{position:absolute;width:100%;height:100%;object-fit:cover;opacity:.72}.play-mark{position:relative;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #ffffff30;border-radius:30px;background:#101015e8;color:#fff;font-weight:600}.play-mark svg{width:19px;height:19px}video{display:block;width:100%;height:100%;object-fit:contain;background:#000}.media:fullscreen{width:100vw;height:100dvh;aspect-ratio:auto}.media:fullscreen video{width:100%;height:100%}
      .info{display:flex;align-items:center;gap:8px;padding:9px 10px}.words{flex:1;min-width:0}.title{font-weight:550;font-size:12px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.channel{font-size:10px;color:#9595a6;margin-top:3px}.actions{display:flex;gap:4px;flex-shrink:0}.actions button,.actions a{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;padding:14px;color:#b6b6c6;background:#111116;font-size:12px}.message[hidden], [hidden]{display:none!important}.status{padding:0 10px 9px;color:#acacbd;font-size:11px}.status:empty{display:none}.outside{display:grid;place-content:center;gap:10px;height:100%;text-align:center;color:#a7a7b8}
      .float{display:flex;flex-direction:column;width:100%;height:100%;border:1px solid #ffffff26;border-radius:12px;overflow:hidden;background:#101015;box-shadow:0 12px 45px #0008;resize:both;min-width:260px;min-height:190px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.float header{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:move;touch-action:none;background:#1a1a21;user-select:none}.float header strong{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px}.float .media{flex:1;min-height:0;aspect-ratio:auto}.float header button{width:28px;height:28px}.float .media video{position:absolute;inset:0}.float header svg{pointer-events:none}
      .float{resize:none}
      .play-mark{width:44px;height:44px;padding:0;justify-content:center;border-radius:50%}.play-mark svg{width:22px;height:22px;margin-left:2px}.credit{font-size:10px;line-height:1.4;color:#a2a2b3;margin-top:3px;overflow-wrap:anywhere}.credit:empty{display:none}.float-heading{flex:1;min-width:0}.float-heading strong{display:block}.float-heading .credit{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      [draggable=true]{cursor:grab}:host([data-workspace]) .card{max-width:none;margin:0;border:0;border-radius:0}:host([data-workspace]) .info .words{display:none}:host([data-workspace]) .info{justify-content:flex-end}:host([data-workspace]) .workspace-add,:host([data-workspace]) .pop-button{display:none}.location{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid #ffffff14;border-radius:9px;margin-top:8px;color:#a8a8ba;font-size:11px}
      .workspace-focus-surface{position:absolute;inset:0 0 48px;z-index:1;cursor:pointer}
      .float .workspace-focus-surface{display:none}
      .info{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;padding:8px 10px}.info>.title{grid-column:1/-1}.words{min-width:0}.words .channel,.words .credit{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.actions{grid-column:2;grid-row:2;align-self:center;gap:2px}.actions button,.actions a{width:24px;height:24px;padding:4px;border-radius:6px}.actions svg{width:14px;height:14px}:host([data-workspace]) .card{width:100%}:host([data-workspace]) .info>.title{display:none}:host([data-workspace]) .info{grid-template-columns:1fr}:host([data-workspace]) .actions{grid-column:1;grid-row:auto;justify-self:end}
    `;
    function shadow(host){const root=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=css+KickRefined.chatEmbedCSS;root.append(style);return root;}
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
        const timer=setTimeout(()=>{feedbackTimers.delete(timer);if(control.isConnected){control.innerHTML=icon('copy');control.title='Copy clip link';control.setAttribute('aria-label','Copy clip link');}},2000);feedbackTimers.add(timer);
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
      const {record,host}=floating;floating=null;reset(record);host.remove();record.workspace?.ended();
      if(record.host.isConnected){record.viewport.replaceChildren(record.media);record.card.append(record.status);record.pop.disabled=false;}
    }
    async function fullscreen(record){
      try{if(record.media.requestFullscreen)await record.media.requestFullscreen();else record.video?.webkitEnterFullscreen?.();}
      catch{status(record,'Fullscreen is unavailable. Try the video controls.');}
    }
    function dock(record){
      if(floating?.record!==record)return;
      if(!record.host.isConnected){closeFloating();return;}
      const host=floating.host;floating=null;record.viewport.replaceChildren(record.media);record.card.append(record.status);record.pop.disabled=false;host.remove();record.host.scrollIntoView({block:'nearest'});
    }
    function popout(record){
      if(floating?.record===record)return;
      closeFloating();
      if(active!==record)void play(record);
      const host=document.createElement('div');host.className='kr-clip-floating';host.style.cssText='position:fixed;right:20px;bottom:20px;width:min(440px,calc(100vw - 24px));height:290px;min-width:260px;min-height:190px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);resize:both;overflow:hidden;z-index:2147483645';
      const root=shadow(host),panel=document.createElement('div');panel.className='float';panel.setAttribute('role','region');panel.setAttribute('aria-label','Floating clip player');
      const header=document.createElement('header'),heading=document.createElement('div'),title=document.createElement('strong'),credit=document.createElement('div');heading.className='float-heading';credit.className='credit';title.textContent=record.title.textContent;credit.textContent=record.credit.textContent;heading.append(title,credit);header.append(heading);
      const returnLabel=record.workspace?'Return clip to workspace':'Return clip to chat';
      const back=button(returnLabel,'dock',()=>dock(record));back.disabled=!record.host.isConnected;
      header.append(back,button('Copy clip link','copy',control=>copyLink(record,control)),button('Fullscreen clip','full',()=>fullscreen(record)),button('Close clip player','close',closeFloating));
      panel.append(header,record.media,record.status);root.append(panel);document.body.append(host);floating={record,host,back,title,credit};record.pop.disabled=true;
      const outside=document.createElement('div');outside.className='outside';outside.textContent='Playing in popout';const restore=button(returnLabel,'dock',()=>dock(record));outside.append(restore);record.viewport.replaceChildren(outside);
      let position;
      header.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;const rect=host.getBoundingClientRect();position={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};header.setPointerCapture(event.pointerId);});
      header.addEventListener('pointermove',event=>{if(!position)return;const rect=host.getBoundingClientRect();Object.assign(host.style,{right:'auto',bottom:'auto',left:`${Math.max(0,Math.min(innerWidth-rect.width,position.left+event.clientX-position.x))}px`,top:`${Math.max(0,Math.min(innerHeight-48,position.top+event.clientY-position.y))}px`});});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(event,()=>{position=null;});
    }
    async function play(record){
      if(active&&active!==record){active.workspace?.audio(false);if(floating?.record===active)closeFloating();else reset(active);}
      reset(record);active=record;
      const revision=record.revision,video=document.createElement('video');record.video=video;video.controls=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-label','Kick clip video');record.media.replaceChildren(video);record.full.disabled=false;focusSurface(record);
      const valid=()=>!disposed&&enabled&&record.revision===revision&&!!record.video&&(record.host.isConnected||floating?.record===record||!!record.workspace);
      const fail=()=>{if(valid()){reset(record);status(record,'Could not load this clip. Retry Play or open it on Kick.');}};
      video.addEventListener('error',fail,{once:true});status(record,'Loading clip…');
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
          try{const response=await fetch(`${location.origin}/api/v2/clips/${record.clip.id}`,{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Clip unavailable');data={...metadata(await response.json(),record.clip),time:Date.now()};cache.set(record.clip.id,data);if(cache.size>50)cache.delete(cache.keys().next().value);}
          finally{clearTimeout(timeout);if(record.controller===controller)record.controller=null;}
        }
        if(!valid())return;
        record.info=data;record.title.textContent=data.title;if(floating?.record===record)floating.title.textContent=data.title;if(data.creator)setCredit(record,`Clipped by ${data.creator}`);if(data.poster)video.poster=data.poster;record.workspace?.info(data);
        if(record.resume){const resume=record.resume;video.addEventListener('loadedmetadata',()=>{if(valid()&&Number.isFinite(video.duration))video.currentTime=Math.min(resume.time,Math.max(0,video.duration-.05));},{once:true});}
        const start=()=>{if(!valid())return;if(record.resume?.paused){status(record);return;}video.play().then(()=>{if(valid())status(record);}).catch(()=>{if(valid())status(record,'Press Play in the video controls to start.');});};
        if(/\.mp4(?:\?|$)/i.test(data.src)){video.src=data.src;start();}
        else {
          hlsModule ||= import(api.runtime.getURL('vendor/hls.light.mjs')).catch(error=>{hlsModule=null;throw error;});
          const {default:Hls}=await hlsModule;if(!valid())return;
          if(!Hls.isSupported()){if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=data.src;start();return;}throw Error('Playback unsupported');}
          const hls=new Hls({enableWorker:false,maxBufferLength:15,maxMaxBufferLength:30});record.hls=hls;
          hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){console.warn('[Immersion] Clip playback failed:',data.details);fail();}});
          hls.on(Hls.Events.MANIFEST_PARSED,start);hls.loadSource(data.src);hls.attachMedia(video);
        }
      }catch{fail();}
    }
    function release(record){
      record.releaseMessage?.();record.releaseMessage=null;
      visibility?.unobserve(record.host);
      for(const anchor of record.links)anchor.removeAttribute('data-kr-clip-link');
      record.native?.removeAttribute('data-kr-clip-native');record.placeholder?.remove();
      if(record.workspace)return;
      records.delete(record);
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
      records.add(record);
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
      return {id:record.clip.id,href:record.clip.href,title:record.title.textContent,
        popout:()=>popout(record),
        snapshot:()=>snapshot(record),
        freeze:()=>{const state=snapshot(record);record.video?.pause();return state;},
        resume:state=>{if(!state.paused)record.video?.play().catch(()=>{});},
        accepted:()=>{reset(record);status(record,'Added to workspace.');},
        mount(container,hooks){
          if(disposed||!enabled)throw Error('Clip players are disabled');
          if(record.workspace)throw Error('Clip is already in a workspace');
          if(floating?.record===record)dock(record);
          const before=snapshot(record);record.workspace=hooks;record.workspaceMuted=true;
          const placeholder=document.createElement('div');placeholder.className='kr-clip-location';const root=shadow(placeholder),label=document.createElement('div');label.className='location';label.textContent='Clip is in the workspace';const show=button('Show clip in workspace','workspace',()=>record.host.scrollIntoView({block:'nearest'}));label.append(show);root.append(label);
          if(record.host.isConnected)record.host.before(placeholder);record.placeholder=placeholder;
          record.host.dataset.workspace='true';container.append(record.host);hooks.info({...record.info,title:record.title.textContent,credit:record.credit.textContent,duration:Number.isFinite(record.video?.duration)?record.video.duration:record.info?.duration||0});
          if(record.video){focusSurface(record);record.video.muted=true;record.video.volume=before.volume;if(!before.paused)void record.video.play().catch(()=>{});}
          else {record.resume=record.resume||before;void play(record);}
        },
        setMuted(value){record.workspaceMuted=value;if(record.video&&record.video.muted!==value)record.video.muted=value;},
        release(){if(floating?.record===record)closeFloating();record.workspace=null;record.suppressClick=0;reset(record);delete record.host.dataset.workspace;record.placeholder?.remove();if(record.row.isConnected&&record.row.contains(record.anchor)&&parseClip(record.anchor.href)?.id===record.clip.id){record.row.append(record.host);}else{record.releaseMessage?.();record.releaseMessage=null;record.host.remove();records.delete(record);}},
      };
    }
    function importItem(state){
      if(disposed||!enabled)throw Error('Clip players are disabled');
      const clip=parseClip(state?.href);if(!clip||!Number.isFinite(state.time)||state.time<0||state.time>86400||typeof state.paused!=='boolean'||!Number.isFinite(state.volume)||state.volume<0||state.volume>1)throw Error('Invalid clip transfer');
      const row=document.createElement('div'),anchor=document.createElement('a');anchor.href=clip.href;row.append(anchor);const record=add(row,anchor,clip);record.resume={time:state.time,paused:state.paused};record.lastSnapshot={...state};return workspaceItem(record);
    }
    function flush(){
      timer=0;if(disposed||!enabled)return;
      for(const record of records)if(!record.workspace&&(!record.row.isConnected||!record.host.isConnected||!record.row.contains(record.anchor)||parseClip(record.anchor.href)?.id!==record.clip.id))release(record);
      for(const record of records)if(record.workspace&&(!record.row.isConnected||!record.row.contains(record.anchor)||parseClip(record.anchor.href)?.id!==record.clip.id))record.placeholder?.remove();
      for(const record of records)for(const anchor of record.links)if(!record.row.contains(anchor)||parseClip(anchor.href)?.id!==record.clip.id){anchor.removeAttribute('data-kr-clip-link');record.links.delete(anchor);}
      for(const row of dirty){
        if(!row.isConnected||!list?.contains(row))continue;
        const seen=new Set();
        for(const anchor of row.querySelectorAll('a[href]')){
          const clip=parseClip(anchor.href);if(!clip)continue;
          const existing=[...records].find(record=>record.row===row&&record.clip.id===clip.id);
          if(existing){hideLink(existing,anchor);seen.add(clip.id);if(!existing.native?.isConnected){const native=[...row.querySelectorAll('button')].find(el=>[...el.querySelectorAll('img')].some(img=>mediaURL(img.src,clip.id)));if(native){existing.native=native;if(!existing.credit.textContent)setCredit(existing,nativeCredit(native));}}existing.native?.setAttribute('data-kr-clip-native','');continue;}
          if(seen.has(clip.id)||seen.size>=2)continue;seen.add(clip.id);
          if(records.size<80)add(row,anchor,clip);
        }
      }
      dirty.clear();
    }
    function schedule(){if(!timer&&!disposed&&enabled)timer=setTimeout(flush,50);}
    function queue(node,descendants=true){
      if(node.nodeType!==1)return;
      const row=node.closest('[data-index]');if(row)dirty.add(row);
      if(descendants)for(const child of node.querySelectorAll('[data-index]'))dirty.add(child);
    }
    const observer=new MutationObserver(changes=>{for(const change of changes){queue(change.target,false);for(const node of change.addedNodes)queue(node);}schedule();});
    function refresh(){
      if(disposed)return;
      const next=enabled?document.getElementById('chatroom-messages'):null;
      if(next===list)return;
      observer.disconnect();visibility?.disconnect();for(const record of [...records])if(!record.workspace)release(record);dirty.clear();list=next;
      if(list){visibility=new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting&&active?.host===entry.target&&floating?.record!==active&&!active.workspace&&!active.dragging)reset(active);},{root:list});queue(list);observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['href','src','data-index']});schedule();}
    }
    function setEnabled(value){if(enabled===value)return;enabled=value;if(!enabled){for(const record of [...records])record.workspace?.remove();closeFloating();clearTimeout(timer);timer=0;}refresh();}
    function destroy(){disposed=true;clearTimeout(timer);for(const timer of feedbackTimers)clearTimeout(timer);feedbackTimers.clear();observer.disconnect();visibility?.disconnect();closeFloating();for(const record of [...records]){record.workspace?.remove();release(record);}cache.clear();dirty.clear();}
    const nativeStyle=document.createElement('style');nativeStyle.textContent='html[data-kr-enabled="true"] :is([data-kr-clip-native],[data-kr-clip-link]){display:none!important}';document.head.append(nativeStyle);
    const routeObserver=new MutationObserver(()=>{if(enabled&&document.getElementById('chatroom-messages')!==list)refresh();});routeObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['id']});
    refresh();
    return {setEnabled,refresh,importItem,destroy(){destroy();routeObserver.disconnect();nativeStyle.remove();}};
  }
  globalThis.KickRefinedClips=Object.freeze({parseClip,mediaURL,metadata,create});
})();
