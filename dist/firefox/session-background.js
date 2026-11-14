/* One writer prevents different Kick tabs from replacing each other's sessions. */
(() => {
  const api=KickRefined.api,repository=KickRefinedSessionData.createRepository(api.storage.local);
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='immersion:session-mutation')return;
    let origin;try{origin=new URL(sender.url).origin;}catch{return;}
    if(sender.id!==api.runtime.id||!sender.tab||!['https://kick.com','https://www.kick.com'].includes(origin))return;
    repository.mutate(message.operation||{}).then(sessions=>reply({ok:true,sessions}),()=>reply({ok:false}));return true;
  });
})();
