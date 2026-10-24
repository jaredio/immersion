/* Shared by the popup and isolated content script. No remote dependencies. */
(() => {
  const defaults = Object.freeze({
    enabled: true,
    performance: true,
    compact: false,
    hideRecommended: false,
    textOnly: false,
    chatWidth: 340,
    fontSize: 14,
    accent: 'mint',
    pinned: []
  });
  function normalize(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const result = { ...defaults };
    for (const key of ['enabled', 'performance', 'compact', 'hideRecommended', 'textOnly']) {
      if (typeof source[key] === 'boolean') result[key] = source[key];
    }
    for (const [key, min, max] of [['chatWidth', 280, 440], ['fontSize', 12, 18]]) {
      if (Number.isFinite(source[key])) result[key] = Math.min(max, Math.max(min, Math.round(source[key])));
    }
    if (['mint', 'violet', 'blue', 'neutral'].includes(source.accent)) result.accent = source.accent;
    result.pinned = Array.isArray(source.pinned)
      ? [...new Set(source.pinned.filter(s => typeof s === 'string' && /^[a-zA-Z0-9_]{1,40}$/.test(s)).map(s => s.toLowerCase()))].slice(0, 30)
      : [];
    return result;
  }
  const reserved = new Set(['browse', 'categories', 'category', 'following', 'search', 'settings', 'dashboard', 'auth', 'login', 'signup', 'register', 'events', 'clips', 'videos', 'subscriptions', 'transactions', 'wallet', 'drops', 'legal', 'community-guidelines', 'terms-of-service', 'privacy-policy', 'about', 'download', 'rewards', 'account', 'moderator', 'moderation', 'kicks', 'inventory', 'popout']);
  function channelSlug(href, origin = 'https://kick.com') {
    try {
      const url = new URL(href, origin);
      if (url.origin !== origin || url.search || url.hash) return null;
      const match = /^\/([a-zA-Z0-9_]{1,40})\/?$/.exec(url.pathname);
      return match && !reserved.has(match[1].toLowerCase()) ? match[1].toLowerCase() : null;
    } catch { return null; }
  }
  const api = typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null;
  function multiState(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const channels = Array.isArray(source.channels) ? [...new Set(source.channels.filter(s => typeof s === 'string').map(s => channelSlug(`/${s}`)).filter(Boolean))].slice(0, 6) : [];
    return { channels, layout: ['grid', 'focus', 'columns'].includes(source.layout) ? source.layout : 'grid', chat: channels.includes(source.chat) ? source.chat : channels[0] || '', chatVisible: source.chatVisible !== false, focus: channels.includes(source.focus) ? source.focus : channels[0] || '', focusSize: Number.isFinite(source.focusSize) ? Math.max(45,Math.min(80,Math.round(source.focusSize))) : 67, quiet: source.quiet === true };
  }
  function multiURL(input) {
    const state = multiState(input), url = new URL('https://kick.com/');
    url.searchParams.set('refined-multi', state.channels.join(',')); url.searchParams.set('refined-layout', state.layout);
    url.searchParams.set('refined-chat', state.chat); url.searchParams.set('refined-focus', state.focus);
    url.searchParams.set('immersion-size',state.focusSize);
    if(state.quiet)url.searchParams.set('immersion-quiet','1');
    if (!state.chatVisible) url.searchParams.set('refined-hide-chat', '1');
    return url.href;
  }
  globalThis.KickRefined = Object.freeze({ defaults, normalize, channelSlug, api, multiState, multiURL });
})();
