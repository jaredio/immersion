/* Patch-level settings ownership and optimistic edits shared by popup and tabs. */
(() => {
  const normalize=KickRefined.normalize;
  function patchOnly(input){const patch={};for(const key of Object.keys(KickRefined.defaults))if(input&&Object.hasOwn(input,key))patch[key]=input[key];return patch;}
  function createRepository(storage){
    let queue=Promise.resolve();
    return {patch(input){const patch=patchOnly(input);const job=queue.then(async()=>{const current=normalize((await storage.get('settings')).settings),settings=normalize({...current,...patch});await storage.set({settings});return settings;});queue=job.catch(()=>{});return job;}};
  }
  function create({api=KickRefined.api,onUpdate=()=>{},onError=()=>{},onSaved=()=>{},delay=100}={}){
    const repository=!api.runtime.sendMessage?createRepository(api.storage.local):null;
    let base=normalize(),pending={},timer=0,writes=Promise.resolve(),version=0,closed=false;const queued=[];
    const emit=()=>{if(!closed)onUpdate(normalize(Object.assign({},base,...queued.map(item=>item.patch),pending)));};
    function flush(){
      clearTimeout(timer);timer=0;if(!Object.keys(pending).length)return writes;
      const item={patch:pending};pending={};queued.push(item);
      let failed=false;
      writes=writes.then(async()=>{
        const before=version;
        const result=repository?{ok:true,settings:await repository.patch(item.patch)}:await api.runtime.sendMessage({type:'immersion:settings-patch',patch:item.patch});
        if(!result?.ok)throw Error('Could not save settings');
        if(before===version)base=normalize(result.settings);
      }).catch(error=>{failed=true;onError(error);}).finally(()=>{queued.splice(queued.indexOf(item),1);emit();if(!closed&&!failed&&!queued.length&&!Object.keys(pending).length)onSaved();});return writes;
    }
    return {accept(value){if(closed)return;base=normalize(value);version++;emit();},patch(value){if(closed)return;Object.assign(pending,patchOnly(value));emit();clearTimeout(timer);timer=setTimeout(flush,delay);},flush,destroy(){const result=flush();closed=true;return result;}};
  }
  globalThis.KickRefinedSettings=Object.freeze({createRepository,create});
})();
