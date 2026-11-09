/* Opt-in, bounded local diagnostics. No network, URLs, chat or account data. */
(() => {
  if (globalThis.KickRefinedPerf) return;
  let enabled = false, observer = null, startedAt = null;
  const counters = new Map(), timings = new Map();
  const allowed = name => typeof name === 'string' && /^[a-zA-Z][a-zA-Z0-9.]{0,63}$/.test(name);
  function count(name, amount = 1) {
    if (!enabled || !allowed(name) || !Number.isFinite(amount) || counters.size >= 64 && !counters.has(name)) return;
    counters.set(name, (counters.get(name) || 0) + amount);
  }
  function sample(name, duration) {
    if (!enabled || !allowed(name) || !Number.isFinite(duration) || duration < 0 || timings.size >= 32 && !timings.has(name)) return;
    let values = timings.get(name); if (!values) { values = []; timings.set(name, values); }
    if (values.length === 256) values.shift(); values.push(duration);
  }
  function maximum(name, value) {
    if (!enabled || !allowed(name) || !Number.isFinite(value) || counters.size >= 64 && !counters.has(name)) return;
    counters.set(name, Math.max(counters.get(name) || 0, value));
  }
  function configure(value) {
    if (enabled === !!value) return;
    enabled = !!value; observer?.disconnect(); observer = null;
    counters.clear(); timings.clear(); startedAt = enabled ? new Date().toISOString() : null;
    if (enabled && typeof PerformanceObserver !== 'undefined') try {
      observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) { count('page.longTasks'); sample('page.longTaskMs', entry.duration); } });
      observer.observe({type: 'longtask'});
    } catch { observer = null; }
  }
  function snapshot() {
    return {schema: 1, enabled, startedAt, capturedAt: new Date().toISOString(), counters: Object.fromEntries(counters), timings: Object.fromEntries([...timings].map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [name, {samples: sorted.length, p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.floor((sorted.length - 1) * .95)], max: sorted.at(-1)}];
    }))};
  }
  globalThis.KickRefinedPerf = Object.freeze({configure, count, sample, maximum, snapshot, get enabled() { return enabled; }});
})();
