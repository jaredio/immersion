/* Clip view and media lease share a pane lifetime. Callbacks stop before release. */
(() => {
  function create({item,scope,resize,decorate,isAudible,onAudio,onFocus,onRemove,onEnded,onPosition}){
      const key=`clip:${item.id}`,card=document.createElement('section');card.className='multi-tile multi-clip-tile';card.dataset.clip=item.id;card.dataset.kind=item.kind==='vod'?'vod':'clip';
      const header=document.createElement('div');header.className='multi-tile-header';const identity=document.createElement('div');identity.className='multi-tile-identity';const words=document.createElement('div'),title=document.createElement('a'),credit=document.createElement('span');title.href=item.href;title.target='_blank';title.rel='noopener noreferrer';title.textContent=item.title||'Kick clip';words.append(title,credit);identity.append(words);
      const badge=document.createElement('span');badge.className='multi-clip-badge';const kind=item.kind==='vod'?'VOD':'CLIP';badge.textContent=kind;
      const player=document.createElement('div');player.className='multi-clip-player';const tile={slug:key,card,player,item,scope};scope.defer(()=>{resize.unobserve(player);card.remove();item.release();});
      const control=(label,symbol,action)=>{const button=document.createElement('button');button.setAttribute('aria-label',label);decorate(button,symbol,label,true);button.title=({sound:'Choose video audio',focus:'Feature video',close:'Remove video',pop:'Pop out video player'})[symbol]||label;scope.listen(button,'click',action);return button;};
      tile.listen=control(`Listen to ${kind.toLowerCase()} ${item.id}`,'sound',()=>onAudio(!isAudible()));
      const toggleFocus=()=>onFocus();
      tile.focus=control(`Focus ${kind.toLowerCase()} ${item.id}`,'focus',toggleFocus);
      scope.listen(header,'dblclick',event=>{if(event.target.closest('a,button,input'))return;event.preventDefault();toggleFocus();});
      header.append(identity,badge,tile.listen,control(`Pop out ${kind.toLowerCase()} ${item.id}`,'pop',()=>item.popout()),tile.focus,control(`Remove ${kind.toLowerCase()} ${item.id}`,'close',onRemove));card.append(header,player);
      tile.mount=()=>{resize.observe(player);item.mount(player,{focus:scope.guard(toggleFocus),remove:scope.guard(onRemove),audio:scope.guard(onAudio),ended:scope.guard(onEnded),info:scope.guard(data=>{title.textContent=data.title||item.title||'Kick clip';credit.textContent=data.creator?`Clipped by ${data.creator}`:data.credit||'';badge.textContent=data.duration?`${kind} · ${kind==='VOD'?KickRefinedSearch.duration(data.duration):Math.round(data.duration)+'s'}`:kind;onPosition();})});};
      return tile;
  }
  globalThis.KickRefinedMultiClipTile=Object.freeze({create});
})();
