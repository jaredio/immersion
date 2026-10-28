/* Read the quote from Kick's reply line; never wait for its delayed tooltip. */
(() => {
  function authorFrom(trigger){
    const name=trigger?.querySelector(':scope > span > span:not(.inline)')?.textContent.trim();
    if(name&&/^[a-zA-Z0-9_]{1,40}$/.test(name))return name;
    return trigger?.textContent.match(/Replying to\s+@?([a-zA-Z0-9_]{1,40})(?=\s*:|\s|$)/i)?.[1]||'';
  }
  function create({enabled=true}={}){
    let current=null,host=null,body=null,openTimer=0,closeTimer=0,disposed=false;
    const abort=new AbortController();
    const css=`:host{all:initial;display:block;position:fixed;z-index:2147483644;width:max-content;max-width:340px;color:#e8e8f0;font:13px/1.55 system-ui,sans-serif;color-scheme:dark}*{box-sizing:border-box}.preview{padding:10px 12px;background:#15151b;border:1px solid #ffffff1c;border-radius:10px;box-shadow:0 6px 22px #0005;text-align:left}header{display:flex;align-items:baseline;gap:7px;margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid #ffffff0d}header span{color:#9999aa;font-size:10px;white-space:nowrap}strong{color:var(--kr-accent,#b0ff8c);font-size:12px;font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;overscroll-behavior:contain;user-select:text}.message img{display:inline-block;max-width:28px;max-height:28px;vertical-align:middle;object-fit:contain}.empty{color:#9999aa;font-size:12px}`;
    function stopClose(){clearTimeout(closeTimer);closeTimer=0;}
    function clear(){
      clearTimeout(openTimer);openTimer=0;stopClose();observer.disconnect();
      if(current&&host){const ids=(current.trigger.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==host.id);if(ids.length)current.trigger.setAttribute('aria-describedby',ids.join(' '));else current.trigger.removeAttribute('aria-describedby');}
      host?.remove();host=null;body=null;current=null;
    }
    function closeSoon(){if(!host){clear();return;}if(!closeTimer)closeTimer=setTimeout(clear,140);}
    function position(){
      if(!host||!current)return;
      const anchor=current.trigger.getBoundingClientRect(),chat=current.list.getBoundingClientRect();
      if(!current.trigger.isConnected||anchor.bottom<chat.top||anchor.top>chat.bottom){clear();return;}
      const rightEdge=Math.min(innerWidth-8,chat.right-4),topEdge=Math.max(8,chat.top+4),bottomEdge=Math.min(innerHeight-8,chat.bottom-4);
      host.style.maxWidth=`${Math.max(120,Math.min(340,rightEdge-Math.max(8,chat.left+4)))}px`;
      body.style.maxHeight=`${Math.max(48,Math.min(220,bottomEdge-topEdge-65))}px`;
      const rect=host.getBoundingClientRect(),below=anchor.bottom+6,above=anchor.top-rect.height-6;
      host.style.left=`${Math.max(8,Math.min(anchor.left,rightEdge-rect.width))}px`;
      host.style.top=`${Math.max(topEdge,Math.min(below+rect.height<=bottomEdge?below:above,bottomEdge-rect.height))}px`;
    }
    function fillMessage(){
      const source=current.trigger.querySelector(':scope > span > span.inline');
      if(source){
        let remaining=6000,nodes=0;
        function copy(node){
          if(++nodes>400||remaining<=0)return;
          if(node.nodeType===Node.TEXT_NODE){const text=node.textContent.slice(0,remaining);remaining-=text.length;body.append(document.createTextNode(text));return;}
          if(!(node instanceof Element))return;
          if(node.tagName==='IMG'){
            const alt=node.getAttribute('alt')||'';
            try{const url=new URL(node.currentSrc||node.src);if(url.protocol==='https:'&&(url.hostname==='kick.com'||url.hostname.endsWith('.kick.com'))&&!url.username&&!url.password){const img=document.createElement('img');img.src=url.href;img.alt=alt;img.referrerPolicy='no-referrer';body.append(img);return;}}catch{}
            body.append(document.createTextNode(alt));return;
          }
          if(node.tagName==='BR'){body.append(document.createTextNode('\n'));return;}
          if(['SCRIPT','STYLE','IFRAME','SVG'].includes(node.tagName))return;
          for(const child of node.childNodes)copy(child);
        }
        for(const node of source.childNodes)copy(node);
      }else{
        const text=current.trigger.textContent.match(/Replying to\s+@?[a-zA-Z0-9_]{1,40}\s*:\s*([\s\S]*)/i)?.[1];
        if(text)body.textContent=text.slice(0,6000);
      }
      if(!body.textContent.trim()&&!body.querySelector('img')){body.textContent='Original message unavailable';body.classList.add('empty');}
    }
    function show(){
      openTimer=0;if(!current||!enabled||disposed||!current.trigger.isConnected){clear();return;}
      const name=authorFrom(current.trigger);if(!name){clear();return;}
      host=document.createElement('div');host.className='kr-reply-preview';host.id=`kr-reply-${crypto.randomUUID()}`;host.setAttribute('role','tooltip');
      const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=css;
      const panel=document.createElement('div');panel.className='preview';
      const header=document.createElement('header'),label=document.createElement('span'),author=document.createElement('strong');label.textContent='Replying to';author.textContent=name;header.append(label,author);
      body=document.createElement('div');body.className='message';fillMessage();panel.append(header,body);shadow.append(style,panel);document.body.append(host);
      current.trigger.setAttribute('aria-describedby',`${current.trigger.getAttribute('aria-describedby')||''} ${host.id}`.trim());
      host.addEventListener('pointerenter',stopClose);host.addEventListener('pointerleave',closeSoon);position();
    }
    const observer=new MutationObserver(changes=>{
      if(!current)return;
      if(!current.row.isConnected||!current.row.contains(current.trigger)||!authorFrom(current.trigger)){clear();return;}
      if(changes.some(change=>current.trigger.contains(change.target)))clear();
    });
    function enter(event){
      if(!enabled||disposed)return;
      const target=event.target instanceof Element?event.target:null;
      if(host?.contains(target)){stopClose();return;}
      const trigger=target?.closest('#chatroom-messages [data-index] button[class~="text-white/40"]');
      if(!trigger||!authorFrom(trigger)){if(current)closeSoon();return;}
      stopClose();if(current?.trigger===trigger)return;
      clear();current={trigger,row:trigger.closest('[data-index]'),list:trigger.closest('#chatroom-messages')};
      observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
      if(event.type==='focusin')show();else openTimer=setTimeout(show,100);
    }
    function leave(event){const next=event.relatedTarget instanceof Node?event.relatedTarget:null;if(current&&!current.trigger.contains(next)&&!host?.contains(next))closeSoon();}
    function setEnabled(value){enabled=value;if(enabled)document.documentElement.dataset.krReplyPreviews='true';else{clear();delete document.documentElement.dataset.krReplyPreviews;}}
    for(const type of ['pointerover','focusin'])document.addEventListener(type,enter,{capture:true,signal:abort.signal});
    for(const type of ['pointerout','focusout'])document.addEventListener(type,leave,{capture:true,signal:abort.signal});
    document.addEventListener('pointerdown',event=>{if(current&&!current.trigger.contains(event.target)&&!host?.contains(event.target))clear();},{capture:true,signal:abort.signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')clear();},{capture:true,signal:abort.signal});
    window.addEventListener('scroll',event=>{if(!host?.contains(event.target))clear();},{capture:true,passive:true,signal:abort.signal});
    window.addEventListener('resize',position,{passive:true,signal:abort.signal});window.addEventListener('blur',clear,{signal:abort.signal});
    setEnabled(enabled);
    return {setEnabled,destroy(){disposed=true;clear();abort.abort();delete document.documentElement.dataset.krReplyPreviews;}};
  }
  globalThis.KickRefinedReplies=Object.freeze({authorFrom,create});
})();
