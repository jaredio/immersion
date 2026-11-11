/* A channel browser with one owned layout. Native media nodes remain action sources. */
(() => {
  const clean=value=>(value||'').replace(/\s+/g,' ').trim().slice(0,600);
  const relativeDates=new WeakMap();
  const titleOrder=new Intl.Collator('en-US',{sensitivity:'base',numeric:true});
  function mediaLink(link,slug){
    if(link.origin!==location.origin)return false;
    const prefix=`/${slug}`,path=link.pathname.replace(/\/$/,'');
    return path.startsWith(prefix+'/')&&/^\/(?:videos|clips)\/[a-z0-9_-]+$/i.test(path.slice(prefix.length))
      ||path===prefix&&/^clip_[a-z0-9]{26}$/i.test(new URLSearchParams(link.search).get('clip')||'');
  }
  function read(card,slug,order=0){
    if(!/^[a-z0-9_]{1,40}$/i.test(slug))return null;
    const links=[...card.querySelectorAll('a[href]')];
    const link=links.find(node=>mediaLink(node,slug));
    if(!link)return null;const url=new URL(link.href),type=url.pathname.includes('/clips/')||url.searchParams.has('clip')?'clip':'vod';
    const image=card.querySelector('img[data-thumbnail]')||links.find(node=>node.href===link.href&&node.querySelector('img'))?.querySelector('img');
    const thumbnail=image?.closest('a,button')||image?.parentElement;
    const heading=card.querySelector('h3,h4,[data-testid="media-card-title"]');
    const titled=links.find(node=>node.href===link.href&&node.getAttribute('title'));
    const title=clean(titled?.getAttribute('title')||heading?.textContent||links.find(node=>node.href===link.href&&!node.querySelector('img'))?.textContent)||'Untitled video';
    let src='';try{const url=new URL(image?.currentSrc||image?.src);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='kick.com'||url.hostname.endsWith('.kick.com')))src=url.href;}catch{}
    const clock=[...(thumbnail||card).querySelectorAll('span,div')].filter(node=>!node.children.length).map(node=>clean(node.textContent)).find(text=>/^(?:\d{1,3}:)?\d{1,2}:\d{2}$/.test(text))||'';
    const duration=clock?clock.split(':').reduce((total,value)=>total*60+Number(value),0):null;
    const viewPattern=/^(\d[\d,.]*)\s*([kmb])?(?:\s+views?)?$/i;
    const preview=thumbnail||card;
    const viewNodes=[preview,...preview.querySelectorAll('[title],[aria-label*="view" i],span')];
    const counts=viewNodes.flatMap(node=>[node.getAttribute('title'),node.getAttribute('aria-label'),node.children.length?null:node.textContent]);
    const match=counts.map(clean).filter(text=>/views?$/i.test(text)||/^\d[\d,.]*\s*[kmb]$/i.test(text)).map(text=>viewPattern.exec(text)).find(Boolean);
    const exact=viewNodes.map(node=>clean(node.getAttribute('title'))).find(text=>/^\d[\d,]*$/.test(text));
    const count=exact?Number(exact.replaceAll(',','')):match?Math.round(Number(match[1].replaceAll(',',''))*({k:1e3,m:1e6,b:1e9}[match[2]?.toLowerCase()]||1)):null;
    const views=Number.isSafeInteger(count)&&count>=0?count:null;
    const time=card.querySelector('time[datetime]');
    const dateHint=[...card.querySelectorAll('[title]')].find(node=>/\bago\b|yesterday|today/i.test(node.textContent))?.title;
    let created=Date.parse(time?.dateTime||dateHint)||0;
    const date=clean(time?.textContent||[...card.querySelectorAll('p,span')].filter(node=>!node.children.length).map(node=>clean(node.textContent)).find(text=>/\bago\b|yesterday|today/i.test(text))).split('·').filter(part=>/ago|yesterday|today/i.test(part)).map(part=>part.trim()).join(' · ');
    if(!created&&date){let cached=relativeDates.get(card);if(cached?.text!==date){const match=/(\d+|an?)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(date),unit=match?{second:1000,minute:60000,hour:3600000,day:86400000,week:604800000,month:2592000000,year:31536000000}[match[2].toLowerCase()]:86400000;const age=match?(Number(match[1])||1)*unit:/yesterday/i.test(date)?86400000:/today/i.test(date)?0:null;cached={text:date,created:age===null?0:Math.floor(Date.now()/unit)*unit-age};relativeDates.set(card,cached);}created=cached.created;}
    const category=clean(card.querySelector('a[href*="/category/"]')?.textContent);
    return {key:link.href,href:link.href,type,title,image:src,clock,duration,views,created,date,category,order,source:link};
  }
  const css=`
    :host([data-profile-library]) .browser{margin:0}
    .status.catalog-status{margin:0 0 12px}.schedule{margin-top:16px}.schedule iframe{display:block;width:100%;height:clamp(340px,65vh,680px);border:1px solid #ffffff10;border-radius:10px;background:#101014}
    .schedule>a{display:inline-block;margin-top:10px;color:var(--accent);font-size:12px}
    :host{display:block;min-width:0;color:#eeeef5;font:13px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;--accent:var(--kr-accent,#b0ff8c);color-scheme:dark}*{box-sizing:border-box}button,input,select{font:inherit}a{color:inherit;text-decoration:none}button,a,input,select{outline-offset:3px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent)}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}[hidden]{display:none!important}
    .browser{margin:18px 0 30px}.nav{display:flex;align-items:center;gap:5px;border-bottom:1px solid #ffffff10;padding:0 0 12px;overflow-x:auto}.nav a{flex:none;padding:8px 13px;border-radius:8px;color:#9393a6;font-weight:600;font-size:12px}.nav a:hover{background:#ffffff06;color:#eee}.nav a[aria-current=page]{color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,#141419)}.nav .secondary{margin-left:auto}
    .watch-heading{font-size:23px;letter-spacing:-.04em;line-height:1.2;margin:24px 0 16px;font-weight:650}.nav+.watch-heading[hidden]+.tools{margin-top:16px}.tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 20px}.find{display:flex;align-items:center;gap:9px;flex:1;min-width:160px;padding:0 12px;border:1px solid #ffffff12;border-radius:9px;background:#121217}.find svg{width:16px;color:#858598}.find input{width:100%;min-width:0;padding:10px 0;background:none;border:0;color:#ececf5;font-size:12px;outline:none}.find:focus-within{border-color:#b0ff8c55}.tools select{border:1px solid #ffffff12;background:#121217;color:#b6b6c6;border-radius:8px;padding:8px;font-size:11px;max-width:150px}.views{display:flex;padding:3px;gap:3px;background:#121217;border:1px solid #ffffff12;border-radius:8px}.views button{border:0;background:transparent;color:#828296;padding:5px 8px;border-radius:5px;font-size:11px}.views button[aria-pressed=true]{background:#ffffff0c;color:#e7e7f1}
    .overview{margin-top:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px}.feature{min-width:0}.eyebrow{color:#818195;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px}.feature .card{display:grid;grid-template-columns:minmax(150px,.85fr) minmax(0,1fr);gap:15px;align-items:start}.feature .thumb{aspect-ratio:16/9}.feature .card-body{padding-top:0}.feature .watch{top:0}.feature .title{font-size:16px;font-weight:600;margin:0 0 5px;line-height:1.4}.feature .meta{font-size:12px}.feature-actions{display:flex;align-items:center;gap:8px;margin-top:15px}.primary{display:inline-flex;align-items:center;gap:7px;background:var(--accent);color:#13200e;border:0;border-radius:8px;padding:8px 13px;font-weight:650;font-size:12px}.secondary-button{display:inline-flex;align-items:center;gap:7px;color:#d0d0df;background:#ffffff05;border:1px solid #ffffff12;border-radius:8px;padding:8px 12px;font-size:12px}.rail{min-width:0;padding-left:26px;border-left:1px solid #ffffff0a}.rail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px}.rail-head h3{font-size:14px;margin:0;font-weight:600}.rail-head a{font-size:11px;color:#9292a7}.rail-head a:hover{color:var(--accent)}.rail-list{display:flex;flex-direction:column;gap:14px}.rail .card{display:grid;grid-template-columns:120px minmax(0,1fr);gap:11px;align-items:start}.rail .card .title{font-size:12px;margin:1px 0 5px}.rail .watch{display:none}.overview .empty{padding:30px 16px}.overview-footer{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid #ffffff0b}.browse-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 15px;border:1px solid #ffffff0e;border-radius:10px;color:#c1c1d2;background:#ffffff02}.browse-link:hover{background:#ffffff05;border-color:#ffffff25}.browse-link span{font-size:11px;color:#808096}
    .items{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(235px,100%),1fr));gap:24px 20px}.card{min-width:0;position:relative;content-visibility:auto;contain-intrinsic-size:auto 230px}.thumb{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;border:1px solid #ffffff09;border-radius:10px;background:linear-gradient(135deg,#23232d,#14141c)}.thumb img{display:block;width:100%;height:100%;object-fit:cover}.thumb:after{content:'▶';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:38px;height:38px;border:1px solid #ffffff25;border-radius:50%;background:#0009;color:white;font-size:13px;opacity:0;transition:opacity .12s}.thumb:hover:after,.thumb:focus-visible:after{opacity:1}.clock{position:absolute;right:7px;bottom:7px;background:#09090cdc;border-radius:4px;padding:2px 5px;font-size:10px;font-variant-numeric:tabular-nums}.card-body{position:relative;padding:10px 29px 0 1px;min-width:0}.title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:13px;font-weight:600;line-height:1.5;color:#e1e1ee}.title:hover{color:var(--accent)}.meta{color:#858599;font-size:11px;margin-top:5px;line-height:1.6}.watch{position:absolute;right:0;top:10px;display:grid;place-items:center;width:24px;height:24px;padding:4px;border:1px solid transparent;border-radius:6px;background:transparent;color:#85859a}.watch svg{width:15px;height:15px}.watch:hover{color:var(--accent);background:#ffffff06;border-color:#ffffff10}
    .items[data-view=list]{display:flex;flex-direction:column;gap:0}.items[data-view=list] .card{display:grid;grid-template-columns:190px minmax(0,1fr);gap:20px;padding:16px 0;border-bottom:1px solid #ffffff09;contain-intrinsic-size:auto 140px}.items[data-view=list] .card-body{padding-top:6px}.items[data-view=list] .title{font-size:15px}.items[data-view=list] .meta{margin-top:9px;font-size:12px}.items[data-view=list] .watch{top:5px}.empty{grid-column:1/-1;padding:44px 20px;border:1px dashed #ffffff13;border-radius:12px;color:#8d8da2;text-align:center;font-size:12px}.empty a{display:inline-block;margin-top:12px;color:var(--accent)}.more{display:block;margin:25px auto 0;padding:9px 18px;border:1px solid #ffffff16;border-radius:8px;background:#ffffff04;color:#d0d0df}.notice{font-size:12px;color:#b7aa9e;margin-top:12px}.status{font-size:11px;color:#85859a;margin:20px 0 0}
    @media(max-width:720px){.overview{grid-template-columns:1fr;gap:25px}.rail{padding:20px 0 0;border-left:0;border-top:1px solid #ffffff0a}.rail .card{grid-template-columns:130px minmax(0,1fr)}.watch-heading{margin-top:20px}.items{gap:20px 14px;grid-template-columns:repeat(auto-fill,minmax(min(210px,100%),1fr))}.items[data-view=list] .card{grid-template-columns:125px minmax(0,1fr);gap:12px}.items[data-view=list] .title{font-size:13px}.nav a{padding:8px 10px}.tools select{flex:1;max-width:none}.find{flex-basis:100%}.overview-footer{gap:8px}.browse-link{padding:11px;font-size:12px}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
  `;
  const svg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>';
  const number=value=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
  function create({onWatch,onDrag,onNavigate,onKeydown,onSort}={}){
    const host=document.createElement('div');host.id='kr-channel-library';const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=css;
    const ui=document.createElement('section');ui.className='browser';ui.setAttribute('aria-label','Channel library');let lastDrag=-Infinity;
    ui.innerHTML='<nav class="nav" aria-label="Channel sections"></nav><h2 class="watch-heading" hidden></h2><div class="tools" hidden><label class="find"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input type="search" aria-label="Find a video" placeholder="Find a recording…"></label><select aria-label="Video length"><option value="all">Any length</option><option value="short">Under 10 minutes</option><option value="medium">10–60 minutes</option><option value="long">Over an hour</option></select><select aria-label="Library sort"><option value="recent">Newest</option><option value="views">Most viewed</option><option value="title">Title A–Z</option></select><div class="views" role="group" aria-label="Library view"><button data-view="grid" aria-pressed="true">Grid</button><button data-view="list" aria-pressed="false">List</button></div></div><p class="status catalog-status" role="status" hidden></p><div class="content"></div><button class="more" hidden>Load more</button><p class="notice" role="status" hidden></p>';
    shadow.append(style,ui);const $=selector=>ui.querySelector(selector);let rows=new Map(),context=null,signature='',drawKey='',navKey='',query='',length='all',sort='recent',view='grid',destroyed=false,schedule=null;
    const nodes=new Map(),setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;},setHidden=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
    function navigate(tab){onNavigate?.(tab);}
    function open(row,event){if(performance.now()-lastDrag<600){event.preventDefault();return;}if(context.newTab||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();if(row.source?.isConnected)row.source.click();else location.assign(row.href);}
    function card(row){
      let record=nodes.get(row.key);const key=JSON.stringify([row.title,row.image,row.clock,row.views,row.date,row.category]);if(record?.key===key)return record.node;
      const node=document.createElement('article');node.className='card';node.dataset.key=row.key;
      const thumb=document.createElement('a');thumb.className='thumb';thumb.href=row.href;thumb.dataset.action='open';thumb.setAttribute('aria-label',`Watch ${row.title}`);if(row.image){const image=document.createElement('img');image.src=row.image;image.alt='';image.loading='lazy';image.decoding='async';thumb.append(image);}if(row.clock){const clock=document.createElement('span');clock.className='clock';clock.textContent=row.clock;thumb.append(clock);}
      const body=document.createElement('div');body.className='card-body';const title=document.createElement('a');title.className='title';title.href=row.href;title.dataset.action='open';title.textContent=row.title;
      const meta=document.createElement('div');meta.className='meta';meta.textContent=[row.category,row.date,row.views!==null?`${number(row.views)} views`:''].filter(Boolean).join(' · ');body.append(title,meta);
      if(onWatch){const watch=document.createElement('button');watch.className='watch';watch.dataset.action='watch';watch.innerHTML=svg;watch.setAttribute('aria-label',`Watch together: ${row.title}`);watch.title='Watch together';body.append(watch);}
      if(context.newTab)for(const link of [thumb,title]){link.target='_blank';link.rel='noopener noreferrer';}
      node.append(thumb,body);if(onDrag)node.draggable=true;record={node,key};nodes.set(row.key,record);return node;
    }
    function empty(message,tab){const node=document.createElement('div');node.className='empty';node.append(document.createTextNode(message));if(tab){node.append(document.createElement('br'));const link=document.createElement('a');link.href=`/${context.slug}/${tab}`;link.dataset.tab=tab;link.textContent=tab==='clips'?'Browse clips':'Browse videos';node.append(link);}return node;}
    function overviewEmpty(type){
      const clips=type==='clip',name=clips?'clips':'recordings',status=context.previewStatus?.[type];
      const message=status==='loading'?`Loading ${name}…`:status==='unavailable'?`Could not load ${name}.`:status==='ready'?`No public ${name} found.`:clips?'Explore moments from this channel.':'Find a broadcast to watch.';
      return empty(message,clips?'clips':'videos');
    }
    function renderSchedule(){
      const visible=context.tab==='schedule'&&context.inlineSchedule;
      if(visible&&!schedule){
        schedule=document.createElement('div');schedule.className='schedule';
        const frame=document.createElement('iframe');frame.title=`${context.slug} schedule`;frame.hidden=true;
        const link=document.createElement('a');link.href=`/${context.slug}/schedule`;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open schedule on Kick ↗';
        const status=document.createElement('p');status.className='status';status.setAttribute('role','status');status.textContent='Loading schedule…';
        frame.addEventListener('load',()=>{
          if(destroyed)return;
          const doc=frame.contentDocument;
          if(!doc?.head||!doc.querySelector('[data-testid="schedule-viewer-page"]')){status.textContent='Could not load the inline schedule.';return;}
          const css=doc.createElement('style');
          css.textContent=`
            html,body{margin:0!important;min-height:100%!important;height:auto!important;overflow:auto!important;background:#101014!important;color-scheme:dark}
            body :has([data-testid="schedule-viewer-page"]){display:contents!important}
            :is(body,body :has([data-testid="schedule-viewer-page"])) > :not([data-testid="schedule-viewer-page"],script,style,[role="dialog"],[data-radix-popper-content-wrapper]):not(:has([data-testid="schedule-viewer-page"],[role="dialog"],[role="menu"])){display:none!important}
            [data-testid="schedule-viewer-page"]{padding:12px!important;box-sizing:border-box}
          `;
          doc.head.append(css);frame.hidden=false;status.hidden=true;
        });
        frame.src=link.href;schedule.append(status,frame,link);$('.content').after(schedule);
      }
      if(schedule)setHidden(schedule,!visible);
    }
    function overview(){
      const all=[...rows.values()],recordings=all.filter(row=>row.type==='vod'),clips=all.filter(row=>row.type==='clip');
      const layout=document.createElement('div');layout.className='overview';const feature=document.createElement('div');feature.className='feature';
      if(recordings.length){const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.textContent='Start watching';feature.append(eyebrow,card(recordings[0]));const actions=document.createElement('div');actions.className='feature-actions';const watch=document.createElement('a');watch.className='primary';watch.href=recordings[0].href;if(context.newTab){watch.target='_blank';watch.rel='noopener noreferrer';}watch.dataset.action='open';watch.dataset.key=recordings[0].key;watch.textContent='Watch recording';actions.append(watch);const browse=document.createElement('a');browse.className='secondary-button';browse.href=`/${context.slug}/videos`;browse.dataset.tab='videos';browse.textContent='Browse videos';actions.append(browse);feature.append(actions);}else feature.append(overviewEmpty('vod'));
      const rail=document.createElement('div');rail.className='rail';const heading=document.createElement('div');heading.className='rail-head';heading.innerHTML='<h3>Highlights</h3>';const more=document.createElement('a');more.href=`/${context.slug}/clips`;more.dataset.tab='clips';more.textContent='Browse clips →';heading.append(more);const list=document.createElement('div');list.className='rail-list';if(clips.length)for(const row of clips.slice(0,3))list.append(card(row));else list.append(overviewEmpty('clip'));rail.append(heading,list);layout.append(feature,rail);
      const footer=document.createElement('div');footer.className='overview-footer';for(const [tab,label]of [['videos','Videos'],['clips','Clips']]){const link=document.createElement('a');link.className='browse-link';link.href=`/${context.slug}/${tab}`;link.dataset.tab=tab;link.append(document.createTextNode(label));const hint=document.createElement('span');hint.textContent='?';hint.setAttribute('aria-hidden','true');link.setAttribute('aria-label',`Browse all ${tab}`);link.append(hint);footer.append(link);}return [layout,footer];
    }
    function render(){
      if(!context||destroyed)return;const tab=context.tab,media=tab==='videos'||tab==='clips';setHidden($('.tools'),!media);setHidden($('.watch-heading'),!context.watchPage);setHidden($('.content'),!media&&tab!=='home');
      renderSchedule();
      setHidden($('.nav'),!!context.watchPage);if(context.watchPage)setText($('.watch-heading'),`More ${tab==='clips'?'clips':'videos'} from ${context.slug}`);const all=[...rows.values()].filter(row=>row.type===(tab==='clips'?'clip':'vod'));
      const [short,medium]=tab==='clips'?[30,60]:[600,3600];
      const filtered=all.filter(row=>(!query||`${row.title} ${row.category}`.toLowerCase().includes(query))&&(length==='all'||row.duration!==null&&({short:row.duration<short,medium:row.duration>=short&&row.duration<=medium,long:row.duration>medium}[length])));
      filtered.sort((a,b)=>(sort==='views'?(b.views??-1)-(a.views??-1):sort==='title'?titleOrder.compare(a.title,b.title):b.created-a.created)||a.order-b.order);
      const loading=context.catalogStatus==='loading';
      const catalogStatus=$('.catalog-status'),partial=media&&context.catalogStatus==='unavailable'&&all.length>0;
      setHidden(catalogStatus,!partial);if(partial)setText(catalogStatus,'Kick feed unavailable. Showing available results.');
      const draw=JSON.stringify([signature,tab,query,length,sort,view,context.previewStatus,context.catalogStatus]);if(draw!==drawKey){drawKey=draw;const content=$('.content');if(tab==='home')content.replaceChildren(...overview());else if(media){const list=document.createElement('div');list.className='items';list.dataset.view=view;for(const row of filtered)list.append(card(row));if(!filtered.length)list.append(empty(loading?`Loading ${tab}…`:query||length!=='all'?'No videos match these filters.':context.catalogStatus==='unavailable'?`Could not load ${tab}.`:'No videos loaded in this view.'));content.replaceChildren(list);}else content.replaceChildren();}
      const more=$('.more');if(more.disabled!==loading)more.disabled=loading;
      const options=$('[aria-label="Video length"]').options;
      const labels=tab==='clips'?['Under 30 seconds','30–60 seconds','Over 60 seconds']:['Under 10 minutes','10–60 minutes','Over an hour'];
      labels.forEach((label,index)=>setText(options[index+1],label));
      const placeholder=tab==='clips'?'Find a clip…':'Find a recording…';if($('.find input').placeholder!==placeholder)$('.find input').placeholder=placeholder;setHidden($('.more'),!media||!context.more);setText($('.more'),tab==='clips'?'Load more clips':'Load more videos');
      for(const button of ui.querySelectorAll('button[data-view]')){const value=String(button.dataset.view===view);if(button.getAttribute('aria-pressed')!==value)button.setAttribute('aria-pressed',value);}
    }
    ui.addEventListener('input',event=>{if(event.target.matches('.find input')){query=event.target.value.trim().toLowerCase();render();}});
    ui.addEventListener('change',event=>{if(event.target.matches('[aria-label="Library sort"]')){sort=event.target.value;onSort?.(sort);}if(event.target.matches('[aria-label="Video length"]'))length=event.target.value;render();});
    ui.addEventListener('click',async event=>{
      const target=event.target.closest('[data-tab],[data-action],[data-view],.more');if(!target)return;
      if(target.dataset.tab){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(target.dataset.tab);return;}
      if(target.dataset.view){view=target.dataset.view;render();return;}if(target.matches('.more')){context.more?.();return;}
      const row=rows.get(target.dataset.key||target.closest('[data-key]')?.dataset.key);if(!row)return;
      if(target.dataset.action==='open')open(row,event);
      if(target.dataset.action==='watch'){event.preventDefault();target.disabled=true;try{const result=await onWatch?.(row);if(result===false)throw Error();}catch{if(!destroyed){$('.notice').hidden=false;setText($('.notice'),'Could not add this video to the workspace.');}}finally{if(!destroyed)target.disabled=false;}}
    });
    ui.addEventListener('dragstart',event=>{const row=rows.get(event.target.closest('[data-key]')?.dataset.key);if(row&&onDrag){lastDrag=performance.now();onDrag(event,row);}});ui.addEventListener('dragend',()=>lastDrag=performance.now());
    for(const type of ['keydown','kick-refined-keydown','keyup','keypress'])shadow.addEventListener(type,event=>{if(type==='keydown'||type==='kick-refined-keydown')onKeydown?.(event);event.stopPropagation();});
    return {host,update(next,items){
      if(destroyed)return;if(context?.slug!==next.slug){sort='recent';$('[aria-label="Library sort"]').value=sort;nodes.clear();}if(context?.slug!==next.slug||context?.tab!==next.tab){query='';length='all';$('.find input').value='';$('[aria-label="Video length"]').value='all';}context=next;
      rows=new Map(items.map(row=>[row.key,row]));for(const key of nodes.keys())if(!rows.has(key))nodes.delete(key);
      signature=JSON.stringify(items.map(({source,...row})=>row));const nav=JSON.stringify([next.slug,next.tab,next.integrated]);if(nav!==navKey){navKey=nav;$('.nav').replaceChildren(...[['home','Overview'],['videos','Videos'],['clips','Clips'],['about','About'],['schedule','Schedule']].map(([tab,label])=>{const link=document.createElement('a');link.href=`/${next.slug}${tab==='home'?(next.integrated?'?tab=overview':''):'/'+tab}`;link.dataset.tab=tab;link.textContent=label;if(tab==='about')link.className='secondary';if(tab===next.tab)link.setAttribute('aria-current','page');return link;}));}
      render();
    },destroy(){destroyed=true;host.remove();rows.clear();nodes.clear();context=null;}};
  }
  globalThis.KickRefinedChannelLibrary=Object.freeze({mediaLink,read,create});
})();
