/* Single settings writer: patches from separate tabs never replace other keys. */
(() => {
  const api=KickRefined.api,repository=KickRefinedSettings.createRepository(api.storage.local);
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='immersion:settings-patch'||sender.id!==api.runtime.id)return;
    let allowed=false;try{const url=new URL(sender.url);allowed=!!sender.tab&&['https://kick.com','https://www.kick.com'].includes(url.origin)||url.href===api.runtime.getURL('popup.html');}catch{}
    if(!allowed)return;
    repository.patch(message.patch).then(settings=>reply({ok:true,settings}),()=>reply({ok:false}));return true;
  });
})();
