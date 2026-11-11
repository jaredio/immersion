/* Stream pane view; workspace policy lives in the controller. */
(() => {
    function create({slug,meta,native,video,volume:initialVolume,scope,decorate,onAction,onResize,onDispose}) {
      const card=document.createElement('section'); card.className='multi-tile'; card.dataset.channel=slug;
      const header=document.createElement('div'); header.className='multi-tile-header';
      const title=document.createElement('a'); title.href=`/${slug}?tab=overview`; title.target='_blank'; title.rel='noopener noreferrer'; title.title='Open channel profile'; title.textContent=meta?.title||slug;
      const identity=document.createElement('div');identity.className='multi-tile-identity';
      const photo=document.createElement('img');photo.alt='';photo.decoding='async';if(meta?.image)photo.src=meta.image;else photo.hidden=true;identity.append(photo);
      const words=document.createElement('div'),category=document.createElement('span');category.textContent=meta?.category||'Kick stream';words.append(title,category);identity.append(words);
      const status=document.createElement('span'); status.className='live-status'; status.dataset.live=meta?.live||'unknown';
      status.textContent=native?'Current stream':meta?.live==='live'?'Live':meta?.live==='offline'?'Offline':'';header.append(identity,status);
      header.title='Double-click the header to focus this stream or return to the grid';

      const player=document.createElement('div'); player.className='multi-player';
      const controls=document.createElement('div'); controls.className='multi-tile-controls';
      const tile={slug,card,player,frame:null,listen:null,pause:null,volume:video?.volume??initialVolume,lastVolume:video?.volume>0?video.volume:initialVolume,playing:!!video&&!video.paused,lastSettings:'',commandRevision:0,pendingAction:'',slider:null,level:null};
      tile.scope=scope;tile.lifecycle=KickRefinedPlayerState.create();tile.lifecycle.setPlaying(tile.playing);if(native)tile.lifecycle.begin('native');
      Object.defineProperties(tile,{playing:{get:()=>tile.lifecycle.playing,set:value=>tile.lifecycle.setPlaying(value)},everLoaded:{get:()=>tile.lifecycle.everHadVideo}});
      tile.scope.defer(()=>{tile.lifecycle.dispose();onDispose(tile);tile.card.remove();});
      tile.scope.listen(title,'click',event=>{
        if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
        event.preventDefault();onAction('profile',tile);
      });
      tile.scope.listen(card,'pointerenter',()=>card.dataset.hovered='true');tile.scope.listen(card,'pointerleave',()=>card.dataset.hovered='false');tile.scope.listen(header,'dblclick',event=>{if(event.target.closest('a,button,input'))return;event.preventDefault();onAction('focus',tile);});
      const quick=document.createElement('div');quick.className='multi-quick-actions';header.append(quick);
      tile.audible=document.createElement('span');tile.audible.className='multi-audible';tile.audible.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';tile.audible.setAttribute('role','img');tile.audible.setAttribute('aria-label',`Audio enabled for ${slug}`);tile.audible.title='Audio enabled';tile.audible.hidden=true;quick.append(tile.audible);
      const button=(label,text,action,target=controls)=>{const el=document.createElement('button');el.setAttribute('aria-label',`${label} ${slug}`);el.title=`${label} ${slug}`;decorate(el,({'Listen to':'sound',Play:'play',Focus:'focus','Move left':'left','Move right':'right',Fullscreen:'fullscreen',Remove:'close','Player settings':'settings','Create clip':'clip','Switch player':'single'})[label],label,true);tile.scope.listen(el,'click',action);target.append(el);return el;};
      tile.listen=button('Listen to','Listen',()=>onAction('listen',tile));
      const audioControl=document.createElement('div');audioControl.className='multi-audio-control';tile.audioControl=audioControl;tile.controls=controls;tile.scope.listen(controls,'pointerenter',()=>card.dataset.hovered='true');controls.append(audioControl);audioControl.append(tile.listen);
      const volume=document.createElement('label');volume.className='multi-volume';
      tile.slider=document.createElement('input');tile.slider.type='range';tile.slider.min='0';tile.slider.max='100';tile.slider.step='1';tile.slider.setAttribute('aria-label',`Volume for ${slug}`);
      tile.level=document.createElement('output');tile.level.textContent='100%';volume.append(tile.slider,tile.level);audioControl.append(volume);
      tile.scope.listen(tile.slider,'input',()=>onAction('volume',tile));
      tile.scope.listen(tile.slider,'change',()=>onAction('persist',tile));
      tile.pause=button('Play','Play',()=>onAction('pause',tile));
      tile.settings=button('Player settings','settings',()=>onAction('settings',tile));
      tile.clip=button('Create clip','clip',()=>onAction('clip',tile));
      tile.focus=button('Focus','focus',()=>onAction('focus',tile));
      tile.playerModeControl=button('Switch player','single',()=>onAction('mode',tile),quick);tile.playerModeControl.hidden=true;
      button('Fullscreen','fullscreen',()=>onAction('fullscreen',tile),quick);
      button('Remove','close',()=>onAction('remove',tile),quick);
      const edge=document.createElement('div');edge.className='multi-tile-resize';edge.tabIndex=0;edge.setAttribute('role','separator');edge.setAttribute('aria-label',`Resize ${slug}`);edge.setAttribute('aria-orientation','vertical');edge.setAttribute('aria-valuemin','2');edge.setAttribute('aria-valuemax','6');edge.title='Drag the edge to resize; arrow keys adjust, double-click resets';tile.edge=edge;
      onResize(tile,edge);
      card.append(header,player,controls,edge);if(native){card.dataset.nativePlayer='true';}return tile;
    }
  globalThis.KickRefinedMultiStreamTile=Object.freeze({create});
})();
