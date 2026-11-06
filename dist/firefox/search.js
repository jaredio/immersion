/* Public Kick search with bounded requests, explicit query syntax and no API keys. */
(() => {
  const slug=value=>typeof value==='string'&&/^[a-z0-9_]{1,40}$/i.test(value)?value.toLowerCase():'';
  function parse(input=''){
    if(typeof input!=='string'||input.length>512)throw Error('Keep the query under 512 characters.');
    input=input.trim();if(/^https:\/\/(?:www\.)?kick\.com\/[\w]+\/?$/i.test(input))input=new URL(input).pathname.slice(1).replace(/\/$/,'');
    const tokens=[];let token='',quoted=false,escape=false,literal=false;
    for(const char of input){if(escape){token+=char;escape=false;}else if(char==='\\'&&quoted)escape=true;else if(char==='"'){if(!token)literal=true;quoted=!quoted;}else if(/\s/.test(char)&&!quoted){if(token)tokens.push({value:token,literal});token='';literal=false;}else token+=char;}
    if(quoted||escape)throw Error('Close the quotation marks to search.');if(token)tokens.push({value:token,literal});
    const q={type:'channels',channels:[],terms:[],exclude:[],sort:'recent',time:'all',live:null,after:null,before:null,category:'',creator:'',views:null,duration:null};let kind='';
    function setType(value){const next={channel:'channels',channels:'channels',clip:'clips',clips:'clips',vod:'vods',vods:'vods',video:'vods',videos:'vods'}[value];if(!next)throw Error('Use type:channels, type:clips or type:vods.');if(kind&&kind!==next)throw Error('Search one type at a time: channels, clips or VODs.');kind=q.type=next;}
    function channels(value){for(const part of value.split(',')){const name=slug(part.replace(/^@/,''));if(!name)throw Error('Use a channel name after the colon.');if(!q.channels.includes(name))q.channels.push(name);}if(q.channels.length>3)throw Error('Search up to three channels at once.');}
    function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Dates use YYYY-MM-DD.');const time=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw Error('Enter a valid date.');return time;}
    for(const entry of tokens){const token=entry.value,match=entry.literal?null:/^([a-z]+):(.*)$/i.exec(token);if(!match){if(token.startsWith('-')&&token.length>1)q.exclude.push(token.slice(1).toLowerCase());else q.terms.push(token.toLowerCase());continue;}const key=match[1].toLowerCase(),value=match[2],lower=value.toLowerCase();
      if(['clips','clip','vods','vod','videos','channels'].includes(key)){setType(key);channels(lower);}
      else if(key==='type')setType(lower);
      else if(['channel','in'].includes(key))channels(lower);
      else if(key==='sort'){q.sort={recent:'recent',date:'recent',newest:'recent',views:'views',popular:'views'}[lower];if(!q.sort)throw Error('Use sort:recent or sort:views.');}
      else if(key==='time'){q.time={day:'day','24h':'day',week:'week','7d':'week',month:'month','30d':'month',all:'all'}[lower];if(!q.time)throw Error('Use time:day, week, month or all.');}
      else if(key==='live'){if(!['true','false','yes','no'].includes(lower))throw Error('Use live:true or live:false.');q.live=['true','yes'].includes(lower);}
      else if(key==='after')q.after=date(value);
      else if(key==='before')q.before=date(value)+86400000-1;
      else if(key==='category')q.category=lower;
      else if(key==='creator'){q.creator=slug(lower.replace(/^@/,''));if(!q.creator)throw Error('Use a username with creator:.');}
      else if(['views','duration'].includes(key)){const limit=/^(>=|<=|>|<|=)?(\d{1,10})$/.exec(value);if(!limit)throw Error(`Use ${key}:>100 or ${key}:<100.`);q[key]={op:limit[1]||'>=',value:Number(limit[2])};}
      else throw Error(`Unknown filter: ${key}:. Open ? for supported filters.`);
    }
    if(q.type!=='channels'&&!q.channels.length)throw Error(`Choose a channel, for example ${q.type}:cobbruvs.`);
    if(q.type==='channels'&&(q.creator||q.duration||q.after!==null||q.before!==null||q.time!=='all'))throw Error('Date, duration and creator filters need clips:channel or vods:channel.');
    if(q.type!=='channels'&&q.live!==null)throw Error('live: filters channel results.');if(q.type!=='clips'&&q.creator)throw Error('creator: filters clips.');if(q.after!==null&&q.before!==null&&q.after>q.before)throw Error('after: must come before before:.');return q;
  }
  const count=value=>{if(typeof value==='string'&&/^\d{1,15}$/.test(value))value=Number(value);return Number.isSafeInteger(value)&&value>=0?value:null;};
  const text=(value,max=500)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
  function image(value){try{if(typeof value!=='string'||value.length>4096)return '';const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='kick.com'||url.hostname.endsWith('.kick.com'))?url.href:'';}catch{return '';}}
  function duration(value){if(!Number.isFinite(value)||value<0)return '';const seconds=Math.floor(value);return seconds>=3600?`${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
  function catalog(html,channel){
    if(typeof html!=='string'||!slug(channel))throw Error('Recordings unavailable.');const doc=new DOMParser().parseFromString(html,'text/html'),rows=[];
    for(const card of [...doc.querySelectorAll('[data-testid="vods-card"]')].slice(0,200)){
      const thumbnail=card.querySelector('a[data-testid="media-card-thumbnail"]');if(!thumbnail)continue;let url;try{url=new URL(thumbnail.getAttribute('href'),'https://kick.com');}catch{continue;}
      const match=new RegExp(`^/${channel}/videos/([\\da-f]{8}(?:-[\\da-f]{4}){3}-[\\da-f]{12})/?$`,'i').exec(url.pathname);if(!match||url.origin!=='https://kick.com')continue;
      const clock=[...thumbnail.querySelectorAll('div')].map(node=>node.textContent.trim()).find(value=>/^\d{1,3}(?::\d{2}){1,3}$/.test(value));if(!clock)continue;const parts=clock.split(':').map(Number),seconds=(parts.length===4?parts.shift()*86400:0)+parts.reduce((total,value)=>total*60+value,0);
      const heading=[...card.querySelectorAll('a[title]')].find(node=>node.getAttribute('href')===thumbnail.getAttribute('href'));
      const views=[...thumbnail.querySelectorAll('span[title]')].map(node=>node.getAttribute('title')).find(value=>/^\d+$/.test(value));
      const stamp=[...card.querySelectorAll('span[title]')].map(node=>node.getAttribute('title')).find(value=>/^\d{1,2}\/\d{1,2}\/\d{4},/.test(value));let created=0;
      const date=/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})\s*([AP]M)$/.exec(stamp||'');if(date&&Number(date[1])<=12&&Number(date[2])<=31&&Number(date[4])<=12&&Number(date[5])<60)created=Date.UTC(Number(date[3]),Number(date[1])-1,Number(date[2]),Number(date[4])%12+(date[6]==='PM'?12:0),Number(date[5]));
      rows.push({key:'vod:'+match[1],type:'vod',slug:channel,title:text(heading?.getAttribute('title')||card.querySelector('h3')?.textContent)||'Untitled recording',href:`https://kick.com/${channel}/videos/${match[1]}`,image:image(thumbnail.querySelector('img[data-thumbnail],img')?.getAttribute('src')),category:text(card.querySelector('a[href^="/category/"]')?.textContent,100),views:count(views),duration:seconds,created});
    }if(!rows.length&&!/video|vod|recording/i.test(doc.querySelector('title')?.textContent||''))throw Error('Kick recordings are unavailable. Try again.');return rows;
  }
  function normalize(raw,type,channel=''){
    if(!raw||typeof raw!=='object')throw Error('Kick returned an unavailable search response.');
    let list=type==='channels'?(Array.isArray(raw.channels)?raw.channels:[raw]):type==='clips'?raw.clips:raw;
    if(!Array.isArray(list))throw Error('Kick returned an unavailable search response.');const rows=[];
    for(const item of list.slice(0,300)){if(!item||typeof item!=='object')continue;
      if(type==='channels'){
        const name=slug(item.slug);if(!name||item.is_banned)continue;const live=item.isLive??item.livestream?.is_live;
        rows.push({key:'channel:'+name,type:'channel',slug:name,title:text(item.user?.username)||name,image:image(item.user?.profilePic||item.user?.profile_pic),href:`https://kick.com/${name}`,category:text(item.livestream?.categories?.[0]?.name||item.recentCategories?.[0]?.name||item.recent_categories?.[0]?.name,100),streamTitle:text(item.livestream?.session_title),live:live===true?'live':live===false||item.livestream===null?'offline':'unknown',views:count(item.livestream?.viewer_count),followers:count(item.followersCount??item.followers_count),section:'Kick search'});
      }else if(type==='clips'){
        if(!/^clip_[a-z0-9]{26}$/i.test(item.id)||item.is_private||item.privacy&&item.privacy!=='public'||slug(item.channel?.slug)&&slug(item.channel.slug)!==channel)continue;
        rows.push({key:'clip:'+item.id,type:'clip',slug:channel,title:text(item.title)||'Untitled clip',image:image(item.thumbnail_url),href:`https://kick.com/${channel}/clips/${item.id}`,category:text(item.category?.name,100),creator:slug(item.creator?.slug||item.creator?.username),views:count(item.views??item.view_count),duration:count(Math.floor(item.duration)),created:Date.parse(item.created_at)||0});
      }else{throw Error('Unsupported search response.');
      }
    }return rows;
  }
  function fits(row,q){
    const haystack=[row.title,row.slug,row.streamTitle,row.category].filter(Boolean).join(' ').toLowerCase();
    if(q.terms.some(term=>!haystack.includes(term))||q.exclude.some(term=>haystack.includes(term)))return false;
    if(q.channels.length&&!q.channels.includes(row.slug)||q.category&&!row.category?.toLowerCase().includes(q.category)||q.creator&&row.creator!==q.creator)return false;
    if(q.live!==null&&row.live!==(q.live?'live':'offline'))return false;
    if((q.after!==null||q.before!==null)&&!row.created||q.after!==null&&row.created<q.after||q.before!==null&&row.created>q.before)return false;
    if(q.time!=='all'&&(!row.created||row.created<Date.now()-{day:86400000,week:604800000,month:2592000000}[q.time]))return false;
    for(const key of ['views','duration'])if(q[key]){const value=row[key],limit=q[key];if(value===null||value===undefined)return false;if(!({'>':value>limit.value,'>=':value>=limit.value,'<':value<limit.value,'<=':value<=limit.value,'=':value===limit.value}[limit.op]))return false;}return true;
  }
  function create(){
    const cache=new Map();let active=null,state=null,disposed=false;
    function cancel(){active?.abort();active=null;}
    async function read(path,signal,html=false){const hit=cache.get(path);if(hit?.until>Date.now())return hit.data;const controller=new AbortController(),stop=()=>controller.abort();signal.addEventListener('abort',stop,{once:true});if(signal.aborted)controller.abort();const timer=setTimeout(stop,8000);
      try{const response=await fetch(location.origin+path,{credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});if(!response.ok)throw Error('Kick search is unavailable. Try again.');const body=await response.text();if(body.length>2097152)throw Error('Search response is too large.');let data;if(html)data=catalog(body,html);else try{data=JSON.parse(body);}catch{throw Error('Kick search is unavailable. Try again.');}cache.delete(path);cache.set(path,{until:Date.now()+45000,data});while(cache.size>20)cache.delete(cache.keys().next().value);return data;}finally{clearTimeout(timer);signal.removeEventListener('abort',stop);}}
    async function search(q,{append=false}={}){
      if(disposed)throw Error('Search closed.');cancel();const controller=new AbortController();active=controller;const key=JSON.stringify(q);
      if(!append||state?.key!==key)state={key,rows:new Map(),progress:q.channels.map(channel=>({channel,cursor:'',pages:0,loaded:0,done:false}))};const current=state;
      if(q.type==='channels'){
        if(!q.channels.length&&!q.terms.length)return {rows:[],loaded:0,more:false};
        const paths=q.channels.length?q.channels.map(channel=>`/api/v2/channels/${channel}`):['/api/search?'+new URLSearchParams({searched_word:q.terms.join(' ')})];
        const results=[];let next=0;await Promise.all([0,1].map(async()=>{while(next<paths.length){const index=next++;results[index]=await read(paths[index],controller.signal);}}));if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');const rows=results.flatMap(raw=>normalize(raw,'channels')).filter(row=>fits(row,q));return {rows,loaded:rows.length,more:false};
      }
      const tasks=current.progress.filter(item=>!item.done&&item.pages<10&&item.loaded<200);let index=0,failures=0;
      await Promise.all([0,1].map(async()=>{while(index<tasks.length){const item=tasks[index++];try{
        const params=new URLSearchParams({sort:q.sort==='views'?'view':'date',time:q.time});if(item.cursor)params.set('cursor',item.cursor);
        const path=q.type==='clips'?`/api/v2/channels/${item.channel}/clips?${params}`:`/${item.channel}/videos`,raw=await read(path,controller.signal,q.type==='vods'?item.channel:false);if(controller.signal.aborted)return;
        const rows=q.type==='vods'?raw:normalize(raw,q.type,item.channel);for(const row of rows)current.rows.set(row.key,row);item.loaded+=rows.length;item.pages++;
        const next=typeof raw.nextCursor==='string'&&raw.nextCursor.length<=2048?raw.nextCursor:'';item.done=q.type!=='clips'||!next||next===item.cursor;item.cursor=next;
      }catch(error){if(controller.signal.aborted)return;failures++;item.done=true;}}}));
      if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');if(failures===tasks.length&&tasks.length)throw Error('Kick search is unavailable. Try again.');
      const rows=[...current.rows.values()].filter(row=>fits(row,q)).sort((a,b)=>q.sort==='views'?(b.views??-1)-(a.views??-1):b.created-a.created);
      return {rows,loaded:current.rows.size,more:current.progress.some(item=>!item.done&&item.pages<10&&item.loaded<200),warning:failures?'Some channels could not be loaded.':''};
    }
    return {search,cancel,destroy(){disposed=true;cancel();cache.clear();state=null;}};
  }
  globalThis.KickRefinedSearch=Object.freeze({parse,normalize,fits,image,catalog,duration,create});
})();
