/* Inline multiview. The native player stays in its React-owned DOM tree. */
(() => {
  const { channelSlug, multiState, multiURL } = KickRefined;
  function create({ getChannels, onKeydown, support, channelPanel }) {
    const {host,shadow,panel,directory,chatTabs,toolbarToggle,stage,gridElement,divider,sizing,$,decorate} =
      KickRefinedMultiView.create({onKeydown,onPosition:schedulePosition});
    let channelVersion=0;
    let state = multiState(), sessions = [], audio = new Set(), active = false, destroyed = false, context = null, native = null, toolbarHidden = false;
    let chatFrame = null, chatOverlay = null,chatPicker=null,chatPickerRoot=null,chatHeader=null, railDirty = true, catalog = new Map();
    const tiles = new Map(), paused = new Set(), nativeWired = new WeakSet();
    const {style,restoreStyles,originalStyle}=KickRefinedMultiLayout.createStyles();
    const findContext=KickRefinedMultiLayout.findContext;
    const clipTiles=new Map();let clipFocus='',clipReturn=null,retainedChat='';
    const focusKey=()=>clipFocus||state.focus;
    const tileCount=()=>state.channels.length+clipTiles.size;
    function selectedChat(){return clipTiles.size?retainedChat||state.chat:state.chat;}
    function chatChannels(){return [...new Set([...state.channels,...(clipTiles.size&&retainedChat?[retainedChat]:[])])];}
    function discardClips(){for(const [key,tile]of clipTiles){resize.unobserve(tile.player);tile.item.release();tile.card.remove();audio.delete(key);}clipTiles.clear();clipFocus='';clipReturn=null;retainedChat='';}
    let nativeStatusFrame=0,listeningVolume=1,savedVolume=false;
    const hiddenInfo=new Map();let mainMarker=null,resizing=null,resizeOwner=divider;
    const nativeOverlaySelector='#user-identity,[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],[data-radix-portal],[data-floating-ui-portal]';
    let expandedChannel='';
    const metadata=KickRefinedMultiMetadata.create({
      support,isWanted:slug=>active&&state.channels.includes(slug),
      onChannel:slug=>{if(active&&state.channels.includes(slug))render();},
      onPanels:slug=>{if(active&&expandedChannel===slug)renderDirectory();}
    });
    const sessionStore=KickRefinedMultiSession.create({onError:()=>{if(!destroyed)notice('Could not save this workspace.');}});
    const playerBus=KickRefinedMultiPlayerBus.create({
      isActive:()=>active,
      onReady:tile=>command(tile,!audio.has(tile.slug),{force:true}),
      onAudioIntent:acceptAudioIntent,
      onFocus:tile=>focusStream(tile.slug),
      onHover:(tile,hovered)=>{tile.card.dataset.hovered=String(hovered);},
      onStatus:receivePlayerStatus
    });
    const layoutScheduler=KickRefinedMultiLayout.createScheduler({isActive:()=>active,run:positionNative});
    const resize = new ResizeObserver(() => {railDirty=true;schedulePosition();});
    const loaded=sessionStore.load().then(data=>{
      if(destroyed)return;
      listeningVolume=data.multiVolume||1;savedVolume=data.savedVolume;
      toolbarHidden=data.multiToolbarHidden;state=data.multiview;sessions=data.multiSessions;
      updateToolbar();
    });
    function notice(text='') { $('#multi-notice').textContent=text; }
    function updateToolbar() {
      panel.dataset.toolbarHidden=String(toolbarHidden);
      const label=toolbarHidden?'Show settings bar':'Hide settings bar';
      toolbarToggle.setAttribute('aria-label',label);toolbarToggle.setAttribute('aria-expanded',String(!toolbarHidden));
      decorate(toolbarToggle,'chevron',label,true);schedulePosition();
    }
    toolbarToggle.addEventListener('click',()=>{toolbarHidden=!toolbarHidden;updateToolbar();persist();});
    updateToolbar();
    function persist() {
      const snapshot = { multiVolume:listeningVolume, multiview:state, multiToolbarHidden:toolbarHidden, multiSessions:sessions };
      sessionStore.save(snapshot);
    }
    function canonical(input) {
      const value=input.trim();
      return /^https?:\/\//i.test(value) ? channelSlug(value)||channelSlug(value,'https://www.kick.com') : channelSlug(`/${value.replace(/^@/,'')}`);
    }
    function hideChannelInfo(){
      if(!context?.main)return;
      if(mainMarker===null)mainMarker={value:context.main.getAttribute('data-kr-multi-active')};
      context.main.dataset.krMultiActive='true';
      for(const child of context.main.children){
        if(child.matches(nativeOverlaySelector)||child.querySelector(nativeOverlaySelector)){restoreInfoChild(child);continue;}
        if(child===host||child===context.player||child.matches('script,style,link'))continue;
        if(!hiddenInfo.has(child))hiddenInfo.set(child,child.getAttribute('data-kr-single-info'));
        if(child.dataset.krSingleInfo!=='true')child.dataset.krSingleInfo='true';
      }
    }
    function restoreInfoChild(child){
      if(!hiddenInfo.has(child))return;const value=hiddenInfo.get(child);
      if(value===null)child.removeAttribute('data-kr-single-info');else child.setAttribute('data-kr-single-info',value);hiddenInfo.delete(child);
    }
    function restoreChannelInfo(){
      for(const child of hiddenInfo.keys())restoreInfoChild(child);
      if(context?.main&&mainMarker){if(mainMarker.value===null)context.main.removeAttribute('data-kr-multi-active');else context.main.setAttribute('data-kr-multi-active',mainMarker.value);}mainMarker=null;
    }
    let singleTitle='',multiTitle='',nativeHoverCleanup=null,nativeGestureUntil=0;
    const titleObserver=new MutationObserver(()=>{if(active&&context?.slug===channelSlug(location.pathname,location.origin)&&document.title!==multiTitle){singleTitle=document.title;document.title=multiTitle;}});
    function updateAudioLabel(){
      $('#multi-mix').setAttribute('aria-pressed',String(state.mixAudio));
    }
    function updateTabTitle(){
      // document.title collapses whitespace. Compare the same normalized string
      // so an empty stream list cannot cause an endless mutation-observer loop.
      multiTitle=(state.channels.length?`Multistream: ${state.channels.map(s=>catalog.get(s)?.title||s).join(' + ')} | Immersion`:'Clip workspace | Immersion').replace(/\s+/g,' ').trim();
      if(document.title!==multiTitle)document.title=multiTitle;
    }
    function renderDirectory(){
        const list=$('#multi-channel-list'),visible=state.layout==='focus'?[state.focus]:state.channels,focus=shadow.activeElement,focused=focus?.classList.contains('channel-expand')?focus.dataset.channel:'',action=focus?.dataset.kind,actionChannel=focus?.closest('.multi-channel-card')?.dataset.channel;list.replaceChildren();directory.dataset.focused=String(state.layout==='focus');if(!visible.includes(expandedChannel))expandedChannel='';
        for(const slug of visible){if(!slug)continue;const meta=catalog.get(slug)||{};const entry=channelPanel.card(slug,meta,{expanded:expandedChannel===slug,panels:metadata.panels(slug),onToggle:()=>{expandedChannel=expandedChannel===slug?'':slug;renderDirectory();if(expandedChannel){metadata.requestChannel(slug);metadata.requestPanels(slug);}}});list.append(entry);if(expandedChannel===slug)metadata.requestPanels(slug);metadata.requestChannel(slug);if(focused===slug)entry.querySelector('.channel-expand')?.focus({preventScroll:true});else if(action&&actionChannel===slug)entry.querySelector(`.channel-action[data-kind="${action}"]`)?.focus({preventScroll:true});}channelVersion=channelPanel.version;
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
            tile.playing=!video.paused&&!video.ended;
            if(video.muted!==!audio.has(tile.slug)||Math.abs(video.volume-tile.volume)>.001){if(Date.now()<nativeGestureUntil)acceptAudioIntent(tile,video.muted,video.volume);else command(tile,!audio.has(tile.slug),{force:true});}else updateControls(tile);
          });
        });
      }
      return video;
    }
    function isNative(slug) { return !!context?.player && slug===context.slug; }
    function positionNative() {
      if(active&&railDirty){
        railDirty=false;
        // Explicit rail rows pack secondary tiles without moving their frames.
        const grid=$('#multi-grid'),all=new Map([...tiles,...clipTiles]),rail=[...all.values()].filter(tile=>tile.slug!==focusKey()),featured=all.get(focusKey());
        let rows='',minimum='';
        if(state.layout==='focus'&&stage.clientWidth>640&&innerWidth>900&&rail.length&&featured){
          const heights=rail.map(tile=>Math.ceil(tile.card.getBoundingClientRect().height));rows=heights.map(height=>`${height}px`).join(' ');
          minimum=`${Math.ceil(Math.max(featured.card.getBoundingClientRect().height,heights.reduce((sum,height)=>sum+height,0)+10*(rail.length-1)))}px`;
        }
        if(grid.style.gridTemplateRows!==rows)grid.style.gridTemplateRows=rows;
        if(grid.style.minHeight!==minimum)grid.style.minHeight=minimum;
      }
      let chatBox=null,playerBox=null;
      if(active && chatOverlay && context?.chat?.isConnected) {
        const r=context.chat.getBoundingClientRect(),p=context.chat.parentElement.getBoundingClientRect();
        chatBox={inset:'auto',left:`${r.left-p.left+context.chat.parentElement.scrollLeft}px`,top:`${(chatHeader?.isConnected?chatHeader.getBoundingClientRect().bottom:r.top)-p.top+context.chat.parentElement.scrollTop}px`,width:`${r.width}px`,height:`${Math.max(0,r.bottom-(chatHeader?.isConnected?chatHeader.getBoundingClientRect().bottom:r.top))}px`};
      }
      const mounted=active&&native&&context?.player?.isConnected,tile=mounted?tiles.get(context.slug):null,show=!!tile;
      if(show){
        syncNativeChrome(tile);
        const target=tile.player.getBoundingClientRect(),main=context.main.getBoundingClientRect();
        if(target.width&&target.height)playerBox={left:`${target.left-main.left+context.main.scrollLeft-context.main.clientLeft}px`,top:`${target.top-main.top+context.main.scrollTop-context.main.clientTop}px`,width:`${target.width}px`,height:`${target.height}px`};
        if(playerBox){
          if(state.layout==='columns'){
            const grid=gridElement.getBoundingClientRect(),left=Math.min(target.width,Math.max(0,grid.left-target.left)),right=Math.min(target.width,Math.max(0,target.right-grid.right));
            playerBox['clip-path']=`inset(0px ${right}px 0px ${left}px)`;
          }else playerBox['clip-path']='none';
        }
      }
      // Read both surfaces before writing either one; don't invalidate layout in between.
      if(chatBox)for(const [key,value]of Object.entries(chatBox))if(chatOverlay.style[key]!==value)chatOverlay.style[key]=value;
      if(!mounted)return;
      style(context.player,'pointer-events',show&&!resizing?'auto':'none');
      if(!playerBox) { style(context.player,'visibility','hidden'); return; }
      for(const [key,value]of Object.entries(playerBox))style(context.player,key,value);
      style(context.player,'visibility','visible');
    }
    function schedulePosition() { layoutScheduler.schedule(); }
    function mountNative() {
      const video=context.player.querySelector('video');
      const hover=event=>{const tile=tiles.get(context?.slug);if(tile)tile.card.dataset.hovered=String(event.type==='pointerenter');};context.player.addEventListener('pointerenter',hover);context.player.addEventListener('pointerleave',hover);const gesture=event=>{if(event.type==='pointermove'&&!event.buttons)return;const control=event.target.closest?.('button,input,[role=slider]');if(control&&/volume|sound|speaker|mute|slider|range/i.test([control.getAttribute('aria-label'),control.title,control.getAttribute('role'),control.getAttribute('type'),control.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ')))nativeGestureUntil=Date.now()+1500;};context.player.addEventListener('pointerdown',gesture,true);context.player.addEventListener('pointermove',gesture,true);context.player.addEventListener('keydown',gesture,true);nativeHoverCleanup=()=>{context?.player?.removeEventListener('pointerdown',gesture,true);context?.player?.removeEventListener('pointermove',gesture,true);context?.player?.removeEventListener('keydown',gesture,true);context?.player?.removeEventListener('pointerenter',hover);context?.player?.removeEventListener('pointerleave',hover);};
      if(!savedVolume&&video?.volume>0)listeningVolume=video.volume;
      native={muted:video?.muted??true,wasPlaying:video?!video.paused:false,pausedByUs:false};
      if(getComputedStyle(context.main).position==='static') style(context.main,'position','relative');
      context.player.dataset.krNativePlayer='true';
      for(const [key,value] of Object.entries({position:'absolute','z-index':'2','max-height':'none','min-height':'0','aspect-ratio':'auto',overflow:'clip',transition:'none',visibility:'hidden','box-sizing':'border-box'})) style(context.player,key,value);
      resize.observe(context.main); resize.observe(host);
      audio.clear();if(video&&!video.muted&&video.volume>0)audio.add(context.slug);
    }
    function acceptAudioIntent(tile,muted,volume){
      if(!Number.isFinite(volume)||volume<0||volume>1)return;
      tile.volume=volume;if(volume>0){tile.lastVolume=volume;if(!state.mixAudio){listeningVolume=volume;savedVolume=true;}}
      if(!state.mixAudio)audio.clear();if(!muted&&volume>0)audio.add(tile.slug);else audio.delete(tile.slug);tile.lastSettings='';syncAudio();persist();
    }
    function syncNativeChrome(tile){
      const ready=globalThis.KickRefinedPlayerControls?.sync(context?.player,{getVideo:nativeVideo,getState:()=>({muted:!audio.has(tile.slug),volume:tile.volume,focused:state.layout==='focus'&&focusKey()===tile.slug}),onToggle:()=>{if(native)native.pausedByUs=false;command(tile,!audio.has(tile.slug),{action:nativeVideo()?.paused?'play':'pause'});syncNativeChrome(tile);},onVolume:(muted,volume)=>{acceptAudioIntent(tile,muted,volume);syncNativeChrome(tile);},onFocus:()=>focusStream(tile.slug)});
      if(ready)tile.card.dataset.nativeChrome='true';
    }
    function openNativeSettings(tile){
      const scope=context?.player;if(!scope)return;
      const menus=[...scope.querySelectorAll('button[aria-haspopup="menu"]')];
      const button=scope.querySelector('button[aria-label*="settings" i],button[aria-label*="quality" i],button:has(svg[data-ds-icon="Settings"]),button:has(svg[data-ds-icon="Gear"])')||menus.at(-1);
      if(!button){notice('Kick player settings are not available yet.');return;}
      button.click();
      requestAnimationFrame(()=>{const menu=document.getElementById(button.getAttribute('aria-controls'))||document.querySelector('[role="menu"][data-state="open"]');const wrapper=menu?.closest('[data-radix-popper-content-wrapper]');if(!wrapper)return;const rect=tile.settings.getBoundingClientRect(),size=wrapper.getBoundingClientRect();style(wrapper,'position','fixed');style(wrapper,'transform','none');style(wrapper,'left',`${Math.max(8,Math.min(rect.right-size.width,innerWidth-size.width-8))}px`);style(wrapper,'top',`${Math.max(8,rect.top-size.height-8)}px`);});
    }
    function command(tile,muted,{action='',force=false}={}) {
      const signature=`${muted}:${tile.volume}:${state.layout==='focus'&&focusKey()===tile.slug}`;
      const actual=isNative(tile.slug)?nativeVideo():null;
      if(!force&&!action&&signature===tile.lastSettings&&(!isNative(tile.slug)||(actual&&actual.muted===muted&&Math.abs(actual.volume-tile.volume)<=.001)))return;
      if(['play','pause'].includes(action))tile.pendingAction=action;
      const nextAction=action||(force?tile.pendingAction:'');
      tile.lastSettings=signature;tile.commandRevision=playerBus.nextRevision();
      if(isNative(tile.slug)) {
        const video=nativeVideo();if(!video)return;
        if(Math.abs(video.volume-tile.volume)>.001)video.volume=tile.volume;
        if(video.muted!==muted)video.muted=muted;
        if(nextAction==='play')video.play()?.catch(reason=>{if(reason?.name==='NotAllowedError')notice('Click Play inside the current stream to enable playback.');});
        if(nextAction==='pause'&&!video.paused)video.pause();tile.pendingAction='';
        tile.playing=!video.paused&&!video.ended;updateControls(tile);
      } else playerBus.send(tile,{muted,volume:tile.volume,focused:state.layout==='focus'&&focusKey()===tile.slug,accent:getComputedStyle(document.documentElement).getPropertyValue('--kr-accent').trim(),...(nextAction?{action:nextAction}:{})});
    }
    function updateAudioButton(button,selected,label,volume=1){
      const on=selected&&volume>0;
      decorate(button,on?(volume<.5?'soundLow':'sound'):'mute',`Audio for ${label}`,true);
      button.classList.add('multi-audio-toggle');button.setAttribute('aria-label',`Audio for ${label}`);
      button.setAttribute('aria-pressed',String(on));button.dataset.audioState=on?'on':'off';button.title=`${on?'Mute':'Unmute'} ${label}`;
    }
    function updateControls(tile){
      if(tile.playerModeControl){const label=tile.embedFallback?`Use full player for ${tile.slug}`:`Switch ${tile.slug} to standard embed`;tile.playerModeControl.hidden=isNative(tile.slug)||state.playerMode!=='full'||(!tile.fullReady&&!tile.embedFallback);if(tile.playerModeControl.getAttribute('aria-label')!==label){tile.playerModeControl.setAttribute('aria-label',label);tile.playerModeControl.title=label;}}
      tile.card.dataset.playing=String(tile.playing);
      const on=audio.has(tile.slug)&&tile.volume>0;
      updateAudioButton(tile.listen,on,tile.slug,tile.volume);
      decorate(tile.pause,tile.playing?'pause':'play',tile.playing?'Pause':'Play',true);tile.pause.setAttribute('aria-label',`${tile.playing?'Pause':'Play'} ${tile.slug}`);tile.pause.title=tile.pause.getAttribute('aria-label');
      tile.slider.value=String(Math.round(tile.volume*100));tile.level.textContent=`${Math.round(tile.volume*100)}%`;
      tile.slider.style.setProperty('--volume-percent',`${Math.round(tile.volume*100)}%`);
      tile.slider.setAttribute('aria-valuetext',`${Math.round(tile.volume*100)}%${on?'':', muted'}`);
      tile.audioControl.dataset.active=String(on);tile.card.dataset.audio=String(on);tile.audible.hidden=true;
    }
    function selectAudio(slug,{enable=!(audio.has(slug)&&(tiles.get(slug)?.volume??1)>0)}={}){
      if(!state.mixAudio)audio.clear();if(enable)audio.add(slug);else audio.delete(slug);notice();
      const tile=tiles.get(slug);if(enable&&tile){if(!state.mixAudio)tile.volume=listeningVolume;else if(tile.volume<=0)tile.volume=tile.lastVolume||.5;tile.lastVolume=tile.volume;}
      syncAudio();if(enable&&tile)command(tile,false,{action:'play'});
    }
    function focusStream(slug){
      const featured=!clipFocus&&state.layout==='focus'&&state.focus===slug;clipFocus='';
      selectAudio(slug,{enable:true});
      if(clipTiles.size)retainedChat=slug;
      state.layout=featured?'grid':'focus';state.focus=slug;state.chat=slug;state.chatVisible=true;expandedChannel='';render();persist();
    }
    function applySizing(){
      $('#multi-grid').style.setProperty('--multi-featured',`${state.focusSize}%`);
      stage.style.setProperty('--multi-featured',`${state.focusSize}%`);
      sizing.querySelector('input').value=String(state.focusSize);sizing.querySelector('output').textContent=`${state.focusSize}%`;
      divider.setAttribute('aria-valuenow',String(state.focusSize));divider.setAttribute('aria-valuetext',`${state.focusSize}% featured stream width`);applyTileSizes();schedulePosition();
    }
    function applyTileSizes(){
      railDirty=true;
      for(const [slug,tile]of tiles){
        const span=state.sizes[slug]||(tileCount()===1?6:tileCount()<=4?3:2);
        tile.card.style.setProperty('--tile-span',span);tile.card.dataset.span=String(span);
        const focused=state.layout==='focus',featured=slug===focusKey();
        tile.edge?.setAttribute('aria-valuemin',String(focused?(featured?45:20):2));tile.edge?.setAttribute('aria-valuemax',String(focused?(featured?80:55):6));
        tile.edge?.setAttribute('aria-valuenow',String(focused?(featured?state.focusSize:100-state.focusSize):span));
      }
      schedulePosition();
    }
    function beginResize(element,event){if(event.button!==0)return false;finishResize();event.preventDefault();resizing=event.pointerId;resizeOwner=element;element.setPointerCapture(event.pointerId);stage.dataset.resizing='true';schedulePosition();return true;}
    function syncAudio() {
      if(!audio.has(context?.slug))nativeGestureUntil=0;
      for(const slug of audio)if(!tiles.has(slug)&&!clipTiles.has(slug))audio.delete(slug);
      if(!state.mixAudio&&audio.size>1){const selected=audio.has(focusKey())?focusKey():[...audio].at(-1);audio.clear();if(selected)audio.add(selected);}
      // Silence previous owners before enabling the selected stream.
      for(const [key,tile]of clipTiles)if(!audio.has(key))tile.item.setMuted(true);
      for(const [slug,tile]of tiles)if(!audio.has(slug)){command(tile,true);updateControls(tile);}
      for(const [slug,tile]of tiles)if(audio.has(slug)){command(tile,false);updateControls(tile);}
      for(const [key,tile]of clipTiles){tile.item.setMuted(!audio.has(key));tile.card.dataset.audio=String(audio.has(key));updateAudioButton(tile.listen,audio.has(key),`clip ${tile.item.id}`,tile.item.snapshot().volume);}
      if(context?.player&&!state.channels.includes(context.slug)) { const video=nativeVideo(); if(video&&!video.muted)video.muted=true; }
      updateAudioLabel();
    }
    function dropPlayerFrame(tile){
      clearTimeout(tile.loadTimer);tile.loadTimer=0;playerBus.detach(tile);tile.frame?.remove();tile.frame=null;tile.frameOrigin='';tile.fullReady=false;tile.lastSettings='';delete tile.card.dataset.nativeChrome;
    }
    function playerLoadFailed(tile,message){
      if(!active||tiles.get(tile.slug)!==tile||tile.frameMode!=='full'||tile.fullReady)return;
      tile.loading.hidden=false;tile.loadMessage.textContent=message;tile.retry.hidden=false;
    }
    function mountPlayer(slug,tile) {
      if(isNative(slug)) { tile.player.dataset.native='true';resize.observe(tile.player);tile.player.textContent='';return; }
      const mode=state.playerMode==='full'&&!tile.embedFallback?'full':'embed';
      if(tile.frame&&tile.frameMode===mode)return;
      if(tile.frame)dropPlayerFrame(tile);
      tile.frameMode=mode;tile.fullReady=false;tile.card.dataset.playerMode=tile.embedFallback?'embed-fallback':mode;
      const frame=document.createElement('iframe');frame.name=`kick-refined${mode==='full'?'-full':''}:${slug}`;frame.title=`${slug} ${mode==='full'?'full player':'stream'}`;
      frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
      tile.frameOrigin=mode==='full'?location.origin:'https://player.kick.com';
      frame.src=mode==='full'?`${location.origin}/${encodeURIComponent(slug)}?immersion-frame=full`:`https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=true`;
      frame.addEventListener('pointerenter',()=>tile.card.dataset.hovered='true');
      frame.addEventListener('load',()=>{if(active&&tiles.get(slug)===tile&&tile.frame===frame)command(tile,!audio.has(slug),{force:true});});
      frame.addEventListener('error',()=>playerLoadFailed(tile,'Kick could not load the full player.'));
      const loading=document.createElement('div');loading.className='multi-player-loading';loading.hidden=mode!=='full';
      const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Loading full Kick player...';tile.loadMessage=message;
      const fallback=document.createElement('button');fallback.type='button';fallback.textContent='Use standard embed';fallback.setAttribute('aria-label',`Use embed for ${slug}`);fallback.addEventListener('click',()=>{tile.embedFallback=true;dropPlayerFrame(tile);mountPlayer(slug,tile);syncAudio();});
      const retry=document.createElement('button');retry.type='button';retry.textContent='Retry full player';retry.setAttribute('aria-label',`Retry full player for ${slug}`);retry.hidden=true;retry.addEventListener('click',()=>{tile.embedFallback=false;dropPlayerFrame(tile);mountPlayer(slug,tile);syncAudio();});tile.retry=retry;
      loading.append(message,fallback,retry);tile.loading=loading;tile.frame=frame;tile.player.replaceChildren(frame,loading);playerBus.attach(tile);
      if(mode==='full'){if(!tile.pendingAction)tile.pendingAction=tile.playing||!tile.everLoaded?'play':'pause';tile.loadTimer=setTimeout(()=>playerLoadFailed(tile,'The full player is taking longer than expected. You can retry or use an embed.'),20000);}
    }
    function add(input) {
      const slug=canonical(input);
      if(!slug) { notice('Enter a channel name or a Kick channel URL.'); return false; }
      if(state.channels.includes(slug)) { notice(`${catalog.get(slug)?.title||slug} is already here.`); return false; }
      if(tileCount()>=6) { notice('Six tiles are open. Remove one before adding another.'); return false; }
      state.channels.push(slug); state=multiState(state); notice(); render(); persist(); return true;
    }
    function makeTile(slug) {
      const card=document.createElement('section'); card.className='multi-tile'; card.dataset.channel=slug;card.addEventListener('pointerenter',()=>card.dataset.hovered='true');card.addEventListener('pointerleave',()=>card.dataset.hovered='false');
      const header=document.createElement('div'); header.className='multi-tile-header';
      const title=document.createElement('a'); title.href=`https://kick.com/${slug}`; title.target='_blank'; title.rel='noopener noreferrer'; title.textContent=catalog.get(slug)?.title||slug;
      const meta=catalog.get(slug),identity=document.createElement('div');identity.className='multi-tile-identity';
      const photo=document.createElement('img');photo.alt='';photo.decoding='async';if(meta?.image)photo.src=meta.image;else photo.hidden=true;identity.append(photo);
      const words=document.createElement('div'),category=document.createElement('span');category.textContent=meta?.category||'Kick stream';words.append(title,category);identity.append(words);
      const status=document.createElement('span'); status.className='live-status'; status.dataset.live=catalog.get(slug)?.live||'unknown';
      status.textContent=isNative(slug)?'Current stream':meta?.live==='live'?'Live':meta?.live==='offline'?'Offline':'';header.append(identity,status);
      header.title='Double-click the header to focus this stream or return to the grid';
      header.addEventListener('dblclick',event=>{if(event.target.closest('a,button,input'))return;event.preventDefault();focusStream(slug);});
      const player=document.createElement('div'); player.className='multi-player';
      const controls=document.createElement('div'); controls.className='multi-tile-controls';
      const video=isNative(slug)?nativeVideo():null;
      const tile={slug,card,player,frame:null,listen:null,pause:null,volume:video?.volume??listeningVolume,lastVolume:video?.volume>0?video.volume:listeningVolume,playing:!!video&&!video.paused,lastSettings:'',commandRevision:0,pendingAction:'',slider:null,level:null};
      const quick=document.createElement('div');quick.className='multi-quick-actions';header.append(quick);
      tile.audible=document.createElement('span');tile.audible.className='multi-audible';tile.audible.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';tile.audible.setAttribute('role','img');tile.audible.setAttribute('aria-label',`Audio enabled for ${slug}`);tile.audible.title='Audio enabled';tile.audible.hidden=true;quick.append(tile.audible);
      const button=(label,text,action,target=controls)=>{const el=document.createElement('button');el.setAttribute('aria-label',`${label} ${slug}`);el.title=`${label} ${slug}`;decorate(el,({'Listen to':'sound',Play:'play',Focus:'focus','Move left':'left','Move right':'right',Fullscreen:'fullscreen',Remove:'close','Player settings':'settings','Switch player':'single'})[label],label,true);el.addEventListener('click',action);target.append(el);return el;};
      tile.listen=button('Listen to','Listen',()=>selectAudio(slug));
      const audioControl=document.createElement('div');audioControl.className='multi-audio-control';tile.audioControl=audioControl;tile.controls=controls;controls.addEventListener('pointerenter',()=>card.dataset.hovered='true');controls.append(audioControl);audioControl.append(tile.listen);
      const volume=document.createElement('label');volume.className='multi-volume';
      tile.slider=document.createElement('input');tile.slider.type='range';tile.slider.min='0';tile.slider.max='100';tile.slider.step='1';tile.slider.setAttribute('aria-label',`Volume for ${slug}`);
      tile.level=document.createElement('output');tile.level.textContent='100%';volume.append(tile.slider,tile.level);audioControl.append(volume);
      tile.slider.addEventListener('input',()=>{
        tile.volume=Number(tile.slider.value)/100;if(tile.volume>0){tile.lastVolume=tile.volume;if(!state.mixAudio){listeningVolume=tile.volume;savedVolume=true;}}
        if(tile.volume>0){if(!state.mixAudio)audio.clear();audio.add(slug);}else audio.delete(slug);
        syncAudio();
      });
      tile.slider.addEventListener('change',persist);
      tile.pause=button('Play','Play',()=>{if(isNative(slug)&&native)native.pausedByUs=false;command(tile,!audio.has(slug),{action:tile.playing?'pause':'play'});});
      tile.settings=button('Player settings','settings',()=>{if(isNative(slug))openNativeSettings(tile);else command(tile,!audio.has(slug),{action:'settings'});});
      tile.focus=button('Focus','▣',()=>focusStream(slug));
      tile.playerModeControl=button('Switch player','single',()=>{tile.embedFallback=!tile.embedFallback;tile.pendingAction=tile.playing?'play':'pause';dropPlayerFrame(tile);mountPlayer(slug,tile);syncAudio();},quick);tile.playerModeControl.hidden=true;
      button('Fullscreen','⛶',()=>{
        if(isNative(slug))context.player.querySelector('[data-testid="video-player-fullscreen"]')?.click();
        else tile.card.requestFullscreen().catch(()=>notice('Use the player fullscreen control if fullscreen is unavailable.'));
      },quick);
      button('Remove','×',()=>{
        state.channels=state.channels.filter(s=>s!==slug);state=multiState(state);paused.delete(slug);audio.delete(slug);
        if(isNative(slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}
        persist();
        if(clipTiles.size){if(!state.channels.includes(state.chat))state.chat=state.channels[0]||'';render();return;}
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
        if(state.layout==='focus'){state.focusSize=Math.max(45,Math.min(80,Math.round((slug===focusKey()?desired:width-desired)/width*100)));applySizing();}
        else {state.layout='grid';gridElement.dataset.layout='grid';stage.dataset.layout='grid';$('#multi-layout').value='grid';state.sizes[slug]=Math.max(2,Math.min(6,Math.round(desired/width*6)));applyTileSizes();}
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])edge.addEventListener(type,finishResize);
      const edgeKey=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(state.layout==='focus'){state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?2:-2)));applySizing();}else{state.layout='grid';state.sizes[slug]=event.key==='Home'?2:event.key==='End'?6:Math.max(2,Math.min(6,(Number(card.dataset.span)||3)+(event.key==='ArrowRight'?1:-1)));render();}persist();};
      for(const type of ['keydown','kick-refined-keydown'])edge.addEventListener(type,edgeKey);
      edge.addEventListener('dblclick',()=>{delete state.sizes[slug];state.focusSize=74;render();persist();});
      card.append(header,player,controls,edge);if(isNative(slug)){card.dataset.nativePlayer='true';}return tile;
    }
    function chatMount() {
      if(!context.chat) return $('.multi-chat-mount');
      if(!chatOverlay){chatOverlay=document.createElement('div');chatOverlay.id='kr-multi-chat';chatOverlay.style.cssText='position:absolute;inset:0;z-index:5;background:#0e0e11';if(getComputedStyle(context.chat.parentElement).position==='static')style(context.chat.parentElement,'position','relative');context.chat.parentElement.append(chatOverlay);}
      return chatOverlay;
    }
    function syncChatPicker(){
      if(!context?.chat)return;
      if(!chatPicker?.isConnected){
        chatPicker?.remove();chatPicker=chatPickerRoot=chatHeader=null;
        const label=[...context.chat.querySelectorAll('h2,h3,span,div')].find(node=>!node.children.length&&/^(?:stream )?chat$/i.test(node.textContent.trim())&&!node.closest('button,#chatroom-messages'));
        chatHeader=context.chat.querySelector('header')||(label?.parentElement===context.chat?label:label?.parentElement);
        if(!chatHeader)return;
        if(label&&label!==chatHeader)style(label,'visibility','hidden');
        if(getComputedStyle(chatHeader).position==='static')style(chatHeader,'position','relative');
        chatPicker=document.createElement('div');chatPicker.id='kr-multi-chat-picker';chatPicker.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;max-width:70%;visibility:visible';
        chatPickerRoot=chatPicker.attachShadow({mode:'open'});const css=document.createElement('style');css.textContent=':host{color:var(--kr-accent,#b0ff8c);font:600 13px/1.4 Inter,system-ui,sans-serif}.picker{display:flex;align-items:center;gap:7px;max-width:100%;padding:4px 8px;background:#111115;border:1px solid #ffffff12;border-radius:8px}.picker img{width:22px;height:22px;object-fit:cover;border-radius:50%;flex:none}.picker img[hidden]{display:none}select{min-width:0;max-width:180px;border:0;background:#111115;color:#ececf3;font:inherit;padding:3px 18px 3px 0;cursor:pointer}select:focus-visible{outline:2px solid var(--kr-accent,#b0ff8c);outline-offset:3px}';
        const picker=document.createElement('div');picker.className='picker';const image=document.createElement('img');image.alt='';const select=document.createElement('select');select.setAttribute('aria-label','Chat channel');select.addEventListener('change',()=>{const mirror=$('#multi-chat-channel');mirror.value=select.value;mirror.dispatchEvent(new Event('change',{bubbles:true}));});picker.append(image,select);chatPickerRoot.append(css,picker);chatHeader.append(chatPicker);
      }
      const select=chatPickerRoot.querySelector('select');select.replaceChildren(...chatChannels().map(slug=>new Option(catalog.get(slug)?.title||slug,slug)));select.value=selectedChat();const image=chatPickerRoot.querySelector('img'),meta=catalog.get(selectedChat());image.hidden=!meta?.image;if(meta?.image)image.src=meta.image;
      panel.dataset.chatPicker='native';style(chatHeader,'visibility','visible');
    }
    function renderChat() {
      syncChatPicker();
      const chat=selectedChat(),useNative=!!context.chat,original=chat===context.slug;panel.dataset.nativeChat=String(useNative);
      $('.multi-chat').hidden=useNative||!state.chatVisible||!chat;
      if(useNative){
        const prior=originalStyle(context.branch,'display');
        style(context.branch,'display',state.chatVisible?(prior?.value??context.branch.style.getPropertyValue('display')):'none');
        style(context.chat,'visibility',state.chatVisible&&original?'visible':'hidden');if(chatHeader)style(chatHeader,'visibility',state.chatVisible?'visible':'hidden');
      }
      const needsFrame=state.chatVisible&&chat&&!(useNative&&original);
      const url=chat?`https://kick.com/popout/${encodeURIComponent(chat)}/chat`:'https://kick.com';$('#multi-chat-external').href=url;
      if(needsFrame){if(!chatFrame){chatFrame=document.createElement('iframe');chatFrame.title='Selected stream chat';chatFrame.style.cssText='width:100%;height:100%;border:0;display:block';chatMount().append(chatFrame);}if(chatFrame.getAttribute('src')!==url)chatFrame.src=url;if(chatOverlay)chatOverlay.hidden=false;}
      else {chatFrame?.remove();chatFrame=null;if(chatOverlay)chatOverlay.hidden=true;}
      $('#multi-chat-toggle').setAttribute('aria-pressed',String(state.chatVisible));$('#multi-chat-toggle').setAttribute('aria-label',state.chatVisible?'Hide chat':'Show chat');decorate($('#multi-chat-toggle'),'chat',state.chatVisible?'Hide chat':'Show chat',true);
      for(const button of chatTabs.children)button.setAttribute('aria-pressed',String(chat===button.dataset.channel));
    }
    function render() {
      if(!active||destroyed)return;
      state=multiState(state);catalog=new Map(getChannels().map(c=>[c.slug,c]));
      if(!state.focus&&!clipFocus&&clipTiles.size)clipFocus=clipTiles.keys().next().value;
      for(const slug of state.channels){const details=metadata.channel(slug);if(details)catalog.set(slug,{...catalog.get(slug),...details,image:details.image||catalog.get(slug)?.image||''});}
      if(native && !state.channels.includes(context.slug)) { const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();} }
      else if(native?.pausedByUs && native.wasPlaying && !paused.has(context.slug)) { const v=nativeVideo();native.pausedByUs=false;if(v?.paused)v.play().catch(()=>{}); }
      const count=tileCount(),grid=$('#multi-grid');grid.dataset.layout=state.layout;grid.dataset.count=count;
      stage.dataset.layout=state.layout;divider.hidden=state.layout!=='focus'||count<2;applySizing();
      grid.style.setProperty('--multi-columns',count<=1?1:count<=4?2:3);grid.style.setProperty('--multi-count',Math.max(1,count));grid.style.setProperty('--multi-focus-rows',Math.max(1,count-1));
      for(const [slug,tile]of tiles)if(!state.channels.includes(slug)){resize.unobserve(tile.player);dropPlayerFrame(tile);tile.card.remove();tiles.delete(slug);}
      grid.querySelector('.multi-empty')?.remove();
      if(!count){const empty=document.createElement('div');empty.className='multi-empty';empty.textContent='Drag a channel from the sidebar, or add one using Manage.';grid.append(empty);}
      state.channels.forEach((slug,index)=>{let tile=tiles.get(slug);if(!tile){tile=makeTile(slug);tiles.set(slug,tile);grid.append(tile.card);}tile.card.style.order=state.layout==='focus'&&state.focus===slug?-1:index;tile.card.dataset.featured=String(state.focus===slug);decorate(tile.focus,state.layout==='focus'&&state.focus===slug?'grid':'focus','Focus',true);tile.focus.title=state.layout==='focus'&&state.focus===slug?'Return to grid':'Focus stream';tile.focus.setAttribute('aria-label',state.layout==='focus'&&state.focus===slug?`Return to grid for ${slug}`:`Focus ${slug}`);tile.focus.setAttribute('aria-pressed',String(state.layout==='focus'&&state.focus===slug));mountPlayer(slug,tile);});
      for(const [slug,tile]of tiles){const meta=catalog.get(slug);if(meta){const image=tile.card.querySelector('.multi-tile-identity img');if(image&&meta.image){image.src=meta.image;image.hidden=false;}tile.card.querySelector('.multi-tile-identity a').textContent=meta.title||slug;tile.card.querySelector('.multi-tile-identity span').textContent=meta.category||'Kick stream';const status=tile.card.querySelector('.live-status');status.dataset.live=meta.live||'unknown';status.textContent=isNative(slug)?'Current stream':meta.live==='live'?'Live':meta.live==='offline'?'Offline':'';}}
      for(const [key,tile]of new Map([...tiles,...clipTiles])){const featured=key===focusKey();tile.card.dataset.featured=String(featured);tile.card.style.order=state.layout==='focus'&&featured?-1:state.channels.indexOf(key)>=0?state.channels.indexOf(key):state.channels.length+[...clipTiles.keys()].indexOf(key);if(tile.focus){decorate(tile.focus,featured&&state.layout==='focus'?'grid':'focus','Focus',true);tile.focus.setAttribute('aria-pressed',String(featured&&state.layout==='focus'));if(!clipTiles.has(key))tile.focus.setAttribute('aria-label',featured&&state.layout==='focus'?`Return to grid for ${key}`:`Focus ${key}`);}if(clipTiles.has(key))tile.card.style.setProperty('--tile-span',count===1?6:count<=4?3:2);}
      applyTileSizes();$('#multi-layout').value=state.layout;$('#multi-player-mode').value=state.playerMode;
      const select=$('#multi-chat-channel');select.replaceChildren(...chatChannels().map(s=>new Option(catalog.get(s)?.title||s,s)));select.value=selectedChat();
      chatTabs.replaceChildren(...chatChannels().map(slug=>{
        const button=document.createElement('button');button.dataset.channel=slug;button.setAttribute('aria-label',`Show ${slug} chat`);button.title=`Open ${catalog.get(slug)?.title||slug} chat`;
        const meta=catalog.get(slug);if(meta?.image){const image=document.createElement('img');image.src=meta.image;image.alt='';button.append(image);}
        const name=document.createElement('span');name.textContent=meta?.title||slug;button.append(name);
        button.title+='; double-click to focus and listen';
        button.addEventListener('click',()=>{state.chat=slug;if(clipTiles.size)retainedChat=slug;state.chatVisible=true;select.value=slug;renderChat();schedulePosition();persist();});
        button.addEventListener('dblclick',event=>{if(!state.channels.includes(slug))return;event.preventDefault();focusStream(slug);});return button;
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
      } else if(shared){discardClips();state=multiState(shared);audio.clear();paused.clear();}
      for(const slug of seeds)if(!state.channels.includes(slug))add(slug);
      render();if(state.layout==='focus'&&!state.mixAudio&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});persist();
    }
    function close({restorePlayback=true}={}) {
      if(!active)return;finishResize();sessionStore.flush();expandedChannel='';active=false;layoutScheduler.cancel();resize.disconnect();
      cancelAnimationFrame(nativeStatusFrame);nativeStatusFrame=0;nativeHoverCleanup?.();nativeHoverCleanup=null;chatPicker?.remove();chatPicker=chatPickerRoot=chatHeader=null;delete panel.dataset.chatPicker;
      for(const tile of clipTiles.values()){tile.item.release();tile.card.remove();}clipTiles.clear();clipFocus='';retainedChat='';if(clipReturn){state.layout=clipReturn.layout;state.focus=clipReturn.focus;clipReturn=null;}
      for(const tile of tiles.values()){dropPlayerFrame(tile);tile.card.remove();}tiles.clear();chatFrame?.remove();chatFrame=null;chatOverlay?.remove();chatOverlay=null;paused.clear();
      const video=context?.player?.querySelector('video');if(document.fullscreenElement===context?.main)document.exitFullscreen().catch(()=>{});
      globalThis.KickRefinedPlayerControls?.clear(context?.player);restoreStyles();restoreChannelInfo();if(context?.player)delete context.player.dataset.krNativePlayer;
      if(video&&native){video.muted=native.muted;if(restorePlayback&&native.wasPlaying&&native.pausedByUs&&video.paused)video.play().catch(()=>{});}
      titleObserver.disconnect();if(context?.slug===channelSlug(location.pathname,location.origin))document.title=singleTitle;else if(document.title===multiTitle)document.title='Kick';host.remove();native=null;context=null;audio.clear();
    }
    function refresh(){if(active&&(!host.isConnected||(context?.player&&!context.player.isConnected)||context?.slug!==channelSlug(location.pathname,location.origin)))close({restorePlayback:false});else if(active){if(channelPanel&&channelVersion!==channelPanel.version)renderDirectory();hideChannelInfo();if(!chatPicker?.isConnected)syncChatPicker();schedulePosition();}}
    function receivePlayerStatus(tile,data){
      const slug=tile.slug;
      if(data.hasNativeControls)tile.card.dataset.nativeChrome='true';
      if(data.hasVideo)tile.everLoaded=true;
      if(tile.frameMode==='full'&&data.fullPlayerIsolated&&(data.hasVideo||catalog.get(slug)?.live==='offline')){tile.fullReady=true;tile.loading.hidden=true;clearTimeout(tile.loadTimer);tile.loadTimer=0;}
      if(data.hasVideo)tile.pendingAction='';
      if(typeof data.playing==='boolean')tile.playing=data.playing;
      if(data.hasVideo&&(data.muted!==!audio.has(slug)||(Number.isFinite(data.volume)&&Math.abs(data.volume-tile.volume)>.001)))command(tile,!audio.has(slug),{force:true});
      updateControls(tile);
      if(data.error==='NotAllowedError'&&audio.has(slug))notice(`Click “Enable playback” inside ${catalog.get(slug)?.title||slug} to allow sound in Firefox.`);
    }
    window.addEventListener('resize',schedulePosition);document.addEventListener('fullscreenchange',schedulePosition);
    function nativeDoubleClick(event){
      if(!active||!context?.player?.contains(event.target)||!tiles.has(context.slug)||event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable="true"]'))return;
      event.preventDefault();event.stopImmediatePropagation();focusStream(context.slug);
    }
    document.addEventListener('dblclick',nativeDoubleClick,true);
    $('.multi-exit').addEventListener('click',()=>close());
    $('#multi-manage').addEventListener('click',()=>{const show=$('.multi-options').hidden;$('.multi-options').hidden=!show;$('#multi-manage').setAttribute('aria-expanded',String(show));schedulePosition();});
    $('#multi-add-form').addEventListener('submit',e=>{e.preventDefault();if(add($('#multi-add').value))$('#multi-add').value='';});
    $('#multi-layout').addEventListener('change',e=>{state.layout=e.target.value;if(state.layout!=='focus')clipFocus='';render();if(state.layout==='focus'&&!state.mixAudio&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});persist();});
    $('#multi-player-mode').addEventListener('change',event=>{state.playerMode=event.target.value==='full'?'full':'embed';for(const [slug,tile]of tiles)if(!isNative(slug)){tile.pendingAction=tile.playing||!tile.everLoaded?'play':'pause';tile.embedFallback=false;dropPlayerFrame(tile);}render();persist();});
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
    divider.addEventListener('dblclick',()=>{state.focusSize=74;applySizing();persist();});
    const dividerKey=event=>{const step=event.shiftKey?5:1;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?step:-step)));applySizing();persist();}};
    for(const type of ['keydown','kick-refined-keydown'])divider.addEventListener(type,dividerKey);
    $('#multi-mix').addEventListener('click',()=>{state.mixAudio=!state.mixAudio;if(!state.mixAudio&&state.layout==='focus'&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});else{if(!state.mixAudio&&audio.size>1){const selected=[...audio].at(-1);audio.clear();audio.add(selected);}syncAudio();}persist();});
    $('#multi-mute').addEventListener('click',()=>{audio.clear();syncAudio();});
    $('#multi-chat-toggle').addEventListener('click',()=>{state.chatVisible=!state.chatVisible;render();persist();});
    $('#multi-chat-channel').addEventListener('change',e=>{state.chat=e.target.value;if(clipTiles.size)retainedChat=state.chat;render();persist();});
    $('#multi-fullscreen').addEventListener('click',()=>{const target=context?.main;if(!target)return;const request=document.fullscreenElement===target?document.exitFullscreen():target.requestFullscreen();request.catch(()=>notice('Use the browser fullscreen shortcut if fullscreen is unavailable.'));});
    $('#multi-save').addEventListener('click',()=>{const name=$('#multi-name').value.trim().slice(0,48);if(!name||!state.channels.length)return notice('Add a stream and name this session before saving.');const i=sessions.findIndex(s=>s.name===name),session={name,state:multiState(state)};if(i>=0)sessions[i]=session;else sessions=[session,...sessions].slice(0,10);persist();render();notice(`Saved “${name}”.`);});
    $('#multi-sessions').addEventListener('change',e=>{if(e.target.value===''){$('#multi-delete').disabled=true;return;}const session=sessions[Number(e.target.value)];if(!session)return;discardClips();state=multiState(session.state);paused.clear();audio.clear();$('#multi-name').value=session.name;if(native&&!state.channels.includes(context.slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}render();if(state.layout==='focus'&&!state.mixAudio&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});persist();notice(`Loaded “${session.name}”.`);});
    $('#multi-delete').addEventListener('click',()=>{const choice=$('#multi-sessions').value;if(choice==='')return;sessions.splice(Number(choice),1);$('#multi-sessions').value='';persist();render();notice('Saved session deleted.');});
    $('#multi-share').addEventListener('click',async()=>{if(!state.channels.length)return notice('Add a stream before sharing.');const url=multiURL(state);try{await navigator.clipboard.writeText(url);notice('Link copied. Recipients need Immersion installed.');}catch{$('#multi-add').value=url;$('#multi-add').select();notice('Copy the selected link.');}});
    function canAddClip(id){return !clipTiles.has(`clip:${id}`)&&(active?tileCount():(findContext()?.slug?1:0))<6&&!!findContext();}
    function removeClip(key){
      const tile=clipTiles.get(key);if(!tile)return;
      clipTiles.delete(key);audio.delete(key);resize.unobserve(tile.player);tile.item.release();tile.card.remove();if(clipFocus===key)clipFocus='';
      if(!clipTiles.size&&clipReturn){const previous=clipReturn;clipReturn=null;state.layout=previous.layout;state.focus=state.channels.includes(previous.focus)?previous.focus:state.channels[0]||'';audio.clear();for(const source of previous.audio)if(state.channels.includes(source))audio.add(source);if(!previous.active&&state.channels.length<=1){close();return;}}
      render();persist();
    }
    async function addClip(item,mode='alongside'){
      if(!item||!(KickRefinedClips.parseClip(item.href)||KickRefinedClips.parseVOD(item.href))||!canAddClip(item.id)){notice('This video is already here, or the workspace has six tiles.');return false;}
      const wasActive=active;await activate([],channelSlug(location.pathname,location.origin),null,!active);if(!active||destroyed||!canAddClip(item.id))return false;
      if(!clipReturn){clipReturn={active:wasActive,layout:state.layout,focus:state.focus,audio:[...audio]};retainedChat=state.chat||context.slug||'';}
      const key=`clip:${item.id}`,card=document.createElement('section');card.className='multi-tile multi-clip-tile';card.dataset.clip=item.id;card.dataset.kind=item.kind==='vod'?'vod':'clip';
      const header=document.createElement('div');header.className='multi-tile-header';const identity=document.createElement('div');identity.className='multi-tile-identity';const words=document.createElement('div'),title=document.createElement('a'),credit=document.createElement('span');title.href=item.href;title.target='_blank';title.rel='noopener noreferrer';title.textContent=item.title||'Kick clip';words.append(title,credit);identity.append(words);
      const badge=document.createElement('span');badge.className='multi-clip-badge';const kind=item.kind==='vod'?'VOD':'CLIP';badge.textContent=kind;
      const player=document.createElement('div');player.className='multi-clip-player';const tile={slug:key,card,player,item};
      const control=(label,symbol,action)=>{const button=document.createElement('button');button.setAttribute('aria-label',label);decorate(button,symbol,label,true);button.title=({sound:'Choose video audio',focus:'Feature video',close:'Remove video',pop:'Pop out video player'})[symbol]||label;button.addEventListener('click',action);return button;};
      tile.listen=control(`Listen to ${kind.toLowerCase()} ${item.id}`,'sound',()=>{const enabled=!audio.has(key);if(!state.mixAudio)audio.clear();if(enabled)audio.add(key);syncAudio();});
      const toggleFocus=()=>{const featured=state.layout==='focus'&&clipFocus===key;if(!state.mixAudio)audio.clear();audio.add(key);item.resume({paused:false});clipFocus=featured?'':key;state.layout=featured?'grid':'focus';render();};
      tile.focus=control(`Focus ${kind.toLowerCase()} ${item.id}`,'focus',toggleFocus);
      header.addEventListener('dblclick',event=>{if(event.target.closest('a,button,input'))return;event.preventDefault();toggleFocus();});
      header.append(identity,badge,tile.listen,control(`Pop out ${kind.toLowerCase()} ${item.id}`,'pop',()=>item.popout()),tile.focus,control(`Remove ${kind.toLowerCase()} ${item.id}`,'close',()=>removeClip(key)));card.append(header,player);clipTiles.set(key,tile);$('#multi-grid').append(card);resize.observe(player);
      try{item.mount(player,{focus:toggleFocus,remove:()=>removeClip(key),audio:enabled=>{if(enabled&&!state.mixAudio)audio.clear();if(enabled)audio.add(key);else audio.delete(key);syncAudio();},ended:()=>{audio.delete(key);if(!state.mixAudio){for(const source of clipReturn?.audio||[])if(state.channels.includes(source)){audio.add(source);break;}}syncAudio();},info:data=>{title.textContent=data.title||item.title||'Kick clip';credit.textContent=data.creator?`Clipped by ${data.creator}`:data.credit||'';badge.textContent=data.duration?`${kind} · ${kind==='VOD'?KickRefinedSearch.duration(data.duration):Math.round(data.duration)+'s'}`:kind;schedulePosition();}});}catch{removeClip(key);return false;}
      if(mode==='featured'){clipFocus=key;state.layout='focus';}else if(!wasActive){state.layout='focus';clipFocus='';}
      if(!item.snapshot().paused){if(!state.mixAudio)audio.clear();audio.add(key);}render();return true;
    }
    function dropPreview(slug){
      const current=findContext();if(!current)return null;
      const next=active?multiState(state):multiState({channels:current.slug?[current.slug]:[]});
      const duplicate=next.channels.includes(slug),full=active?tileCount()>=6:next.channels.length>=6;
      const workspace=document.createElement('div');workspace.className='stream-drop-zone';workspace.dataset.allowed=String(!duplicate&&!full);
      workspace.setAttribute('aria-label',duplicate?'Already in this workspace':full?'Workspace is full':'Add stream to workspace');
      return {element:workspace,allowed:!duplicate&&!full};
    }
    return {open:(seeds,current,shared)=>activate(seeds,current,shared),drop:(slug,current)=>!active&&slug===current?Promise.resolve():activate([slug],current,null,!active),addClip,canAddClip,isChatSource:source=>!!chatFrame&&chatFrame.contentWindow===source,chatFrameRect:()=>chatFrame?.getBoundingClientRect(),close,refresh,isActive:()=>active,getDropMain:()=>findContext()?.main,dropPreview,destroy:()=>{close({restorePlayback:false});destroyed=true;metadata.destroy();playerBus.destroy();sessionStore.destroy();layoutScheduler.destroy();document.removeEventListener('dblclick',nativeDoubleClick,true);window.removeEventListener('resize',schedulePosition);document.removeEventListener('fullscreenchange',schedulePosition);}};
  }
  globalThis.KickRefinedMulti=Object.freeze({create});
})();
