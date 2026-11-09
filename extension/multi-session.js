/* Normalized workspace storage, with burst coalescing and ordered writes. */
(() => {
  function snapshot(input) {
    const {multiState} = KickRefined;
    return {
      multiVolume: Number.isFinite(input.multiVolume) ? Math.max(0, Math.min(1, input.multiVolume)) : 1,
      multiview: multiState(input.multiview),
      multiToolbarHidden: input.multiToolbarHidden === true,
      multiSessions: Array.isArray(input.multiSessions) ? input.multiSessions
        .filter(session => session && typeof session.name === 'string')
        .slice(0, 10).map(session => ({name: session.name.slice(0, 48), state: multiState(session.state)})) : []
    };
  }

  function create({storage = KickRefined.api.storage.local, onError = () => {}, delay = 100} = {}) {
    let pending = null;
    let timer = 0;
    let writes = Promise.resolve();
    let disposed = false;

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
          const raw = await storage.get(['multiview', 'multiSessions', 'multiToolbarHidden', 'multiVolume']);
          return {...snapshot(raw), savedVolume: Number.isFinite(raw.multiVolume) && raw.multiVolume > 0 && raw.multiVolume <= 1};
        } catch { return {...snapshot({}), savedVolume: false}; }
      },
      save(input) {
        if (disposed) return;
        pending = snapshot(input);
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
      },
      flush,
      destroy() { disposed = true; return flush(); }
    };
  }
  globalThis.KickRefinedMultiSession = Object.freeze({create});
})();
