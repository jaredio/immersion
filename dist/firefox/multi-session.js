/* Normalized workspace storage, with burst coalescing and ordered writes. */
(() => {
  function snapshot(input) {
    const {multiState} = KickRefined;
    return {
      multiVolume: Number.isFinite(input.multiVolume) ? Math.max(0, Math.min(1, input.multiVolume)) : 1,
      multiview: multiState(input.multiview),
      multiToolbarHidden: input.multiToolbarHidden === true,
      multiSessions: KickRefinedSessionData.normalize(input.multiSessions)
    };
  }

  function create({storage = KickRefined.api.storage.local, onError = () => {}, onSessions=()=>{}, repository=null, delay = 100} = {}) {
    let pending = null;
    let timer = 0;
    let writes = Promise.resolve();
    let disposed = false;
    let sessionVersion=0,latestSessions=[];
    const api=KickRefined.api;
    const local=repository||(!api?.runtime?.sendMessage?KickRefinedSessionData.createRepository(storage):null);
    function changed(changes,area){if(!disposed&&area==='local'&&changes.multiSessions){sessionVersion++;latestSessions=KickRefinedSessionData.normalize(changes.multiSessions.newValue);onSessions(latestSessions);}}
    api?.storage?.onChanged?.addListener(changed);
    async function mutate(operation){
      if(disposed)throw Error('Session store closed');
      const version=sessionVersion;
      if(local){const sessions=await local.mutate(operation);return version===sessionVersion?sessions:latestSessions;}
      const result=await api.runtime.sendMessage({type:'immersion:session-mutation',operation});
      if(!result?.ok)throw Error('Could not save sessions');
      return version===sessionVersion?KickRefinedSessionData.normalize(result.sessions):latestSessions;
    }

    function flush() {
      clearTimeout(timer);
      timer = 0;
      if (!pending) return writes;
      const next = pending;
      pending = null;
      writes = writes.then(() => {globalThis.KickRefinedPerf?.count('storage.writes');return storage.set(next);}).catch(onError);
      return writes;
    }

    return {
      async load() {
        try {
          const version=sessionVersion;
          const raw = await storage.get(['multiview', 'multiSessions', 'multiToolbarHidden', 'multiVolume']);
          return {...snapshot(raw),multiSessions:version===sessionVersion?KickRefinedSessionData.normalize(raw.multiSessions):latestSessions, savedVolume: Number.isFinite(raw.multiVolume) && raw.multiVolume > 0 && raw.multiVolume <= 1};
        } catch { return {...snapshot({}), savedVolume: false}; }
      },
      save(input) {
        if (disposed) return;
        pending = snapshot(input);delete pending.multiSessions;
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
      },
      flush,
      upsertSession:session=>mutate({action:'upsert',session}),
      deleteSession:id=>mutate({action:'delete',id}),
      destroy() { disposed = true;api?.storage?.onChanged?.removeListener?.(changed); return flush(); }
    };
  }
  globalThis.KickRefinedMultiSession = Object.freeze({create});
})();
