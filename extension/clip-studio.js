/* A single clipping surface. Workspace players never host or control its preview. */
(() => {
  const tools=globalThis.KickRefinedClipTools;
  const editable=event=>event.composedPath().some(node=>node?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName));
  const api=globalThis.browser||globalThis.chrome;
  const storage=api?.storage?.local;
  const styles=`
    #clip-creator-dialog[data-kr-clip-studio]{position:fixed!important;inset:16px!important;transform:none!important;margin:auto!important;width:min(680px,calc(100vw - 32px))!important;max-width:none!important;height:fit-content!important;max-height:calc(100dvh - 32px)!important;overflow:auto!important;box-sizing:border-box!important;padding:16px!important;border:1px solid #ffffff16!important;border-radius:16px!important;background:#121216!important;color:#e9e9ef!important;box-shadow:0 18px 70px #0008!important;font:13px/1.5 Inter,system-ui,sans-serif!important;color-scheme:dark}
    [data-kr-clip-studio] :is(button,input){font-family:inherit!important;border-radius:8px!important}
    [data-kr-clip-studio] [data-testid="clip-creator-title"]{background:#ffffff05!important;border:1px solid #ffffff19!important;font-size:14px!important;padding:10px 12px!important;box-sizing:border-box!important;width:100%!important}
    [data-kr-clip-studio] [data-testid="clip-creator-publish"]{background:var(--kr-accent,#b0ff8c)!important;color:#12200d!important;border-radius:9px!important;font-weight:700!important;padding:10px 18px!important}
    [data-kr-clip-studio] [data-testid="clip-creator-publish"]:disabled{opacity:.4!important}
    [data-kr-clip-studio] [data-kr-clip-preview],[data-kr-clip-studio] .aspect-video:has(#clip-creator-player){aspect-ratio:auto!important;width:100%!important;height:min(29dvh,270px)!important;max-height:min(29dvh,270px)!important;overflow:hidden!important}
    [data-kr-clip-studio] #clip-creator-player{width:100%!important;height:100%!important;max-height:min(29dvh,270px)!important;object-fit:contain!important;background:#08080a!important}
    html[data-kr-clip-frame] [data-kr-clip-titlebar]{display:none!important}
    [data-kr-clip-studio] :is([data-testid="clip-cropper-start"],[data-testid="clip-cropper-end"],[data-testid="clip-cropper-range"]){border-color:var(--kr-accent,#b0ff8c)!important}
    [data-kr-clip-studio] [data-kr-clip-track]{height:48px!important;min-height:48px!important;flex:none!important;border:1px solid #ffffff12!important;border-radius:9px!important;background:repeating-linear-gradient(90deg,#ffffff06 0 1px,transparent 1px 5%),linear-gradient(180deg,#292931,#1a1a21)!important;box-shadow:inset 0 1px #ffffff04!important}
    [data-kr-clip-track]>div:first-child:not(:has([data-testid="clip-cropper-range"])){background-image:none!important}
    [data-kr-clip-track] [data-testid="clip-cropper-range"]{border-top-width:2px!important;border-bottom-width:2px!important;background:color-mix(in srgb,var(--kr-accent,#b0ff8c) 12%,transparent)!important}
    [data-kr-clip-track] :is([data-testid="clip-cropper-start"],[data-testid="clip-cropper-end"]){width:12px!important;border-width:2px 4px!important;border-radius:3px!important;background:var(--kr-accent,#b0ff8c)!important;box-shadow:0 0 12px #b0ff8c20!important}
    html[data-kr-clip-frame] main,html[data-kr-clip-frame] #channel-chatroom,html[data-kr-clip-frame] #sidebar-wrapper,html[data-kr-clip-frame] nav{visibility:hidden!important}
    html[data-kr-clip-frame] :is(#clip-creator-dialog,#user-identity,[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]){visibility:visible!important}
    html[data-kr-clip-frame] [data-kr-clip-history-player]{visibility:visible!important;position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;min-height:0!important;margin:0!important;padding:0!important;aspect-ratio:auto!important;transform:none!important;background:#08080a!important;z-index:1!important}html[data-kr-clip-frame] [data-kr-clip-history-video]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important}html[data-kr-clip-frame] [data-kr-clip-history-shell]{position:static!important;transform:none!important;contain:none!important;display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;margin:0!important;padding:0!important}html[data-kr-clip-editing="true"] [data-kr-clip-history-player]{visibility:hidden!important}html[data-kr-clip-frame] #clip-creator-dialog{z-index:20!important}html[data-kr-clip-frame] [role="dialog"]:not(#clip-creator-dialog){z-index:100!important;background:#141418!important;color:#ededf4!important;border:1px solid #ffffff18!important;border-radius:14px!important;max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 20px)!important;overflow-y:auto!important}html[data-kr-clip-frame],html[data-kr-clip-frame] body{background:#0d0d10!important;overflow:hidden!important}
    html[data-kr-clip-frame] #clip-creator-dialog[data-kr-clip-studio]{inset:0!important;width:100%!important;height:100%!important;max-height:100%!important;display:flex!important;flex-direction:column!important;border:0!important;border-radius:0!important;box-shadow:none!important;margin:0!important;padding:14px!important}
    html[data-kr-clip-frame] :is([data-kr-clip-form],[data-kr-clip-form-body]){display:flex!important;flex-direction:column!important;justify-content:flex-start!important;flex:1!important;min-height:0!important;height:auto!important;gap:10px!important;overflow-y:auto!important;overflow-x:hidden!important;scrollbar-width:thin!important;scrollbar-color:#494953 transparent!important}html[data-kr-clip-frame] [data-kr-clip-main]{display:flex!important;flex-direction:column!important;flex:none!important;min-height:auto!important;height:auto!important;gap:10px!important}html[data-kr-clip-frame] [data-kr-clip-tools]{flex:none!important;min-height:min-content!important}
    html[data-kr-clip-frame] :is([data-kr-clip-form-body],[data-kr-clip-main])>:not([data-kr-clip-main]):not([data-kr-clip-preview-outer]){flex-shrink:0!important}
    html[data-kr-clip-frame] [data-kr-clip-actions]{position:sticky!important;bottom:0!important;z-index:5!important;background:#121216!important;border-top:1px solid #ffffff0b!important;padding:9px 0!important;flex-shrink:0!important;display:flex!important;flex-direction:row!important;justify-content:flex-end!important;gap:8px!important;margin-top:auto!important;box-shadow:0 -8px 12px #121216!important}
    html[data-kr-clip-frame] [data-kr-clip-preview-outer]{position:relative!important;flex:none!important;aspect-ratio:auto!important;min-height:200px!important;height:clamp(200px,42dvh,520px)!important;max-height:none!important;width:100%!important;border-radius:10px!important;overflow:hidden!important}
    html[data-kr-clip-frame] [data-kr-clip-preview]:not([data-kr-clip-preview-outer]){position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-height:none!important}
    html[data-kr-clip-frame] [data-kr-clip-preview-outer] #clip-creator-player{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-height:none!important;object-fit:contain!important}
    @media(max-width:520px){#clip-creator-dialog[data-kr-clip-studio]{inset:8px!important;width:calc(100vw - 16px)!important;padding:12px!important;max-height:calc(100dvh - 16px)!important}}
  `;
  const toolStyles=`
    :host([hidden]){display:none!important}:host{display:block;color:#e4e4ed;font:12px/1.5 Inter,system-ui,sans-serif;color-scheme:dark}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit;border:1px solid #ffffff16;border-radius:7px;background:#ffffff05;padding:7px 10px}button{cursor:pointer}button:hover{border-color:var(--kr-accent,#b0ff8c);background:#b0ff8c0c}button:disabled{cursor:default;opacity:.4}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--kr-accent,#b0ff8c);outline-offset:2px}.tools{border-top:1px solid #ffffff0d;margin-top:8px;padding-top:12px;display:grid;gap:12px}.row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.presets button{padding:5px 9px}.presets button[aria-pressed=true]{color:var(--kr-accent,#b0ff8c);border-color:#b0ff8c55;background:#b0ff8c0c}label{display:flex;align-items:center;gap:8px;color:#a3a3b4}input{width:78px;font-variant-numeric:tabular-nums}output{margin-left:auto;font-weight:650;color:var(--kr-accent,#b0ff8c);font-variant-numeric:tabular-nums}.muted{color:#9292a3}.status{min-height:18px;color:#aaaabc}.status:empty{display:none}.help{margin-left:auto}details{color:#9292a3}summary{cursor:pointer}p{margin:6px 0 0}kbd{color:#dedee8}.draft{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.draft span{flex:1}.danger{color:#ffb2b2}.pending{opacity:.6} @media(max-width:520px){.tools{gap:8px;padding-top:8px;margin-top:4px}.tools input{width:64px}.tools button{padding:6px 8px}.tools .draft span{font-size:10px}} @media(prefers-reduced-motion:no-preference){button{transition:background .12s,border-color .12s}}
  `;
  function nativeTitle(input,value){
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value.slice(0,50));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function createEditor({slug=()=>location.pathname.split('/')[1]||'',onOpen=()=>{},onClose=()=>{},enabled=true}={}){
    let active=null,disposed=false,scanFrame=0,saveTimer=0,draftRevision=0;
    const style=document.createElement('style');style.textContent=styles;(document.head||document.documentElement).append(style);
    async function readDraft(key){try{const rows=storage?(await storage.get('clipDrafts')).clipDrafts:JSON.parse(sessionStorage.getItem('kr-clip-drafts')||'{}');const item=rows?.[key];return item&&typeof item.title==='string'&&Number.isFinite(item.duration)&&Date.now()-item.at<7*86400000?item:null;}catch{return null;}}
    function scheduleSave(record){
      clearTimeout(saveTimer);const revision=++draftRevision;
      saveTimer=setTimeout(async()=>{
        if(disposed||active!==record||record.created)return;
        const current=tools.read(record.dialog),input=record.dialog.querySelector('[data-testid="clip-creator-title"]');if(!current||!input)return;
        const item={title:input.value.slice(0,50),duration:Math.round(current.duration),at:Date.now()};
        try{
          const rows=storage?(await storage.get('clipDrafts')).clipDrafts||{}:JSON.parse(sessionStorage.getItem('kr-clip-drafts')||'{}');
          if(disposed||revision!==draftRevision)return;
          rows[record.slug]=item;const bounded=Object.fromEntries(Object.entries(rows).filter(([key,value])=>/^[a-z0-9_]{1,40}$/i.test(key)&&value&&Date.now()-value.at<7*86400000).sort((a,b)=>b[1].at-a[1].at).slice(0,20));
          if(storage)await storage.set({clipDrafts:bounded});else sessionStorage.setItem('kr-clip-drafts',JSON.stringify(bounded));
          if(active===record){record.draft=item;record.note.textContent='Title and length saved on this device.';}
        }catch{if(active===record)record.note.textContent='Draft could not be saved.';}
      },300);
    }
    function release(){
      if(!active)return;clearTimeout(saveTimer);draftRevision++;active.observer.disconnect();active.abort.abort();active.host.remove();active.dialog.removeAttribute('data-kr-clip-studio');for(const node of active.dialog.querySelectorAll('[data-kr-clip-preview],[data-kr-clip-titlebar],[data-kr-clip-track],[data-kr-clip-form],[data-kr-clip-form-body],[data-kr-clip-main],[data-kr-clip-preview-outer],[data-kr-clip-actions]')){node.removeAttribute('data-kr-clip-preview');node.removeAttribute('data-kr-clip-titlebar');node.removeAttribute('data-kr-clip-track');for(const name of ['data-kr-clip-form','data-kr-clip-form-body','data-kr-clip-main','data-kr-clip-preview-outer','data-kr-clip-actions'])node.removeAttribute(name);}active=null;onClose();
    }
    function mount(dialog){
      if(active?.dialog===dialog)return;
      release();dialog.setAttribute('data-kr-clip-studio','');
      const heading=dialog.querySelector('h1,h2,h3'),titlebar=heading?.closest('header')||dialog.firstElementChild;
      if(titlebar&&heading&&titlebar.contains(heading)&&!titlebar.querySelector('form'))titlebar.setAttribute('data-kr-clip-titlebar','');
      const host=document.createElement('div');host.dataset.krClipTools='';const shadow=host.attachShadow({mode:'open'});
      const sheet=document.createElement('style');sheet.textContent=toolStyles;shadow.append(sheet);
      const ui=document.createElement('section');ui.className='tools';ui.setAttribute('aria-label','Clip editing tools');
      ui.innerHTML=`<div class="row presets" role="group" aria-label="Clip duration">${[10,15,30,60,90,180].map(value=>`<button type="button" data-duration="${value}" aria-pressed="false">${value<60?value+'s':value/60+'m'}</button>`).join('')}<output aria-label="Selected clip length"></output></div><div class="row trim"><label>In <input type="number" min="0" step="1" aria-label="Clip start in seconds"></label><label>Out <input type="number" min="10" step="1" aria-label="Clip end in seconds"></label><button type="button" data-act="back" title="Move selection back one second">−1s</button><button type="button" data-act="forward" title="Move selection forward one second">+1s</button><button type="button" data-act="reset">Reset trim</button></div><div class="row"><button type="button" data-act="replay">Replay selection</button><label>Speed <select aria-label="Clip preview speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><details class="help"><summary>Shortcuts</summary><p><kbd>Space</kbd> Play / pause · <kbd>I</kbd> Set in · <kbd>O</kbd> Set out<br><kbd>← →</kbd> Seek 1s · <kbd>Shift ← →</kbd> Move selection</p></details></div><div class="draft"><span class="muted">Drafts save your title and length, not footage.</span><button type="button" data-act="restore" hidden>Restore draft</button></div><div class="status" role="status" aria-live="polite"></div>`;
      shadow.append(ui);dialog.append(host);
      const record=active={dialog,host,shadow,slug:slug(),abort:new AbortController(),busy:false,initial:null,draft:null,created:false,note:ui.querySelector('.status')};
      const signal=record.abort.signal,inputs=ui.querySelectorAll('input'),start=inputs[0],end=inputs[1],output=ui.querySelector('output');
      const say=message=>{if(active===record)record.note.textContent=message;};
      async function trim(value){
        if(active!==record||record.busy||record.created)return;
        record.busy=true;render();say('Adjusting trim…');
        try{await tools.apply(dialog,value);if(active===record){say('Trim updated. Preview loops your selection.');scheduleSave(record);}}
        catch(error){say(error.message);}
        finally{record.busy=false;if(active===record)render();}
      }
      function video(){return dialog.querySelector('#clip-creator-player')||dialog.querySelector('video');}
      function seek(key){const slider=dialog.querySelector('[role="slider"][aria-label="Current video time"]');if(slider){slider.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));slider.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));return true;}say('The preview is still loading.');return false;}
      function render(){
        if(active!==record)return;
        const submit=dialog.querySelector('[data-testid="clip-creator-publish"]'),actions=submit?.parentElement;
        if(actions&&!actions.hasAttribute('data-kr-clip-actions'))actions.setAttribute('data-kr-clip-actions','');
        if(actions&&actions!==submit.closest('form')){if(host.nextElementSibling!==actions)actions.before(host);}else if(host.parentElement!==dialog)dialog.append(host);
        const created=!!dialog.querySelector('[data-testid="clip-share-url"]');record.created=created;host.hidden=created;
        const current=tools.read(dialog),ready=!!current&&!record.busy&&!created;
        if(current&&!current.track.hasAttribute('data-kr-clip-track'))current.track.setAttribute('data-kr-clip-track','');
        const preview=video()?.parentElement;if(preview&&!preview.hasAttribute('data-kr-clip-preview'))preview.setAttribute('data-kr-clip-preview','');
        const form=submit?.closest('form');
        if(form&&preview){
          const body=form.children.length===1?form.firstElementChild:form;
          let outer=preview;while(outer.parentElement&&outer.parentElement!==body&&outer.parentElement!==form&&outer.parentElement.classList.contains('aspect-video'))outer=outer.parentElement;
          for(const [node,name]of [[form,'data-kr-clip-form'],[body,'data-kr-clip-form-body'],[outer,'data-kr-clip-preview-outer']])if(!node.hasAttribute(name))node.setAttribute(name,'');
          const main=outer.parentElement;if(main&&main!==body&&main!==form&&!main.hasAttribute('data-kr-clip-main'))main.setAttribute('data-kr-clip-main','');
        }
        for(const node of ui.querySelectorAll('button,input,select'))node.disabled=!ready;
        if(!current){if(!created)say('Preparing the clip timeline…');return;}
        if(!record.initial)record.initial={start:current.start,end:current.end};
        start.max=String(Math.max(0,current.end-10));end.min=String(current.start+10);end.max=String(Math.min(current.total,current.start+180));
        if(shadow.activeElement!==start)start.value=String(Math.round(current.start));if(shadow.activeElement!==end)end.value=String(Math.round(current.end));
        const length=`${tools.format(current.duration)} selected`;if(output.textContent!==length)output.textContent=length;
        for(const button of ui.querySelectorAll('[data-duration]')){const duration=Number(button.dataset.duration);button.disabled=!ready||duration>current.total;const pressed=String(Math.abs(current.duration-duration)<.5);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}
      }
      ui.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button||button.disabled)return;const current=tools.read(dialog);if(!current)return;
        if(button.dataset.duration){const duration=Number(button.dataset.duration);void trim({start:Math.max(0,current.end-duration),end:current.end});}
        else if(button.dataset.act==='back'||button.dataset.act==='forward'){const delta=button.dataset.act==='back'?-1:1,start=Math.max(0,Math.min(current.total-current.duration,current.start+delta));void trim({start,end:start+current.duration});}
        else if(button.dataset.act==='reset')void trim(record.initial);
        else if(button.dataset.act==='replay'){if(seek('Home'))video()?.play()?.catch(()=>say('Click play in the preview to enable playback.'));}
        else if(button.dataset.act==='restore'&&record.draft){const input=dialog.querySelector('[data-testid="clip-creator-title"]');if(input)nativeTitle(input,record.draft.title);void trim({start:Math.max(0,current.end-record.draft.duration),end:current.end});}
      },{signal});
      const numeric=()=>{const current=tools.read(dialog),a=Number(start.value),b=Number(end.value);if(!current||start.value===''||end.value===''||!Number.isFinite(a)||!Number.isFinite(b)||b-a<10||b-a>180||a<0||b>current.total){say('Choose a range between 10 and 180 seconds within this preview.');render();return;}void trim({start:a,end:b});};
      start.addEventListener('change',numeric,{signal});end.addEventListener('change',numeric,{signal});
      ui.querySelector('select').addEventListener('change',event=>{const preview=video();if(preview){try{preview.playbackRate=Number(event.target.value);}catch{say('This preview does not support speed changes.');}}},{signal});
      function keyboard(event){
        if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||editable(event)||record.busy||record.created)return;
        const current=tools.read(dialog),preview=video();if(!current||!preview)return;let handled=true;
        if(event.code==='Space'){if(preview.paused)preview.play()?.catch(()=>say('Click play in the preview to enable playback.'));else preview.pause();}
        else if(event.key.toLowerCase()==='i')void trim({start:Math.min(current.end-10,Math.max(0,preview.currentTime)),end:current.end});
        else if(event.key.toLowerCase()==='o')void trim({start:current.start,end:Math.max(current.start+10,preview.currentTime)});
        else if(['ArrowLeft','ArrowRight'].includes(event.key)){if(event.shiftKey){const delta=event.key==='ArrowLeft'?-1:1,a=Math.max(0,Math.min(current.total-current.duration,current.start+delta));void trim({start:a,end:a+current.duration});}else seek(event.key);}
        else handled=false;
        if(handled){event.preventDefault();event.stopImmediatePropagation();}
      }
      dialog.addEventListener('keydown',keyboard,{signal,capture:true});
      shadow.addEventListener('keydown',event=>{if(!editable(event)&&event.key!=='Escape')keyboard(event);if(event.key!=='Escape')event.stopPropagation();},{signal});
      dialog.addEventListener('input',event=>{if(event.target.matches('[data-testid="clip-creator-title"]'))scheduleSave(record);},{signal});
      record.observer=new MutationObserver(records=>{if(records.every(item=>item.target===host||host.contains(item.target)))return;render();if(records.some(item=>item.type==='attributes'&&(item.target.querySelector?.('[data-testid="clip-cropper-range"]')||item.target.closest?.('[data-testid^="clip-cropper"]'))))scheduleSave(record);});
      record.observer.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['style','disabled'],characterData:true});
      void readDraft(record.slug).then(draft=>{if(active!==record||!draft)return;record.draft=draft;ui.querySelector('[data-act="restore"]').hidden=false;});
      record.render=render;render();onOpen(dialog);
    }
    function scan(){scanFrame=0;if(disposed||!enabled)return;const dialog=document.getElementById('clip-creator-dialog');if(dialog&&dialog.getAttribute('data-state')!=='closed'){if(dialog.dispatchEvent(new Event('kick-refined:surface-ready',{bubbles:true,cancelable:true})))mount(dialog);}else release();}
    const observer=new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.id==='clip-creator-dialog'||node.querySelector?.('#clip-creator-dialog'))))&&!scanFrame)scanFrame=requestAnimationFrame(scan);});
    observer.observe(document.documentElement,{childList:true,subtree:true});scan();
    return {refresh:scan,async applyRange(value){if(!active)throw Error('No active clip editor');const record=active;record.busy=true;record.render();try{await tools.apply(record.dialog,value);if(active===record){record.initial={...value};record.note.textContent='Your replay selection is ready to fine-tune.';}}finally{record.busy=false;if(active===record)record.render();}},setEnabled(value){enabled=!!value;style.disabled=!enabled;if(enabled)scan();else release();},destroy(){disposed=true;observer.disconnect();cancelAnimationFrame(scanFrame);release();style.remove();}};
  }
  globalThis.KickRefinedClipStudio=Object.freeze({create:options=>KickRefinedClipWorkspace.create({...options,createEditor}),createEditor});
})();
