/* Workspace-owned audio, with explicit native volume gestures and full player controls. */
(() => {
  if (window === window.top || !/^kick-refined(?:-full)?:[a-z0-9_]{1,40}$/.test(window.name)) return;
  const fullPlayer=window.name.startsWith('kick-refined-full:');
  if(fullPlayer&&(!['kick.com','www.kick.com'].includes(location.hostname)||location.pathname.replace(/\/$/,'').toLowerCase()!==`/${window.name.split(':')[1]}`))return;
  let desired={muted:true,volume:1}, session='', revision=-1, origin='https://kick.com';
  let disposed=false,scanTimer=0,statusTimer=0,action=null,error='',activation=null,gestureUntil=0,focused=false,startedAt=null,lastStatus='',controlsRoot=null;
  const wired=new WeakSet();
  const chromeStyle=document.createElement('style');chromeStyle.textContent='.z-controls.bottom-0 input{accent-color:var(--kr-player-accent,#b0ff8c)}.z-controls.bottom-0 [class*=bg-kick-voltGreen]{background-color:var(--kr-player-accent,#b0ff8c)!important}';
  function nativeSettings(){const buttons=[...document.querySelectorAll('.z-controls button[aria-haspopup="menu"]')];const button=document.querySelector('.z-controls button[aria-label*="settings" i],.z-controls button[aria-label*="quality" i],.z-controls button:has(svg[data-ds-icon="Settings"]),.z-controls button:has(svg[data-ds-icon="Gear"])')||buttons.at(-1);button?.click();requestAnimationFrame(()=>{const menu=document.getElementById(button?.getAttribute('aria-controls'))||document.querySelector('[role="menu"][data-state="open"]'),wrapper=menu?.closest('[data-radix-popper-content-wrapper]');if(wrapper){wrapper.style.setProperty('position','fixed','important');wrapper.style.setProperty('transform','none','important');wrapper.style.setProperty('left',`${Math.max(8,innerWidth-wrapper.getBoundingClientRect().width-8)}px`,'important');wrapper.style.setProperty('top',`${Math.max(8,innerHeight-wrapper.getBoundingClientRect().height-54)}px`,'important');}});}
  window.addEventListener('pointerenter',()=>{if(session)send('kick-refined:hover',{hovered:true});});window.addEventListener('pointerleave',()=>{if(session)send('kick-refined:hover',{hovered:false});});
  function isStreamVideo(video){return video.id!=='clip-creator-player'&&!video.closest('#clip-creator-dialog,[role="dialog"],[role="alertdialog"]');}
  function videos(){return [...document.querySelectorAll('video')].filter(isStreamVideo);}
  function primary(){const all=videos();return all.find(v=>!v.paused)||all.find(v=>v.getBoundingClientRect?.().width>0)||all[0];}
  function send(type,extra={}){if(disposed)return;window.parent.postMessage({type,session,revision,...extra},origin);}
  function report(){
    statusTimer=0;const video=primary();
    syncPlaybackControls();
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
  function execute(next){
    action=next;const video=primary();if(!video)return;action=null;
    error='';
    if(next==='pause'){for(const item of videos())if(!item.paused)item.pause();scheduleStatus();return;}
    for(const item of videos())settings(item);
    const attempt=video.play();
    if(attempt?.then)attempt.then(()=>{activation?.remove();activation=null;error='';scheduleStatus();}).catch(reason=>{error=reason?.name||'PlaybackError';if(error==='NotAllowedError')enablePrompt();scheduleStatus();});
    scheduleStatus();
  }
  function syncPlaybackControls(){
    const root=document.querySelector('[data-kr-full-player-root]')||document;if(controlsRoot&&controlsRoot!==root)globalThis.KickRefinedPlayerControls?.clear(controlsRoot);controlsRoot=root;
    return globalThis.KickRefinedPlayerControls?.sync(root,{getVideo:primary,getState:()=>({...desired,focused,startedAt}),onToggle:()=>execute(primary()?.paused?'play':'pause'),onVolume:(muted,volume)=>{desired={muted,volume};for(const video of videos())settings(video);send('kick-refined:audio-intent',desired);scheduleStatus();},onFocus:()=>send('kick-refined:focus')});
  }
  function syncChrome(){syncPlaybackControls();}
  window.addEventListener('resize',()=>{syncChrome();scheduleStatus();});
  const gesture=event=>{if(event.type==='pointermove'&&!event.buttons)return;const control=event.target.closest?.('button,input,[role=slider]');if(control&&/volume|sound|speaker|mute|slider|range/i.test([control.getAttribute('aria-label'),control.title,control.getAttribute('role'),control.type,control.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ')))gestureUntil=Date.now()+1500;};document.addEventListener('pointerdown',gesture,true);document.addEventListener('pointermove',gesture,true);document.addEventListener('keydown',gesture,true);
  function scan(){
    scanTimer=0;if(disposed)return;globalThis.KickRefinedPerf?.count('frame.scans');if(document.documentElement&&!chromeStyle.isConnected)(document.head||document.documentElement).append(chromeStyle);syncChrome();let added=false;
    for(const video of videos())if(!wired.has(video)){
      wired.add(video);added=true;settings(video);
      for(const event of ['volumechange','play','pause','ended','loadedmetadata','loadeddata','canplay','playing','waiting','error'])video.addEventListener(event,()=>{if(event==='volumechange'&&video===primary()&&Date.now()<gestureUntil&&(video.muted!==desired.muted||Math.abs(video.volume-desired.volume)>.001)){desired={muted:video.muted,volume:video.volume};send('kick-refined:audio-intent',desired);}for(const item of videos())settings(item);scheduleStatus();});
    }
    scheduleStatus();if(added){send('kick-refined:ready');if(action){const next=action;action=null;execute(next);}scheduleStatus();}
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==window.parent||!['https://kick.com','https://www.kick.com'].includes(event.origin)||data?.type!=='kick-refined:control'
      ||typeof data.session!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.session)||!Number.isSafeInteger(data.revision)||data.revision<0
      ||typeof data.muted!=='boolean'||!Number.isFinite(data.volume)||data.volume<0||data.volume>1)return;
    if(session&&session!==data.session||data.revision<=revision)return;
    session=data.session;revision=data.revision;lastStatus='';if('startedAt' in data)startedAt=globalThis.KickRefinedStreamClock?.valid(data.startedAt)??null;globalThis.KickRefinedPerf?.configure(data.diagnostics===true);origin=event.origin;if(data.muted)gestureUntil=0;desired={muted:data.muted,volume:data.volume};focused=data.focused===true;if(typeof data.accent==='string'&&/^#[a-f0-9]{6}$/i.test(data.accent))document.documentElement.style.setProperty('--kr-player-accent',data.accent);syncChrome();
    for(const video of videos())settings(video);
    if(['play','pause'].includes(data.action))execute(data.action);else if(data.action==='settings')nativeSettings();
    scheduleStatus();
  });
  window.addEventListener('dblclick',event=>{
    if(!session||event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable="true"]'))return;
    event.preventDefault();event.stopImmediatePropagation();send('kick-refined:focus');
  },true);
  document.addEventListener('keydown',event=>{
    if(!session||event.defaultPrevented||event.repeat||event.code!=='KeyC'||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.composedPath().some(node=>node?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName)))return;
    event.preventDefault();event.stopImmediatePropagation();send('kick-refined:clip');
  },true);
  let unsubscribe=()=>{};
  const changed=records=>{let changed=false;for(const record of records){const target=record.target?.nodeType===3?record.target.parentElement:record.target;if(target?.closest?.('[data-kr-unified-row]')||fullPlayer&&target?.closest?.('#chatroom-messages'))continue;if(![...(record.addedNodes||[]),...(record.removedNodes||[])].some(node=>node.nodeType===1&&!node.matches?.('[data-kr-unified-row]')))continue;changed=true;for(const node of record.addedNodes||[]){if(node.matches?.('video')&&isStreamVideo(node))settings(node);for(const video of node.querySelectorAll?.('video')||[])if(isStreamVideo(video))settings(video);}}if(changed&&!scanTimer)scanTimer=setTimeout(scan,80);};
  function init(){(document.head||document.documentElement).append(chromeStyle);scan();unsubscribe=KickRefinedPlayerDOM.subscribe(changed);send('kick-refined:ready');}
  window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;unsubscribe();clearTimeout(scanTimer);clearTimeout(statusTimer);globalThis.KickRefinedPlayerControls?.clear(controlsRoot||document);}});
  if(document.documentElement)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
