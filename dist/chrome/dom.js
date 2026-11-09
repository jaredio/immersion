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

  function recordRows(record) {
    const rows = new Set();
    const add = node => {
      const element = node.nodeType === 1 ? node : node.parentElement;
      const row = element?.closest?.('[data-index]'); if (row) rows.add(row);
    };
    add(record.target);
    for (const node of record.addedNodes || []) {
      add(node);
      for (const row of node.querySelectorAll?.('[data-index]') || []) rows.add(row);
    }
    return rows;
  }
  function links(row) {
    let anchors = linkIndex.get(row);
    if (!anchors) {
      anchors = [...row.querySelectorAll('a[href]')]; linkIndex.set(row, anchors);
      globalThis.KickRefinedPerf?.count('chat.rowIndexBuilds');
    }
    return anchors;
  }
  function* drainRows(dirty, {maxRows = 24, budgetMs = 4} = {}) {
    const start = performance.now(); let count = 0;
    for (const row of dirty) {
      dirty.delete(row); yield row; count++;
      if (count >= maxRows || performance.now() - start >= budgetMs) break;
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
    const indexed = new Map(records.map(record => [record, recordRows(record)]));
    for (const rows of indexed.values()) for (const row of rows) linkIndex.delete(row);
    for (const subscriber of [...chats]) {
      if (!chats.has(subscriber)) continue;
      const relevant = records.filter(record => record.type !== 'attributes' || subscriber.attributes.has(record.attributeName));
      const rows = new Set(relevant.flatMap(record => [...indexed.get(record)]));
      if (relevant.length) notify(subscriber.onMutations, relevant, {rows});
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
    currentChat = next;linkIndex=new WeakMap();
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

  function subscribeChat({onContainer, onMutations, attributes = ['href', 'data-index']}) {
    const subscriber = {onContainer, onMutations, attributes: new Set(attributes)};
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

  globalThis.KickRefinedDOM = Object.freeze({subscribePage, subscribeChat, links, drainRows, get chat() { return currentChat; }});
})();
