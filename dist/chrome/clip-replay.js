/* A read-only replay panel follows the clip's media clock, including seeks. */
(() => {
  function create({container,video,data,signal,onClose}){
    const abort=new AbortController(),cache=new Map(),pending=new Set(),failed=new Map(),rows=new Map();
    let disposed=false,lastItems=[],lastTime=-1,active=0,queue=[],timeline=null;
    const pane=document.createElement('section');pane.className='replay';pane.setAttribute('aria-label','Clip chat replay');
    const header=document.createElement('div');header.className='replay-header';const heading=document.createElement('strong');heading.textContent='Chat replay';
    const close=document.createElement('button');close.type='button';close.className='replay-collapse';close.setAttribute('aria-label','Collapse chat replay');close.title='Collapse chat replay';close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';close.addEventListener('click',onClose);
    header.append(heading,close);const list=document.createElement('div');list.className='replay-messages';list.setAttribute('role','log');list.setAttribute('aria-label','Replay messages');
    const status=document.createElement('p');status.className='replay-status';status.setAttribute('role','status');
    const retry=document.createElement('button');retry.type='button';retry.className='replay-retry';retry.textContent='Retry chat replay';retry.hidden=true;
    const note=document.createElement('div');note.className='replay-note';note.textContent='Synced to clip · read only';pane.append(header,list,status,retry,note);container.append(pane);
    const duration=()=>Number.isFinite(video.duration)?Math.min(600,video.duration):Math.min(600,data.duration||180);
    function content(node,text){
      const pattern=/\[emote:(\d{1,12}):([^\]]{1,100})\]/g;let at=0;
      for(const match of text.matchAll(pattern)){node.append(document.createTextNode(text.slice(at,match.index)));const image=document.createElement('img');image.className='replay-emote';image.src=`https://files.kick.com/emotes/${match[1]}/fullsize`;image.alt=match[2];image.title=match[2];image.loading='lazy';image.addEventListener('error',()=>image.replaceWith(document.createTextNode(match[2])),{once:true});node.append(image);at=match.index+match[0].length;}
      node.append(document.createTextNode(text.slice(at)));
    }
    function boundary(time,includeEqual){
      let low=0,high=timeline.length;
      while(low<high){
        const middle=(low+high)>>>1;
        if(timeline[middle].time<time||includeEqual&&timeline[middle].time===time)low=middle+1;
        else high=middle;
      }
      return low;
    }
    function render(){
      if(disposed)return;
      const time=video.currentTime||0,bucket=Math.floor(time/5);
      timeline??=[...cache.values()].flat().sort((a,b)=>a.time-b.time);
      const start=boundary(Math.max(0,time-60),false),end=boundary(time,true),seen=new Set(),visible=[];
      for(let index=start;index<end;index++){
        const row=timeline[index];
        if(!seen.has(row.id)){seen.add(row.id);visible.push(row);}
      }
      const items=visible.slice(-200);
      if(lastItems.length!==items.length||items.some((row,index)=>row.id!==lastItems[index].id)){
        const follow=list.scrollHeight-list.scrollTop-list.clientHeight<50,wanted=new Set(items.map(row=>row.id));
        for(const [id,node]of rows)if(!wanted.has(id)){node.remove();rows.delete(id);}
        let cursor=list.firstChild;
        for(const row of items){
          let line=rows.get(row.id);
          if(!line){line=document.createElement('p');const stamp=document.createElement('time'),name=document.createElement('strong');stamp.textContent=`${Math.floor(row.time/60)}:${String(Math.floor(row.time%60)).padStart(2,'0')}`;name.style.color=row.color;name.textContent=row.name;line.append(stamp,name,document.createTextNode(' '));content(line,row.content);rows.set(row.id,line);}
          if(line!==cursor)list.insertBefore(line,cursor);cursor=line.nextSibling;
        }
        lastItems=items;if(follow||time<lastTime)list.scrollTop=list.scrollHeight;
      }
      lastTime=time;const failure=failed.get(bucket),message=failure?.message||(pending.has(bucket)?'Loading chat replay…':items.length?'':'No messages at this point in the clip.');
      if(status.textContent!==message)status.textContent=message;
      retry.hidden=!failure?.retryable;note.hidden=!!failure||!cache.has(bucket);
    }
    async function load(bucket){
      try{
        const started=new Date(data.replay.startedAt+bucket*5000).toISOString(),url=`https://web.kick.com/api/v1/chat/${data.replay.channelId}/history?start_time=${encodeURIComponent(started)}`;
        const timeout=AbortSignal.timeout(15000),signal=AbortSignal.any([abort.signal,timeout]);
        const response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Object.assign(Error('Chat replay unavailable'),{status:response.status});
        const body=JSON.parse(await KickRefined.readText(response,{maxBytes:2097152,signal}));if(disposed)return;
        cache.set(bucket,KickRefinedClipTools.messages(body,data.replay,duration()));failed.delete(bucket);while(cache.size>30)cache.delete(cache.keys().next().value);
        timeline=null;
      }catch(error){if(!disposed&&!abort.signal.aborted)failed.set(bucket,KickRefinedClipTools.replayFailure(error));}
      finally{pending.delete(bucket);active--;if(!disposed){render();drain();}}
    }
    function drain(){while(!disposed&&!abort.signal.aborted&&active<2&&queue.length){const bucket=queue.shift();active++;void load(bucket);}}
    function update(){
      if(disposed)return;const bucket=Math.floor((video.currentTime||0)/5);
      const wanted=[bucket,Math.max(0,bucket-1),bucket+1].filter((value,i,all)=>all.indexOf(value)===i&&value*5<duration());
      // Reorder queued work around the latest position while retaining active reads.
      for(const value of queue)pending.delete(value);
      queue=wanted.filter(value=>!cache.has(value)&&!pending.has(value)&&!failed.has(value));
      for(const value of queue)pending.add(value);
      drain();render();
    }
    retry.addEventListener('click',()=>{
      for(const [bucket,failure]of failed)if(failure.retryable)failed.delete(bucket);
      update();
    },{signal:abort.signal});
    for(const type of ['timeupdate','seeking','loadedmetadata','play','pause'])video.addEventListener(type,update,{signal:abort.signal});
    function destroy(){
      if(disposed)return;
      disposed=true;abort.abort();signal.removeEventListener('abort',destroy);
      queue=[];lastItems=[];timeline=null;cache.clear();pending.clear();failed.clear();rows.clear();pane.remove();
    }
    signal.addEventListener('abort',destroy,{once:true});
    if(signal.aborted)destroy();else update();
    return {destroy};
  }
  globalThis.KickRefinedClipReplay=Object.freeze({create});
})();
