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
    const search=document.querySelector('input[aria-label="Search active chatters"]'),open=!!enabled&&!!search&&search.getBoundingClientRect().width>0;
    if(open===reportedPanel)return;reportedPanel=open;
    const match=location.pathname.match(/^\/popout\/([a-z0-9_]{1,40})\/chat\/?$/i);if(match)window.parent.postMessage({type:'kick-refined:chat-panel',channel:match[1].toLowerCase(),panel:'chatters',open},location.origin);
  }
  const markedHeaders=new Set();
  const markedTitles=new Set();
  function syncHeader(){
    if(!workspaceChat)return;
    const enabled=current?.enabled===true;
    reportPanel(enabled);
    document.documentElement.dataset.krWorkspaceChat=String(enabled);
    if(!enabled){for(const header of markedHeaders)header.removeAttribute('data-kr-workspace-chat-header');markedHeaders.clear();for(const title of markedTitles)title.removeAttribute('data-kr-workspace-chat-title');markedTitles.clear();return;}
    for(const header of [...markedHeaders])if(!header.isConnected){header.removeAttribute('data-kr-workspace-chat-header');markedHeaders.delete(header);}
    const root=document.getElementById('channel-chatroom')||document.getElementById('chatroom');
    const label=[...(root||document).querySelectorAll('h2,h3,span')].find(node=>!node.children.length&&/^(?:stream )?chat$/i.test(node.textContent.trim())&&!node.closest('button,#chatroom-messages'));
    const header=root?.querySelector('header')||document.querySelector('[data-testid="chatroom-header"]')||(label?.parentElement===root?label:label?.parentElement);
    for(const title of markedTitles)if(!title.isConnected||title.children.length||!/^(?:stream )?chat$/i.test(title.textContent.trim())){title.removeAttribute('data-kr-workspace-chat-title');markedTitles.delete(title);}
    if(header&&!header.contains(document.getElementById('chatroom-messages'))&&!header.querySelector('[contenteditable="true"],textarea')){header.setAttribute('data-kr-workspace-chat-header','');markedHeaders.add(header);if(label){label.setAttribute('data-kr-workspace-chat-title','');markedTitles.add(label);}}
  }
  let unsubscribeHeader=null;
  const panelObserver=new MutationObserver(()=>syncHeader());
  if(workspaceChat)panelObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open','hidden']});
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
    root.dataset.krTextOnly = String(s.textOnly); root.dataset.krAccent = s.accent;
    root.dataset.krChatFrame = String(window !== window.top);
    if(workspaceChat&&s.enabled&&!unsubscribeHeader)unsubscribeHeader=KickRefinedDOM.subscribePage(syncHeader);
    else if((!workspaceChat||!s.enabled)&&unsubscribeHeader){unsubscribeHeader();unsubscribeHeader=null;}
    syncHeader();
    root.style.setProperty('--kr-font-size', `${s.fontSize}px`);
  }
  api.storage.local.get('settings').then(data => apply(data.settings)).catch(() => apply());
  const onSettingsChanged=(changes,area)=>{if(area==='local'&&changes.settings)apply(changes.settings.newValue);};
  api.storage.onChanged.addListener(onSettingsChanged);
  const observer = new MutationObserver(() => { if (current && document.documentElement.dataset.krEnabled !== String(current.enabled)) apply(current); });
  if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kr-enabled'] });
  window.addEventListener('pagehide',event=>{if(!event.persisted&&!disposed){disposed=true;panelObserver.disconnect();unsubscribeHeader?.();for(const header of markedHeaders)header.removeAttribute('data-kr-workspace-chat-header');markedHeaders.clear();for(const title of markedTitles)title.removeAttribute('data-kr-workspace-chat-title');markedTitles.clear();api.storage.onChanged.removeListener?.(onSettingsChanged);bridge.destroy();clips.destroy();xPosts.destroy();mediaCards.destroy();replyPreviews.destroy();observer.disconnect();}});
})();
