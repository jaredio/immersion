/* Fit Kick's portaled sidebar tooltip around its native preview and title. */
(() => {
  const rowSelector = '#sidebar-wrapper a[data-testid*="-channel-"]';
  const portalSelector = '[data-radix-popper-content-wrapper]';
  const paneSelector = `.z-tooltip, ${portalSelector} > :is([data-state],[data-side]):has([role="tooltip"])`;
  const nativeFrameSelector = ':scope > .w-80 > [class~="pt-0.5"] > .aspect-video.w-full';
  const mediaSelector = ':is(img,video,iframe,canvas):not([role="tooltip"] *)';
  const viewersFormat = new Intl.NumberFormat('en-US');

  function viewerCount(row) {
    const label = row.querySelector('[data-testid*="viewer-count"], :is(.bg-kick-voltGreen-150,.bg-brand-bg-default,.bg-surface-fg-brand) + span, .count');
    const exact = label?.getAttribute('title') || label?.querySelector('[title]')?.title;
    if (/^\d+$/.test(exact || '') && Number.isSafeInteger(Number(exact))) return viewersFormat.format(Number(exact));
    return label?.textContent.trim().match(/^(?:●\s*)?(\d[\d.,]*\s?[KMB]?)(?:\s+viewers?)?$/i)?.[1].trim() || '';
  }

  function caption(pane, media) {
    for (let branch = media; branch !== pane; branch = branch.parentElement) {
      for (let sibling = branch.nextSibling; sibling; sibling = sibling.nextSibling) {
        if (!sibling.textContent.trim()) continue;
        if (sibling.nodeType === 3 || sibling.nodeType === 1 &&
            !sibling.matches('svg,[role="tooltip"],[aria-hidden="true"],[data-kr-sidebar-preview-count]')) return sibling;
      }
    }
    return null;
  }

  function beside(side, box, anchor) {
    return box.width > 0 && box.height > 0 && box.bottom > anchor.top && box.top < anchor.bottom &&
      (side === 'right' && box.left >= anchor.right - 16 || side === 'left' && box.right <= anchor.left + 16);
  }

  function previewFrame(pane) {
    // Kick keeps this frame while the skeleton, thumbnail and video replace one another.
    return pane.querySelector(nativeFrameSelector) || pane.querySelector(mediaSelector);
  }

  function create({signal, enabled, getChannel}) {
    let hover = null, pane = null, media = null, title = null, count = null, countLabel = null, frame = 0;
    let lastLayout = '', stableSince = 0;
    const placementObserver = new MutationObserver(schedule);
    const sizeObserver = new ResizeObserver(schedule);
    function clearPane() {
      placementObserver.disconnect();
      sizeObserver.disconnect();
      pane?.removeAttribute('data-kr-sidebar-preview');
      pane?.removeAttribute('data-kr-sidebar-preview-ready');
      title?.removeAttribute('data-kr-sidebar-preview-title');
      count?.remove();
      pane = media = title = count = countLabel = null;
      lastLayout = '';
    }
    function reset() {
      hover = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      clearPane();
    }
    function findPane(row) {
      const linked = (row.getAttribute('aria-describedby') || '').split(/\s+/);
      for (const id of linked) {
        const candidate = document.getElementById(id)?.closest(paneSelector);
        if (candidate?.matches(':not([data-state="closed"])') && previewFrame(candidate)) return candidate;
      }
      const anchor = row.getBoundingClientRect();
      let pending = null;
      for (const candidate of document.querySelectorAll(paneSelector)) {
        const side = candidate.dataset.side;
        if (candidate.dataset.state === 'closed' || side && !['right', 'left'].includes(side) || !previewFrame(candidate)) continue;
        if (beside(side, candidate.getBoundingClientRect(), anchor)) return candidate;
        pending ||= candidate;
      }
      return pending;
    }
    function revealWhenStable(row) {
      if (pane.hasAttribute('data-kr-sidebar-preview-ready')) return;
      if (pane.getAttribute('aria-busy') === 'true' || media.tagName === 'IMG' && !media.complete) { lastLayout = ''; return; }
      const card = pane.getBoundingClientRect(), preview = media.getBoundingClientRect();
      if (!beside(pane.dataset.side, card, row.getBoundingClientRect()) || !preview.width || !preview.height ||
          preview.left < card.left - .5 || preview.right > card.right + .5 || preview.top < card.top - .5 || preview.bottom > card.bottom + .5) {
        lastLayout = '';
        return;
      }
      // Popper and the caption can update on successive frames while opening.
      const layout = [card.left, card.top, card.width, card.height, preview.width, preview.height].map(value => Math.round(value * 2)).join(':');
      const now = performance.now();
      if (layout !== lastLayout) { lastLayout = layout; stableSince = now; }
      if (now - stableSince < 32) { schedule(); return; }
      pane.dataset.krSidebarPreviewReady = '';
      placementObserver.disconnect();
      sizeObserver.disconnect();
    }
    function refresh() {
      if (!hover) return;
      if (!enabled() || !hover.row.isConnected) { reset(); return; }
      const active = hover, nextPane = findPane(active.row);
      if (!nextPane) { clearPane(); return; }
      const preview = previewFrame(nextPane);
      const heading = (preview.tagName === 'DIV' && preview.parentElement.nextElementSibling?.querySelector('div[title]')) || caption(nextPane, preview);
      const inlineTitle = heading?.nodeType === 3;
      const nextTitle = inlineTitle ? heading.parentElement : heading;
      const titleLayout = inlineTitle ? 'inline' : 'element';
      if (nextPane !== pane || preview !== media || nextTitle !== title || title && title.dataset.krSidebarPreviewTitle !== titleLayout) {
        clearPane();
        pane = nextPane; media = preview; title = nextTitle;
        pane.dataset.krSidebarPreview = '';
        if (title) title.dataset.krSidebarPreviewTitle = titleLayout;
        count = document.createElement('span');
        count.dataset.krSidebarPreviewCount = '';
        count.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/></svg><span></span>';
        countLabel = count.lastElementChild;
        const portal = pane.closest(portalSelector);
        if (portal) placementObserver.observe(portal, {attributes:true, attributeFilter:['style','class']});
        placementObserver.observe(pane, {attributes:true, attributeFilter:['aria-busy','data-side','data-state','style','class']});
        sizeObserver.observe(pane);
        sizeObserver.observe(media);
      }
      const viewers = viewerCount(active.row) || active.viewers;
      if (viewers) {
        const text = `${viewers} ${viewers === '1' ? 'viewer' : 'viewers'}`;
        if (countLabel.textContent !== text) countLabel.textContent = text;
        count.removeAttribute('aria-hidden');
      } else if (!active.requested) {
        active.requested = true;
        const slug = KickRefined.channelSlug(active.row.href, location.origin);
        if (slug) getChannel(slug).then(details => {
          if (hover !== active) return;
          active.viewers = details?.viewers || '';
          refresh();
        }).catch(() => {});
      }
      if (!viewers && !count.hasAttribute('aria-hidden')) {
        count.setAttribute('aria-hidden', 'true');
        count.dataset.krSidebarPreviewCountReserved = '';
      }
      if (count.parentElement !== (title || pane)) (title || pane).append(count);
      revealWhenStable(active.row);
    }
    function schedule() {
      if (!hover || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; refresh(); });
    }
    function enter(row) {
      if (!row || !enabled() || hover?.row === row) return;
      reset();
      hover = {row, viewers:''};
      schedule();
    }
    document.addEventListener('pointerover', event => enter(event.target.closest?.(rowSelector)), {capture:true, signal});
    document.addEventListener('pointerout', event => {
      const next = event.relatedTarget;
      if (!hover || hover.row.contains(next) || pane?.contains(next)) return;
      if (hover.row.contains(event.target) || pane?.contains(event.target)) reset();
    }, {capture:true, signal});
    for (const event of ['load','error']) document.addEventListener(event, ({target}) => { if (target === media) schedule(); }, {capture:true, signal});
    enter(document.querySelector(`${rowSelector}:hover`));
    return {schedule, reset};
  }
  globalThis.KickRefinedSidebarPreview = Object.freeze({create});
})();
