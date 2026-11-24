/* Workspace-owned audio, with explicit native volume gestures and full player controls. */
(() => {
  if (window === window.top || !/^kick-refined(?:-full)?:[a-z0-9_]{1,40}$/.test(window.name)) return;
  const fullPlayer=window.name.startsWith('kick-refined-full:');
  if(fullPlayer&&(!['kick.com','www.kick.com'].includes(location.hostname)||location.pathname.replace(/\/$/,'').toLowerCase()!==`/${window.name.split(':')[1]}`))return;
  let desired={muted:true,volume:1}, session='', revision=-1, origin='https://kick.com';
  let disposed=false,scanTimer=0,statusTimer=0,action=null,error='',activation=null,gestureUntil=0,focused=false,startedAt=null,lastStatus='',controlsRoot=null;
  const wired=new WeakSet();
  let knownVideos=[];
  const chromeStyle=document.createElement('style');chromeStyle.textContent='.z-controls.bottom-0 input{accent-color:var(--kr-player-accent,#b0ff8c)}.z-controls.bottom-0 [class*=bg-kick-voltGreen]{background-color:var(--kr-player-accent,#b0ff8c)!important}';
  chromeStyle.textContent+=`
    html[data-kr-viewport-locked="true"] .z-controls.bottom-0{width:calc(100% * var(--kr-fullscreen-scale,1))!important;scale:var(--kr-fullscreen-inverse,1)!important;transform-origin:bottom left!important}
    html[data-kr-viewport-locked="true"] [data-radix-popper-content-wrapper]{scale:var(--kr-fullscreen-inverse,1);transform-origin:top left}
    html[data-kr-viewport-locked="true"] [role="dialog"]{scale:var(--kr-fullscreen-inverse,1);transform-origin:center}
  `;
  function nativeSettings(){const buttons=[...document.querySelectorAll('.z-controls button[aria-haspopup="menu"]')];const button=document.querySelector('.z-controls button[aria-label*="settings" i],.z-controls button[aria-label*="quality" i],.z-controls button:has(svg[data-ds-icon="Settings"]),.z-controls button:has(svg[data-ds-icon="Gear"])')||buttons.at(-1);button?.click();requestAnimationFrame(()=>{const menu=document.getElementById(button?.getAttribute('aria-controls'))||document.querySelector('[role="menu"][data-state="open"]'),wrapper=menu?.closest('[data-radix-popper-content-wrapper]');if(wrapper){wrapper.style.setProperty('position','fixed','important');wrapper.style.setProperty('transform','none','important');wrapper.style.setProperty('left',`${Math.max(8,innerWidth-wrapper.getBoundingClientRect().width-8)}px`,'important');wrapper.style.setProperty('top',`${Math.max(8,innerHeight-wrapper.getBoundingClientRect().height-54)}px`,'important');}});}
  window.addEventListener('pointerenter',()=>{if(session)send('kick-refined:hover',{hovered:true});});window.addEventListener('pointerleave',()=>{if(session)send('kick-refined:hover',{hovered:false});});
  function isStreamVideo(video){return video.id!=='clip-creator-player'&&!video.closest('#clip-creator-dialog,[role="dialog"],[role="alertdialog"]');}
  function videos(){return knownVideos.filter(video=>video.isConnected!==false&&isStreamVideo(video));}
  function discoverVideos(){knownVideos=[...document.querySelectorAll('video')];return videos();}
  function primary(all=videos()){
    if(all.length<2)return all[0]||null;
    return all.find(video=>!video.paused)||all.find(video=>video.getBoundingClientRect?.().width>0)||all[0];
  }
  function send(type,extra={}){if(disposed)return;window.parent.postMessage({type,session,revision,...extra},origin);}
  function report(){
    statusTimer=0;const video=primary();
    syncPlaybackControls(video);
    const status={hasVideo:!!video,readyState:video?.readyState||0,playing:!!video&&!video.paused&&!video.ended,muted:video?.muted??true,volume:video?.volume??desired.volume,hasNativeControls:!!document.querySelector('.z-controls.bottom-0:has(button)'),fullPlayerIsolated:fullPlayer&&!!document.querySelector('[data-kr-full-player-root]'),error};
    const signature=JSON.stringify(status);if(signature===lastStatus){globalThis.KickRefinedPerf?.count('frame.statusSuppressed');return;}lastStatus=signature;
    send('kick-refined:status',status);
  }
  function scheduleStatus(){if(!disposed&&!statusTimer)statusTimer=setTimeout(report,60);}
  function settings(video){
    // Firefox can emit volumechange even for repeated setter calls. Never write
    // unchanged values, and never turn a volumechange into another command.
    if(Math.abs(video.volume-desired.volume)>.001)video.volume=desired.volume;
    if(video.muted!==desired.muted)video.muted=desired.muted;
  }
  function enablePrompt(){
    if(activation||!document.body)return;
    activation=document.createElement('button');activation.textContent='Enable playback';activation.setAttribute('aria-label','Enable stream playback');
    activation.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;border:1px solid #ffffff40;border-radius:9px;padding:12px 18px;background:#18181c;color:#f4f4f5;font:13px system-ui;cursor:pointer';
    activation.addEventListener('click',()=>{error='';execute('play');});document.body.append(activation);
  }
  function execute(next,all=discoverVideos(),video=primary(all)){
    action=next;if(!video)return;action=null;
    error='';
    if(next==='pause'){for(const item of all)if(!item.paused)item.pause();scheduleStatus();return;}
    for(const item of all)settings(item);
    const attempt=video.play();
    if(attempt?.then)attempt.then(()=>{activation?.remove();activation=null;error='';scheduleStatus();}).catch(reason=>{error=reason?.name||'PlaybackError';if(error==='NotAllowedError')enablePrompt();scheduleStatus();});
    scheduleStatus();
  }
  function syncPlaybackControls(video){
    const root=document.querySelector('[data-kr-full-player-root]')||document;if(controlsRoot&&controlsRoot!==root)globalThis.KickRefinedPlayerControls?.clear(controlsRoot);controlsRoot=root;
    return globalThis.KickRefinedPlayerControls?.sync(root,{getVideo:primary,getState:()=>({...desired,focused,startedAt}),onToggle:togglePlayback,onVolume:(muted,volume)=>{desired={muted,volume};for(const video of discoverVideos())settings(video);send('kick-refined:audio-intent',desired);scheduleStatus();},onFocus:()=>send('kick-refined:focus'),
      // The workspace enlarges the pane without resizing this page's viewport.
      onFullscreen:toggleFullscreen
    },video);
  }
  function togglePlayback(){const all=discoverVideos(),video=primary(all);execute(video?.paused?'play':'pause',all,video);}
  function toggleFullscreen(){
    if(session){send('kick-refined:fullscreen',{viewport:{width:innerWidth,height:innerHeight}});return Promise.resolve();}
    return document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  }
  // Kick can replace its bar before our replacement controls have been rebuilt.
  // Catch that native button too, while the click still has user activation.
  window.addEventListener('click',event=>{
    const button=event.composedPath().find(node=>node?.matches?.('button,[role="button"]'));
    if(!button||!button.closest('.z-controls,[data-kr-unified-bar],[data-kr-full-player-root]')&&button.dataset.testid!=='video-player-fullscreen'||button.closest('#clip-creator-dialog,[role="dialog"],[role="alertdialog"]'))return;
    const label=[button.dataset.krAction,button.dataset.testid,button.getAttribute('aria-label'),button.title,button.querySelector('svg')?.getAttribute('data-ds-icon')].filter(Boolean).join(' ');
    if(!/full.?screen/i.test(label))return;
    event.preventDefault();event.stopImmediatePropagation();void toggleFullscreen().catch(()=>{});
  },true);
  window.addEventListener('resize',()=>{syncPlaybackControls();scheduleStatus();});
  const gesture=event=>{if(event.type==='pointermove'&&!event.buttons)return;const control=event.target.closest?.('button,input,[role=slider]');if(control&&/volume|sound|speaker|mute|slider|range/i.test([control.getAttribute('aria-label'),control.title,control.getAttribute('role'),control.type,control.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ')))gestureUntil=Date.now()+1500;};document.addEventListener('pointerdown',gesture,true);document.addEventListener('pointermove',gesture,true);document.addEventListener('keydown',gesture,true);
  function scan(){
    scanTimer=0;if(disposed)return;globalThis.KickRefinedPerf?.count('frame.scans');if(document.documentElement&&!chromeStyle.isConnected)(document.head||document.documentElement).append(chromeStyle);
    const all=discoverVideos(),current=primary(all);
    syncPlaybackControls(current);let added=false;
    for(const video of all)if(!wired.has(video)){
      wired.add(video);added=true;settings(video);
      for(const event of ['play','pause','ended','loadedmetadata','loadeddata','canplay','playing','waiting','error'])video.addEventListener(event,scheduleStatus);
      video.addEventListener('volumechange',()=>{
        if(disposed||video.isConnected===false||!isStreamVideo(video))return;
        if(Date.now()<gestureUntil&&(video.muted!==desired.muted||Math.abs(video.volume-desired.volume)>.001)&&video===primary()){
          desired={muted:video.muted,volume:video.volume};send('kick-refined:audio-intent',desired);
          for(const item of videos())settings(item);
        }else settings(video);
        scheduleStatus();
      });
    }
    scheduleStatus();if(added){send('kick-refined:ready');if(action)execute(action,all,current);}
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==window.parent||!['https://kick.com','https://www.kick.com'].includes(event.origin)||data?.type!=='kick-refined:control'
      ||typeof data.session!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.session)||!Number.isSafeInteger(data.revision)||data.revision<0
      ||typeof data.muted!=='boolean'||!Number.isFinite(data.volume)||data.volume<0||data.volume>1)return;
    if(session&&session!==data.session||data.revision<=revision)return;
    session=data.session;revision=data.revision;lastStatus='';if('startedAt' in data)startedAt=globalThis.KickRefinedStreamClock?.valid(data.startedAt)??null;globalThis.KickRefinedPerf?.configure(data.diagnostics===true);origin=event.origin;if(data.muted)gestureUntil=0;desired={muted:data.muted,volume:data.volume};focused=data.focused===true;if(typeof data.accent==='string'&&/^#[a-f0-9]{6}$/i.test(data.accent))document.documentElement.style.setProperty('--kr-player-accent',data.accent);
    const root=document.documentElement,scale=Number.isFinite(data.fullscreenScale)&&data.fullscreenScale>0&&data.fullscreenScale<=64?data.fullscreenScale:1;
    if(data.viewportLocked===true){if(root.dataset.krViewportLocked!=='true')root.dataset.krViewportLocked='true';if(root.style.getPropertyValue('--kr-fullscreen-scale')!==String(scale)){root.style.setProperty('--kr-fullscreen-scale',String(scale));root.style.setProperty('--kr-fullscreen-inverse',String(1/scale));}}
    else if(root.hasAttribute('data-kr-viewport-locked')){delete root.dataset.krViewportLocked;root.style.removeProperty('--kr-fullscreen-scale');root.style.removeProperty('--kr-fullscreen-inverse');}
    const all=discoverVideos(),video=primary(all);
    syncPlaybackControls(video);
    if(data.action==='play')execute('play',all,video);
    else{
      for(const item of all)settings(item);
      if(data.action==='pause')execute('pause',all,video);
      else if(data.action==='settings')nativeSettings();
    }
    scheduleStatus();
  });
  window.addEventListener('dblclick',event=>{
    if(!session||event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable="true"]'))return;
    event.preventDefault();event.stopImmediatePropagation();send('kick-refined:focus');
  },true);
  window.addEventListener('keydown',event=>{
    if(session&&event.key==='Escape'&&document.documentElement.dataset.krViewportLocked==='true'){event.preventDefault();event.stopImmediatePropagation();send('kick-refined:fullscreen',{exit:true});return;}
    if(session&&!event.defaultPrevented&&!event.repeat&&event.code==='KeyF'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&!event.composedPath().some(node=>node?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName))){event.preventDefault();event.stopImmediatePropagation();void toggleFullscreen().catch(()=>{});return;}
  },true);
  let unsubscribe=()=>{};
  const nativeControls='.z-controls.bottom-0';
  function changed(records){
    let mediaChanged=false,controlsChanged=false;
    function inspect(node,added){
      if(node.matches('video')){
        if(added&&isStreamVideo(node))settings(node);
        mediaChanged=true;
      }else if(node.matches(nativeControls))controlsChanged=true;
    }
    for(const record of records){
      if(record.type==='attributes'){controlsChanged=true;continue;}
      if(!controlsChanged&&record.target?.closest?.(nativeControls))controlsChanged=true;
      for(const nodes of [record.addedNodes,record.removedNodes]){
        const added=nodes===record.addedNodes;
        for(const node of nodes||[]){
          if(node.nodeType!==1||node.matches('script,style,link,meta,[data-kr-unified-row]'))continue;
          if(added&&(node.tagName==='HEAD'||node.tagName==='HTML')&&!chromeStyle.isConnected)mediaChanged=true;
          inspect(node,added);
          if(node.firstElementChild)for(const candidate of node.querySelectorAll(`video,${nativeControls}`))inspect(candidate,added);
        }
      }
    }
    if(mediaChanged){if(!scanTimer)scanTimer=setTimeout(scan,80);}
    else if(controlsChanged)scheduleStatus();
  }
  function init(){(document.head||document.documentElement).append(chromeStyle);scan();unsubscribe=KickRefinedPlayerDOM.subscribe(changed);send('kick-refined:ready');}
  window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;knownVideos=[];unsubscribe();clearTimeout(scanTimer);clearTimeout(statusTimer);globalThis.KickRefinedPlayerControls?.clear(controlsRoot||document);}});
  if(document.documentElement)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
