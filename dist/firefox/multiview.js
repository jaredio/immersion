/* Inline multiview. The native player stays in its React-owned DOM tree. */
(() => {
    const { api, channelSlug, multiState, multiURL, channelDetails } = KickRefined;
  function create({ getChannels, onKeydown }) {
    const host = document.createElement('div'); host.id = 'kr-multi-root';
    const shadow = host.attachShadow({ mode: 'open' });
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = api.runtime.getURL('ui.css'); shadow.append(css);
    const panel = document.createElement('section'); panel.className = 'multiview inline-multi'; panel.setAttribute('aria-label','Multiview workspace');
    panel.innerHTML = `
      <div class="multi-header"><button id="multi-mix" aria-pressed="false" title="Allow sound from more than one stream">Mix audio</button><button id="multi-manage" aria-expanded="false">Manage</button><label class="multi-layout-label">Layout <select id="multi-layout" aria-label="Multiview layout"><option value="grid">Grid</option><option value="focus">Focus</option><option value="columns">Columns</option></select></label><button id="multi-mute">Mute all</button><button id="multi-fullscreen" aria-label="Fullscreen multiview">⛶</button><button class="multi-exit" aria-label="Close multiview">Single stream</button></div>
      <div class="multi-chat-bar"><label for="multi-chat-channel">Chat</label><select id="multi-chat-channel" aria-label="Chat channel"></select><a id="multi-chat-external" target="_blank" rel="noopener noreferrer" aria-label="Open chat in a new tab">↗</a><button id="multi-chat-toggle" aria-pressed="true">Hide chat</button></div>
      <div class="multi-options" hidden><div class="multi-tools"><form id="multi-add-form"><input id="multi-add" aria-label="Add channel to multiview" list="multi-suggestions" placeholder="Channel name or Kick URL" autocomplete="off" maxlength="120"><datalist id="multi-suggestions"></datalist><button type="submit">Add stream</button></form></div><div class="multi-footer"><div class="multi-save"><input id="multi-name" aria-label="Layout name" placeholder="Name this session" maxlength="48"><button id="multi-save">Save</button><select id="multi-sessions" aria-label="Saved multiview sessions"><option value="">Saved sessions…</option></select><button id="multi-delete" disabled>Delete saved</button></div><button id="multi-share">Copy link</button></div></div>
      <div id="multi-notice" class="multi-notice" role="status"></div><div class="multi-body"><div id="multi-grid" class="multi-grid"></div><aside class="multi-chat"><div class="multi-chat-mount"></div></aside></div>`;
    shadow.append(panel);
    const directory=document.createElement('section');directory.className='multi-directory';directory.setAttribute('aria-label','Open stream channels');directory.innerHTML='<div id="multi-channel-list"></div>';panel.append(directory);
    const preview=document.createElement('div');preview.className='multi-channel-preview';preview.id='multi-channel-preview';preview.popover='manual';preview.setAttribute('role','dialog');preview.setAttribute('aria-label','Channel quick view');panel.append(preview);
    const quiet=document.createElement('button');quiet.id='multi-quiet';quiet.textContent='Quiet view';quiet.setAttribute('aria-pressed','false');quiet.title='Hide categories, status labels, and the channel list';
    panel.querySelector('#multi-fullscreen').before(quiet);
    const chatTabs=document.createElement('div');chatTabs.id='multi-chat-tabs';chatTabs.setAttribute('aria-label','Switch stream chat');
    panel.querySelector('#multi-chat-toggle').before(chatTabs);
    const stage=document.createElement('div');stage.className='multi-stage';
    const gridElement=panel.querySelector('#multi-grid');gridElement.before(stage);stage.append(gridElement);
    const divider=document.createElement('div');divider.className='multi-divider';divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Resize featured stream');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-valuemin','45');divider.setAttribute('aria-valuemax','80');divider.title='Drag to resize · arrow keys to adjust · double-click to reset';stage.append(divider);
    const sizing=document.createElement('label');sizing.className='multi-sizing';sizing.innerHTML='Featured size <input type="range" min="45" max="80" value="67" aria-label="Featured stream size"><output>67%</output>';
    panel.querySelector('.multi-options').append(sizing);
    for(const type of ['keydown','kick-refined-keydown'])shadow.addEventListener(type,event=>{onKeydown?.(event);event.stopPropagation();});
    for(const type of ['keyup','keypress'])shadow.addEventListener(type,event=>event.stopPropagation());
    const $ = s => panel.querySelector(s);
    let state = multiState(), sessions = [], audio = new Set(), active = false, destroyed = false, context = null, native = null;
    let chatFrame = null, chatOverlay = null, writes = Promise.resolve(), layoutFrame = 0, catalog = new Map();
    const tiles = new Map(), paused = new Set(), nativeWired = new WeakSet(), restored = [];
    const audioSession=crypto.randomUUID();let controlRevision=0,nativeStatusFrame=0;
    const hiddenInfo=new Map();let mainMarker=null,resizing=null,resizeOwner=divider;
    const detailsCache=new Map(),detailsPending=new Set(),detailsControllers=new Set();let detailsQueue=Promise.resolve(),previewSlug='',previewTimer=0;
    const resize = new ResizeObserver(() => schedulePosition());
    const loaded = api.storage.local.get(['multiview','multiSessions']).then(data => {
      state = multiState(data.multiview);
      sessions = Array.isArray(data.multiSessions) ? data.multiSessions.filter(s=>s && typeof s.name==='string').slice(0,10).map(s=>({name:s.name.slice(0,48),state:multiState(s.state)})) : [];
    }).catch(()=>{});
    function notice(text='') { $('#multi-notice').textContent=text; }
    function persist() {
      const snapshot = { multiview:multiState(state), multiSessions:sessions.map(s=>({name:s.name,state:multiState(s.state)})) };
      writes=writes.then(()=>api.storage.local.set(snapshot)).catch(()=>notice('Could not save this workspace.'));
    }
    function canonical(input) {
      const value=input.trim();
      return /^https?:\/\//i.test(value) ? channelSlug(value)||channelSlug(value,'https://www.kick.com') : channelSlug(`/${value.replace(/^@/,'')}`);
    }
    function findContext() {
      const slug=channelSlug(location.pathname,location.origin);
      const anchor=slug && [...document.querySelectorAll('#video-player,#injected-channel-player')].find(el=>el.closest('main') && el.getBoundingClientRect().width>0);
      const main=anchor?.closest('main') || [...document.querySelectorAll('main')].find(el=>el.getBoundingClientRect().width>0);
      if(!main) return null;
      let player=anchor||null;
      while(player && player.parentElement!==main) player=player.parentElement;
      const chat=slug && [...document.querySelectorAll('#channel-chatroom')].find(el=>el.getBoundingClientRect().width>40);
      let branch=chat||null;
      if(chat) {
        let common=main.parentElement; while(common && !common.contains(chat)) common=common.parentElement;
        if(common) while(branch.parentElement!==common) branch=branch.parentElement;
      }
      return {slug,main,player,chat,branch};
    }
    function remember(element,property) {
      if(!element || restored.some(s=>s.element===element && s.property===property)) return;
      restored.push({element,property,value:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property)});
    }
    function style(element,property,value) {
      if(!element) return; remember(element,property);
      if(value==='') element.style.removeProperty(property);
      else if(element.style.getPropertyValue(property)!==value) element.style.setProperty(property,value,'important');
    }
    function restoreStyles() {
      for(const s of restored.splice(0)) { if(s.value) s.element.style.setProperty(s.property,s.value,s.priority); else s.element.style.removeProperty(s.property); }
    }
    function hideChannelInfo(){
      if(!context?.main)return;
      if(mainMarker===null)mainMarker={value:context.main.getAttribute('data-kr-multi-active')};
      context.main.dataset.krMultiActive='true';
      for(const child of context.main.children){
        if(child===host||child===context.player||child.matches('script,style,link'))continue;
        if(!hiddenInfo.has(child))hiddenInfo.set(child,child.getAttribute('data-kr-single-info'));
        if(child.dataset.krSingleInfo!=='true')child.dataset.krSingleInfo='true';
      }
    }
    function restoreChannelInfo(){
      for(const [child,value]of hiddenInfo){if(value===null)child.removeAttribute('data-kr-single-info');else child.setAttribute('data-kr-single-info',value);}hiddenInfo.clear();
      if(context?.main&&mainMarker){if(mainMarker.value===null)context.main.removeAttribute('data-kr-multi-active');else context.main.setAttribute('data-kr-multi-active',mainMarker.value);}mainMarker=null;
    }
    let singleTitle='',multiTitle='';
    const titleObserver=new MutationObserver(()=>{if(active&&context?.slug===channelSlug(location.pathname,location.origin)&&document.title!==multiTitle){singleTitle=document.title;document.title=multiTitle;}});
    function updateAudioLabel(){
      $('#multi-mix').setAttribute('aria-pressed',String(state.mixAudio));
    }
    function updateTabTitle(){multiTitle=`Multistream: ${state.channels.map(s=>catalog.get(s)?.title||s).join(' + ')} | Immersion`;if(document.title!==multiTitle)document.title=multiTitle;}
    function requestDetails(slug){
      if(detailsPending.has(slug)||Date.now()-(detailsCache.get(slug)?.time||0)<60000)return;
      detailsPending.add(slug);
      detailsQueue=detailsQueue.then(async()=>{
        if(!active||!state.channels.includes(slug))return;
        const controller=new AbortController();detailsControllers.add(controller);const timer=setTimeout(()=>controller.abort(),8000);
        try{const response=await fetch(`${location.origin}/api/v2/channels/${encodeURIComponent(slug)}`,{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Channel unavailable');
          const data=channelDetails(await response.json(),slug);detailsCache.set(slug,{time:Date.now(),data});
          if(active&&state.channels.includes(slug))render();
        }catch{detailsCache.set(slug,{time:Date.now(),data:null});}finally{clearTimeout(timer);detailsControllers.delete(controller);}
      }).finally(()=>detailsPending.delete(slug));
    }
    function closePreview(){clearTimeout(previewTimer);previewSlug='';if(preview.matches(':popover-open'))preview.hidePopover();}
    function deferPreviewClose(){clearTimeout(previewTimer);previewTimer=setTimeout(closePreview,180);}
    function showPreview(slug,anchor){
      if(!active||!anchor?.isConnected)return;clearTimeout(previewTimer);previewSlug=slug;requestDetails(slug);
      const meta=catalog.get(slug)||{},details=detailsCache.get(slug)?.data;preview.replaceChildren();
      const name=document.createElement('strong');name.textContent=meta.title||slug;
      const title=document.createElement('p');title.textContent=meta.streamTitle||(meta.live==='offline'?'Offline':'Stream title unavailable');
      const stats=document.createElement('span');stats.textContent=[meta.category,meta.viewers?`${meta.viewers} viewers`:null].filter(Boolean).join(' · ');
      const bio=document.createElement('p');bio.className='preview-bio';bio.textContent=meta.bio||'';preview.append(name,title,stats,bio);
      const links=document.createElement('div');links.className='preview-socials';
      for(const social of meta.socials||[]){const link=document.createElement('a');link.href=social.href;link.textContent=social.label;link.target='_blank';link.rel='noopener noreferrer';links.append(link);}
      if(!links.children.length){const empty=document.createElement('span');empty.textContent=details?'No socials published':'Social links unavailable';links.append(empty);}preview.append(links);
      const channel=document.createElement('a');channel.textContent=`Open ${meta.title||slug} on Kick ↗`;channel.href=`https://kick.com/${slug}`;channel.target='_blank';channel.rel='noopener noreferrer';preview.append(channel);
      const rect=anchor.getBoundingClientRect();preview.style.left=`${Math.max(8,Math.min(innerWidth-328,rect.left))}px`;preview.style.top='8px';
      if(!preview.matches(':popover-open'))preview.showPopover();preview.style.top=`${Math.max(8,Math.min(innerHeight-preview.offsetHeight-8,rect.top-preview.offsetHeight-8))}px`;
    }
    preview.addEventListener('pointerenter',()=>clearTimeout(previewTimer));preview.addEventListener('pointerleave',deferPreviewClose);
    preview.addEventListener('focusout',()=>queueMicrotask(()=>{if(!preview.contains(shadow.activeElement)&&!directory.contains(shadow.activeElement))deferPreviewClose();}));
    for(const type of ['keydown','kick-refined-keydown'])panel.addEventListener(type,event=>{if(event.key==='Escape'&&preview.matches(':popover-open')){event.preventDefault();closePreview();}});
    for(const type of ['keydown','kick-refined-keydown'])preview.addEventListener(type,event=>{if(event.key==='Escape'){event.preventDefault();closePreview();}});
    function renderDirectory(){
      const list=$('#multi-channel-list');list.replaceChildren();
      for(const slug of state.channels){
        const meta=catalog.get(slug)||{},card=document.createElement('button');card.className='multi-channel-card';card.dataset.channel=slug;card.setAttribute('aria-label',`Preview ${slug}`);card.setAttribute('aria-haspopup','dialog');
        if(meta.image){const image=document.createElement('img');image.src=meta.image;image.alt='';card.append(image);}
        const text=document.createElement('div'),name=document.createElement('strong'),title=document.createElement('span'),stats=document.createElement('small');
        name.textContent=meta.title||slug;title.textContent=meta.streamTitle||(meta.live==='offline'?'Offline':'Stream title unavailable');stats.textContent=[meta.category,meta.viewers?`${meta.viewers} viewers`:null].filter(Boolean).join(' · ');text.append(name,title,stats);card.append(text);list.append(card);
        card.addEventListener('pointerenter',()=>showPreview(slug,card));card.addEventListener('pointerleave',deferPreviewClose);card.addEventListener('focus',()=>showPreview(slug,card));card.addEventListener('click',()=>showPreview(slug,card));card.addEventListener('blur',()=>{if(!preview.contains(shadow.activeElement))deferPreviewClose();});
        requestDetails(slug);
      }
      if(previewSlug){const anchor=[...list.children].find(c=>c.dataset.channel===previewSlug);if(anchor)showPreview(previewSlug,anchor);else closePreview();}
    }
    function nativeVideo() {
      const video=context?.player?.querySelector('video')||null;
      if(video && !nativeWired.has(video)) {
        nativeWired.add(video);
        for(const type of ['volumechange','play','pause','ended'])video.addEventListener(type,()=>{
          if(!active||nativeStatusFrame)return;
          nativeStatusFrame=requestAnimationFrame(()=>{
            nativeStatusFrame=0;if(!active||nativeVideo()!==video)return;
            const tile=tiles.get(context.slug);if(!tile)return;
            tile.volume=video.volume;tile.playing=!video.paused&&!video.ended;
            tile.lastSettings=`${!audio.has(tile.slug)}:${tile.volume}`;updateControls(tile);
          });
        });
      }
      return video;
    }
    function isNative(slug) { return !!context?.player && slug===context.slug; }
    function positionNative() {
      layoutFrame=0;
      if(active && chatOverlay && context?.chat?.isConnected) {
        const r=context.chat.getBoundingClientRect(),p=context.chat.parentElement.getBoundingClientRect();
        Object.assign(chatOverlay.style,{inset:'auto',left:`${r.left-p.left+context.chat.parentElement.scrollLeft}px`,top:`${r.top-p.top+context.chat.parentElement.scrollTop}px`,width:`${r.width}px`,height:`${r.height}px`});
      }
      if(!active || !native || !context?.player?.isConnected) return;
      const tile=tiles.get(context.slug), show=!!tile;
      style(context.player,'pointer-events',show&&!resizing?'auto':'none');
      if(!show) { style(context.player,'visibility','hidden'); return; }
      const target=tile.player.getBoundingClientRect(), main=context.main.getBoundingClientRect();
      if(!target.width || !target.height) { style(context.player,'visibility','hidden'); return; }
      style(context.player,'left',`${target.left-main.left+context.main.scrollLeft-context.main.clientLeft}px`);
      style(context.player,'top',`${target.top-main.top+context.main.scrollTop-context.main.clientTop}px`);
      style(context.player,'width',`${target.width}px`); style(context.player,'height',`${target.height}px`);
      style(context.player,'visibility','visible');
    }
    function schedulePosition() { if(active && !layoutFrame) layoutFrame=requestAnimationFrame(positionNative); }
    function mountNative() {
      const video=context.player.querySelector('video');
      native={muted:video?.muted??true,wasPlaying:video?!video.paused:false,pausedByUs:false};
      if(getComputedStyle(context.main).position==='static') style(context.main,'position','relative');
      context.player.dataset.krNativePlayer='true';
      for(const [key,value] of Object.entries({position:'absolute','z-index':'2','max-height':'none','min-height':'0','aspect-ratio':'auto',overflow:'hidden',visibility:'hidden','box-sizing':'border-box'})) style(context.player,key,value);
      resize.observe(context.main); resize.observe(host);
      audio.clear();if(video&&!video.muted&&video.volume>0)audio.add(context.slug);
    }
    function command(tile,muted,{action='',force=false}={}) {
      const signature=`${muted}:${tile.volume}`;
      if(!force&&!action&&signature===tile.lastSettings)return;
      if(action)tile.pendingAction=action;
      const nextAction=action||(force?tile.pendingAction:'');
      tile.lastSettings=signature;tile.commandRevision=++controlRevision;
      if(isNative(tile.slug)) {
        const video=nativeVideo();if(!video)return;
        if(Math.abs(video.volume-tile.volume)>.001)video.volume=tile.volume;
        if(video.muted!==muted)video.muted=muted;
        if(nextAction==='play')video.play()?.catch(reason=>{if(reason?.name==='NotAllowedError')notice('Click Play inside the current stream to enable playback.');});
        if(nextAction==='pause'&&!video.paused)video.pause();tile.pendingAction='';
        tile.playing=!video.paused&&!video.ended;updateControls(tile);
      } else tile.frame?.contentWindow?.postMessage({type:'kick-refined:control',session:audioSession,revision:tile.commandRevision,muted,volume:tile.volume,...(nextAction?{action:nextAction}:{})},'https://player.kick.com');
    }
    function updateControls(tile){
      tile.listen.setAttribute('aria-pressed',String(audio.has(tile.slug)));tile.listen.textContent=audio.has(tile.slug)?'Mute':'Listen';
      tile.listen.title=audio.has(tile.slug)?'Mute this audio source':'Select this audio source';
      tile.pause.textContent=tile.playing?'Pause':'Play';tile.pause.setAttribute('aria-label',`${tile.playing?'Pause':'Play'} ${tile.slug}`);
      tile.pause.title=tile.pause.getAttribute('aria-label');
      tile.slider.value=String(Math.round(tile.volume*100));tile.level.textContent=`${Math.round(tile.volume*100)}%`;
      tile.card.dataset.audio=String(audio.has(tile.slug));tile.audible.hidden=!audio.has(tile.slug)||tile.volume<=0||!tile.playing;
    }
    function selectAudio(slug){
      const enable=!audio.has(slug);if(!state.mixAudio)audio.clear();if(enable)audio.add(slug);else audio.delete(slug);notice();
      const tile=tiles.get(slug);if(enable&&tile&&tile.volume<=0)tile.volume=tile.lastVolume||.5;
      syncAudio();if(enable&&tile)command(tile,false,{action:'play'});
    }
    function focusStream(slug){
      state.layout=state.layout==='focus'&&state.focus===slug?'grid':'focus';state.focus=slug;render();persist();
    }
    function applySizing(){
      $('#multi-grid').style.setProperty('--multi-featured',`${state.focusSize}%`);
      stage.style.setProperty('--multi-featured',`${state.focusSize}%`);
      sizing.querySelector('input').value=String(state.focusSize);sizing.querySelector('output').textContent=`${state.focusSize}%`;
      divider.setAttribute('aria-valuenow',String(state.focusSize));divider.setAttribute('aria-valuetext',`${state.focusSize}% featured stream width`);applyTileSizes();schedulePosition();
    }
    function applyTileSizes(){
      for(const [slug,tile]of tiles){
        const span=state.sizes[slug]||(state.channels.length===1?6:state.channels.length<=4?3:2);
        tile.card.style.setProperty('--tile-span',span);tile.card.dataset.span=String(span);
        const focused=state.layout==='focus',featured=slug===state.focus;
        tile.edge?.setAttribute('aria-valuemin',String(focused?(featured?45:20):2));tile.edge?.setAttribute('aria-valuemax',String(focused?(featured?80:55):6));
        tile.edge?.setAttribute('aria-valuenow',String(focused?(featured?state.focusSize:100-state.focusSize):span));
      }
      schedulePosition();
    }
    function beginResize(element,event){if(event.button!==0)return false;finishResize();event.preventDefault();resizing=event.pointerId;resizeOwner=element;element.setPointerCapture(event.pointerId);stage.dataset.resizing='true';schedulePosition();return true;}
    function syncAudio() {
      for(const [slug,tile] of tiles) { command(tile,!audio.has(slug));updateControls(tile); }
      if(context?.player&&!state.channels.includes(context.slug)) { const video=nativeVideo(); if(video&&!video.muted)video.muted=true; }
      updateAudioLabel();
    }
    function mountPlayer(slug,tile) {
      if(isNative(slug)) { tile.player.dataset.native='true';resize.observe(tile.player);tile.player.textContent='';return; }
      if(tile.frame)return;
      const frame=document.createElement('iframe'); frame.name=`kick-refined:${slug}`; frame.title=`${slug} stream`;
      frame.allow='autoplay; fullscreen; picture-in-picture'; frame.allowFullscreen=true; frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.src=`https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=true`;
      frame.addEventListener('load',()=>{if(active&&tiles.get(slug)===tile)command(tile,!audio.has(slug),{force:true});});
      tile.frame=frame; tile.player.replaceChildren(frame);
    }
    function add(input) {
      const slug=canonical(input);
      if(!slug) { notice('Enter a channel name or a Kick channel URL.'); return false; }
      if(state.channels.includes(slug)) { notice(`${catalog.get(slug)?.title||slug} is already here.`); return false; }
      if(state.channels.length>=6) { notice('Six streams are open. Remove one before adding another.'); return false; }
      state.channels.push(slug); state=multiState(state); notice(); render(); persist(); return true;
    }
    function makeTile(slug) {
      const card=document.createElement('section'); card.className='multi-tile'; card.dataset.channel=slug;
      const header=document.createElement('div'); header.className='multi-tile-header';
      const title=document.createElement('a'); title.href=`https://kick.com/${slug}`; title.target='_blank'; title.rel='noopener noreferrer'; title.textContent=catalog.get(slug)?.title||slug;
      const meta=catalog.get(slug),identity=document.createElement('div');identity.className='multi-tile-identity';
      if(meta?.image){const image=document.createElement('img');image.src=meta.image;image.alt='';image.decoding='async';identity.append(image);}
      const words=document.createElement('div'),category=document.createElement('span');category.textContent=meta?.category||'Kick stream';words.append(title,category);identity.append(words);
      const status=document.createElement('span'); status.className='live-status'; status.dataset.live=catalog.get(slug)?.live||'unknown';
      status.textContent=isNative(slug)?'Current stream':meta?.live==='live'?'Live':meta?.live==='offline'?'Offline':'';header.append(identity,status);
      header.title='Double-click the header to focus this stream or return to the grid';
      header.addEventListener('dblclick',event=>{if(event.target.closest('a,button,input'))return;event.preventDefault();focusStream(slug);});
      const player=document.createElement('div'); player.className='multi-player';
      const controls=document.createElement('div'); controls.className='multi-tile-controls';
      const video=isNative(slug)?nativeVideo():null;
      const tile={slug,card,player,frame:null,listen:null,pause:null,volume:video?.volume??1,lastVolume:.5,playing:!!video&&!video.paused,lastSettings:'',commandRevision:0,pendingAction:'',slider:null,level:null};
      const quick=document.createElement('div');quick.className='multi-quick-actions';header.append(quick);
      tile.audible=document.createElement('span');tile.audible.className='multi-audible';tile.audible.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';tile.audible.setAttribute('role','img');tile.audible.setAttribute('aria-label',`Audio enabled for ${slug}`);tile.audible.title='Audio enabled';tile.audible.hidden=true;quick.append(tile.audible);
      const button=(label,text,action,target=controls)=>{const el=document.createElement('button');el.setAttribute('aria-label',`${label} ${slug}`);el.title=`${label} ${slug}`;el.textContent=text;el.addEventListener('click',action);target.append(el);return el;};
      tile.listen=button('Listen to','Listen',()=>selectAudio(slug));
      const volume=document.createElement('label');volume.className='multi-volume';
      tile.slider=document.createElement('input');tile.slider.type='range';tile.slider.min='0';tile.slider.max='100';tile.slider.step='1';tile.slider.setAttribute('aria-label',`Volume for ${slug}`);
      tile.level=document.createElement('output');tile.level.textContent='100%';volume.append(tile.slider,tile.level);controls.append(volume);
      tile.slider.addEventListener('input',()=>{
        tile.volume=Number(tile.slider.value)/100;if(tile.volume>0)tile.lastVolume=tile.volume;
        if(tile.volume>0){if(!state.mixAudio)audio.clear();audio.add(slug);}
        syncAudio();
      });
      tile.pause=button('Play','Play',()=>{if(isNative(slug)&&native)native.pausedByUs=false;command(tile,!audio.has(slug),{action:tile.playing?'pause':'play'});});
      tile.focus=button('Focus','▣',()=>focusStream(slug));
      for(const [label,text,direction] of [['Move left','←',-1],['Move right','→',1]]) button(label,text,()=>{const i=state.channels.indexOf(slug),j=i+direction;if(j>=0&&j<state.channels.length){[state.channels[i],state.channels[j]]=[state.channels[j],state.channels[i]];render();persist();}});
      button('Fullscreen','⛶',()=>{
        if(isNative(slug))context.player.querySelector('[data-testid="video-player-fullscreen"]')?.click();
        else tile.card.requestFullscreen().catch(()=>notice('Use the player fullscreen control if fullscreen is unavailable.'));
      },quick);
      button('Remove','×',()=>{
        state.channels=state.channels.filter(s=>s!==slug);state=multiState(state);paused.delete(slug);audio.delete(slug);
        if(isNative(slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}
        persist();
        if(state.channels.length===1 && state.channels[0]!==context.slug) {
          const remaining=state.channels[0],link=getChannels().find(c=>c.slug===remaining)?.link;
          close({restorePlayback:false});if(link?.isConnected)link.click();else location.assign(`/${remaining}`);
        } else if(state.channels.length<=1) close(); else render();
      },quick);
      const edge=document.createElement('div');edge.className='multi-tile-resize';edge.tabIndex=0;edge.setAttribute('role','separator');edge.setAttribute('aria-label',`Resize ${slug}`);edge.setAttribute('aria-orientation','vertical');edge.setAttribute('aria-valuemin','2');edge.setAttribute('aria-valuemax','6');edge.title='Drag the edge to resize; arrow keys adjust, double-click resets';tile.edge=edge;
      let dragWidth=0,dragStart=0;
      edge.addEventListener('pointerdown',event=>{if(beginResize(edge,event)){dragWidth=card.getBoundingClientRect().width;dragStart=event.clientX;}});
      edge.addEventListener('pointermove',event=>{
        if(resizing!==event.pointerId||resizeOwner!==edge)return;
        const width=gridElement.getBoundingClientRect().width,desired=dragWidth+event.clientX-dragStart;
        if(state.layout==='focus'){state.focusSize=Math.max(45,Math.min(80,Math.round((slug===state.focus?desired:width-desired)/width*100)));applySizing();}
        else {state.layout='grid';gridElement.dataset.layout='grid';stage.dataset.layout='grid';$('#multi-layout').value='grid';state.sizes[slug]=Math.max(2,Math.min(6,Math.round(desired/width*6)));applyTileSizes();}
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])edge.addEventListener(type,finishResize);
      const edgeKey=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(state.layout==='focus'){state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?2:-2)));applySizing();}else{state.layout='grid';state.sizes[slug]=event.key==='Home'?2:event.key==='End'?6:Math.max(2,Math.min(6,(Number(card.dataset.span)||3)+(event.key==='ArrowRight'?1:-1)));render();}persist();};
      for(const type of ['keydown','kick-refined-keydown'])edge.addEventListener(type,edgeKey);
      edge.addEventListener('dblclick',()=>{delete state.sizes[slug];state.focusSize=67;render();persist();});
      card.append(header,player,controls,edge);return tile;
    }
    function chatMount() {
      if(!context.chat) return $('.multi-chat-mount');
      if(!chatOverlay){chatOverlay=document.createElement('div');chatOverlay.id='kr-multi-chat';chatOverlay.style.cssText='position:absolute;inset:0;z-index:5;background:#0e0e11';if(getComputedStyle(context.chat.parentElement).position==='static')style(context.chat.parentElement,'position','relative');context.chat.parentElement.append(chatOverlay);}
      return chatOverlay;
    }
    function renderChat() {
      const useNative=!!context.chat,original=state.chat===context.slug;panel.dataset.nativeChat=String(useNative);
      $('.multi-chat').hidden=useNative||!state.chatVisible||!state.chat;
      if(useNative){
        const prior=restored.find(s=>s.element===context.branch&&s.property==='display');
        style(context.branch,'display',state.chatVisible?(prior?.value??context.branch.style.getPropertyValue('display')):'none');
        style(context.chat,'visibility',state.chatVisible&&original?'visible':'hidden');
      }
      const needsFrame=state.chatVisible&&state.chat&&!(useNative&&original);
      const url=state.chat?`https://kick.com/popout/${encodeURIComponent(state.chat)}/chat`:'https://kick.com';$('#multi-chat-external').href=url;
      if(needsFrame){if(!chatFrame){chatFrame=document.createElement('iframe');chatFrame.title='Selected stream chat';chatFrame.style.cssText='width:100%;height:100%;border:0;display:block';chatMount().append(chatFrame);}if(chatFrame.getAttribute('src')!==url)chatFrame.src=url;if(chatOverlay)chatOverlay.hidden=false;}
      else {chatFrame?.remove();chatFrame=null;if(chatOverlay)chatOverlay.hidden=true;}
      $('#multi-chat-toggle').setAttribute('aria-pressed',String(state.chatVisible));$('#multi-chat-toggle').textContent=state.chatVisible?'Hide chat':'Show chat';
      for(const button of chatTabs.children)button.setAttribute('aria-pressed',String(state.chat===button.dataset.channel));
    }
    function render() {
      if(!active||destroyed)return;
      state=multiState(state);catalog=new Map(getChannels().map(c=>[c.slug,c]));
      for(const slug of state.channels){const details=detailsCache.get(slug)?.data;if(details)catalog.set(slug,{...catalog.get(slug),...details,image:details.image||catalog.get(slug)?.image||''});}
      if(native && !state.channels.includes(context.slug)) { const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();} }
      else if(native?.pausedByUs && native.wasPlaying && !paused.has(context.slug)) { const v=nativeVideo();native.pausedByUs=false;if(v?.paused)v.play().catch(()=>{}); }
      const grid=$('#multi-grid');grid.dataset.layout=state.layout;grid.dataset.count=state.channels.length;
      stage.dataset.layout=state.layout;divider.hidden=state.layout!=='focus'||state.channels.length<2;applySizing();
      panel.dataset.quiet=String(state.quiet);quiet.setAttribute('aria-pressed',String(state.quiet));
      grid.style.setProperty('--multi-columns',state.channels.length<=1?1:state.channels.length<=4?2:3);grid.style.setProperty('--multi-count',Math.max(1,state.channels.length));grid.style.setProperty('--multi-focus-rows',Math.max(1,state.channels.length-1));
      for(const [slug,tile]of tiles)if(!state.channels.includes(slug)){resize.unobserve(tile.player);tile.card.remove();tiles.delete(slug);}
      grid.querySelector('.multi-empty')?.remove();
      if(!state.channels.length){const empty=document.createElement('div');empty.className='multi-empty';empty.textContent='Drag a channel from the sidebar, or add one using Manage.';grid.append(empty);}
      state.channels.forEach((slug,index)=>{let tile=tiles.get(slug);if(!tile){tile=makeTile(slug);tiles.set(slug,tile);grid.append(tile.card);}tile.card.style.order=state.layout==='focus'&&state.focus===slug?-1:index;tile.card.dataset.featured=String(state.focus===slug);tile.focus.textContent=state.layout==='focus'&&state.focus===slug?'▦':'▣';tile.focus.title=state.layout==='focus'&&state.focus===slug?'Return to grid':'Focus stream';tile.focus.setAttribute('aria-label',state.layout==='focus'&&state.focus===slug?`Return to grid for ${slug}`:`Focus ${slug}`);tile.focus.setAttribute('aria-pressed',String(state.layout==='focus'&&state.focus===slug));mountPlayer(slug,tile);});
      for(const [slug,tile]of tiles){const meta=catalog.get(slug);if(meta){tile.card.querySelector('.multi-tile-identity a').textContent=meta.title||slug;tile.card.querySelector('.multi-tile-identity span').textContent=meta.category||'Kick stream';const status=tile.card.querySelector('.live-status');status.dataset.live=meta.live||'unknown';status.textContent=isNative(slug)?'Current stream':meta.live==='live'?'Live':meta.live==='offline'?'Offline':'';}}
      applyTileSizes();$('#multi-layout').value=state.layout;
      const select=$('#multi-chat-channel');select.replaceChildren(...state.channels.map(s=>new Option(catalog.get(s)?.title||s,s)));select.value=state.chat;
      chatTabs.replaceChildren(...state.channels.map(slug=>{
        const button=document.createElement('button');button.dataset.channel=slug;button.setAttribute('aria-label',`Show ${slug} chat`);button.title=`Open ${catalog.get(slug)?.title||slug} chat`;
        const meta=catalog.get(slug);if(meta?.image){const image=document.createElement('img');image.src=meta.image;image.alt='';button.append(image);}
        const name=document.createElement('span');name.textContent=meta?.title||slug;button.append(name);
        button.addEventListener('click',()=>{state.chat=slug;state.chatVisible=true;render();persist();});return button;
      }));
      hideChannelInfo();renderChat();syncAudio();updateTabTitle();renderDirectory();positionNative();schedulePosition();
      const saved=$('#multi-sessions'),choice=saved.value;saved.replaceChildren(new Option('Saved sessions…',''),...sessions.map((s,i)=>new Option(s.name,String(i))));saved.value=choice;$('#multi-delete').disabled=saved.value==='';
      $('#multi-suggestions').replaceChildren(...[...catalog.values()].map(c=>new Option(c.slug,c.slug)));
    }
    async function activate(seeds=[],current='',shared=null,fresh=false) {
      await loaded;if(destroyed)return;
      if(!active){
        context=findContext();if(!context)return;
        $('.multi-options').hidden=true;$('#multi-manage').setAttribute('aria-expanded','false');$('#multi-add').value='';notice();
        if(shared)state=multiState(shared);else if(fresh)state=multiState({channels:current?[current]:[]});else if(current)state=multiState({...state,channels:[current,...state.channels.filter(s=>s!==current)].slice(0,6)});
        active=true;singleTitle=document.title;titleObserver.observe(document.head,{childList:true,subtree:true,characterData:true});if(context.player)context.player.before(host);else context.main.prepend(host);if(context.player)mountNative();else audio.clear();
      } else if(shared){state=multiState(shared);audio.clear();paused.clear();}
      for(const slug of seeds)if(!state.channels.includes(slug))add(slug);
      render();persist();
    }
    function close({restorePlayback=true}={}) {
      if(!active)return;finishResize();closePreview();for(const controller of detailsControllers)controller.abort();active=false;cancelAnimationFrame(layoutFrame);layoutFrame=0;resize.disconnect();
      cancelAnimationFrame(nativeStatusFrame);nativeStatusFrame=0;
      for(const tile of tiles.values())tile.card.remove();tiles.clear();chatFrame?.remove();chatFrame=null;chatOverlay?.remove();chatOverlay=null;paused.clear();
      const video=context?.player?.querySelector('video');if(document.fullscreenElement===context?.main)document.exitFullscreen().catch(()=>{});
      restoreStyles();restoreChannelInfo();if(context?.player)delete context.player.dataset.krNativePlayer;
      if(video&&native){video.muted=native.muted;if(restorePlayback&&native.wasPlaying&&native.pausedByUs&&video.paused)video.play().catch(()=>{});}
      titleObserver.disconnect();if(context?.slug===channelSlug(location.pathname,location.origin))document.title=singleTitle;else if(document.title===multiTitle)document.title='Kick';host.remove();native=null;context=null;audio.clear();
    }
    function refresh(){if(active&&(!host.isConnected||(context?.player&&!context.player.isConnected)||context?.slug!==channelSlug(location.pathname,location.origin)))close({restorePlayback:false});else if(active){hideChannelInfo();schedulePosition();}}
    function onMessage(event){
      if(!active||event.origin!=='https://player.kick.com')return;
      const entry=[...tiles].find(([,tile])=>tile.frame?.contentWindow===event.source);if(!entry)return;
      const [slug,tile]=entry,data=event.data;
      if(data?.type==='kick-refined:ready'){command(tile,!audio.has(slug),{force:true});return;}
      if(data?.type!=='kick-refined:status'||data.session!==audioSession||data.revision!==tile.commandRevision)return;
      if(data.hasVideo)tile.pendingAction='';
      if(typeof data.playing==='boolean')tile.playing=data.playing;
      if(Number.isFinite(data.volume)&&data.volume>=0&&data.volume<=1){tile.volume=data.volume;if(tile.volume>0)tile.lastVolume=tile.volume;tile.lastSettings=`${!audio.has(slug)}:${tile.volume}`;}
      updateControls(tile);
      if(data.error==='NotAllowedError'&&audio.has(slug))notice(`Click “Enable playback” inside ${catalog.get(slug)?.title||slug} to allow sound in Firefox.`);
    }
    window.addEventListener('message',onMessage);window.addEventListener('resize',schedulePosition);document.addEventListener('fullscreenchange',schedulePosition);
    $('.multi-exit').addEventListener('click',()=>close());
    $('#multi-manage').addEventListener('click',()=>{const show=$('.multi-options').hidden;$('.multi-options').hidden=!show;$('#multi-manage').setAttribute('aria-expanded',String(show));schedulePosition();});
    $('#multi-add-form').addEventListener('submit',e=>{e.preventDefault();if(add($('#multi-add').value))$('#multi-add').value='';});
    $('#multi-layout').addEventListener('change',e=>{state.layout=e.target.value;render();persist();});
    quiet.addEventListener('click',()=>{state.quiet=!state.quiet;render();persist();});
    sizing.querySelector('input').addEventListener('input',event=>{state.focusSize=Number(event.target.value);applySizing();});
    sizing.querySelector('input').addEventListener('change',persist);
    divider.addEventListener('pointerdown',event=>{
      beginResize(divider,event);
    });
    divider.addEventListener('pointermove',event=>{
      if(resizing!==event.pointerId||resizeOwner!==divider)return;const rect=gridElement.getBoundingClientRect();
      state.focusSize=Math.max(45,Math.min(80,Math.round((event.clientX-rect.left)/rect.width*100)));applySizing();
    });
    function finishResize(){if(resizing===null)return;const pointer=resizing;resizing=null;delete stage.dataset.resizing;if(resizeOwner.hasPointerCapture(pointer))resizeOwner.releasePointerCapture(pointer);persist();schedulePosition();}
    for(const type of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(type,finishResize);
    divider.addEventListener('dblclick',()=>{state.focusSize=67;applySizing();persist();});
    const dividerKey=event=>{const step=event.shiftKey?5:1;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?step:-step)));applySizing();persist();}};
    for(const type of ['keydown','kick-refined-keydown'])divider.addEventListener(type,dividerKey);
    $('#multi-mix').addEventListener('click',()=>{state.mixAudio=!state.mixAudio;if(!state.mixAudio&&audio.size>1){const first=audio.values().next().value;audio.clear();audio.add(first);}syncAudio();persist();});
    $('#multi-mute').addEventListener('click',()=>{audio.clear();syncAudio();});
    $('#multi-chat-toggle').addEventListener('click',()=>{state.chatVisible=!state.chatVisible;render();persist();});
    $('#multi-chat-channel').addEventListener('change',e=>{state.chat=e.target.value;render();persist();});
    $('#multi-fullscreen').addEventListener('click',()=>{const target=context?.main;if(!target)return;const request=document.fullscreenElement===target?document.exitFullscreen():target.requestFullscreen();request.catch(()=>notice('Use the browser fullscreen shortcut if fullscreen is unavailable.'));});
    $('#multi-save').addEventListener('click',()=>{const name=$('#multi-name').value.trim().slice(0,48);if(!name||!state.channels.length)return notice('Add a stream and name this session before saving.');const i=sessions.findIndex(s=>s.name===name),session={name,state:multiState(state)};if(i>=0)sessions[i]=session;else sessions=[session,...sessions].slice(0,10);persist();render();notice(`Saved “${name}”.`);});
    $('#multi-sessions').addEventListener('change',e=>{if(e.target.value===''){$('#multi-delete').disabled=true;return;}const session=sessions[Number(e.target.value)];if(!session)return;state=multiState(session.state);paused.clear();audio.clear();$('#multi-name').value=session.name;if(native&&!state.channels.includes(context.slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}render();persist();notice(`Loaded “${session.name}”.`);});
    $('#multi-delete').addEventListener('click',()=>{const choice=$('#multi-sessions').value;if(choice==='')return;sessions.splice(Number(choice),1);$('#multi-sessions').value='';persist();render();notice('Saved session deleted.');});
    $('#multi-share').addEventListener('click',async()=>{if(!state.channels.length)return notice('Add a stream before sharing.');const url=multiURL(state);try{await navigator.clipboard.writeText(url);notice('Link copied. Recipients need Immersion installed.');}catch{$('#multi-add').value=url;$('#multi-add').select();notice('Copy the selected link.');}});
    function dropPreview(slug){
      const current=findContext();if(!current)return null;
      const next=active?multiState(state):multiState({channels:current.slug?[current.slug]:[]});
      const duplicate=next.channels.includes(slug),full=next.channels.length>=6;
      if(!duplicate&&!full)next.channels.push(slug);
      const channels=new Map(getChannels().map(c=>[c.slug,c]));
      const workspace=document.createElement('div');workspace.className='multiview inline-multi drag-preview';workspace.dataset.nativeChat=String(!!current.chat);workspace.setAttribute('aria-hidden','true');
      for(const selector of ['.multi-header','.multi-chat-bar']){const previewBar=panel.querySelector(selector).cloneNode(true);previewBar.classList.add('preview-chrome');workspace.append(previewBar);}
      if(full&&!duplicate){const note=document.createElement('div');note.className='preview-unavailable';note.textContent='Six streams open · remove one before adding another';workspace.append(note);}
      if(active&&!$('.multi-options').hidden){const spacer=document.createElement('div');spacer.style.height=`${$('.multi-options').getBoundingClientRect().height}px`;workspace.append(spacer);}
      const body=document.createElement('div');body.className='multi-body';
      const stage=document.createElement('div');stage.className='multi-stage';const grid=document.createElement('div');grid.className='multi-grid';grid.dataset.layout=next.layout;grid.dataset.count=next.channels.length;
      grid.style.setProperty('--multi-featured',`${next.focusSize}%`);grid.style.setProperty('--multi-columns',next.channels.length<=4?2:3);grid.style.setProperty('--multi-count',next.channels.length);grid.style.setProperty('--multi-focus-rows',Math.max(1,next.channels.length-1));
      for(const [index,name]of next.channels.entries()){
        const meta=channels.get(name),card=document.createElement('div');card.className='multi-tile preview-tile';card.dataset.featured=String(next.focus===name);card.dataset.incoming=String(name===slug);card.style.order=next.layout==='focus'&&next.focus===name?-1:index;card.style.setProperty('--tile-span',next.sizes[name]||(next.channels.length<=4?3:2));
        const header=document.createElement('div');header.className='multi-tile-header';header.textContent=meta?.title||name;
        const player=document.createElement('div');player.className='multi-player';
        if(name===slug){const mark=document.createElement('div');mark.className='preview-placement';const label=document.createElement('strong'),hint=document.createElement('span');label.textContent=duplicate?'Already open':full?'Six streams open':'Drop here';hint.textContent=duplicate?'Choose another channel':full?'Remove a stream first':`Add ${meta?.title||name}`;mark.append(label,hint);player.append(mark);}
        const footer=document.createElement('div');footer.className='multi-tile-controls';footer.style.height='38px';card.append(header,player,footer);grid.append(card);
      }
      stage.append(grid);body.append(stage);workspace.append(body);
      return {element:workspace,allowed:!duplicate&&!full};
    }
    return {open:(seeds,current,shared)=>activate(seeds,current,shared),drop:(slug,current)=>!active&&slug===current?Promise.resolve():activate([slug],current,null,!active),close,refresh,isActive:()=>active,getDropMain:()=>findContext()?.main,dropPreview,destroy:()=>{close({restorePlayback:false});destroyed=true;window.removeEventListener('message',onMessage);window.removeEventListener('resize',schedulePosition);document.removeEventListener('fullscreenchange',schedulePosition);}};
  }
  globalThis.KickRefinedMulti=Object.freeze({create});
})();
