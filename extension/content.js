(() => {
  const { api, normalize, channelSlug } = KickRefined;
  if (/^\/popout\/[^/]+\/chat\/?$/.test(location.pathname)) return;
  if (!api?.storage || document.getElementById('kr-root')) return;
  let root = document.documentElement;
  let settings = normalize();
  let host, shadow, settingsDialog, palette, updateForm, sidebar, multi, clips, clipBridge, xPosts, mediaCards, replyPreviews, notices, support, channelPanel, checkouts;
  let channels = [], shown = [], selected = 0;
  const searchService=KickRefinedSearch.create();let searchQuery=KickRefinedSearch.parse(''),searchRows=[],searchBusy=false,searchError='',searchWarning='',searchMore=false,searchLoaded=0,searchTimer=0,searchRevision=0,searchRenderKey='';
  let refreshTimer, writeTimer, routeTimer, routeTimeout, previousFocus;
  let dockPosition = '';
  let searchBackdrop=null;
  let currentPath = location.pathname;
  let disposed = false;
  let drag = null, dropTarget = null, lastDrop = null, dragChip = null, dragFrame = 0;
  const draggableRows = new Map();
  const abort = new AbortController();
  const sidebarObserver = new MutationObserver(() => scheduleRefresh());
  const observedSidebar = new ResizeObserver(entries => {
    if (host) placeToolbar();
  });

  function apply() {
    root.dataset.krEnabled = String(settings.enabled);
    root.dataset.krPerformance = String(settings.performance);
    root.dataset.krCompact = String(settings.compact);
    root.dataset.krHideRecommended = String(settings.hideRecommended);
    root.dataset.krTextOnly = String(settings.textOnly);
    root.dataset.krAccent = settings.accent;
    root.style.setProperty('--kr-chat-width', `${settings.chatWidth}px`);
    root.style.setProperty('--kr-font-size', `${settings.fontSize}px`);
    if (shadow) {
      shadow.querySelector('.toolbar').classList.toggle('off', !settings.enabled);
      updateForm?.(settings);
    }
    updateSidebarRows();
    clips?.setEnabled(settings.enabled&&settings.chatClips&&!settings.textOnly);
    xPosts?.setEnabled(settings.enabled&&settings.xEmbeds&&!settings.textOnly);
    mediaCards?.setOptions({media:settings.enabled&&settings.mediaEmbeds&&!settings.textOnly,profiles:settings.enabled&&settings.xEmbeds&&!settings.textOnly});
    replyPreviews?.setEnabled(settings.enabled);
    notices?.setEnabled(settings.enabled);
    support?.setEnabled(settings.enabled);
    channelPanel?.setEnabled(settings.enabled);
    checkouts?.setEnabled(settings.enabled);
    if(drag?.kind==='clip'&&(!settings.chatClips||settings.textOnly))endDrag();
    if (!settings.enabled) { endDrag(); multi?.close(); }
  }

  function change(patch) {
    settings = normalize({ ...settings, ...patch });
    apply();
    if (palette?.open) renderResults();
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      api.storage.local.set({ settings }).catch(() => {
        if (shadow) shadow.querySelector('#save-status').textContent = 'Could not save. Reload this tab after updating the extension.';
      });
    }, 100);
  }

  function shadowRoot(element) {
    const result = element.attachShadow({ mode: 'open' });
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = api.runtime.getURL('ui.css');
    result.append(css);
    return result;
  }

  function mount() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'kr-root';
    host.style.cssText = 'position:fixed;z-index:402';
    shadow = shadowRoot(host);
    const ui = document.createElement('div');
    ui.innerHTML = `
      <div class="toolbar"><button id="kr-settings" aria-label="Immersion settings" data-tip="Immersion settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/></svg><span class="label">Immersion</span><span class="dot"></span></button><button id="kr-switch" class="switcher" aria-label="Switch channel" data-tip="Switch channel · Alt+K"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/></svg><kbd class="label">Alt K</kbd></button></div>
      <dialog id="settings-dialog" aria-labelledby="settings-title">
        <div class="header"><div class="mark" aria-hidden="true">i.</div><div><h2 id="settings-title" class="title">Immersion</h2><p class="subtitle">Less noise. More stream.</p></div><button class="close" aria-label="Close settings">×</button></div>
        <div class="settings"></div>
        <div class="status" id="compat-status"></div><div class="notice" id="save-status" role="status"></div>
        <div class="footer"><span>LOCAL SETTINGS · NO TELEMETRY<br>Alt+K to switch channels</span><button id="reset">Reset</button></div>
      </dialog>
      <dialog id="switch-dialog" class="palette search-palette" aria-label="Search Kick">
        <div class="search"><input id="channel-search" type="search" placeholder="Search Kick · clips:channel · vods:channel" aria-label="Search Kick" role="combobox" aria-autocomplete="list" aria-controls="channel-results" aria-describedby="search-status" aria-expanded="true" autocomplete="off"><kbd>ESC</kbd><button class="close" aria-label="Close channel switcher">×</button></div>
        <details class="search-guide"><summary title="Search filters" aria-label="Search filters">?</summary><div><p><code>clips:cobbruvs sort:views</code><br><code>vods:xqc "road trip"</code><br><code>clips:cobbruvs,xqc time:week views:&gt;100</code></p><p>Combine <code>channel:</code>, <code>category:"Just Chatting"</code>, <code>after:2026-10-01</code>, <code>before:</code>, <code>creator:</code>, <code>duration:&lt;60</code>, quoted phrases and <code>-words</code>. Channels support <code>live:true</code>. Sort by <code>recent</code> or <code>views</code>.</p></div></details>
        <div id="search-status" class="search-status" role="status" aria-live="polite"></div>
        <div class="results" id="channel-results" role="listbox" aria-label="Search results"></div><button id="search-more" class="search-more" hidden>Load more clips</button>
        <div class="footer"><span id="result-count"></span><span>↑↓ select · Enter open</span><button id="pin-channel">Pin selected</button></div>
      </dialog>`;
    shadow.append(ui);
    const multiButton = document.createElement('button');
    multiButton.className = 'multi-button'; multiButton.setAttribute('aria-label', 'Open multiview'); multiButton.dataset.tip = 'Multiview';
    multiButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
    shadow.querySelector('#kr-switch').before(multiButton);
    multiButton.addEventListener('click', () => openMulti());
    const settingsMulti = document.createElement('button'); settingsMulti.textContent = 'Multiview'; settingsMulti.addEventListener('click', () => openMulti());
    shadow.querySelector('#settings-dialog .footer').append(settingsMulti);
    const footer = shadow.querySelector('#switch-dialog .footer');
    footer.innerHTML = '<span id="result-count"></span><span class="key-hint">↑↓ select · Enter open</span><div class="actions"><button id="pin-channel">Pin selected</button><button id="add-multi">Add to Multi</button></div>';
    shadow.querySelector('#add-multi').addEventListener('click', () => openMulti(shown[selected]));
    support = KickRefinedSupport.create({enabled:settings.enabled});
    channelPanel = KickRefinedChannelPanel.create({support,enabled:settings.enabled,onChange:scheduleRefresh});
    multi = KickRefinedMulti.create({ getChannels: () => { collectChannels(); return channels; }, onKeydown:handleShortcut, support, channelPanel });
    clips = KickRefinedClips.create({enabled:settings.enabled&&settings.chatClips&&!settings.textOnly,onWorkspace:(item,mode)=>multi.addClip(item,mode),onWorkspaceDrag:startClipDrag});
    clipBridge=KickRefinedClipBridge.create({getClips:()=>clips,multi,startDrag:startClipDrag,endDrag});
    xPosts=KickRefinedX.create({enabled:settings.enabled&&settings.xEmbeds&&!settings.textOnly});
    mediaCards=KickRefinedMedia.create({media:settings.enabled&&settings.mediaEmbeds&&!settings.textOnly,profiles:settings.enabled&&settings.xEmbeds&&!settings.textOnly});
    replyPreviews=KickRefinedReplies.create({enabled:settings.enabled});
    notices=KickRefinedNotices.create({enabled:settings.enabled});
    checkouts=KickRefinedCheckouts.create({enabled:settings.enabled});
    const localKeydown=event=>{
      if(event.key==='Escape' && (palette?.open || settingsDialog?.open)) { event.preventDefault();palette?.open?palette.close():settingsDialog.close(); }
      else if(event.key==='Tab'&&palette?.open){const controls=[...palette.querySelectorAll('input,button,summary,a[href]')].filter(node=>!node.disabled&&node.getClientRects().length);const active=shadow.activeElement;if(event.shiftKey&&active===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&active===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}
      else handleShortcut(event);
      event.stopPropagation();
    };
    shadow.addEventListener('keydown',localKeydown);shadow.addEventListener('kick-refined-keydown',localKeydown);
    for(const type of ['keyup','keypress'])shadow.addEventListener(type,event=>event.stopPropagation());
    settingsDialog = shadow.querySelector('#settings-dialog');
    palette = shadow.querySelector('#switch-dialog');
    updateForm = KickRefinedUI.settingsForm(shadow.querySelector('.settings'), settings, change);
    shadow.querySelector('#kr-settings').addEventListener('click', openSettings);
    shadow.querySelector('#kr-switch').addEventListener('click', openPalette);
    shadow.querySelector('#reset').addEventListener('click', () => change(normalize()));
    shadow.querySelector('#pin-channel').addEventListener('click', togglePin);
    shadow.querySelector('#channel-search').addEventListener('input', updateSearch);
    shadow.querySelector('#search-more').addEventListener('click',()=>loadSearch(searchRevision,true));
    const searchKeydown=event=>{
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        selected = Math.max(0, Math.min(shown.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1)));
        highlight();
      } else if (event.key === 'Enter' && shown[selected]) { event.preventDefault(); go(shown[selected]); }
    };
    shadow.querySelector('#channel-search').addEventListener('keydown',searchKeydown);
    shadow.querySelector('#channel-search').addEventListener('kick-refined-keydown',searchKeydown);
    for (const dialog of [settingsDialog, palette]) {
      dialog.querySelector('.close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
      dialog.addEventListener('close', () => { if(dialog===palette){clearTimeout(searchTimer);searchService.cancel();searchBusy=false;searchRevision++;searchBackdrop?.remove();searchBackdrop=null;placeToolbar();}if (previousFocus?.isConnected) previousFocus.focus(); });
    }
    placeToolbar();
  }

  function placeToolbar() {
    // Never insert controls into Kick's account/search navigation. Keep dialogs on
    // the body so a collapsed sidebar or theatre mode cannot hide the top layer.
    if (host.parentElement !== document.body) document.body.append(host);
    const side = document.getElementById('sidebar-wrapper');
    const rect = side?.getBoundingClientRect();
    const visible = rect && rect.width > 0 && rect.height > 0 && getComputedStyle(side).visibility !== 'hidden';
    host.dataset.placement = visible ? 'sidebar' : 'edge';
    host.dataset.compact = String(visible && rect.width < 160);
      const level=palette?.open?'2147483000':'402';
      const position = visible
        ? `position:fixed;z-index:${level};left:${rect.left}px;bottom:${Math.max(0, innerHeight - rect.bottom)}px;width:${rect.width}px`
        : `position:fixed;z-index:${level};left:0;top:45%;width:30px`;
    if (dockPosition !== position) { host.style.cssText = position; dockPosition = position; }
  }

  function openSettings() {
    if (palette.open) palette.close();
    previousFocus = shadow.activeElement || document.activeElement;
    const chat = !!document.getElementById('chatroom-messages');
    const side = !!document.getElementById('sidebar-wrapper');
    shadow.querySelector('#compat-status').textContent = `${chat ? '● Native chat detected' : '○ Chat not on this page'} · ${side ? 'Sidebar detected' : 'Sidebar unavailable'}`;
    if (!settingsDialog.open) settingsDialog.showModal();
  }

  function openPalette() {
    if (settingsDialog.open) settingsDialog.close();
    previousFocus = shadow.activeElement || document.activeElement;
    collectChannels(); selected = 0;
    shadow.querySelector('#channel-search').value = '';
    updateSearch();
    if (!palette.open) {searchBackdrop=document.createElement('div');searchBackdrop.id='kr-search-backdrop';searchBackdrop.setAttribute('aria-hidden','true');searchBackdrop.style.cssText='position:fixed;inset:0;z-index:2147482999;background:#0008';searchBackdrop.addEventListener('click',()=>palette.close());document.body.append(searchBackdrop);palette.show();placeToolbar();}
    shadow.querySelector('#channel-search').focus();
  }

  function collectChannels() {
    const found = new Map();
    for (const link of document.querySelectorAll('#sidebar-wrapper a[data-testid*="-channel-"],a[data-card-link]')) {
      const slug = channelSlug(link.href, location.origin);
      if (!slug || found.has(slug)) continue;
      const details = describeChannel(link);
      found.set(slug, { slug, ...details, link });
    }
    for (const slug of settings.pinned) {
      if (!found.has(slug)) found.set(slug, { slug, title: slug, section: 'Saved · opens a full page', live: 'unknown', image: '', link: null });
    }
    channels = [...found.values()].sort((a, b) => Number(settings.pinned.includes(b.slug)) - Number(settings.pinned.includes(a.slug)));
  }
  function describeChannel(link) {
    const image = link.querySelector('img');
    const following = link.dataset.testid?.includes('following-channel-');
    const recommended = link.dataset.testid?.includes('recommended-channel-');
    const liveMark = link.querySelector('.bg-kick-voltGreen-150,.ring-kick-voltGreen-150,.bg-brand-bg-default,[data-status="live"]');
    const offline = link.querySelector('[data-ds-icon="Offline"]') || link.dataset.live === 'false' || link.dataset.status === 'offline';
    const live = offline ? 'offline' : liveMark || link.dataset.live === 'true' || recommended ? 'live' : following && image ? 'offline' : 'unknown';
    const category = link.querySelector('.text-surface-fg-subtle,.sub')?.textContent.trim() || '';
    const viewers = liveMark?.classList.contains('bg-kick-voltGreen-150') ? liveMark.parentElement?.textContent.trim() : '';
    return { title: image?.alt || channelSlug(link.href, location.origin), image: image?.currentSrc || image?.src || '', live, section: following ? 'Following' : recommended ? 'Recommended' : 'Browse', category, viewers };
  }
  function openMulti(channel) {
    if (palette.open) palette.close();
    if (settingsDialog.open) settingsDialog.close();
    multi.open(channel ? [channel.slug] : [], channelSlug(location.pathname, location.origin));
  }

  function updateSearch(){
    selected=0;searchRevision++;clearTimeout(searchTimer);searchService.cancel();searchRows=[];searchMore=false;searchLoaded=0;searchError=searchWarning='';
    try{searchQuery=KickRefinedSearch.parse(shadow.querySelector('#channel-search').value);}catch(error){searchQuery=null;searchError=error.message;searchBusy=false;renderResults();return;}
    searchBusy=searchQuery.type!=='channels'||!!searchQuery.terms.length||!!searchQuery.channels.length;renderResults();if(searchBusy){const revision=searchRevision;searchTimer=setTimeout(()=>loadSearch(revision),220);}
  }
  async function loadSearch(revision,append=false){
    if(!searchQuery||revision!==searchRevision||!palette.open)return;searchBusy=true;searchError='';renderResults();
    try{const result=await searchService.search(searchQuery,{append});if(revision!==searchRevision||!palette.open)return;searchRows=result.rows;searchMore=result.more;searchLoaded=result.loaded;searchWarning=result.warning||'';}
    catch(error){if(revision!==searchRevision||error.name==='AbortError')return;searchError=error.message||'Kick search is unavailable. Try again.';}
    finally{if(revision===searchRevision&&palette.open){searchBusy=false;renderResults();}}
  }
  function renderResults() {
    if(drag?.fromSearch)return;
    const rows=new Map();if(searchQuery?.type==='channels')for(const channel of channels){const row={type:'channel',key:'channel:'+channel.slug,views:null,...channel};if(KickRefinedSearch.fits(row,searchQuery))rows.set(row.key,row);}
    for(const row of searchRows){const local=rows.get(row.key);rows.set(row.key,{...local,...row,link:local?.link||null,section:local?.section||row.section,image:row.image||local?.image||''});}
    shown=[...rows.values()].slice(0,200);
    selected = Math.max(0, Math.min(selected, shown.length - 1));
    const signature=JSON.stringify([shown.map(({link,...row})=>row),searchQuery,searchBusy,searchError,searchWarning,searchMore,searchLoaded,settings.pinned]);if(signature===searchRenderKey){highlight(false);return;}searchRenderKey=signature;
    const results = shadow.querySelector('#channel-results');
    results.replaceChildren();
    for (const [index, channel] of shown.entries()) {
      const option = document.createElement('div');
      option.className = 'option'; option.id = `kr-option-${index}`; option.setAttribute('role', 'option');
      option.dataset.kind=channel.type||'channel';
      option.dataset.live = channel.live;
      const avatar = document.createElement('span'); avatar.className = 'avatar'+(channel.type!=='channel'?' result-thumbnail':'');
      if (channel.image) {
        const photo = document.createElement('img'); photo.src = channel.image; photo.alt = `${channel.title} ${channel.type==='channel'?'profile':'preview'}`; photo.decoding = 'async';photo.loading='lazy';photo.referrerPolicy='no-referrer';photo.draggable=false;
        photo.addEventListener('error', () => { avatar.textContent = channel.title.slice(0, 2); }, { once: true }); avatar.append(photo);
      } else avatar.textContent = channel.title.slice(0, 2);
      const info = document.createElement('div'); info.className = 'channel-info';
      const name = document.createElement('div'); name.className = 'channel-name'; name.textContent = channel.title;
      const detail = document.createElement('div'); detail.className = 'channel-detail'; detail.textContent = (channel.type==='channel'?[channel.section,channel.category]:[channel.type==='clip'?'Clip':'VOD',channel.slug,channel.created?new Date(channel.created).toLocaleDateString():null,channel.duration?KickRefinedSearch.duration(channel.duration):null]).filter(Boolean).join(' · ');
      info.append(name, detail); option.append(avatar, info);
      const status = document.createElement('span'); status.className = 'live-status'; status.dataset.live = channel.live;
      status.textContent = channel.live === 'live' ? channel.viewers && channel.viewers !== 'LIVE' ? `Live · ${channel.viewers}` : 'Live' : channel.live === 'offline' ? 'Offline' : 'Unknown'; option.append(status);
      if(channel.type!=='channel')status.textContent=channel.views===null?'':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(channel.views)+' views';
      if (channel.type==='channel'&&settings.pinned.includes(channel.slug)) { const pin = document.createElement('span'); pin.className = 'pin'; pin.textContent = '★'; option.append(pin); }
      option.addEventListener('pointermove', () => { if (selected !== index) { selected = index; highlight(false); } });
      option.addEventListener('click', () => go(channel));
      if(channel.type==='channel'){option.draggable=true;option.title='Drag into the workspace to watch together';option.addEventListener('dragstart',event=>startChannelDrag(event,channel,option,true));}
      if(channel.type==='clip'||channel.type==='vod'){option.draggable=true;option.title='Drag into the workspace';option.addEventListener('dragstart',event=>{const parsed=KickRefinedClips.parseClip(channel.href)||KickRefinedClips.parseVOD(channel.href);if(!parsed)return;event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/uri-list',parsed.href);startClipDrag(event,{...parsed,title:channel.title,fromSearch:true,commit:async mode=>{let item;try{item=clips.importItem({href:parsed.href,title:channel.title,time:0,paused:false,volume:1});if(!await multi.addClip(item,mode))item.release();}catch{item?.release();}}});});}
      results.append(option);
    }
    if (!shown.length) {
      const empty = document.createElement('p'); empty.className = 'empty';
      empty.textContent = searchBusy?'Searching…':searchError?'':searchQuery?.type==='channels'?'No matching channels.':`No matching ${searchQuery?.type||'results'} loaded.`;
      results.append(empty);
    }
    shadow.querySelector('#result-count').textContent = `${shown.length} ${searchQuery?.type==='vods'?(shown.length===1?'VOD':'VODs'):searchQuery?.type==='clips'?(shown.length===1?'clip':'clips'):(shown.length===1?'channel':'channels')}`;
    const status=shadow.querySelector('#search-status');status.textContent=searchError||searchWarning||(searchBusy?'Searching Kick…':searchQuery?.type!=='channels'&&searchQuery?`${searchLoaded} loaded · Filters apply to loaded results${searchMore?' · Load more to continue':''}.`:'Search any channel · Drag a result to watch together');status.dataset.error=String(!!searchError);
    if(searchError&&searchQuery){const retry=document.createElement('button');retry.type='button';retry.className='search-retry';retry.textContent='Retry';retry.addEventListener('click',()=>loadSearch(searchRevision));status.append(retry);}
    const more=shadow.querySelector('#search-more');more.hidden=!searchMore;more.disabled=searchBusy;
    highlight(false);
  }

  function highlight(scroll = true) {
    for (const [index, option] of [...shadow.querySelectorAll('.option')].entries()) option.setAttribute('aria-selected', String(index === selected));
    const input = shadow.querySelector('#channel-search');
    if (shown[selected]) input.setAttribute('aria-activedescendant', `kr-option-${selected}`);
    else input.removeAttribute('aria-activedescendant');
    const button = shadow.querySelector('#pin-channel');
    button.disabled = shown[selected]?.type!=='channel';
    shadow.querySelector('#add-multi').disabled = shown[selected]?.type!=='channel';
    button.textContent = settings.pinned.includes(shown[selected]?.slug) ? 'Unpin selected' : 'Pin selected';
    if (scroll) shadow.querySelector(`#kr-option-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }

  function togglePin() {
    const channel = shown[selected];
    if (!channel||channel.type!=='channel') return;
    const pinned = settings.pinned.includes(channel.slug) ? settings.pinned.filter(s => s !== channel.slug) : [...settings.pinned, channel.slug];
    change({ pinned });
  }

  function go(channel) {
    channel=shown.find(row=>row.key===channel.key)||channel;
    if(drag||lastDrop&&performance.now()-lastDrop.time<600&&lastDrop.slug===channel.slug)return;
    palette.close();
    multi.close();
    if (channel.link?.isConnected) channel.link.click();
    else location.assign(channel.href||`/${encodeURIComponent(channel.slug)}`);
  }

  function updateSidebarRows() {
    if (!sidebar?.isConnected) return;
    const rows = sidebar.querySelectorAll('a[data-testid*="-channel-"]');
    for (const row of draggableRows.keys()) if (!row.isConnected) draggableRows.delete(row);
    for (const row of rows) {
      if (settings.enabled) {
        if (!draggableRows.has(row)) draggableRows.set(row, { original: row.getAttribute('draggable'), images: [...row.querySelectorAll('img')].map(img => [img, img.getAttribute('draggable')]) });
        if (row.getAttribute('draggable') !== 'true') row.setAttribute('draggable','true');
        for (const img of row.querySelectorAll('img')) if (img.getAttribute('draggable') !== 'false') img.setAttribute('draggable','false');
      } else restoreDraggable(row);
      const slug = channelSlug(row.href, location.origin);
      const pinned = settings.pinned.includes(slug);
      const live = describeChannel(row).live;
      if (row.dataset.krLive !== live) row.dataset.krLive = live;
      if (row.dataset.krPinned !== String(pinned)) row.dataset.krPinned = String(pinned);
      if (row.dataset.testid?.startsWith('sidebar-recommended-channel-')) {
        const section = row.closest('section');
        // Do not hide a mixed container if Kick changes the sidebar structure.
        if (section && !section.querySelector('[data-testid^="sidebar-following-channel-"]')) section.dataset.krSection = 'recommended';
      }
    }
  }

  function mountSidebar() {
    const next = document.getElementById('sidebar-wrapper');
    if (next === sidebar && sidebar?.isConnected) return;
    observedSidebar.disconnect(); sidebarObserver.disconnect(); sidebar = next;
    if (!sidebar) return;
    observedSidebar.observe(sidebar);
    sidebarObserver.observe(sidebar, { subtree: true, attributes: true, attributeFilter: ['src', 'class', 'data-live', 'data-status'] });
  }

  function stopTransition() {
    clearInterval(routeTimer); clearTimeout(routeTimeout);
    shadow?.querySelector('#kr-switch')?.removeAttribute('aria-busy');
    if (shadow) shadow.querySelector('#kr-switch').dataset.tip = 'Switch channel · Alt+K';
  }
  function restoreDraggable(row) {
    const saved=draggableRows.get(row); if(!saved)return;
    if(saved.original===null)row.removeAttribute('draggable');else row.setAttribute('draggable',saved.original);
    for(const [img,value]of saved.images)if(value===null)img.removeAttribute('draggable');else img.setAttribute('draggable',value);
    draggableRows.delete(row);
  }
  function endDrag() {
    const searchDrag=drag?.fromSearch;
    if(drag?.row)delete drag.row.dataset.krDragging;
    drag?.resize?.disconnect();
    cancelAnimationFrame(dragFrame);dragFrame=0;delete root.dataset.krDragging;dragChip?.remove();dragChip=null;drag=null;dropTarget?.remove();dropTarget=null;
    if(searchDrag&&palette){delete palette.dataset.dragging;palette.close();}
  }
  function drawDrag(){
    dragFrame=0;if(!drag||!dropTarget)return;
    // Pointer movement only writes a transform. Re-measure the target when its
    // geometry changes, rather than forcing layout for every dragover event.
    if(drag.measure){
      drag.measure=false;
      const rect=drag.main.getBoundingClientRect(),style=getComputedStyle(drag.main),left=Math.max(0,rect.left+parseFloat(style.paddingLeft||0)),top=Math.max(rect.top+parseFloat(style.paddingTop||0),0);
      Object.assign(dropTarget.style,{left:`${left}px`,top:`${top}px`,width:`${Math.max(0,Math.min(rect.right-parseFloat(style.paddingRight||0),innerWidth)-left)}px`,height:`${Math.max(0,Math.min(rect.bottom,innerHeight)-top)}px`});
    }
    if(dragChip)dragChip.style.transform=`translate3d(${Math.max(8,Math.min(innerWidth-208,drag.x+16))}px,${Math.max(8,Math.min(innerHeight-60,drag.y+16))}px,0)`;
  }
  function resizeDrag(){if(drag){drag.measure=true;if(!dragFrame)dragFrame=requestAnimationFrame(drawDrag);}}
  function trackDrag(event){
    if(!drag)return;if(event.clientX||event.clientY){drag.x=event.clientX;drag.y=event.clientY;}
    drag.preview.dataset.over=String(event.composedPath().includes(dropTarget));
    if(!dragFrame)dragFrame=requestAnimationFrame(drawDrag);
  }
  function startDrag(event) {
    if(!settings.enabled || !event.dataTransfer || !multi)return;
    const row=event.target.closest?.('#sidebar-wrapper a[data-testid*="-channel-"]');
    if(!row)return;
    startChannelDrag(event,{slug:channelSlug(row.href,location.origin),...describeChannel(row)},row,false);
  }
  function startChannelDrag(event,meta,row,fromSearch=false){
    if(!settings.enabled||!event.dataTransfer||!multi)return;const slug=meta.slug,main=multi.getDropMain();
    if(!slug || !main)return;
    endDrag();drag={slug,row,measure:true,fromSearch};row.dataset.krDragging='true';
    if(fromSearch){setTimeout(()=>{if(drag?.row===row&&drag.fromSearch){palette.dataset.dragging='true';if(searchBackdrop)searchBackdrop.style.display='none';}},0);}
    event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-kick-refined-channel',slug);
    const href=`https://kick.com/${slug}`;event.dataTransfer.setData('text/uri-list',href);event.dataTransfer.setData('text/plain',href);
    const preview=multi.dropPreview(slug);if(!preview){endDrag();return;}drag.main=main;drag.allowed=preview.allowed;drag.resize=new ResizeObserver(resizeDrag);drag.resize.observe(main);root.dataset.krDragging='true';
    dropTarget=document.createElement('div');dropTarget.id='kr-multi-drop';dropTarget.setAttribute('role','region');dropTarget.setAttribute('aria-label',preview.element.getAttribute('aria-label'));
    dropTarget.style.cssText='position:fixed;z-index:500;overflow:hidden;background:transparent !important;';
    const sr=shadowRoot(dropTarget);sr.append(preview.element);drag.preview=preview.element;document.body.append(dropTarget);
    dragChip=document.createElement('div');dragChip.id='kr-drag-chip';dragChip.style.cssText='position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;background:transparent !important;';
    const chipRoot=shadowRoot(dragChip),chip=document.createElement('div');chip.className='drag-channel-chip';
    if(meta.image){const image=document.createElement('img');image.src=meta.image;image.alt='';chip.append(image);}
    const words=document.createElement('div'),name=document.createElement('strong');name.textContent=meta.title||slug;words.append(name);chip.append(words);
    const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;canvas.style.cssText='position:fixed;width:1px;height:1px;pointer-events:none';chipRoot.append(chip,canvas);document.body.append(dragChip);
    event.dataTransfer.setDragImage(canvas,0,0);
    drag.x=event.clientX||row.getBoundingClientRect().right;drag.y=event.clientY||row.getBoundingClientRect().top;drawDrag();
    dropTarget.addEventListener('dragover',e=>{if(drag){e.preventDefault();e.dataTransfer.dropEffect=drag.allowed?'copy':'none';}});
    dropTarget.addEventListener('drop',e=>{
      if(!drag)return;e.preventDefault();e.stopPropagation();const dropped=drag.slug,allowed=drag.allowed;
      lastDrop={slug:dropped,time:performance.now()};endDrag();
      if(allowed)multi.drop(dropped,channelSlug(location.pathname,location.origin));
    });
  }
  function startClipDrag(event,item){
    if(!settings.enabled||!settings.chatClips||settings.textOnly||!(KickRefinedClips.parseClip(item.href)||KickRefinedClips.parseVOD(item.href)))return;
    const main=multi.getDropMain();if(!main)return;
    endDrag();drag={main,kind:'clip',fromSearch:!!item.fromSearch,item,allowed:multi.canAddClip(item.id),measure:true,x:event?.clientX??item.x??0,y:event?.clientY??item.y??0};
    if(item.fromSearch)setTimeout(()=>{if(drag?.item===item){palette.dataset.dragging='true';if(searchBackdrop)searchBackdrop.style.display='none';}},0);
    drag.resize=new ResizeObserver(resizeDrag);drag.resize.observe(main);root.dataset.krDragging='true';
    dropTarget=document.createElement('div');dropTarget.id='kr-multi-drop';dropTarget.setAttribute('role','region');dropTarget.setAttribute('aria-label','Drop clip into workspace');dropTarget.style.cssText='position:fixed;z-index:500;overflow:hidden;background:transparent !important;';
    const preview=document.createElement('div');preview.className='stream-drop-zone clip-drop-targets';preview.dataset.allowed=String(drag.allowed);drag.preview=preview;
    for(const [mode,label]of [['alongside','Watch alongside'],['featured','Watch featured']]){
      const zone=document.createElement('div');zone.className='clip-drop-choice';zone.dataset.placement=mode;zone.setAttribute('aria-label',label);preview.append(zone);
      zone.addEventListener('dragover',e=>{e.preventDefault();if(!drag)return;e.dataTransfer.dropEffect=drag.allowed?'copy':'none';for(const choice of preview.children)choice.dataset.active=String(choice===zone);});
    }
    shadowRoot(dropTarget).append(preview);document.body.append(dropTarget);
    dragChip=document.createElement('div');dragChip.id='kr-drag-chip';dragChip.style.cssText='position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;background:transparent !important;';
    const chipRoot=shadowRoot(dragChip),chip=document.createElement('div');chip.className='drag-channel-chip';const words=document.createElement('div'),name=document.createElement('strong');name.textContent=item.title||'Kick clip';words.append(name);chip.append(words);chipRoot.append(chip);
    const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;chipRoot.append(canvas);canvas.style.cssText='position:absolute;width:1px;height:1px;opacity:0';document.body.append(dragChip);event?.dataTransfer?.setDragImage(canvas,0,0);drawDrag();
    dropTarget.addEventListener('dragover',e=>{e.preventDefault();if(drag)e.dataTransfer.dropEffect=drag.allowed?'copy':'none';});
    dropTarget.addEventListener('drop',e=>{if(!drag||drag.kind!=='clip')return;e.preventDefault();e.stopPropagation();const mode=e.composedPath().find(node=>node.dataset?.placement)?.dataset.placement||'alongside',allowed=drag.allowed;endDrag();if(allowed){if(item.commit)item.commit(mode);else void multi.addClip(item,mode);}});
  }
  function checkRoute() {
    if (currentPath === location.pathname) return;
    currentPath = location.pathname;
    endDrag(); multi?.close({ restorePlayback: false });
    stopTransition();
    scheduleRefresh();
  }
  function trackNavigation(event) {
    if (!settings.enabled || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const slug = channelSlug(link.href, location.origin);
    if (!slug || link.pathname === location.pathname) return;
    stopTransition();
    shadow?.querySelector('#kr-switch')?.setAttribute('aria-busy', 'true');
    if (shadow) shadow.querySelector('#kr-switch').dataset.tip = `Opening ${slug}…`;
    // Feedback only. Never preventDefault, replace the router or delay playback.
    routeTimer = setInterval(checkRoute, 150);
    routeTimeout = setTimeout(stopTransition, 10000);
  }

  function refresh() {
    refreshTimer = null;
    if (disposed || !document.body) return;
    root = document.documentElement;
    // A late Next/React document hydration can remove extension-owned attributes.
    if (root.dataset.krEnabled !== String(settings.enabled)) apply();
    checkRoute(); mount(); placeToolbar(); mountSidebar(); updateSidebarRows(); markSearchFields();
    support.refresh();
    channelPanel.refresh();
    multi.refresh();
    if (palette.open) { collectChannels(); renderResults(); }
  }
  function markSearchFields() {
    for (const input of document.querySelectorAll('input[data-testid="search"],nav input[type="search"],nav input[aria-label*="Search"]')) {
      let field = input.parentElement;
      for (let depth = 0; field && depth < 3; depth++, field = field.parentElement) {
        if (field.tagName === 'NAV' || field.tagName === 'FORM') break;
        if (field.classList.contains('border') || field.classList.contains('border-2') || field.querySelector('svg') || field === input.parentElement && !field.querySelectorAll('input')[1]) {
          field.dataset.krSearchField = '';
          break;
        }
      }
    }
  }
  function scheduleRefresh() {
    if (!refreshTimer && !disposed) refreshTimer = setTimeout(refresh, 180);
  }
  const observer = new MutationObserver(records => {
    // Chat is high traffic and already virtualized. Never scan it on message arrival.
    for (const record of records) {
      if (record.target.nodeType === 1 && record.target.closest?.('#chatroom-messages')) continue;
      scheduleRefresh(); break;
    }
  });

  function dispose() {
    clearTimeout(searchTimer);searchService.destroy();
    searchBackdrop?.remove();searchBackdrop=null;
    endDrag(); for (const row of draggableRows.keys()) restoreDraggable(row);
    disposed = true; abort.abort(); observer.disconnect(); observedSidebar.disconnect(); sidebarObserver.disconnect(); multi?.destroy();
    clipBridge?.destroy();clips?.destroy();xPosts?.destroy();mediaCards?.destroy();replyPreviews?.destroy();notices?.destroy();checkouts?.destroy();channelPanel?.destroy();support?.destroy();clearTimeout(refreshTimer); clearTimeout(writeTimer); stopTransition();
  }
  function handleShortcut(e) {
    if(e.key==='Escape' && drag) { e.preventDefault();endDrag();return; }
    const editable=e.composedPath().some(el=>el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
    if((e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.code==='KeyK') || (!editable&&(e.ctrlKey||e.metaKey)&&e.code==='KeyK'&&!e.altKey&&!e.shiftKey)) {
      e.preventDefault();palette.open?palette.close():openPalette();
    }
  }

  async function init() {
    try { settings = normalize((await api.storage.local.get('settings')).settings); } catch { /* Extension defaults also work if storage is temporarily unavailable. */ }
    apply(); refresh();
    const sharedMulti = new URL(location.href).searchParams.get('refined-multi');
    if (sharedMulti) {
      const seeds = sharedMulti.split(',').map(s => channelSlug(`/${s}`)).filter(Boolean).slice(0,6);
      const params = new URL(location.href).searchParams;
      if (seeds.length) multi.open([], '', { channels: seeds, layout: params.get('refined-layout'), chat: params.get('refined-chat'), focus: params.get('refined-focus'), chatVisible: params.get('refined-hide-chat') !== '1', focusSize: params.has('immersion-size') ? Number(params.get('immersion-size')) : 67, mixAudio: params.get('immersion-mix') === '1', sizes: (()=>{try{return JSON.parse(params.get('immersion-tiles')||'{}');}catch{return {};}})() });
    }
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-kr-enabled'] });
    document.addEventListener('dragstart', startDrag, { capture:true, signal:abort.signal });
    document.addEventListener('dragover', trackDrag, { capture:true, signal:abort.signal });
    document.addEventListener('dragend', endDrag, { capture:true, signal:abort.signal });
    window.addEventListener('scroll',resizeDrag,{capture:true,passive:true,signal:abort.signal});
    window.addEventListener('resize',resizeDrag,{passive:true,signal:abort.signal});
    window.addEventListener('blur', endDrag, { signal:abort.signal });
    document.addEventListener('click', event => {
      const row=event.target.closest?.('#sidebar-wrapper a[data-testid*="-channel-"]');
      if (lastDrop && performance.now()-lastDrop.time<600 && row && channelSlug(row.href,location.origin)===lastDrop.slug) {
        event.preventDefault(); event.stopImmediatePropagation(); lastDrop=null;
      }
    }, { capture:true, signal:abort.signal });
    document.addEventListener('click', trackNavigation, { capture:true, signal:abort.signal });
    document.addEventListener('keydown',handleShortcut,{signal:abort.signal});
    window.addEventListener('popstate', checkRoute, { signal: abort.signal });
    window.addEventListener('resize', scheduleRefresh, { passive: true, signal: abort.signal });
    window.addEventListener('pagehide', e => { if (!e.persisted) dispose(); }, { signal: abort.signal });
    api.storage.onChanged.addListener((changes, area) => {
      if (disposed || area !== 'local' || !changes.settings) return;
      settings = normalize(changes.settings.newValue); apply();
      if (palette.open) { collectChannels(); renderResults(); }
    });
  }
  function idleInit() {
    // Avoid modifying the server-rendered tree during Kick's initial hydration.
    if ('requestIdleCallback' in window) requestIdleCallback(init, { timeout: 1800 });
    else setTimeout(init, 100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idleInit, { once: true });
  else idleInit();
})();
