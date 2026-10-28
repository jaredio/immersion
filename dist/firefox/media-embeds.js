/* Uniform, click-to-play video/profile cards. No provider widget scripts in Kick. */
(() => {
  const data=KickRefinedMediaData,ui=KickRefinedEmbedUI;
  const labels={x:'X',tiktok:'TikTok',youtube:'YouTube'};
  // Brand glyphs bundled from simple-icons/simple-icons (TikTok and YouTube).
  const paths={tiktok:'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',youtube:'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'};
  function logo(provider){return provider==='x'?ui.svg('brand'):`<svg class="filled" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[provider]}"/></svg>`;}
  const person='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m3-16a3 3 0 0 1 0 6m0 4a5 5 0 0 1 3 5"/></svg>';
  function create({media=true,profiles=true}={}){
    const api=KickRefined.api,records=new Set(),dirty=new Set();let list=null,timer=0,disposed=false;
    const allowed=item=>item.provider==='x'?profiles:media;
    const hidden=document.createElement('style');hidden.textContent='[data-kr-media-link]{display:none!important}';document.head.append(hidden);
    function stop(record){if(!record.frame)return;record.frame.remove();record.frame=null;record.slot?.querySelector('.player')?.remove();record.slot?.querySelector('.player-close')?.remove();if(record.preview)record.preview.hidden=false;}
    const visibility=new IntersectionObserver(entries=>{for(const entry of entries){const record=[...records].find(record=>record.host===entry.target);if(record){if(entry.isIntersecting)load(record);else stop(record);}}},{rootMargin:'80px'});
    function release(record){stop(record);record.releaseMessage?.();visibility.unobserve(record.host);record.host.remove();for(const link of record.links)link.removeAttribute('data-kr-media-link');clearTimeout(record.feedback);records.delete(record);}
    function button(label,icon,action){const node=document.createElement('button');node.type='button';node.title=label;node.setAttribute('aria-label',label);node.innerHTML=icon;node.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();action();});return node;}
    function open(href,label,icon){const node=document.createElement('a');node.href=href;node.target='_blank';node.rel='noopener noreferrer';node.className='open';node.title=label;node.setAttribute('aria-label',label);node.innerHTML=icon;return node;}
    function render(record,item){
      record.item=item;record.releaseMessage??=KickRefined.chatEmbedMessage(record.row);record.card.replaceChildren();const body=document.createElement('div');body.className='body';
      const author=document.createElement('a');author.className='author';author.href=item.authorHref||(item.provider==='tiktok'?`https://www.tiktok.com/@${item.handle}`:item.href);author.target='_blank';author.rel='noopener noreferrer';
      const avatar=item.avatar?document.createElement('img'):document.createElement('span');avatar.className='avatar'+(item.avatar?'':' initial');if(item.avatar){avatar.src=item.avatar;avatar.alt='';avatar.loading='lazy';avatar.referrerPolicy='no-referrer';}else avatar.textContent=(item.author||item.handle||labels[item.provider]).slice(0,1).toUpperCase();
      const identity=document.createElement('div');identity.className='identity';const name=document.createElement('div');name.className='name';name.textContent=item.author||item.handle||labels[item.provider];const handle=document.createElement('div');handle.className='handle';handle.textContent=item.handle?`@${item.handle}`:`${labels[item.provider]} · ${item.shorts?'Short':'Video'}`;identity.append(name,handle);
      const brand=document.createElement('span');brand.className=`brand ${item.provider}`;brand.title=labels[item.provider];brand.innerHTML=logo(item.provider);author.append(avatar,identity,brand);body.append(author);
      const description=item.kind==='profile'?item.description:item.title;
      if(description){const text=document.createElement('div');text.className='text'+(item.kind==='profile'?'':' embed-title');text.textContent=description;body.append(text);}
      if(item.kind==='video'){
        const slot=document.createElement('div');slot.className='video-slot'+(item.provider==='tiktok'||item.shorts?' portrait':'');slot.style.marginTop='11px';record.slot=slot;
        const preview=button(`Play ${labels[item.provider]} ${item.shorts?'Short':'video'}`,'',()=>{
          for(const other of records)stop(other);
          const frame=document.createElement('iframe');frame.src=data.player(item);frame.title=`${labels[item.provider]} video player`;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;
          const player=document.createElement('div');player.className='player';player.append(frame);record.frame=frame;preview.hidden=true;
          const close=button('Close embedded player','&#10005;',()=>stop(record));close.className='player-close';slot.append(player,close);
        });preview.className='video-preview';record.preview=preview;
        if(item.thumbnail){const image=document.createElement('img');image.src=item.thumbnail;image.alt='Video preview';image.loading='lazy';image.referrerPolicy='no-referrer';preview.append(image);}
        const mark=document.createElement('span');mark.className='play-badge';mark.innerHTML=ui.playSVG;preview.append(mark);const time=ui.duration(item.duration);if(time){const duration=document.createElement('span');duration.className='duration';duration.textContent=time;preview.append(duration);}slot.append(preview);body.append(slot);
      }
      const footer=document.createElement('div');footer.className='footer';
      for(const [kind,value] of Object.entries(item.stats||{})){
        if(data.count(value)===null)continue;const stat=document.createElement('span');stat.className='stat';stat.title=`${value.toLocaleString('en-US')} ${kind}`;stat.setAttribute('aria-label',stat.title);
        stat.innerHTML=['followers','following'].includes(kind)?person:['likes','shares','views'].includes(kind)?ui.svg({likes:'like',shares:'repost',views:'views'}[kind]):ui.playSVG;
        stat.append(document.createTextNode(new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value)));footer.append(stat);
      }
      if(!footer.childNodes.length){const type=document.createElement('span');type.className='handle';type.textContent=item.kind==='profile'?'Profile':item.shorts?'Short':'Video';footer.append(type);}
      const actions=document.createElement('div');actions.className='actions';const copy=button('Copy link',ui.svg('copy'),async()=>{try{await navigator.clipboard.writeText(item.href);copy.title='Copied';}catch{copy.title='Could not copy';}clearTimeout(record.feedback);record.feedback=setTimeout(()=>copy.title='Copy link',1500);});
      actions.append(copy,open(item.href,`Open on ${labels[item.provider]}`,ui.svg('open')));footer.append(actions);record.card.append(body,footer);for(const link of record.links)link.setAttribute('data-kr-media-link','');
    }
    async function load(record,retry=false){
      if(record.loading||record.loaded||disposed||!allowed(record.item))return;record.loading=true;
      try{const result=await api.runtime.sendMessage({type:'immersion:media-preview',href:record.item.href,retry});if(!records.has(record)||disposed||!allowed(record.item))return;if(!result?.ok)throw Error('Unavailable');record.loaded=true;render(record,result.item);}
      catch{if(!records.has(record)||disposed)return;record.card.replaceChildren();const fallback=document.createElement('div');fallback.className='loading';fallback.textContent=`${labels[record.item.provider]} preview unavailable`;const retry=button('Retry preview','Retry',()=>load(record,true));retry.className='retry';fallback.append(retry);record.card.append(fallback);}
      finally{record.loading=false;}
    }
    function add(row,anchor,item){
      const host=document.createElement('div');host.className='kr-media-embed';host.dataset.provider=item.provider;const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=ui.css+KickRefined.chatEmbedCSS+'.video-preview[hidden]{display:none}:host([data-provider="tiktok"]) .video-slot.portrait{max-width:none;width:100%}:host([data-provider="tiktok"]) .video-preview{height:190px;min-height:0;max-height:none;aspect-ratio:auto;background:#0a0a0e}:host([data-provider="tiktok"]) .video-preview img{object-fit:contain}:host([data-provider="tiktok"]) .portrait .player{height:300px;min-height:0;max-height:300px;aspect-ratio:auto}:host([data-provider="tiktok"]) .embed-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-height:3em}';const card=document.createElement('div');card.className='card';const loading=document.createElement('div');loading.className='loading';loading.textContent=`Loading ${labels[item.provider]}…`;card.append(loading);shadow.append(style,card);
      const record={row,host,card,item,key:item.key,links:new Set([anchor])};records.add(record);row.append(host);visibility.observe(host);
      for(const event of ['click','dblclick','keydown','keyup'])shadow.addEventListener(event,event=>event.stopPropagation());
    }
    function flush(){timer=0;if(disposed)return;
      for(const record of [...records]){
        for(const link of record.links)if(!record.row.contains(link)||data.parse(link.href)?.key!==record.key){link.removeAttribute('data-kr-media-link');record.links.delete(link);}
        if(!list?.contains(record.row)||!record.row.contains(record.host)||!record.links.size||!allowed(record.item))release(record);
      }
      for(const row of dirty){if(!list?.contains(row))continue;const seen=new Set();for(const anchor of row.querySelectorAll('a[href]')){
        const item=data.parse(anchor.href);if(!item||!allowed(item))continue;
        const existing=[...records].find(record=>record.row===row&&record.key===item.key);if(existing){existing.links.add(anchor);if(existing.loaded)anchor.setAttribute('data-kr-media-link','');continue;}
        if(seen.size>=2||records.size>=80)continue;seen.add(item.key);add(row,anchor,item);
      }}dirty.clear();
    }
    function queue(node,descendants=true){if(node.nodeType!==1)return;const row=node.closest('[data-index]');if(row)dirty.add(row);if(descendants)for(const child of node.querySelectorAll('[data-index]'))dirty.add(child);}
    function schedule(){if(!timer&&!disposed&&(media||profiles))timer=setTimeout(flush,60);}
    const observer=new MutationObserver(changes=>{for(const change of changes){queue(change.target,false);for(const node of change.addedNodes)queue(node);}schedule();});
    function refresh(force=false){const next=media||profiles?document.getElementById('chatroom-messages'):null;if(next===list&&!force)return;observer.disconnect();for(const record of [...records])release(record);dirty.clear();list=next;if(list){queue(list);observer.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['href','data-index']});schedule();}}
    const routeObserver=new MutationObserver(()=>{if((media||profiles)&&document.getElementById('chatroom-messages')!==list)refresh();});routeObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['id']});refresh();
    return {setOptions(next){if(media===next.media&&profiles===next.profiles)return;media=!!next.media;profiles=!!next.profiles;clearTimeout(timer);timer=0;refresh(true);},destroy(){disposed=true;clearTimeout(timer);observer.disconnect();routeObserver.disconnect();visibility.disconnect();for(const record of [...records])release(record);dirty.clear();hidden.remove();}};
  }
  globalThis.KickRefinedMedia=Object.freeze({create});
})();
