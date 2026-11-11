/* Full-recording navigation. One native player supplies preview and clip creation. */
(() => {
  const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  function recording(value,slug){
    try{const url=new URL(value,location.origin),match=url.pathname.match(/^\/([a-z0-9_]{1,40})\/videos\/([^/]+)\/?$/i);return ['https://kick.com','https://www.kick.com'].includes(url.origin)&&!url.username&&!url.password&&match?.[1].toLowerCase()===slug&&uuid.test(match[2])?{href:`${location.origin}/${slug}/videos/${match[2].toLowerCase()}`,id:match[2].toLowerCase()}:null;}catch{return null;}
  }
  function time(value){value=Math.max(0,Math.round(value||0));return `${Math.floor(value/3600)}:${String(Math.floor(value/60)%60).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
  function seconds(value){const parts=String(value).trim().split(':');if(parts.length>3||!parts.every(part=>/^\d{1,6}$/.test(part)))return null;const nums=parts.map(Number);if(nums.slice(1).some(n=>n>=60))return null;return nums.reduce((sum,n)=>sum*60+n,0);}
  function thumbnail(value,position,total){
    if(!Number.isFinite(position)||!Number.isFinite(total)||total<0)return null;
    try{
      const url=new URL(value);
      if(url.protocol!=='https:'||url.hostname!=='stream.kick.com'||url.username||url.password||url.port)return null;
      const second=Math.max(0,Math.min(Math.max(0,total-.01),position)),sheet=Math.floor(second/15000),cell=Math.floor(second%15000/60);
      if(url.pathname.endsWith('/media/hls/master.m3u8')){url.pathname=url.pathname.replace('media/hls/master.m3u8',`media/thumbnails/thumbnail-sheet-${sheet}.webp`);url.search='';}
      else if(/\/media\/thumbnails\/thumbnail-sheet-(?:%7Bindex%7D|\{index\}|\d+)\.webp$/i.test(url.pathname))url.pathname=url.pathname.replace(/thumbnail-sheet-(?:%7Bindex%7D|\{index\}|\d+)/i,`thumbnail-sheet-${sheet}`);
      else return null;
      return {href:url.href,x:-(cell%5)*180,y:-Math.floor(cell/5)*101};
    }catch{return null;}
  }
  function zoomAt(start,size,total,delta,ratio){
    if(![start,size,total,delta,ratio].every(Number.isFinite)||total<=0)return null;
    const fraction=Math.max(0,Math.min(1,ratio)),next=Math.max(Math.min(20,total),Math.min(total,size*Math.exp(Math.max(-400,Math.min(400,delta))*.0035)));
    return {start:Math.max(0,Math.min(total-next,start+fraction*(size-next))),size:next};
  }
  const css=`
    .history{padding:12px 18px 15px;background:linear-gradient(120deg,#17171d,#101014);border-top:1px solid #ffffff10}.history[hidden],.history [hidden]{display:none!important}.history-top{display:flex;gap:10px;align-items:center;margin-bottom:12px}.history-top select{flex:1;min-width:0;max-width:none!important;margin:0!important}.history-status{font-size:11px;color:#9090a3;min-height:16px}.history-status:empty{display:none}.history-jump{display:flex;align-items:center;gap:7px;margin-top:12px;flex-wrap:wrap}.history-jump label{display:flex;align-items:center;gap:6px;font-size:11px;color:#9292a5}.history-jump input{width:94px;min-width:0;background:#09090d;border:1px solid #ffffff16;border-radius:7px;color:#e5e5ee;font:12px/1.4 system-ui;padding:7px;font-variant-numeric:tabular-nums}.history-jump button:last-child{margin-left:auto;background:var(--kr-accent,#b0ff8c);color:#14200e;border-color:transparent;font-weight:700}.history-track{position:relative;height:42px;border:1px solid #ffffff11;border-radius:8px;background:repeating-linear-gradient(90deg,#ffffff04 0 1px,transparent 1px 5%),linear-gradient(180deg,#26262f,#19191f);touch-action:none;isolation:isolate}.history-track:before{content:'';position:absolute;inset:8px 0;background:repeating-linear-gradient(90deg,#ffffff09 0 2px,transparent 2px 12px);opacity:.7}.history-selection{position:absolute;top:0;bottom:0;left:var(--selection-left,0%);width:var(--selection-width,100%);min-width:4px;border:1px solid var(--kr-accent,#b0ff8c);border-radius:5px;background:color-mix(in srgb,var(--kr-accent,#b0ff8c) 16%,transparent);pointer-events:auto;cursor:grab;z-index:1;box-shadow:0 0 14px #b0ff8c12}.history-playhead{position:absolute;top:-3px;bottom:-3px;left:var(--playhead,0%);width:2px;background:#fafaff;pointer-events:none;z-index:4;box-shadow:0 0 6px #000}.history-track input[type=range]{appearance:none;position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;pointer-events:none;outline-offset:4px;z-index:2}.history-track input::-webkit-slider-runnable-track{height:42px;background:transparent}.history-track input::-webkit-slider-thumb{appearance:none;width:10px;height:42px;border:1px solid #182213;border-radius:4px;background:var(--kr-accent,#b0ff8c);cursor:ew-resize;pointer-events:auto}.history-track input::-moz-range-track{height:42px;background:transparent}.history-track input::-moz-range-thumb{width:9px;height:40px;border:1px solid #182213;border-radius:4px;background:var(--kr-accent,#b0ff8c);cursor:ew-resize;pointer-events:auto}.history-track input:focus-visible{outline:2px solid var(--kr-accent,#b0ff8c)}.history-ticks{display:flex;justify-content:space-between;color:#74748a;font-size:10px;margin-top:5px;font-variant-numeric:tabular-nums}.history-length{color:var(--kr-accent,#b0ff8c);font-size:11px;white-space:nowrap}.history-link{display:flex;gap:6px;margin:10px 0}.history-link input{flex:1;min-width:0;background:#09090d;border:1px solid #ffffff16;border-radius:7px;padding:7px;color:#ddd;font:12px system-ui}.history-link[hidden]{display:none!important}.history button:disabled{opacity:.4;cursor:default}.history button[aria-pressed=true]{color:var(--kr-accent,#b0ff8c)}
  `;
  function create({onRecording,onSeek,onClip,onPlay,onStatus=()=>{},onDiscover=null}={}){
    const host=document.createElement('section');host.className='history';host.hidden=true;host.setAttribute('aria-label','Stream history');
    host.innerHTML='<div class="history-top"><select aria-label="Stream recording"><option>Loading recordings…</option></select><button type="button" data-act="link" aria-expanded="false">Use a replay link</button></div><div class="history-link" hidden><input type="url" aria-label="Kick replay URL" placeholder="Paste a Kick recording link"><button type="button" data-act="load-link">Load</button></div><div class="history-status" role="status"></div><div class="history-track" role="group" aria-label="Full stream timeline"><div class="history-selection"></div><input type="range" min="0" max="180" step="1" aria-label="Selection start on full stream"><input type="range" min="0" max="180" step="1" aria-label="Selection end on full stream"><div class="history-playhead"></div></div><div class="history-ticks" aria-hidden="true"></div><div class="history-jump"><button type="button" data-act="play">Play / pause</button><label>In <input aria-label="History in point" value="0:00:00" spellcheck="false"></label><label>Out <input aria-label="History out point" value="0:00:30" spellcheck="false"></label><span class="history-length"></span><button type="button" data-act="clip" disabled>Clip selection</button></div>';
    const select=host.querySelector('select'),ranges=host.querySelectorAll('input[type=range]'),fields=host.querySelectorAll('.history-jump input'),status=host.querySelector('.history-status'),track=host.querySelector('.history-track'),ticks=host.querySelector('.history-ticks'),length=host.querySelector('.history-length'),clip=host.querySelector('[data-act=clip]');
    const zoomRow=document.createElement('div');zoomRow.className='history-zoom';
    zoomRow.innerHTML='<span class="timeline-label">Timeline</span><span class="timeline-zoom-controls"><button type="button" data-act="zoom-out" aria-label="Zoom timeline out" title="Zoom out">&#8722;</button><select aria-label="Timeline zoom"><option value="0">Full stream</option><option value="600">10 minutes</option><option value="120">2 minutes</option><option value="custom" hidden>Custom</option></select><button type="button" data-act="zoom-in" aria-label="Zoom timeline in" title="Zoom in">+</button></span><button type="button" data-act="fit">Fit selection</button><button type="button" data-act="center">Center selection</button>';
    track.before(zoomRow);const zoom=zoomRow.querySelector('select');
    const film=document.createElement('div');film.className='history-film';film.setAttribute('aria-hidden','true');track.prepend(film);
    const hover=document.createElement('div');hover.className='history-hover';hover.hidden=true;
    hover.innerHTML='<span class="history-hover-photo"><img alt="Timeline preview"></span><span class="history-hover-time"></span>';track.append(hover);
    const pan=document.createElement('input');pan.type='range';pan.className='history-pan';pan.min='0';pan.step='.1';pan.setAttribute('aria-label','Timeline position');
    const hint=document.createElement('div');hint.className='history-hint';hint.innerHTML='<span>Wheel to zoom &middot; Shift + wheel to pan</span><span class="preview-status" role="status"></span>';ticks.after(pan,hint);
    const previewStatus=hint.querySelector('.preview-status'),hoverPhoto=hover.querySelector('.history-hover-photo'),hoverImage=hover.querySelector('img');
    let slug='',rows=[],current=null,range={start:0,end:30,total:180,duration:30},revision=0,controller=null,disposed=false,ready=false,windowStart=0,windowSize=0,media='',filmKey='',filmTimer=0,filmRevision=0,hoverKey='',playhead=0;
    const viewSize=()=>windowSize?Math.min(windowSize,range.total):range.total;
    function center(){windowStart=windowSize?Math.max(0,Math.min(range.total-viewSize(),range.start-(viewSize()-range.duration)/2)):0;}
    function setZoom(delta,ratio=.5){const view=zoomAt(windowStart,viewSize(),range.total,delta,ratio);if(!view)return;windowSize=view.size>=range.total-.01?0:view.size;windowStart=windowSize?view.start:0;render();}
    function ruler(){
      const size=viewSize(),target=size/6,power=10**Math.floor(Math.log10(target)),step=([1,2,5,10].find(n=>n*power>=target)||10)*power;
      ticks.replaceChildren();
      for(let value=Math.ceil(windowStart/step)*step;value<=windowStart+size+.001;value+=step){const label=document.createElement('span');label.textContent=time(value);label.style.left=((value-windowStart)/size*100)+'%';ticks.append(label);}
    }
    function filmstrip(){
      const size=viewSize(),count=Math.max(6,Math.min(12,Math.ceil(track.clientWidth/110))),key=`${media}:${windowStart}:${size}:${count}`;
      if(filmKey===key)return;filmKey=key;clearTimeout(filmTimer);const generation=++filmRevision;
      if(!thumbnail(media,0,range.total)){film.replaceChildren();previewStatus.textContent='No preview source from Kick';track.dataset.preview='unavailable';return;}
      previewStatus.textContent='Loading previews...';track.dataset.preview='loading';
      filmTimer=setTimeout(()=>{
        if(disposed||generation!==filmRevision)return;film.replaceChildren();let loaded=0,failed=0;
        for(let i=0;i<count;i++){
          const image=thumbnail(media,windowStart+(i+.5)/count*size,range.total);if(!image)continue;
          const cell=document.createElement('span'),photo=document.createElement('img');photo.alt='';photo.decoding='async';photo.src=image.href;photo.style.objectPosition=`${image.x}px ${image.y}px`;
          photo.addEventListener('load',()=>{if(generation!==filmRevision)return;loaded++;track.dataset.preview='ready';previewStatus.textContent='';scaleFilm();},{once:true});
          photo.addEventListener('error',()=>{if(generation!==filmRevision)return;failed++;cell.replaceChildren();if(!loaded&&failed===count){track.dataset.preview='unavailable';previewStatus.textContent='Previews unavailable for this recording';}},{once:true});
          cell.append(photo);film.append(cell);
        }
        scaleFilm();
      },100);
    }
    function scaleFilm(){for(const cell of film.children){const photo=cell.firstElementChild;if(photo)photo.style.transform=`scale(${Math.max(cell.clientWidth/180,track.clientHeight/101)})`;}}
    const resize=new ResizeObserver(()=>{scaleFilm();filmstrip();});resize.observe(track);
    function paintHead(){const position=(playhead-windowStart)/viewSize()*100,head=track.querySelector('.history-playhead');head.hidden=position<0||position>100;track.style.setProperty('--playhead',`${Math.max(0,Math.min(100,position))}%`);}
    function showHover(event){
      if(!ready)return;const box=track.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),position=windowStart+fraction*viewSize();
      hover.hidden=false;hover.style.left=Math.max(90,Math.min(box.width-90,fraction*box.width))+'px';hover.querySelector('.history-hover-time').textContent=time(position);
      const image=thumbnail(media,position,range.total),key=image?`${image.href}:${image.x}:${image.y}`:'';
      if(key!==hoverKey){hoverKey=key;hoverPhoto.hidden=!image;if(image){hoverImage.src=image.href;hoverImage.style.objectPosition=`${image.x}px ${image.y}px`;}}
    }
    hoverImage.addEventListener('error',()=>{hoverPhoto.hidden=true;});
    function render(){
      for(const node of [track,ticks,zoomRow,host.querySelector('.history-jump'),hint])node.hidden=!current;
      const size=viewSize(),start=windowSize?Math.max(0,Math.min(range.total-size,windowStart)):0;windowStart=start;
      for(const input of ranges){input.min=String(start);input.max=String(start+size);input.disabled=!ready;}
      ranges[0].value=String(range.start);ranges[1].value=String(range.end);fields[0].value=time(range.start);fields[1].value=time(range.end);
      for(const [index,value]of [range.start,range.end].entries()){ranges[index].style.visibility=value<start-.001||value>start+size+.001?'hidden':'';ranges[index].setAttribute('aria-valuetext',time(value));}
      const left=Math.max(start,range.start),right=Math.min(start+size,range.end),selection=track.querySelector('.history-selection');selection.hidden=right<=left;
      track.style.setProperty('--selection-left',`${Math.max(0,(left-start)/size*100)}%`);track.style.setProperty('--selection-width',`${Math.max(0,(right-left)/size*100)}%`);
      selection.setAttribute('aria-label',`${Math.round(range.duration)} seconds selected`);
      length.textContent=`${Math.round(range.duration)}s selected`;clip.disabled=!ready;
      zoom.querySelector('[value=custom]').textContent=time(size)+' view';zoom.value=!windowSize?'0':[120,600].includes(windowSize)?String(windowSize):'custom';
      pan.hidden=!current||size>=range.total;pan.max=String(Math.max(0,range.total-size));pan.value=String(start);pan.setAttribute('aria-valuetext',time(start));pan.disabled=!ready;
      ruler();paintHead();filmstrip();
    }
    function choose(row){current=row;ready=false;media='';windowStart=0;windowSize=0;zoom.value='0';range=KickRefinedClipTools.range(0,30,Math.max(10,row.duration||180));render();onRecording(row);status.textContent='Loading the full recording…';}
    function publishRows(next,{replace=false}={}){
      rows=replace?KickRefinedClipCatalog.merge(next):KickRefinedClipCatalog.merge(rows,next);
      select.replaceChildren(...rows.map((row,index)=>new Option((row.live?'Current broadcast - ':'')+row.title,String(index))));
      select.disabled=!rows.length;
      if(!rows.length)return false;
      const keep=current&&rows.findIndex(row=>row.href===current.href);
      if(current&&keep>=0){select.value=String(keep);current=rows[keep];}
      else{select.value='0';choose(rows[0]);}
      onStatus(rows.some(row=>row.live)?'Current broadcast and available recordings loaded.':'Available recordings loaded.');
      return true;
    }
    function unavailable(message){
      select.replaceChildren(new Option('Recordings could not be loaded',''));select.disabled=true;
      status.textContent=message;host.querySelector('.history-link').hidden=false;onStatus(message);
    }
    async function load(channel){
      slug=channel;rows=[];current=null;ready=false;host.hidden=false;host.querySelector('.history-link').hidden=true;render();
      select.replaceChildren(new Option('Loading broadcasts...',''));select.disabled=true;status.textContent='Finding the current broadcast and recordings...';
      controller?.abort();controller=new AbortController();const signal=controller.signal,version=++revision;
      const timer=setTimeout(()=>controller?.signal===signal&&controller.abort(),12000);
      const fetchJSON=async path=>{const response=await fetch(path,{credentials:'same-origin',signal});if(!response.ok)throw Error('Kick blocked recording discovery');return response.json();};
      const fetchPage=async()=>{const response=await fetch(`/${channel}/videos`,{credentials:'same-origin',signal});if(!response.ok)throw Error('Kick blocked the recordings page');const html=await response.text();if(/Request blocked by security policy|cf-chl-|Just a moment/i.test(html.slice(0,10000)))throw Error('Kick blocked the recordings page');return KickRefinedClipCatalog.fromHTML(html,channel);};
      // The current page already carries public broadcast data, including vod_id.
      const seed=KickRefinedClipCatalog.fromDocument(document,channel);if(seed.length)publishRows(seed);
      const results=await Promise.allSettled([fetchJSON(`/api/v2/channels/${channel}/videos`),fetchJSON(`/api/v2/channels/${channel}`),fetchPage()]);
      clearTimeout(timer);if(disposed||version!==revision)return;
      // The rendered page uses canonical web-video IDs. Legacy APIs can describe
      // the same broadcasts with different UUIDs; combining them creates duplicates.
      const pageRows=results[2].status==='fulfilled'?results[2].value:[];
      if(pageRows.length){publishRows(pageRows,{replace:true});return;}
      const discovered=[];for(let index=0;index<2;index++)if(results[index].status==='fulfilled')discovered.push(...KickRefinedClipCatalog.fromData(results[index].value,channel,{scoped:true}));
      if(publishRows(rows.some(row=>row.live)?discovered.filter(row=>!row.live):discovered))return;
      if(onDiscover){status.textContent='Reading broadcasts from the channel page...';onStatus(status.textContent);onDiscover(channel);return;}
      unavailable('Kick did not return recording data. Retry discovery or use a replay link.');
    }
    select.addEventListener('change',()=>{const row=rows[Number(select.value)];if(row)choose(row);});
    zoom.addEventListener('change',()=>{if(zoom.value==='custom')return;windowSize=Number(zoom.value);center();render();});
    pan.addEventListener('input',()=>{windowStart=Number(pan.value);render();});
    track.addEventListener('wheel',event=>{if(!ready)return;event.preventDefault();const unit=event.deltaMode===1?16:event.deltaMode===2?track.clientWidth:1;if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)){windowStart=Math.max(0,Math.min(range.total-viewSize(),windowStart+(event.deltaX||event.deltaY)*unit/track.clientWidth*viewSize()));render();}else{const box=track.getBoundingClientRect();setZoom(event.deltaY*unit,(event.clientX-box.left)/box.width);}hover.hidden=true;},{passive:false});
    track.addEventListener('pointerleave',()=>hover.hidden=true);
    ranges.forEach((input,index)=>{input.addEventListener('input',()=>{
      const value=Number(input.value);
      const start=index?range.start:Math.max(0,range.end-180,Math.min(range.end-10,value));
      const end=index?Math.min(range.total,range.start+180,Math.max(range.start+10,value)):range.end;
      range=KickRefinedClipTools.range(start,end,range.total);render();
    });input.addEventListener('change',()=>onSeek(range.start));});
    fields.forEach((input,index)=>input.addEventListener('change',()=>{let start=seconds(fields[0].value),end=seconds(fields[1].value);if(start===null||end===null||start<0||start>range.total-10||end>range.total||end<10){status.textContent='Use valid timestamps within this recording.';render();return;}if(end-start<10||end-start>180){if(index)start=Math.max(0,end-range.duration);else end=Math.min(range.total,start+range.duration);}range=KickRefinedClipTools.range(start,end,range.total);center();render();onSeek(range.start);}));
    let moving=null;
    track.addEventListener('pointerdown',event=>{
      if(!ready||event.button!==0||event.target.matches('input'))return;
      const box=track.getBoundingClientRect(),size=windowSize?Math.min(windowSize,range.total):range.total;
      if(event.target.closest('.history-selection')){event.preventDefault();moving={id:event.pointerId,x:event.clientX,start:range.start,duration:range.duration,scale:size/box.width};try{track.setPointerCapture(event.pointerId);}catch{}return;}
      const start=Math.max(0,Math.min(range.total-range.duration,windowStart+(event.clientX-box.left)/box.width*size));range=KickRefinedClipTools.range(start,start+range.duration,range.total);render();onSeek(range.start);
    });
    track.addEventListener('pointermove',event=>{showHover(event);if(!moving||event.pointerId!==moving.id)return;const start=Math.max(0,Math.min(range.total-moving.duration,moving.start+(event.clientX-moving.x)*moving.scale));range=KickRefinedClipTools.range(start,start+moving.duration,range.total);render();});
    const finishMove=event=>{if(!moving||event.pointerId!==moving.id)return;const id=moving.id;moving=null;try{if(track.hasPointerCapture(id))track.releasePointerCapture(id);}catch{}onSeek(range.start);};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])track.addEventListener(type,finishMove);
    host.addEventListener('click',event=>{const action=event.target.closest('button')?.dataset.act;if(action==='center'){center();render();}else if(action==='zoom-in')setZoom(-180);else if(action==='zoom-out')setZoom(180);else if(action==='fit'){windowSize=Math.min(range.total,Math.max(20,range.duration*2));center();render();}else if(action==='link'){const form=host.querySelector('.history-link');form.hidden=!form.hidden;event.target.setAttribute('aria-expanded',String(!form.hidden));}else if(action==='load-link'){const item=recording(host.querySelector('[type=url]').value,slug);if(!item){status.textContent='Use a Kick recording URL for this streamer.';return;}const row={...item,title:'Selected recording',duration:null};rows.push(row);select.append(new Option(row.title,String(rows.length-1)));select.value=String(rows.length-1);choose(row);}else if(action==='play')onPlay();else if(action==='clip'&&ready)onClip({...range});});
    render();
    return {host,acceptCatalog(values){const valid=[];for(const value of Array.isArray(values)?values.slice(0,200):[]){const item=recording(value?.href,slug);if(!item)continue;valid.push({...item,title:typeof value.title==='string'?value.title.slice(0,300):'Stream recording',live:value.live===true,duration:Number.isFinite(value.duration)&&value.duration>=0?Math.min(14*86400,value.duration):null,created:Number.isFinite(value.created)?value.created:0,image:''});}if(!publishRows(valid))unavailable('Kick did not return recording data. Retry discovery or use a replay link.');},setBusy(value){host.inert=!!value;host.style.opacity=value?'.55':'';},css:css+`
      .history{padding-top:14px}.history-status{margin-bottom:9px}.history-zoom{display:flex;gap:8px;align-items:center;margin:10px 0 15px;color:#9696aa;font-size:11px}.timeline-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-right:auto}.timeline-zoom-controls{display:flex;align-items:center;border:1px solid #ffffff12;border-radius:8px;overflow:hidden;background:#0c0c10}.history-zoom select{border:0;background:transparent;font-size:11px;padding:5px 7px;max-width:140px}.history-zoom button{font-size:10px;padding:5px 9px;white-space:nowrap}.timeline-zoom-controls button{border:0;border-radius:0;background:transparent;font-size:15px;line-height:18px}.history-track{height:68px;background:linear-gradient(#191b21,#121318);border-radius:9px}.history-track:before{opacity:.35}.history-track input::-webkit-slider-runnable-track{height:68px}.history-track input::-webkit-slider-thumb{height:68px;width:10px;border-radius:4px;box-shadow:0 0 0 1px #10200b,0 0 12px #0006}.history-track input::-moz-range-track{height:68px}.history-track input::-moz-range-thumb{height:66px;width:9px;border-radius:4px}.history-selection{border-top:2px solid var(--studio-accent,#b0ff8c);border-bottom:2px solid var(--studio-accent,#b0ff8c);background:#b0ff8c18;box-shadow:0 0 12px #b0ff8c12;min-width:0}.history-film{position:absolute;inset:0;display:flex;overflow:hidden;border-radius:8px;pointer-events:none;opacity:.85}.history-film span{position:relative;flex:1;min-width:0;overflow:hidden;border-right:1px solid #09090d99;background:#ffffff03}.history-film img{position:absolute;inset:0;width:180px;height:101px;max-width:none;object-fit:none;transform-origin:top left}.history-track:has(.history-film img):before{display:none}.history-playhead{width:2px;top:-5px;bottom:-5px}.history-playhead:before{content:'';position:absolute;top:0;left:-3px;width:8px;height:7px;background:#fff;clip-path:polygon(0 0,100% 0,50% 100%)}.history-ticks{position:relative;display:block;height:22px;margin:7px 0 0;overflow:hidden}.history-ticks span{position:absolute;transform:translateX(-50%);font-size:10px;white-space:nowrap;color:#9797aa}.history-ticks span:first-child{transform:none}.history-ticks span:before{content:'';display:block;height:4px;border-left:1px solid #ffffff22;margin-bottom:3px}.history-pan{display:block;appearance:none;width:100%;height:10px;margin:3px 0 7px;padding:0;border:0;border-radius:5px;background:#ffffff09;cursor:ew-resize;accent-color:#9dab96}.history-pan::-webkit-slider-thumb{appearance:none;width:44px;height:7px;background:#6f7c6a;border-radius:4px}.history-pan::-moz-range-thumb{width:44px;height:7px;background:#6f7c6a;border:0;border-radius:4px}.history-hint{display:flex;gap:8px;justify-content:space-between;margin-top:3px;font-size:10px;color:#79798d}.preview-status{color:#a3a3b3}.history-hover{position:absolute;bottom:calc(100% + 9px);width:180px;border-radius:9px;overflow:hidden;transform:translateX(-50%);pointer-events:none;z-index:10;background:#101014;border:1px solid #ffffff25;box-shadow:0 8px 28px #0008;text-align:center}.history-hover-photo{display:block;width:180px;height:101px;overflow:hidden}.history-hover-photo img{display:block;width:180px;height:101px;max-width:none;object-fit:none}.history-hover-time{display:block;padding:4px 8px;color:#eeeef6;font-size:11px;font-variant-numeric:tabular-nums}.history-jump{border-top:1px solid #ffffff09;margin-top:12px;padding-top:12px}.history-jump button{font-size:12px}.history-jump input{background:#09090e}@media(max-width:560px){.history-zoom{gap:5px;flex-wrap:wrap}.timeline-label{flex-basis:100%}.history-hint{flex-wrap:wrap}.history-jump{gap:6px}.history-jump input{width:82px}}
      `,load,hide(){controller?.abort();revision++;clearTimeout(filmTimer);filmRevision++;filmKey='';hover.hidden=true;host.hidden=true;},sourceState(data){if(!current||!Number.isFinite(data.duration)||data.duration<10)return;const total=Math.min(14*86400,data.duration);if(typeof data.media==='string'&&thumbnail(data.media,0,total)&&data.media!==media){media=data.media;filmKey='';filmstrip();}if(!ready||Math.abs(total-range.total)>1){const first=!ready;range=KickRefinedClipTools.range(Math.min(range.start,total-10),Math.min(range.end,total),total);if(first){const point=Number.isFinite(data.time)?Math.max(0,Math.min(total-30,data.time)):0;range=KickRefinedClipTools.range(point,point+30,total);windowSize=Math.min(120,total);center();}ready=true;render();status.textContent='Choose any available part of this replay. Click the timeline or enter an exact timestamp.';}if(Number.isFinite(data.time)){playhead=data.time;paintHead();}},destroy(){disposed=true;controller?.abort();clearTimeout(filmTimer);filmRevision++;resize.disconnect();revision++;host.remove();}};
  }
  globalThis.KickRefinedClipHistory=Object.freeze({create,recording,time,seconds,thumbnail,zoomAt});
})();
