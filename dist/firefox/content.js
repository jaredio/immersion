(() => {
  const { api, normalize, channelSlug } = KickRefined;
  if (/^\/popout\/[^/]+\/chat\/?$/.test(location.pathname)) return;
  if (!api?.storage || document.getElementById('kr-root')) return;
  let root = document.documentElement;
  let settings = normalize();
  let host, shadow, settingsDialog, palette, updateForm, sidebar, multi, clips, clipBridge;
  let channels = [], shown = [], selected = 0;
  let refreshTimer, writeTimer, routeTimer, routeTimeout, previousFocus;
  let dockPosition = '';
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
      <dialog id="switch-dialog" class="palette" aria-labelledby="switch-title">
        <div class="header"><div><h2 class="title" id="switch-title">Jump into a stream</h2><p class="subtitle">Your sidebar channels, one shortcut away.</p></div><button class="close" aria-label="Close channel switcher">×</button></div>
        <div class="search"><input id="channel-search" type="search" placeholder="Find a channel…" aria-label="Find a channel" role="combobox" aria-autocomplete="list" aria-controls="channel-results" aria-expanded="true" autocomplete="off"><kbd>ESC</kbd></div>
        <div class="results" id="channel-results" role="listbox" aria-label="Channels"></div>
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
    multi = KickRefinedMulti.create({ getChannels: () => { collectChannels(); return channels; }, onKeydown:handleShortcut });
    clips = KickRefinedClips.create({enabled:settings.enabled&&settings.chatClips&&!settings.textOnly,onWorkspace:(item,mode)=>multi.addClip(item,mode),onWorkspaceDrag:startClipDrag});
    clipBridge=KickRefinedClipBridge.create({getClips:()=>clips,multi,startDrag:startClipDrag,endDrag});
    const localKeydown=event=>{
      if(event.key==='Escape' && (palette?.open || settingsDialog?.open)) { event.preventDefault();palette?.open?palette.close():settingsDialog.close(); }
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
    shadow.querySelector('#channel-search').addEventListener('input', () => { selected = 0; renderResults(); });
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
      dialog.addEventListener('close', () => { if (previousFocus?.isConnected) previousFocus.focus(); });
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
    const position = visible
      ? `position:fixed;z-index:402;left:${rect.left}px;bottom:${Math.max(0, innerHeight - rect.bottom)}px;width:${rect.width}px`
      : 'position:fixed;z-index:402;left:0;top:45%;width:30px';
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
    renderResults();
    if (!palette.open) palette.showModal();
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

  function renderResults() {
    const term = shadow.querySelector('#channel-search').value.toLowerCase().trim();
    shown = channels.filter(c => `${c.title} ${c.slug}`.toLowerCase().includes(term)).slice(0, 60);
    selected = Math.max(0, Math.min(selected, shown.length - 1));
    const results = shadow.querySelector('#channel-results');
    results.replaceChildren();
    for (const [index, channel] of shown.entries()) {
      const option = document.createElement('div');
      option.className = 'option'; option.id = `kr-option-${index}`; option.setAttribute('role', 'option');
      option.dataset.live = channel.live;
      const avatar = document.createElement('span'); avatar.className = 'avatar';
      if (channel.image) {
        const photo = document.createElement('img'); photo.src = channel.image; photo.alt = `${channel.title} profile`; photo.decoding = 'async';
        photo.addEventListener('error', () => { avatar.textContent = channel.title.slice(0, 2); }, { once: true }); avatar.append(photo);
      } else avatar.textContent = channel.title.slice(0, 2);
      const info = document.createElement('div'); info.className = 'channel-info';
      const name = document.createElement('div'); name.className = 'channel-name'; name.textContent = channel.title;
      const detail = document.createElement('div'); detail.className = 'channel-detail'; detail.textContent = [channel.section, channel.category].filter(Boolean).join(' · ');
      info.append(name, detail); option.append(avatar, info);
      const status = document.createElement('span'); status.className = 'live-status'; status.dataset.live = channel.live;
      status.textContent = channel.live === 'live' ? channel.viewers && channel.viewers !== 'LIVE' ? `Live · ${channel.viewers}` : 'Live' : channel.live === 'offline' ? 'Offline' : 'Unknown'; option.append(status);
      if (settings.pinned.includes(channel.slug)) { const pin = document.createElement('span'); pin.className = 'pin'; pin.textContent = '★'; option.append(pin); }
      option.addEventListener('pointermove', () => { if (selected !== index) { selected = index; highlight(false); } });
      option.addEventListener('click', () => go(channel));
      results.append(option);
    }
    if (!shown.length) {
      const empty = document.createElement('p'); empty.className = 'empty';
      empty.textContent = channels.length ? 'No matching channels.' : 'Channels appear here when Kick loads your sidebar. Sign in to see your follows.';
      results.append(empty);
    }
    shadow.querySelector('#result-count').textContent = `${shown.length} channels`;
    highlight(false);
  }

  function highlight(scroll = true) {
    for (const [index, option] of [...shadow.querySelectorAll('.option')].entries()) option.setAttribute('aria-selected', String(index === selected));
    const input = shadow.querySelector('#channel-search');
    if (shown[selected]) input.setAttribute('aria-activedescendant', `kr-option-${selected}`);
    else input.removeAttribute('aria-activedescendant');
    const button = shadow.querySelector('#pin-channel');
    button.disabled = !shown[selected];
    shadow.querySelector('#add-multi').disabled = !shown[selected];
    button.textContent = settings.pinned.includes(shown[selected]?.slug) ? 'Unpin selected' : 'Pin selected';
    if (scroll) shadow.querySelector(`#kr-option-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }

  function togglePin() {
    const channel = shown[selected];
    if (!channel) return;
    const pinned = settings.pinned.includes(channel.slug) ? settings.pinned.filter(s => s !== channel.slug) : [...settings.pinned, channel.slug];
    change({ pinned });
  }

  function go(channel) {
    palette.close();
    multi.close();
    if (channel.link?.isConnected) channel.link.click();
    else location.assign(`/${encodeURIComponent(channel.slug)}`);
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
    if(drag?.row)delete drag.row.dataset.krDragging;
    drag?.resize?.disconnect();
    cancelAnimationFrame(dragFrame);dragFrame=0;delete root.dataset.krDragging;dragChip?.remove();dragChip=null;drag=null;dropTarget?.remove();dropTarget=null;
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
    const slug=channelSlug(row.href,location.origin),main=multi.getDropMain();
    if(!slug || !main)return;
    endDrag();drag={slug,row,measure:true};row.dataset.krDragging='true';
    event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-kick-refined-channel',slug);
    event.dataTransfer.setData('text/uri-list',row.href);event.dataTransfer.setData('text/plain',row.href);
    const preview=multi.dropPreview(slug);if(!preview){endDrag();return;}drag.main=main;drag.allowed=preview.allowed;drag.resize=new ResizeObserver(resizeDrag);drag.resize.observe(main);root.dataset.krDragging='true';
    dropTarget=document.createElement('div');dropTarget.id='kr-multi-drop';dropTarget.setAttribute('role','region');dropTarget.setAttribute('aria-label',preview.element.getAttribute('aria-label'));
    dropTarget.style.cssText='position:fixed;z-index:500;overflow:hidden;background:transparent !important;';
    const sr=shadowRoot(dropTarget);sr.append(preview.element);drag.preview=preview.element;document.body.append(dropTarget);
    dragChip=document.createElement('div');dragChip.id='kr-drag-chip';dragChip.style.cssText='position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;background:transparent !important;';
    const chipRoot=shadowRoot(dragChip),chip=document.createElement('div');chip.className='drag-channel-chip';
    const meta=describeChannel(row);if(meta.image){const image=document.createElement('img');image.src=meta.image;image.alt='';chip.append(image);}
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
    if(!settings.enabled||!settings.chatClips||!KickRefinedClips.parseClip(item.href))return;
    const main=multi.getDropMain();if(!main)return;
    endDrag();drag={main,kind:'clip',item,allowed:multi.canAddClip(item.id),measure:true,x:event?.clientX??item.x??0,y:event?.clientY??item.y??0};
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
    endDrag(); for (const row of draggableRows.keys()) restoreDraggable(row);
    disposed = true; abort.abort(); observer.disconnect(); observedSidebar.disconnect(); sidebarObserver.disconnect(); multi?.destroy();
    clipBridge?.destroy();clips?.destroy();clearTimeout(refreshTimer); clearTimeout(writeTimer); stopTransition();
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
