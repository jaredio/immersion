/* Isolate a complete Kick channel player without moving React-owned nodes.
 * This runs only in an explicitly named, same-site Immersion player frame. */
(() => {
  const match=window.name.match(/^kick-refined-full:([a-z0-9_]{1,40})$/);
  if(window===window.top||!match||!['kick.com','www.kick.com'].includes(location.hostname)||location.pathname.replace(/\/$/,'').toLowerCase()!==`/${match[1]}`)return;
  const portal='[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-radix-popper-content-wrapper],[data-radix-portal],[data-floating-ui-portal]';
  const player=':is(#injected-channel-player,#video-player,video)';
  const ignored='script,style,link,meta';
  const style=document.createElement('style');
  style.textContent=`
    html[data-kr-full-player],html[data-kr-full-player] body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#09090b!important}
    html[data-kr-full-player] [data-kr-full-hidden]{display:none!important}
    html[data-kr-full-player] [data-kr-full-shell]{position:static!important;transform:none!important;contain:none!important;overflow:visible!important;min-width:0!important;min-height:0!important;max-height:none!important}
    html[data-kr-full-player] [data-kr-full-player-root]{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;aspect-ratio:auto!important;overflow:clip!important;z-index:1!important}
    html[data-kr-full-player] [data-kr-full-video-shell]{width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important}
    html[data-kr-full-player] [data-kr-full-player-root] video{width:100%!important;height:100%!important;object-fit:contain!important}
  `;
  let timer=0,current=null,anchor=null,branches=new Map();
  const hidden=new Set(),videoShells=new Set();
  function mark(node,key,set){if(!node.hasAttribute(key))node.setAttribute(key,'');set.add(node);}
  function matchesWithin(node,selector){return node.nodeType===1&&(node.matches(selector)||node.firstElementChild&&node.querySelector(selector));}
  function reconcile(previous,next,key){
    for(const node of previous)if(!next.has(node))node.removeAttribute(key);
    previous.clear();for(const node of next)previous.add(node);
  }
  function hideSibling(node){
    if(!node.matches(ignored)&&!matchesWithin(node,portal))mark(node,'data-kr-full-hidden',hidden);
    else if(hidden.delete(node))node.removeAttribute('data-kr-full-hidden');
  }
  function syncVideoShells(){
    const next=new Set();
    for(const video of current?.querySelectorAll('video')||[]){
      if(video.closest('#clip-creator-dialog,[role="dialog"]'))continue;
      for(let node=video.parentElement;node&&node!==current;node=node.parentElement)mark(node,'data-kr-full-video-shell',next);
    }
    reconcile(videoShells,next,'data-kr-full-video-shell');
  }
  function syncBranches(next){
    for(const parent of branches.keys())if(!next.has(parent))parent.removeAttribute('data-kr-full-shell');
    branches=next;
    for(const [parent,branch] of branches){
      if(parent!==document.documentElement&&parent!==document.body&&!parent.hasAttribute('data-kr-full-shell'))parent.setAttribute('data-kr-full-shell','');
      for(const sibling of parent.children)if(sibling!==branch)hideSibling(sibling);
    }
    for(const node of hidden)if(!branches.has(node.parentElement)||branches.get(node.parentElement)===node){
      node.removeAttribute('data-kr-full-hidden');hidden.delete(node);
    }
  }
  function scan(){
    timer=0;
    if(!document.documentElement)return;
    const candidate=[...document.querySelectorAll('#injected-channel-player,#video-player,main video')].find(node=>node.closest('main')&&!node.closest('#clip-creator-dialog,[role="dialog"]'));
    if(!candidate){
      current?.removeAttribute('data-kr-full-player-root');current=anchor=null;
      syncBranches(new Map());syncVideoShells();
      return;
    }
    if(!candidate.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true}))){timer=setTimeout(scan,100);return;}
    if(!document.documentElement.hasAttribute('data-kr-full-player'))document.documentElement.setAttribute('data-kr-full-player','');
    if(!style.isConnected)(document.head||document.documentElement).append(style);
    const main=candidate.closest('main');let root=candidate;
    while(root.parentElement&&root.parentElement!==main)root=root.parentElement;
    if(root===main||root===document.body)return;
    const next=new Map();
    for(let branch=root;branch.parentElement&&branch!==document.body;branch=branch.parentElement)next.set(branch.parentElement,branch);
    if(current!==root){current?.removeAttribute('data-kr-full-player-root');current=root;}
    anchor=candidate;
    syncBranches(next);syncVideoShells();
    if(!root.hasAttribute('data-kr-full-player-root'))root.setAttribute('data-kr-full-player-root','');
  }
  let unsubscribe=()=>{};
  function changed(records){
    let rescan=false,videoChanged=false;
    const siblings=new Set();
    for(const record of records){
      if(record.type==='attributes')continue;
      const target=record.target.nodeType===1?record.target:record.target.parentElement;
      if(!current?.isConnected||!anchor?.isConnected||!style.isConnected){rescan=true;break;}
      if(branches.has(target)){
        const branch=branches.get(target);
        if(branch.parentElement!==target||[...record.removedNodes].includes(branch)){rescan=true;break;}
        for(const node of record.removedNodes)if(hidden.delete(node))node.removeAttribute('data-kr-full-hidden');
        for(const node of record.addedNodes){
          if(node.nodeType!==1||node.parentElement!==target||node===branch)continue;
          if(matchesWithin(node,'main')||node.closest('main')&&matchesWithin(node,player))rescan=true;
          siblings.add(node);
        }
        continue;
      }
      if(current.contains(target)){
        for(const nodes of [record.addedNodes,record.removedNodes])for(const node of nodes){
          if(matchesWithin(node,'#injected-channel-player,#video-player'))rescan=true;
          if(matchesWithin(node,'video'))videoChanged=true;
        }
        continue;
      }
      for(let node=target;node?.parentElement;node=node.parentElement){
        if(!branches.has(node.parentElement))continue;
        if([...record.addedNodes,...record.removedNodes].some(child=>matchesWithin(child,portal)))siblings.add(node);
        if([...record.addedNodes].some(child=>matchesWithin(child,'main')||node.closest('main')&&matchesWithin(child,player)))rescan=true;
        break;
      }
    }
    if(rescan){if(!timer)timer=setTimeout(scan,40);return;}
    for(const node of siblings)if(branches.has(node.parentElement)&&branches.get(node.parentElement)!==node)hideSibling(node);
    if(videoChanged)syncVideoShells();
  }
  function init(){scan();unsubscribe=KickRefinedPlayerDOM.subscribe(changed);}
  if(document.documentElement)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
  window.addEventListener('pagehide',event=>{if(!event.persisted){unsubscribe();clearTimeout(timer);}});
})();
