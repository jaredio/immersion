/* Runs only in public tip pages. No form values, payment details or receipts are read. */
(() => {
  const page=KickRefinedSupportData.parse(location.href);if(!page)return;
  // Only popouts explicitly opened by Immersion opt into the skin. Normal provider tabs are untouched.
  if(window===window.parent){if(location.hash==='#immersion-checkout')document.documentElement.dataset.immersionTip=page.provider;return;}
  for(const target of ['https://kick.com','https://www.kick.com'])parent.postMessage({type:'immersion:tip-hello'},target);
  let connected=false,token='',origin='',observer,timer;
  const send=type=>parent.postMessage({type,token},origin);
  window.addEventListener('message',event=>{
    if(event.source!==parent||!['https://kick.com','https://www.kick.com'].includes(event.origin)||event.data?.type!=='immersion:tip-connect')return;
    const requested=KickRefinedSupportData.parse(event.data.href);
    if(!requested||requested.key!==page.key||typeof event.data.token!=='string'||event.data.token.length>80)return;
    token=event.data.token;origin=event.origin;
    if(connected){send(reported||'immersion:tip-connected');check();return;}connected=true;
    document.documentElement.dataset.immersionTip=page.provider;
    // A loaded provider UI need not contain a literal <form> (KickBot uses client-rendered controls).
    send('immersion:tip-connected');
    observer=new MutationObserver(()=>{if(!timer)timer=setTimeout(()=>{timer=0;check();},120);});
    observer.observe(document.body,{childList:true,subtree:true});check();
    // Escape remains available when focus is inside the cross-origin form.
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&![...document.querySelectorAll('[role="listbox"],[role="dialog"],[aria-modal="true"]')].some(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden')){event.preventDefault();send('immersion:tip-close');}});
  });
  let reported='';
  function check(){
    const form=page.provider==='powerchat'?document.querySelector('.donations-container form'):document.querySelector('form');
    const error=/^(?:Error [45]\d\d|Something went wrong|Page not found)/i.test(document.title)||document.querySelector('h1')?.textContent.trim()==='Error 500';
    const state=error?'immersion:tip-unavailable':form?'immersion:tip-ready':'';
    if(state&&state!==reported){reported=state;send(state);observer?.disconnect();}
  }
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(timer);},{once:true});
})();
