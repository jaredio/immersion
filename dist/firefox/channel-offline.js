/* Reversible offline surfaces. Kick keeps its banner, controls and category links. */
(() => {
  const categorySelector='[data-testid="category-card-root"]';
  const text=node=>node?.textContent.replace(/\s+/g,' ').trim().toLowerCase()||'';
  function banner(main,slug,title,header,confirmedOffline){
    const labels=new Set([`${slug} is offline`,`${title.toLowerCase()} is offline`]);
    for(const label of main.querySelectorAll('p,h1,h2,h3,[data-testid*="offline"]')){
      if(!labels.has(text(label))||label.closest('aside,#channel-chatroom,[data-index]'))continue;
      const copy=label.parentElement;
      for(let node=copy?.parentElement;node&&node!==main&&!node.contains(header);node=node.parentElement){
        if(node.querySelector(categorySelector))break;
        if(node.querySelector('img[src*="/default-channel-banners/"]')||node.matches('[data-testid*="offline-banner"]'))return {node,copy,label};
      }
    }
    // Kick's compact mobile banner has no status text, only a decorative strip.
    if(confirmedOffline)for(const image of main.querySelectorAll('img[src*="/default-channel-banners/"]')){
      for(let node=image.parentElement;node&&node!==main&&!node.contains(header);node=node.parentElement){
        if(node.querySelector(categorySelector))break;
        const height=parseFloat(node.style.height);
        if(node.classList.contains('relative')&&height>0&&height<=80)return {node,compact:true};
      }
    }
    return null;
  }
  function create(){
    const saved=new Map();
    function restore(node,name,value){if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);}
    function reconcile(wanted){
      for(const [node,attributes]of saved){
        for(const [name,value]of attributes)if(!wanted.get(node)?.has(name)){restore(node,name,value);attributes.delete(name);}
        if(!attributes.size)saved.delete(node);
      }
      for(const [node,attributes]of wanted){
        if(!saved.has(node))saved.set(node,new Map());
        for(const [name,value]of attributes){if(!saved.get(node).has(name))saved.get(node).set(name,node.getAttribute(name));if(node.getAttribute(name)!==value)node.setAttribute(name,value);}
      }
    }
    function clear(){reconcile(new Map());}
    function refresh({main,slug,title=slug,header,live,nativeLive}={}){
      if(!main||!slug||nativeLive==='live'){clear();return false;}
      const found=banner(main,slug,title,header,live==='offline');
      if(!found&&live!=='offline'){clear();return false;}
      const wanted=new Map();
      const mark=(node,name,value='')=>{if(!node)return;if(!wanted.has(node))wanted.set(node,new Map());wanted.get(node).set(name,value);};
      mark(main,'data-kr-channel-offline');
      if(found){
        mark(found.node,'data-kr-offline-banner');mark(found.copy,'data-kr-offline-copy');mark(found.label,'data-kr-offline-title');
        if(found.compact)mark(found.node,'data-kr-offline-compact');
        for(const child of found.copy?.children||[])if(text(child)==='offline')mark(child,'data-kr-offline-status');
        for(const child of found.node.children)if(!child.contains(found.copy)&&child.querySelector('img[src*="/default-channel-banners/"]')&&!child.querySelector('button,video,iframe'))mark(child,'data-kr-offline-art');
      }
      for(const heading of main.querySelectorAll('h2,h3')){
        if(!/^recently streamed categories$/i.test(text(heading)))continue;
        let section=heading.parentElement;
        while(section&&section!==main&&!section.querySelector(categorySelector))section=section.parentElement;
        if(!section||section===main||section.contains(header))continue;
        mark(section,'data-kr-offline-categories');mark(heading,'data-kr-offline-section-title');
        for(const card of section.querySelectorAll(categorySelector)){
          mark(card,'data-kr-discovery-category');mark(card.parentElement,'data-kr-discovery-grid','categories');mark(card.parentElement,'data-kr-offline-grid');
          const dot=card.querySelector('[data-testid="live-status-dot"]');
          if(dot?.parentElement.querySelector('span[title]'))mark(dot.parentElement,'data-kr-offline-viewers');
        }
      }
      reconcile(wanted);return true;
    }
    return {refresh,clear,destroy:clear};
  }
  globalThis.KickRefinedOffline=Object.freeze({create});
})();
