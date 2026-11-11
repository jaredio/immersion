/* Read public recording models and rendered cards. Never inspect React fibers. */
(() => {
  const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,300):'';
  function stamp(value){if(typeof value!=='string')return 0;return Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)?value.replace(' ','T')+'Z':value)||0;}
  function image(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='kick.com'||url.hostname.endsWith('.kick.com'))?url.href:'';}catch{return '';}}
  function normalize(item,slug,{legacy=false}={}){
    if(!item||typeof item!=='object')return null;
    const video=legacy?item.video:item,id=legacy?video?.uuid:item.id;
    if(!uuid.test(id||'')||item.channel?.slug&&item.channel.slug.toLowerCase()!==slug||item.is_private||video?.is_private||video?.deleted_at||video?.is_pruned||typeof video?.status==='string'&&video.status!=='public')return null;
    if(!legacy&&item.channel?.slug?.toLowerCase()!==slug)return null;
    const live=item.is_live===true,start=stamp(item.start_time||item.created_at||video?.created_at),raw=Number(item.duration);
    const duration=Number.isFinite(raw)&&raw>0?legacy?Math.floor(raw/1000):Math.floor(raw):live&&start?Math.max(0,Math.floor((Date.now()-start)/1000)):null;
    return {href:`${location.origin}/${slug}/videos/${id.toLowerCase()}`,id:id.toLowerCase(),title:clean(item.title||item.session_title)||'Stream recording',duration:duration===null?null:Math.min(14*86400,duration),live,created:start,image:image(item.thumbnail?.src||item.thumbnail?.url)};
  }
  function merge(...groups){
    const rows=new Map();for(const row of groups.flat()){
      if(!row?.href)continue;const previous=rows.get(row.href);
      rows.set(row.href,previous?{...previous,...row,live:previous.live||row.live,duration:row.duration??previous.duration,created:row.created||previous.created,title:row.title==='Stream recording'?previous.title:row.title,image:row.image||previous.image}:row);
    }
    return [...rows.values()].sort((a,b)=>Number(!!b.live)-Number(!!a.live)||(b.created||0)-(a.created||0)).slice(0,200);
  }
  function fromData(data,slug,{scoped=false}={}){
    if(!/^[a-z0-9_]{1,40}$/.test(slug))return [];
    const rows=[],objects=[],stack=[data],ids=new Set();let visits=0;
    while(stack.length&&visits++<50000){const value=stack.pop();if(!value||typeof value!=='object')continue;objects.push(value);
      if(value.slug===slug&&Number.isSafeInteger(value.id))ids.add(value.id);
      if(value.channel?.slug?.toLowerCase()===slug&&Number.isSafeInteger(value.channel.id))ids.add(value.channel.id);
      for(const child of Object.values(value))if(child&&typeof child==='object')stack.push(child);
    }
    for(const value of objects){
      const row=normalize(value,slug);if(row)rows.push(row);
      if(uuid.test(value.vod_id||'')&&(ids.has(value.channel_id)||scoped&&value===data?.livestream)){
        const live=normalize({...value,id:value.vod_id,title:value.session_title,channel:{slug}},slug);if(live)rows.push(live);
      }
    }
    if(scoped){const list=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:Array.isArray(data?.data?.videos)?data.data.videos:[];
      for(const item of list){const row=normalize(item,slug,{legacy:!!item?.video?.uuid});if(row)rows.push(row);}
      const channel=data?.data&&typeof data.data==='object'&&!Array.isArray(data.data)?data.data:data,live=channel?.livestream;
      if(live&&(!channel.slug||channel.slug===slug)){
        const id=live.vod_id||live.video?.uuid;if(uuid.test(id||'')){const row=normalize({...live,id,channel:{slug},is_live:true,title:live.session_title},slug);if(row)rows.push(row);}
      }
    }
    return merge(rows);
  }
  function fromDocument(doc,slug){
    if(!doc||!/^[a-z0-9_]{1,40}$/.test(slug))return [];
    const rows=[],parts=[];let length=0;
    for(const script of doc.querySelectorAll('script:not([src])')){
      const code=script.textContent||'';if((length+=code.length)>8*1024*1024)break;
      if(script.type==='application/json'){try{rows.push(...fromData(JSON.parse(code),slug));}catch{}continue;}
      const marker='self.__next_f.push(',start=code.indexOf(marker);if(start<0)continue;
      try{const entry=JSON.parse(code.slice(start+marker.length,code.lastIndexOf(')')));if(entry[0]===1&&typeof entry[1]==='string')parts.push(entry[1]);}catch{}
    }
    const roots=[];for(const line of parts.join('').split('\n')){
      const colon=line.indexOf(':');if(colon<1||colon>20||!/^[\da-z]+$/i.test(line.slice(0,colon)))continue;
      try{roots.push(JSON.parse(line.slice(colon+1)));}catch{}
    }
    rows.push(...fromData(roots,slug));
    for(const card of [...doc.querySelectorAll('[data-testid="vods-card"]')].slice(0,200)){
      const link=card.querySelector('a[data-testid="media-card-thumbnail"]')||card.querySelector('a[href*="/videos/"]');if(!link)continue;
      let url;try{url=new URL(link.getAttribute('href'),location.origin);}catch{continue;}
      const match=url.pathname.match(/^\/([a-z0-9_]{1,40})\/videos\/([^/]+)\/?$/i);
      if(!['https://kick.com','https://www.kick.com'].includes(url.origin)||url.username||url.password||match?.[1].toLowerCase()!==slug||!uuid.test(match[2]))continue;
      const clock=[...link.querySelectorAll('div,span')].map(node=>node.children.length?'':node.textContent.trim()).find(value=>/^\d{1,3}(?::\d{2}){1,3}$/.test(value));
      const duration=clock?clock.split(':').map(Number).reduce((sum,n)=>sum*60+n,0):null;
      const title=[...card.querySelectorAll('a[title],h3')].find(node=>node.getAttribute('href')===link.getAttribute('href')||node.matches('h3'));
      rows.push({href:`${location.origin}/${slug}/videos/${match[2].toLowerCase()}`,id:match[2].toLowerCase(),title:clean(title?.getAttribute('title')||title?.textContent)||'Stream recording',duration,live:false,created:0,image:image(link.querySelector('img')?.getAttribute('src'))});
    }
    return merge(rows);
  }
  function fromHTML(html,slug){if(typeof html!=='string'||html.length>10*1024*1024)return [];return fromDocument(new DOMParser().parseFromString(html,'text/html'),slug);}
  globalThis.KickRefinedClipCatalog=Object.freeze({fromData,fromDocument,fromHTML,merge});
})();
