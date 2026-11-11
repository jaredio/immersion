/* Native chat stays in its React tree; owned overlays have one lifetime. */
(() => {
  function create({scope,getContext,getState,getCatalog,selectedChat,chatChannels,style,originalStyle,panel,chatTabs,$,decorate}) {
    let chatFrame=null,chatOverlay=null,chatPicker=null,chatPickerRoot=null,chatHeader=null,pickerScope=null;
    function chatMount() {
      const context=getContext();
      if(!context.chat) return $('.multi-chat-mount');
      if(!chatOverlay){chatOverlay=document.createElement('div');chatOverlay.id='kr-multi-chat';chatOverlay.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;z-index:5;background:#0e0e11';if(getComputedStyle(context.chat.parentElement).position==='static')style(context.chat.parentElement,'position','relative');context.chat.parentElement.append(chatOverlay);}
      return chatOverlay;
    }
    function syncChatPicker(){
      const context=getContext(),catalog=getCatalog();
      if(!context?.chat)return;
      if(!chatPicker?.isConnected){
        pickerScope?.dispose();pickerScope=scope.child();chatPicker?.remove();chatPicker=chatPickerRoot=chatHeader=null;
        const label=[...context.chat.querySelectorAll('h2,h3,span,div')].find(node=>!node.children.length&&/^(?:stream )?chat$/i.test(node.textContent.trim())&&!node.closest('button,#chatroom-messages'));
        chatHeader=context.chat.querySelector('[data-testid="chatroom-header"],header')||(label?.parentElement===context.chat?label:label?.parentElement);
        if(!chatHeader||chatHeader.contains(context.chat.querySelector('#chatroom-messages'))||chatHeader.querySelector('textarea,[contenteditable="true"]')){chatHeader=null;return;}
        if(label&&label!==chatHeader)style(label,'visibility','hidden');
        if(getComputedStyle(chatHeader).position==='static')style(chatHeader,'position','relative');
        style(chatHeader,'z-index','6');
        chatPicker=document.createElement('div');chatPicker.id='kr-multi-chat-picker';chatPicker.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;width:220px;max-width:70%;visibility:visible';
        chatPickerRoot=chatPicker.attachShadow({mode:'open'});
        const css=document.createElement('style');css.textContent=`:host{color:#ececf3;font:600 13px/1.4 Inter,system-ui,sans-serif}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}.picker{position:relative;width:100%}.trigger,.option{display:flex;align-items:center;gap:8px;width:100%;min-width:0;text-align:left}.trigger{height:40px;padding:6px 9px;border:1px solid #ffffff12;border-radius:9px;background:#111115}.avatar{width:26px;height:26px;flex:none;border-radius:50%;object-fit:cover;background:#26262e}.avatar[hidden]{display:none}.name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chevron{width:14px;height:14px;flex:none}.options{position:absolute;top:calc(100% + 5px);left:0;width:100%;max-height:320px;overflow:auto;padding:4px;border:1px solid #ffffff1c;border-radius:9px;background:#111115;box-shadow:0 10px 24px #0008}.options[hidden]{display:none}.option{border:0;border-radius:6px;background:transparent;padding:7px 5px}.option[aria-selected=true]{color:var(--kr-accent,#b0ff8c);background:#ffffff08}.option:hover,.option:focus-visible{background:#ffffff12}button:focus-visible{outline:2px solid var(--kr-accent,#b0ff8c);outline-offset:-2px}`;
        const picker=document.createElement('div');picker.className='picker';
        const trigger=document.createElement('button');trigger.type='button';trigger.className='trigger';trigger.setAttribute('aria-label','Chat channel');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-controls','chat-options');trigger.setAttribute('aria-expanded','false');
        const image=document.createElement('img');image.className='avatar';image.alt='';const name=document.createElement('span');name.className='name';const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg');chevron.classList.add('chevron');chevron.setAttribute('viewBox','0 0 16 16');chevron.innerHTML='<path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/>';trigger.append(image,name,chevron);
        const options=document.createElement('div');options.className='options';options.id='chat-options';options.setAttribute('role','listbox');options.setAttribute('aria-label','Chat channels');options.hidden=true;
        const close=()=>{options.hidden=true;trigger.setAttribute('aria-expanded','false');};
        const open=()=>{options.hidden=false;trigger.setAttribute('aria-expanded','true');(options.querySelector('[aria-selected="true"]')||options.firstElementChild)?.focus();};
        pickerScope.listen(trigger,'click',()=>options.hidden?open():close());
        pickerScope.listen(options,'click',event=>{const option=event.target.closest('[role="option"]');if(!option)return;const mirror=$('#multi-chat-channel');mirror.value=option.dataset.channel;close();mirror.dispatchEvent(new Event('change',{bubbles:true}));trigger.focus();});
        pickerScope.listen(picker,'keydown',event=>{
          const items=[...options.children],index=items.indexOf(chatPickerRoot.activeElement);
          if(event.key==='Escape'){event.preventDefault();close();trigger.focus();return;}
          if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
          event.preventDefault();if(options.hidden){open();return;}
          items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
        });
        pickerScope.listen(document,'pointerdown',event=>{if(!event.composedPath().includes(chatPicker))close();},true);
        pickerScope.listen(picker,'focusout',event=>{if(!picker.contains(event.relatedTarget))close();});
        picker.append(trigger,options);chatPickerRoot.append(css,picker);chatHeader.append(chatPicker);const owned=chatPicker;pickerScope.defer(()=>owned.remove());
      }
      const options=chatPickerRoot.querySelector('.options'),trigger=chatPickerRoot.querySelector('.trigger'),channels=chatChannels(),catalogKey=JSON.stringify(channels.map(slug=>[slug,catalog.get(slug)?.title,catalog.get(slug)?.image]));
      if(options.dataset.key!==catalogKey){
        options.dataset.key=catalogKey;
        const existing=new Map([...options.children].map(node=>[node.dataset.channel,node]));
        for(const slug of channels){let option=existing.get(slug);if(!option){option=document.createElement('button');option.type='button';option.className='option';option.setAttribute('role','option');option.tabIndex=-1;option.dataset.channel=slug;const image=document.createElement('img');image.className='avatar';image.alt='';const name=document.createElement('span');name.className='name';option.append(image,name);}updateIdentity(option,catalog.get(slug),slug);options.append(option);existing.delete(slug);}
        for(const option of existing.values())option.remove();
      }
      for(const option of options.children){const selected=String(option.dataset.channel===selectedChat());if(option.getAttribute('aria-selected')!==selected)option.setAttribute('aria-selected',selected);}
      updateIdentity(trigger,catalog.get(selectedChat()),selectedChat());
      panel.dataset.chatPicker='native';
      chatPicker.style.visibility=getState().chatVisible?'visible':'hidden';
      style(chatHeader,'visibility',getState().chatVisible&&selectedChat()===context.slug?'visible':'hidden');
    }
    function updateIdentity(node,meta,slug){const image=node.querySelector('img'),name=node.querySelector('.name');const title=meta?.title||slug;if(name.textContent!==title)name.textContent=title;image.hidden=!meta?.image;if(meta?.image&&image.getAttribute('src')!==meta.image)image.src=meta.image;}
    function render() {
      const context=getContext(),state=getState();
      syncChatPicker();
      const chat=selectedChat(),useNative=!!context.chat,original=chat===context.slug;panel.dataset.nativeChat=String(useNative);
      $('.multi-chat').hidden=useNative||!state.chatVisible||!chat;
      if(useNative){
        // The native chat may create its own stacking context (fixed/flex).
        // Lift its visible picker above the sibling popout overlay.
        style(context.chat,'z-index','6');
        const prior=originalStyle(context.branch,'display');
        style(context.branch,'display',state.chatVisible?(prior?.value??context.branch.style.getPropertyValue('display')):'none');
        style(context.chat,'visibility',state.chatVisible&&original?'visible':'hidden');if(chatHeader)style(chatHeader,'visibility',state.chatVisible&&original?'visible':'hidden');
      }
      const needsFrame=state.chatVisible&&chat&&!(useNative&&original);
      const url=chat?`${location.origin}/popout/${encodeURIComponent(chat)}/chat`:location.origin;$('#multi-chat-external').href=url;
      if(needsFrame){if(!chatFrame){chatFrame=document.createElement('iframe');chatFrame.name='kick-refined-chat';chatFrame.title='Selected stream chat';chatFrame.style.cssText='width:100%;height:100%;border:0;display:block';chatMount().append(chatFrame);}if(chatFrame.getAttribute('src')!==url)chatFrame.src=url;if(chatOverlay)chatOverlay.hidden=false;}
      else {chatFrame?.remove();chatFrame=null;if(chatOverlay)chatOverlay.hidden=true;}
      $('#multi-chat-toggle').setAttribute('aria-pressed',String(state.chatVisible));$('#multi-chat-toggle').setAttribute('aria-label',state.chatVisible?'Hide chat':'Show chat');decorate($('#multi-chat-toggle'),'chat',state.chatVisible?'Hide chat':'Show chat',true);
      for(const button of chatTabs.children)button.setAttribute('aria-pressed',String(chat===button.dataset.channel));
    }

    function reset(){pickerScope?.dispose();pickerScope=null;chatPicker?.remove();chatFrame?.remove();chatOverlay?.remove();chatFrame=chatOverlay=chatPicker=chatPickerRoot=chatHeader=null;delete panel.dataset.chatPicker;}
    scope.defer(reset);
    return {render,reset,syncPicker:syncChatPicker,get overlay(){return chatOverlay;},get pickerConnected(){return !!chatPicker?.isConnected;},isSource:source=>!!chatFrame&&chatFrame.contentWindow===source,frameRect:()=>chatFrame?.getBoundingClientRect()};
  }
  globalThis.KickRefinedMultiChat=Object.freeze({create});
})();
