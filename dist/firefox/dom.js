/* Shared, demand-driven DOM subscriptions for one document/frame.
 * Feature controllers own their records; this service owns observer lifetimes. */
(() => {
  if (globalThis.KickRefinedDOM) return;
  const pages = new Set();
  const chats = new Set();
  let currentChat = null;
  let watchingPage = false;
  let watchingChat = false;
  let chatAttributes = '';
  let pageCharacters = false;
  let linkIndex = new WeakMap();
  let candidateIndex=new WeakMap();
  const chatJobs=new Set();let chatFrame=0,chatFallback=0,chatDeadline=null;
  const fastChat=()=>document.documentElement?.dataset.krEnabled==='true'&&document.documentElement.dataset.krFastChat==='true';
  function scheduleChatFrame(){
    if(chatFrame||chatFallback||!chatJobs.size)return;
    if(document.hidden)chatFallback=setTimeout(runChatJobs,100);else chatFrame=requestAnimationFrame(runChatJobs);
  }
  function runChatJobs(){
    chatFrame=chatFallback=0;const deadline=fastChat()?performance.now()+2:Infinity;
    try{
      for(const job of chatJobs){chatJobs.delete(job);if(job.cancelled)continue;chatDeadline=deadline;notify(job.callback);chatDeadline=null;if(performance.now()>=deadline)break;}
    }finally{chatDeadline=null;scheduleChatFrame();}
  }
  function deferChatWork(callback,delay=0){
    const job={callback,timer:0,cancelled:false};
    job.timer=setTimeout(()=>{job.timer=0;if(job.cancelled)return;if(fastChat()){chatJobs.add(job);scheduleChatFrame();}else notify(callback);},delay);
    return job;
  }
  function cancelChatWork(job){
    if(!job)return;job.cancelled=true;clearTimeout(job.timer);chatJobs.delete(job);
    if(!chatJobs.size){cancelAnimationFrame(chatFrame);clearTimeout(chatFallback);chatFrame=chatFallback=0;}
  }
  document.addEventListener?.('visibilitychange',()=>{if(!chatJobs.size)return;cancelAnimationFrame(chatFrame);clearTimeout(chatFallback);chatFrame=chatFallback=0;scheduleChatFrame();});

  function recordRows(record, nearest, descendants) {
    const rows = new Set();
    const add = node => {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element) return;
      if (!nearest.has(element)) nearest.set(element, element.closest?.('[data-index]'));
      const row = nearest.get(element); if (row) rows.add(row);
    };
    const addDescendants = node => {
      if (!descendants.has(node)) descendants.set(node, node.querySelectorAll?.('[data-index]') || []);
      for (const row of descendants.get(node)) rows.add(row);
    };
    add(record.target);
    // A recycled row may have lost its index before this batch is delivered.
    if (record.attributeName === 'data-index') rows.add(record.target);
    for (const node of record.addedNodes || []) {
      add(node);
      if (node.nodeType === 1) addDescendants(node);
    }
    for (const node of record.removedNodes || []) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('[data-index]')) rows.add(node);
      addDescendants(node);
    }
    return rows;
  }
  function links(row,kind) {
    let anchors = linkIndex.get(row);
    if (!anchors) {
      anchors = [...row.querySelectorAll('a[href]')]; linkIndex.set(row, anchors);
      globalThis.KickRefinedPerf?.count('chat.rowIndexBuilds');
    }
    if(!kind||!fastChat())return anchors;
    let candidates=candidateIndex.get(anchors);
    if(!candidates){
      candidates={clips:[],x:[],media:[]};
      for(const anchor of anchors)try{
        const url=new URL(anchor.href),host=url.hostname.replace(/^www\./,'');if(url.protocol!=='https:')continue;
        if(['kick.com','www.kick.com'].includes(host)){if(url.pathname.toLowerCase().includes('/clips/')||url.searchParams.has('clip'))candidates.clips.push(anchor);}
        else if(host==='x.com'||host.endsWith('.x.com')||host==='twitter.com'||host.endsWith('.twitter.com')){candidates.x.push(anchor);candidates.media.push(anchor);}
        else if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be'||host==='tiktok.com'||host.endsWith('.tiktok.com'))candidates.media.push(anchor);
      }catch{}
      candidateIndex.set(anchors,candidates);globalThis.KickRefinedPerf?.count('chat.candidateIndexBuilds');
    }
    return candidates[kind]||anchors;
  }
  function* drainRows(dirty, {maxRows = 24, budgetMs = 4} = {}) {
    const start = performance.now(),experimental=fastChat(),deadline=Math.min(start+(experimental?Math.min(1,budgetMs):budgetMs),chatDeadline??Infinity);let count = 0;
    for (const row of dirty) {
      dirty.delete(row);if(!experimental||row.isConnected!==false){yield row;count++;}
      if (count >= maxRows || performance.now() >= deadline) break;
    }
    globalThis.KickRefinedPerf?.count('chat.rowsProcessed', count);
    globalThis.KickRefinedPerf?.sample('chat.batchMs', performance.now() - start);
  }

  function notify(callback, ...args) {
    if (!callback) return;
    try { callback(...args); }
    catch (error) { queueMicrotask(() => { throw error; }); }
  }

  function dispatchChat(records) {
    globalThis.KickRefinedPerf?.count('dom.chatBatches');
    const subscribers = [...chats], groups = new Map(), indexed = new Map(), nearest = new Map(), descendants = new Map();
    const experimental = fastChat();
    // Features with identical filters share discovery, but own their delivered sets.
    for (const subscriber of subscribers) {
      if (groups.has(subscriber.attributeKey)) continue;
      const rows = new Set();
      for (const record of records) {
        if (record.type === 'attributes' && !subscriber.attributes.has(record.attributeName)) continue;
        let found = indexed.get(record);
        if (!found) {
          found = recordRows(record, nearest, descendants); indexed.set(record, found);
          const changedLinks = record.type === 'attributes' ? record.attributeName === 'href' ||
            record.attributeName === 'data-index' && record.target.hasAttribute?.('data-index') === false : !experimental?
            [...(record.addedNodes || []), ...(record.removedNodes || [])].some(node=>node.nodeType===1):
            [...(record.addedNodes||[])].some(node=>node.nodeType===1&&(node.matches?.('a[href]')||node.querySelector?.('a[href]')))||
            [...(record.removedNodes||[])].some(node=>node.nodeType===1)&&[...found].some(row=>linkIndex.get(row)?.some(anchor=>!row.contains(anchor)||!anchor.hasAttribute('href')));
          if (changedLinks) for (const row of found) linkIndex.delete(row);
        }
        for (const row of found) rows.add(row);
      }
      groups.set(subscriber.attributeKey, rows);
    }
    for (const subscriber of subscribers) {
      if (!chats.has(subscriber)) continue;
      const rows = groups.get(subscriber.attributeKey);
      if (rows.size && subscriber.onRows) notify(subscriber.onRows, new Set(rows));
    }
  }
  const chatObserver = new MutationObserver(dispatchChat);

  function observeChat() {
    const attributes = [...new Set([...chats].flatMap(subscriber => [...subscriber.attributes]))].sort();
    const signature = attributes.join(',');
    if (watchingChat && currentChat && chats.size && signature === chatAttributes) return;
    const pending = chatObserver.takeRecords();
    if (pending.length) dispatchChat(pending);
    chatObserver.disconnect();
    watchingChat = false;
    chatAttributes = signature;
    if (currentChat && chats.size) {
      chatObserver.observe(currentChat, {
        childList: true, subtree: true,
        ...(attributes.length ? {attributes: true, attributeFilter: attributes} : {})
      });
      watchingChat = true;
    }
  }

  function discoverChat() {
    const next = chats.size ? document.getElementById('chatroom-messages') : null;
    if (next === currentChat) return;
    // Discard queued records for the old container; subscribers release its rows.
    chatObserver.disconnect();
    watchingChat = false;
    currentChat = next;linkIndex=new WeakMap();candidateIndex=new WeakMap();
    observeChat();
    for (const subscriber of [...chats]) {
      if (chats.has(subscriber)) notify(subscriber.onContainer, currentChat);
    }
  }

  function dispatchPage(records) {
    globalThis.KickRefinedPerf?.count('dom.pageBatches');
    // Chat messages must never trigger document-wide feature refreshes.
    const relevant = records.filter(record => {
      if (record.type === 'attributes' && record.attributeName === 'id') return true;
      if (currentChat && (record.target === currentChat || currentChat.contains(record.target))) return false;
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      return !target?.closest?.('#chatroom-messages');
    });
    if (!relevant.length) return;
    discoverChat();
    for (const subscriber of [...pages]) {
      if (!pages.has(subscriber)) continue;
      const changes = subscriber.characterData ? relevant : relevant.filter(record => record.type !== 'characterData');
      if (changes.length) notify(subscriber.callback, changes);
    }
  }
  const pageObserver = new MutationObserver(dispatchPage);

  function observePage() {
    const characters = [...pages].some(subscriber => subscriber.characterData);
    if (!pages.size && !chats.size) {
      pageObserver.disconnect();
      watchingPage = false;
      discoverChat();
      return;
    }
    if (!watchingPage || characters !== pageCharacters) {
      const pending = pageObserver.takeRecords();
      if (pending.length) dispatchPage(pending);
      pageObserver.disconnect();
      pageObserver.observe(document, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['id', 'data-kr-enabled'], characterData: characters
      });
      watchingPage = true;
      pageCharacters = characters;
    }
    discoverChat();
    observeChat();
  }

  function subscribePage(callback, {characterData = false} = {}) {
    const subscriber = {callback, characterData};
    pages.add(subscriber);
    observePage();
    return () => { pages.delete(subscriber); observePage(); };
  }

  function subscribeChat({onContainer, onRows, attributes = ['href', 'data-index']}) {
    const filter = new Set(attributes);
    const subscriber = {onContainer, onRows, attributes: filter, attributeKey: JSON.stringify([...filter].sort())};
    let disposed = false;
    return {
      setEnabled(enabled) {
        if (disposed || chats.has(subscriber) === !!enabled) return;
        if (enabled) {
          const previous = currentChat;
          chats.add(subscriber);
          observePage();
          // A container change already notified all active subscribers.
          if (previous === currentChat) notify(onContainer, currentChat);
        } else {
          chats.delete(subscriber);
          notify(onContainer, null);
          observePage();
        }
      },
      destroy() {
        if (disposed) return;
        this.setEnabled(false);
        disposed = true;
      }
    };
  }

  function isReady(node){
    return !!node?.isConnected&&node.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true}));
  }
  globalThis.KickRefinedDOM = Object.freeze({subscribePage, subscribeChat, links, drainRows, deferChatWork, cancelChatWork, isReady, get chat() { return currentChat; }});
})();
