/* Inline multiview. The native player stays in its React-owned DOM tree. */
(() => {
  const { channelSlug, multiState, multiURL } = KickRefined;
  const {text,attr,css}=KickRefinedMultiView;
  const pageChannel=()=>globalThis.KickRefinedChannelPage?.routeSlug()||channelSlug(location.pathname,location.origin);
  function create({ getChannels, onKeydown, support, channelPanel, onWatchProfileVideo }) {
    const {host,shadow,panel,directory,chatTabs,toolbarToggle,stage,gridElement,divider,sizing,$,decorate} =
      KickRefinedMultiView.create({onKeydown,onPosition:schedulePosition});
    let accentKey=null,accentValue='',appliedVisualKey='';
    function playerAccent(){const key=document.documentElement.dataset.krAccent||'mint';if(key!==accentKey){accentKey=key;accentValue=getComputedStyle(document.documentElement).getPropertyValue('--kr-accent').trim();}return accentValue;}
    const viewKeys={chat:'',sessions:'',suggestions:''};
    let state = multiState(), sessions = [], audio = new Set(), active = false, destroyed = false, context = null, native = null, toolbarHidden = false;
    let railDirty = true, catalog = new Map(),sessionBusy=false;
    const lifetime=KickRefinedLifetime.create();let workspaceScope=null,nativeVideoScope=null,wiredVideo=null;
    const tiles = new Map(), paused = new Set();
    const {style,restoreStyles,originalStyle}=KickRefinedMultiLayout.createStyles();
    const findContext=KickRefinedMultiLayout.findContext;
    const chat=KickRefinedMultiChat.create({scope:lifetime,getContext:()=>context,getState:()=>state,getCatalog:()=>catalog,selectedChat,chatChannels,style,originalStyle,panel,chatTabs,$,decorate});
    const clipTiles=new Map();let clipFocus='',clipReturn=null,retainedChat='';
    const focusKey=()=>clipFocus||state.focus;
    const tileCount=()=>state.channels.length+clipTiles.size;
    function selectedChat(){return clipTiles.size?retainedChat||state.chat:state.chat;}
    function chatChannels(){return [...new Set([...state.channels,...(clipTiles.size&&retainedChat?[retainedChat]:[])])];}
    function discardClips(){for(const [key,tile]of clipTiles){tile.scope.dispose();audio.delete(key);}clipTiles.clear();clipFocus='';clipReturn=null;retainedChat='';}
    let nativeStatusFrame=0,listeningVolume=1,savedVolume=false;
    const hiddenInfo=new Map();let mainMarker=null,resizing=null,resizeOwner=divider;
    const nativeOverlaySelector='#user-identity,[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],[data-radix-portal],[data-floating-ui-portal]';
    const metadata=KickRefinedMultiMetadata.create({
      support,isWanted:slug=>active&&state.channels.includes(slug),
      onChannel:slug=>{if(active&&state.channels.includes(slug))render();},
      onPanels:slug=>{if(active&&channelDirectory.expanded===slug)channelDirectory.render();}
    });
    const channelDirectory=KickRefinedMultiDirectory.create({scope:lifetime,getState:()=>state,getCatalog:()=>catalog,getContext:()=>context,channelPanel,metadata,directory,shadow,$,onKeydown,onWatchProfileVideo,onPosition:schedulePosition});
    const startup=KickRefinedMultiStartup.create();
    const sessionStore=KickRefinedMultiSession.create({onError:()=>{if(!destroyed)notice('Could not save this workspace.');},onSessions:next=>{sessions=next;if(active&&!destroyed)render();}});
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
    lifetime.listen(toolbarToggle,'click',()=>{toolbarHidden=!toolbarHidden;updateToolbar();persist();});
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
        if(!context.player||child.matches(`#kr-channel-library,#kr-channel-root[data-profile-open],${nativeOverlaySelector}`)||child.querySelector(`#kr-channel-library,#kr-channel-root[data-profile-open],[data-testid="channel-videos-tab"],${nativeOverlaySelector}`)){restoreInfoChild(child);continue;}
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
    let singleTitle='',multiTitle='',nativeGestureUntil=0,titleFrame=0;
    const titleObserver=new MutationObserver(()=>{
      if(!active||titleFrame||context?.path!==location.pathname||document.title===multiTitle)return;
      titleFrame=workspaceScope.frame(()=>{
        titleFrame=0;
        if(context?.path===location.pathname&&document.title!==multiTitle){singleTitle=document.title;document.title=multiTitle;}
      });
    });
    function updateAudioLabel(){
      $('#multi-mix').setAttribute('aria-pressed',String(state.mixAudio));
    }
    function updateTabTitle(){
      // document.title collapses whitespace. Compare the same normalized string
      // so an empty stream list cannot cause an endless mutation-observer loop.
      multiTitle=(state.channels.length?`Multistream: ${state.channels.map(s=>catalog.get(s)?.title||s).join(' + ')} | Immersion`:'Clip workspace | Immersion').replace(/\s+/g,' ').trim();
      if(document.title!==multiTitle)document.title=multiTitle;
    }
    function nativeVideo() {
      const video=context?.player?.querySelector('video')||null;
      if(video!==wiredVideo) {
        nativeVideoScope?.dispose();nativeVideoScope=null;nativeStatusFrame=0;wiredVideo=video;
        if(video&&workspaceScope){nativeVideoScope=workspaceScope.child();
        for(const type of ['volumechange','play','pause','ended'])nativeVideoScope.listen(video,type,()=>{
          if(!active||nativeStatusFrame)return;
          nativeStatusFrame=1;nativeVideoScope.frame(()=>{
            nativeStatusFrame=0;if(!active||nativeVideo()!==video)return;
            const tile=tiles.get(context.slug);if(!tile)return;
            tile.playing=!video.paused&&!video.ended;
            if(video.muted!==!audio.has(tile.slug)||Math.abs(video.volume-tile.volume)>.001){if(Date.now()<nativeGestureUntil)acceptAudioIntent(tile,video.muted,video.volume);else command(tile,!audio.has(tile.slug),{force:true});}else updateControls(tile);
          });
        });}
      }
      return video;
    }
    function isNative(slug) { return !!context?.player && slug===context.slug; }
    function positionNative() {
      globalThis.KickRefinedPerf?.count('layout.passes');let railStyles=null;
      if(active&&railDirty){
        railDirty=false;
        // Align the side rail with the main player, then balance overflow rows.
        const grid=$('#multi-grid'),all=new Map([...tiles,...clipTiles]),rail=[...all.values()].filter(tile=>tile.slug!==focusKey()),featured=all.get(focusKey());
        let plan=null;
        if(state.layout==='focus'&&stage.clientWidth>640&&innerWidth>900&&rail.length&&featured){
          const measure=tile=>{const card=tile.card.getBoundingClientRect(),player=tile.player.getBoundingClientRect();const extra=tile.item?tile.player.firstElementChild?.shadowRoot?.querySelector('.info')?.getBoundingClientRect().height||0:0;return {chromeHeight:card.height-player.height+extra,borderWidth:card.width-player.width,aspectRatio:16/9,playerWidth:player.width};};
          const main=measure(featured),others=rail.map(measure);
          if([main,...others].every(box=>box.playerWidth>0))plan=KickRefinedMultiLayout.focusPlan({width:grid.clientWidth,focusSize:state.focusSize,gap:parseFloat(getComputedStyle(grid).columnGap)||0,featured:main,rail:others});
        }
        railStyles={grid,all,rail,featured,plan};
      }
      let chatBox=null,playerBox=null;
      if(active && chat.overlay && !chat.overlay.hidden && context?.chat?.isConnected) {
        const r=context.chat.getBoundingClientRect(),p=context.chat.parentElement.getBoundingClientRect();
        chatBox={left:`${r.left-p.left+context.chat.parentElement.scrollLeft}px`,top:`${r.top-p.top+context.chat.parentElement.scrollTop}px`,width:`${r.width}px`,height:`${r.height}px`};
      }
      const mounted=active&&native&&context?.player?.isConnected,tile=mounted?tiles.get(context.slug):null,show=!!tile;
      if(show){
        const target=tile.player.getBoundingClientRect(),main=context.main.getBoundingClientRect();
        if(target.width&&target.height)playerBox={left:`${target.left-main.left+context.main.scrollLeft-context.main.clientLeft}px`,top:`${target.top-main.top+context.main.scrollTop-context.main.clientTop}px`,width:`${target.width}px`,height:`${target.height}px`};
        if(playerBox){
          if(state.layout==='columns'){
            const grid=gridElement.getBoundingClientRect(),left=Math.min(target.width,Math.max(0,grid.left-target.left)),right=Math.min(target.width,Math.max(0,target.right-grid.right));
            playerBox['clip-path']=`inset(0px ${right}px 0px ${left}px)`;
          }else playerBox['clip-path']='none';
        }
      }
      // All geometry reads finish before any control/style writes.
      if(railStyles){const {grid,all,rail,featured,plan}=railStyles;let changed=false;
        const set=(node,key,value)=>{if(node.style[key]!==value){node.style[key]=value;changed=true;}};
        set(grid,'gridTemplateRows',plan?.templateRows||'');set(grid,'gridTemplateColumns',plan?.templateColumns||'');set(grid,'minHeight','');
        for(const tile of all.values()){const position=plan&&(tile===featured?plan.featured:plan.rail[rail.indexOf(tile)]);set(tile.card,'gridColumn',position?.column||'');set(tile.card,'gridRow',position?.row||'');const height=position?.height?`${position.height}px`:'';if(tile.card.style.getPropertyValue('--multi-pane-height')!==height){tile.card.style.setProperty('--multi-pane-height',height);changed=true;}}
        const dividerHeight=plan?`${plan.mainHeight}px`:'';if(stage.style.getPropertyValue('--multi-focus-height')!==dividerHeight)stage.style.setProperty('--multi-focus-height',dividerHeight);
        if(changed)schedulePosition();
      }
      if(show)syncNativeChrome(tile);
      if(chatBox)for(const [key,value]of Object.entries(chatBox))if(chat.overlay.style[key]!==value)chat.overlay.style[key]=value;
      if(!mounted)return;
      style(context.player,'pointer-events',show&&!resizing?'auto':'none');
      if(!playerBox) { style(context.player,'visibility','hidden'); return; }
      for(const [key,value]of Object.entries(playerBox))style(context.player,key,value);
      style(context.player,'visibility','visible');
    }
    function schedulePosition() { layoutScheduler.schedule(); }
    function mountNative() {
      const video=context.player.querySelector('video');
      const hover=event=>{const tile=tiles.get(context?.slug);if(tile)tile.card.dataset.hovered=String(event.type==='pointerenter');};workspaceScope.listen(context.player,'pointerenter',hover);workspaceScope.listen(context.player,'pointerleave',hover);const gesture=event=>{if(event.type==='pointermove'&&!event.buttons)return;const control=event.target.closest?.('button,input,[role=slider]');if(control&&/volume|sound|speaker|mute|slider|range/i.test([control.getAttribute('aria-label'),control.title,control.getAttribute('role'),control.getAttribute('type'),control.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ')))nativeGestureUntil=Date.now()+1500;};workspaceScope.listen(context.player,'pointerdown',gesture,true);workspaceScope.listen(context.player,'pointermove',gesture,true);workspaceScope.listen(context.player,'keydown',gesture,true);
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
      const video=nativeVideo();tile.lifecycle.status({hasVideo:!!video,readyState:video?.readyState||0,playing:!!video&&!video.paused&&!video.ended},{live:catalog.get(tile.slug)?.live});attr(tile.card,'data-player-state',tile.lifecycle.phase);
      const ready=globalThis.KickRefinedPlayerControls?.sync(context?.player,{getVideo:nativeVideo,getState:()=>({muted:!audio.has(tile.slug),volume:tile.volume,focused:state.layout==='focus'&&focusKey()===tile.slug,startedAt:catalog.get(tile.slug)?.startedAt}),onToggle:()=>{if(native)native.pausedByUs=false;command(tile,!audio.has(tile.slug),{action:nativeVideo()?.paused?'play':'pause'});syncNativeChrome(tile);},onVolume:(muted,volume)=>{acceptAudioIntent(tile,muted,volume);syncNativeChrome(tile);},onFocus:()=>focusStream(tile.slug)});
      if(ready)tile.card.dataset.nativeChrome='true';
    }
    function openNativeSettings(tile){
      const scope=context?.player;if(!scope)return;
      const menus=[...scope.querySelectorAll('button[aria-haspopup="menu"]')];
      const button=scope.querySelector('button[aria-label*="settings" i],button[aria-label*="quality" i],button:has(svg[data-ds-icon="Settings"]),button:has(svg[data-ds-icon="Gear"])')||menus.at(-1);
      if(!button){notice('Kick player settings are not available yet.');return;}
      button.click();
      workspaceScope.frame(()=>{const menu=document.getElementById(button.getAttribute('aria-controls'))||document.querySelector('[role="menu"][data-state="open"]');const wrapper=menu?.closest('[data-radix-popper-content-wrapper]');if(!wrapper)return;const rect=tile.settings.getBoundingClientRect(),size=wrapper.getBoundingClientRect();style(wrapper,'position','fixed');style(wrapper,'transform','none');style(wrapper,'left',`${Math.max(8,Math.min(rect.right-size.width,innerWidth-size.width-8))}px`);style(wrapper,'top',`${Math.max(8,rect.top-size.height-8)}px`);});
    }
    function command(tile,muted,{action='',force=false}={}) {
      const live=catalog.get(tile.slug)?.live||'unknown',startedAt=catalog.get(tile.slug)?.startedAt??null,diagnostics=globalThis.KickRefinedPerf?.enabled===true;
      const accent=playerAccent();
      const signature=`${muted}:${tile.volume}:${state.layout==='focus'&&focusKey()===tile.slug}:${startedAt}:${live}:${accent}:${diagnostics}`;
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
      } else playerBus.send(tile,{muted,volume:tile.volume,focused:state.layout==='focus'&&focusKey()===tile.slug,accent,startedAt,diagnostics,...(nextAction?{action:nextAction}:{})});
    }
    function updateAudioButton(button,selected,label,volume=1){
      const on=selected&&volume>0;
      decorate(button,on?(volume<.5?'soundLow':'sound'):'mute',`Audio for ${label}`,true);
      if(!button.classList.contains('multi-audio-toggle'))button.classList.add('multi-audio-toggle');attr(button,'aria-label',`Audio for ${label}`);
      attr(button,'aria-pressed',on);attr(button,'data-audio-state',on?'on':'off');attr(button,'title',`${on?'Mute':'Unmute'} ${label}`);
    }
    function updateControls(tile){
      if(tile.playerModeControl){const label=tile.frameMode==='embed'?`Use full player for ${tile.slug}`:`Switch ${tile.slug} to standard embed`;tile.playerModeControl.hidden=isNative(tile.slug);if(tile.playerModeControl.getAttribute('aria-label')!==label){tile.playerModeControl.setAttribute('aria-label',label);tile.playerModeControl.title=label;}}
      attr(tile.card,'data-playing',tile.playing);
      const on=audio.has(tile.slug)&&tile.volume>0;
      updateAudioButton(tile.listen,on,tile.slug,tile.volume);
      decorate(tile.pause,tile.playing?'pause':'play',tile.playing?'Pause':'Play',true);attr(tile.pause,'aria-label',`${tile.playing?'Pause':'Play'} ${tile.slug}`);attr(tile.pause,'title',tile.pause.getAttribute('aria-label'));
      const percent=Math.round(tile.volume*100);if(tile.slider.value!==String(percent))tile.slider.value=String(percent);text(tile.level,`${percent}%`);
      css(tile.slider,'--volume-percent',`${Math.round(tile.volume*100)}%`);
      attr(tile.slider,'aria-valuetext',`${Math.round(tile.volume*100)}%${on?'':', muted'}`);
      attr(tile.audioControl,'data-active',on);attr(tile.card,'data-audio',on);
    }
    function selectAudio(slug,{enable=!(audio.has(slug)&&(tiles.get(slug)?.volume??1)>0)}={}){
      if(!state.mixAudio)audio.clear();if(enable)audio.add(slug);else audio.delete(slug);notice();
      const tile=tiles.get(slug);if(enable&&tile?.startJob)startup.prioritize(tile.startJob);if(enable&&tile){if(!state.mixAudio)tile.volume=listeningVolume;else if(tile.volume<=0)tile.volume=tile.lastVolume||.5;tile.lastVolume=tile.volume;}
      syncAudio();if(enable&&tile)command(tile,false,{action:'play'});
    }
    function focusStream(slug){
      const featured=!clipFocus&&state.layout==='focus'&&state.focus===slug;clipFocus='';
      selectAudio(slug,{enable:true});
      if(clipTiles.size)retainedChat=slug;
      state.layout=featured?'grid':'focus';state.focus=slug;state.chat=slug;state.chatVisible=true;channelDirectory.focus(slug);render();persist();
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
        css(tile.card,'--tile-span',span);attr(tile.card,'data-span',span);
        const focused=state.layout==='focus',featured=slug===focusKey();
        tile.edge?.setAttribute('aria-valuemin',String(focused?(featured?45:20):2));tile.edge?.setAttribute('aria-valuemax',String(focused?(featured?80:55):6));
        tile.edge?.setAttribute('aria-valuenow',String(focused?(featured?state.focusSize:100-state.focusSize):span));
      }
      schedulePosition();
    }
    function beginResize(element,event){if(event.button!==0)return false;finishResize();event.preventDefault();resizing=event.pointerId;resizeOwner=element;element.setPointerCapture(event.pointerId);stage.dataset.resizing='true';schedulePosition();return true;}
    function syncAudio() {
      appliedVisualKey=`${document.documentElement.dataset.krAccent}:${globalThis.KickRefinedPerf?.enabled}`;
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
    const streamPlayers=KickRefinedMultiStreamPlayer.create({startup,bus:playerBus,resize,isNative,isCurrent:tile=>active&&tiles.get(tile.slug)===tile,getMode:tile=>(state.playerModes[tile.slug]||state.playerMode)==='full'&&!tile.embedFallback?'full':'embed',priority:slug=>slug===focusKey()||audio.has(slug)?0:1,command,isMuted:slug=>!audio.has(slug),onRemount:()=>syncAudio(),onState:updateControls});
    const dropPlayerFrame=tile=>streamPlayers.drop(tile);
    const mountPlayer=tile=>streamPlayers.mount(tile);

    function add(input) {
      const slug=canonical(input);
      if(!slug) { notice('Enter a channel name or a Kick channel URL.'); return false; }
      if(state.channels.includes(slug)) { notice(`${catalog.get(slug)?.title||slug} is already here.`); return false; }
      if(tileCount()>=6) { notice('Six tiles are open. Remove one before adding another.'); return false; }
      state.channels.push(slug); state=multiState(state); notice(); render(); persist(); return true;
    }
    function makeTile(slug){
      return KickRefinedMultiStreamTile.create({slug,meta:catalog.get(slug),native:isNative(slug),video:isNative(slug)?nativeVideo():null,volume:listeningVolume,scope:workspaceScope.child(),decorate,onAction:streamAction,onResize:bindStreamResize,onDispose:tile=>resize.unobserve(tile.player)});
    }
    function streamAction(action,tile){
      const slug=tile.slug;
      if(action==='profile')return channelDirectory.select(slug,'home');
      if(action==='persist')return persist();
      if(action==='focus')return focusStream(slug);
      if(action==='listen')return selectAudio(slug);
      if(action==='volume'){
        tile.volume=Number(tile.slider.value)/100;if(tile.volume>0){tile.lastVolume=tile.volume;if(!state.mixAudio){listeningVolume=tile.volume;savedVolume=true;}}
        if(tile.volume>0){if(!state.mixAudio)audio.clear();audio.add(slug);}else audio.delete(slug);syncAudio();return;
      }
      if(action==='pause'){if(isNative(slug)&&native)native.pausedByUs=false;command(tile,!audio.has(slug),{action:tile.playing?'pause':'play'});return;}
      if(action==='settings'){if(isNative(slug))openNativeSettings(tile);else command(tile,!audio.has(slug),{action:'settings'});return;}
      if(action==='mode'){state.playerModes[slug]=tile.frameMode==='full'?'embed':'full';tile.embedFallback=false;tile.pendingAction=tile.pendingAction||(tile.playing||!tile.everLoaded?'play':'pause');dropPlayerFrame(tile);mountPlayer(tile);syncAudio();updateControls(tile);persist();return;}
      if(action==='fullscreen'){if(isNative(slug))context.player.querySelector('[data-testid="video-player-fullscreen"]')?.click();else tile.card.requestFullscreen().catch(()=>notice('Use the player fullscreen control if fullscreen is unavailable.'));return;}
      if(action!=='remove')return;
      state.channels=state.channels.filter(s=>s!==slug);state=multiState(state);paused.delete(slug);audio.delete(slug);
      if(isNative(slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}persist();
      if(clipTiles.size){if(!state.channels.includes(state.chat))state.chat=state.channels[0]||'';render();return;}
      if(state.channels.length===1&&state.channels[0]!==context.slug){const remaining=state.channels[0],link=getChannels().find(c=>c.slug===remaining)?.link;close({restorePlayback:false});if(link?.isConnected)link.click();else location.assign(`/${remaining}`);}
      else if(state.channels.length<=1)close();else render();
    }
    function bindStreamResize(tile,edge){
      const {slug,card}=tile;
      let dragWidth=0,dragStart=0;
      tile.scope.listen(edge,'pointerdown',event=>{if(beginResize(edge,event)){dragWidth=card.getBoundingClientRect().width;dragStart=event.clientX;}});
      tile.scope.listen(edge,'pointermove',event=>{
        if(resizing!==event.pointerId||resizeOwner!==edge)return;
        const width=gridElement.getBoundingClientRect().width,desired=dragWidth+event.clientX-dragStart;
        if(state.layout==='focus'){state.focusSize=Math.max(45,Math.min(80,Math.round((slug===focusKey()?desired:width-desired)/width*100)));applySizing();}
        else {state.layout='grid';gridElement.dataset.layout='grid';stage.dataset.layout='grid';$('#multi-layout').value='grid';state.sizes[slug]=Math.max(2,Math.min(6,Math.round(desired/width*6)));applyTileSizes();}
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])tile.scope.listen(edge,type,finishResize);
      const edgeKey=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(state.layout==='focus'){state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?2:-2)));applySizing();}else{state.layout='grid';state.sizes[slug]=event.key==='Home'?2:event.key==='End'?6:Math.max(2,Math.min(6,(Number(card.dataset.span)||3)+(event.key==='ArrowRight'?1:-1)));render();}persist();};
      for(const type of ['keydown','kick-refined-keydown'])tile.scope.listen(edge,type,edgeKey);
      tile.scope.listen(edge,'dblclick',()=>{delete state.sizes[slug];state.focusSize=74;render();persist();});
    }
    function render() {
      if(!active||destroyed)return;
      globalThis.KickRefinedPerf?.count('workspace.renders');
      state=multiState(state);catalog=new Map(getChannels().map(c=>[c.slug,c]));
      if(!state.focus&&!clipFocus&&clipTiles.size)clipFocus=clipTiles.keys().next().value;
      for(const slug of state.channels){const details=metadata.channel(slug);if(details)catalog.set(slug,{...catalog.get(slug),...details,image:details.image||catalog.get(slug)?.image||''});}
      if(native && !state.channels.includes(context.slug)) { const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();} }
      else if(native?.pausedByUs && native.wasPlaying && !paused.has(context.slug)) { const v=nativeVideo();native.pausedByUs=false;if(v?.paused)v.play().catch(()=>{}); }
      const count=tileCount(),grid=$('#multi-grid');grid.dataset.layout=state.layout;grid.dataset.count=count;
      if(state.layout!=='focus'){
        grid.style.gridTemplateColumns='';grid.style.gridTemplateRows='';grid.style.minHeight='';
        for(const tile of [...tiles.values(),...clipTiles.values()]){tile.card.style.gridColumn='';tile.card.style.gridRow='';}
      }
      stage.dataset.layout=state.layout;divider.hidden=state.layout!=='focus'||count<2;applySizing();
      css(grid,'--multi-columns',count<=1?1:count<=4?2:3);css(grid,'--multi-count',Math.max(1,count));css(grid,'--multi-focus-rows',Math.max(1,count-1));
      for(const [slug,tile]of tiles)if(!state.channels.includes(slug)){tile.scope.dispose();tiles.delete(slug);}
      grid.querySelector('.multi-empty')?.remove();
      if(!count){const empty=document.createElement('div');empty.className='multi-empty';empty.textContent='Drag a channel from the sidebar, or add one using Manage.';grid.append(empty);}
      state.channels.forEach((slug,index)=>{let tile=tiles.get(slug);if(!tile){tile=makeTile(slug);tiles.set(slug,tile);grid.append(tile.card);}tile.card.style.order=state.layout==='focus'&&state.focus===slug?-1:index;tile.card.dataset.featured=String(state.focus===slug);decorate(tile.focus,state.layout==='focus'&&state.focus===slug?'grid':'focus','Focus',true);tile.focus.title=state.layout==='focus'&&state.focus===slug?'Return to grid':'Focus stream';tile.focus.setAttribute('aria-label',state.layout==='focus'&&state.focus===slug?`Return to grid for ${slug}`:`Focus ${slug}`);tile.focus.setAttribute('aria-pressed',String(state.layout==='focus'&&state.focus===slug));mountPlayer(tile);});
      for(const [slug,tile]of tiles){const meta=catalog.get(slug);if(meta){const image=tile.card.querySelector('.multi-tile-identity img');if(image&&meta.image){if(image.getAttribute('src')!==meta.image)image.src=meta.image;image.hidden=false;}text(tile.card.querySelector('.multi-tile-identity a'),meta.title||slug);text(tile.card.querySelector('.multi-tile-identity span'),meta.category||'Kick stream');const status=tile.card.querySelector('.live-status');status.dataset.live=meta.live||'unknown';status.textContent=isNative(slug)?'Current stream':meta.live==='live'?'Live':meta.live==='offline'?'Offline':'';}}
      for(const [key,tile]of new Map([...tiles,...clipTiles])){const featured=key===focusKey();tile.card.dataset.featured=String(featured);tile.card.style.order=state.layout==='focus'&&featured?-1:state.channels.indexOf(key)>=0?state.channels.indexOf(key):state.channels.length+[...clipTiles.keys()].indexOf(key);if(tile.focus){decorate(tile.focus,featured&&state.layout==='focus'?'grid':'focus','Focus',true);tile.focus.setAttribute('aria-pressed',String(featured&&state.layout==='focus'));if(!clipTiles.has(key))tile.focus.setAttribute('aria-label',featured&&state.layout==='focus'?`Return to grid for ${key}`:`Focus ${key}`);}if(clipTiles.has(key))tile.card.style.setProperty('--tile-span',count===1?6:count<=4?3:2);}
      applyTileSizes();$('#multi-layout').value=state.layout;$('#multi-player-mode').value=state.playerMode;
      const select=$('#multi-chat-channel'),chatKey=JSON.stringify(chatChannels().map(slug=>[slug,catalog.get(slug)?.title,catalog.get(slug)?.image]));
      if(viewKeys.chat!==chatKey){viewKeys.chat=chatKey;globalThis.KickRefinedPerf?.count('view.chatPickerWrites');select.replaceChildren(...chatChannels().map(s=>new Option(catalog.get(s)?.title||s,s)));select.value=selectedChat();
      chatTabs.replaceChildren(...chatChannels().map(slug=>{
        const button=document.createElement('button');button.dataset.channel=slug;button.setAttribute('aria-label',`Show ${slug} chat`);button.title=`Open ${catalog.get(slug)?.title||slug} chat`;
        const meta=catalog.get(slug);if(meta?.image){const image=document.createElement('img');image.src=meta.image;image.alt='';button.append(image);}
        const name=document.createElement('span');name.textContent=meta?.title||slug;button.append(name);
        button.title+='; double-click to focus and listen';
        button.addEventListener('click',()=>{state.chat=slug;if(clipTiles.size)retainedChat=slug;state.chatVisible=true;select.value=slug;chat.render();schedulePosition();persist();});
        button.addEventListener('dblclick',event=>{if(!state.channels.includes(slug))return;event.preventDefault();focusStream(slug);});return button;
      }));}
      if(select.value!==selectedChat())select.value=selectedChat();
      hideChannelInfo();chat.render();syncAudio();updateTabTitle();channelDirectory.render();schedulePosition();
      const saved=$('#multi-sessions'),sessionsKey=JSON.stringify(sessions.map(session=>[session.id,session.name]));
      if(viewKeys.sessions!==sessionsKey){viewKeys.sessions=sessionsKey;const choice=saved.value;saved.replaceChildren(new Option('Saved sessions…',''),...sessions.map(session=>new Option(session.name,session.id)));saved.value=sessions.some(session=>session.id===choice)?choice:'';}
      $('#multi-save').disabled=sessionBusy;$('#multi-delete').disabled=sessionBusy||saved.value==='';
      const suggestions=[...catalog.keys()],suggestionsKey=suggestions.join(',');
      if(viewKeys.suggestions!==suggestionsKey){viewKeys.suggestions=suggestionsKey;$('#multi-suggestions').replaceChildren(...suggestions.map(slug=>new Option(slug,slug)));}

    }
    async function activate(seeds=[],current='',shared=null,fresh=false) {
      await loaded;if(destroyed)return;
      if(!active){
        context=findContext();if(!context)return;
        $('.multi-options').hidden=true;$('#multi-manage').setAttribute('aria-expanded','false');$('#multi-add').value='';notice();
        if(shared)state=multiState(shared);else if(fresh)state=multiState({channels:current?[current]:[]});else if(current)state=multiState({...state,channels:[current,...state.channels.filter(s=>s!==current)].slice(0,6)});
        workspaceScope=lifetime.child();workspaceScope.defer(()=>titleObserver.disconnect());workspaceScope.defer(()=>resize.disconnect());active=true;singleTitle=document.title;titleObserver.observe(document.head,{childList:true,subtree:true,characterData:true});
        context.main.prepend(host);
        context.main.scrollTop=0;
        if(context.player)mountNative();else audio.clear();
      } else if(shared){discardClips();state=multiState(shared);audio.clear();paused.clear();}
      for(const slug of seeds)if(!state.channels.includes(slug))add(slug);
      render();if(state.layout==='focus'&&!state.mixAudio&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});persist();
    }
    function close({restorePlayback=true}={}) {
      if(!active)return;finishResize();sessionStore.flush();channelDirectory.reset();active=false;viewKeys.chat=viewKeys.sessions=viewKeys.suggestions='';layoutScheduler.cancel();resize.disconnect();
      workspaceScope?.dispose();workspaceScope=null;nativeVideoScope=null;wiredVideo=null;nativeStatusFrame=0;titleFrame=0;chat.reset();
      for(const tile of clipTiles.values()){tile.scope.dispose();}clipTiles.clear();clipFocus='';retainedChat='';if(clipReturn){state.layout=clipReturn.layout;state.focus=clipReturn.focus;clipReturn=null;}
      for(const tile of tiles.values())tile.scope.dispose();tiles.clear();paused.clear();
      const video=context?.player?.querySelector('video');if(document.fullscreenElement===context?.main)document.exitFullscreen().catch(()=>{});
      globalThis.KickRefinedPlayerControls?.clear(context?.player);restoreStyles();restoreChannelInfo();if(context?.player)delete context.player.dataset.krNativePlayer;
      if(video&&native){video.muted=native.muted;if(restorePlayback&&native.wasPlaying&&native.pausedByUs&&video.paused)video.play().catch(()=>{});}
      titleObserver.disconnect();if(document.title===multiTitle)document.title=context?.path===location.pathname?singleTitle:'Kick';host.remove();native=null;context=null;audio.clear();
    }
    function refresh(){
      if(!active)return;
      const pathChanged=context.path!==location.pathname;
      const routeSlug=globalThis.KickRefinedChannelPage?.routeSlug;
      const sameProfile=pathChanged&&!!context.slug&&routeSlug?.(context.path)===context.slug&&routeSlug?.()===context.slug;
      if(!host.isConnected||context.player&&!context.player.isConnected||context.chat&&!context.chat.isConnected||pathChanged&&!sameProfile){close({restorePlayback:false});return;}
      if(sameProfile){context.path=location.pathname;if(document.title!==multiTitle)singleTitle=document.title;updateTabTitle();}
      if(appliedVisualKey!==`${document.documentElement.dataset.krAccent}:${globalThis.KickRefinedPerf?.enabled}`)syncAudio();
      if(channelPanel&&channelDirectory.version!==channelPanel.version)channelDirectory.render();
      hideChannelInfo();if(!chat.pickerConnected)chat.syncPicker();schedulePosition();
    }
    function receivePlayerStatus(tile,data){
      const slug=tile.slug;
      streamPlayers.status(tile,data,catalog.get(slug)?.live||'unknown');
      attr(tile.card,'data-ready-state',Number.isFinite(data.readyState)?data.readyState:0);
      if(data.hasNativeControls)tile.card.dataset.nativeChrome='true';
      if(data.hasVideo)tile.pendingAction='';
      if(typeof data.playing==='boolean')tile.playing=data.playing;
      if(data.hasVideo&&(data.muted!==!audio.has(slug)||(Number.isFinite(data.volume)&&Math.abs(data.volume-tile.volume)>.001)))command(tile,!audio.has(slug),{force:true});
      updateControls(tile);
      if(data.error==='NotAllowedError'&&audio.has(slug))notice(`Click “Enable playback” inside ${catalog.get(slug)?.title||slug} to allow sound in Firefox.`);
    }
    lifetime.listen(window,'resize',schedulePosition);lifetime.listen(document,'fullscreenchange',schedulePosition);
    function nativeDoubleClick(event){
      if(!active||!context?.player?.contains(event.target)||!tiles.has(context.slug)||event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable="true"]'))return;
      event.preventDefault();event.stopImmediatePropagation();focusStream(context.slug);
    }
    lifetime.listen(document,'dblclick',nativeDoubleClick,true);
    lifetime.listen($('.multi-exit'),'click',()=>close());
    lifetime.listen($('#multi-manage'),'click',()=>{const show=$('.multi-options').hidden;$('.multi-options').hidden=!show;$('#multi-manage').setAttribute('aria-expanded',String(show));schedulePosition();});
    lifetime.listen($('#multi-add-form'),'submit',e=>{e.preventDefault();if(add($('#multi-add').value))$('#multi-add').value='';});
    lifetime.listen($('#multi-layout'),'change',e=>{state.layout=e.target.value;if(state.layout!=='focus')clipFocus='';render();if(state.layout==='focus'&&!state.mixAudio&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});persist();});
    lifetime.listen($('#multi-player-mode'),'change',event=>{state.playerMode=event.target.value==='full'?'full':'embed';state.playerModes={};for(const [slug,tile]of tiles)if(!isNative(slug)){tile.pendingAction=tile.pendingAction||(tile.playing||!tile.everLoaded?'play':'pause');tile.embedFallback=false;dropPlayerFrame(tile);}render();persist();});
    lifetime.listen(sizing.querySelector('input'),'input',event=>{state.focusSize=Number(event.target.value);applySizing();});
    lifetime.listen(sizing.querySelector('input'),'change',persist);
    lifetime.listen(divider,'pointerdown',event=>{
      beginResize(divider,event);
    });
    lifetime.listen(divider,'pointermove',event=>{
      if(resizing!==event.pointerId||resizeOwner!==divider)return;const rect=gridElement.getBoundingClientRect();
      state.focusSize=Math.max(45,Math.min(80,Math.round((event.clientX-rect.left)/rect.width*100)));applySizing();
    });
    function finishResize(){if(resizing===null)return;const pointer=resizing;resizing=null;delete stage.dataset.resizing;if(resizeOwner.hasPointerCapture(pointer))resizeOwner.releasePointerCapture(pointer);persist();schedulePosition();}
    for(const type of ['pointerup','pointercancel','lostpointercapture'])lifetime.listen(divider,type,finishResize);
    lifetime.listen(divider,'dblclick',()=>{state.focusSize=74;applySizing();persist();});
    const dividerKey=event=>{const step=event.shiftKey?5:1;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?step:-step)));applySizing();persist();}};
    for(const type of ['keydown','kick-refined-keydown'])lifetime.listen(divider,type,dividerKey);
    lifetime.listen($('#multi-mix'),'click',()=>{state.mixAudio=!state.mixAudio;if(!state.mixAudio&&state.layout==='focus'&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});else{if(!state.mixAudio&&audio.size>1){const selected=[...audio].at(-1);audio.clear();audio.add(selected);}syncAudio();}persist();});
    lifetime.listen($('#multi-mute'),'click',()=>{audio.clear();syncAudio();});
    lifetime.listen($('#multi-chat-toggle'),'click',()=>{state.chatVisible=!state.chatVisible;render();persist();});
    lifetime.listen($('#multi-chat-channel'),'change',e=>{state.chat=e.target.value;if(clipTiles.size)retainedChat=state.chat;render();persist();});
    lifetime.listen($('#multi-fullscreen'),'click',()=>{const target=context?.main;if(!target)return;const request=document.fullscreenElement===target?document.exitFullscreen():target.requestFullscreen();request.catch(()=>notice('Use the browser fullscreen shortcut if fullscreen is unavailable.'));});
    function setSessionBusy(value){sessionBusy=value;$('#multi-save').disabled=value;$('#multi-delete').disabled=value||!$('#multi-sessions').value;for(const id of ['#multi-save','#multi-delete'])$(id).setAttribute('aria-busy',String(value));}
    lifetime.listen($('#multi-save'),'click',async()=>{if(sessionBusy)return;const name=$('#multi-name').value.trim().slice(0,48);if(!name||!state.channels.length)return notice('Add a stream and name this session before saving.');setSessionBusy(true);notice('Saving session...');const previous=sessions.find(session=>session.name===name),session={id:previous?.id||crypto.randomUUID(),name,state:multiState(state)};try{sessions=await sessionStore.upsertSession(session);if(destroyed)return;persist();if(active)render();notice(`Saved “${name}”.`);}catch{notice('Could not save this session.');}finally{setSessionBusy(false);}});
    lifetime.listen($('#multi-sessions'),'change',e=>{if(e.target.value===''){$('#multi-delete').disabled=true;return;}const session=sessions.find(session=>session.id===e.target.value);if(!session)return;discardClips();state=multiState(session.state);paused.clear();audio.clear();$('#multi-name').value=session.name;if(native&&!state.channels.includes(context.slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}render();if(state.layout==='focus'&&!state.mixAudio&&tiles.has(focusKey()))selectAudio(focusKey(),{enable:true});persist();notice(`Loaded “${session.name}”.`);});
    lifetime.listen($('#multi-delete'),'click',async()=>{if(sessionBusy)return;const choice=$('#multi-sessions').value;if(choice==='')return;setSessionBusy(true);notice('Deleting session...');try{sessions=await sessionStore.deleteSession(choice);if(destroyed)return;if(active)render();notice('Saved session deleted.');}catch{notice('Could not delete this session.');}finally{setSessionBusy(false);}});
    lifetime.listen($('#multi-share'),'click',async()=>{if(!state.channels.length)return notice('Add a stream before sharing.');const url=multiURL(state);try{await navigator.clipboard.writeText(url);notice('Link copied. Recipients need Immersion installed.');}catch{$('#multi-add').value=url;$('#multi-add').select();notice('Copy the selected link.');}});
    function canAddClip(id){return !clipTiles.has(`clip:${id}`)&&(active?tileCount():(findContext()?.slug?1:0))<6&&!!findContext();}
    function removeClip(key){
      const tile=clipTiles.get(key);if(!tile)return;
      clipTiles.delete(key);audio.delete(key);tile.scope.dispose();if(clipFocus===key)clipFocus='';
      if(!clipTiles.size&&clipReturn){const previous=clipReturn;clipReturn=null;state.layout=previous.layout;state.focus=state.channels.includes(previous.focus)?previous.focus:state.channels[0]||'';audio.clear();for(const source of previous.audio)if(state.channels.includes(source))audio.add(source);if(!previous.active&&state.channels.length<=1){close();return;}}
      render();persist();
    }
    async function addClip(item,mode='alongside'){
      if(!item||!(KickRefinedClips.parseClip(item.href)||KickRefinedClips.parseVOD(item.href))||!canAddClip(item.id)){notice('This video is already here, or the workspace has six tiles.');return false;}
      const wasActive=active;await activate([],pageChannel(),null,!active);if(!active||destroyed||!canAddClip(item.id))return false;
      if(!clipReturn){clipReturn={active:wasActive,layout:state.layout,focus:state.focus,audio:[...audio]};retainedChat=state.chat||context.slug||'';}
      const key=`clip:${item.id}`;
      const tile=KickRefinedMultiClipTile.create({item,scope:workspaceScope.child(),resize,decorate,isAudible:()=>audio.has(key),onPosition:schedulePosition,
        onAudio:enabled=>{if(enabled&&!state.mixAudio)audio.clear();if(enabled)audio.add(key);else audio.delete(key);syncAudio();},
        onFocus:()=>{const featured=state.layout==='focus'&&clipFocus===key;if(!state.mixAudio)audio.clear();audio.add(key);item.resume({paused:false});clipFocus=featured?'':key;state.layout=featured?'grid':'focus';render();},onRemove:()=>removeClip(key),
        onEnded:()=>{audio.delete(key);if(!state.mixAudio){for(const source of clipReturn?.audio||[])if(state.channels.includes(source)){audio.add(source);break;}}syncAudio();}});
      clipTiles.set(key,tile);gridElement.append(tile.card);
      try{tile.mount();}catch{removeClip(key);return false;}
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
    return {snapshot:()=>({active,streams:tiles.size,clips:clipTiles.size,startup:startup.snapshot(),transport:playerBus.snapshot()}),open:(seeds,current,shared)=>activate(seeds,current,shared),drop:(slug,current)=>!active&&slug===current?Promise.resolve():activate([slug],current,null,!active),addClip,canAddClip,isChatSource:chat.isSource,chatFrameRect:chat.frameRect,close,refresh,isActive:()=>active,getDropMain:()=>findContext()?.main,dropPreview,destroy:()=>{close({restorePlayback:false});destroyed=true;metadata.destroy();startup.destroy();playerBus.destroy();sessionStore.destroy();layoutScheduler.destroy();lifetime.dispose();}};
  }
  globalThis.KickRefinedMulti=Object.freeze({create});
})();
