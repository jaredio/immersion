(() => {
  function settingsForm(container, value, change) {
    container.innerHTML = `
      <p class="eyebrow">Experience</p>
      <div class="row"><div><label for="enabled">Enable Immersion</label><p class="help">The full dark redesign.</p></div><input id="enabled" type="checkbox"></div>
      <div class="row"><div><label for="performance">Lean chat & motion</label><p class="help">Instant chat scroll. Fewer visual effects.</p></div><input id="performance" type="checkbox"></div>
      <div class="row"><div><label for="textOnly">Hide chat images</label><p class="help">Hide emotes, badges & media. Keep spacing.</p></div><input id="textOnly" type="checkbox"></div>
      <div class="row"><div><label for="chatClips">Playable chat clips</label><p class="help">Click to play Kick clips in chat or a floating player.</p></div><input id="chatClips" type="checkbox"></div>
      <div class="row"><div><label for="xEmbeds">X posts & profiles</label><p class="help">Video playback, profile cards & public stats. Uses FxEmbed.</p></div><input id="xEmbeds" type="checkbox"></div>
      <div class="row"><div><label for="mediaEmbeds">TikTok & YouTube embeds</label><p class="help">Videos, Shorts & TikTok profiles. Players load when you press Play.</p></div><input id="mediaEmbeds" type="checkbox"></div>
      <p class="eyebrow">Workspace</p>
      <div class="row"><div><label for="compact">Compact sidebar</label><p class="help">More channels, less space.</p></div><input id="compact" type="checkbox"></div>
      <div class="row"><label for="hideRecommended">Hide recommendations</label><input id="hideRecommended" type="checkbox"></div>
      <div class="row"><label for="accent">Accent</label><select id="accent"><option value="mint">Mint</option><option value="violet">Violet</option><option value="blue">Ice blue</option><option value="neutral">Neutral</option></select></div>
      <div class="range"><label for="chatWidth">Chat width <output for="chatWidth"></output></label><input id="chatWidth" type="range" min="280" max="440" step="10"></div>
      <div class="range"><label for="fontSize">Chat text <output for="fontSize"></output></label><input id="fontSize" type="range" min="12" max="18" step="1"></div>`;
    function update(settings) {
      if (!container.getRootNode().host) {
        container.ownerDocument.documentElement.style.setProperty('--accent', { mint: '#8cecc0', violet: '#b8a2ff', blue: '#8bbcff', neutral: '#e4e4e7' }[settings.accent]);
      }
      for (const input of container.querySelectorAll('input,select')) {
        if (input.type === 'checkbox') input.checked = settings[input.id];
        else input.value = settings[input.id];
      }
      container.querySelector('[for="chatWidth"] output').value = `${settings.chatWidth}px`;
      container.querySelector('[for="fontSize"] output').value = `${settings.fontSize}px`;
    }
    container.addEventListener('input', event => {
      const input = event.target;
      if (!input.id) return;
      const next = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      const output = container.querySelector(`output[for="${input.id}"]`);
      if (output) output.value = `${next}px`;
      change({ [input.id]: next });
    });
    update(value);
    return update;
  }
  globalThis.KickRefinedUI = { settingsForm };
})();
