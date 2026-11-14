(() => {
  const { api, normalize } = KickRefined;
  let settings, update;
  const store=KickRefinedSettings.create({delay:0,onUpdate:value=>{settings=value;update?.(value);},onError:()=>{document.querySelector('#notice').textContent='Could not save settings. Please try again.';},onSaved:()=>{document.querySelector('#notice').textContent='';}});
  function save(patch){store.patch(patch);}
  api.storage.local.get('settings').then(result => {
    store.accept(result.settings);
    update = KickRefinedUI.settingsForm(document.querySelector('#settings'), settings, save);
    document.querySelector('#reset').addEventListener('click', () => save(normalize()));
  }).catch(() => { document.querySelector('#notice').textContent = 'Settings unavailable. Try reloading the extension.'; });
  window.addEventListener('pagehide',()=>store.destroy());
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) store.accept(changes.settings.newValue);
  });
})();
