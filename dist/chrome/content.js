(() => {
  if(window!==window.top&&/^kick-refined-(?:full|clip):[a-z0-9_]{1,40}$/.test(window.name))return;
  const { api, normalize, channelSlug } = KickRefined;
  if (/^\/popout\/[^/]+\/chat\/?$/.test(location.pathname)) return;
  if (!api?.storage || document.getElementById('kr-root')) return;
  let root = document.documentElement;
  let settings = normalize();
  let host, shadow, settingsDialog, palette, updateForm, sidebar, multi, clips, clipBridge, clipStudio, xPosts, mediaCards, replyPreviews, notices, support, channelPanel, checkouts;
  let channels = [], shown = [], selected = 0;
  const searchService=KickRefinedSearch.create();let searchQuery=KickRefinedSearch.parse(''),searchRows=[],searchBusy=false,searchError='',searchWarning='',searchMore=false,searchLoaded=0,searchTimer=0,searchRevision=0,searchRenderKey='';
  let refreshTimer, writeTimer, routeTimer, routeTimeout, previousFocus;
  let dockPosition = '';
  let channelPage=null;const discovery=globalThis.KickRefinedDiscovery?.create();
  let searchWindow=null,nativeSearch=null,restoringSearchFocus=false;
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
    globalThis.KickRefinedPerf?.configure(settings.enabled&&settings.diagnostics);
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
    discovery?.refresh(settings.enabled);channelPanel?.setEnabled(settings.enabled);channelPage?.refresh(settings.enabled);
    checkouts?.setEnabled(settings.enabled);
    if(drag?.kind==='clip'&&(!settings.chatClips||settings.textOnly))endDrag();
    nativeSearch?.refresh(settings.enabled);
    clipStudio?.setEnabled(settings.enabled);
    if (!settings.enabled) { endDrag(); clipStudio?.close(); multi?.close();if(palette?.open)closeSearch(); }
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
        <div class="search-window-bar" tabindex="0" aria-label="Move search window" title="Drag to move · Arrow keys move · Double-click to center"><span class="search-window-title">Search Kick</span><span class="window-grip" aria-hidden="true">⠿</span><button id="search-center" title="Center and reset size" aria-label="Reset search window">↺</button><button class="close" aria-label="Close channel switcher">×</button></div>
        <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="channel-search" type="search" placeholder="Find a channel, clip or recording…" aria-label="Search Kick" role="combobox" aria-autocomplete="list" aria-controls="channel-results" aria-describedby="search-status" aria-expanded="true" autocomplete="off"><kbd>Alt K</kbd></div>
        <div class="search-tools"><div class="search-types" role="group" aria-label="Search type"><button data-search-type="channels" aria-pressed="true">Channels</button><button data-search-type="clips" aria-pressed="false">Clips</button><button data-search-type="vods" aria-pressed="false">VODs</button></div></div>
        <div class="search-media-filters" hidden><label>Channel<input id="search-scope" aria-label="Search channel" placeholder="Channel name" autocomplete="off" spellcheck="false"></label><label>Posted<select id="search-time" aria-label="Search time"><option value="all">Any time</option><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option></select></label></div>
        <div class="search-sort"><label>Sort<select id="search-sort" aria-label="Search sort"><option value="recent">Relevance</option><option value="views">Most viewed</option></select></label><details class="search-guide"><summary title="Search filters" aria-label="Search filters">?</summary><div><p><code>clips:cobbruvs sort:views</code><br><code>vods:xqc "road trip"</code><br><code>clips:cobbruvs,xqc time:week views:&gt;100</code></p><p>Combine <code>channel:</code>, <code>category:"Just Chatting"</code>, <code>after:2026-10-01</code>, <code>before:</code>, <code>creator:</code>, <code>duration:&lt;60</code>, quoted phrases and <code>-words</code>. Channels support <code>live:true</code>. Sort by <code>recent</code> or <code>views</code>.</p></div></details></div>
        <div id="search-status" class="search-status" role="status" aria-live="polite"></div>
        <div class="results" id="channel-results" role="listbox" aria-label="Search results"></div><button id="search-more" class="search-more" hidden>Load more clips</button>
        <div class="footer"><span id="result-count"></span></div><div class="search-resize" tabindex="0" role="button" aria-label="Resize search window" title="Drag to resize · Arrow keys adjust"></div>
      </dialog>`;
    shadow.append(ui);
    const multiButton = document.createElement('button');
    multiButton.className = 'multi-button'; multiButton.setAttribute('aria-label', 'Open multiview'); multiButton.dataset.tip = 'Multiview';
    multiButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
    shadow.querySelector('#kr-switch').before(multiButton);
    multiButton.addEventListener('click', () => openMulti());
    const settingsMulti = document.createElement('button'); settingsMulti.textContent = 'Multiview'; settingsMulti.addEventListener('click', () => openMulti());
    shadow.querySelector('#settings-dialog .footer').append(settingsMulti);
    support = KickRefinedSupport.create({enabled:settings.enabled});
    channelPage=KickRefinedChannelPage.create({onChange:scheduleRefresh,getProfileMount:tab=>channelPanel?.getProfileMount(tab),onKeydown:handleShortcut,onWatch:row=>watchLibraryVideo(row),onDrag:(event,row)=>{
      if(!settings.enabled||!settings.chatClips||settings.textOnly){event.preventDefault();return;}const item=KickRefinedClips.parseClip(row.href)||KickRefinedClips.parseVOD(row.href);if(!item){event.preventDefault();return;}event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/uri-list',item.href);startClipDrag(event,{...item,title:row.title,fromLibrary:true,commit:mode=>watchLibraryVideo(row,mode)});
    }});
    channelPanel = KickRefinedChannelPanel.create({support,enabled:settings.enabled,onChange:scheduleRefresh,integratedProfile:true});
    multi = KickRefinedMulti.create({ getChannels: () => { collectChannels(); return channels; }, onKeydown:handleShortcut, support, channelPanel,onWatchProfileVideo:row=>watchLibraryVideo(row),onClip:slug=>clipStudio?.open(slug) });
    clipStudio=globalThis.KickRefinedClipStudio?.create({getSources:()=>multi.isActive()?multi.clipSources():channelPanel.clipSource?[channelPanel.clipSource]:[],isWorkspace:()=>settings.enabled&&(multi.isActive()||!!channelPanel.clipSource&&!KickRefinedChannelPage.watchSlug()&&!KickRefinedChannelPage.clipSlug()),enabled:settings.enabled});
    clips = KickRefinedClips.create({enabled:settings.enabled&&settings.chatClips&&!settings.textOnly,onWorkspace:(item,mode)=>multi.addClip(item,mode),onWorkspaceDrag:startClipDrag});
    clipBridge=KickRefinedClipBridge.create({getClips:()=>clips,multi,startDrag:startClipDrag,endDrag});
    xPosts=KickRefinedX.create({enabled:settings.enabled&&settings.xEmbeds&&!settings.textOnly});
    mediaCards=KickRefinedMedia.create({media:settings.enabled&&settings.mediaEmbeds&&!settings.textOnly,profiles:settings.enabled&&settings.xEmbeds&&!settings.textOnly});
    replyPreviews=KickRefinedReplies.create({enabled:settings.enabled});
    notices=KickRefinedNotices.create({enabled:settings.enabled});
    checkouts=KickRefinedCheckouts.create({enabled:settings.enabled});
    const localKeydown=event=>{
      if(event.key==='Escape'&&drag){event.preventDefault();endDrag();}
      else if(event.key==='Escape' && (palette?.open || settingsDialog?.open)) { event.preventDefault();palette?.open?closeSearch():settingsDialog.close(); }
      else handleShortcut(event);
      event.stopPropagation();
    };
    shadow.addEventListener('keydown',localKeydown);shadow.addEventListener('kick-refined-keydown',localKeydown);
    for(const type of ['keyup','keypress'])shadow.addEventListener(type,event=>event.stopPropagation());
    settingsDialog = shadow.querySelector('#settings-dialog');
    palette = shadow.querySelector('#switch-dialog');
    searchWindow=KickRefinedSearchWindow.create({dialog:palette,handle:palette.querySelector('.search-window-bar'),resize:palette.querySelector('.search-resize'),reset:shadow.querySelector('#search-center')});
    nativeSearch=KickRefinedNativeSearch.create({onOpen:input=>{if(!restoringSearchFocus)openNativeSearch(input);},onInput:input=>{openNativeSearch(input);},onKeydown:(event,input)=>{
      if(event.isComposing)return;
      if(event.key==='Escape'){if(palette.open){event.preventDefault();if(drag)endDrag();else closeSearch();}return;}
      if(!palette.open&&['ArrowDown','ArrowUp'].includes(event.key))openNativeSearch(input);
      if(palette.open)navigateSearch(event);handleShortcut(event);
    },onDetach:()=>{if(palette.open&&searchWindow.mode==='docked')closeSearch();}});
    document.addEventListener('pointerdown',event=>{if(!palette.open||searchWindow.mode!=='docked'||drag)return;const path=event.composedPath();if(!path.includes(palette)&&!path.includes(nativeSearch.input))closeSearch();},{capture:true,signal:abort.signal});

    palette.addEventListener('dragover',event=>{if(!drag)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='none';palette.dataset.cancelDrop='true';});
    palette.addEventListener('dragleave',event=>{if(!palette.contains(event.relatedTarget))delete palette.dataset.cancelDrop;});
    palette.addEventListener('drop',event=>{if(!drag)return;event.preventDefault();event.stopPropagation();endDrag();});
    for(const button of palette.querySelectorAll('[data-search-type]'))button.addEventListener('click',()=>changeSearchFilters({type:button.dataset.searchType}));
    shadow.querySelector('#search-sort').addEventListener('change',event=>changeSearchFilters({sort:event.target.value}));
    shadow.querySelector('#search-time').addEventListener('change',event=>changeSearchFilters({time:event.target.value}));
    shadow.querySelector('#search-scope').addEventListener('change',event=>changeSearchFilters({channels:event.target.value.split(',').map(name=>name.trim().replace(/^@/,''))}));
    const scopeKeydown=event=>{if(event.key==='Enter'){event.preventDefault();changeSearchFilters({channels:event.target.value.split(',').map(name=>name.trim().replace(/^@/,''))});}};
    for(const type of ['keydown','kick-refined-keydown'])shadow.querySelector('#search-scope').addEventListener(type,scopeKeydown);

    updateForm = KickRefinedUI.settingsForm(shadow.querySelector('.settings'), settings, change);
    shadow.querySelector('#kr-settings').addEventListener('click', openSettings);
    shadow.querySelector('#kr-switch').addEventListener('click', openPalette);
    shadow.querySelector('#reset').addEventListener('click', () => change(normalize()));
    shadow.querySelector('#channel-search').addEventListener('input', updateSearch);
    shadow.querySelector('#search-more').addEventListener('click',()=>loadSearch(searchRevision,true));
    shadow.querySelector('#channel-search').addEventListener('keydown',navigateSearch);
    shadow.querySelector('#channel-search').addEventListener('kick-refined-keydown',navigateSearch);
    for (const dialog of [settingsDialog, palette]) {
      dialog.querySelector('.close').addEventListener('click', () => dialog===palette?closeSearch():dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) (dialog===palette?closeSearch():dialog.close()); });
      dialog.addEventListener('close', () => { if(dialog===palette&&!palette.open){clearTimeout(searchTimer);searchService.cancel();searchBusy=false;searchRevision++;nativeSearch.expanded(false);placeToolbar();}if (previousFocus?.isConnected){restoringSearchFocus=true;previousFocus.focus();}restoringSearchFocus=false; });
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
    if (palette.open) closeSearch();
    previousFocus = shadow.activeElement || document.activeElement;
    const chat = !!document.getElementById('chatroom-messages');
    const side = !!document.getElementById('sidebar-wrapper');
    shadow.querySelector('#compat-status').textContent = `${chat ? '● Native chat detected' : '○ Chat not on this page'} · ${side ? 'Sidebar detected' : 'Sidebar unavailable'}`;
    if (!settingsDialog.open) settingsDialog.showModal();
  }

  function closeSearch(){if(!palette?.open)return;restoringSearchFocus=true;nativeSearch.expanded(false);palette.close();}
  function navigateSearch(event){
    if(event.isComposing)return;
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();selected=Math.max(0,Math.min(shown.length-1,selected+(event.key==='ArrowDown'?1:-1)));highlight();}
    else if(event.key==='Enter'){event.preventDefault();if(shown[selected]){if(event.shiftKey)void watchResult(shown[selected]);else go(shown[selected]);}}
  }
  function openPalette() {
    if (settingsDialog.open) settingsDialog.close();
    previousFocus = shadow.activeElement || document.activeElement;
    if(!palette.open){collectChannels();selected=0;shadow.querySelector('#channel-search').value='';updateSearch();palette.show();}
    searchWindow.open();nativeSearch.expanded(false);placeToolbar();shadow.querySelector('#channel-search').focus();
  }
  function openNativeSearch(input){
    if(disposed||!settings.enabled)return;
    if(settingsDialog.open)settingsDialog.close();previousFocus=input;
    const wasOpen=palette.open,field=shadow.querySelector('#channel-search'),changed=field.value!==input.value;field.value=input.value;
    if(!palette.open){collectChannels();palette.show();}
    searchWindow.dock(input);nativeSearch.expanded(true);placeToolbar();
    if(document.activeElement!==input){restoringSearchFocus=true;input.focus({preventScroll:true});restoringSearchFocus=false;}
    if(changed||!wasOpen||!searchRenderKey)updateSearch();else renderResults();
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
      if (!found.has(slug)) found.set(slug, { slug, title: slug, section: 'Pinned', live: 'unknown', image: '', link: null });
    }
    channels = [...found.values()].sort((a, b) => Number(settings.pinned.includes(b.slug)) - Number(settings.pinned.includes(a.slug)));
  }
  function describeChannel(link) {
    const image = link.querySelector('img');
    const following = link.dataset.testid?.includes('following-channel-');
    const recommended = link.dataset.testid?.includes('recommended-channel-');
    const liveMark = link.querySelector('.bg-kick-voltGreen-150,.ring-kick-voltGreen-150,.bg-brand-bg-default,.ring-surface-fg-brand,[data-status="live"]');
    const offline = link.querySelector('[data-ds-icon="Offline"]') || link.dataset.live === 'false' || link.dataset.status === 'offline';
    const live = offline ? 'offline' : liveMark || link.dataset.live === 'true' || link.dataset.status === 'live' || recommended ? 'live' : following && image ? 'offline' : 'unknown';
    const category = link.querySelector('.text-surface-fg-subtle,.sub')?.textContent.trim() || '';
    const viewers = liveMark?.classList.contains('bg-kick-voltGreen-150') ? liveMark.parentElement?.textContent.trim() : '';
    return { title: image?.alt || channelSlug(link.href, location.origin), image: image?.currentSrc || image?.src || '', live, section: following ? 'Following' : recommended ? 'Recommended' : 'Browse', category, viewers };
  }
  function openMulti(channel) {
    if (palette.open) closeSearch();
    if (settingsDialog.open) settingsDialog.close();
    multi.open(channel ? [channel.slug] : [], KickRefinedChannelPage.routeSlug()||channelSlug(location.pathname, location.origin));
  }

  async function watchLibraryVideo(row,mode='alongside'){
    if(!settings.enabled||disposed)return false;
    let item;try{item=clips.importItem({href:row.href,title:row.title,time:0,paused:false,volume:1});const added=await multi.addClip(item,mode);if(!added)item.release();return added;}catch{item?.release();return false;}
  }
  async function watchResult(row){
    if(!row)return;if(row.type==='channel'){openMulti(row);return;}
    let item;try{item=clips.importItem({href:row.href,title:row.title,time:0,paused:false,volume:1});if(await multi.addClip(item,'alongside'))closeSearch();else item.release();}catch{item?.release();const status=shadow.querySelector('#search-status');status.hidden=false;status.textContent='Could not add this video. Try again.';status.dataset.error='true';}
  }

  function changeSearchFilters(patch){
    const q=searchQuery?{...searchQuery,channels:[...searchQuery.channels]}:KickRefinedSearch.parse('');
    if(patch.type&&patch.type!==q.type){q.type=patch.type;q.creator='';if(q.type==='channels'){q.channels=[];q.after=q.before=null;q.duration=null;q.time='all';}else{q.live=null;}}
    Object.assign(q,patch);shadow.querySelector('#channel-search').value=KickRefinedSearch.serialize(q);updateSearch();
  }
  function syncSearchFilters(){
    if(!searchQuery)return;const q=searchQuery,media=q.type!=='channels';
    for(const button of palette.querySelectorAll('[data-search-type]')){const value=String(button.dataset.searchType===q.type);if(button.getAttribute('aria-pressed')!==value)button.setAttribute('aria-pressed',value);}
    const filters=palette.querySelector('.search-media-filters');if(filters.hidden!==!media)filters.hidden=!media;
    // Native select popups preview choices before committing a change. Background
    // renders must not reset that preview or rebuild the open popup's options.
    for(const [id,value]of [['search-scope',q.channels.join(',')],['search-time',q.time],['search-sort',q.sort]]){const field=shadow.querySelector('#'+id);if(shadow.activeElement!==field&&field.value!==value)field.value=value;}
    const option=shadow.querySelector('#search-sort option[value="recent"]'),label=media?'Newest':'Relevance';if(option.textContent!==label)option.textContent=label;
  }
  function updateSearch(){
    nativeSearch?.sync(shadow.querySelector('#channel-search').value);
    shown=[];selected=0;searchRevision++;clearTimeout(searchTimer);searchService.cancel();searchRows=[];searchMore=false;searchLoaded=0;searchError=searchWarning='';
    try{searchQuery=KickRefinedSearch.parse(shadow.querySelector('#channel-search').value,{allowUnscoped:true});}catch(error){searchQuery=null;searchError=error.message;searchBusy=false;renderResults();return;}
    searchBusy=searchQuery.type==='channels'?!!searchQuery.terms.length||!!searchQuery.channels.length:!!searchQuery.channels.length;renderResults();if(searchBusy){const revision=searchRevision;searchTimer=setTimeout(()=>loadSearch(revision),220);}
  }
  async function loadSearch(revision,append=false){
    if(!searchQuery||searchQuery.type!=='channels'&&!searchQuery.channels.length||revision!==searchRevision||!palette.open)return;searchBusy=true;searchError='';renderResults();
    try{const result=await searchService.search(searchQuery,{append});if(revision!==searchRevision||!palette.open)return;searchRows=result.rows;searchMore=result.more;searchLoaded=result.loaded;searchWarning=result.warning||'';}
    catch(error){if(revision!==searchRevision||error.name==='AbortError')return;searchError=error.message||'Kick search is unavailable. Try again.';}
    finally{if(revision===searchRevision&&palette.open){searchBusy=false;renderResults();}}
  }
  function renderResults() {
    if(disposed||drag?.fromSearch)return;
    syncSearchFilters();
    const rows=new Map();if(searchQuery?.type==='channels')for(const channel of channels){const row={type:'channel',key:'channel:'+channel.slug,views:null,...channel};if(KickRefinedSearch.fits(row,searchQuery))rows.set(row.key,row);}
    for(const row of searchRows){const local=rows.get(row.key);rows.set(row.key,{...local,...row,link:local?.link||null,section:local?.section||row.section,image:row.image||local?.image||''});}
    const selectedKey=shown[selected]?.key;shown=(searchQuery?.type==='channels'?KickRefinedSearch.rank([...rows.values()],searchQuery,settings.pinned):[...rows.values()]).slice(0,200);
    const retained=shown.findIndex(row=>row.key===selectedKey);if(retained>=0)selected=retained;
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
      const detail = document.createElement('div'); detail.className = 'channel-detail'; detail.textContent = (channel.type==='channel'?[channel.section,channel.category]:[channel.type==='clip'?'Clip':'VOD',channel.slug,channel.creator?`by ${channel.creator}`:null,channel.category,channel.created?new Date(channel.created).toLocaleDateString():null,channel.duration?KickRefinedSearch.duration(channel.duration):null]).filter(Boolean).join(' · ');
      info.append(name);if(channel.type==='channel'&&channel.streamTitle){const title=document.createElement('div');title.className='result-stream-title';title.textContent=channel.streamTitle;info.append(title);}info.append(detail); option.append(avatar, info);
      if(channel.type!=='channel'&&channel.duration){const clock=document.createElement('span');clock.className='result-duration';clock.textContent=KickRefinedSearch.duration(channel.duration);avatar.append(clock);}
      const status = document.createElement('span'); status.className = 'live-status'; status.dataset.live = channel.live;
      status.textContent = channel.live === 'live' ? Number.isFinite(channel.views)?`Live · ${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(channel.views)}`:channel.viewers && channel.viewers !== 'LIVE' ? `Live · ${channel.viewers}` : 'Live' : channel.live === 'offline' ? 'Offline' : 'Status unavailable'; option.append(status);
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
      empty.textContent = searchBusy?'Searching…':searchError?'':searchQuery?.type==='channels'?'No matching channels.':searchQuery&&!searchQuery.channels.length?`Choose a channel to browse ${searchQuery.type==='vods'?'VODs':'clips'}.`:`No matching ${searchQuery?.type||'results'} loaded.`;
      results.append(empty);
    }
    shadow.querySelector('#result-count').textContent = `${shown.length} ${searchQuery?.type==='vods'?(shown.length===1?'VOD':'VODs'):searchQuery?.type==='clips'?(shown.length===1?'clip':'clips'):(shown.length===1?'channel':'channels')}`;
    const status=shadow.querySelector('#search-status');status.textContent=searchError||searchWarning||(searchBusy?'Searching Kick...':'');status.hidden=!status.textContent;status.dataset.error=String(!!searchError);
    if(searchError&&searchQuery){const retry=document.createElement('button');retry.type='button';retry.className='search-retry';retry.textContent='Retry';retry.addEventListener('click',()=>loadSearch(searchRevision));status.append(retry);}
    const more=shadow.querySelector('#search-more');more.hidden=!searchMore;more.disabled=searchBusy;
    highlight(false);
  }

  function highlight(scroll = true) {
    for (const [index, option] of [...shadow.querySelectorAll('.option')].entries()) option.setAttribute('aria-selected', String(index === selected));
    const input = shadow.querySelector('#channel-search');
    if (shown[selected]) input.setAttribute('aria-activedescendant', `kr-option-${selected}`);
    else input.removeAttribute('aria-activedescendant');
    if (scroll) shadow.querySelector(`#kr-option-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }

  function go(channel) {
    channel=shown.find(row=>row.key===channel.key)||channel;
    if(drag||lastDrop&&performance.now()-lastDrop.time<600&&lastDrop.slug===channel.slug)return;
    closeSearch();
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
  function endDrag({committed=false}={}) {
    const searchDrag=drag?.fromSearch;
    if(drag?.row)delete drag.row.dataset.krDragging;
    drag?.resize?.disconnect();
    cancelAnimationFrame(dragFrame);dragFrame=0;delete root.dataset.krDragging;dragChip?.remove();dragChip=null;drag=null;dropTarget?.remove();dropTarget=null;
    if(palette){delete palette.dataset.dragging;delete palette.dataset.cancelDrop;}
    if(searchDrag&&palette){lastDrop={slug:shown[selected]?.slug,time:performance.now()};if(committed)closeSearch();else{searchRenderKey='';renderResults();}}
  }
  function drawDrag(){
    dragFrame=0;if(!drag||!dropTarget)return;
    // Pointer movement only writes a transform. Re-measure the target when its
    // geometry changes, rather than forcing layout for every dragover event.
    if(drag.measure){
      drag.measure=false;
      const rect=drag.main.getBoundingClientRect(),style=getComputedStyle(drag.main),left=Math.max(0,rect.left+parseFloat(style.paddingLeft||0)),top=Math.max(rect.top+parseFloat(style.paddingTop||0),0);
      drag.libraryBox=drag.library?.getBoundingClientRect();
      Object.assign(dropTarget.style,{left:`${left}px`,top:`${top}px`,width:`${Math.max(0,Math.min(rect.right-parseFloat(style.paddingRight||0),innerWidth)-left)}px`,height:`${Math.max(0,Math.min(rect.bottom,innerHeight)-top)}px`});
    }
    if(dragChip)dragChip.style.transform=`translate3d(${Math.max(8,Math.min(innerWidth-208,drag.x+16))}px,${Math.max(8,Math.min(innerHeight-60,drag.y+16))}px,0)`;
  }
  function resizeDrag(){if(drag){drag.measure=true;if(!dragFrame)dragFrame=requestAnimationFrame(drawDrag);}}
  function trackDrag(event){
    if(!drag)return;if(event.clientX||event.clientY){drag.x=event.clientX;drag.y=event.clientY;}
    drag.preview.dataset.over=String(event.composedPath().includes(dropTarget)&&!overLibrary(event));
    if(!dragFrame)dragFrame=requestAnimationFrame(drawDrag);
  }
  function overLibrary(event){
    if(!drag?.library?.isConnected)return false;
    if(event.composedPath().includes(drag.library))return true;
    const box=drag.libraryBox;
    return !!box&&event.clientX>=box.left&&event.clientX<box.right&&event.clientY>=box.top&&event.clientY<box.bottom;
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
    if(fromSearch){palette.dataset.dragging='true';}
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
      lastDrop={slug:dropped,time:performance.now()};endDrag({committed:allowed});
      if(allowed)multi.drop(dropped,KickRefinedChannelPage.routeSlug()||channelSlug(location.pathname,location.origin));
    });
  }
  function startClipDrag(event,item){
    if(!settings.enabled||!settings.chatClips||settings.textOnly||!(KickRefinedClips.parseClip(item.href)||KickRefinedClips.parseVOD(item.href)))return;
    const main=multi.getDropMain();if(!main)return;
    endDrag();drag={main,kind:'clip',fromSearch:!!item.fromSearch,fromLibrary:!!item.fromLibrary,item,allowed:multi.canAddClip(item.id),measure:true,x:event?.clientX??item.x??0,y:event?.clientY??item.y??0};
    if(item.fromLibrary)drag.library=event?.composedPath().find(node=>node.id==='kr-channel-library');
    if(item.fromSearch){palette.dataset.dragging='true';}
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
    dropTarget.addEventListener('drop',e=>{if(!drag||drag.kind!=='clip')return;e.preventDefault();e.stopPropagation();const mode=e.composedPath().find(node=>node.dataset?.placement)?.dataset.placement||'alongside',allowed=drag.allowed;endDrag({committed:allowed});if(allowed){if(item.commit)item.commit(mode);else void multi.addClip(item,mode);}});
  }
  function checkRoute() {
    if (currentPath === location.pathname) return;
    const priorProfile=KickRefinedChannelPage.routeSlug(currentPath);
    currentPath = location.pathname;
    endDrag();
    if(!priorProfile||priorProfile!==KickRefinedChannelPage.routeSlug())multi?.close({ restorePlayback: false });
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
    globalThis.KickRefinedPerf?.count('page.refreshes');
    if (disposed || !document.body) return;
    root = document.documentElement;
    // A late Next/React document hydration can remove extension-owned attributes.
    if (root.dataset.krEnabled !== String(settings.enabled)) apply();
    checkRoute(); mount(); placeToolbar(); mountSidebar(); updateSidebarRows(); markSearchFields();searchWindow.refresh();
    support.refresh();
    discovery?.refresh(settings.enabled);channelPanel.refresh();channelPage.refresh(settings.enabled);
    multi.refresh();
    if (palette.open) { collectChannels(); renderResults(); }
  }
  function markSearchFields() {
    nativeSearch?.refresh(settings.enabled);
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
  let unsubscribeDOM=()=>{};

  function dispose() {
    clearTimeout(searchTimer);searchService.destroy();
    searchWindow?.destroy();nativeSearch?.destroy();clipStudio?.destroy();
    endDrag(); for (const row of draggableRows.keys()) restoreDraggable(row);
    disposed = true; api.storage.onChanged.removeListener?.(onSettingsChanged); abort.abort(); unsubscribeDOM(); observedSidebar.disconnect(); sidebarObserver.disconnect(); multi?.destroy();
    clipBridge?.destroy();clips?.destroy();xPosts?.destroy();mediaCards?.destroy();replyPreviews?.destroy();notices?.destroy();checkouts?.destroy();discovery?.destroy();channelPage?.destroy();channelPanel?.destroy();support?.destroy();clearTimeout(refreshTimer); clearTimeout(writeTimer); stopTransition();
  }
  function handleShortcut(e) {
    if(e.key==='Escape' && drag) { e.preventDefault();endDrag();return; }
    const editable=e.composedPath().some(el=>el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
    if((e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.code==='KeyK') || (!editable&&(e.ctrlKey||e.metaKey)&&e.code==='KeyK'&&!e.altKey&&!e.shiftKey)) {
      e.preventDefault();palette.open&&searchWindow.mode==='floating'?closeSearch():openPalette();
    }
  }

  function onSettingsChanged(changes,area){
    if(disposed||area!=='local'||!changes.settings)return;
    settings=normalize(changes.settings.newValue);apply();
    if(palette.open){collectChannels();renderResults();}
  }
  async function init() {
    try { settings = normalize((await (globalThis.KickRefinedThemeSettings||api.storage.local.get('settings'))).settings); } catch { /* Extension defaults also work if storage is temporarily unavailable. */ }
    apply(); refresh();
    const sharedMulti = new URL(location.href).searchParams.get('refined-multi');
    if (sharedMulti) {
      const seeds = sharedMulti.split(',').map(s => channelSlug(`/${s}`)).filter(Boolean).slice(0,6);
      const params = new URL(location.href).searchParams;
      if (seeds.length) multi.open([], '', { channels: seeds, layout: params.get('refined-layout'), chat: params.get('refined-chat'), focus: params.get('refined-focus'), chatVisible: params.get('refined-hide-chat') !== '1', focusSize: params.has('immersion-size') ? Number(params.get('immersion-size')) : KickRefined.multiState().focusSize, playerModes:(()=>{try{return JSON.parse(params.get('immersion-players')||'{}');}catch{return {};}})(),playerMode:params.get('immersion-player')==='embed'?'embed':'full',mixAudio: params.get('immersion-mix') === '1', sizes: (()=>{try{return JSON.parse(params.get('immersion-tiles')||'{}');}catch{return {};}})() });
    }
    unsubscribeDOM=KickRefinedDOM.subscribePage(records=>{
      if(records.some(({target})=>target.nodeType!==1||!target.closest('title,[data-kr-unified-row]')))scheduleRefresh();
    });
    document.addEventListener('dragstart', startDrag, { capture:true, signal:abort.signal });
    document.addEventListener('dragover', trackDrag, { capture:true, signal:abort.signal });
    document.addEventListener('dragover',event=>{if(drag?.fromLibrary&&overLibrary(event)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='none';}},{capture:true,signal:abort.signal});
    document.addEventListener('drop',event=>{if(drag?.fromLibrary&&overLibrary(event)){event.preventDefault();event.stopPropagation();endDrag();}},{capture:true,signal:abort.signal});
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
    api.storage.onChanged.addListener(onSettingsChanged);
  }
  function idleInit() {
    const main=document.querySelector('main')||document.body;
    const title=document.querySelector('[data-testid="livestream-title"]');
    if(!KickRefinedDOM.isReady(main)||title&&!KickRefinedDOM.isReady(title)){
      setTimeout(idleInit,100);return;
    }
    if ('requestIdleCallback' in window) requestIdleCallback(init,{timeout:1000});
    else setTimeout(init,0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idleInit, { once: true });
  else idleInit();
})();
