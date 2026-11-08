/* Workspace metadata. The shared channel service owns HTTP requests. */
(() => {
  function create({support, isWanted, onChannel, onPanels}) {
    const channels = new Map();
    const panels = new Map();
    const channelPending = new Set();
    const panelPending = new Set();
    let queue = Promise.resolve();
    let disposed = false;

    function put(cache, slug, value) {
      cache.delete(slug);
      cache.set(slug, {time: Date.now(), ...value});
      while (cache.size > 60) cache.delete(cache.keys().next().value);
    }

    function requestChannel(slug) {
      if (disposed || channelPending.has(slug) || Date.now() - (channels.get(slug)?.time || 0) < 60000) return;
      channelPending.add(slug);
      queue = queue.then(async () => {
        if (disposed || !isWanted(slug)) return;
        try {
          const data = await support.channel(slug);
          if (disposed) return;
          put(channels, slug, {data});
          onChannel(slug);
        } catch {
          if (!disposed) put(channels, slug, {data: null});
        }
      }).finally(() => channelPending.delete(slug));
    }

    function requestPanels(slug) {
      if (disposed || panelPending.has(slug) || Date.now() - (panels.get(slug)?.time || 0) < 120000) return;
      panelPending.add(slug);
      Promise.resolve().then(() => {
        if (disposed) return [];
        return support.panels(slug);
      }).then(items => {
        if (!disposed) put(panels, slug, {items, error: false});
      }).catch(() => {
        if (!disposed) put(panels, slug, {items: [], error: true});
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
        channels.clear();
        panels.clear();
        channelPending.clear();
        panelPending.clear();
      }
    };
  }
  globalThis.KickRefinedMultiMetadata = Object.freeze({create});
})();
