/* Theme React-owned channel pages without rebuilding cards or navigation. */
(() => {
  const avatarSelector='#channel-avatar,[data-testid="channel-avatar"]';
  const cardSelector='[data-testid="vods-card"],[data-testid="clips-card"],[data-testid="clip-card"]';
  function routeSlug(path=location.pathname){const match=/^\/([a-z0-9_]{1,40})(?:\/(?:about|videos|clips|schedule))?\/?$/i.exec(path);return match?KickRefined.channelSlug('/'+match[1],location.origin):null;}
  function watchSlug(path=location.pathname){const match=/^\/([a-z0-9_]{1,40})\/videos\/[a-z0-9_-]+\/?$/i.exec(path);return match?KickRefined.channelSlug('/'+match[1],location.origin):null;}
  const profileTabs=['about','videos','clips','schedule'];
  function profileTab(){
    const path=location.pathname.split('/')[2],query=new URL(location.href).searchParams.get('tab');
    return profileTabs.includes(path)?path:query==='overview'?'home':profileTabs.includes(query)?query:null;
  }
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
  function create({onWatch,onDrag,onChange,onKeydown,getProfileMount}={}){
    const marks=new Map(),sourceCards=new WeakMap();let current='',currentMode='',library=null,navigation=null;
    const previews=new Map(),catalogs=new Map();let catalogSort='recent',selectedTab=null,routeKey='';
    const previewDate=new Intl.DateTimeFormat('en-US',{dateStyle:'medium'});
    let wanted=new Map();
    function mark(node,name){if(!node)return;if(!wanted.has(node))wanted.set(node,new Set());wanted.get(node).add(name);}
    function reconcile(){
      for(const [node,saved] of marks){
        for(const [name,value] of saved){
          if(wanted.get(node)?.has(name))continue;
          if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);
          saved.delete(name);
        }
        if(!saved.size)marks.delete(node);
      }
      for(const [node,names] of wanted){
        let saved=marks.get(node);if(!saved){saved=new Map();marks.set(node,saved);}
        for(const name of names){if(!saved.has(name))saved.set(name,node.getAttribute(name));if(!node.hasAttribute(name))node.setAttribute(name,'');}
      }
    }
    function restoreAll(){wanted=new Map();reconcile();}
    function clearMedia(){
      for(const record of [...previews.values(),...catalogs.values()])record.service.destroy();
      previews.clear();catalogs.clear();catalogSort='recent';
    }
    function clear(){
      restoreAll();library?.destroy();library=null;navigation=null;current='';selectedTab=null;routeKey='';
      clearMedia();
    }
    function localRow(search,row,order){
      const href=location.origin+new URL(row.href).pathname;
      return {...row,key:href,href,order,clock:search.duration(row.duration),date:row.created?previewDate.format(row.created):''};
    }
    function loadCatalog(slug,tab,append=false){
      const search=globalThis.KickRefinedSearch;if(!search?.create)return null;
      const sort=tab==='clips'&&catalogSort==='views'?'views':'recent',key=`${tab}:${sort}`;
      let record=catalogs.get(key);
      if(record&&(!append||!record.more||record.status==='loading'))return record;
      if(!record){record={service:search.create(),rows:[],more:false};catalogs.set(key,record);}
      record.status='loading';
      const request=tab==='videos'?record.service.recordings(slug).then(rows=>({rows,more:false})):record.service.search(search.parse(`clips:${slug} sort:${sort}`),{append});
      request.then(({rows,more})=>{record.rows=rows.map((row,index)=>localRow(search,row,index));record.more=more;record.status='ready';}).catch(()=>{record.status='unavailable';}).finally(()=>{
        if(catalogs.get(key)===record&&slug===current)(onChange||refresh)();
      });
      return record;
    }
    function loadPreview(slug,type){
      const search=globalThis.KickRefinedSearch;
      if(!search?.create)return null;
      if(previews.has(type))return previews.get(type);
      const preview={service:search.create(),status:'loading',rows:[]};
      previews.set(type,preview);
      const query=search.parse(`type:${type==='vod'?'vods':'clips'} channel:${slug}${type==='clip'?' sort:views':''}`);
      preview.service.search(query).then(({rows})=>{
        preview.rows=rows.slice(0,type==='vod'?1:3).map((row,order)=>localRow(search,row,order));
        preview.status='ready';
      }).catch(()=>{preview.status='unavailable';}).finally(()=>{
        if(previews.get(type)===preview&&slug===current)(onChange||refresh)();
      });
      return preview;
    }
    function navigate(tab){
      if(getProfileMount&&!watchSlug()){selectedTab=tab;refresh();return;}
      const label={home:'home',videos:'videos|recordings',clips:'clips',about:'about',schedule:'schedule'}[tab];
      const links=[...navigation?.querySelectorAll('a,button,[role="tab"]')||[]];
      const source=links.find(node=>node.dataset.testid===`channel-${tab}-tab`)||links.find(node=>new RegExp('^('+label+')\\b','i').test(node.textContent.trim()));
      if(source?.isConnected){source.click();onChange?.();}else location.assign('/'+current+(tab==='home'?'':'/'+tab));
    }
    function refresh(enabled=true){
      const watchPage=!!watchSlug(),slug=routeSlug()||watchSlug();if(!enabled||!slug){clear();return;}
      const mode=watchPage?'watch':'profile';if(slug!==current||mode!==currentMode){clear();current=slug;currentMode=mode;}
      wanted=new Map();
      const sectionLinks=[...document.querySelectorAll(`main a[href*="/${slug}/"]`)].filter(link=>link.origin===location.origin&&link.pathname.startsWith(`/${slug}/`)&&/^\/(?:about|videos|clips|schedule)\/?$/.test(link.pathname.slice(slug.length+1))&&!link.closest('aside,#channel-chatroom,[role="menu"],[role="dialog"]'));
      const nativeTabs=sectionLinks.filter(link=>/^channel-\w+-tab$/.test(link.dataset.testid||''));
      const tabLinks=nativeTabs.length>=2?nativeTabs:sectionLinks;
      let tabs=null;
      for(const link of tabLinks){for(let node=link.parentElement;node&&!node.matches('main,body');node=node.parentElement){if(node.querySelector(`video,${cardSelector}`))break;if(tabLinks.some(item=>item!==link&&node.contains(item)&&item.pathname!==link.pathname)){tabs=node;break;}}if(tabs)break;}
      if(!tabs)tabs=[...document.querySelectorAll('[role="tablist"]')].find(node=>!node.closest('aside,[role="dialog"]')&&/home|about|videos|clips/i.test(node.textContent));
      if(watchPage)tabs=[...document.querySelectorAll('main h2,main h3')].find(node=>/^more videos\b/i.test(node.textContent.trim()));
      if(!tabs){clear();return;}
      const main=tabs.closest('#channel-content')||tabs.closest('main')||tabs.parentElement;navigation=tabs;
      const active=tabs.querySelector('[aria-selected="true"],[data-state="active"],[aria-current="page"]');const activeName=active?.textContent.trim().toLowerCase();
      const directTab=profileTab(),nextRoute=`${location.pathname}:${directTab||''}`;
      if(routeKey!==nextRoute){routeKey=nextRoute;selectedTab=null;}
      const tab=watchPage?'videos':selectedTab||directTab||(/^(videos|recordings)/.test(activeName||'')?'videos':/^(about|clips|schedule)/.exec(activeName||'')?.[1]||'home');
      const managed=!watchPage&&!!getProfileMount;
      const mount=managed?getProfileMount(tab):null;
      if(managed&&tab!=='schedule')for(const schedule of main.querySelectorAll('[data-testid="schedule-viewer-page"]'))mark(schedule,'data-kr-library-source');
      if(tab==='about')for(const heading of main.querySelectorAll('section h2,section h3'))if(/^about\b/i.test(heading.textContent.trim()))mark(heading.closest('section'),mount?'data-kr-library-source':'data-kr-channel-about');
      const cards=new Set(main.querySelectorAll(cardSelector));
      for(const link of main.querySelectorAll(`a[href*="/${slug}/videos/"],a[href*="/${slug}/clips/"],a[href*="?clip="]`)){
        if(cards.size>=300)break;
        if(link.origin!==location.origin||link.closest(cardSelector)||!KickRefinedChannelLibrary.mediaLink(link,slug))continue;
        let card=link.closest('article,li,[data-testid$="-card"]')||sourceCards.get(link);
        if(!card?.isConnected){card=null;for(let node=link.parentElement;node&&node!==main&&!node.matches('body,nav,aside');node=node.parentElement){
          if(node.contains(tabs)||node.querySelector('video,#video-player,#kr-channel-root'))break;
          const destinations=new Set([...node.querySelectorAll('a[href]')].filter(item=>KickRefinedChannelLibrary.mediaLink(item,slug)).map(item=>item.href));if(destinations.size>1)break;
          const title=node.querySelector('h3,h4,[data-testid="media-card-title"]')||[...node.querySelectorAll('a[href]')].find(item=>item.href===link.href&&!item.querySelector('img')&&item.textContent.trim()&&!/^[\d:\s]+$/.test(item.textContent));
          if(node.querySelector('img')&&title){card=node;sourceCards.set(link,node);break;}
        }}
        if(card&&!card.contains(tabs)&&card.querySelector('img')&&!card.closest('aside,#channel-chatroom'))cards.add(card);
      }
      const rows=[],parents=new Map();let order=0;
      for(const card of cards){
        if((!managed||mount)&&order<300){const row=KickRefinedChannelLibrary.read(card,slug,order++);if(row)rows.push(row);}
        const parent=card.parentElement;if(!parents.has(parent))parents.set(parent,[]);parents.get(parent).push(card);
      }
      if(cards.size&&!rows.length&&!managed&&['home','videos','clips'].includes(tab)){restoreAll();library?.destroy();library=null;return;}
      if(!managed||mount){
        if(!library)library=KickRefinedChannelLibrary.create({onWatch,onDrag,onNavigate:navigate,onKeydown,onSort:sort=>{catalogSort=sort;refresh();}});
        library.host.toggleAttribute('data-profile-library',!!mount);
        if(mount){if(library.host.parentElement!==mount)mount.append(library.host);}
        else {
          const stickyTabs=!watchPage&&tabs.parentElement!==main&&getComputedStyle(tabs.parentElement).position==='sticky';
          const anchor=stickyTabs?tabs.parentElement:tabs;
          if(library.host.parentElement!==anchor.parentElement||library.host.nextElementSibling!==anchor)anchor.before(library.host);
        }
      }else if(library){
        library.destroy();library=null;
        clearMedia();
      }
      mark(tabs,'data-kr-library-source');
      const more=[...main.querySelectorAll('button')].find(node=>{if(node.closest('#kr-channel-root')||!/^(?:load|show) more/i.test(node.textContent.trim()))return false;for(let group=node.parentElement;group&&group!==main;group=group.parentElement){if(group.contains(tabs))break;if([...cards].some(card=>group.contains(card)))return true;}return false;});
      if(more)mark(more,'data-kr-library-source');
      for(const [parent,children]of parents){
        for(const card of children)mark(card,'data-kr-library-source');
        const section=parent.closest('section');if(section&&!section.contains(tabs)&&!section.contains(library?.host)){mark(section,'data-kr-library-shell');for(const heading of section.querySelectorAll(':scope>h2,:scope>div>h2'))mark(heading.parentElement===section?heading:heading.parentElement,'data-kr-library-source');}
        if([...parent.children].every(node=>cards.has(node)||node.matches('script,style'))){
          mark(parent,'data-kr-library-shell');
          for(let node=parent;node&&node!==main&&node!==document.body;node=node.parentElement){
            if(node.contains(tabs)||node.contains(library?.host))break;
            mark(node,'data-kr-library-shell');const previous=node.previousElementSibling;
            if(previous?.querySelector('h2,h3')){mark(previous,'data-kr-library-source');const group=node.parentElement;if(group!==main&&!group.contains(tabs)&&[...group.children].every(child=>child===node||child===previous||child.matches('script,style')))mark(group,'data-kr-library-shell');break;}
            if(node.querySelector('h2')){for(const heading of node.querySelectorAll(':scope>h2,:scope>div>h2'))mark(heading.parentElement===node?heading:heading.parentElement,'data-kr-library-source');break;}
          }
        }
      }
      if(!watchPage&&(tab==='videos'||tab==='clips')){
        const controls=main.querySelectorAll('input[type="search"],input[placeholder*="search" i],input[aria-label*="search" i],select,[role="combobox"],h1,h2,h3,[role="status"],p');
        for(const node of controls){
          if(node.closest(`${cardSelector},aside,header,nav,#kr-channel-root,#channel-chatroom,[role="dialog"]`))continue;
          const text=node.textContent.trim();
          if(node.matches('input')){mark(node.closest('label')||node,'data-kr-library-source');continue;}
          if(node.matches('select,[role="combobox"]')){
            if(/sort|filter|length/i.test(node.getAttribute('aria-label')||'')){
              const group=node.parentElement;
              mark(group?.querySelector(':scope > span')&&group.querySelectorAll('button,select:not([aria-hidden="true"])').length===1?group:node,'data-kr-library-source');
            }else if(/^(?:select|newest|most viewed|latest|popular|any length|all time|this (?:week|month)|today|title\s*a)/i.test(text))mark(node,'data-kr-library-source');
            continue;
          }
          if(/^(?:clips|videos|no (?:clips|videos|results)\b.*)$/i.test(text))mark(node,'data-kr-library-source');
        }
      }
      reconcile();
      if(!library)return;
      const previewStatus={};
      if(tab==='home')for(const type of ['vod','clip']){
        if(rows.some(row=>row.type===type))continue;
        const preview=loadPreview(slug,type);
        if(preview){rows.push(...preview.rows);previewStatus[type]=preview.status;}
      }
      let items=rows,loadMore=more?()=>more.click():null,catalogStatus='';
      if(mount&&(tab==='clips'||tab==='videos')){
        let catalog=loadCatalog(slug,tab);
        if(tab==='clips'&&catalogSort==='title'&&catalog?.more&&catalog.status==='ready')catalog=loadCatalog(slug,tab,true);
        if(catalog){
          catalogStatus=catalog.status;
          const native=new Map(rows.map(row=>[new URL(row.href).pathname,row]));
          if(tab==='clips'&&(catalog.status!=='unavailable'||catalog.rows.length)){
            items=catalog.rows.map(row=>({...row,source:native.get(new URL(row.href).pathname)?.source}));
            loadMore=catalog.more?()=>{loadCatalog(slug,tab,true);(onChange||refresh)();}:null;
          }else if(tab==='videos'&&catalog.rows.length){
            for(const row of catalog.rows){
              const path=new URL(row.href).pathname,source=native.get(path);
              native.set(path,{...source,...row,key:source?.key||row.key,source:source?.source,image:row.image||source?.image,clock:row.clock||source?.clock,duration:row.duration??source?.duration});
            }
            items=[...native.values()];
          }
        }
      }
      library.update({slug,tab,more:loadMore,watchPage,previewStatus,catalogStatus,integrated:managed,inlineSchedule:managed&&directTab!=='schedule'},items);
    }
    return {refresh,destroy:clear};
  }
  globalThis.KickRefinedChannelPage=Object.freeze({create,findHeaders,routeSlug,watchSlug,profileTab,username,avatar});
})();
