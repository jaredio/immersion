/* Fit Kick's portaled sidebar tooltip around its native preview and title. */
(() => {
  const rowSelector = '#sidebar-wrapper a[data-testid*="-channel-"]';
  const paneSelector = '.z-tooltip[data-state][data-side], [data-radix-popper-content-wrapper] > [data-side]:has([role="tooltip"])';
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

  function create({signal, enabled, getChannel}) {
    let hover = null, pane = null, media = null, title = null, count = null, countLabel = null, frame = 0;
    function clearPane() {
      pane?.removeAttribute('data-kr-sidebar-preview');
      title?.removeAttribute('data-kr-sidebar-preview-title');
      count?.remove();
      pane = media = title = count = countLabel = null;
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
        if (candidate?.matches(':not([data-state="closed"])') && candidate.querySelector(mediaSelector)) return candidate;
      }
      const anchor = row.getBoundingClientRect();
      for (const candidate of document.querySelectorAll(paneSelector)) {
        const side = candidate.dataset.side;
        if (candidate.dataset.state === 'closed' || !['right', 'left'].includes(side) || !candidate.querySelector(mediaSelector)) continue;
        const box = candidate.getBoundingClientRect();
        if (box.width && box.height && box.bottom > anchor.top && box.top < anchor.bottom &&
            (side === 'right' ? box.left >= anchor.right - 16 : box.right <= anchor.left + 16)) return candidate;
      }
      return null;
    }
    function refresh() {
      if (!hover) return;
      if (!enabled() || !hover.row.isConnected) { reset(); return; }
      const active = hover, nextPane = findPane(active.row);
      if (!nextPane) { clearPane(); return; }
      const preview = nextPane.querySelector(mediaSelector), heading = caption(nextPane, preview);
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
      }
      const viewers = viewerCount(active.row) || active.viewers;
      if (viewers) {
        const text = `${viewers} ${viewers === '1' ? 'viewer' : 'viewers'}`;
        if (countLabel.textContent !== text) countLabel.textContent = text;
        if (count.parentElement !== (title || pane)) (title || pane).append(count);
      } else if (!active.requested) {
        active.requested = true;
        const slug = KickRefined.channelSlug(active.row.href, location.origin);
        if (slug) getChannel(slug).then(details => {
          if (hover !== active) return;
          active.viewers = details?.viewers || '';
          refresh();
        }).catch(() => {});
      }
    }
    function schedule() {
      if (!hover || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; refresh(); });
    }
    document.addEventListener('pointerover', event => {
      const row = event.target.closest?.(rowSelector);
      if (!row || !enabled() || hover?.row === row) return;
      reset();
      hover = {row, viewers:''};
      schedule();
    }, {capture:true, signal});
    document.addEventListener('pointerout', event => {
      const next = event.relatedTarget;
      if (!hover || hover.row.contains(next) || pane?.contains(next)) return;
      if (hover.row.contains(event.target) || pane?.contains(event.target)) reset();
    }, {capture:true, signal});
    return {schedule, reset};
  }
  globalThis.KickRefinedSidebarPreview = Object.freeze({create});
})();
