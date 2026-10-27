/* One-way controls for Refined-owned embeds. Status never grants audio ownership. */
(() => {
  if (window === window.top || !/^kick-refined:[a-z0-9_]{1,40}$/.test(window.name)) return;
  let desired={muted:true,volume:1}, session='', revision=-1, origin='https://kick.com';
  let scanTimer=0,statusTimer=0,action=null,error='',activation=null;
  const wired=new WeakSet();
  function videos(){return [...document.querySelectorAll('video')];}
  function primary(){const all=videos();return all.find(v=>!v.paused)||all.find(v=>v.getBoundingClientRect?.().width>0)||all[0];}
  function send(type,extra={}){window.parent.postMessage({type,session,revision,...extra},origin);}
  function report(){
    statusTimer=0;const video=primary();
    send('kick-refined:status',{hasVideo:!!video,playing:!!video&&!video.paused&&!video.ended,muted:video?.muted??true,volume:video?.volume??desired.volume,error});
  }
  function scheduleStatus(){if(!statusTimer)statusTimer=setTimeout(report,60);}
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
  function scan(){
    scanTimer=0;let added=false;
    for(const video of videos())if(!wired.has(video)){
      wired.add(video);added=true;settings(video);
      for(const event of ['volumechange','play','pause','ended','loadedmetadata','error'])video.addEventListener(event,scheduleStatus);
    }
    if(added){send('kick-refined:ready');if(action){const next=action;action=null;execute(next);}scheduleStatus();}
  }
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==window.parent||!['https://kick.com','https://www.kick.com'].includes(event.origin)||data?.type!=='kick-refined:control'
      ||typeof data.session!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.session)||!Number.isSafeInteger(data.revision)||data.revision<0
      ||typeof data.muted!=='boolean'||!Number.isFinite(data.volume)||data.volume<0||data.volume>1)return;
    if(session&&session!==data.session||data.revision<=revision)return;
    session=data.session;revision=data.revision;origin=event.origin;desired={muted:data.muted,volume:data.volume};
    for(const video of videos())settings(video);
    if(['play','pause'].includes(data.action))execute(data.action);
    scheduleStatus();
  });
  window.addEventListener('dblclick',event=>{
    if(!session||event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable="true"]'))return;
    event.preventDefault();event.stopImmediatePropagation();send('kick-refined:focus');
  },true);
  const observer=new MutationObserver(()=>{if(!scanTimer)scanTimer=setTimeout(scan,80);});
  function init(){scan();observer.observe(document.documentElement,{childList:true,subtree:true});send('kick-refined:ready');}
  if(document.documentElement)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
