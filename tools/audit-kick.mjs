// Anonymous, extension-free baseline. Store aggregate counts, never cookies,
// headers, request bodies, query strings, or a user's browsing session.
import playwright from './playwright.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await playwright.chromium.launch({ headless: true });
const report = { capturedAt: new Date().toISOString(), url: 'https://kick.com/', mode: 'anonymous headless Chromium; no extension; one cold page load', observationMs: 8000, navigationError: null, hosts: {}, failedRequests: {}, metrics: {} };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  await page.addInitScript(() => {
    window.auditLongTasks = { count: 0, duration: 0 };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { window.auditLongTasks.count++; window.auditLongTasks.duration += entry.duration; }
    }).observe({ type: 'longtask', buffered: true });
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const host = report.hosts[url.hostname] ||= { requests: 0, types: {} };
    host.requests++;
    host.types[request.resourceType()] = (host.types[request.resourceType()] || 0) + 1;
  });
  page.on('requestfailed', request => {
    const name = request.failure()?.errorText || 'unknown';
    report.failedRequests[name] = (report.failedRequests[name] || 0) + 1;
  });
  try {
    const response = await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    report.httpStatus = response?.status();
    await page.waitForTimeout(report.observationMs);
    report.page = await page.evaluate(() => ({
      title: document.title, domElements: document.getElementsByTagName('*').length,
      videos: document.querySelectorAll('video').length,
      longTasks: window.auditLongTasks,
      resources: performance.getEntriesByType('resource').length,
      transferredBytesVisibleToResourceTiming: performance.getEntriesByType('resource').reduce((total, entry) => total + entry.transferSize, 0)
    }));
    const { metrics } = await session.send('Performance.getMetrics');
    const names = new Set(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize', 'Nodes', 'LayoutCount', 'RecalcStyleCount']);
    report.metrics = Object.fromEntries(metrics.filter(entry => names.has(entry.name)).map(entry => [entry.name, entry.value]));
  } catch (error) {
    report.navigationError = error.name; // Error messages may contain full URLs.
  }
} finally {
  await browser.close();
}
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/kick-performance-audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
