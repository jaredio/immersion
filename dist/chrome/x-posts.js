/* Small, lazy chat cards. No remote widgets, scripts, or automatic playback. */
(() => {
  const {parse}=KickRefinedXData;
  const css=`:host{display:block;color:#eee;font:13px/1.45 system-ui,sans-serif;text-align:left;color-scheme:dark}*{box-sizing:border-box}a{color:inherit;text-decoration:none}a:hover{color:#a3eed2}button{font:inherit;color:inherit;cursor:pointer}.card{width:calc(100% - 4px);max-width:360px;margin:8px auto 6px;background:#121216;border:1px solid #ffffff14;border-radius:12px;overflow:hidden}.body{padding:12px}.author{display:flex;align-items:center;gap:9px;min-width:0}.avatar{width:32px;height:32px;object-fit:cover;border-radius:50%;background:#24242c}.identity{flex:1;min-width:0}.name{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.handle{color:#90909e;font-size:11px}.brand{display:flex;align-items:center;color:#eee;flex:none}.brand svg{width:17px;height:17px}.text{white-space:pre-wrap;overflow-wrap:anywhere;margin:11px 0 0;max-height:240px;overflow:auto;line-height:1.5}.media{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:2px;margin-top:11px;border-radius:8px;overflow:hidden}.media img{display:block;width:100%;max-height:210px;object-fit:cover}.media.video{position:relative}.video span{position:absolute;bottom:8px;left:8px;padding:3px 7px;background:#000b;border-radius:5px;font-size:11px}.footer{display:flex;align-items:center;gap:12px;padding:8px 11px;border-top:1px solid #ffffff0b;color:#a0a0ad;font-size:11px}.stat{display:flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums}.actions{display:flex;gap:3px;margin-left:auto}button,.open{display:grid;place-items:center;width:25px;height:25px;border:0;border-radius:6px;background:transparent}button:hover,.open:hover{background:#ffffff0c;color:#eee}svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}svg.filled{fill:currentColor;stroke:none;flex:none}.loading{padding:12px;color:#92929e;font-size:12px;display:flex;align-items:center;gap:8px}.retry{width:auto;padding:0 6px;color:#a3eed2}`;
  const icons={like:'<path d="M17.06 3a5.7 5.7 0 0 1 4.81 3.16c.94 1.9.89 4.36-.54 6.98-1.42 2.61-4.2 5.4-8.83 8.09l-.5.29-.5-.3c-4.62-2.68-7.4-5.47-8.83-8.08S1.2 8.05 2.13 6.16a5.7 5.7 0 0 1 4.8-3.15c1.75-.09 3.56.6 5.07 2.15a6.6 6.6 0 0 1 5.06-2.15m-.1 2c-1.3-.06-2.86.55-4.15 2.3L12 8.4l-.81-1.1C9.9 5.55 8.35 4.94 7.04 5a3.7 3.7 0 0 0-3.12 2.05c-.6 1.2-.67 2.97.5 5.14 1.15 2.1 3.47 4.53 7.58 7 4.1-2.47 6.43-4.9 7.57-7 1.18-2.17 1.1-3.94.5-5.14A3.7 3.7 0 0 0 16.98 5"/>',repost:'<path d="M13.1 4q1.65-.01 2.71.06c.73.06 1.37.18 1.96.48a5 5 0 0 1 2.19 2.19 5 5 0 0 1 .48 1.96q.08 1.06.06 2.71v5.05l2.07-1.93 1.36 1.46-4.43 4.14-4.43-4.14 1.36-1.46 2.07 1.93V11.4c0-1.14 0-1.93-.05-2.55a3 3 0 0 0-.27-1.21 3 3 0 0 0-1.32-1.31 3 3 0 0 0-1.21-.28C15.03 6 14.24 6 13.1 6H11V4zM8.93 8.02 7.57 9.48 5.5 7.55v5.05c0 1.14 0 1.93.05 2.55.05.6.15.95.28 1.21a3 3 0 0 0 1.31 1.31c.26.14.61.23 1.22.28s1.4.05 2.54.05H13v2h-2.1q-1.64.02-2.7-.06a5 5 0 0 1-1.97-.48 5 5 0 0 1-2.18-2.19 5 5 0 0 1-.49-1.96q-.08-1.06-.06-2.7V7.54L1.43 9.48.07 8.02 4.5 3.88z"/>',open:'<path d="M14 3h7v7m0-7L10 14M10 3H4v17h17v-6"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'};
  // Filled brand, repost, heart and analytics paths from https://x.com; bundled locally.
  Object.assign(icons,{brand:'<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',views:'<path d="M6 21H4V11h2zm4.66 0h-2V3h2zm4.67 0h-2v-7h2zM20 21h-2V8h2z"/>'});
  function svg(kind){return `<svg class="${['brand','repost','like','views'].includes(kind)?'filled':''}" viewBox="0 0 24 24" aria-hidden="true">${icons[kind]}</svg>`;}
  function create({enabled=true}={}){
    let list,timer,disposed=false;
    const records=new Set(),dirty=new Set(),api=KickRefined.api;
    const nativeStyle=document.createElement('style');nativeStyle.textContent='[data-kr-x-link]{display:none!important}';document.head.append(nativeStyle);
    const visibility=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const record=[...records].find(r=>r.host===entry.target);if(record)load(record);}}, {rootMargin:'80px'});
    function release(record){visibility.unobserve(record.host);record.host.remove();for(const link of record.links)link.removeAttribute('data-kr-x-link');records.delete(record);clearTimeout(record.feedback);}
    function hideLinks(record){for(const link of record.links)link.setAttribute('data-kr-x-link','');}
    function button(label,kind,click){const el=document.createElement('button');el.type='button';el.title=label;el.setAttribute('aria-label',label);el.innerHTML=svg(kind);el.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();click(el);});return el;}
    function render(record,post){
      const card=record.card;card.replaceChildren();
      const body=document.createElement('div');body.className='body';
      const author=document.createElement('a');author.className='author';author.href=`https://x.com/${post.handle}`;author.target='_blank';author.rel='noopener noreferrer';
      if(post.avatar){const img=document.createElement('img');img.className='avatar';img.src=post.avatar;img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';author.append(img);}
      const identity=document.createElement('div');identity.className='identity';const name=document.createElement('div');name.className='name';name.textContent=post.name;const handle=document.createElement('div');handle.className='handle';handle.textContent=`@${post.handle}`;identity.append(name,handle);
      const brand=document.createElement('span');brand.className='brand';brand.innerHTML=svg('brand');brand.title='X';author.append(identity,brand);body.append(author);
      if(post.text){const text=document.createElement('div');text.className='text';text.textContent=post.text;body.append(text);}
      const photos=post.photos.length?post.photos:post.videoPoster?[post.videoPoster]:[];
      if(photos.length){const media=document.createElement('a');media.className='media'+(!post.photos.length?' video':'');media.href=post.href;media.target='_blank';media.rel='noopener noreferrer';media.title='View media on X';for(const url of photos){const img=document.createElement('img');img.src=url;img.alt='Post media';img.loading='lazy';img.referrerPolicy='no-referrer';media.append(img);}if(!post.photos.length){const label=document.createElement('span');label.textContent='▶ View video on X';media.append(label);}body.append(media);}
      const footer=document.createElement('div');footer.className='footer';
      for(const [key,kind,label]of [['reposts','repost','reposts'],['likes','like','likes'],['views','views','views']]){const stat=document.createElement('span');stat.className='stat';const value=post[key];stat.title=value===null?`${label} unavailable`:`${value.toLocaleString('en-US')} ${label}`;stat.setAttribute('aria-label',stat.title);stat.innerHTML=svg(kind);stat.append(document.createTextNode(value===null?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value)));footer.append(stat);}
      const actions=document.createElement('div');actions.className='actions';actions.append(button('Copy post link','copy',async el=>{try{await navigator.clipboard.writeText(post.href);el.title='Copied';}catch{el.title='Could not copy';}clearTimeout(record.feedback);record.feedback=setTimeout(()=>{el.title='Copy post link';},1500);}));
      const open=document.createElement('a');open.className='open';open.href=post.href;open.target='_blank';open.rel='noopener noreferrer';open.title='Open post on X';open.setAttribute('aria-label',open.title);open.innerHTML=svg('open');actions.append(open);footer.append(actions);card.append(body,footer);hideLinks(record);
    }
    async function load(record){
      if(record.loading||record.loaded||!enabled||disposed)return;
      record.loading=true;
      try{
        const result=await api.runtime.sendMessage({type:'immersion:x-post',href:record.post.href});
        if(!records.has(record)||!enabled||disposed)return;
        if(!result?.ok)throw Error('Unavailable');
        record.loaded=true;visibility.unobserve(record.host);render(record,result.post);
      }catch{
        if(!records.has(record)||!enabled||disposed)return;
        visibility.unobserve(record.host);record.card.replaceChildren();const fallback=document.createElement('div');fallback.className='loading';fallback.textContent='X preview unavailable';const retry=document.createElement('button');retry.className='retry';retry.textContent='Retry';retry.addEventListener('click',()=>load(record));fallback.append(retry);record.card.append(fallback);
      }finally{record.loading=false;}
    }
    function add(row,anchor,post){
      const host=document.createElement('div');host.className='kr-x-post';const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=css+KickRefined.chatEmbedCSS;const card=document.createElement('div');card.className='card';const loading=document.createElement('div');loading.className='loading';loading.textContent='Loading X post…';card.append(loading);shadow.append(style,card);
      const record={row,host,card,post,links:new Set([anchor])};records.add(record);row.append(host);visibility.observe(host);
    }
    function flush(){
      timer=0;if(!enabled||disposed)return;
      for(const record of [...records]){
        for(const link of record.links)if(!record.row.contains(link)||parse(link.href)?.id!==record.post.id){link.removeAttribute('data-kr-x-link');record.links.delete(link);}
        if(!list?.contains(record.row)||!record.links.size)release(record);
      }
      for(const row of dirty){
        if(!list?.contains(row))continue;const seen=new Set();
        for(const anchor of row.querySelectorAll('a[href]')){const post=parse(anchor.href);if(!post)continue;const existing=[...records].find(record=>record.row===row&&record.post.id===post.id);if(existing){existing.links.add(anchor);if(existing.loaded)hideLinks(existing);continue;}if(seen.size>=2||records.size>=80)continue;seen.add(post.id);add(row,anchor,post);}
      }
      dirty.clear();
    }
    function queue(node,descendants=true){if(node.nodeType!==1)return;const row=node.closest('[data-index]');if(row)dirty.add(row);if(descendants)for(const row of node.querySelectorAll('[data-index]'))dirty.add(row);}
    function schedule(){if(!timer&&enabled&&!disposed)timer=setTimeout(flush,60);}
    const observer=new MutationObserver(changes=>{for(const change of changes){queue(change.target,false);for(const node of change.addedNodes)queue(node);}schedule();});
    function refresh(){const next=enabled?document.getElementById('chatroom-messages'):null;if(next===list)return;observer.disconnect();for(const record of [...records])release(record);dirty.clear();list=next;if(list){queue(list);observer.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});schedule();}}
    const routeObserver=new MutationObserver(()=>{if(enabled&&(!list||!list.isConnected))refresh();});routeObserver.observe(document.documentElement,{subtree:true,childList:true});refresh();
    return {setEnabled(value){if(enabled===value)return;enabled=value;clearTimeout(timer);timer=0;refresh();},destroy(){disposed=true;clearTimeout(timer);observer.disconnect();routeObserver.disconnect();visibility.disconnect();for(const record of [...records])release(record);dirty.clear();nativeStyle.remove();}};
  }
  globalThis.KickRefinedX=Object.freeze({create});
})();
