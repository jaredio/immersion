/* Restyle native live alerts without replacing their links or dismiss handlers. */
(() => {
  function create({enabled=true}={}){
    const records=new Map(),dirty=new Set();let timer=0,disposed=false;
    const selector='.max-w-xvw:has(> a[title="Watch now"])';
    function restore(record){
      if(record.label.textContent==='Watch')record.label.textContent='Watch now';
      for(const node of [record.root,record.info,record.watch,record.actions,record.title,record.description,record.close])if(node)for(const key of ['krLiveNotice','krNoticeInfo','krNoticeWatch','krNoticeActions','krNoticeTitle','krNoticeDescription','krNoticeClose'])delete node.dataset[key];
      if(record.close&&record.closeLabel===null)record.close.removeAttribute('aria-label');
    }
    function enhance(root){
      const info=root.querySelector(':scope > a[title="Watch now"]'),actions=root.querySelector(':scope > div');
      const watch=actions&&[...actions.querySelectorAll('a')].find(link=>[...link.children].some(child=>child.tagName==='SPAN'&&['Watch now','Watch'].includes(child.textContent.trim())));
      const label=watch&&[...watch.children].find(child=>child.tagName==='SPAN'&&['Watch now','Watch'].includes(child.textContent.trim()));
      if(!info||!watch||!label)return;
      const prior=records.get(root);if(prior&&prior.label!==label)restore(prior);
      const words=info.querySelector(':scope > div'),title=words?.firstElementChild,description=words?.lastElementChild,close=actions.querySelector('button');
      const record=prior?.label===label?prior:{root,info,watch,label,actions,title,description,close,closeLabel:close?.getAttribute('aria-label')??null};records.set(root,record);
      root.dataset.krLiveNotice='';info.dataset.krNoticeInfo='';watch.dataset.krNoticeWatch='';actions.dataset.krNoticeActions='';
      if(title)title.dataset.krNoticeTitle='';if(description&&description!==title)description.dataset.krNoticeDescription='';
      if(close){close.dataset.krNoticeClose='';if(!close.hasAttribute('aria-label'))close.setAttribute('aria-label','Dismiss notification');}
      if(label.textContent!=='Watch')label.textContent='Watch';
    }
    function flush(){
      timer=0;if(!enabled||disposed)return;
      for(const [root]of records)if(!root.isConnected)records.delete(root);
      for(const node of dirty){if(!node.isConnected)continue;const own=node.closest?.(selector);if(own)enhance(own);if(node.matches?.(selector))enhance(node);for(const root of node.querySelectorAll?.(selector)||[])enhance(root);}
      dirty.clear();
    }
    const observer=new MutationObserver(changes=>{
      if(!enabled)return;
      for(const change of changes){
        const parent=change.target.nodeType===1?change.target:change.target.parentElement;
        if(parent?.closest('#chatroom-messages,#kr-root,#kr-multi-root'))continue;
        if(parent?.closest('[data-kr-live-notice]'))dirty.add(parent);
        for(const node of change.addedNodes)if(node.nodeType===1)dirty.add(node);
      }
      if(dirty.size&&!timer)timer=setTimeout(flush,30);
    });
    function setEnabled(value){
      enabled=value;observer.disconnect();clearTimeout(timer);timer=0;dirty.clear();
      if(!enabled){for(const record of records.values())restore(record);records.clear();return;}
      for(const root of document.querySelectorAll(selector))enhance(root);
      observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    }
    setEnabled(enabled);
    return {setEnabled,destroy(){setEnabled(false);disposed=true;}};
  }
  globalThis.KickRefinedNotices=Object.freeze({create});
})();
