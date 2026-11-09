/* Apply saved theme preferences before the heavier DOM enhancements initialize. */
(() => {
  if(window!==window.top&&window.name!=='kick-refined-chat'&&!/^\/popout\/[^/]+\/chat\/?$/.test(location.pathname))return;
  const api=globalThis.browser||globalThis.chrome;if(!api?.storage?.local)return;
  const pending=Promise.resolve().then(()=>api.storage.local.get('settings')).catch(()=>({}));
  globalThis.KickRefinedThemeSettings=pending;
  const rootReady=document.documentElement?Promise.resolve(document.documentElement):new Promise(resolve=>{
    const observer=new MutationObserver(()=>{if(document.documentElement){observer.disconnect();resolve(document.documentElement);}});
    observer.observe(document,{childList:true});
  });
  Promise.all([pending,rootReady]).then(([saved,root])=>{
    const settings=saved?.settings||{};
    for(const [key,attribute,fallback]of [['enabled','krEnabled',true],['performance','krPerformance',true],['compact','krCompact',false],['hideRecommended','krHideRecommended',false],['textOnly','krTextOnly',false]])root.dataset[attribute]=String(typeof settings[key]==='boolean'?settings[key]:fallback);
    root.dataset.krAccent=['mint','violet','blue','neutral'].includes(settings.accent)?settings.accent:'mint';
    for(const [key,property,min,max,fallback]of [['chatWidth','--kr-chat-width',280,440,340],['fontSize','--kr-font-size',12,18,14]])root.style.setProperty(property,`${Number.isFinite(settings[key])?Math.min(max,Math.max(min,Math.round(settings[key]))):fallback}px`);
  });
})();
