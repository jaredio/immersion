/* Channel support discovery and a provider-owned form, loaded only on click. */
(() => {
  const {parse,extract}=KickRefinedSupportData;
  const heart='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M12 9v7m-3.5-3.5h7"/></svg>';
  const glyph=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
  function create({enabled=true}={}){
    const {api,channelSlug,channelDetails}=KickRefined;
    const cache=new Map(),pending=new Map(),controllers=new Set(),buttons=new Map(),actionGroups=new Set();
    let slug='',stored=Object.create(null),pinned=[],destroyed=false,session=null,dialog=null,shadow=null,host=null,frame=null,timeout=0,opener=null;
    const abort=new AbortController();
    const $=selector=>shadow.querySelector(selector);
    const validSlug=value=>typeof value==='string'&&/^[a-z0-9_]{1,40}$/.test(value);
    async function embedRequest(message){try{return (await api.runtime.sendMessage(message))?.ok===true;}catch{return false;}}
    function endEmbed(){if(session?.item&&session.item.provider!=='powerchat')embedRequest({type:'immersion:tip-embed-end',token:session.token});}
    async function request(channel,kind){
      if(!validSlug(channel)||destroyed)throw Error('Channel unavailable');
      const key=`${kind}:${channel}`,hit=cache.get(key);if(hit?.until>Date.now())return hit.data;
      if(pending.has(key))return pending.get(key);
      const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),8000);
      const job=(async()=>{
        try{
          const path=kind==='channel'?`/api/v2/channels/${channel}`:`/api/v1/channels/${channel}/links`;
          const response=await fetch(location.origin+path,{credentials:'omit',signal:controller.signal});
          if(!response.ok)throw Error('Channel unavailable');
          const text=await response.text();if(text.length>2097152)throw Error('Channel response too large');
          const raw=JSON.parse(text);
          const data=kind==='channel'?channelDetails(raw,channel):Array.isArray(raw)?raw.slice(0,30).filter(item=>item&&typeof item==='object').map(item=>({title:typeof item.title==='string'?item.title.slice(0,300):'',description:typeof item.description==='string'?item.description.slice(0,20000):'',image:KickRefinedProfile.url(item.image?.url),href:KickRefinedProfile.url(item.link)})):[];
          const links=kind==='channel'?extract(data.bio,'Channel bio'):data.flatMap(panel=>extract(`${panel.href}\n${panel.description}`,'Channel panel'));
          if(destroyed)throw Error('Support closed');
          cache.delete(key);cache.set(key,{data,links,until:Date.now()+(kind==='channel'?60000:120000)});
          while(cache.size>60)cache.delete(cache.keys().next().value);
          return data;
        }finally{clearTimeout(timer);controllers.delete(controller);pending.delete(key);}
      })();pending.set(key,job);return job;
    }
    function candidates(channel){
      const items=new Map();
      function add(values){for(const value of values)if(!items.has(value.key))items.set(value.key,value);}
      const manual=parse(stored[channel]);if(manual)add([{...manual,source:'Saved for this channel'}]);
      add(cache.get(`channel:${channel}`)?.links||[]);add(cache.get(`panels:${channel}`)?.links||[]);
      if(channel===slug)add(pinned);
      return [...items.values()].slice(0,8);
    }
    function scanPinned(){
      const found=[];
      for(const content of [...document.querySelectorAll('#channel-chatroom [data-testid="pinned-message-content"]')].slice(0,8)){
          // The inspected native moderator pin has its own Sent by header. Paid carousel messages do not qualify.
          const header=content.parentElement?.parentElement?.querySelector('[data-testid="sent-by"]');
          if(!header?.querySelector('[data-testid="identity-badge-moderator"],[data-testid="identity-badge-broadcaster"]'))continue;
          found.push(...extract([...content.querySelectorAll('a[href]')].map(a=>a.href).join('\n')+'\n'+content.textContent,'Channel-pinned message'));
      }
      pinned=found;
    }
    function notify(){
      for(const [button,channel] of buttons){
        const count=candidates(channel).length;button.title=count?`Support ${channel}`:`Find a support link for ${channel}`;
      }
    }
    async function discover(channel){
      await Promise.allSettled([request(channel,'channel'),request(channel,'panels')]);
      if(!destroyed&&slug===channel)notify();
      return candidates(channel);
    }
    const ready=api.storage.local.get('supportLinks').then(data=>{
      const values=data.supportLinks;if(values&&typeof values==='object')for(const [key,value] of Object.entries(values).slice(-60))if(validSlug(key)&&parse(value))stored[key]=parse(value).href;
      notify();
    }).catch(()=>{});
    function makeButton(channel){
      for(const existing of buttons.keys())if(!existing.isConnected)buttons.delete(existing);
      const button=document.createElement('button');button.type='button';button.className='kr-support-button';button.dataset.krSupport=channel;
      button.innerHTML=heart+'<span>Support</span>';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label',`Support ${channel}`);
      // The map is disposable housekeeping; a detached/reused card must keep its own recipient.
      buttons.set(button,channel);button.addEventListener('click',()=>open(channel,button));return button;
    }
    function mount(){
      if(host)return;
      host=document.createElement('div');host.id='kr-support-root';shadow=host.attachShadow({mode:'open'});
      const css=document.createElement('link');css.rel='stylesheet';css.href=api.runtime.getURL('ui.css');shadow.append(css);
      dialog=document.createElement('dialog');dialog.className='support-dialog';dialog.setAttribute('aria-labelledby','support-title');
      dialog.innerHTML=`<header class="support-header"><div class="support-mark">${heart}</div><div class="support-heading"><h2 id="support-title"></h2><p id="support-subtitle">Send a tip</p></div><button class="support-close support-icon-button" aria-label="Close support" title="Close">${glyph('m6 6 12 12M18 6 6 18')}</button></header><div class="support-controls"><div class="support-provider-row"><label class="support-provider-label"><select id="support-provider" aria-label="Tip service"></select></label><a id="support-destination" class="support-icon-button" target="_blank" rel="noopener noreferrer" aria-label="View tip page" title="View tip page">${glyph('M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5')}</a></div><p id="support-source"></p></div><div id="support-status" role="status"></div><div class="support-frame-mount"></div><section class="support-external-checkout" hidden><h3 id="support-external-title">Continue with the tip service</h3><p>You can open checkout in a separate window while your Kick stream stays open here.</p><button id="support-checkout-window" type="button">Open KickBot checkout &#8599;</button></section><details class="support-link-editor"><summary>Use a different support link</summary><form id="support-link-form"><label for="support-link">Tip-page URL</label><div><input id="support-link" type="url" required placeholder="https://powerchat.live/creator" maxlength="2048" autocomplete="off"><button type="submit">Save</button></div><button id="support-forget" type="button">Remove saved link</button><p id="support-link-error" role="status"></p></form></details><footer class="support-footer"><span><i class="support-provider-dot" aria-hidden="true"></i><strong id="support-handled">Tip service</strong> checkout</span><button id="support-retry" class="support-icon-button" aria-label="Reload form" title="Reload form" hidden>${glyph('M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17')}</button><button id="support-popout" class="support-icon-button" aria-label="Open checkout window" title="Open checkout window" hidden>${glyph('M8 3h13v13H8zM3 8v13h13v-5M8 7h13')}</button><a id="support-external" class="support-icon-button" aria-label="Open in new tab" title="Open in new tab" target="_blank" rel="noopener noreferrer" hidden>${glyph('M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5')}</a></footer>`;
      shadow.append(dialog);document.body.append(host);
      $('.support-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(!dialog.open)cleanup();});
      dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
      $('#support-provider').addEventListener('change',()=>loadForm(session.items[Number($('#support-provider').value)]));
      $('#support-retry').addEventListener('click',()=>{if(session?.item)loadForm(session.item);});
      const popout=()=>{if(session?.item){const url=new URL(session.item.href);url.hash='immersion-checkout';window.open(url.href,'_blank','popup,width=540,height=800,noopener,noreferrer');}};
      $('#support-checkout-window').addEventListener('click',popout);$('#support-popout').addEventListener('click',popout);
      $('#support-link-form').addEventListener('submit',async event=>{
        event.preventDefault();if(!session)return;
        const parsed=parse($('#support-link').value.trim());
        if(!parsed){$('#support-link-error').textContent='Use a public Powerchat, KickBot or StreamElements tip-page URL.';return;}
        const channel=session.slug,next=Object.fromEntries([...Object.entries(stored).filter(([key])=>key!==channel),[channel,parsed.href]]);
        while(Object.keys(next).length>60)delete next[Object.keys(next)[0]];
        try{await api.storage.local.set({supportLinks:next});stored=next;notify();if(session?.slug===channel){$('#support-link-error').textContent='';showItems(candidates(channel));}}
        catch{if(session?.slug===channel)$('#support-link-error').textContent='Could not save the link. Try again.';}
      });
      $('#support-forget').addEventListener('click',async()=>{
        if(!session)return;const channel=session.slug,next={...stored};delete next[channel];
        try{await api.storage.local.set({supportLinks:next});stored=next;notify();if(session?.slug===channel)showItems(candidates(channel));}
        catch{if(session?.slug===channel)$('#support-link-error').textContent='Could not remove the saved link.';}
      });
      // Keep Kick's global player shortcuts out of the dialog's own controls.
      for(const type of ['keydown','keyup','keypress'])shadow.addEventListener(type,event=>event.stopPropagation());
    }
    function cleanup(){
      endEmbed();clearTimeout(timeout);frame?.remove();frame=null;session=null;
      if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;
    }
    function status(text){$('#support-status').textContent=text;$('#support-status').hidden=!text;}
    function showItems(items){
      if(!session)return;session.items=items;
      const select=$('#support-provider');select.replaceChildren();
      items.forEach((item,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${item.label} · ${item.recipient}`;select.append(option);});
      $('.support-controls').hidden=!items.length;$('.support-link-editor').open=!items.length;
      $('#support-link').value=stored[session.slug]||'';$('#support-forget').hidden=!stored[session.slug];
      if(items.length)loadForm(items[0]);else{
        frame?.remove();frame=null;session.item=null;clearTimeout(timeout);
        dialog.dataset.checkout='empty';$('.support-external-checkout').hidden=true;$('.support-frame-mount').hidden=true;
        $('#support-external').hidden=$('#support-retry').hidden=$('#support-popout').hidden=true;$('#support-handled').textContent='Tip service';
        status('No supported tip link found. You can add the creator’s published tip-page URL below.');
      }
    }
    function separateCheckout(text=''){
      endEmbed();clearTimeout(timeout);frame?.remove();frame=null;dialog.dataset.checkout='window';$('.support-external-checkout').hidden=false;$('.support-frame-mount').hidden=true;$('#support-retry').hidden=true;status(text);
    }
    async function loadForm(item){
      if(!session||!item)return;
      endEmbed();clearTimeout(timeout);frame?.remove();frame=null;session.item=item;session.token=crypto.randomUUID();
      $('#support-external-title').textContent=`Continue with ${item.label}`;$('#support-checkout-window').textContent=`Open ${item.label} checkout \u2197`;
      $('#support-source').textContent=item.source;$('#support-destination').title=new URL(item.href).host+new URL(item.href).pathname;$('#support-destination').href=item.href;
      $('#support-external').href=item.href;$('#support-external').hidden=$('#support-popout').hidden=false;$('#support-retry').hidden=item.provider!=='powerchat';$('#support-handled').textContent=item.label;
      const identity=session,token=session.token;
      if(item.provider!=='powerchat'){
        dialog.dataset.checkout='loading';$('.support-external-checkout').hidden=true;$('.support-frame-mount').hidden=true;status('Preparing KickBot checkout…');
        const allowed=await embedRequest({type:'immersion:tip-embed',href:item.href,token});
        if(session!==identity||session.token!==token){if(allowed)embedRequest({type:'immersion:tip-embed-end',token});return;}
        if(!allowed){separateCheckout();return;}
      }
      dialog.dataset.checkout='embedded';$('.support-external-checkout').hidden=true;$('.support-frame-mount').hidden=false;$('#support-retry').hidden=false;
      frame=document.createElement('iframe');frame.title=`${item.label} donation form for ${item.recipient}`;
      frame.className='support-provider-frame';frame.referrerPolicy='origin';
      frame.setAttribute('allow','payment');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
      frame.src=item.href;
      const activeFrame=frame;
      const current=()=>session===identity&&session.token===token&&frame===activeFrame;
      const connection=()=>activeFrame.contentWindow?.postMessage({type:'immersion:tip-connect',token,href:item.href},new URL(item.href).origin);
      activeFrame.addEventListener('load',()=>{if(!current())return;clearTimeout(timeout);status('');connection();});
      activeFrame.addEventListener('error',()=>{if(!current())return;clearTimeout(timeout);status('This service could not load here. You can reload the form or open it in a new tab.');});
      $('.support-frame-mount').append(frame);status(`Loading ${item.label}…`);
      // Silence from a cross-origin page is not a failure signal. Never destroy a checkout or its draft on a timer.
      timeout=setTimeout(()=>{if(current())status('Taking longer to load? You can keep waiting, reload the form, or open it in a new tab.');},14000);
    }
    async function open(channel,button){
      if(!enabled||!validSlug(channel)||destroyed)return;
      mount();if(dialog.open){dialog.close();cleanup();}opener=button||document.activeElement;
      const identity={slug:channel,items:[],item:null,token:''};session=identity;
      $('#support-title').textContent=`Support ${channel}`;$('#support-link-error').textContent='';$('.support-controls').hidden=true;
      dialog.dataset.checkout='loading';$('.support-external-checkout').hidden=true;$('.support-frame-mount').hidden=true;
      $('.support-link-editor').open=false;$('#support-external').hidden=$('#support-retry').hidden=$('#support-popout').hidden=true;
      status('Finding channel support links…');dialog.showModal();
      await ready;if(session!==identity)return;scanPinned();
      const found=await discover(channel);if(session===identity)showItems(found);
    }
    window.addEventListener('message',event=>{
      if(!session?.item||event.source!==frame?.contentWindow||event.origin!==new URL(session.item.href).origin)return;
      if(event.data?.type==='immersion:tip-hello'){frame.contentWindow.postMessage({type:'immersion:tip-connect',token:session.token,href:session.item.href},event.origin);return;}
      if(event.data?.token!==session.token)return;
      if(event.data.type==='immersion:tip-connected'||event.data.type==='immersion:tip-ready'){clearTimeout(timeout);status('');}
      else if(event.data.type==='immersion:tip-unavailable'){clearTimeout(timeout);if(session.item.provider!=='powerchat')separateCheckout(`This ${session.item.label} page is unavailable in the panel. Try the checkout window.`);else status('This tip page is unavailable or has changed. Try opening it separately.');}
      else if(event.data.type==='immersion:tip-close')dialog.close();
    },{signal:abort.signal});
    function refresh(){
      if(destroyed)return;
      for(const button of buttons.keys())if(!button.isConnected)buttons.delete(button);
      for(const group of actionGroups)if(!group.isConnected)actionGroups.delete(group);
      const next=channelSlug(location.pathname,location.origin)||'';
      if(!enabled){for(const button of buttons.keys())button.remove();buttons.clear();clearActionGroups();return;}
      if(next!==slug){for(const button of buttons.keys())if(button.dataset.krSupportNative){button.remove();buttons.delete(button);}clearActionGroups();slug=next;pinned=[];if(slug)discover(slug);}
      if(!slug)return;
      for(const native of document.querySelectorAll('main [data-testid="sub-button"],main [data-testid="follow-button"]')){
        const group=native.parentElement;if(!group||group.querySelector('[data-kr-support]'))continue;
        const button=makeButton(slug);button.dataset.krSupportNative='true';group.dataset.krSupportActions='true';actionGroups.add(group);group.append(button);
      }
      scanPinned();notify();
    }
    function clearActionGroups(){for(const group of actionGroups)group.removeAttribute('data-kr-support-actions');actionGroups.clear();}
    return {refresh,open,makeButton,channel:channel=>request(channel,'channel'),panels:channel=>request(channel,'panels'),
      setEnabled(value){enabled=!!value;if(!enabled&&dialog?.open)dialog.close();refresh();},
      destroy(){destroyed=true;abort.abort();for(const controller of controllers)controller.abort();for(const button of buttons.keys())button.remove();buttons.clear();clearActionGroups();if(dialog?.open)dialog.close();cleanup();host?.remove();cache.clear();}
    };
  }
  globalThis.KickRefinedSupport=Object.freeze({create});
})();
