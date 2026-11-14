/* Each iframe mount owns its bus registration, startup slot and UI handlers. */
(() => {
  function create({startup,bus,resize,isNative,isCurrent,getMode,priority,command,isMuted,onRemount,onState}) {
    function publish(tile){tile.card.dataset.playerState=tile.lifecycle.phase;onState(tile);}
    function drop(tile){
      tile.mountScope?.dispose();tile.mountScope=null;tile.lifecycle.reset();tile.lastSettings='';
      delete tile.card.dataset.nativeChrome;delete tile.card.dataset.readyState;
    }
    function failed(tile,message,token){
      if(!isCurrent(tile)||!tile.lifecycle.fail(token))return;
      startup.complete(tile.startJob);tile.startJob=null;
      if(tile.loading){tile.loading.hidden=false;tile.loadMessage.textContent=message;tile.retry.hidden=false;}
      publish(tile);
    }
    function mount(tile,{retrying=false}={}){
      const slug=tile.slug;
      if(isNative(slug)){tile.player.dataset.native='true';resize.observe(tile.player);tile.player.textContent='';return;}
      const mode=getMode(tile);
      if((tile.frame||tile.startJob)&&tile.frameMode===mode)return;
      drop(tile);tile.frameMode=mode;tile.card.dataset.playerMode=tile.embedFallback?'embed-fallback':mode;
      const scope=tile.mountScope=tile.scope.child(),token=tile.lifecycle.begin(mode,{queued:mode==='full',retrying});
      scope.defer(()=>{startup.cancel(tile.startJob);tile.startJob=null;bus.detach(tile);tile.frame?.remove();tile.loading?.remove();tile.frame=null;tile.loading=tile.retry=tile.loadMessage=null;tile.frameOrigin='';});
      const loading=document.createElement('div');loading.className='multi-player-loading';loading.hidden=mode!=='full';
      const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Waiting for a full-player startup slot...';
      const fallback=document.createElement('button');fallback.type='button';fallback.textContent='Use standard embed';fallback.setAttribute('aria-label',`Use embed for ${slug}`);
      const retry=document.createElement('button');retry.type='button';retry.textContent='Retry full player';retry.setAttribute('aria-label',`Retry full player for ${slug}`);retry.hidden=true;
      const remount=embed=>{const active=tile.card.getRootNode().activeElement,focused=active===fallback||active===retry;tile.pendingAction=tile.pendingAction||(tile.playing||!tile.everLoaded?'play':'pause');tile.embedFallback=embed;drop(tile);mount(tile,{retrying:!embed});onRemount(tile);if(focused)tile.card.querySelector('.multi-tile-header a')?.focus({preventScroll:true});};
      scope.listen(fallback,'click',()=>remount(true));scope.listen(retry,'click',()=>remount(false));
      loading.append(message,fallback,retry);Object.assign(tile,{loading,loadMessage:message,retry});tile.player.replaceChildren(loading);
      const start=scope.guard(()=>{
        if(!isCurrent(tile))return;
        tile.lifecycle.start(token);publish(tile);
        const frame=document.createElement('iframe');frame.name=`kick-refined${mode==='full'?'-full':''}:${slug}`;frame.title=`${slug} ${mode==='full'?'full player':'stream'}`;
        frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
        tile.frameOrigin=mode==='full'?location.origin:'https://player.kick.com';
        frame.src=mode==='full'?`${location.origin}/${encodeURIComponent(slug)}?immersion-frame=full`:`https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=true`;
        scope.listen(frame,'pointerenter',()=>tile.card.dataset.hovered='true');
        scope.listen(frame,'load',()=>{if(isCurrent(tile)&&tile.frame===frame)command(tile,isMuted(slug),{force:true});});
        scope.listen(frame,'error',()=>failed(tile,'Kick could not load this player.',token));
        message.textContent='Loading full Kick player...';tile.frame=frame;tile.player.replaceChildren(frame,loading);bus.attach(tile);
        if(mode==='full'&&!tile.pendingAction)tile.pendingAction=tile.playing||!tile.everLoaded?'play':'pause';
      });
      if(mode==='full'){
        tile.startJob=startup.enqueue({priority:priority(slug),start,onTimeout:scope.guard(job=>{if(tile.startJob===job){tile.startJob=null;failed(tile,'The full player is taking longer than expected. You can retry or use an embed.',token);}})});
      }else start();
      publish(tile);
    }
    function status(tile,data,live){
      if(!tile.lifecycle.status(data,{live}))return;
      if(tile.startJob&&['ready','offline','blocked'].includes(tile.lifecycle.phase)){startup.complete(tile.startJob);tile.startJob=null;}
      if(tile.loading&&['ready','offline','blocked'].includes(tile.lifecycle.phase))tile.loading.hidden=true;
      publish(tile);
    }
    return {mount,drop,status};
  }
  globalThis.KickRefinedMultiStreamPlayer=Object.freeze({create});
})();
