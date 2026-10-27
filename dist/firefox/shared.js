/* Shared by the popup and isolated content script. No remote dependencies. */
(() => {
  const defaults = Object.freeze({
    enabled: true,
    performance: true,
    compact: false,
    hideRecommended: false,
    textOnly: false,
    chatClips: true,
    xEmbeds: true,
    chatWidth: 340,
    fontSize: 14,
    accent: 'mint',
    pinned: []
  });
  function normalize(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const result = { ...defaults };
    for (const key of ['enabled', 'performance', 'compact', 'hideRecommended', 'textOnly', 'chatClips', 'xEmbeds']) {
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
  // Keep chat cards aligned even when Kick lays out a message with flex children.
  const chatEmbedCSS = `
    :host(:not([data-workspace])){display:block;width:100%;min-width:0;max-width:100%;flex:0 0 100%}
    :host(:not([data-workspace])) .card{box-sizing:border-box;width:calc(100% - 4px);max-width:360px;margin:8px auto 6px;border:1px solid #ffffff14;border-radius:12px;background:#121216;transition:border-color .16s ease,background-color .16s ease,box-shadow .16s ease}
    :host(:not([data-workspace])) .card:focus-within{border-color:color-mix(in srgb,var(--kr-accent,#8cecc0) 32%,transparent);background:#16161c;box-shadow:0 0 0 1px #ffffff03}
    @media(hover:hover) and (pointer:fine){:host(:not([data-workspace])) .card:hover{border-color:color-mix(in srgb,var(--kr-accent,#8cecc0) 32%,transparent);background:#16161c;box-shadow:0 0 0 1px #ffffff03}}
    @media(prefers-reduced-motion:reduce){:host(:not([data-workspace])) .card{transition:none}}
  `;
  function multiState(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const channels = Array.isArray(source.channels) ? [...new Set(source.channels.filter(s => typeof s === 'string').map(s => channelSlug(`/${s}`)).filter(Boolean))].slice(0, 6) : [];
    const sizes={};for(const slug of channels)if(Number.isFinite(source.sizes?.[slug]))sizes[slug]=Math.max(2,Math.min(6,Math.round(source.sizes[slug])));
    return { channels, sizes, mixAudio:source.mixAudio===true, layout: ['grid', 'focus', 'columns'].includes(source.layout) ? source.layout : 'grid', chat: channels.includes(source.chat) ? source.chat : channels[0] || '', chatVisible: source.chatVisible !== false, focus: channels.includes(source.focus) ? source.focus : channels[0] || '', focusSize: Number.isFinite(source.focusSize) ? Math.max(45,Math.min(80,Math.round(source.focusSize))) : 67 };
  }
  function multiURL(input) {
    const state = multiState(input), url = new URL('https://kick.com/');
    url.searchParams.set('refined-multi', state.channels.join(',')); url.searchParams.set('refined-layout', state.layout);
    url.searchParams.set('refined-chat', state.chat); url.searchParams.set('refined-focus', state.focus);
    url.searchParams.set('immersion-size',state.focusSize);
    if(state.mixAudio)url.searchParams.set('immersion-mix','1');
    if(Object.keys(state.sizes).length)url.searchParams.set('immersion-tiles',JSON.stringify(state.sizes));
    if (!state.chatVisible) url.searchParams.set('refined-hide-chat', '1');
    return url.href;
  }
  function channelDetails(data,slug){
    if(!data||typeof data!=='object'||data.slug?.toLowerCase()!==slug)return null;
    const text=value=>typeof value==='string'?value.trim().slice(0,600):'';
    const user=data.user||{},stream=data.livestream,category=stream?.categories?.[0]?.name||data.recent_categories?.[0]?.name;
    const socials=[];
    const platforms={twitter:['X','https://x.com/',['x.com','twitter.com']],instagram:['Instagram','https://www.instagram.com/',['instagram.com']],youtube:['YouTube','https://www.youtube.com/@',['youtube.com','youtu.be']],discord:['Discord','https://discord.gg/',['discord.gg','discord.com']],tiktok:['TikTok','https://www.tiktok.com/@',['tiktok.com']],facebook:['Facebook','https://www.facebook.com/',['facebook.com']]};
    for(const [key,[label,base,hosts]]of Object.entries(platforms)){
      const value=text(user[key]);if(!value)continue;
      try{const href=/^https?:\/\//i.test(value)?new URL(value):/^[\w.@-]{1,120}$/.test(value)?new URL(base+encodeURIComponent(value.replace(/^@/,''))):null;
        if(href?.protocol==='https:'&&hosts.some(host=>href.hostname===host||href.hostname.endsWith('.'+host))&&!href.username&&!href.password)socials.push({label,href:href.href});
      }catch{}
    }
    let image='';try{const url=new URL(user.profile_pic);if(url.protocol==='https:'&&url.hostname.endsWith('.kick.com'))image=url.href;}catch{}
    return {title:text(user.username)||slug,streamTitle:text(stream?.session_title),bio:typeof user.bio==='string'?user.bio.trim().slice(0,20000):'',category:text(category),live:stream?.is_live===true?'live':data.livestream===null?'offline':'unknown',viewers:Number.isFinite(stream?.viewer_count)&&stream.viewer_count>=0?Math.floor(stream.viewer_count).toLocaleString('en-US'):'',image,socials};
  }
  globalThis.KickRefined = Object.freeze({ defaults, normalize, channelSlug, api, chatEmbedCSS, multiState, multiURL, channelDetails });
})();
