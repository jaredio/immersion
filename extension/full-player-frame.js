/* Isolate a complete Kick channel player without moving React-owned nodes.
 * This runs only in an explicitly named, same-site Immersion player frame. */
(() => {
  const match=window.name.match(/^kick-refined-full:([a-z0-9_]{1,40})$/);
  if(window===window.top||!match||!['kick.com','www.kick.com'].includes(location.hostname)||location.pathname.replace(/\/$/,'').toLowerCase()!==`/${match[1]}`)return;
  const portal='[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],[data-radix-portal],[data-floating-ui-portal]';
  const style=document.createElement('style');style.dataset.krFullFrameStyle='';
  style.textContent=`
    html[data-kr-full-player],html[data-kr-full-player] body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#09090b!important}
    html[data-kr-full-player] [data-kr-full-hidden]{display:none!important}
    html[data-kr-full-player] [data-kr-full-shell]{position:static!important;transform:none!important;contain:none!important;overflow:visible!important;min-width:0!important;min-height:0!important;max-height:none!important}
    html[data-kr-full-player] [data-kr-full-player-root]{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;aspect-ratio:auto!important;overflow:clip!important;z-index:1!important}
    html[data-kr-full-player] [data-kr-full-video-shell]{width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important}
    html[data-kr-full-player] [data-kr-full-player-root] video{width:100%!important;height:100%!important;object-fit:contain!important}
  `;
  let timer=0,current=null;
  const hidden=new Set(),shells=new Set(),videoShells=new Set();
  function mark(node,key,set){if(!node.hasAttribute(key))node.setAttribute(key,'');set.add(node);}
  function scan(){
    timer=0;
    if(!document.documentElement)return;
    const anchor=[...document.querySelectorAll('#injected-channel-player,#video-player,main video')].find(node=>node.closest('main')&&!node.closest('#clip-creator-dialog,[role="dialog"]'));
    if(!anchor)return;
    if(!anchor.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true}))){timer=setTimeout(scan,100);return;}
    if(!document.documentElement.hasAttribute('data-kr-full-player'))document.documentElement.setAttribute('data-kr-full-player','');
    if(!style.isConnected)(document.head||document.documentElement).append(style);
    const main=anchor.closest('main');let root=anchor;
    while(root.parentElement&&root.parentElement!==main)root=root.parentElement;
    if(root===main||root===document.body)return;
    const nextHidden=new Set(),nextShells=new Set(),nextVideoShells=new Set();
    for(let branch=root;branch.parentElement&&branch!==document.body;branch=branch.parentElement){
      const parent=branch.parentElement;
      if(parent!==document.documentElement&&parent!==document.body)mark(parent,'data-kr-full-shell',nextShells);
      for(const sibling of parent.children){
        if(sibling===branch||sibling.matches('script,style,link,meta')||sibling.matches(portal)||sibling.querySelector(portal))continue;
        mark(sibling,'data-kr-full-hidden',nextHidden);
      }
    }
    for(const video of root.querySelectorAll('video'))if(!video.closest('#clip-creator-dialog,[role="dialog"]'))for(let node=video.parentElement;node&&node!==root;node=node.parentElement)mark(node,'data-kr-full-video-shell',nextVideoShells);
    for(const [previous,next,key]of [[hidden,nextHidden,'data-kr-full-hidden'],[shells,nextShells,'data-kr-full-shell'],[videoShells,nextVideoShells,'data-kr-full-video-shell']]){
      for(const node of previous)if(!next.has(node))node.removeAttribute(key);
      previous.clear();for(const node of next)previous.add(node);
    }
    if(current!==root){current?.removeAttribute('data-kr-full-player-root');current=root;}
    if(!root.hasAttribute('data-kr-full-player-root'))root.setAttribute('data-kr-full-player-root','');
  }
  let unsubscribe=()=>{};
  function changed(records){
    if(!records.some(record=>{
      const target=record.target.nodeType===1?record.target:record.target.parentElement;
      const nodes=[...record.addedNodes,...record.removedNodes].filter(node=>node.nodeType===1);
      if(current?.isConnected&&current.contains(target))return nodes.some(node=>node.matches('video')||node.querySelector('video'));
      if(current?.isConnected&&target?.closest?.('[data-kr-full-hidden]'))return nodes.some(node=>node.matches(portal)||node.querySelector(portal));
      return nodes.length>0;
    }))return;
    if(!timer)timer=setTimeout(scan,40);
  }
  function init(){scan();unsubscribe=KickRefinedPlayerDOM.subscribe(changed);}
  if(document.documentElement)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
  window.addEventListener('pagehide',event=>{if(!event.persisted){unsubscribe();clearTimeout(timer);}});
})();
