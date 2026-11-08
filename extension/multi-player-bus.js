/* Frame transport. Validate source, origin, session and revision before dispatch. */
(() => {
  function create({isActive, onReady, onAudioIntent, onFocus, onHover, onStatus}) {
    const session = crypto.randomUUID();
    const sources = new Map();
    let revision = 0;
    let disposed = false;

    function onMessage(event) {
      if (disposed || !isActive()) return;
      const tile = sources.get(event.source);
      if (!tile || tile.frame?.contentWindow !== event.source || event.origin !== tile.frameOrigin) return;
      const data = event.data;
      // Readiness is the only message before the parent has established a session.
      if (data?.type === 'kick-refined:ready') { onReady(tile); return; }
      if (data?.session !== session) return;
      if (data.type === 'kick-refined:hover') { onHover(tile, data.hovered === true); return; }
      if (data.type === 'kick-refined:focus') { onFocus(tile); return; }
      if (data.revision !== tile.commandRevision) return;
      if (data.type === 'kick-refined:audio-intent') {
        if (typeof data.muted === 'boolean' && Number.isFinite(data.volume) && data.volume >= 0 && data.volume <= 1) onAudioIntent(tile, data.muted, data.volume);
      } else if (data.type === 'kick-refined:status') onStatus(tile, data);
    }
    window.addEventListener('message', onMessage);

    return {
      attach(tile) { if (!disposed && tile.frame?.contentWindow) sources.set(tile.frame.contentWindow, tile); },
      detach(tile) { if (tile.frame?.contentWindow) sources.delete(tile.frame.contentWindow); },
      nextRevision() { return ++revision; },
      send(tile, data) {
        if (disposed) return;
        tile.frame?.contentWindow?.postMessage({type: 'kick-refined:control', session, revision: tile.commandRevision, ...data}, tile.frameOrigin || 'https://player.kick.com');
      },
      destroy() {
        disposed = true;
        sources.clear();
        window.removeEventListener('message', onMessage);
      }
    };
  }
  globalThis.KickRefinedMultiPlayerBus = Object.freeze({create});
})();
