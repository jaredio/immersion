/* MAIN world: use the same clip-creation event as Kick's player button.
 * No requests, publishing, React traversal, or player state changes. */
(() => {
  if(window===window.top||!/^kick-refined-clip:[a-z0-9_]{1,40}$/.test(window.name))return;
  document.addEventListener('immersion:clip-native-request',event=>{
    const node=event.target;if(!(node instanceof HTMLElement)||node.id!=='kr-clip-native-request')return;
    const slug=window.name.split(':')[1];
    if(node.dataset.mode==='live'){
      if(location.pathname.replace(/\/$/,'').toLowerCase()!==`/${slug}`||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(node.dataset.videoId||''))return;
      const main=document.querySelector('main');if(!main||!main.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true})))return;
      const detail={mode:'livestream',channelSlug:slug,webVideoId:node.dataset.videoId};
      // Wait for passive effects from the hydration commit, not IVS/player UI.
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('openClipCreator',{detail}))));
      event.preventDefault();return;
    }
    const match=location.pathname.match(/^\/([a-z0-9_]{1,40})\/videos\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i);
    const start=Number(node.dataset.start);
    if(!match||match[1]!==window.name.split(':')[1]||!Number.isFinite(start)||start<0||start>14*86400)return;
    // Kick's VOD provider takes a position 150s into the requested source window.
    window.dispatchEvent(new CustomEvent('openClipCreator',{detail:{mode:'vod',startTime:start+150}}));
    event.preventDefault();
  },true);
})();
