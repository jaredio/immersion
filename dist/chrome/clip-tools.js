/* Public clip downloads and timestamped replay data, loaded only on request. */
(() => {
  const maxBytes=256*1024*1024;
  function image(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.endsWith('.kick.com')&&!url.username&&!url.password&&!url.port?url.href:'';}catch{return '';}}
  function details(data,clip){
    const channel=data.channel,match=typeof channel?.slug==='string'&&channel.slug.toLowerCase()===clip.channel.toLowerCase();
    const startedAt=typeof data.started_at==='string'&&/^\d{4}-\d\d-\d\dT/.test(data.started_at)?Date.parse(data.started_at):NaN;
    const channelId=Number(data.channel_id||channel?.id);
    return {channelName:match&&typeof channel.username==='string'?channel.username.slice(0,80):clip.channel,channelImage:match?image(channel.profile_picture):'',replay:Number.isSafeInteger(channelId)&&channelId>0&&Number.isFinite(startedAt)?{channelId,startedAt}:null};
  }
  function resource(value,base,id){const url=new URL(value,base);if(!KickRefinedClips.mediaURL(url.href,id))throw Error('Unsupported clip media address.');return url.href;}
  function range(value,previous,url){
    const match=/^(\d+)(?:@(\d+))?$/.exec(value||'');if(!match)throw Error('Invalid clip byte range.');
    const length=Number(match[1]),start=match[2]===undefined?(previous?.url===url?previous.end+1:NaN):Number(match[2]),end=start+length-1;
    if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||length<1||length>maxBytes)throw Error('Invalid clip byte range.');return {url,start,end};
  }
  function playlist(text,base,id){
    if(typeof text!=='string'||text.length>1048576||!text.trimStart().startsWith('#EXTM3U'))throw Error('Invalid clip playlist.');
    const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),variants=[],segments=[];
    let bandwidth=null,pendingRange=null,previous=null,init=null,duration=0;
    for(const line of lines){
      if(line.startsWith('#EXT-X-STREAM-INF:')){bandwidth=Number(/(?:^|,)BANDWIDTH=(\d+)/.exec(line.split(':').slice(1).join(':'))?.[1])||0;continue;}
      if(line.startsWith('#EXT-X-KEY:')&&!/METHOD=NONE(?:,|$)/.test(line))throw Error('Encrypted clips cannot be downloaded here.');
      if(line.startsWith('#EXT-X-MEDIA:')&&/TYPE=AUDIO/.test(line)&&/URI=/.test(line))throw Error('This clip uses a separate audio track. Open it on Kick to download.');
      if(line==='#EXT-X-DISCONTINUITY')throw Error('This clip has multiple media timelines. Open it on Kick to download.');
      if(line.startsWith('#EXTINF:')){const seconds=Number(line.slice(8).split(',')[0]);if(!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid clip duration.');duration+=seconds;}
      if(line.startsWith('#EXT-X-BYTERANGE:'))pendingRange=line.slice(17);
      if(line.startsWith('#EXT-X-MAP:')){const uri=/URI="([^"]+)"/.exec(line)?.[1];if(!uri)throw Error('Invalid MP4 initialization.');const url=resource(uri,base,id),raw=/BYTERANGE="([^"]+)"/.exec(line)?.[1],next={url,range:raw?range(raw,null,url):null};if(init&&JSON.stringify(init)!==JSON.stringify(next))throw Error('Clip initialization changed.');init=next;}
      if(line.startsWith('#'))continue;
      const url=resource(line,base,id);
      if(bandwidth!==null){variants.push({url,bandwidth});bandwidth=null;continue;}
      const bytes=pendingRange?range(pendingRange,previous,url):null;segments.push({url,range:bytes});previous=bytes;pendingRange=null;
    }
    if(variants.length)return {variant:variants.sort((a,b)=>b.bandwidth-a.bandwidth)[0].url};
    if(!lines.includes('#EXT-X-ENDLIST')||!segments.length||segments.length>400||duration>600)throw Error('Only completed clips up to ten minutes can be downloaded.');
    return {segments,init,duration};
  }
  async function bytes(response,limit,signal){
    if(!response.ok)throw Error(`Clip download failed (${response.status}).`);
    if(Number(response.headers.get('content-length'))>limit){void response.body?.cancel();throw Error('Clip download is too large.');}
    const reader=response.body.getReader(),parts=[];let size=0;
    try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Clip download is too large.');parts.push(value);}}
    finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
    const out=new Uint8Array(size);let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out;
  }
  let muxModule;
  async function download(data,clip,{signal,onProgress=()=>{}}){
    const controller=new AbortController(),stop=()=>controller.abort(signal.reason),timer=setTimeout(()=>controller.abort(),120000);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
    let transmuxer;
    try{
      const read=async(url,binary=false,partRange=null)=>{
        controller.signal.throwIfAborted();resource(url,url,clip.id);
        const headers=partRange?{Range:`bytes=${partRange.start}-${partRange.end}`}:{},response=await fetch(url,{signal:controller.signal,headers,credentials:'omit',referrerPolicy:'no-referrer'});
        if(!response.ok)throw Error(`Clip download failed (${response.status}).`);
        if(!binary)return KickRefined.readText(response,{maxBytes:1048576,signal:controller.signal});
        let part=await bytes(response,Math.min(maxBytes,64*1024*1024),controller.signal);
        if(partRange){const size=partRange.end-partRange.start+1;if(response.status===200){if(part.length<=partRange.end)throw Error('Incomplete clip byte range.');part=part.slice(partRange.start,partRange.end+1);}else if(response.status!==206||part.length!==size||response.headers.get('content-range')?.split('/')[0]!==`bytes ${partRange.start}-${partRange.end}`)throw Error('Incomplete clip byte range.');}
        return part;
      };
      if(/\.mp4(?:\?|$)/i.test(data.src))return new Blob([await read(data.src,true)],{type:'video/mp4'});
      let url=data.src,parsed;
      for(let depth=0;depth<4;depth++){parsed=playlist(await read(url),url,clip.id);if(!parsed.variant)break;url=parsed.variant;}
      if(!parsed.segments)throw Error('Clip playlist is too deeply nested.');
      const parts=[];let size=0,received=0,initialized=false;
      const append=part=>{size+=part.byteLength;if(size>maxBytes)throw Error('Clip download is too large.');parts.push(part);};
      if(parsed.init)append(await read(parsed.init.url,true,parsed.init.range));
      else{
        muxModule ||= import(KickRefined.api.runtime.getURL('vendor/mux.mjs')).catch(error=>{muxModule=null;throw error;});
        const {Transmuxer}=await muxModule;controller.signal.throwIfAborted();transmuxer=new Transmuxer({remux:true});
        transmuxer.on('data',segment=>{if(!initialized){append(segment.initSegment);initialized=true;}append(segment.data);});
      }
      for(let i=0;i<parsed.segments.length;i++){
        const segment=parsed.segments[i],part=await read(segment.url,true,segment.range);received+=part.byteLength;if(received>maxBytes)throw Error('Clip download is too large.');
        if(transmuxer){transmuxer.push(part);transmuxer.flush();}else append(part);
        onProgress(Math.round((i+1)*100/parsed.segments.length));await new Promise(resolve=>setTimeout(resolve,0));
      }
      controller.signal.throwIfAborted();if(!parts.length)throw Error('No playable video was found.');return new Blob(parts,{type:'video/mp4'});
    }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);transmuxer?.dispose();}
  }
  function filename(clip,title){return `${clip.channel}-${typeof title==='string'?title:'clip'}`.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'').replace(/[. ]+$/g,'').slice(0,130)+'-'+clip.id+'.mp4';}
  function messages(body,replay,duration){
    if(!Array.isArray(body?.data?.messages))throw Error('Chat replay is unavailable.');
    const seen=new Set(),out=[];
    for(const value of body.data.messages.slice(0,5000)){
      if(!value||typeof value!=='object'||typeof value.created_at!=='string')continue;
      const at=Date.parse(value.created_at),time=(at-replay.startedAt)/1000;
      if(!Number.isFinite(time)||time<0||time>duration||typeof value.content!=='string'||!['message','reply'].includes(value.type||'message'))continue;
      const id=typeof value.id==='string'?value.id.slice(0,100):`${at}:${value.sender?.id}:${value.content.slice(0,100)}`;if(seen.has(id))continue;seen.add(id);
      out.push({id,time,content:value.content.slice(0,4000),name:typeof value.sender?.username==='string'?value.sender.username.slice(0,80):'Viewer',color:/^#[0-9a-f]{6}$/i.test(value.sender?.identity?.color||'')?value.sender.identity.color:'#b8b8c8'});
    }
    return out.sort((a,b)=>a.time-b.time);
  }
  globalThis.KickRefinedClipTools=Object.freeze({image,details,playlist,download,filename,messages});
})();
