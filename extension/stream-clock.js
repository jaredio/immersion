/* Broadcast uptime is wall time since Kick's start timestamp, never video time. */
(() => {
  const valid = value => Number.isFinite(value) && value > 0 && value <= Date.now() + 60000 ? value : null;
  function parse(value) {
    if (typeof value !== 'string') return null;
    let text = value.trim();
    if (!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)?$/.test(text)) return null;
    if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(text)) text = text.replace(' ', 'T') + 'Z';
    return valid(Date.parse(text));
  }
  function format(startedAt, now = Date.now()) {
    if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now + 60000) return '';
    const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  globalThis.KickRefinedStreamClock = Object.freeze({parse, valid, format});
})();
