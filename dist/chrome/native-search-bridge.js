/* MAIN world: keep React's native search UI from competing with our marked input.
 * No extension APIs, requests or page internals. Disabled inputs behave normally. */
(() => {
  if(window!==window.top)return;
  for(const type of ['pointerdown','click','focusin','input','keydown','keypress','keyup','submit'])window.addEventListener(type,event=>{
    const target=event.composedPath()[0];
    const input=type==='submit'?target?.querySelector?.('input[data-kr-native-search]'):target;
    if(!(input instanceof HTMLInputElement)||!input.hasAttribute('data-kr-native-search')||document.documentElement.dataset.krEnabled!=='true')return;
    event.stopImmediatePropagation();
    if(type==='submit'){event.preventDefault();return;}
    if(type==='keypress'||type==='keyup'||type==='click')return;
    const local=type==='keydown'?new KeyboardEvent('kick-refined-native-search-keydown',{key:event.key,code:event.code,ctrlKey:event.ctrlKey,altKey:event.altKey,shiftKey:event.shiftKey,metaKey:event.metaKey,isComposing:event.isComposing,bubbles:true,cancelable:true}):new CustomEvent(`kick-refined-native-search-${type==='pointerdown'?'focusin':type}`,{bubbles:true});
    if(!input.dispatchEvent(local))event.preventDefault();
  },{capture:true});
})();
