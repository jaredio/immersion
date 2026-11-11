/* Top-level clip workspace: identity, replay navigation, and one editor frame. */
(() => {
  const editable=event=>event.composedPath().some(node=>node?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName));
  function create({getSources=()=>[],isWorkspace=()=>false,enabled=true,createEditor}={}){
    let host,dialog,frame,select,status,history,historyStyle,token='',closed=true,disposed=false,loadTimer=0,returnFocus=null,mode='live',frameMode='live',currentRow=null,windowControls=null;
    const editor=createEditor({enabled});
    const sources=()=>getSources().filter(item=>/^[a-z0-9_]{1,40}$/.test(item.slug)).slice(0,6);
    const send=data=>frame?.contentWindow?.postMessage({token,...data},location.origin);
    function close(){if(closed)return;windowControls?.finish();closed=true;clearTimeout(loadTimer);history.hide();frame?.remove();frame=null;if(dialog.matches(':popover-open'))dialog.hidePopover();dialog.close();returnFocus?.focus?.({preventScroll:true});}
    function identity(slug){
      const row=sources().find(row=>row.slug===slug)||{slug,title:slug};
      dialog.querySelector('.identity-name').textContent=row.title||slug;dialog.querySelector('.identity-title').textContent=row.streamTitle||'Find the moment. Make the cut.';
      const avatar=dialog.querySelector('.identity img');avatar.hidden=true;
      try{const url=new URL(row.image);if(url.protocol==='https:'&&!url.username&&!url.password){avatar.src=url.href;avatar.hidden=false;}}catch{}
      dialog.querySelector('.profile').href=`/${slug}?tab=about`;dialog.querySelector('.external').href=`/${slug}`;
    }
    function load(slug,row=null){
      clearTimeout(loadTimer);frame?.remove();token=crypto.randomUUID();currentRow=row?.catalog?null:row;frameMode=row?.catalog?'catalog':mode;dialog.dataset.editing='false';status.textContent=row?.catalog?'Finding broadcasts on Kick…':row?'Loading the full replay…':'Loading the channel for clipping…';
      const child=document.createElement('iframe');frame=child;child.name=`kick-refined-clip:${slug}`;child.title=`Clip ${slug}`;child.allow='autoplay; clipboard-write';
      const url=new URL(row?.href||`/${slug}`,location.origin);url.searchParams.set('immersion-frame','clip');child.src=url.href;
      dialog.querySelector('.frame').replaceChildren(child);dialog.querySelector('.frame').toggleAttribute('data-discovering',!!row?.catalog);dialog.querySelector('.external').href=row?.href||`/${slug}`;
      loadTimer=setTimeout(()=>{status.textContent='Kick is taking longer to load. Retry, or open the channel in a tab.';},25000);
      child.addEventListener('load',()=>{if(frame===child)send({type:'immersion:clip-start',slug,mode:frameMode});});
    }
    function changeMode(next){
      if(next===mode)return;
      mode=next;dialog.dataset.mode=next;
      for(const button of dialog.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===next));
      if(next==='history'){startHistory();}else{history.hide();load(select.value);}
    }
    function startHistory(){history.setBusy(false);clearTimeout(loadTimer);frame?.remove();frame=null;currentRow=null;dialog.dataset.editing='false';dialog.querySelector('.return').hidden=true;status.textContent='Loading available recordings…';void history.load(select.value);}
    function mount(){
      if(host)return;host=document.createElement('div');host.id='kr-clip-studio-root';const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');
      style.textContent=`
      :host{color-scheme:dark;font:13px/1.5 Inter,system-ui,sans-serif;--studio-accent:var(--kr-accent,#b0ff8c)}*{box-sizing:border-box}[hidden]{display:none!important}dialog{padding:0;margin:auto;width:min(960px,calc(100vw - 24px));height:min(980px,calc(100dvh - 24px));max-width:none;max-height:none;border:1px solid #ffffff16;border-radius:18px;color:#ededf4;background:#0d0d10;box-shadow:0 18px 60px #0006;z-index:2147483600;overflow:hidden}dialog[open]{display:flex;flex-direction:column}dialog::backdrop{background:transparent;pointer-events:none}.bar{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #ffffff0d;background:linear-gradient(125deg,#1b1e1b,#141419 55%,#101014)}.identity{display:flex;align-items:center;gap:11px;min-width:0;flex:1}.identity-photo{position:relative;width:40px;height:40px;flex:none;border:1px solid color-mix(in srgb,var(--studio-accent) 50%,transparent);border-radius:50%;background:linear-gradient(140deg,#30442a,#1c2220);padding:3px;box-shadow:0 0 0 3px #b0ff8c06}.identity img{width:100%;height:100%;border-radius:50%;object-fit:cover}.identity-copy{min-width:0}.identity-name{font-size:14px;font-weight:700;letter-spacing:-.02em}.identity-title{font-size:11px;color:#9696a7;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:480px}.studio-label{font-size:9px;color:var(--studio-accent);font-weight:650;letter-spacing:.13em;text-transform:uppercase;margin-left:9px}.bar select{max-width:180px}.bar .profile{padding:7px;font-size:12px}.bar .close{width:30px;height:30px;padding:0;flex:none}button,select,a{font:inherit;color:#dcdce7;background:#ffffff05;border:1px solid #ffffff13;border-radius:8px;padding:7px 10px}button,a{cursor:pointer}button:hover,a:hover{color:var(--studio-accent);border-color:color-mix(in srgb,var(--studio-accent) 35%,transparent)}button:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--studio-accent);outline-offset:2px}a{text-decoration:none}.modes{display:flex;align-items:center;gap:5px;padding:9px 18px;border-bottom:1px solid #ffffff09}.modes button{border-color:transparent;background:transparent;font-size:12px;padding:6px 11px;color:#9191a5}.modes button[aria-pressed=true]{background:color-mix(in srgb,var(--studio-accent) 8%,#131318);border-color:color-mix(in srgb,var(--studio-accent) 25%,transparent);color:var(--studio-accent)}.modes .return{margin-left:auto}.frame{flex:1;min-height:0;overflow:hidden;position:relative}iframe{width:100%;height:100%;border:0;display:block;background:#0d0d10}.frame[data-discovering] iframe{visibility:hidden}.frame[data-discovering]:after{content:'Finding broadcasts...';position:absolute;inset:0;display:grid;place-items:center;color:#9292a5;font-size:13px}.foot{display:flex;align-items:center;gap:8px;border-top:1px solid #ffffff0b;padding:9px 14px;min-height:48px;background:#111115}.foot span{font-size:11px;flex:1;color:#9090a2}.foot button,.foot a{font-size:11px;white-space:nowrap}dialog[data-editing=true] .history{display:none!important}@media(max-width:600px){.bar{padding:10px;gap:7px}.identity-photo{width:32px;height:32px}.identity-title{max-width:160px;font-size:10px}.bar select{max-width:110px;font-size:11px}.bar .profile{display:none}.studio-label{display:block;margin:0;font-size:8px}.identity-name{font-size:12px}.modes{padding:7px}.foot{flex-wrap:wrap}.foot span{flex-basis:100%}.history{padding:10px!important}}
      `;
      // A manual popover keeps the window above fullscreen players without
      // making the document inert or adding a modal backdrop.
      dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Immersion clip studio');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','false');dialog.popover='manual';dialog.dataset.mode='live';
      dialog.innerHTML='<header class="bar"><div class="identity"><div class="identity-photo"><img alt="" hidden></div><div class="identity-copy"><div><strong class="identity-name"></strong><span class="studio-label">Clip studio</span></div><div class="identity-title"></div></div></div><select aria-label="Stream to clip"></select><a class="profile" target="_blank" rel="noopener noreferrer" aria-label="Open streamer profile">Profile ↗</a><button type="button" class="close" aria-label="Close clip studio">✕</button></header><div class="modes" role="group" aria-label="Clip source"><button type="button" data-mode="live" aria-pressed="true">Live moment</button><button type="button" data-mode="history" aria-pressed="false">Stream history</button><button type="button" class="return" hidden>Back to timeline</button></div><div class="frame"></div><footer class="foot"><span role="status" aria-live="polite"></span><button type="button" class="retry">Retry</button><a class="external" target="_blank" rel="noopener noreferrer">Open source ↗</a></footer>';
      history=KickRefinedClipHistory.create({onRecording:row=>load(select.value,row),onStatus:message=>{if(!closed&&mode==='history')status.textContent=message;},onDiscover:slug=>load(slug,{catalog:true,href:`${location.origin}/${slug}/videos`}),onSeek:time=>send({type:'immersion:clip-seek',time}),onPlay:()=>send({type:'immersion:clip-play'}),onClip:range=>{history.setBusy(true);status.textContent='Preparing the selected part of this recording…';send({type:'immersion:clip-create',start:range.start,end:range.end});}});
      historyStyle=document.createElement('style');historyStyle.textContent=history.css;dialog.querySelector('.foot').before(history.host);shadow.append(style,historyStyle,dialog);document.body.append(host);windowControls=KickRefinedClipWindow.create({dialog,handle:dialog.querySelector('.bar')});select=dialog.querySelector('.bar select');status=dialog.querySelector('.foot [role=status]');
      dialog.querySelector('.close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      select.addEventListener('change',()=>{identity(select.value);if(mode==='history')startHistory();else load(select.value);});
      dialog.querySelector('.retry').addEventListener('click',()=>{if(mode==='history'&&!currentRow)startHistory();else load(select.value,currentRow);});
      for(const button of dialog.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>changeMode(button.dataset.mode));
      dialog.querySelector('.return').addEventListener('click',()=>{send({type:'immersion:clip-browse'});dialog.dataset.editing='false';});
      shadow.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();close();}event.stopPropagation();});shadow.addEventListener('keyup',event=>event.stopPropagation());
    }
    function open(slug){
      if(disposed||!enabled||!/^[a-z0-9_]{1,40}$/.test(slug))return;
      mount();const rows=sources();if(!rows.some(row=>row.slug===slug))rows.unshift({slug,title:slug});select.replaceChildren(...rows.map(row=>new Option(row.title||row.slug,row.slug)));select.value=slug;identity(slug);
      if(closed){returnFocus=document.activeElement;closed=false;dialog.show();dialog.showPopover?.();windowControls?.open();}mode='live';dialog.dataset.mode='live';dialog.querySelector('.return').hidden=true;history.hide();for(const button of dialog.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode==='live'));load(slug);
    }
    const click=event=>{const button=event.target.closest?.('button');if(!enabled||!isWorkspace()||!button||!button.matches('[data-kr-action="clip"],[data-testid="video-player-clip"],button[aria-label="Clip"],button[title="Clip"],button:has(svg[data-ds-icon="Clip"])')||button.closest('#clip-creator-dialog'))return;const slug=sources()[0]?.slug;if(slug){event.preventDefault();event.stopImmediatePropagation();open(slug);}};
    const keyboard=event=>{if(!enabled||event.defaultPrevented||event.repeat||!isWorkspace()||editable(event)||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||event.code!=='KeyC'||!closed||document.getElementById('clip-creator-dialog'))return;const slug=sources()[0]?.slug;if(slug){event.preventDefault();event.stopImmediatePropagation();open(slug);}};
    const message=event=>{
      if(closed||event.origin!==location.origin||event.source!==frame?.contentWindow)return;const data=event.data;
      if(data?.type==='immersion:clip-frame-ready'&&data.slug===select.value){send({type:'immersion:clip-start',slug:select.value,mode:frameMode});return;}
      if(data?.token!==token)return;
      if(data.type==='immersion:clip-catalog'){clearTimeout(loadTimer);history.acceptCatalog(data.rows);return;}
      if(data.type==='immersion:clip-source-state'){history.sourceState(data);clearTimeout(loadTimer);return;}
      if(data.type==='immersion:clip-state'){
        if(data.state==='requesting'){status.textContent='Kick is preparing the recent footage...';return;}
        clearTimeout(loadTimer);history.setBusy(false);dialog.dataset.editing=String(data.state==='editing'||data.state==='created');dialog.querySelector('.return').hidden=mode!=='history'||!['editing','created'].includes(data.state);
        status.textContent=data.state==='editing'?'Fine-tune your selection, then publish. Download becomes available after publishing.':data.state==='created'?'Clip published. Download it or copy its link above.':data.state==='auth'?'Sign in to Kick to create clips.':data.state==='history'?'Browse the recording and choose your in/out points.':data.state==='error'?'Kick could not open this clip range. Try another point or open the source.':'Preparing your clip…';
      }else if(data.type==='immersion:clip-close')close();
    };
    document.addEventListener('click',click,true);document.addEventListener('keydown',keyboard,true);window.addEventListener('message',message);
    return {open,close,refresh:()=>editor.refresh(),setEnabled(value){enabled=!!value;editor.setEnabled(enabled);if(!enabled)close();},destroy(){disposed=true;close();editor.destroy();windowControls?.destroy();history?.destroy();document.removeEventListener('click',click,true);document.removeEventListener('keydown',keyboard,true);window.removeEventListener('message',message);host?.remove();}};
  }
  globalThis.KickRefinedClipWorkspace=Object.freeze({create});
})();
