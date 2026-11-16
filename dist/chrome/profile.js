/* Render channel-authored text as local DOM. Never inject publisher HTML. */
(() => {
  function url(value){try{const link=new URL(value);return link.protocol==='https:'&&!link.username&&!link.password?link.href:'';}catch{return '';}}
  function image(src,alt=''){
    const href=url(src);if(!href)return null;
    const element=document.createElement('img');element.src=href;element.alt=alt;element.loading='lazy';element.decoding='async';element.referrerPolicy='no-referrer';
    element.addEventListener('error',()=>{element.hidden=true;},{once:true});return element;
  }
  function link(href){const safe=url(href);if(!safe)return null;const element=document.createElement('a');element.href=safe;element.target='_blank';element.rel='noopener noreferrer';return element;}
  const platforms=[
    ['Instagram',['instagram.com'],'#e4408b','M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6m5-4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3'],
    ['X',['x.com','twitter.com'],'#f1f1f5','M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.4L5.6 22H2.4l8.2-9.4L2 2h6.4l4.5 6.8zm-1.1 18h1.7L7.4 4H5.6z'],
    ['YouTube',['youtube.com','youtu.be'],'#ff4242','M23 7s-.2-2-1-2.8C21.2 3.4 20 3.4 20 3.4 17.2 3.2 12 3.2 12 3.2s-5.2 0-8 .2c0 0-1.2 0-2 .8C1.2 5 1 7 1 7s-.2 2.3-.2 4.5V14s.2 2 .9 2.8c.8.8 2.1.8 2.1.8 2.8.2 8.2.2 8.2.2s5.2 0 8-.2c0 0 1.2 0 2-.8.8-.8 1-2.8 1-2.8s.2-2.3.2-4.5S23 7 23 7M10 14V7l6 3.5z'],
    ['Discord',['discord.com','discord.gg'],'#8b91ff','M20 4a19 19 0 0 0-5-1l-.6 1.2a18 18 0 0 0-4.8 0L9 3a19 19 0 0 0-5 1C1 8 0 12 1 17a20 20 0 0 0 6 3l1.3-2-2-1a13 13 0 0 0 11.4 0l-2 1 1.3 2a20 20 0 0 0 6-3c1-5 0-9-3-13M8 14c-1 0-1.8-1-1.8-2.2S7 9.6 8 9.6s1.8 1 1.8 2.2S9 14 8 14m8 0c-1 0-1.8-1-1.8-2.2s.8-2.2 1.8-2.2 1.8 1 1.8 2.2S17 14 16 14'],
    ['TikTok',['tiktok.com'],'#25f4ee','M15 2h3c.2 2.5 1.6 4 4 4.5V10a10 10 0 0 1-4-1.3V17a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z'],
    ['Facebook',['facebook.com','fb.com'],'#4599ff','M14 22v-9h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5A25 25 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9z'],
    ['Twitch',['twitch.tv'],'#b78aff','M3 1 1 5v16h6v3h3l3-3h5l4-4V1zm18 14-3 3h-5l-3 3v-3H5V4h16zM17 7h-2v6h2zm-5 0h-2v6h2z']
  ];
  function socialIdentity(href){
    let address;try{address=new URL(href);if(!url(href)||address.port)return null;}catch{return null;}
    const host=address.hostname.toLowerCase(),platform=platforms.find(([,hosts])=>hosts.some(domain=>host===domain||host.endsWith('.'+domain)));if(!platform)return null;
    const [label,,color,path]=platform,parts=address.pathname.split('/').filter(Boolean);let handle='';
    try{handle=decodeURIComponent(parts[0]||'').replace(/^@/,'');}catch{}
    if(label==='YouTube'){if(host==='youtu.be')handle='';else if(['channel','c','user'].includes(parts[0]))handle=parts[1]||'';else if(!parts[0]?.startsWith('@'))handle='';}
    if(label==='Discord')handle=host.endsWith('discord.gg')?parts[0]||'':parts[0]==='invite'?parts[1]||'':'';
    const reserved=label==='Instagram'?['p','reel','reels','stories','explore','accounts','direct']:label==='Facebook'?['profile.php','watch','groups','share']:['home','explore','search','intent','share','login','settings','i'];
    if(reserved.includes(handle.toLowerCase())||!/^[-\p{L}\p{N}_.]{1,100}$/u.test(handle))handle='';
    return {label,color,path,handle,display:handle?(label==='Discord'?`discord.gg/${handle}`:`@${handle}`):label,href:address.href};
  }
  let socialPreview=null,previewTimer=0,hideTimer=0;
  const previewCache=new Map();
  function hideSocialPreview(){
    clearTimeout(previewTimer);clearTimeout(hideTimer);const current=socialPreview;if(!current)return;socialPreview=null;current.abort.abort();current.observer.disconnect();current.anchor.setAttribute('aria-expanded','false');current.host.remove();
    if(current.requestId)try{Promise.resolve(KickRefined.api.runtime.sendMessage({type:'immersion:preview-cancel',requestId:current.requestId})).catch(()=>{});}catch{}
  }
  const deferHide=()=>{clearTimeout(previewTimer);clearTimeout(hideTimer);hideTimer=setTimeout(hideSocialPreview,160);};
  function showSocialPreview(anchor,identity,point=null){
    hideSocialPreview();if(!anchor.isConnected)return;
    const host=document.createElement('div');host.id='kr-social-preview';host.setAttribute('popover','manual');host.style.cssText='position:fixed;inset:auto;margin:0;padding:0;border:0;background:transparent;overflow:visible;z-index:2147483647';
    const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=`
:host{color-scheme:dark;font:11px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;color:#e9e9f0}
*{box-sizing:border-box}[hidden]{display:none!important}
.card{width:min(320px,calc(100vw - 24px));max-height:min(480px,calc(100dvh - 24px));overflow:auto;border:1px solid #ffffff1b;border-radius:10px;background:#121218;box-shadow:0 8px 28px #0007;scrollbar-width:thin}
.card[data-provider=x]{background:#101012}.card[data-provider=instagram]{background:#17151b;border-color:#e4408b30}.card[data-provider=tiktok]{background:#101216;border-color:#25f4ee28}.card[data-provider=youtube]{background:#151516;border-color:#ff424228}.card[data-provider=discord]{background:#15161f;border-color:#8b91ff38}
.cover{display:none;position:relative;overflow:hidden}.card[data-banner=true] .cover{display:block;height:64px}.cover>img{display:block;width:100%;height:100%;object-fit:cover}
.profile-body{padding:12px}.identity{position:relative;display:flex;align-items:center;gap:9px;min-width:0}.avatar{display:grid;place-items:center;width:40px;height:40px;flex:none;overflow:hidden;border-radius:50%;background:#262630;color:var(--social-color)}.avatar img{width:100%;height:100%;object-fit:cover}.avatar svg{width:21px;height:21px;fill:currentColor}
.card[data-banner=true] .profile-body{padding-top:0}.card[data-banner=true] .identity{margin-top:-13px}.card[data-banner=true] .avatar{width:46px;height:46px;border:3px solid #121218}.card[data-banner=true] .words,.card[data-banner=true] .platform{padding-top:12px}
.words{flex:1;min-width:0}.name{display:flex;align-items:center;gap:4px;font-size:13px;font-weight:650;line-height:1.3;overflow-wrap:anywhere}.handle{margin-top:2px;color:#89899d;font-size:10px;overflow-wrap:anywhere}.platform{display:flex;align-items:center;gap:4px;align-self:flex-start;flex:none;color:#9292a6;font-size:9px;white-space:nowrap}.platform svg{display:block;width:13px;height:13px;fill:var(--social-color)}
.verified{display:inline-flex;flex:none;color:var(--social-color)}.verified svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2}
.description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;margin:9px 0 0;color:#c4c4d2;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}.description:empty,.details:empty,.stats:empty,.gallery:empty,.status:empty,.uploads-note:empty{display:none}
.stats{display:flex;flex-wrap:wrap;gap:7px 12px;margin-top:9px}.stat{display:inline-flex;align-items:baseline;gap:4px}.stat strong{color:#ededf5;font-size:11px;font-weight:650}.stat small{color:#8f8fa2;font-size:10px}.details{margin-top:7px;color:#85859a;font-size:10px}
.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:10px}.gallery a{display:block;position:relative;aspect-ratio:1;margin:0;padding:0;overflow:hidden;border:1px solid #ffffff08;border-radius:6px;background:#22222b}.gallery img{display:block;width:100%;height:100%;object-fit:cover}
.gallery[data-format=portrait]{grid-template-columns:repeat(2,minmax(0,1fr));max-width:206px;gap:6px}.gallery[data-format=portrait] a{aspect-ratio:3/4}.gallery[data-format=landscape]{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.gallery[data-format=landscape] a{aspect-ratio:auto;background:none;border:0}
.post-thumbnail{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;border-radius:6px;background:#22222b}.post-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin-top:4px;color:#b9bacb;font-size:10px;line-height:1.35}.post-play{position:absolute;right:4px;bottom:4px;display:grid;place-items:center;padding:2px 4px;border-radius:3px;background:#000b;color:#fff;font-size:9px}.post-play svg{width:11px;height:11px;fill:currentColor}
a{color:var(--social-color);text-decoration:none}a:hover{text-decoration:underline}a:focus-visible,.retry:focus-visible{outline:2px solid var(--social-color);outline-offset:3px}.open{display:block;margin-top:10px;padding-top:8px;border-top:1px solid #ffffff0b;font-size:10px;font-weight:500}
.status,.uploads-note{margin:9px 0 0;color:#8b8b9f;font-size:10px}.retry{margin-top:8px;padding:4px 8px;border:1px solid #ffffff18;border-radius:5px;background:#ffffff05;color:#c6c6d6;font:inherit;font-size:10px;cursor:pointer}.retry:disabled{opacity:.5}.card[aria-busy=true] .avatar{opacity:.5}
.tip{position:absolute;bottom:-4px;width:8px;height:8px;transform:rotate(45deg);background:#15151c;border-right:1px solid #ffffff1b;border-bottom:1px solid #ffffff1b;pointer-events:none}:host([data-placement=below]) .tip{top:-4px;bottom:auto;transform:rotate(225deg)}
    `;
    const card=document.createElement('section');card.className='card';card.id='social-preview-card';card.dataset.provider=identity.label.toLowerCase();card.setAttribute('role','dialog');card.setAttribute('aria-label',`${identity.label} profile preview`);card.style.setProperty('--social-color',identity.color);
    const heading=document.createElement('div');heading.className='identity';const avatar=document.createElement('span');avatar.className='avatar';avatar.setAttribute('aria-hidden','true');avatar.innerHTML=`<svg viewBox="0 0 24 24"><path d="${identity.path}"/></svg>`;
    const words=document.createElement('div');words.className='words';const platform=document.createElement('div');platform.className='platform';platform.textContent=identity.label;const name=document.createElement('div');name.className='name';name.textContent=identity.display;const handle=document.createElement('div');handle.className='handle';words.append(platform,name,handle);heading.append(avatar,words);
    const description=document.createElement('p');description.className='description';
    const stats=document.createElement('div');stats.className='stats';
    const cover=document.createElement('div');cover.className='cover';platform.prepend(avatar.firstElementChild.cloneNode(true));heading.append(platform);
    const gallery=document.createElement('div');gallery.className='gallery';gallery.setAttribute('aria-label','Recent posts');const details=document.createElement('div');details.className='details';
    const status=document.createElement('p');status.className='status';status.setAttribute('role','status');status.textContent='Loading profile…';const retry=document.createElement('button');retry.className='retry';retry.type='button';retry.textContent='Retry preview';retry.hidden=true;const uploads=document.createElement('p');uploads.className='uploads-note';
    const open=link(identity.href);open.className='open';open.textContent=identity.label==='Discord'?'Open Discord community ↗':`View full ${identity.label} profile ↗`;const body=document.createElement('div');body.className='profile-body';body.append(heading,description,stats,details,gallery,uploads,status,retry,open);card.append(cover,body);card.setAttribute('aria-busy','true');const tip=document.createElement('span');tip.className='tip';tip.setAttribute('aria-hidden','true');shadow.append(style,card,tip);document.body.append(host);
    const abort=new AbortController(),observer=new MutationObserver(records=>{if(!anchor.isConnected||records.some(record=>record.type==='attributes')&&!anchor.getClientRects().length)hideSocialPreview();});const current=socialPreview={host,anchor,abort,observer,requestId:null};anchor.setAttribute('aria-expanded','true');observer.observe(anchor.getRootNode(),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});observer.observe(document.documentElement,{childList:true,subtree:true});
    const position=()=>{
      if(socialPreview!==current)return;if(!anchor.isConnected){hideSocialPreview();return;}
      const source=anchor.getBoundingClientRect();if(source.bottom<=0||source.top>=innerHeight){hideSocialPreview();return;}
      const box=host.getBoundingClientRect(),cursor=point&&point.x>=source.left&&point.x<=source.right&&point.y>=source.top&&point.y<=source.bottom?point:null,x=cursor?.x??source.left+source.width/2,y=cursor?.y??source.top;
      const above=y-box.height-12,below=source.bottom+10,left=Math.max(12,Math.min(x-box.width/2,innerWidth-box.width-12));host.dataset.placement=above>=12?'above':'below';
      host.style.left=`${left}px`;host.style.top=`${above>=12?above:Math.max(12,Math.min(below,innerHeight-box.height-12))}px`;tip.style.left=`${Math.max(12,Math.min(x-left-4,box.width-20))}px`;
    };
    try{host.showPopover();}catch{}position();
    host.addEventListener('pointerenter',()=>clearTimeout(hideTimer),{signal:abort.signal});host.addEventListener('pointerleave',deferHide,{signal:abort.signal});
    host.addEventListener('focusin',()=>clearTimeout(hideTimer),{signal:abort.signal});host.addEventListener('focusout',deferHide,{signal:abort.signal});
    window.addEventListener('scroll',position,{capture:true,passive:true,signal:abort.signal});window.addEventListener('resize',position,{passive:true,signal:abort.signal});window.addEventListener('blur',hideSocialPreview,{signal:abort.signal});window.addEventListener('popstate',hideSocialPreview,{signal:abort.signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hideSocialPreview();anchor.focus({preventScroll:true});clearTimeout(previewTimer);}},{capture:true,signal:abort.signal});
    document.addEventListener('pointerdown',event=>{if(!event.composedPath().includes(anchor)&&!event.composedPath().includes(host))hideSocialPreview();},{capture:true,signal:abort.signal});
    const render=data=>{
      if(socialPreview!==current)return;card.setAttribute('aria-busy','false');status.textContent='';retry.hidden=true;name.textContent=data.author||identity.display;
      card.dataset.banner=String(!!KickRefinedSocialData.image(data.banner,data.provider));gallery.dataset.format=data.provider==='youtube'?'landscape':data.provider==='tiktok'?'portrait':'square';uploads.textContent=data.postsEmpty?'No public videos on this profile.':'';
      if(data.verified){const badge=document.createElement('span');badge.className='verified';badge.title='Verified profile';badge.setAttribute('aria-label','Verified profile');badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';name.append(badge);}
      handle.textContent=data.provider==='discord'?identity.display:data.handle?`@${data.handle}`:'';description.textContent=typeof data.description==='string'?data.description.slice(0,3000):'';details.textContent=typeof data.location==='string'?data.location:'';
      for(const [value,parent]of [[data.avatar,avatar],[data.banner,cover]]){const safe=globalThis.KickRefinedSocialData?.image(value,data.provider);if(!safe)continue;const picture=image(safe);if(!picture)continue;picture.addEventListener('load',position,{once:true});if(parent===avatar)avatar.replaceChildren(picture);else{cover.querySelector('img')?.remove();cover.prepend(picture);}}
      stats.replaceChildren();for(const key of ['followers','following','posts','videos','likes','members','online']){const count=data.stats?.[key];if(!Number.isSafeInteger(count)||count<0)continue;const item=document.createElement('span');item.className='stat';item.title=`${count.toLocaleString('en-US')} ${key}`;const value=document.createElement('strong');value.textContent=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(count);const label=document.createElement('small');label.textContent=key;item.append(value,label);stats.append(item);}
      gallery.replaceChildren();for(const post of Array.isArray(data.posts)?data.posts.slice(0,['tiktok','youtube'].includes(data.provider)?2:6):[]){const href=KickRefinedSocialData.post(post.href,data.provider),src=KickRefinedSocialData.image(post.image,data.provider);if(!href||!src)continue;const anchor=link(href),picture=image(src,typeof post.title==='string'?post.title.slice(0,300):'Recent post');if(!picture)continue;anchor.setAttribute('aria-label',picture.alt);picture.addEventListener('error',()=>{anchor.remove();position();},{once:true});
        const video=['youtube','tiktok'].includes(data.provider),thumbnail=data.provider==='youtube'?document.createElement('span'):anchor;if(thumbnail!==anchor){thumbnail.className='post-thumbnail';anchor.append(thumbnail);}thumbnail.append(picture);
        if(video){const play=document.createElement('span');play.className='post-play';play.setAttribute('aria-hidden','true');if(typeof post.duration==='string'&&post.duration)play.textContent=post.duration;else play.innerHTML='<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>';thumbnail.append(play);}
        if(data.provider==='youtube'){const title=document.createElement('span');title.className='post-title';title.textContent=picture.alt;anchor.append(title);}gallery.append(anchor);
      }position();
    };
    const cached=previewCache.get(identity.href);if(cached&&Date.now()-cached.time<120000){render(cached.data);return;}
    const item=globalThis.KickRefinedSocialData?.parse(identity.href),unavailable=()=>{if(socialPreview!==current)return;card.setAttribute('aria-busy','false');retry.disabled=false;retry.hidden=false;status.textContent='This public profile could not be loaded. Try again or view the full profile.';position();};
    const request=(again=false)=>{
      if(!item||!globalThis.KickRefined?.api?.runtime?.sendMessage){unavailable();retry.hidden=true;return;}
      card.setAttribute('aria-busy','true');status.textContent='Loading profile…';retry.disabled=true;const requestId=current.requestId=crypto.randomUUID();
      Promise.resolve().then(()=>KickRefined.api.runtime.sendMessage({type:'immersion:social-profile',href:item.href,requestId,retry:again})).then(result=>{current.requestId=null;if(socialPreview!==current)return;if(!result?.ok||result.item?.provider!==item.provider||result.item?.id!==item.id){unavailable();return;}previewCache.set(identity.href,{data:result.item,time:Date.now()});while(previewCache.size>30)previewCache.delete(previewCache.keys().next().value);render(result.item);}).catch(()=>{current.requestId=null;unavailable();});
    };
    retry.addEventListener('click',()=>request(true),{signal:abort.signal});request();
  }
  function decorateSocials(root){
    for(const anchor of root.querySelectorAll('a[href]')){
      if(anchor.dataset.socialPlatform||anchor.querySelector('img'))continue;
      const identity=socialIdentity(anchor.href);if(!identity)continue;
      const {label,color,path}=identity;anchor.dataset.socialPlatform=label;anchor.classList.add('profile-social-link');anchor.style.setProperty('--social-color',color);anchor.removeAttribute('title');anchor.setAttribute('aria-label',`${label}: ${identity.display}`);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);const text=document.createElement('span');text.textContent=identity.display;anchor.replaceChildren(svg,text);
      let point=null;const remember=event=>{point={x:event.clientX,y:event.clientY};};
      const schedule=event=>{if(event?.type==='pointerenter')remember(event);else point=null;clearTimeout(hideTimer);clearTimeout(previewTimer);if(socialPreview?.anchor===anchor)return;previewTimer=setTimeout(()=>showSocialPreview(anchor,identity,point),170);};anchor.addEventListener('pointerenter',schedule);anchor.addEventListener('pointermove',remember);anchor.addEventListener('pointerleave',deferHide);anchor.addEventListener('focus',schedule);anchor.addEventListener('blur',deferHide);
      anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-expanded','false');anchor.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)&&socialPreview?.anchor===anchor){event.preventDefault();socialPreview.host.shadowRoot.querySelector('a.open')?.focus();}});
    }
  }
  function inline(parent,text,depth=0){
    if(depth>5){parent.append(document.createTextNode(text));return;}
    const tokens=/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|(?<!\w)_(\w[^_]*?)_(?!\w)/g;
    let start=0;
    for(const match of text.matchAll(tokens)){
      parent.append(document.createTextNode(text.slice(start,match.index)));let node;
      if(match[2])node=image(match[2],match[1]);
      else if(match[4]){node=link(match[4]);if(node)inline(node,match[3],depth+1);}
      else {node=document.createElement(match[5]||match[6]?'strong':match[7]?'code':'em');node.textContent=match[5]||match[6]||match[7]||match[8]||match[9];}
      parent.append(node||document.createTextNode(match[0]));start=match.index+match[0].length;
    }
    parent.append(document.createTextNode(text.slice(start)));
  }
  function formatted(parent,input){
    const text=typeof input==='string'?input.slice(0,20000).replace(/\r\n?/g,'\n'):'';
    // HTML sometimes appears in panel descriptions. Rebuild only readable tags.
    if(/<(?:p|div|br|img|h[1-6]|ul|ol|strong|a)\b/i.test(text)){
      const parsed=new DOMParser().parseFromString(text,'text/html');
      function copy(source,target,depth=0){
        if(depth>24)return;
        for(const child of source.childNodes){
          if(child.nodeType===3){target.append(document.createTextNode(child.textContent));continue;}
          if(child.nodeType!==1||/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|FORM|INPUT|META|LINK)$/.test(child.tagName))continue;
          let node;if(child.tagName==='IMG')node=image(child.getAttribute('src'),child.getAttribute('alt')||'');
          else if(child.tagName==='A')node=link(child.getAttribute('href'));
          else if(/^(P|DIV|BR|STRONG|B|EM|I|U|S|H[1-6]|UL|OL|LI|BLOCKQUOTE|CODE|PRE|HR|TABLE|THEAD|TBODY|TR|TH|TD)$/.test(child.tagName))node=document.createElement(child.tagName.toLowerCase());
          if(node){if(child.tagName!=='IMG')copy(child,node,depth+1);target.append(node);}else copy(child,target,depth+1);
        }
      }
      copy(parsed.body,parent);return;
    }
    let paragraph=null,list=null,code=null;
    for(const line of text.split('\n')){
      if(/^```/.test(line)){if(code){code=null;}else{const pre=document.createElement('pre');code=document.createElement('code');pre.append(code);parent.append(pre);}paragraph=list=null;continue;}
      if(code){code.append(document.createTextNode(line+'\n'));continue;}
      if(!line.trim()){paragraph=list=null;continue;}
      const heading=/^(#{1,6})\s+(.+)/.exec(line),item=/^\s*([-*+]|\d+\.)\s+(.+)/.exec(line);
      if(heading){const h=document.createElement(`h${Math.min(6,heading[1].length+2)}`);inline(h,heading[2]);parent.append(h);paragraph=list=null;}
      else if(item){const tag=/\d/.test(item[1])?'ol':'ul';if(!list||list.tagName.toLowerCase()!==tag){list=document.createElement(tag);parent.append(list);}const li=document.createElement('li');inline(li,item[2]);list.append(li);paragraph=null;}
      else if(/^>\s?/.test(line)){const quote=document.createElement('blockquote');inline(quote,line.replace(/^>\s?/,''));parent.append(quote);paragraph=list=null;}
      else if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){parent.append(document.createElement('hr'));paragraph=list=null;}
      else{list=null;if(!paragraph){paragraph=document.createElement('p');parent.append(paragraph);}else paragraph.append(document.createElement('br'));inline(paragraph,line);}
    }
  }
  globalThis.KickRefinedProfile=Object.freeze({formatted,image,link,url,decorateSocials,socialIdentity});
})();
