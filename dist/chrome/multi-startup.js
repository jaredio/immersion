/* Bounded full-player startup. Native playback never enters this queue. */
(() => {
  function create({limit = 2} = {}) {
    const jobs = new Set(); let active = 0, scheduled = false, disposed = false, sequence = 0;
    function schedule() {
      if (scheduled || disposed) return;
      scheduled = true; queueMicrotask(() => {
        scheduled = false;
        while (!disposed && active < limit) {
          const job = [...jobs].filter(item => item.state === 'queued').sort((a, b) => a.priority - b.priority || a.order - b.order)[0];
          if (!job) break;
          job.state = 'running'; active++; job.started = performance.now();
          globalThis.KickRefinedPerf?.count('startup.started');
          globalThis.KickRefinedPerf?.maximum('startup.peakConcurrent', active);
          globalThis.KickRefinedPerf?.sample('startup.queueMs', job.started - job.created);
          job.timer = setTimeout(() => {
            if (!jobs.has(job)) return;
            finish(job, false, true); globalThis.KickRefinedPerf?.count('startup.timeouts');
            try { job.onTimeout?.(job); } catch (error) { queueMicrotask(() => { throw error; }); }
          }, job.timeout);
          try { job.start(job); } catch (error) { finish(job); queueMicrotask(() => { throw error; }); }
        }
      });
    }
    function finish(job, canceled = false, timedOut = false) {
      if (!jobs.delete(job)) return;
      clearTimeout(job.timer);
      if (job.state === 'running') { active--; if (!canceled && !timedOut) globalThis.KickRefinedPerf?.sample('startup.readyMs', performance.now() - job.started); }
      job.state = timedOut ? 'timedout' : canceled ? 'canceled' : 'done'; schedule();
    }
    return {
      enqueue({start, priority = 1, timeout = 20000, onTimeout}) {
        if (disposed) return null;
        const job = {start, priority, timeout, onTimeout, state: 'queued', order: sequence++, created: performance.now()}; jobs.add(job); schedule(); return job;
      },
      prioritize(job) { if (jobs.has(job)) { job.priority = 0; schedule(); } },
      complete: job => finish(job),
      cancel: job => finish(job, true),
      snapshot: () => ({running: active, queued: [...jobs].filter(job => job.state === 'queued').length}),
      destroy() { disposed = true; for (const job of [...jobs]) finish(job, true); }
    };
  }
  globalThis.KickRefinedMultiStartup = Object.freeze({create});
})();
