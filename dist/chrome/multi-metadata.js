/* Workspace metadata. The shared channel service owns HTTP requests. */
(() => {
  function create({support, isWanted, onChannel, onPanels}) {
    const channels = new Map();
    const panels = new Map();
    const channelPending = new Set();
    const panelPending = new Set();
    const queue = [];
    let running = 0, scheduled = false;
    let disposed = false;

    function put(cache, slug, value) {
      cache.delete(slug);
      cache.set(slug, value);
      while (cache.size > 60) cache.delete(cache.keys().next().value);
    }

    async function readChannel(slug) {
      try {
        const data = await support.channel(slug);
        if (disposed || !isWanted(slug)) return;
        put(channels, slug, {data,until:Date.now()+60000});
        onChannel(slug);
      } catch {
        if (!disposed && isWanted(slug)) put(channels, slug, {data:channels.get(slug)?.data||null,until:Date.now()+5000});
      } finally { channelPending.delete(slug); running--; drain(); }
    }
    function drain() {
      while (!disposed && running < 2 && queue.length) {
        const slug = queue.shift();
        if (!isWanted(slug)) { channelPending.delete(slug); continue; }
        running++; void readChannel(slug);
      }
    }
    function requestChannel(slug) {
      if (disposed || channelPending.has(slug) || Date.now() < (channels.get(slug)?.until || 0)) return;
      channelPending.add(slug); queue.push(slug);
      if (!scheduled) { scheduled = true; Promise.resolve().then(() => { scheduled = false; drain(); }); }
    }

    function requestPanels(slug) {
      if (disposed || panelPending.has(slug) || Date.now() < (panels.get(slug)?.until || 0)) return;
      panelPending.add(slug);
      Promise.resolve().then(() => {
        if (disposed) return [];
        return support.panels(slug);
      }).then(items => {
        if (!disposed) put(panels, slug, {items, error: false,until:Date.now()+120000});
      }).catch(() => {
        if (!disposed) put(panels, slug, {items:panels.get(slug)?.items||[],error:true,until:Date.now()+5000});
      }).finally(() => {
        panelPending.delete(slug);
        if (!disposed) onPanels(slug);
      });
    }

    return {
      channel: slug => channels.get(slug)?.data,
      panels: slug => panels.get(slug)?.items,
      requestChannel,
      requestPanels,
      destroy() {
        disposed = true;
        queue.length = 0;
        channels.clear();
        panels.clear();
        channelPending.clear();
        panelPending.clear();
      }
    };
  }
  globalThis.KickRefinedMultiMetadata = Object.freeze({create});
})();
