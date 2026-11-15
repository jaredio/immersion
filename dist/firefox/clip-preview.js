/* One demand-loaded profile clip dialog. The shared clip engine owns playback. */
(() => {
  const css=`
    :host{color-scheme:dark;font:13px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;--accent:var(--kr-accent,#b0ff8c)}*{box-sizing:border-box}
    dialog{width:min(880px,calc(100vw - 28px));max-width:none;max-height:calc(100dvh - 28px);margin:auto;padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid #ffffff1a;border-radius:14px;background:#111115;color:#ededf5;box-shadow:0 24px 90px #000b}
    dialog::backdrop{background:#000a;touch-action:none}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #ffffff0c;background:#141419}.heading{flex:1;min-width:0}.eyebrow{display:block;margin:0 0 3px;color:#9292a5;font-size:10px;letter-spacing:.05em}h2{margin:0;font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
    button,a{font:inherit;outline-offset:3px}button{display:grid;place-items:center;width:30px;height:30px;flex:none;border:1px solid #ffffff12;border-radius:7px;background:#ffffff05;color:#bdbdcb;cursor:pointer}button:hover{background:#ffffff0c;color:#fff;border-color:#ffffff25}button:focus-visible,a:focus-visible{outline:2px solid var(--accent)}svg{width:16px;height:16px}
    .stage{width:100%;aspect-ratio:16/9;max-height:calc(100dvh - 180px);min-height:120px;background:#08080b;overflow:hidden}.stage>.kr-chat-clip{height:100%}footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 16px;border-top:1px solid #ffffff0c;color:#9292a5;font-size:11px}.credit{min-width:0;overflow-wrap:anywhere}.credit:empty{display:none}footer a{flex:none;margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #ffffff0e;border-radius:6px;color:#b8b8c8;text-decoration:none}footer a:hover{color:var(--accent);background:#ffffff05}
    @media(max-width:540px){dialog{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:11px}header{padding:12px;gap:10px}h2{font-size:13px}.stage{max-height:calc(100dvh - 190px)}footer{padding:10px 12px;gap:8px;flex-wrap:wrap}}
  `;
  function create({onActiveChange=()=>{}}={}){
    let active=null,players=null,enabled=true,disposed=false;
    function close({resume=true,focus=true,notify=true}={}){
      const session=active;if(!session)return;active=null;
      session.abort.abort();
      try{session.item?.release();}finally{
        if(session.dialog.open)session.dialog.close();session.host.remove();
        const {value,priority}=session.overflow;
        if(value)document.documentElement.style.setProperty('overflow',value,priority);else document.documentElement.style.removeProperty('overflow');
        if(notify)onActiveChange(false,resume&&session.url===location.href);
        if(resume&&session.url===location.href)for(const video of session.paused)if(video.isConnected&&video.paused&&!video.ended)void video.play().catch(()=>{});
        if(focus&&session.opener?.isConnected)session.opener.focus({preventScroll:true});
      }
    }
    function open(row,opener){
      if(disposed||!enabled)return false;
      const clip=KickRefinedClips.parseClip(row?.href);if(!clip)return false;
      const paused=active?.url===location.href?[...active.paused]:[];
      close({resume:false,focus:false,notify:false});
      const host=document.createElement('div');host.id='kr-clip-preview';const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=css;
      const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','clip-preview-title');dialog.setAttribute('aria-describedby','clip-preview-source');
      const header=document.createElement('header'),heading=document.createElement('div');heading.className='heading';
      const label=document.createElement('span');label.className='eyebrow';label.id='clip-preview-source';label.textContent=`Clip from ${clip.channel}`;
      const title=document.createElement('h2');title.id='clip-preview-title';title.textContent=typeof row.title==='string'?row.title.slice(0,300):'Kick clip';heading.append(label,title);
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.setAttribute('aria-label','Close clip preview');dismiss.title='Close clip preview';dismiss.autofocus=true;dismiss.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';header.append(heading,dismiss);
      const stage=document.createElement('div');stage.className='stage';
      const footer=document.createElement('footer'),credit=document.createElement('span');credit.className='credit';
      const original=document.createElement('a');original.href=clip.href;original.target='_blank';original.rel='noopener noreferrer';original.textContent='Open on Kick ↗';footer.append(credit,original);
      dialog.append(header,stage,footer);shadow.append(style,dialog);document.body.append(host);
      const root=document.documentElement,overflow={value:root.style.getPropertyValue('overflow'),priority:root.style.getPropertyPriority('overflow')};
      const session=active={host,dialog,opener,item:null,paused,overflow,url:location.href,abort:new AbortController()};const {signal}=session.abort;
      const valid=()=>active===session;
      dismiss.addEventListener('click',()=>close(),{signal});
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();},{signal});
      dialog.addEventListener('close',()=>{if(valid())close();},{signal});
      let outside=false;const isOutside=event=>{const rect=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);};
      dialog.addEventListener('pointerdown',event=>outside=isOutside(event),{signal});
      dialog.addEventListener('click',event=>{if(outside&&isOutside(event))close();outside=false;},{signal});
      for(const type of ['keydown','kick-refined-keydown'])shadow.addEventListener(type,event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}},{signal});
      window.addEventListener('popstate',()=>close({resume:false,focus:false}),{signal});
      window.addEventListener('pagehide',()=>close({resume:false,focus:false}),{signal});
      try{
        dialog.showModal();root.style.setProperty('overflow','hidden');onActiveChange(true);
        for(const video of document.querySelectorAll('main video'))if(!video.paused&&!video.ended&&!video.closest('aside,[role="dialog"],#clip-creator-dialog,[aria-hidden="true"]')&&!/advertisement/i.test(video.title)){
          if(!paused.includes(video))paused.push(video);video.pause();
        }
        players ||= KickRefinedClips.create({enabled:true,observeChat:false});
        session.item=players.importItem({href:clip.href,title:title.textContent,time:0,paused:false,volume:1});
        session.item.mount(stage,{info:data=>{if(!valid())return;if(data.title)title.textContent=data.title;credit.textContent=data.creator?`Clipped by ${data.creator}`:data.credit||'';},audio(){},ended(){},focus(){},remove:()=>{if(valid())close();}});
        stage.firstElementChild.setAttribute('data-clip-preview','');session.item.setMuted(false);dismiss.focus({preventScroll:true});return true;
      }catch(error){close();throw error;}
    }
    return {open,close,refresh(){if(active&&active.url!==location.href)close({resume:false,focus:false});},setEnabled(value){enabled=!!value;if(!enabled){close();players?.destroy();players=null;}},destroy(){if(disposed)return;disposed=true;close();players?.destroy();players=null;}};
  }
  globalThis.KickRefinedClipPreview=Object.freeze({create});
})();
