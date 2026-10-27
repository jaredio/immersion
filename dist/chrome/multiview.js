/* Inline multiview. The native player stays in its React-owned DOM tree. */
(() => {
    const { api, channelSlug, multiState, multiURL, channelDetails } = KickRefined;
  function create({ getChannels, onKeydown, support }) {
    const iconPaths = {
      mix:'M4 7h16M7 4v6M4 17h16M16 14v6', manage:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 17h7m-3.5-3.5v7',
      mute:'m11 5-5 4H3v6h3l5 4zM16 9l5 6m0-6-5 6', sound:'m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
      soundLow:'m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8',
      chevron:'m6 9 6 6 6-6', viewers:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
      settings:'M4 7h16M7 4v6M4 17h16M16 14v6', fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', single:'M4 4h16v16H4zM9 4v16',
      chat:'M21 4H3v13h5l4 4 4-4h5z', add:'M12 5v14M5 12h14', save:'M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8',
      trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', link:'m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
      play:'m8 5 11 7-11 7z', pause:'M8 5v14M16 5v14', focus:'M3 4h18v16H3zM15 4v16', grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
      left:'m10 6-6 6 6 6M4 12h16', right:'m14 6 6 6-6 6M4 12h16', close:'m6 6 12 12M18 6 6 18', pop:'M8 3h13v13H8zM3 8v13h13v-5M8 7h13'
    };
    const icon = name => `<svg class="multi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]}"/></svg>`;
    function decorate(button, symbol, label, iconOnly=false) {
      button.innerHTML=icon(symbol);
      if(iconOnly){if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',label);button.title=label;}
      if(!iconOnly){const text=document.createElement('span');text.textContent=label;button.append(text);}
      button.classList.toggle('multi-icon-only',iconOnly);
    }
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
    for(const [selector,symbol] of [['#multi-mix','mix'],['#multi-manage','manage'],['#multi-mute','mute'],['#multi-fullscreen','fullscreen'],['.multi-exit','close'],['#multi-add-form button','add'],['#multi-save','save'],['#multi-delete','trash'],['#multi-share','link']]) {
      const button=panel.querySelector(selector),label=button.getAttribute('aria-label')||button.textContent;
      decorate(button,symbol,label,true);
    }
    const workspaceClose=panel.querySelector('.multi-exit');workspaceClose.classList.add('multi-workspace-close');workspaceClose.title='Close workspace';panel.prepend(workspaceClose);
    const layoutLabel=panel.querySelector('.multi-layout-label');
    layoutLabel.firstChild.remove();layoutLabel.querySelector('select').title='Change multistream layout';
    const chatTabs=document.createElement('div');chatTabs.id='multi-chat-tabs';chatTabs.setAttribute('aria-label','Switch stream chat');
    panel.querySelector('#multi-chat-toggle').before(chatTabs);
    const toolbarToggle=document.createElement('button');toolbarToggle.id='multi-toolbar-toggle';toolbarToggle.setAttribute('aria-controls','multi-settings-bar multi-settings-options');
    panel.querySelector('.multi-header').id='multi-settings-bar';panel.querySelector('.multi-options').id='multi-settings-options';
    panel.querySelector('#multi-chat-toggle').before(toolbarToggle);
    const stage=document.createElement('div');stage.className='multi-stage';
    const gridElement=panel.querySelector('#multi-grid');gridElement.before(stage);stage.append(gridElement);
    gridElement.addEventListener('scroll',()=>schedulePosition(),{passive:true});
    const divider=document.createElement('div');divider.className='multi-divider';divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Resize featured stream');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-valuemin','45');divider.setAttribute('aria-valuemax','80');divider.title='Drag to resize · arrow keys to adjust · double-click to reset';stage.append(divider);
    const sizing=document.createElement('label');sizing.className='multi-sizing';sizing.innerHTML='Featured size <input type="range" min="45" max="80" value="67" aria-label="Featured stream size"><output>67%</output>';
    panel.querySelector('.multi-options').append(sizing);
    for(const type of ['keydown','kick-refined-keydown'])shadow.addEventListener(type,event=>{onKeydown?.(event);event.stopPropagation();});
    for(const type of ['keyup','keypress'])shadow.addEventListener(type,event=>event.stopPropagation());
    const $ = s => panel.querySelector(s);
    let state = multiState(), sessions = [], audio = new Set(), active = false, destroyed = false, context = null, native = null, toolbarHidden = false;
    let chatFrame = null, chatOverlay = null, writes = Promise.resolve(), layoutFrame = 0, railDirty = true, catalog = new Map();
    const tiles = new Map(), paused = new Set(), nativeWired = new WeakSet(), restored = [];
    const clipTiles=new Map();let clipFocus='',clipReturn=null,retainedChat='';
    const focusKey=()=>clipFocus||state.focus;
    const tileCount=()=>state.channels.length+clipTiles.size;
    function selectedChat(){return clipTiles.size?retainedChat||state.chat:state.chat;}
    function chatChannels(){return [...new Set([...state.channels,...(clipTiles.size&&retainedChat?[retainedChat]:[])])];}
    function discardClips(){for(const [key,tile]of clipTiles){resize.unobserve(tile.player);tile.item.release();tile.card.remove();audio.delete(key);}clipTiles.clear();clipFocus='';clipReturn=null;retainedChat='';}
    const audioSession=crypto.randomUUID();let controlRevision=0,nativeStatusFrame=0;
    const hiddenInfo=new Map();let mainMarker=null,resizing=null,resizeOwner=divider;
    const nativeOverlaySelector='#user-identity,[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],[data-radix-portal],[data-floating-ui-portal]';
    const detailsCache=new Map(),detailsPending=new Set(),detailsControllers=new Set();let detailsQueue=Promise.resolve(),expandedChannel='';const panelCache=new Map(),panelRequests=new Set();
    const resize = new ResizeObserver(() => {railDirty=true;schedulePosition();});
    const loaded = api.storage.local.get(['multiview','multiSessions','multiToolbarHidden']).then(data => {
      toolbarHidden=data.multiToolbarHidden===true;updateToolbar();
      state = multiState(data.multiview);
      sessions = Array.isArray(data.multiSessions) ? data.multiSessions.filter(s=>s && typeof s.name==='string').slice(0,10).map(s=>({name:s.name.slice(0,48),state:multiState(s.state)})) : [];
    }).catch(()=>{});
    function notice(text='') { $('#multi-notice').textContent=text; }
    function updateToolbar() {
      panel.dataset.toolbarHidden=String(toolbarHidden);
      const label=toolbarHidden?'Show settings bar':'Hide settings bar';
      toolbarToggle.setAttribute('aria-label',label);toolbarToggle.setAttribute('aria-expanded',String(!toolbarHidden));
      decorate(toolbarToggle,'settings',label,true);schedulePosition();
    }
    toolbarToggle.addEventListener('click',()=>{toolbarHidden=!toolbarHidden;updateToolbar();persist();});
    updateToolbar();
    function persist() {
      const snapshot = { multiview:multiState(state), multiToolbarHidden:toolbarHidden, multiSessions:sessions.map(s=>({name:s.name,state:multiState(s.state)})) };
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
    let singleTitle='',multiTitle='';
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
    function requestDetails(slug){
      if(detailsPending.has(slug)||Date.now()-(detailsCache.get(slug)?.time||0)<60000)return;
      detailsPending.add(slug);
      detailsQueue=detailsQueue.then(async()=>{
        if(!active||!state.channels.includes(slug))return;
        const controller=new AbortController();detailsControllers.add(controller);const timer=setTimeout(()=>controller.abort(),8000);
        try{let data;if(support)data=await support.channel(slug);else{const response=await fetch(`${location.origin}/api/v2/channels/${encodeURIComponent(slug)}`,{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Channel unavailable');data=channelDetails(await response.json(),slug);}detailsCache.set(slug,{time:Date.now(),data});
          if(active&&state.channels.includes(slug))render();
        }catch{detailsCache.set(slug,{time:Date.now(),data:null});}finally{clearTimeout(timer);detailsControllers.delete(controller);}
      }).finally(()=>detailsPending.delete(slug));
    }
    function requestPanels(slug){
      if(panelRequests.has(slug)||Date.now()-(panelCache.get(slug)?.time||0)<120000)return;
      panelRequests.add(slug);const controller=new AbortController();detailsControllers.add(controller);const timer=setTimeout(()=>controller.abort(),8000);
      (support?support.panels(slug):fetch(`${location.origin}/api/v1/channels/${encodeURIComponent(slug)}/links`,{credentials:'omit',signal:controller.signal}).then(async response=>{
        if(!response.ok)throw Error('Panels unavailable');const data=await response.json();return Array.isArray(data)?data.slice(0,30).map(item=>({title:typeof item.title==='string'?item.title.slice(0,300):'',description:typeof item.description==='string'?item.description.slice(0,20000):'',image:KickRefinedProfile.url(item.image?.url),href:KickRefinedProfile.url(item.link)})):[];
      })).then(items=>{
        panelCache.set(slug,{time:Date.now(),items,error:false});
      }).catch(()=>panelCache.set(slug,{time:Date.now(),items:[],error:true})).finally(()=>{clearTimeout(timer);detailsControllers.delete(controller);panelRequests.delete(slug);if(active&&expandedChannel===slug)renderDirectory();});
    }
    function renderProfile(slug,meta){
      const profile=document.createElement('section');profile.className='multi-expanded-profile';profile.id=`multi-profile-${slug}`;profile.setAttribute('role','region');profile.setAttribute('aria-label',`About ${meta.title||slug}`);
      const bio=document.createElement('div');bio.className='profile-rich-text profile-bio';KickRefinedProfile.formatted(bio,meta.bio||'No bio available.');profile.append(bio);
      const socials=document.createElement('div');socials.className='profile-socials';for(const social of meta.socials||[]){const link=KickRefinedProfile.link(social.href);if(link){link.textContent=social.label;socials.append(link);}}
      const open=KickRefinedProfile.link(`https://kick.com/${slug}`);open.textContent='Open channel \u2197';socials.append(open);profile.append(socials);
      const panels=document.createElement('div');panels.className='profile-panels';const cached=panelCache.get(slug);
      if(!cached){const loading=document.createElement('p');loading.className='profile-muted';loading.textContent='Loading channel panels...';panels.append(loading);}
      else for(const item of cached.items){
        if(!item.title&&!item.description&&!item.image)continue;
        const article=document.createElement('article');article.className='profile-panel';
        if(item.image){const image=KickRefinedProfile.image(item.image,item.title||'Channel panel');if(image){const link=KickRefinedProfile.link(item.href);if(link){link.append(image);article.append(link);}else article.append(image);}}
        if(item.title){const heading=document.createElement('h4');heading.textContent=item.title;article.append(heading);}
        if(item.description){const text=document.createElement('div');text.className='profile-rich-text';KickRefinedProfile.formatted(text,item.description);article.append(text);}panels.append(article);
      }
      if(cached?.error){const unavailable=document.createElement('p');unavailable.className='profile-muted';unavailable.textContent='Channel panels are unavailable right now.';panels.append(unavailable);}
      profile.append(panels);return profile;
    }
    function renderDirectory(){
      const list=$('#multi-channel-list'),focusedButton=shadow.activeElement?.classList.contains('multi-channel-card')?shadow.activeElement.dataset.channel:'';list.replaceChildren();
      const visible=state.layout==='focus'?[state.focus]:state.channels;
      if(!visible.includes(expandedChannel))expandedChannel='';
      directory.dataset.focused=String(state.layout==='focus');
      for(const slug of visible){
        if(!slug)continue;const meta=catalog.get(slug)||{},entry=document.createElement('div');entry.className='multi-channel-entry';
        const card=document.createElement('button');card.className='multi-channel-card';card.dataset.channel=slug;card.setAttribute('aria-label',`Channel details for ${slug}`);card.setAttribute('aria-expanded',String(expandedChannel===slug));card.setAttribute('aria-controls',`multi-profile-${slug}`);
        if(meta.image){const image=document.createElement('img');image.src=meta.image;image.alt='';card.append(image);}
        const text=document.createElement('div'),name=document.createElement('strong'),title=document.createElement('span'),stats=document.createElement('small'),chevron=document.createElement('span');
        name.textContent=meta.title||slug;title.textContent=meta.streamTitle||(meta.live==='offline'?'Offline':'Stream title unavailable');
        stats.className='channel-stats';
        if(meta.category){const category=document.createElement('span');category.className='channel-category';category.textContent=meta.category;stats.append(category);}
        if(meta.viewers){const viewers=document.createElement('span');viewers.className='channel-viewers';viewers.innerHTML=icon('viewers');viewers.append(document.createTextNode(`${meta.viewers} viewers`));stats.append(viewers);}
        text.append(name,title,stats);card.append(text);chevron.className='profile-chevron';chevron.innerHTML=icon('chevron');chevron.setAttribute('aria-hidden','true');card.append(chevron);entry.append(card);if(support){const actions=document.createElement('div');actions.className='multi-channel-actions';actions.append(support.makeButton(slug));entry.append(actions);}list.append(entry);
        card.addEventListener('click',()=>{expandedChannel=expandedChannel===slug?'':slug;renderDirectory();if(expandedChannel){requestDetails(slug);requestPanels(slug);}});
        if(expandedChannel===slug){entry.append(renderProfile(slug,meta));requestPanels(slug);}requestDetails(slug);
        if(focusedButton===slug)card.focus({preventScroll:true});
      }
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
            tile.volume=video.volume;if(tile.volume>0)tile.lastVolume=tile.volume;tile.playing=!video.paused&&!video.ended;
            tile.lastSettings=`${!audio.has(tile.slug)}:${tile.volume}`;updateControls(tile);
          });
        });
      }
      return video;
    }
    function isNative(slug) { return !!context?.player && slug===context.slug; }
    function positionNative() {
      layoutFrame=0;
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
        chatBox={inset:'auto',left:`${r.left-p.left+context.chat.parentElement.scrollLeft}px`,top:`${r.top-p.top+context.chat.parentElement.scrollTop}px`,width:`${r.width}px`,height:`${r.height}px`};
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
      // Read both surfaces before writing either one; don't invalidate layout in between.
      if(chatBox)for(const [key,value]of Object.entries(chatBox))if(chatOverlay.style[key]!==value)chatOverlay.style[key]=value;
      if(!mounted)return;
      style(context.player,'pointer-events',show&&!resizing?'auto':'none');
      if(!playerBox) { style(context.player,'visibility','hidden'); return; }
      for(const [key,value]of Object.entries(playerBox))style(context.player,key,value);
      style(context.player,'visibility','visible');
    }
    function schedulePosition() { if(active && !layoutFrame) layoutFrame=requestAnimationFrame(positionNative); }
    function mountNative() {
      const video=context.player.querySelector('video');
      native={muted:video?.muted??true,wasPlaying:video?!video.paused:false,pausedByUs:false};
      if(getComputedStyle(context.main).position==='static') style(context.main,'position','relative');
      context.player.dataset.krNativePlayer='true';
      for(const [key,value] of Object.entries({position:'absolute','z-index':'2','max-height':'none','min-height':'0','aspect-ratio':'auto',overflow:'clip',transition:'none',visibility:'hidden','box-sizing':'border-box'})) style(context.player,key,value);
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
    function updateAudioButton(button,selected,label,volume=1){
      const on=selected&&volume>0;
      decorate(button,on?(volume<.5?'soundLow':'sound'):'mute',`Audio for ${label}`,true);
      button.classList.add('multi-audio-toggle');button.setAttribute('aria-label',`Audio for ${label}`);
      button.setAttribute('aria-pressed',String(on));button.dataset.audioState=on?'on':'off';button.title=`${on?'Mute':'Unmute'} ${label}`;
    }
    function updateControls(tile){
      const on=audio.has(tile.slug)&&tile.volume>0;
      updateAudioButton(tile.listen,on,tile.slug,tile.volume);
      decorate(tile.pause,tile.playing?'pause':'play',tile.playing?'Pause':'Play',true);tile.pause.setAttribute('aria-label',`${tile.playing?'Pause':'Play'} ${tile.slug}`);tile.pause.title=tile.pause.getAttribute('aria-label');
      tile.slider.value=String(Math.round(tile.volume*100));tile.level.textContent=`${Math.round(tile.volume*100)}%`;
      tile.slider.style.setProperty('--volume-percent',`${Math.round(tile.volume*100)}%`);
      tile.slider.setAttribute('aria-valuetext',`${Math.round(tile.volume*100)}%${on?'':', muted'}`);
      tile.audioControl.dataset.active=String(on);tile.card.dataset.audio=String(on);tile.audible.hidden=!on||!tile.playing;
    }
    function selectAudio(slug,{enable=!(audio.has(slug)&&(tiles.get(slug)?.volume??1)>0)}={}){
      if(!state.mixAudio)audio.clear();if(enable)audio.add(slug);else audio.delete(slug);notice();
      const tile=tiles.get(slug);if(enable&&tile&&tile.volume<=0)tile.volume=tile.lastVolume||.5;
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
      for(const [slug,tile] of tiles) { command(tile,!audio.has(slug));updateControls(tile); }
      for(const [key,tile]of clipTiles){tile.item.setMuted(!audio.has(key));tile.card.dataset.audio=String(audio.has(key));updateAudioButton(tile.listen,audio.has(key),`clip ${tile.item.id}`,tile.item.snapshot().volume);}
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
      if(tileCount()>=6) { notice('Six tiles are open. Remove one before adding another.'); return false; }
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
      const tile={slug,card,player,frame:null,listen:null,pause:null,volume:video?.volume??1,lastVolume:video?.volume>0?video.volume:.5,playing:!!video&&!video.paused,lastSettings:'',commandRevision:0,pendingAction:'',slider:null,level:null};
      const quick=document.createElement('div');quick.className='multi-quick-actions';header.append(quick);
      tile.audible=document.createElement('span');tile.audible.className='multi-audible';tile.audible.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';tile.audible.setAttribute('role','img');tile.audible.setAttribute('aria-label',`Audio enabled for ${slug}`);tile.audible.title='Audio enabled';tile.audible.hidden=true;quick.append(tile.audible);
      const button=(label,text,action,target=controls)=>{const el=document.createElement('button');el.setAttribute('aria-label',`${label} ${slug}`);el.title=`${label} ${slug}`;decorate(el,({'Listen to':'sound',Play:'play',Focus:'focus','Move left':'left','Move right':'right',Fullscreen:'fullscreen',Remove:'close'})[label],label,true);el.addEventListener('click',action);target.append(el);return el;};
      tile.listen=button('Listen to','Listen',()=>selectAudio(slug));
      const audioControl=document.createElement('div');audioControl.className='multi-audio-control';tile.audioControl=audioControl;controls.append(audioControl);audioControl.append(tile.listen);
      const volume=document.createElement('label');volume.className='multi-volume';
      tile.slider=document.createElement('input');tile.slider.type='range';tile.slider.min='0';tile.slider.max='100';tile.slider.step='1';tile.slider.setAttribute('aria-label',`Volume for ${slug}`);
      tile.level=document.createElement('output');tile.level.textContent='100%';volume.append(tile.slider,tile.level);audioControl.append(volume);
      tile.slider.addEventListener('input',()=>{
        tile.volume=Number(tile.slider.value)/100;if(tile.volume>0)tile.lastVolume=tile.volume;
        if(tile.volume>0){if(!state.mixAudio)audio.clear();audio.add(slug);}else audio.delete(slug);
        syncAudio();
      });
      tile.pause=button('Play','Play',()=>{if(isNative(slug)&&native)native.pausedByUs=false;command(tile,!audio.has(slug),{action:tile.playing?'pause':'play'});});
      tile.focus=button('Focus','▣',()=>focusStream(slug));
      for(const [label,text,direction] of [['Move left','←',-1],['Move right','→',1]]){const move=button(label,text,()=>{const i=state.channels.indexOf(slug),j=i+direction;if(j>=0&&j<state.channels.length){[state.channels[i],state.channels[j]]=[state.channels[j],state.channels[i]];render();persist();}});move.classList.add('multi-order-control');tile[direction<0?'moveLeft':'moveRight']=move;}
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
      edge.addEventListener('dblclick',()=>{delete state.sizes[slug];state.focusSize=67;render();persist();});
      card.append(header,player,controls,edge);return tile;
    }
    function chatMount() {
      if(!context.chat) return $('.multi-chat-mount');
      if(!chatOverlay){chatOverlay=document.createElement('div');chatOverlay.id='kr-multi-chat';chatOverlay.style.cssText='position:absolute;inset:0;z-index:5;background:#0e0e11';if(getComputedStyle(context.chat.parentElement).position==='static')style(context.chat.parentElement,'position','relative');context.chat.parentElement.append(chatOverlay);}
      return chatOverlay;
    }
    function renderChat() {
      const chat=selectedChat(),useNative=!!context.chat,original=chat===context.slug;panel.dataset.nativeChat=String(useNative);
      $('.multi-chat').hidden=useNative||!state.chatVisible||!chat;
      if(useNative){
        const prior=restored.find(s=>s.element===context.branch&&s.property==='display');
        style(context.branch,'display',state.chatVisible?(prior?.value??context.branch.style.getPropertyValue('display')):'none');
        style(context.chat,'visibility',state.chatVisible&&original?'visible':'hidden');
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
      for(const slug of state.channels){const details=detailsCache.get(slug)?.data;if(details)catalog.set(slug,{...catalog.get(slug),...details,image:details.image||catalog.get(slug)?.image||''});}
      if(native && !state.channels.includes(context.slug)) { const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();} }
      else if(native?.pausedByUs && native.wasPlaying && !paused.has(context.slug)) { const v=nativeVideo();native.pausedByUs=false;if(v?.paused)v.play().catch(()=>{}); }
      const count=tileCount(),grid=$('#multi-grid');grid.dataset.layout=state.layout;grid.dataset.count=count;
      stage.dataset.layout=state.layout;divider.hidden=state.layout!=='focus'||count<2;applySizing();
      grid.style.setProperty('--multi-columns',count<=1?1:count<=4?2:3);grid.style.setProperty('--multi-count',Math.max(1,count));grid.style.setProperty('--multi-focus-rows',Math.max(1,count-1));
      for(const [slug,tile]of tiles)if(!state.channels.includes(slug)){resize.unobserve(tile.player);tile.card.remove();tiles.delete(slug);}
      grid.querySelector('.multi-empty')?.remove();
      if(!count){const empty=document.createElement('div');empty.className='multi-empty';empty.textContent='Drag a channel from the sidebar, or add one using Manage.';grid.append(empty);}
      state.channels.forEach((slug,index)=>{let tile=tiles.get(slug);if(!tile){tile=makeTile(slug);tiles.set(slug,tile);grid.append(tile.card);}tile.moveLeft.disabled=index===0;tile.moveRight.disabled=index===state.channels.length-1;tile.card.style.order=state.layout==='focus'&&state.focus===slug?-1:index;tile.card.dataset.featured=String(state.focus===slug);decorate(tile.focus,state.layout==='focus'&&state.focus===slug?'grid':'focus','Focus',true);tile.focus.title=state.layout==='focus'&&state.focus===slug?'Return to grid':'Focus stream';tile.focus.setAttribute('aria-label',state.layout==='focus'&&state.focus===slug?`Return to grid for ${slug}`:`Focus ${slug}`);tile.focus.setAttribute('aria-pressed',String(state.layout==='focus'&&state.focus===slug));mountPlayer(slug,tile);});
      for(const [slug,tile]of tiles){const meta=catalog.get(slug);if(meta){tile.card.querySelector('.multi-tile-identity a').textContent=meta.title||slug;tile.card.querySelector('.multi-tile-identity span').textContent=meta.category||'Kick stream';const status=tile.card.querySelector('.live-status');status.dataset.live=meta.live||'unknown';status.textContent=isNative(slug)?'Current stream':meta.live==='live'?'Live':meta.live==='offline'?'Offline':'';}}
      for(const [key,tile]of new Map([...tiles,...clipTiles])){const featured=key===focusKey();tile.card.dataset.featured=String(featured);tile.card.style.order=state.layout==='focus'&&featured?-1:state.channels.indexOf(key)>=0?state.channels.indexOf(key):state.channels.length+[...clipTiles.keys()].indexOf(key);if(tile.focus){decorate(tile.focus,featured&&state.layout==='focus'?'grid':'focus','Focus',true);tile.focus.setAttribute('aria-pressed',String(featured&&state.layout==='focus'));if(!clipTiles.has(key))tile.focus.setAttribute('aria-label',featured&&state.layout==='focus'?`Return to grid for ${key}`:`Focus ${key}`);}if(clipTiles.has(key))tile.card.style.setProperty('--tile-span',count===1?6:count<=4?3:2);}
      applyTileSizes();$('#multi-layout').value=state.layout;
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
      render();persist();
    }
    function close({restorePlayback=true}={}) {
      if(!active)return;finishResize();expandedChannel='';for(const controller of detailsControllers)controller.abort();active=false;cancelAnimationFrame(layoutFrame);layoutFrame=0;resize.disconnect();
      cancelAnimationFrame(nativeStatusFrame);nativeStatusFrame=0;
      for(const tile of clipTiles.values()){tile.item.release();tile.card.remove();}clipTiles.clear();clipFocus='';retainedChat='';if(clipReturn){state.layout=clipReturn.layout;state.focus=clipReturn.focus;clipReturn=null;}
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
      if(data?.type==='kick-refined:focus'&&data.session===audioSession){focusStream(slug);return;}
      if(data?.type!=='kick-refined:status'||data.session!==audioSession||data.revision!==tile.commandRevision)return;
      if(data.hasVideo)tile.pendingAction='';
      if(typeof data.playing==='boolean')tile.playing=data.playing;
      if(Number.isFinite(data.volume)&&data.volume>=0&&data.volume<=1){tile.volume=data.volume;if(tile.volume>0)tile.lastVolume=tile.volume;tile.lastSettings=`${!audio.has(slug)}:${tile.volume}`;}
      updateControls(tile);
      if(data.error==='NotAllowedError'&&audio.has(slug))notice(`Click “Enable playback” inside ${catalog.get(slug)?.title||slug} to allow sound in Firefox.`);
    }
    window.addEventListener('message',onMessage);window.addEventListener('resize',schedulePosition);document.addEventListener('fullscreenchange',schedulePosition);
    function nativeDoubleClick(event){
      if(!active||!context?.player?.contains(event.target)||!tiles.has(context.slug)||event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable="true"]'))return;
      event.preventDefault();event.stopImmediatePropagation();focusStream(context.slug);
    }
    document.addEventListener('dblclick',nativeDoubleClick,true);
    $('.multi-exit').addEventListener('click',()=>close());
    $('#multi-manage').addEventListener('click',()=>{const show=$('.multi-options').hidden;$('.multi-options').hidden=!show;$('#multi-manage').setAttribute('aria-expanded',String(show));schedulePosition();});
    $('#multi-add-form').addEventListener('submit',e=>{e.preventDefault();if(add($('#multi-add').value))$('#multi-add').value='';});
    $('#multi-layout').addEventListener('change',e=>{state.layout=e.target.value;if(state.layout!=='focus')clipFocus='';render();persist();});
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
    $('#multi-chat-channel').addEventListener('change',e=>{state.chat=e.target.value;if(clipTiles.size)retainedChat=state.chat;render();persist();});
    $('#multi-fullscreen').addEventListener('click',()=>{const target=context?.main;if(!target)return;const request=document.fullscreenElement===target?document.exitFullscreen():target.requestFullscreen();request.catch(()=>notice('Use the browser fullscreen shortcut if fullscreen is unavailable.'));});
    $('#multi-save').addEventListener('click',()=>{const name=$('#multi-name').value.trim().slice(0,48);if(!name||!state.channels.length)return notice('Add a stream and name this session before saving.');const i=sessions.findIndex(s=>s.name===name),session={name,state:multiState(state)};if(i>=0)sessions[i]=session;else sessions=[session,...sessions].slice(0,10);persist();render();notice(`Saved “${name}”.`);});
    $('#multi-sessions').addEventListener('change',e=>{if(e.target.value===''){$('#multi-delete').disabled=true;return;}const session=sessions[Number(e.target.value)];if(!session)return;discardClips();state=multiState(session.state);paused.clear();audio.clear();$('#multi-name').value=session.name;if(native&&!state.channels.includes(context.slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}render();persist();notice(`Loaded “${session.name}”.`);});
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
      if(!item||!KickRefinedClips.parseClip(item.href)||!canAddClip(item.id)){notice('This clip is already here, or the workspace has six tiles.');return false;}
      const wasActive=active;await activate([],channelSlug(location.pathname,location.origin),null,!active);if(!active||destroyed||!canAddClip(item.id))return false;
      if(!clipReturn){clipReturn={active:wasActive,layout:state.layout,focus:state.focus,audio:[...audio]};retainedChat=state.chat||context.slug||'';}
      const key=`clip:${item.id}`,card=document.createElement('section');card.className='multi-tile multi-clip-tile';card.dataset.clip=item.id;card.dataset.kind='clip';
      const header=document.createElement('div');header.className='multi-tile-header';const identity=document.createElement('div');identity.className='multi-tile-identity';const words=document.createElement('div'),title=document.createElement('a'),credit=document.createElement('span');title.href=item.href;title.target='_blank';title.rel='noopener noreferrer';title.textContent=item.title||'Kick clip';words.append(title,credit);identity.append(words);
      const badge=document.createElement('span');badge.className='multi-clip-badge';badge.textContent='CLIP';
      const player=document.createElement('div');player.className='multi-clip-player';const tile={slug:key,card,player,item};
      const control=(label,symbol,action)=>{const button=document.createElement('button');button.setAttribute('aria-label',label);decorate(button,symbol,label,true);button.title={sound:'Choose clip audio',focus:'Feature clip',close:'Remove clip',pop:'Pop out clip player'}[symbol]||label;button.addEventListener('click',action);return button;};
      tile.listen=control(`Listen to clip ${item.id}`,'sound',()=>{const enabled=!audio.has(key);if(!state.mixAudio)audio.clear();if(enabled)audio.add(key);syncAudio();});
      const toggleFocus=()=>{const featured=state.layout==='focus'&&clipFocus===key;if(!state.mixAudio)audio.clear();audio.add(key);item.resume({paused:false});clipFocus=featured?'':key;state.layout=featured?'grid':'focus';render();};
      tile.focus=control(`Focus clip ${item.id}`,'focus',toggleFocus);
      header.addEventListener('dblclick',event=>{if(event.target.closest('a,button,input'))return;event.preventDefault();toggleFocus();});
      header.append(identity,badge,tile.listen,control(`Pop out clip ${item.id}`,'pop',()=>item.popout()),tile.focus,control(`Remove clip ${item.id}`,'close',()=>removeClip(key)));card.append(header,player);clipTiles.set(key,tile);$('#multi-grid').append(card);resize.observe(player);
      try{item.mount(player,{focus:toggleFocus,remove:()=>removeClip(key),audio:enabled=>{if(enabled&&!state.mixAudio)audio.clear();if(enabled)audio.add(key);else audio.delete(key);syncAudio();},ended:()=>{audio.delete(key);if(!state.mixAudio){for(const source of clipReturn?.audio||[])if(state.channels.includes(source)){audio.add(source);break;}}syncAudio();},info:data=>{title.textContent=data.title||item.title||'Kick clip';credit.textContent=data.creator?`Clipped by ${data.creator}`:data.credit||'';badge.textContent=data.duration?`CLIP · ${Math.round(data.duration)}s`:'CLIP';schedulePosition();}});}catch{removeClip(key);return false;}
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
    return {open:(seeds,current,shared)=>activate(seeds,current,shared),drop:(slug,current)=>!active&&slug===current?Promise.resolve():activate([slug],current,null,!active),addClip,canAddClip,isChatSource:source=>!!chatFrame&&chatFrame.contentWindow===source,chatFrameRect:()=>chatFrame?.getBoundingClientRect(),close,refresh,isActive:()=>active,getDropMain:()=>findContext()?.main,dropPreview,destroy:()=>{close({restorePlayback:false});destroyed=true;document.removeEventListener('dblclick',nativeDoubleClick,true);window.removeEventListener('message',onMessage);window.removeEventListener('resize',schedulePosition);document.removeEventListener('fullscreenchange',schedulePosition);}};
  }
  globalThis.KickRefinedMulti=Object.freeze({create});
})();
