/* Browser-owned, Kick-scoped telemetry rules. No request bodies or browsing log. */
(() => {
  const api=typeof browser!=='undefined'?browser:chrome;
  if(!api.declarativeNetRequest)return;
  let writes=Promise.resolve();
  function sync(){
    // Read inside the queue so a late startup read cannot override a new toggle.
    writes=writes.then(async()=>{
      const {settings}=await api.storage.local.get('settings');
      const enabled=settings?.enabled!==false&&settings?.blockTelemetry!==false;
      await api.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds:enabled?['kick-telemetry']:[],
        disableRulesetIds:enabled?[]:['kick-telemetry']
      });
    }).catch(error=>console.warn('Immersion could not update telemetry protection:',error?.message||'unavailable'));
  }
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings)sync();});
  api.runtime.onInstalled.addListener(sync);
  api.runtime.onStartup.addListener(sync);
  sync();
})();
