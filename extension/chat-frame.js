/* Preference/theme sync for native popout chat. No toolbar or multiview recursion. */
(() => {
  const { api, normalize } = KickRefined;
  let current,disposed=false;
  let clips;
  const xPosts=KickRefinedX.create({enabled:false});
  const mediaCards=KickRefinedMedia.create({media:false,profiles:false});
  const replyPreviews=KickRefinedReplies.create({enabled:false});
  const bridge=KickRefinedClipBridge.create({getClips:()=>clips});
  clips=KickRefinedClips.create({enabled:false,onWorkspace:bridge.available?item=>bridge.add(item):null,onWorkspaceDrag:bridge.available?(event,item)=>bridge.drag(event,item):null});
  function apply(input) {
    if(disposed)return;
    const s = normalize(input), root = document.documentElement; current = s;
    if (!root) return;
    clips.setEnabled(s.enabled&&s.chatClips&&!s.textOnly);
    xPosts.setEnabled(s.enabled&&s.xEmbeds&&!s.textOnly);
    mediaCards.setOptions({media:s.enabled&&s.mediaEmbeds&&!s.textOnly,profiles:s.enabled&&s.xEmbeds&&!s.textOnly});
    replyPreviews.setEnabled(s.enabled);
    root.dataset.krEnabled = String(s.enabled); root.dataset.krPerformance = String(s.performance);
    root.dataset.krTextOnly = String(s.textOnly); root.dataset.krAccent = s.accent;
    root.dataset.krChatFrame = String(window !== window.top);
    root.style.setProperty('--kr-font-size', `${s.fontSize}px`);
  }
  api.storage.local.get('settings').then(data => apply(data.settings)).catch(() => apply());
  const onSettingsChanged=(changes,area)=>{if(area==='local'&&changes.settings)apply(changes.settings.newValue);};
  api.storage.onChanged.addListener(onSettingsChanged);
  const observer = new MutationObserver(() => { if (current && document.documentElement.dataset.krEnabled !== String(current.enabled)) apply(current); });
  if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kr-enabled'] });
  window.addEventListener('pagehide',event=>{if(!event.persisted&&!disposed){disposed=true;api.storage.onChanged.removeListener?.(onSettingsChanged);bridge.destroy();clips.destroy();xPosts.destroy();mediaCards.destroy();replyPreviews.destroy();observer.disconnect();}});
})();
