/* Inline multiview. The native player stays in its React-owned DOM tree. */
(() => {
  const { api, channelSlug, multiState, multiURL } = KickRefined;
  function create({ getChannels, onKeydown }) {
    const host = document.createElement('div'); host.id = 'kr-multi-root';
    const shadow = host.attachShadow({ mode: 'open' });
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = api.runtime.getURL('ui.css'); shadow.append(css);
    const panel = document.createElement('section'); panel.className = 'multiview inline-multi'; panel.setAttribute('aria-label','Multiview workspace');
    panel.innerHTML = `
      <div class="multi-header"><h2 class="title">Watching together <span id="multi-count" class="multi-label"></span></h2><span class="multi-drag-hint">Drag channels here to add streams</span><button id="multi-manage" aria-expanded="false">Manage</button><label class="multi-layout-label">Layout <select id="multi-layout" aria-label="Multiview layout"><option value="grid">Grid</option><option value="focus">Focus</option><option value="columns">Columns</option></select></label><button id="multi-mute">Mute all</button><button id="multi-fullscreen" aria-label="Fullscreen multiview">⛶</button><button class="multi-exit" aria-label="Close multiview">Single stream</button></div>
      <div class="multi-chat-bar"><label for="multi-chat-channel">Chat</label><select id="multi-chat-channel" aria-label="Chat channel"></select><a id="multi-chat-external" target="_blank" rel="noopener noreferrer" aria-label="Open chat in a new tab">↗</a><button id="multi-chat-toggle" aria-pressed="true">Hide chat</button></div>
      <div class="multi-options" hidden><div class="multi-tools"><form id="multi-add-form"><input id="multi-add" aria-label="Add channel to multiview" list="multi-suggestions" placeholder="Channel name or Kick URL" autocomplete="off" maxlength="120"><datalist id="multi-suggestions"></datalist><button type="submit">Add stream</button></form></div><div class="multi-footer"><div class="multi-save"><input id="multi-name" aria-label="Layout name" placeholder="Name this session" maxlength="48"><button id="multi-save">Save</button><select id="multi-sessions" aria-label="Saved multiview sessions"><option value="">Saved sessions…</option></select><button id="multi-delete" disabled>Delete saved</button></div><button id="multi-share">Copy link</button></div></div>
      <div id="multi-notice" class="multi-notice" role="status"></div><div class="multi-body"><div id="multi-grid" class="multi-grid"></div><aside class="multi-chat"><div class="multi-chat-mount"></div></aside></div>`;
    shadow.append(panel);
    const summary=document.createElement('div');summary.className='multi-channel-summary';summary.setAttribute('aria-label','Channels in this multiview');
    summary.innerHTML='<div class="multi-summary-heading"><strong>Your multiview</strong><span id="multi-audio-source" role="status">All streams muted</span></div><div id="multi-channel-list"></div>';
    panel.append(summary);
    const quiet=document.createElement('button');quiet.id='multi-quiet';quiet.textContent='Quiet view';quiet.setAttribute('aria-pressed','false');quiet.title='Hide channel cards and secondary tile controls';
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
    let state = multiState(), sessions = [], audio = '', active = false, destroyed = false, context = null, native = null;
    let chatFrame = null, chatOverlay = null, writes = Promise.resolve(), layoutFrame = 0, catalog = new Map();
    const tiles = new Map(), paused = new Set(), nativeWired = new WeakSet(), restored = [];
    const audioSession=crypto.randomUUID();let controlRevision=0,nativeStatusFrame=0;
    const hiddenInfo=new Map();let mainMarker=null,resizing=null;
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
    function renderSummary(){
      const list=$('#multi-channel-list');list.replaceChildren();
      for(const slug of state.channels){
        const meta=catalog.get(slug),card=document.createElement('div');card.className='multi-summary-channel';card.dataset.summaryChannel=slug;
        if(meta?.image){const image=document.createElement('img');image.src=meta.image;image.alt='';image.decoding='async';card.append(image);}
        const info=document.createElement('div'),name=document.createElement('a'),detail=document.createElement('span');
        name.href=`https://kick.com/${slug}`;name.target='_blank';name.rel='noopener noreferrer';name.textContent=meta?.title||slug;
        detail.textContent=[meta?.category,meta?.live==='live'?'Live':meta?.live==='offline'?'Offline':'Kick stream'].filter(Boolean).join(' · ');
        info.append(name,detail);card.append(info);
        const listen=document.createElement('button');listen.setAttribute('aria-label',`Listen to ${slug} from summary`);listen.textContent='Listen';listen.addEventListener('click',()=>selectAudio(slug));card.append(listen);list.append(card);
      }
      updateSummaryAudio();
    }
    function updateSummaryAudio(){
      $('#multi-audio-source').textContent=audio?`Audio source: ${catalog.get(audio)?.title||audio}`:'All streams muted';
      for(const card of $('#multi-channel-list').children){const selected=card.dataset.summaryChannel===audio;card.dataset.audio=String(selected);const button=card.querySelector('button');button.textContent=selected?'Selected':'Listen';button.setAttribute('aria-pressed',String(selected));}
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
            tile.lastSettings=`${tile.slug!==audio}:${tile.volume}`;updateControls(tile);
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
      audio=video && !video.muted && video.volume>0 ? context.slug : '';
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
      tile.listen.setAttribute('aria-pressed',String(tile.slug===audio));tile.listen.textContent=tile.slug===audio?'Selected':'Listen';
      tile.listen.title=tile.slug===audio?'Mute this audio source':'Select this audio source';
      tile.pause.textContent=tile.playing?'Pause':'Play';tile.pause.setAttribute('aria-label',`${tile.playing?'Pause':'Play'} ${tile.slug}`);
      tile.pause.title=tile.pause.getAttribute('aria-label');
      tile.slider.value=String(Math.round(tile.volume*100));tile.level.textContent=`${Math.round(tile.volume*100)}%`;
      tile.card.dataset.audio=String(tile.slug===audio);
    }
    function selectAudio(slug){
      audio=audio===slug?'':slug;notice();
      const tile=tiles.get(slug);
      if(audio&&tile&&tile.volume<=0)tile.volume=tile.lastVolume||.5;
      syncAudio();
      if(audio&&tile)command(tile,false,{action:'play'});
    }
    function focusStream(slug){
      state.layout=state.layout==='focus'&&state.focus===slug?'grid':'focus';state.focus=slug;render();persist();
    }
    function applySizing(){
      $('#multi-grid').style.setProperty('--multi-featured',`${state.focusSize}%`);
      stage.style.setProperty('--multi-featured',`${state.focusSize}%`);
      sizing.querySelector('input').value=String(state.focusSize);sizing.querySelector('output').textContent=`${state.focusSize}%`;
      divider.setAttribute('aria-valuenow',String(state.focusSize));divider.setAttribute('aria-valuetext',`${state.focusSize}% featured stream width`);schedulePosition();
    }
    function syncAudio() {
      for(const [slug,tile] of tiles) { command(tile,slug!==audio);updateControls(tile); }
      if(context?.player&&!state.channels.includes(context.slug)) { const video=nativeVideo(); if(video&&!video.muted)video.muted=true; }
      updateSummaryAudio();
    }
    function mountPlayer(slug,tile) {
      if(isNative(slug)) { tile.player.dataset.native='true';resize.observe(tile.player);tile.player.textContent='';return; }
      if(tile.frame)return;
      const frame=document.createElement('iframe'); frame.name=`kick-refined:${slug}`; frame.title=`${slug} stream`;
      frame.allow='autoplay; fullscreen; picture-in-picture'; frame.allowFullscreen=true; frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.src=`https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=true`;
      frame.addEventListener('load',()=>{if(active&&tiles.get(slug)===tile)command(tile,slug!==audio,{force:true});});
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
      const button=(label,text,action)=>{const el=document.createElement('button');el.setAttribute('aria-label',`${label} ${slug}`);el.title=`${label} ${slug}`;el.textContent=text;el.addEventListener('click',action);controls.append(el);return el;};
      tile.listen=button('Listen to','Listen',()=>selectAudio(slug));
      const volume=document.createElement('label');volume.className='multi-volume';
      tile.slider=document.createElement('input');tile.slider.type='range';tile.slider.min='0';tile.slider.max='100';tile.slider.step='1';tile.slider.setAttribute('aria-label',`Volume for ${slug}`);
      tile.level=document.createElement('output');tile.level.textContent='100%';volume.append(tile.slider,tile.level);controls.append(volume);
      tile.slider.addEventListener('input',()=>{
        tile.volume=Number(tile.slider.value)/100;if(tile.volume>0)tile.lastVolume=tile.volume;
        if(tile.volume>0&&audio!==slug)audio=slug;
        syncAudio();
      });
      tile.focus=button('Focus','Focus',()=>focusStream(slug));tile.focus.className='multi-secondary';
      for(const [label,glyph,direction] of [['Move left','←',-1],['Move right','→',1]]) button(label,glyph,()=>{const i=state.channels.indexOf(slug),j=i+direction;if(j>=0&&j<state.channels.length){[state.channels[i],state.channels[j]]=[state.channels[j],state.channels[i]];render();persist();}}).className='multi-secondary';
      tile.pause=button('Play','Play',()=>{if(isNative(slug)&&native)native.pausedByUs=false;command(tile,slug!==audio,{action:tile.playing?'pause':'play'});});
      button('Fullscreen','⛶',()=>{
        if(isNative(slug))context.player.querySelector('[data-testid="video-player-fullscreen"]')?.click();
        else tile.card.requestFullscreen().catch(()=>notice('Use the player fullscreen control if fullscreen is unavailable.'));
      });
      button('Remove','×',()=>{
        state.channels=state.channels.filter(s=>s!==slug);state=multiState(state);paused.delete(slug);if(audio===slug)audio='';
        if(isNative(slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}
        persist();
        if(state.channels.length===1 && state.channels[0]!==context.slug) {
          const remaining=state.channels[0],link=getChannels().find(c=>c.slug===remaining)?.link;
          close({restorePlayback:false});if(link?.isConnected)link.click();else location.assign(`/${remaining}`);
        } else if(state.channels.length<=1) close(); else render();
      });
      card.append(header,player,controls);return tile;
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
      state=multiState(state);catalog=new Map(getChannels().map(c=>[c.slug,c]));$('#multi-count').textContent=`${state.channels.length} streams`;
      if(native && !state.channels.includes(context.slug)) { const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();} }
      else if(native?.pausedByUs && native.wasPlaying && !paused.has(context.slug)) { const v=nativeVideo();native.pausedByUs=false;if(v?.paused)v.play().catch(()=>{}); }
      const grid=$('#multi-grid');grid.dataset.layout=state.layout;grid.dataset.count=state.channels.length;
      stage.dataset.layout=state.layout;divider.hidden=state.layout!=='focus'||state.channels.length<2;applySizing();
      panel.dataset.quiet=String(state.quiet);quiet.setAttribute('aria-pressed',String(state.quiet));
      grid.style.setProperty('--multi-columns',state.channels.length<=1?1:state.channels.length<=4?2:3);grid.style.setProperty('--multi-count',Math.max(1,state.channels.length));grid.style.setProperty('--multi-focus-rows',Math.max(1,state.channels.length-1));
      for(const [slug,tile]of tiles)if(!state.channels.includes(slug)){resize.unobserve(tile.player);tile.card.remove();tiles.delete(slug);}
      grid.querySelector('.multi-empty')?.remove();
      if(!state.channels.length){const empty=document.createElement('div');empty.className='multi-empty';empty.textContent='Drag a channel from the sidebar, or add one using Manage.';grid.append(empty);}
      state.channels.forEach((slug,index)=>{let tile=tiles.get(slug);if(!tile){tile=makeTile(slug);tiles.set(slug,tile);grid.append(tile.card);}tile.card.style.order=state.layout==='focus'&&state.focus===slug?-1:index;tile.card.dataset.featured=String(state.focus===slug);tile.focus.textContent=state.layout==='focus'&&state.focus===slug?'Grid':'Focus';tile.focus.setAttribute('aria-pressed',String(state.layout==='focus'&&state.focus===slug));mountPlayer(slug,tile);});
      $('#multi-layout').value=state.layout;
      const select=$('#multi-chat-channel');select.replaceChildren(...state.channels.map(s=>new Option(catalog.get(s)?.title||s,s)));select.value=state.chat;
      chatTabs.replaceChildren(...state.channels.map(slug=>{
        const button=document.createElement('button');button.dataset.channel=slug;button.setAttribute('aria-label',`Show ${slug} chat`);button.title=`Open ${catalog.get(slug)?.title||slug} chat`;
        const meta=catalog.get(slug);if(meta?.image){const image=document.createElement('img');image.src=meta.image;image.alt='';button.append(image);}
        const name=document.createElement('span');name.textContent=meta?.title||slug;button.append(name);
        button.addEventListener('click',()=>{state.chat=slug;state.chatVisible=true;render();persist();});return button;
      }));
      hideChannelInfo();renderSummary();renderChat();syncAudio();positionNative();schedulePosition();
      const saved=$('#multi-sessions'),choice=saved.value;saved.replaceChildren(new Option('Saved sessions…',''),...sessions.map((s,i)=>new Option(s.name,String(i))));saved.value=choice;$('#multi-delete').disabled=saved.value==='';
      $('#multi-suggestions').replaceChildren(...[...catalog.values()].map(c=>new Option(c.slug,c.slug)));
    }
    async function activate(seeds=[],current='',shared=null,fresh=false) {
      await loaded;if(destroyed)return;
      if(!active){
        context=findContext();if(!context)return;
        $('.multi-options').hidden=true;$('#multi-manage').setAttribute('aria-expanded','false');$('#multi-add').value='';notice();
        if(shared)state=multiState(shared);else if(fresh)state=multiState({channels:current?[current]:[]});else if(current)state=multiState({...state,channels:[current,...state.channels.filter(s=>s!==current)].slice(0,6)});
        active=true;if(context.player)context.player.before(host);else context.main.prepend(host);if(context.player)mountNative();else audio='';
      } else if(shared){state=multiState(shared);audio='';paused.clear();}
      for(const slug of seeds)if(!state.channels.includes(slug))add(slug);
      render();persist();
    }
    function close({restorePlayback=true}={}) {
      if(!active)return;finishResize();active=false;cancelAnimationFrame(layoutFrame);layoutFrame=0;resize.disconnect();
      cancelAnimationFrame(nativeStatusFrame);nativeStatusFrame=0;
      for(const tile of tiles.values())tile.card.remove();tiles.clear();chatFrame?.remove();chatFrame=null;chatOverlay?.remove();chatOverlay=null;paused.clear();
      const video=context?.player?.querySelector('video');if(document.fullscreenElement===context?.main)document.exitFullscreen().catch(()=>{});
      restoreStyles();restoreChannelInfo();if(context?.player)delete context.player.dataset.krNativePlayer;
      if(video&&native){video.muted=native.muted;if(restorePlayback&&native.wasPlaying&&native.pausedByUs&&video.paused)video.play().catch(()=>{});}
      host.remove();native=null;context=null;audio='';
    }
    function refresh(){if(active&&(!host.isConnected||(context?.player&&!context.player.isConnected)||context?.slug!==channelSlug(location.pathname,location.origin)))close({restorePlayback:false});else if(active){hideChannelInfo();schedulePosition();}}
    function onMessage(event){
      if(!active||event.origin!=='https://player.kick.com')return;
      const entry=[...tiles].find(([,tile])=>tile.frame?.contentWindow===event.source);if(!entry)return;
      const [slug,tile]=entry,data=event.data;
      if(data?.type==='kick-refined:ready'){command(tile,slug!==audio,{force:true});return;}
      if(data?.type!=='kick-refined:status'||data.session!==audioSession||data.revision!==tile.commandRevision)return;
      if(data.hasVideo)tile.pendingAction='';
      if(typeof data.playing==='boolean')tile.playing=data.playing;
      if(Number.isFinite(data.volume)&&data.volume>=0&&data.volume<=1){tile.volume=data.volume;if(tile.volume>0)tile.lastVolume=tile.volume;tile.lastSettings=`${slug!==audio}:${tile.volume}`;}
      updateControls(tile);
      if(data.error==='NotAllowedError'&&audio===slug)notice(`Click “Enable playback” inside ${catalog.get(slug)?.title||slug} to allow sound in Firefox.`);
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
      if(event.button!==0)return;event.preventDefault();resizing=event.pointerId;divider.setPointerCapture(event.pointerId);stage.dataset.resizing='true';schedulePosition();
    });
    divider.addEventListener('pointermove',event=>{
      if(resizing!==event.pointerId)return;const rect=gridElement.getBoundingClientRect();
      state.focusSize=Math.max(45,Math.min(80,Math.round((event.clientX-rect.left)/rect.width*100)));applySizing();
    });
    function finishResize(){if(resizing===null)return;const pointer=resizing;resizing=null;delete stage.dataset.resizing;if(divider.hasPointerCapture(pointer))divider.releasePointerCapture(pointer);persist();schedulePosition();}
    for(const type of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(type,finishResize);
    divider.addEventListener('dblclick',()=>{state.focusSize=67;applySizing();persist();});
    const dividerKey=event=>{const step=event.shiftKey?5:1;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();state.focusSize=event.key==='Home'?45:event.key==='End'?80:Math.max(45,Math.min(80,state.focusSize+(event.key==='ArrowRight'?step:-step)));applySizing();persist();}};
    for(const type of ['keydown','kick-refined-keydown'])divider.addEventListener(type,dividerKey);
    $('#multi-mute').addEventListener('click',()=>{audio='';syncAudio();});
    $('#multi-chat-toggle').addEventListener('click',()=>{state.chatVisible=!state.chatVisible;render();persist();});
    $('#multi-chat-channel').addEventListener('change',e=>{state.chat=e.target.value;render();persist();});
    $('#multi-fullscreen').addEventListener('click',()=>{const target=context?.main;if(!target)return;const request=document.fullscreenElement===target?document.exitFullscreen():target.requestFullscreen();request.catch(()=>notice('Use the browser fullscreen shortcut if fullscreen is unavailable.'));});
    $('#multi-save').addEventListener('click',()=>{const name=$('#multi-name').value.trim().slice(0,48);if(!name||!state.channels.length)return notice('Add a stream and name this session before saving.');const i=sessions.findIndex(s=>s.name===name),session={name,state:multiState(state)};if(i>=0)sessions[i]=session;else sessions=[session,...sessions].slice(0,10);persist();render();notice(`Saved “${name}”.`);});
    $('#multi-sessions').addEventListener('change',e=>{if(e.target.value===''){$('#multi-delete').disabled=true;return;}const session=sessions[Number(e.target.value)];if(!session)return;state=multiState(session.state);paused.clear();audio='';$('#multi-name').value=session.name;if(native&&!state.channels.includes(context.slug)){const v=nativeVideo();if(v&&!v.paused){native.pausedByUs=true;v.pause();}}render();persist();notice(`Loaded “${session.name}”.`);});
    $('#multi-delete').addEventListener('click',()=>{const choice=$('#multi-sessions').value;if(choice==='')return;sessions.splice(Number(choice),1);$('#multi-sessions').value='';persist();render();notice('Saved session deleted.');});
    $('#multi-share').addEventListener('click',async()=>{if(!state.channels.length)return notice('Add a stream before sharing.');const url=multiURL(state);try{await navigator.clipboard.writeText(url);notice('Link copied. Recipients need Immersion installed.');}catch{$('#multi-add').value=url;$('#multi-add').select();notice('Copy the selected link.');}});
    return {open:(seeds,current,shared)=>activate(seeds,current,shared),drop:(slug,current)=>!active&&slug===current?Promise.resolve():activate([slug],current,null,!active),close,refresh,isActive:()=>active,getDropMain:()=>findContext()?.main,destroy:()=>{close({restorePlayback:false});destroyed=true;window.removeEventListener('message',onMessage);window.removeEventListener('resize',schedulePosition);document.removeEventListener('fullscreenchange',schedulePosition);}};
  }
  globalThis.KickRefinedMulti=Object.freeze({create});
})();
