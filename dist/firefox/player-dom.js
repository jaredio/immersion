/* One structural observer shared by isolation and playback in each player frame. */
(() => {
  if(globalThis.KickRefinedPlayerDOM)return;
  const listeners=new Set();
  let observer=null;
  function dispatch(records){
    const changes=records.filter(record=>{
      const target=record.target?.nodeType===3?record.target.parentElement:record.target;
      if(target?.closest?.('#chatroom-messages,[data-kr-unified-row]'))return false;
      return [...(record.addedNodes||[]),...(record.removedNodes||[])].some(node=>node.nodeType===1&&!node.matches?.('script,style,link,meta,[data-kr-unified-row]'));
    });
    if(changes.length)for(const listener of [...listeners])if(listeners.has(listener))listener(changes);
  }
  globalThis.KickRefinedPlayerDOM=Object.freeze({subscribe(listener){
    if(!listeners.size){observer||=new MutationObserver(dispatch);observer.observe(document,{childList:true,subtree:true});}listeners.add(listener);
    return ()=>{listeners.delete(listener);if(!listeners.size)observer.disconnect();};
  }});
})();
