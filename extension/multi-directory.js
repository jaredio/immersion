/* Channel directory ownership: cards, channel picker and expanded profiles. */
(() => {
  const {attr}=KickRefinedMultiView;
  function create({scope,getState,getCatalog,getContext,channelPanel,metadata,directory,shadow,$,onKeydown,onWatchProfileVideo,onPosition:schedulePosition}) {
    const channelPicker=document.createElement('span');
    channelPicker.className='channel-name-options';
    channelPicker.setAttribute('role','group');
    channelPicker.setAttribute('aria-label','Switch stream details');
    const directoryCards=new Map();
    let channelVersion=0,expandedChannel='',directoryChannel='',directoryLayout='',pickerKey='',directoryProfile=null;
    function clearDirectoryProfile(){
      if(!directoryProfile)return;
      const record=directoryCards.get(directoryProfile.slug);
      // The cached card no longer contains the expanded profile.
      if(record)record.key=null;
      directoryProfile.controller?.destroy();
      directoryProfile.region.remove();
      directoryProfile=null;
    }
    function selectDirectoryChannel(slug,tab,{reveal=true}={}){
      const state=getState();
      if(!state.channels.includes(slug))return;
      directoryChannel=slug;
      expandedChannel=tab?slug:'';
      if(directoryProfile?.slug!==expandedChannel)clearDirectoryProfile();
      else if(tab)directoryProfile.controller.selectTab(tab);
      renderDirectory(tab);
      if(tab&&reveal)directoryProfile?.region.scrollIntoView({block:'nearest'});
      schedulePosition();
    }
    function renderDirectory(initialTab='about'){
      const state=getState(),catalog=getCatalog(),context=getContext();
      globalThis.KickRefinedPerf?.count('view.directoryUpdates');
      const list=$('#multi-channel-list'),channels=state.channels;
      const showPool=channels.length>1&&(state.layout==='grid'||state.layout==='columns');
      directory.hidden=!channels.length;
      const pickerFocused=channelPicker.contains(shadow.activeElement)?shadow.activeElement.dataset.detailsChannel:null;
      if(state.layout==='focus'&&(directoryLayout!==state.layout||!expandedChannel)&&channels.includes(state.focus))directoryChannel=state.focus;
      directoryLayout=state.layout;
      if(!channels.includes(directoryChannel))directoryChannel=channels.includes(state.focus)?state.focus:channels[0];
      if(expandedChannel!==directoryChannel){expandedChannel='';clearDirectoryProfile();}
      for(const [slug,record]of directoryCards)if(!channels.includes(slug)){record.entry.remove();directoryCards.delete(slug);}
      const identities=showPool?channels.map(slug=>[slug,channelPanel.identity?.(slug,catalog.get(slug))||catalog.get(slug)||{}]):[];
      const signature=JSON.stringify(identities.map(([slug,meta])=>[slug,meta.title,!!meta.verified,meta.image,meta.streamTitle]));
      if(pickerKey!==signature){
        pickerKey=signature;
        channelPicker.replaceChildren(...identities.map(([slug,meta])=>{
          const button=document.createElement('button');
          button.type='button';button.dataset.detailsChannel=slug;
          const title=meta.title||slug;
          const label=document.createElement('span');label.textContent=title;
          const badge=meta.verified?KickRefinedChannelPanel.verificationBadge(meta.verified instanceof Element?meta.verified:null):null;
          button.setAttribute('aria-label',title);
          const avatar=document.createElement('span');avatar.className='channel-pool-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=title.slice(0,1).toUpperCase();
          const image=meta.image&&KickRefinedProfile.image(meta.image,'');
          if(image)avatar.append(image);
          const copy=document.createElement('span');copy.className='channel-pool-copy';
          const name=document.createElement('span');name.className='channel-pool-name';name.append(label);if(badge)name.append(badge);
          copy.append(name);
          if(meta.streamTitle){
            const streamTitle=document.createElement('span');streamTitle.className='channel-pool-title';streamTitle.id=`channel-pool-title-${slug}`;streamTitle.textContent=meta.streamTitle;streamTitle.title=meta.streamTitle;copy.append(streamTitle);
            button.setAttribute('aria-describedby',streamTitle.id);
          }
          button.append(avatar,copy);
          return button;
        }));
      }
      for(const button of channelPicker.children)attr(button,'aria-pressed',button.dataset.detailsChannel===directoryChannel);
      for(const slug of channels)metadata.requestChannel(slug);
      const slug=directoryChannel;
      if(!slug)return;
      const meta=catalog.get(slug)||{},panels=metadata.panels(slug),expanded=expandedChannel===slug;
      const key=JSON.stringify([meta,expanded,showPool,slug===context?.slug?channelPanel.version:0]);
      let record=directoryCards.get(slug);
      if(!record||record.key!==key||expanded&&record.panels!==panels){
        const focus=shadow.activeElement,focused=focus?.classList.contains('channel-expand'),action=focus?.dataset.kind;
        const next=channelPanel.card(slug,meta,{expanded,panels,fullProfile:true,showPool,onToggle:()=>selectDirectoryChannel(slug,expandedChannel===slug?null:'about',{reveal:!showPool})});
        const bio=next.querySelector('.multi-expanded-profile');
        const profileFactory=globalThis.KickRefinedChannelPage?.create;
        if(expanded&&bio&&profileFactory&&globalThis.KickRefinedChannelLibrary){
          if(!directoryProfile){
            const region=document.createElement('div');region.className='channel-profile-region';
            const profile={slug,region,tab:initialTab,controller:null,bio:null};
            directoryProfile=profile;
            profile.controller=profileFactory({remoteSlug:slug,initialTab,onKeydown,onWatch:onWatchProfileVideo,onTabChange:tab=>{
              profile.tab=tab;if(profile.bio)profile.bio.hidden=tab!=='about';
            }});
            profile.controller.refresh();region.append(profile.controller.host);
          }
          directoryProfile.bio?.remove();
          directoryProfile.bio=bio;bio.hidden=directoryProfile.tab!=='about';
          directoryProfile.region.append(bio);
        }
        if(record){
          for(const child of [...record.entry.children])if(child!==directoryProfile?.region&&child!==channelPicker)child.remove();
          record.entry.prepend(...next.childNodes);
          for(const attribute of next.attributes)record.entry.setAttribute(attribute.name,attribute.value);
        }else{record={entry:next};directoryCards.set(slug,record);}
        if(expanded&&directoryProfile&&directoryProfile.region.parentElement!==record.entry)record.entry.append(directoryProfile.region);
        record.key=key;record.panels=panels;globalThis.KickRefinedPerf?.count('view.directoryCardWrites');
        if(list.firstElementChild!==record.entry)list.replaceChildren(record.entry);
        if(focused)record.entry.querySelector('.channel-expand')?.focus({preventScroll:true});else if(action)record.entry.querySelector(`.channel-action[data-kind="${action}"]`)?.focus({preventScroll:true});
      }else if(list.firstElementChild!==record.entry)list.replaceChildren(record.entry);
      record.entry.toggleAttribute('data-channel-pool',showPool);
      record.entry.toggleAttribute('data-channel-expanded',showPool&&expanded);
      if(showPool&&record.entry.firstElementChild!==channelPicker)record.entry.prepend(channelPicker);
      else if(!showPool)channelPicker.remove();
      if(pickerFocused&&channelPicker.isConnected&&!channelPicker.contains(shadow.activeElement)){
        [...channelPicker.children].find(button=>button.dataset.detailsChannel===pickerFocused)?.focus({preventScroll:true});
      }
      if(expanded)metadata.requestPanels(slug);
      channelVersion=channelPanel.version;
    }
    function reset(){
      expandedChannel=directoryChannel=directoryLayout=pickerKey='';clearDirectoryProfile();
      directoryCards.clear();channelPicker.remove();channelPicker.replaceChildren();$('#multi-channel-list').replaceChildren();
    }
    scope.listen(channelPicker,'click',event=>{
      const slug=event.target.closest('button')?.dataset.detailsChannel;
      if(slug&&slug!==directoryChannel)selectDirectoryChannel(slug,expandedChannel?(directoryProfile?.tab||'about'):null,{reveal:false});
    });
    scope.defer(reset);
    return {render:renderDirectory,select:selectDirectoryChannel,reset,
      focus(slug){expandedChannel='';directoryChannel=slug;clearDirectoryProfile();},
      get expanded(){return expandedChannel;},get version(){return channelVersion;}};
  }
  globalThis.KickRefinedMultiDirectory=Object.freeze({create});
})();
