/* One workspace control strip for retained channel players and player frames.
 * Native controls stay in their React-owned tree; action buttons forward clicks. */
(() => {
  const states=new WeakMap();
  const paths={share:'M18 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 10l7-5M8 14l7 5',report:'M12 3 2 21h20zM12 9v5m0 3v1',play:'m8 5 11 7-11 7z',pause:'M8 5v14M16 5v14',mute:'m11 5-5 4H3v6h3l5 4zM16 9l5 6m0-6-5 6',sound:'m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',clip:'M4 9h16v11H4zM4 9l-1-4 16-3 1 4zM8 4l3 4m3-5 3 4',theatre:'M3 5h18v14H3zM7 5v14m10-14v14',pip:'M3 4h18v16H3zM12 12h7v6h-7z',fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',focus:'M3 4h18v16H3zM15 4v16',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'};
  const svg=name=>!paths[name]?'':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
  const style=document.createElement('style');style.textContent=`
    [data-kr-unified-bar]{container-type:inline-size!important;container-name:kr-player!important;width:100%!important;height:auto!important;min-height:0!important;display:flex!important;flex-direction:column!important;gap:5px!important;padding:5px 8px!important;box-sizing:border-box!important;background:linear-gradient(180deg,transparent,#09090bed 60%)!important}
    [data-kr-unified-bar]>:not([data-kr-unified-row]):not([data-kr-native-timeline]){display:none!important}
    [data-kr-unified-source]{display:none!important}
    [data-kr-unified-player] .z-controls:not(.bottom-0):not(:has(.z-controls.bottom-0)){display:none!important}
    [data-kr-unified-bar]>[data-kr-native-timeline]{position:relative!important;inset:auto!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;flex:none!important}
    [data-kr-unified-bar] [data-kr-unified-row]{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important;min-height:28px!important;flex:none!important;color:#dcdce7;font:11px/1 system-ui;box-sizing:border-box}
    [data-kr-unified-bar] [data-kr-unified-row] button{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;flex:0 0 auto!important;width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;margin:0!important;padding:5px!important;border:1px solid #ffffff12!important;border-radius:7px!important;background:#ffffff05!important;color:#dcdce7!important;font:11px/1 system-ui!important;cursor:pointer}
    [data-kr-unified-row] button:hover{color:var(--kr-player-accent,var(--kr-accent,#b0ff8c))!important;background:#ffffff12!important}
    [data-kr-unified-bar] [data-kr-unified-row] button svg{width:16px!important;height:16px!important}
    [data-kr-unified-row] [data-kr-volume]{display:block!important;appearance:none!important;flex:0 1 96px!important;width:clamp(36px,9vw,96px)!important;min-width:28px!important;height:4px!important;margin:0!important;padding:0!important;border:0!important;border-radius:4px!important;background:#73737f!important;cursor:pointer}
    [data-kr-volume]::-webkit-slider-thumb{appearance:none;width:10px;height:10px;border-radius:50%;background:#e6e6ef}
    [data-kr-volume]::-moz-range-thumb{width:10px;height:10px;border:0;border-radius:50%;background:#e6e6ef}
    [data-kr-unified-bar] [data-kr-unified-row] [data-kr-live]{width:auto!important;min-width:0!important;height:24px!important;min-height:24px!important;padding:3px 5px!important;gap:5px!important;font-size:11px!important;background:transparent!important;border-color:transparent!important;white-space:nowrap}
    [data-kr-live]::before{content:'';width:5px;height:5px;flex:none;border-radius:50%;background:var(--kr-player-accent,var(--kr-accent,#b0ff8c))}
    [data-kr-elapsed]{font-size:10px;white-space:nowrap;font-variant-numeric:tabular-nums;color:#b5b5c3}
    [data-kr-control-spacer]{flex:1!important;min-width:0!important}
    [data-kr-unified-row] button[hidden]{display:none!important}
    @container kr-player (max-width:600px){[data-kr-unified-bar] [data-kr-unified-row] [data-kr-action=share],[data-kr-unified-bar] [data-kr-unified-row] [data-kr-action=report]{display:none!important}}
    @container kr-player (max-width:460px){[data-kr-unified-bar] [data-kr-unified-row]{gap:5px!important}[data-kr-elapsed]{display:none}[data-kr-unified-row] [data-kr-volume]{flex-basis:48px!important}[data-kr-unified-bar] [data-kr-unified-row] [data-kr-action=theatre],[data-kr-unified-bar] [data-kr-unified-row] [data-kr-action=pip]{display:none!important}}
    @container kr-player (max-width:340px){[data-kr-unified-bar] [data-kr-unified-row] [data-kr-action=clip],[data-kr-unified-bar] [data-kr-unified-row] [data-kr-action=fullscreen]{display:none!important}}
    @container kr-player (max-width:260px){[data-kr-unified-bar] [data-kr-unified-row] [data-kr-live]{display:none!important}[data-kr-unified-row] [data-kr-volume]{flex-basis:32px!important}}
  `;
  function kind(button){
    const label=[button.getAttribute('aria-label'),button.title,button.dataset.testid,button.querySelector('svg')?.getAttribute('data-ds-icon'),button.textContent].filter(Boolean).join(' ').toLowerCase();
    if(/picture.in.picture|\bpip\b/.test(label))return 'pip';
    if(/theat(er|re)|cinema/.test(label))return 'theatre';
    if(/fullscreen|full.screen/.test(label))return 'fullscreen';
    if(/settings|quality|\bgear\b/.test(label))return 'settings';
    if(/\bclip\b/.test(label))return 'clip';
    if(/share/.test(label))return 'share';
    if(/report/.test(label))return 'report';
    if(/\b(play|pause)\b/.test(label)&&!/display|playback.speed/.test(label))return 'play';
    if(/volume|sound|speaker|mute/.test(label))return 'volume';
    return '';
  }
  function sync(root,options){
    const bar=root?.querySelector('.z-controls.bottom-0:has(button)');if(!bar)return false;
    if(!style.isConnected)(document.head||document.documentElement).append(style);
    (root.nodeType===9?root.documentElement:root).setAttribute('data-kr-unified-player','');
    bar.setAttribute('data-kr-unified-bar','');let state=states.get(bar);
    if(!state){
      const row=document.createElement('div');row.dataset.krUnifiedRow='';
      state={row,buttons:{},sources:{},options,video:null};states.set(bar,state);
      const button=(key,label,handler)=>{const node=document.createElement('button');node.type='button';node.dataset.krAction=key;node.title=label;node.setAttribute('aria-label',label);node.innerHTML=svg(key);node.addEventListener('click',event=>{event.stopPropagation();handler();});row.append(node);state.buttons[key]=node;return node;};
      button('play','Pause',()=>state.options.onToggle());
      button('sound','Mute',()=>{const current=state.options.getState();state.options.onVolume(!current.muted,current.volume);});
      const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='100';volume.step='1';volume.dataset.krVolume='';volume.setAttribute('aria-label','Volume');volume.addEventListener('input',()=>state.options.onVolume(Number(volume.value)===0,Number(volume.value)/100));row.append(volume);state.volume=volume;
      const elapsed=document.createElement('span');elapsed.dataset.krElapsed='';row.append(elapsed);state.elapsed=elapsed;
      const live=button('live','Go live',()=>{const video=state.options.getVideo();if(video?.seekable.length)video.currentTime=video.seekable.end(video.seekable.length-1);});live.dataset.krLive='';live.textContent='LIVE';
      const spacer=document.createElement('span');spacer.dataset.krControlSpacer='';row.append(spacer);
      for(const key of ['clip','share','report','theatre','pip','fullscreen','settings'])button(key,{clip:'Clip',share:'Share',report:'Report',theatre:'Theatre mode',pip:'Picture in picture',fullscreen:'Fullscreen',settings:'Settings'}[key],()=>{
        const source=state.sources[key];if(source){source.click();if(key==='settings')requestAnimationFrame(()=>{const menu=document.getElementById(source.getAttribute('aria-controls'))||document.querySelector('[role="menu"][data-state="open"]');const portal=menu?.closest('[data-radix-popper-content-wrapper]');if(portal){const rect=bar.getBoundingClientRect();portal.style.setProperty('position','fixed','important');portal.style.setProperty('transform','none','important');portal.style.setProperty('left',`${Math.max(8,rect.right-portal.getBoundingClientRect().width)}px`,'important');portal.style.setProperty('top',`${Math.max(8,rect.top-portal.getBoundingClientRect().height)}px`,'important');}});}else if(key==='fullscreen')root.requestFullscreen?.().catch(()=>{});
      });
      const focus=button('focus','Focus stream',()=>state.options.onFocus());focus.dataset.krWorkspaceFocus='';
      bar.append(row);
    }
    state.options=options;state.sources={};
    for(const source of root.querySelectorAll('button')){
      if(source.closest('[data-kr-unified-row],[role="menu"],[role="dialog"]'))continue;
      const key=kind(source);if(!key)continue;
      source.setAttribute('data-kr-unified-source','');if(!state.sources[key])state.sources[key]=source;
    }
    for(const child of bar.children){
      if(child===state.row)continue;
      const candidates=[child,...child.querySelectorAll('input,[role="slider"]')];
      const timeline=candidates.some(node=>(node.matches('input[type="range"],[role="slider"]'))&&!/volume|sound/i.test([node.getAttribute('aria-label'),node.dataset.testid].join(' ')));
      if(timeline&&!child.querySelector('button'))child.setAttribute('data-kr-native-timeline','');
    }
    for(const key of ['clip','share','report','theatre','pip','settings']){
      const node=state.buttons[key];node.hidden=!state.sources[key];
      if(key==='settings'&&state.sources[key]){const label=/quality/i.test(state.sources[key].getAttribute('aria-label')||'')?'Quality':'Settings';node.title=label;node.setAttribute('aria-label',label);}
    }
    const current=options.getState(),video=options.getVideo(),playing=!!video&&!video.paused;
    for(const [key,label,icon]of [['play',playing?'Pause':'Play',playing?'pause':'play'],['sound',current.muted?'Unmute':'Mute',current.muted?'mute':'sound'],['focus',current.focused?'Return to grid':'Focus stream',current.focused?'grid':'focus']]){
      const node=state.buttons[key];if(node.title!==label||!node.dataset.krIcon){node.title=label;node.setAttribute('aria-label',label);node.innerHTML=svg(icon);node.dataset.krIcon=icon;}
    }
    const value=String(Math.round(current.volume*100));if(state.volume.value!==value)state.volume.value=value;state.volume.title=`Volume ${value}%`;
    const updateTime=()=>{const seconds=Math.max(0,Math.floor(video?.currentTime||0)),hours=Math.floor(seconds/3600);const time=`${hours?`${hours}:`:''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;if(state.elapsed.textContent!==time)state.elapsed.textContent=time;};updateTime();
    if(video&&state.video!==video){state.video?.removeEventListener('timeupdate',state.timeHandler);state.video=video;state.timeHandler=()=>{if(state.row.isConnected)updateTime();};video.addEventListener('timeupdate',state.timeHandler);}
    return true;
  }
  function clear(root){(root?.nodeType===9?root.documentElement:root)?.removeAttribute('data-kr-unified-player');for(const bar of root?.querySelectorAll('[data-kr-unified-bar]')||[]){const state=states.get(bar);state?.video?.removeEventListener('timeupdate',state.timeHandler);states.delete(bar);}for(const node of root?.querySelectorAll('[data-kr-unified-row]')||[])node.remove();for(const node of root?.querySelectorAll('[data-kr-unified-source],[data-kr-unified-bar],[data-kr-native-timeline]')||[]){node.removeAttribute('data-kr-unified-source');node.removeAttribute('data-kr-unified-bar');node.removeAttribute('data-kr-native-timeline');}}
  globalThis.KickRefinedPlayerControls={sync,clear};
})();
