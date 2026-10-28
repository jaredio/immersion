/* Skin Kick's own subscribe/gift popovers without replacing checkout controls. */
(() => {
  function create({enabled=true}={}){
    const marked=new Set(),inline=new Map();let disposed=false,frame=0;
    function mark(node,name,value=''){if(node.getAttribute(name)!==value)node.setAttribute(name,value);marked.add(node);}
    // Kick's layered !important utilities outrank unlayered stylesheets.
    function paint(node,name,value){if(!inline.has(node))inline.set(node,new Map());const values=inline.get(node);if(!values.has(name))values.set(name,{value:node.style.getPropertyValue(name),priority:node.style.getPropertyPriority(name)});const state=values.get(name);if(node.style.getPropertyValue(name)!==state.applied||state.desired!==value||node.style.getPropertyPriority(name)!=='important'){node.style.setProperty(name,value,'important');state.applied=node.style.getPropertyValue(name);state.desired=value;}}
    function release(node){for(const name of ['data-kr-checkout','data-kr-checkout-heading','data-kr-checkout-header','data-kr-checkout-close','data-kr-checkout-primary'])node.removeAttribute(name);for(const [name,value]of inline.get(node)||[]){if(node.style.getPropertyValue(name)!==value.applied||node.style.getPropertyPriority(name)!=='important')continue;if(value.value)node.style.setProperty(name,value.value,value.priority);else node.style.removeProperty(name);}inline.delete(node);}
    function refresh(){
      frame=0;if(disposed||!enabled)return;
      for(const node of [...marked])if(!node.isConnected){release(node);marked.delete(node);}
      for(const dialog of document.querySelectorAll('[role="dialog"]')){
        if(dialog.closest('#user-identity,#onetrust-consent-sdk,#onetrust-pc-sdk'))continue;
        const heading=dialog.querySelector('h1,h2,h3,[role="heading"]')||dialog.firstElementChild?.querySelector('p');
        const text=heading?.textContent?.trim()||dialog.getAttribute('aria-label')||'';
        const kind=/^gift(?:ing)?\b.*\bsub(?:s|scription|scriptions)?\b/i.test(text)?'gift':/^(?:subscribe|subscription|your subscription|manage subscription)\b/i.test(text)?'subscribe':dialog.getAttribute('data-kr-checkout');
        if(!kind)continue;mark(dialog,'data-kr-checkout',kind);if(heading)mark(heading,'data-kr-checkout-heading');
        const header=heading?.parentElement;if(header&&header!==dialog&&header.querySelector('button'))mark(header,'data-kr-checkout-header');
        for(const button of dialog.querySelectorAll('button')){
          const label=button.getAttribute('aria-label')||button.textContent.trim();
          if(/^close\b/i.test(label))mark(button,'data-kr-checkout-close');
          else if(!button.closest('[role="tablist"],[role="radiogroup"]')&&!button.hasAttribute('aria-pressed')&&/^(?:subscribe|continue|checkout|pay\b|gift\s+(?:\d+|a\s+sub|subs|subscription))/i.test(label)){mark(button,'data-kr-checkout-primary');paint(button,'background','var(--kr-accent)');paint(button,'color','#14200f');paint(button,'padding','9px 12px');paint(button,'font-size','13px');}
        }
      }
    }
    function schedule(){if(enabled&&!disposed&&!frame)frame=requestAnimationFrame(refresh);}
    const observer=new MutationObserver(records=>{for(const record of records){if(record.target.nodeType===1&&record.target.closest('[role="dialog"]')){schedule();return;}for(const node of record.addedNodes)if(node.nodeType===1&&(node.matches('[role="dialog"]')||node.querySelector('[role="dialog"]'))){schedule();return;}}});
    function clear(){cancelAnimationFrame(frame);frame=0;for(const node of marked)release(node);marked.clear();}
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['role','aria-label','data-state']});refresh();
    return {refresh,setEnabled(value){enabled=!!value;if(enabled)refresh();else clear();},destroy(){disposed=true;observer.disconnect();clear();}};
  }
  globalThis.KickRefinedCheckouts=Object.freeze({create});
})();
