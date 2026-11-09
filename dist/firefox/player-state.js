/* A mount generation cannot update a replacement or a disposed player. */
(() => {
  function create() {
    let phase='idle',playback='unknown',generation=0,mode='full',isolated=false,everHadVideo=false;
    return {
      get phase(){return phase;},get playing(){return playback==='playing';},
      get isolated(){return isolated;},get everHadVideo(){return everHadVideo;},get generation(){return generation;},
      begin(nextMode,{queued=false,retrying=false}={}){if(phase==='disposed')return null;mode=nextMode;isolated=false;phase=retrying?'retrying':queued?'queued':'loading';return ++generation;},
      start(token){if(token!==generation||phase==='disposed')return false;phase='loading';return true;},
      status(data,{token=generation,live='unknown'}={}){
        if(token!==generation||phase==='disposed')return false;
        isolated=data.fullPlayerIsolated===true;everHadVideo ||= data.hasVideo===true;
        if(typeof data.playing==='boolean')playback=data.playing?'playing':'paused';
        if(data.error==='NotAllowedError')phase='blocked';
        else if(live==='offline'&&(mode!=='full'||isolated))phase='offline';
        else if(data.hasVideo&&data.readyState>=2&&(mode!=='full'||isolated))phase='ready';
        else if(phase!=='failed')phase='loading';
        return true;
      },
      setPlaying(value){if(phase!=='disposed')playback=value?'playing':'paused';},
      fail(token=generation){if(token!==generation||phase==='disposed')return false;phase='failed';return true;},
      reset(){if(phase==='disposed')return;generation++;isolated=false;phase='idle';},
      dispose(){generation++;isolated=false;phase='disposed';playback='unknown';},
      snapshot:()=>({phase,playback,generation,mode,isolated,everHadVideo})
    };
  }
  globalThis.KickRefinedPlayerState=Object.freeze({create});
})();
