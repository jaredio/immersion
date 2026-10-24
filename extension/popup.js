(() => {
  const { api, normalize } = KickRefined;
  let settings, update;
  // Serialize patches so a slider and a toggle cannot overwrite each other.
  let writes = Promise.resolve();
  function save(patch) {
    writes = writes.then(async () => {
      const current = normalize((await api.storage.local.get('settings')).settings);
      settings = normalize({ ...current, ...patch });
      await api.storage.local.set({ settings });
    }).catch(() => { document.querySelector('#notice').textContent = 'Could not save settings. Reopen the extension to retry.'; });
  }
  api.storage.local.get('settings').then(result => {
    settings = normalize(result.settings);
    update = KickRefinedUI.settingsForm(document.querySelector('#settings'), settings, save);
    document.querySelector('#reset').addEventListener('click', () => save(normalize()));
  }).catch(() => { document.querySelector('#notice').textContent = 'Settings unavailable. Try reloading the extension.'; });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) update?.(normalize(changes.settings.newValue));
  });
})();
