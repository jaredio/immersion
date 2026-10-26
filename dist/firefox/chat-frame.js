/* Preference/theme sync for native popout chat. No toolbar or multiview recursion. */
(() => {
  const { api, normalize } = KickRefined;
  let current;
  let clips;
  const bridge=KickRefinedClipBridge.create({getClips:()=>clips});
  clips=KickRefinedClips.create({enabled:false,onWorkspace:bridge.available?item=>bridge.add(item):null,onWorkspaceDrag:bridge.available?(event,item)=>bridge.drag(event,item):null});
  function apply(input) {
    const s = normalize(input), root = document.documentElement; current = s;
    if (!root) return;
    clips.setEnabled(s.enabled&&s.chatClips&&!s.textOnly);
    root.dataset.krEnabled = String(s.enabled); root.dataset.krPerformance = String(s.performance);
    root.dataset.krTextOnly = String(s.textOnly); root.dataset.krAccent = s.accent;
    root.style.setProperty('--kr-font-size', `${s.fontSize}px`);
  }
  api.storage.local.get('settings').then(data => apply(data.settings)).catch(() => apply());
  api.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) apply(changes.settings.newValue); });
  const observer = new MutationObserver(() => { if (current && document.documentElement.dataset.krEnabled !== String(current.enabled)) apply(current); });
  if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kr-enabled'] });
  window.addEventListener('pagehide',event=>{if(!event.persisted){bridge.destroy();clips.destroy();observer.disconnect();}},{once:true});
})();
