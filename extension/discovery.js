/* Reversible discovery styling. Keep native cards, filters and players mounted. */
(() => {
  function route(path=location.pathname){
    const clean=path.replace(/\/$/,'')||'/';
    if(clean==='/')return 'home';
    if(clean==='/browse')return 'live';
    if(clean==='/browse/categories')return 'categories';
    if(clean==='/browse/clips')return 'clips';
    if(/^\/following(?:\/(?:live|videos|channels))?$/.test(clean))return 'following';
    if(/^\/category\/[a-z0-9_-]+(?:\/clips)?$/i.test(clean))return 'category';
    return null;
  }
  const navCSS=`:host{display:block;position:relative;flex:none;margin-inline-start:auto;color:#ededf5;--accent:var(--kr-accent,#b0ff8c);font:600 12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}.tabs{display:flex;align-items:center;gap:3px;padding:3px;border:1px solid #ffffff10;border-radius:9px;background:#141419}a,.compact{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:7px 10px;border:0;border-radius:6px;color:#9999ab;background:transparent;font:inherit;text-decoration:none;white-space:nowrap;cursor:pointer}svg{width:14px;height:14px;flex:none}a:hover,.compact:hover{color:#ededf5;background:#ffffff07}a[aria-current=page]{color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,#16161b)}a:focus-visible,.compact:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.compact{display:none;border:1px solid #ffffff12;background:#141419;color:#e3e3ed;height:34px}.chevron{width:11px;height:11px}@media(max-width:1199px){.compact{display:inline-flex}.tabs{display:none}:host([data-open]) .tabs{position:absolute;right:0;top:calc(100% + 9px);display:flex;flex-direction:column;align-items:stretch;min-width:170px;padding:5px;background:#141419;box-shadow:0 10px 28px #0008}a{justify-content:flex-start;padding:10px 12px}}@media(max-width:450px){.compact span{display:none}.compact{width:34px;padding:7px}.compact .chevron{display:none}}`;
  const icons={home:'m3 10 9-7 9 7v10H3zm6 10v-7h6v7',live:'M3 5h18v14H3zm6 3 7 4-7 4z',categories:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',clips:'m9 7 9 5-9 5zM4 3h16v18H4z'};
  function create(){
    let main=null,layout=null,host=null,shadow=null,mode='',signature='';const marks=new Map();
    function mark(node,name,value=''){
      if(!node)return;let saved=marks.get(node);if(!saved){saved=new Map();marks.set(node,saved);}if(!saved.has(name))saved.set(name,node.getAttribute(name));if(node.getAttribute(name)!==value)node.setAttribute(name,value);
    }
    function restore(node){for(const [name,value]of marks.get(node)||[])if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);marks.delete(node);}
    function clear(){host?.remove();host=shadow=main=layout=null;mode=signature='';for(const node of [...marks.keys()])restore(node);}
    function closeMenu(){if(host){host.removeAttribute('data-open');shadow.querySelector('.compact').setAttribute('aria-expanded','false');}}
    function place(){
      const nav=[...document.querySelectorAll('nav')].find(node=>!node.closest('main,aside')&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0&&getComputedStyle(node).visibility!=='hidden');
      if(!nav||globalThis.KickRefinedDOM?.isReady&&!KickRefinedDOM.isReady(nav)){host.hidden=true;return;}host.hidden=false;mark(nav,'data-kr-discovery-navbar');
      const last=[...nav.children].filter(node=>node!==host).at(-1),target=last?.tagName==='DIV'&&last.querySelector('button,[data-testid="login"],[data-testid="sign-up"]')&&!last.querySelector('input')?last:nav;
      if(target!==nav)mark(target,'data-kr-discovery-nav-actions');
      const input=nav.querySelector('input');if(input){let branch=input;while(branch.parentElement&&branch.parentElement!==nav)branch=branch.parentElement;if(branch!==target)mark(branch,'data-kr-discovery-nav-search');}
      if(host.parentElement!==target){if(target===nav)nav.append(host);else target.prepend(host);}
    }
    function mount(){
      document.getElementById('kr-discovery-header')?.remove();
      signature='';host=document.createElement('div');host.id='kr-discovery-nav';shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=navCSS;
      const compact=document.createElement('button');compact.className='compact';compact.type='button';compact.setAttribute('aria-label','Discovery navigation');compact.setAttribute('aria-expanded','false');compact.setAttribute('aria-controls','discovery-tabs');compact.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/></svg><span>Explore</span><svg class="chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
      compact.addEventListener('click',()=>{const open=!host.hasAttribute('data-open');host.toggleAttribute('data-open',open);compact.setAttribute('aria-expanded',String(open));});
      const tabs=document.createElement('nav');tabs.className='tabs';tabs.id='discovery-tabs';tabs.setAttribute('aria-label','Discover Kick');
      for(const [key,label,href]of [['home','For you','/'],['live','Live','/browse'],['categories','Categories','/browse/categories'],['clips','Clips','/browse/clips']]){const link=document.createElement('a');link.href=href;link.dataset.view=key;link.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="${icons[key]}"/></svg>`;link.append(document.createTextNode(label));tabs.append(link);}
      tabs.addEventListener('click',event=>{const link=event.target.closest('a');if(!link)return;closeMenu();if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button)return;const native=[...document.querySelectorAll('a[href]')].find(node=>node!==link&&!node.closest('#kr-root,#sidebar-wrapper [data-testid*="-channel-"]')&&node.href===link.href);if(native){event.preventDefault();native.click();}});
      shadow.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();compact.focus();}});
      shadow.append(style,compact,tabs);place();
    }
    function outside(event){if(host&&!event.composedPath().includes(host))closeMenu();}
    document.addEventListener('pointerdown',outside,true);
    function refresh(enabled=true){
      const next=route(),nextMain=document.querySelector('main');if(!enabled||!next||!nextMain){clear();return;}
      const nextLayout=nextMain.querySelector('[class~="m-auto"]')||nextMain.firstElementChild||nextMain;
      if(nextMain!==main||nextLayout!==layout||mode!==next){clear();main=nextMain;layout=nextLayout;mode=next;}
      for(const node of [...marks.keys()])if(!node.isConnected)restore(node);
      mark(main,'data-kr-discovery',mode);mark(layout,'data-kr-discovery-layout');
      if(!host?.isConnected){host?.remove();mount();}else place();
      const key=JSON.stringify([mode,location.pathname]);if(key!==signature){signature=key;for(const link of shadow.querySelectorAll('nav a')){if(link.dataset.view===mode)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}}
      if(mode!=='category')for(const tab of main.querySelectorAll('[data-testid^="tab-"]'))if(tab.parentElement.querySelectorAll('[data-testid^="tab-"]').length>=2)mark(tab.parentElement,'data-kr-discovery-source');
      for(const heading of main.querySelectorAll('h2'))if(!heading.closest('[data-testid$="-card"],[data-testid="category-card-root"]')){const board=heading.closest('[data-testid="featured-leaderboards-section"]'),secondary=board&&board.querySelector('h2')!==heading;mark(heading,'data-kr-discovery-heading',secondary?'secondary':'section');if(secondary)for(let panel=heading.parentElement;panel&&panel!==board;panel=panel.parentElement)if(panel.querySelector('ol')){mark(panel,'data-kr-discovery-leaderboard');break;}}
      for(const carousel of main.querySelectorAll('[data-testid="carousel"]')){mark(carousel,'data-kr-discovery-feature');for(const plate of carousel.querySelectorAll('[class*="backdrop-blur"]'))if(plate.querySelector('[data-testid="carousel-channel-name"]'))mark(plate,'data-kr-discovery-feature-caption');for(const control of carousel.querySelectorAll('a,button'))if(/^watch now$/i.test(control.textContent.trim()))mark(control,'data-kr-discovery-feature-watch');}
      const collections=new Map();
      for(const card of main.querySelectorAll('[data-testid="livestream-results-card"],[data-testid="clips-card"],[data-testid="vods-card"]')){
        if(card.closest('[data-testid="carousel"]'))continue;
        const parent=card.parentElement;if(!collections.has(parent))collections.set(parent,[]);collections.get(parent).push(card);
        mark(card,'data-kr-discovery-card');const thumb=card.querySelector('[data-testid="media-card-thumbnail"]')||card.querySelector('img[data-thumbnail]')?.closest('a,button');
        if(thumb){mark(thumb,'data-kr-discovery-thumbnail');let branch=thumb;while(branch.parentElement&&branch.parentElement!==card&&!branch.nextElementSibling)branch=branch.parentElement;const content=branch.nextElementSibling;if(content?.querySelector('h3,a[title],img'))mark(content,'data-kr-discovery-info');}
        const info=card.querySelector('[data-kr-discovery-info]');if(info)for(const image of info.querySelectorAll('img')){mark(image,'data-kr-discovery-avatar');mark(image.closest('a'),'data-kr-discovery-avatar-link');}
        if(info){for(const link of info.querySelectorAll('a[title]'))mark(link,'data-kr-discovery-caption',link.querySelector('h3')?'title':'name');const name=info.querySelector('[data-kr-discovery-caption="name"]'),title=info.querySelector('[data-kr-discovery-caption="title"]'),words=name?.parentElement;if(words&&words!==info&&words.contains(title)){mark(words,'data-kr-discovery-words');mark(title.parentElement===words?title:title.parentElement,'data-kr-discovery-title-row');}const category=info.querySelector('a[href*="/category/"]'),tags=category?.closest('[class~="grid"]');if(tags&&info.contains(tags)){mark(tags,'data-kr-discovery-tags');mark(category.parentElement,'data-kr-discovery-tagline');}}

        if(mode!=='home'&&card.parentElement.matches('section,[class~="grid"]')&&!card.parentElement.querySelector(':scope>h1,:scope>h2,video'))mark(card.parentElement,'data-kr-discovery-grid','streams');
        if(mode==='home'&&card.parentElement.matches('section,[class~="grid"]'))mark(card.parentElement,'data-kr-discovery-grid','shelf');
        if(mode==='home')for(let section=card.parentElement;section&&section!==layout;section=section.parentElement)if(section.classList.contains('lg:hidden')&&section.querySelector('h2')){mark(section,'data-kr-discovery-shelf');break;}
      }
      if(mode==='home')for(const [parent,cards]of collections)if(cards.length>1){const type=parent.hasAttribute('data-showingmore')?'shelf':getComputedStyle(parent).display.includes('grid')?'streams':'rail';mark(parent,'data-kr-discovery-grid',type);}
      for(const card of main.querySelectorAll('[data-testid="category-card-root"]')){
        mark(card,'data-kr-discovery-category');if(mode==='home'&&card.parentElement.matches('section,[class~="grid"]'))mark(card.parentElement,'data-kr-discovery-grid','category-shelf');
        if(mode!=='home'&&card.parentElement.matches('section,[class~="grid"]'))mark(card.parentElement,'data-kr-discovery-grid','categories');
      }
      if(mode==='category'){const title=main.querySelector('[data-testid="category-name"]');let identity=title?.parentElement;while(identity&&identity.parentElement!==layout&&!identity.querySelector('img'))identity=identity.parentElement;if(identity&&identity!==layout&&identity.querySelector('img'))mark(identity,'data-kr-discovery-identity');}
    }
    return {refresh,destroy(){document.removeEventListener('pointerdown',outside,true);clear();}};
  }
  globalThis.KickRefinedDiscovery=Object.freeze({route,create});
})();
