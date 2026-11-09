/* Theme React-owned channel pages without rebuilding cards or navigation. */
(() => {
  const avatarSelector='#channel-avatar,[data-testid="channel-avatar"]';
  function routeSlug(path=location.pathname){const match=/^\/([a-z0-9_]{1,40})(?:\/(?:about|videos|clips|schedule))?\/?$/i.exec(path);return match?KickRefined.channelSlug('/'+match[1],location.origin):null;}
  function watchSlug(path=location.pathname){const match=/^\/([a-z0-9_]{1,40})\/videos\/[a-z0-9_-]+\/?$/i.exec(path);return match?KickRefined.channelSlug('/'+match[1],location.origin):null;}
  const normalized=value=>value?.toLowerCase().replace(/[^a-z0-9_]/g,'');
  function username(root){return root.querySelector('#channel-username,[data-testid="channel-username"]')||[...root.querySelectorAll('h1,h2')].find(node=>normalized(node.textContent)===routeSlug());}
  function avatar(root){return root.querySelector(avatarSelector)||root.querySelector('img[src*="/profile_image/"]')||[...root.querySelectorAll('img[alt]')].find(node=>normalized(node.alt)===routeSlug());}
  function findHeaders(){
    const headers=new Set();
    const names=new Set(document.querySelectorAll('#channel-username,[data-testid="channel-username"]'));
    for(const name of document.querySelectorAll('h1,h2'))if(normalized(name.textContent)===routeSlug())names.add(name);
    for(const name of names){
      if(name.closest('nav,aside,[role="dialog"],[role="menu"],[data-testid="vods-card"],[data-testid="clips-card"],[data-testid="clip-card"]'))continue;
      for(let node=name.parentElement;node&&!node.matches('main,nav,aside,body');node=node.parentElement){
        if(node.querySelector('video,#video-player,#injected-channel-player,#channel-chatroom,[role="tablist"],[data-testid="vods-card"]'))break;
        if(avatar(node)&&node.querySelector('[data-testid="follow-button"],[data-testid="sub-button"],button[aria-label*="Follow" i],button[aria-label*="Subscribe" i]')){headers.add(node);break;}
      }
    }
    return [...headers];
  }
  function create({onWatch,onDrag,onChange,onKeydown}={}){
    const marks=new Map(),sourceCards=new WeakMap();let current='',currentMode='',library=null,navigation=null;
    function mark(node,name){if(!node)return;let saved=marks.get(node);if(!saved){saved=new Map();marks.set(node,saved);}if(!saved.has(name))saved.set(name,node.getAttribute(name));if(!node.hasAttribute(name))node.setAttribute(name,'');}
    function restore(node){for(const [key,value]of marks.get(node)||[])if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);marks.delete(node);}
    function restoreAll(){for(const node of [...marks.keys()])restore(node);}
    function clear(){restoreAll();library?.destroy();library=null;navigation=null;current='';}
    function navigate(tab){
      const label={home:'home',videos:'videos|recordings',clips:'clips',about:'about',schedule:'schedule'}[tab];
      const source=[...navigation?.querySelectorAll('a,button,[role="tab"]')||[]].find(node=>new RegExp('^('+label+')\\b','i').test(node.textContent.trim()));
      if(source?.isConnected){source.click();onChange?.();}else location.assign('/'+current+(tab==='home'?'':'/'+tab));
    }
    function refresh(enabled=true){
      const watchPage=!!watchSlug(),slug=routeSlug()||watchSlug();if(!enabled||!slug){clear();return;}
      const mode=watchPage?'watch':'profile';if(slug!==current||mode!==currentMode){clear();current=slug;currentMode=mode;}
      for(const node of marks.keys())if(!node.isConnected)restore(node);
      const sectionLinks=[...document.querySelectorAll('a[href]')].filter(link=>{if(link.closest('#sidebar-wrapper,#channel-chatroom,[role="menu"],[role="dialog"]'))return false;try{const url=new URL(link.href);return url.origin===location.origin&&['about','videos','clips','schedule'].some(tab=>url.pathname.replace(/\/$/,'')===`/${slug}/${tab}`);}catch{return false;}});
      let tabs=null;
      for(const link of sectionLinks){for(let node=link.parentElement;node&&node!==document.body;node=node.parentElement){if(node.querySelector('video,[data-testid="vods-card"],[data-testid="clips-card"]'))break;if(sectionLinks.filter(item=>node.contains(item)).length>=2){tabs=node;break;}}if(tabs)break;}
      if(!tabs)tabs=[...document.querySelectorAll('[role="tablist"]')].find(node=>!node.closest('aside,[role="dialog"]')&&/home|about|videos|clips/i.test(node.textContent));
      if(watchPage)tabs=[...document.querySelectorAll('main h2,main h3')].find(node=>/^more videos\b/i.test(node.textContent.trim()));
      if(!tabs){if(library&&!library.host.isConnected)clear();return;}
      const main=tabs.closest('main')||tabs.parentElement;navigation=tabs;
      const pathTab=location.pathname.replace(/\/$/,'').split('/')[2],queryTab=new URL(location.href).searchParams.get('tab'),active=tabs.querySelector('[aria-selected="true"],[data-state="active"],[aria-current="page"]');const activeName=active?.textContent.trim().toLowerCase();
      const tab=watchPage?'videos':pathTab||(['about','videos','clips','schedule'].includes(queryTab)?queryTab:/^(videos|recordings)/.test(activeName||'')?'videos':/^(about|clips|schedule)/.exec(activeName||'')?.[1]||'home');
      if(tab==='about')for(const heading of main.querySelectorAll('section h2,section h3'))if(/^about\b/i.test(heading.textContent.trim()))mark(heading.closest('section'),'data-kr-channel-about');
      const cards=new Set(main.querySelectorAll('[data-testid="vods-card"],[data-testid="clips-card"],[data-testid="clip-card"]'));
      for(const link of main.querySelectorAll('a[href]')){
        let url;try{url=new URL(link.href);if(url.origin!==location.origin)continue;}catch{continue;}
        if(!url.pathname.startsWith(`/${slug}/videos/`)&&!url.pathname.startsWith(`/${slug}/clips/`)&&!(url.pathname===`/${slug}`&&url.searchParams.has('clip')))continue;
        let card=link.closest('article,li,[data-testid$="-card"]')||sourceCards.get(link);
        if(!card?.isConnected){card=null;for(let node=link.parentElement;node&&node!==main&&!node.matches('body,nav,aside');node=node.parentElement){
          if(node.contains(tabs)||node.querySelector('video,#video-player,#kr-channel-root'))break;
          const destinations=new Set([...node.querySelectorAll('a[href]')].filter(item=>/\/(?:videos|clips)\//.test(new URL(item.href).pathname)).map(item=>item.href));if(destinations.size>1)break;
          const title=node.querySelector('h3,h4,[data-testid="media-card-title"]')||[...node.querySelectorAll('a[href]')].find(item=>item.href===link.href&&!item.querySelector('img')&&item.textContent.trim()&&!/^[\d:\s]+$/.test(item.textContent));
          if(node.querySelector('img')&&title){card=node;sourceCards.set(link,node);break;}
        }}
        if(card&&!card.contains(tabs)&&card.querySelector('img')&&!card.closest('aside,#channel-chatroom'))cards.add(card);
      }
      const rows=[],parents=new Map();let order=0;
      for(const card of cards){if(rows.length>=300)break;const row=KickRefinedChannelLibrary.read(card,slug,order++);if(row)rows.push(row);const parent=card.parentElement;if(!parents.has(parent))parents.set(parent,[]);parents.get(parent).push(card);}
      if(cards.size&&!rows.length&&['home','videos','clips'].includes(tab)){restoreAll();library?.destroy();library=null;return;}
      if(!library)library=KickRefinedChannelLibrary.create({onWatch,onDrag,onNavigate:navigate,onKeydown});
      if(library.host.parentElement!==tabs.parentElement||library.host.nextElementSibling!==tabs)tabs.before(library.host);
      mark(tabs,'data-kr-library-source');
      const more=[...main.querySelectorAll('button')].find(node=>{if(node.closest('#kr-channel-root')||!/^(?:load|show) more/i.test(node.textContent.trim()))return false;for(let group=node.parentElement;group&&group!==main;group=group.parentElement){if(group.contains(tabs))break;if([...cards].some(card=>group.contains(card)))return true;}return false;});
      if(more)mark(more,'data-kr-library-source');
      for(const [parent,children]of parents){
        for(const card of children)mark(card,'data-kr-library-source');
        const section=parent.closest('section');if(section&&!section.contains(tabs)&&!section.contains(library.host)){mark(section,'data-kr-library-shell');for(const heading of section.querySelectorAll(':scope>h2,:scope>div>h2'))mark(heading.parentElement===section?heading:heading.parentElement,'data-kr-library-source');}
        if([...parent.children].every(node=>cards.has(node)||node.matches('script,style'))){
          mark(parent,'data-kr-library-shell');
          for(let node=parent;node&&node!==main&&node!==document.body;node=node.parentElement){
            if(node.contains(tabs)||node.contains(library.host))break;
            mark(node,'data-kr-library-shell');const previous=node.previousElementSibling;
            if(previous?.querySelector('h2,h3')){mark(previous,'data-kr-library-source');const group=node.parentElement;if(group!==main&&!group.contains(tabs)&&[...group.children].every(child=>child===node||child===previous||child.matches('script,style')))mark(group,'data-kr-library-shell');break;}
            if(node.querySelector('h2')){for(const heading of node.querySelectorAll(':scope>h2,:scope>div>h2'))mark(heading.parentElement===node?heading:heading.parentElement,'data-kr-library-source');break;}
          }
        }
      }
      library.update({slug,tab,more,watchPage},rows);
    }
    return {refresh,destroy:clear};
  }
  globalThis.KickRefinedChannelPage=Object.freeze({create,findHeaders,routeSlug,watchSlug,username,avatar});
})();
