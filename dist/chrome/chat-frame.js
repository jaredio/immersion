/* Preference/theme sync for native popout chat. No toolbar or multiview recursion. */
(() => {
  const { api, normalize } = KickRefined;
  let current,disposed=false;
  let clips;
  // Only our embedded chat has a channel picker supplied by the parent.
  const workspaceChat=window!==window.top&&(window.frameElement?.getAttribute('name')||window.name)==='kick-refined-chat';
  let reportedPanel=null;
  function reportPanel(enabled){
    if(!workspaceChat)return;
    const search=enabled?document.querySelector('input[aria-label="Search active chatters"]'):null,open=!!search&&search.getBoundingClientRect().width>0;
    if(open===reportedPanel)return;reportedPanel=open;
    const panelChannel=location.pathname.match(/^\/popout\/([a-z0-9_]{1,40})\/chat\/?$/i)?.[1].toLowerCase();
    if(panelChannel)window.parent.postMessage({type:'kick-refined:chat-panel',channel:panelChannel,panel:'chatters',open},location.origin);
  }
  let markedHeader=null,markedTitle=null;
  const titleSelector='h2,h3,span',headerMark='data-kr-workspace-chat-header',titleMark='data-kr-workspace-chat-title';
  function findTitle(scope,messages){
    if(!scope||messages?.contains(scope))return null;
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_ELEMENT,{acceptNode(node){
      if(node===messages||node.matches('button'))return NodeFilter.FILTER_REJECT;
      return node.matches(titleSelector)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
    }});
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(!node.children.length&&/^(?:stream )?chat$/i.test(node.textContent.trim()))return node;
    }
    return null;
  }
  function markHeader(header,title){
    if(markedHeader!==header)markedHeader?.removeAttribute(headerMark);
    if(markedTitle!==title)markedTitle?.removeAttribute(titleMark);
    markedHeader=header;markedTitle=title;
    if(header&&!header.hasAttribute(headerMark))header.setAttribute(headerMark,'');
    if(title&&!title.hasAttribute(titleMark))title.setAttribute(titleMark,'');
  }
  function syncHeader(){
    if(!workspaceChat)return;
    const enabled=current?.enabled===true;
    reportPanel(enabled);
    const dataset=document.documentElement.dataset,value=String(enabled);
    if(dataset.krWorkspaceChat!==value)dataset.krWorkspaceChat=value;
    if(!enabled){markHeader(null,null);return;}
    const root=document.getElementById('channel-chatroom')||document.getElementById('chatroom');
    const messages=document.getElementById('chatroom-messages');
    const known=root?.querySelector('header:not(#chatroom-messages *)')||document.querySelector('[data-testid="chatroom-header"]:not(#chatroom-messages *)');
    const title=findTitle(known,messages)||findTitle(root||document.body,messages);
    const header=known||(title?.parentElement===root?title:title?.parentElement);
    if(header&&!header.contains(messages)&&!header.querySelector('[contenteditable="true"],textarea'))markHeader(header,title);
    else markHeader(null,null);
  }
  let unsubscribeHeader=null;
  const panelObserver=new MutationObserver(()=>reportPanel(true));
  const xPosts=KickRefinedX.create({enabled:false});
  const mediaCards=KickRefinedMedia.create({media:false,profiles:false});
  const replyPreviews=KickRefinedReplies.create({enabled:false});
  const bridge=KickRefinedClipBridge.create({getClips:()=>clips});
  clips=KickRefinedClips.create({enabled:false,onWorkspace:bridge.available?item=>bridge.add(item):null,onWorkspaceDrag:bridge.available?(event,item)=>bridge.drag(event,item):null});
  function apply(input) {
    if(disposed)return;
    const s = normalize(input), root = document.documentElement; current = s;
    globalThis.KickRefinedPerf?.configure(s.enabled&&s.diagnostics);
    if (!root) return;
    clips.setEnabled(s.enabled&&s.chatClips&&!s.textOnly);
    xPosts.setEnabled(s.enabled&&s.xEmbeds&&!s.textOnly);
    mediaCards.setOptions({media:s.enabled&&s.mediaEmbeds&&!s.textOnly,profiles:s.enabled&&s.xEmbeds&&!s.textOnly});
    replyPreviews.setEnabled(s.enabled);
    root.dataset.krEnabled = String(s.enabled); root.dataset.krPerformance = String(s.performance);
    root.dataset.krFastChat = String(s.fastChat);
    root.dataset.krTextOnly = String(s.textOnly); root.dataset.krAccent = s.accent;
    root.dataset.krChatFrame = String(window !== window.top);
    if(workspaceChat&&s.enabled&&!unsubscribeHeader){
      unsubscribeHeader=KickRefinedDOM.subscribePage(syncHeader);
      panelObserver.observe(root,{subtree:true,attributes:true,attributeFilter:['open','hidden']});
    }else if(!s.enabled&&unsubscribeHeader){unsubscribeHeader();unsubscribeHeader=null;panelObserver.disconnect();}
    syncHeader();
    root.style.setProperty('--kr-font-size', `${s.fontSize}px`);
  }
  api.storage.local.get('settings').then(data => apply(data.settings)).catch(() => apply());
  const onSettingsChanged=(changes,area)=>{if(area==='local'&&changes.settings)apply(changes.settings.newValue);};
  api.storage.onChanged.addListener(onSettingsChanged);
  const observer = new MutationObserver(() => { if (current && document.documentElement.dataset.krEnabled !== String(current.enabled)) apply(current); });
  if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kr-enabled'] });
  window.addEventListener('pagehide',event=>{if(!event.persisted&&!disposed){disposed=true;panelObserver.disconnect();unsubscribeHeader?.();markHeader(null,null);api.storage.onChanged.removeListener?.(onSettingsChanged);bridge.destroy();clips.destroy();xPosts.destroy();mediaCards.destroy();replyPreviews.destroy();observer.disconnect();}});
})();
