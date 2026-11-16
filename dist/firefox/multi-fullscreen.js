/* Fullscreen the pane while retaining the embedded page's layout viewport. */
(() => {
  function create({shadow,onChange=()=>{},onError=()=>{}}){
    let current=null;
    const properties=['width','height','left','top','transform','transform-origin'];
    const selected=tile=>shadow.fullscreenElement===tile.card;
    function release(){
      const state=current;if(!state)return;current=null;cancelAnimationFrame(state.frameId);
      for(const [key,{value,priority}]of state.styles)if(value)state.frame.style.setProperty(key,value,priority);else state.frame.style.removeProperty(key);
      delete state.tile.card.dataset.krViewportLocked;onChange(state.tile,false,1);
    }
    function refresh(){
      const state=current;if(!state)return;
      if(state.tile.frame!==state.frame||!state.frame.isConnected){release();return;}
      const rect=state.tile.player.getBoundingClientRect(),scale=Math.min(rect.width/state.width,rect.height/state.height);
      if(!(scale>0&&Number.isFinite(scale)))return;
      const transform=`translate(-50%, -50%) scale(${scale})`;
      if(state.transform!==transform){state.transform=transform;state.frame.style.setProperty('transform',transform,'important');}
      if(Math.abs(state.scale-scale)>.0001){state.scale=scale;onChange(state.tile,true,scale);}
    }
    function settle(state){
      if(current!==state)return;
      refresh();if(current!==state)return;
      const box=state.tile.player.getBoundingClientRect(),key=`${box.width}:${box.height}`;
      state.stable=state.lastBox===key?state.stable+1:0;state.lastBox=key;
      if(state.stable>=2||performance.now()-state.exitAt>300){release();return;}
      state.frameId=requestAnimationFrame(()=>settle(state));
    }
    function changed(){
      const state=current;if(!state)return;
      if(selected(state.tile)){state.exiting=false;refresh();return;}
      if(state.exiting)return;state.exiting=true;state.exitAt=performance.now();state.stable=0;state.lastBox='';
      state.frameId=requestAnimationFrame(()=>settle(state));
    }
    function toggle(tile,viewport){
      if(current?.pending||current?.exiting)return Promise.resolve();
      if(selected(tile))return document.exitFullscreen().catch(error=>onError(error));
      if(!tile.frame?.isConnected)return Promise.resolve();
      if(current)release();
      let width=tile.frame.clientWidth,height=tile.frame.clientHeight;
      if(Number.isInteger(viewport?.width)&&viewport.width>0&&viewport.width<=16384&&Number.isInteger(viewport?.height)&&viewport.height>0&&viewport.height<=16384){width=viewport.width;height=viewport.height;}
      if(!width||!height)return Promise.resolve();
      const frame=tile.frame,styles=new Map(properties.map(key=>[key,{value:frame.style.getPropertyValue(key),priority:frame.style.getPropertyPriority(key)}]));
      const state=current={tile,frame,width,height,styles,scale:1,pending:true,exiting:false,frameId:0};
      tile.card.dataset.krViewportLocked='true';
      for(const [key,value]of Object.entries({width:`${width}px`,height:`${height}px`,left:'50%',top:'50%','transform-origin':'center center',transform:'translate(-50%, -50%) scale(1)'}))frame.style.setProperty(key,value,'important');
      onChange(tile,true,1);
      return tile.card.requestFullscreen().then(()=>{if(current===state){state.pending=false;refresh();}},error=>{if(current===state)release();onError(error);});
    }
    return {toggle,refresh,changed,exit(tile){if(selected(tile))return document.exitFullscreen().catch(error=>onError(error));return Promise.resolve();},forget(tile){if(current?.tile===tile)release();},close(){if(current&&selected(current.tile))void document.exitFullscreen().catch(()=>{});release();}};
  }
  globalThis.KickRefinedMultiFullscreen=Object.freeze({create});
})();
