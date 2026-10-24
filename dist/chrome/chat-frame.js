/* Preference/theme sync for native popout chat. No toolbar or multiview recursion. */
(() => {
  const { api, normalize } = KickRefined;
  let current;
  function apply(input) {
    const s = normalize(input), root = document.documentElement; current = s;
    if (!root) return;
    root.dataset.krEnabled = String(s.enabled); root.dataset.krPerformance = String(s.performance);
    root.dataset.krTextOnly = String(s.textOnly); root.dataset.krAccent = s.accent;
    root.style.setProperty('--kr-font-size', `${s.fontSize}px`);
  }
  api.storage.local.get('settings').then(data => apply(data.settings)).catch(() => apply());
  api.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) apply(changes.settings.newValue); });
  const observer = new MutationObserver(() => { if (current && document.documentElement.dataset.krEnabled !== String(current.enabled)) apply(current); });
  if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kr-enabled'] });
})();
