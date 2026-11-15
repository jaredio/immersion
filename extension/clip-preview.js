/* One demand-loaded profile clip dialog. The shared clip engine owns playback. */
(() => {
  const css=`
    :host{color-scheme:dark;font:13px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;--accent:var(--kr-accent,#b0ff8c)}*{box-sizing:border-box}
    dialog{width:min(880px,calc(100vw - 28px));max-width:none;max-height:calc(100dvh - 28px);margin:auto;padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid #ffffff1a;border-radius:14px;background:#111115;color:#ededf5;box-shadow:0 24px 90px #000b}
    dialog::backdrop{background:#000a;touch-action:none}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #ffffff0c;background:#141419}.heading{flex:1;min-width:0}.eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 3px;color:#d5d5df;font-size:12px;font-weight:600;overflow-wrap:anywhere}.eyebrow small{color:#838395;font-size:9px;font-weight:500;letter-spacing:.08em;text-transform:uppercase}.avatar{position:relative;display:grid;place-items:center;flex:none;width:40px;height:40px;overflow:hidden;border:1px solid #ffffff20;border-radius:50%;background:linear-gradient(145deg,#29352f,#18191f);color:var(--accent);font-size:16px;font-weight:600}.avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}h2{margin:0;color:#aaaabc;font-size:12px;font-weight:400;line-height:1.4;overflow-wrap:anywhere}
    button,a{font:inherit;outline-offset:3px}button{display:grid;place-items:center;width:30px;height:30px;flex:none;border:1px solid #ffffff12;border-radius:7px;background:#ffffff05;color:#bdbdcb;cursor:pointer}button:hover{background:#ffffff0c;color:#fff;border-color:#ffffff25}button:focus-visible,a:focus-visible{outline:2px solid var(--accent)}svg{width:16px;height:16px}
    .body{display:grid;grid-template-columns:minmax(0,1fr)}.stage{width:100%;aspect-ratio:16/9;max-height:calc(100dvh - 210px);min-height:120px;background:#08080b;overflow:hidden}.stage>.kr-chat-clip{height:100%}footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 16px;border-top:1px solid #ffffff0c;color:#9292a5;font-size:11px}.credit{min-width:0;overflow-wrap:anywhere}.credit:empty{display:none}.footer-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-left:auto;flex-wrap:wrap}footer a,footer button{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:auto;height:auto;padding:6px 9px;border:1px solid #ffffff0e;border-radius:6px;background:#ffffff03;color:#b8b8c8;text-decoration:none;white-space:nowrap}footer a:hover,footer button:hover{color:var(--accent);background:#ffffff07}button:disabled{opacity:.4;cursor:default}footer svg{width:14px;height:14px}.action-status{margin:0;padding:0 16px 10px;color:#a8a8bb;font-size:11px}.action-status:empty{display:none}[hidden]{display:none!important}
    dialog[data-replay]{width:min(1200px,calc(100vw - 28px))}dialog[data-replay] .body{grid-template-columns:minmax(0,1fr) 300px}.replay{display:flex;flex-direction:column;min-height:0;max-height:calc(100dvh - 210px);border-left:1px solid #ffffff0e;background:#121217}.replay-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #ffffff0a}.replay-header strong{font-size:11px;font-weight:600}.replay-header button{display:grid;place-items:center;width:26px;height:26px;padding:0;line-height:1}.replay-header button svg{display:block;width:14px;height:14px}.replay-messages{flex:1;min-height:80px;overflow:auto;overscroll-behavior:contain;padding:8px 12px;scrollbar-width:thin;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.replay-messages p{margin:0 0 7px}.replay-messages strong{font-weight:600}.replay-messages time{margin-right:7px;color:#727286;font-size:9px;font-variant-numeric:tabular-nums}.replay-emote{width:26px;height:26px;object-fit:contain;vertical-align:middle}.replay-status{margin:0;padding:10px 12px;color:#9292a5;font-size:11px}.replay-retry{width:auto;align-self:flex-start;margin:0 12px 10px;padding:4px 8px;font-size:11px}.replay-note{padding:8px 12px;border-top:1px solid #ffffff0a;color:#737388;font-size:10px}
    @media(max-width:760px){dialog[data-replay] .body{grid-template-columns:minmax(0,1fr)}.replay{height:260px;max-height:38dvh;border-left:0;border-top:1px solid #ffffff0e}footer{align-items:flex-start;flex-wrap:wrap}.footer-actions{justify-content:flex-start;margin-left:0}}@media(max-width:540px){dialog,dialog[data-replay]{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:11px}header{padding:12px;gap:10px}.avatar{width:36px;height:36px}.stage{max-height:calc(100dvh - 210px)}footer{padding:10px 12px;gap:8px}.footer-actions{width:100%}footer a,footer button{padding:6px 8px;font-size:10px}.action-status{padding-left:12px;padding-right:12px}}
  `;
  function create({onActiveChange=()=>{}}={}){
    let active=null,players=null,enabled=true,disposed=false;
    function close({resume=true,focus=true,notify=true}={}){
      const session=active;if(!session)return;active=null;
      session.abort.abort();session.replay?.destroy();session.download?.abort();
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
      const avatar=document.createElement('span');avatar.className='avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=clip.channel[0].toUpperCase();
      const label=document.createElement('span');label.className='eyebrow';label.id='clip-preview-source';const channelName=document.createElement('span');channelName.textContent=clip.channel;const badge=document.createElement('small');badge.textContent='Clip';label.append(channelName,badge);
      const title=document.createElement('h2');title.id='clip-preview-title';title.textContent=typeof row.title==='string'?row.title.slice(0,300):'Kick clip';heading.append(label,title);
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.setAttribute('aria-label','Close clip preview');dismiss.title='Close clip preview';dismiss.autofocus=true;dismiss.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';header.append(avatar,heading,dismiss);
      const stage=document.createElement('div');stage.className='stage';
      const footer=document.createElement('footer'),credit=document.createElement('span');credit.className='credit';
      const actions=document.createElement('div');actions.className='footer-actions';
      const action=(text,path)=>{const button=document.createElement('button');button.type='button';button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="${path}"/></svg>`;const label=document.createElement('span');label.textContent=text;button.append(label);button.disabled=true;return button;};
      const download=action('Download','M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5');download.title='Download clip as MP4';download.setAttribute('aria-label','Download clip');
      const chat=action('Chat replay','M4 4h16v13H9l-5 4V4zM8 8h8M8 12h5');chat.title='Chat replay is unavailable for this clip';chat.setAttribute('aria-label','Pop out chat replay');chat.setAttribute('aria-expanded','false');
      const original=document.createElement('a');original.href=clip.href;original.target='_blank';original.rel='noopener noreferrer';original.textContent='Open on Kick ↗';actions.append(download,chat,original);footer.append(credit,actions);
      const body=document.createElement('div');body.className='body';body.append(stage);const actionStatus=document.createElement('p');actionStatus.className='action-status';actionStatus.setAttribute('role','status');
      dialog.append(header,body,footer,actionStatus);shadow.append(style,dialog);document.body.append(host);
      const root=document.documentElement,overflow={value:root.style.getPropertyValue('overflow'),priority:root.style.getPropertyPriority('overflow')};
      const session=active={host,dialog,opener,item:null,data:null,replay:null,download:null,paused,overflow,url:location.href,abort:new AbortController()};const {signal}=session.abort;
      const valid=()=>active===session;
      const closeReplay=()=>{session.replay?.destroy();session.replay=null;dialog.removeAttribute('data-replay');chat.setAttribute('aria-expanded','false');chat.focus({preventScroll:true});};
      chat.addEventListener('click',()=>{
        if(session.replay){closeReplay();return;}const video=stage.firstElementChild?.shadowRoot.querySelector('video');if(!session.data?.replay||!video)return;
        dialog.setAttribute('data-replay','');chat.setAttribute('aria-expanded','true');session.replay=KickRefinedClipReplay.create({container:body,video,data:session.data,signal,onClose:closeReplay});
      },{signal});
      download.addEventListener('click',async()=>{
        if(session.download){session.download.abort();return;}if(!session.data?.src)return;
        const controller=session.download=new AbortController(),stop=()=>controller.abort();signal.addEventListener('abort',stop,{once:true});
        download.querySelector('span').textContent='Cancel download';download.setAttribute('aria-label','Cancel clip download');download.title='Cancel clip download';actionStatus.textContent='Preparing MP4…';
        try{
          const blob=await KickRefinedClipTools.download(session.data,clip,{signal:controller.signal,onProgress:value=>{if(valid())actionStatus.textContent=`Downloading clip… ${value}%`;}});if(!valid()||controller.signal.aborted)return;
          const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=KickRefinedClipTools.filename(clip,title.textContent);shadow.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);actionStatus.textContent='MP4 ready. Your download has started.';
        }catch(error){if(valid())actionStatus.textContent=controller.signal.aborted?'Download cancelled.':error.message||'Could not download this clip. Try again.';}
        finally{signal.removeEventListener('abort',stop);session.download=null;if(valid()){download.querySelector('span').textContent='Download';download.setAttribute('aria-label','Download clip');download.title='Download clip as MP4';}}
      },{signal});
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
        session.item.mount(stage,{info:data=>{
          if(!valid())return;if(data.title)title.textContent=data.title;credit.textContent=data.creator?`Clipped by ${data.creator}`:data.credit||'';
          if(!data.src)return;session.data=data;download.disabled=false;chat.disabled=!data.replay;if(data.replay)chat.title='Pop out synchronized chat replay';channelName.textContent=data.channelName||clip.channel;
          if(data.channelImage){const image=document.createElement('img');image.alt='';image.src=data.channelImage;image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove(),{once:true});avatar.querySelector('img')?.remove();avatar.append(image);}
        },audio(){},ended(){},focus(){},remove:()=>{if(valid())close();}});
        stage.firstElementChild.setAttribute('data-clip-preview','');session.item.setMuted(false);dismiss.focus({preventScroll:true});return true;
      }catch(error){close();throw error;}
    }
    return {open,close,refresh(){if(active&&active.url!==location.href)close({resume:false,focus:false});},setEnabled(value){enabled=!!value;if(!enabled){close();players?.destroy();players=null;}},destroy(){if(disposed)return;disposed=true;close();players?.destroy();players=null;}};
  }
  globalThis.KickRefinedClipPreview=Object.freeze({create});
})();
