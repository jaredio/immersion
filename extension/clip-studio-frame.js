/* A dedicated, same-site native clip provider; never a workspace stream tile. */
(() => {
  const match=window.name.match(/^kick-refined-clip:([a-z0-9_]{1,40})$/);
  if(!match||window===window.top||!['https://kick.com','https://www.kick.com'].includes(location.origin))return;
  const slug=match[1],replay=globalThis.KickRefinedClipHistory.recording(location.href,slug);
  if(location.pathname.replace(/\/$/,'').toLowerCase()===`/${slug}/videos`){
    function catalog(){
      let token='',timer=0,deadline=0,disposed=false;
      function scan(){
        clearTimeout(timer);if(disposed||!token)return;
        const rows=KickRefinedClipCatalog.fromDocument(document,slug);
        if(rows.length||Date.now()>=deadline){window.parent.postMessage({type:'immersion:clip-catalog',token,rows},location.origin);return;}
        timer=setTimeout(scan,500);
      }
      const message=event=>{const data=event.data;if(token||event.source!==window.parent||event.origin!==location.origin||data?.type!=='immersion:clip-start'||data.mode!=='catalog'||data.slug!==slug||typeof data.token!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.token))return;token=data.token;deadline=Date.now()+8000;scan();};
      window.addEventListener('message',message);window.parent.postMessage({type:'immersion:clip-frame-ready',slug},location.origin);
      window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);window.removeEventListener('message',message);},{once:true});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',catalog,{once:true});else catalog();return;
  }
  if(location.pathname.replace(/\/$/,'').toLowerCase()!==`/${slug}`&&!replay)return;
  function boot(){
    document.documentElement.dataset.krClipFrame='';
    let token='',started=false,opened=false,poll=0,trimTimer=0,clipTimer=0,disposed=false,mode='live',pendingRange=null,lastSource=0,lastSourceKey='',source=null,editing=false;
    const wired=new WeakSet(),abort=new AbortController(),sourceMarks=new Map();
    const send=(type,extra={})=>{if(token&&!disposed)window.parent.postMessage({type,token,...extra},location.origin);};
    const sourceVideo=()=>[...document.querySelectorAll('main video')].find(video=>!video.closest('#clip-creator-dialog,[role="dialog"]'));
    function sourceDuration(video){
      const slider=[...document.querySelectorAll('main [role="slider"][aria-label="Current video time"]')].find(node=>!node.closest('[role="dialog"],#clip-creator-dialog'));
      const declared=Number(slider?.getAttribute('aria-valuemax'))/1000;
      return Math.max(Number.isFinite(video?.duration)?video.duration:0,Number.isFinite(declared)?declared:0);
    }
    function sourceState(force=false){
      if(mode!=='history'||!token||editing||!force&&Date.now()-lastSource<250)return;lastSource=Date.now();const video=sourceVideo();if(!video)return;
      const duration=sourceDuration(video);
      const nativePreview=[...document.querySelectorAll('main img[src*="/media/thumbnails/thumbnail-sheet-"]')].find(node=>KickRefinedClipHistory.thumbnail(node.src,0,duration));
      const media=nativePreview?.src||document.querySelector('meta[property="og:video"],meta[property="og:video:url"]')?.content||'';
      const key=`${duration}|${Math.floor(video.currentTime*4)}|${video.paused}|${media}`;if(key===lastSourceKey)return;lastSourceKey=key;
      send('immersion:clip-source-state',{duration,time:video.currentTime,playing:!video.paused,media:media.length<=4096?media:''});
    }
    function prepareSource(){
      const video=sourceVideo();if(!video)return;
      if(!video.muted)video.muted=true;
      if(!wired.has(video)){wired.add(video);for(const event of ['timeupdate','loadedmetadata','durationchange','seeked'])video.addEventListener(event,()=>sourceState(),{signal:abort.signal});}
      if(mode==='history'){
        if(!video.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true})))return;
        let root=video.closest('#injected-channel-player,#video-player')||video.parentElement;
        const main=video.closest('main');while(root?.parentElement&&root.parentElement!==main)root=root.parentElement;
        if(root&&root!==main){
          const next=new Map([[root,'data-kr-clip-history-player'],[video,'data-kr-clip-history-video']]);
          for(let node=video.parentElement;node&&node!==root;node=node.parentElement)next.set(node,'data-kr-clip-history-shell');
          for(const [node,name]of sourceMarks)if(next.get(node)!==name)node.removeAttribute(name);
          sourceMarks.clear();for(const [node,name]of next){if(!node.hasAttribute(name))node.setAttribute(name,'');sourceMarks.set(node,name);}source=root;
        }
        sourceState(true);
      }
    }
    const editor=KickRefinedClipStudio.createEditor({slug:()=>slug,onOpen:dialog=>{
      clearTimeout(clipTimer);opened=true;editing=true;document.documentElement.dataset.krClipEditing='true';send('immersion:clip-state',{state:'editing'});
      if(pendingRange){let attempts=0;const apply=async()=>{if(disposed||!dialog.isConnected)return;if(!KickRefinedClipTools.read(dialog)){if(attempts++<80)trimTimer=setTimeout(apply,100);return;}const requested=pendingRange;pendingRange=null;try{await editor.applyRange(requested);}catch{send('immersion:clip-state',{state:'error'});}};void apply();}
    },onClose:()=>{
      editing=false;opened=false;document.documentElement.dataset.krClipEditing='false';
      if(mode==='history'){send('immersion:clip-state',{state:'history'});prepareSource();}else if(started)send('immersion:clip-close');
    }});
    function tryOpen(){
      poll=0;if(disposed)return;prepareSource();
      if(mode==='history'){if(sourceDuration(sourceVideo())>=10)send('immersion:clip-state',{state:'history'});else poll=setTimeout(tryOpen,500);return;}
      if(opened)return;
      if(document.getElementById('clip-creator-dialog')){editor.refresh();return;}
      const auth=document.querySelector('[data-testid="auth-login-form"],form:has(input[type="password"])');
      if(auth){send('immersion:clip-state',{state:'auth'});started=false;poll=setTimeout(tryOpen,500);return;}
      if(!started){
        const main=document.querySelector('main');
        if(main?.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true}))){
          const live=KickRefinedClipCatalog.fromDocument(document,slug).find(row=>row.live);
          if(live){
            const request=document.createElement('span');request.id='kr-clip-native-request';request.dataset.mode='live';request.dataset.videoId=live.id;document.body.append(request);
            started=!request.dispatchEvent(new Event('immersion:clip-native-request',{bubbles:true,cancelable:true}));request.remove();
            if(started)send('immersion:clip-state',{state:'requesting'});
          }
        }
      }
      const button=[...document.querySelectorAll('main button')].find(node=>!node.disabled&&(/\bclip\b/i.test([node.getAttribute('aria-label'),node.title,node.dataset.testid,node.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ')))&&!node.closest('[role="dialog"]'));
      if(button&&!started&&button.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true}))){started=true;button.click();send('immersion:clip-state',{state:'requesting'});}
      poll=setTimeout(tryOpen,500);
    }
    function closeEditor(){
      const dialog=document.getElementById('clip-creator-dialog');if(!dialog)return;
      const cancel=[...dialog.querySelectorAll('button')].find(button=>/^cancel$/i.test(button.textContent.trim()))||dialog.querySelector('button[aria-label*="close" i]');cancel?.click();
    }
    function message(event){
      const data=event.data;
      if(disposed||event.source!==window.parent||event.origin!==location.origin||typeof data?.token!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data.token))return;
      if(data.type==='immersion:clip-start'){
        if(token||data.slug!==slug)return;token=data.token;mode=data.mode==='history'&&replay?'history':'live';tryOpen();return;
      }
      if(!token||data.token!==token||mode!=='history')return;
      if(data.type==='immersion:clip-seek'&&Number.isFinite(data.time)){
        if(editing)closeEditor();const video=sourceVideo(),duration=sourceDuration(video);if(!video||duration<10)return;
        try{video.currentTime=Math.max(0,Math.min(duration-.01,data.time));sourceState(true);}catch{send('immersion:clip-state',{state:'error'});}
      }else if(data.type==='immersion:clip-play'){
        const video=sourceVideo();if(!video)return;if(video.paused)video.play()?.catch(()=>{});else video.pause();
      }else if(data.type==='immersion:clip-browse')closeEditor();
      else if(data.type==='immersion:clip-create'&&replay&&!editing){
        if(pendingRange){send('immersion:clip-state',{state:'error'});return;}
        const video=sourceVideo(),duration=sourceDuration(video);
        if(!video||!Number.isFinite(duration)||!Number.isFinite(data.start)||!Number.isFinite(data.end)||data.start<0||data.end>duration||data.end-data.start<10||data.end-data.start>180)return;
        pendingRange={start:0,end:data.end-data.start};video.pause();
        const request=document.createElement('span');request.id='kr-clip-native-request';request.dataset.start=String(data.start);document.body.append(request);
        const handled=!request.dispatchEvent(new Event('immersion:clip-native-request',{bubbles:true,cancelable:true}));request.remove();
        if(!handled){pendingRange=null;send('immersion:clip-state',{state:'error'});}else clipTimer=setTimeout(()=>{if(!editing&&pendingRange)send('immersion:clip-state',{state:'error'});},25000);
      }
    }
    const observer=new MutationObserver(records=>{
      if(mode==='history'&&records.some(record=>record.type==='attributes'||[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('img,[role=slider][aria-label="Current video time"]')||node.querySelector('img,[role=slider][aria-label="Current video time"]')))))sourceState(true);
      if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('video')||node.querySelector('video')))))prepareSource();
      if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('[data-testid="clip-share-url"]')||node.querySelector('[data-testid="clip-share-url"]')))))send('immersion:clip-state',{state:'created'});
      if(pendingRange&&document.querySelector('form input[type=password]'))send('immersion:clip-state',{state:'auth'});
    });observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','aria-valuemax']});
    window.addEventListener('message',message);window.parent.postMessage({type:'immersion:clip-frame-ready',slug},location.origin);window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;clearTimeout(poll);clearTimeout(trimTimer);clearTimeout(clipTimer);observer.disconnect();abort.abort();editor.destroy();window.removeEventListener('message',message);}},{once:true});
    prepareSource();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
