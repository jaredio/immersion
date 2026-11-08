/* Workspace markup and icons; no player or session ownership. */
(() => {
  function create({onKeydown,onPosition}) {
    const {api}=KickRefined;
    const iconPaths = {
      mix:'M4 7h16M7 4v6M4 17h16M16 14v6', manage:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 17h7m-3.5-3.5v7',
      mute:'m11 5-5 4H3v6h3l5 4zM16 9l5 6m0-6-5 6', sound:'m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
      soundLow:'m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8',
      chevron:'m6 9 6 6 6-6', viewers:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
      settings:'M4 7h16M7 4v6M4 17h16M16 14v6', fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', single:'M4 4h16v16H4zM9 4v16',
      chat:'M21 4H3v13h5l4 4 4-4h5z', add:'M12 5v14M5 12h14', save:'M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8',
      trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', link:'m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
      play:'m8 5 11 7-11 7z', pause:'M8 5v14M16 5v14', focus:'M3 4h18v16H3zM15 4v16', grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
      left:'m10 6-6 6 6 6M4 12h16', right:'m14 6 6 6-6 6M4 12h16', close:'m6 6 12 12M18 6 6 18', pop:'M8 3h13v13H8zM3 8v13h13v-5M8 7h13'
    };
    const icon = name => `<svg class="multi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]}"/></svg>`;
    function decorate(button, symbol, label, iconOnly=false) {
      button.innerHTML=icon(symbol);
      if(iconOnly){if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',label);button.title=label;}
      if(!iconOnly){const text=document.createElement('span');text.textContent=label;button.append(text);}
      button.classList.toggle('multi-icon-only',iconOnly);
    }
    const host = document.createElement('div'); host.id = 'kr-multi-root';
    const shadow = host.attachShadow({ mode: 'open' });
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = api.runtime.getURL('ui.css'); shadow.append(css);
    const panel = document.createElement('section'); panel.className = 'multiview inline-multi'; panel.setAttribute('aria-label','Multiview workspace');
    panel.innerHTML = `
      <div class="multi-header"><button id="multi-mix" aria-pressed="false" title="Allow sound from more than one stream">Mix audio</button><button id="multi-manage" aria-expanded="false">Manage</button><label class="multi-layout-label">Layout <select id="multi-layout" aria-label="Multiview layout"><option value="grid">Grid</option><option value="focus">Focus</option><option value="columns">Columns</option></select></label><button id="multi-mute">Mute all</button><button id="multi-fullscreen" aria-label="Fullscreen multiview">⛶</button><button class="multi-exit" aria-label="Close multiview">Single stream</button></div>
      <div class="multi-chat-bar"><label for="multi-chat-channel">Chat</label><select id="multi-chat-channel" aria-label="Chat channel"></select><a id="multi-chat-external" target="_blank" rel="noopener noreferrer" aria-label="Open chat in a new tab">↗</a><button id="multi-chat-toggle" aria-pressed="true">Hide chat</button></div>
      <div class="multi-options" hidden><div class="multi-player-options"><label for="multi-player-mode">Player mode</label><select id="multi-player-mode" aria-label="Player mode"><option value="embed">Standard embeds</option><option value="full">Full Kick players (beta)</option></select><span>Full players use more memory. Your current channel keeps its existing player.</span></div><div class="multi-tools"><form id="multi-add-form"><input id="multi-add" aria-label="Add channel to multiview" list="multi-suggestions" placeholder="Channel name or Kick URL" autocomplete="off" maxlength="120"><datalist id="multi-suggestions"></datalist><button type="submit">Add stream</button></form></div><div class="multi-footer"><div class="multi-save"><input id="multi-name" aria-label="Layout name" placeholder="Name this session" maxlength="48"><button id="multi-save">Save</button><select id="multi-sessions" aria-label="Saved multiview sessions"><option value="">Saved sessions…</option></select><button id="multi-delete" disabled>Delete saved</button></div><button id="multi-share">Copy link</button></div></div>
      <div id="multi-notice" class="multi-notice" role="status"></div><div class="multi-body"><div id="multi-grid" class="multi-grid"></div><aside class="multi-chat"><div class="multi-chat-mount"></div></aside></div>`;
    shadow.append(panel);
    const channelStyle=document.createElement('style');channelStyle.textContent=KickRefinedChannelPanel.styles;shadow.append(channelStyle);
    const directory=document.createElement('section');directory.className='multi-directory';directory.setAttribute('aria-label','Open stream channels');directory.innerHTML='<div id="multi-channel-list"></div>';panel.append(directory);
    for(const [selector,symbol] of [['#multi-mix','mix'],['#multi-manage','manage'],['#multi-mute','mute'],['#multi-fullscreen','fullscreen'],['.multi-exit','close'],['#multi-add-form button','add'],['#multi-save','save'],['#multi-delete','trash'],['#multi-share','link']]) {
      const button=panel.querySelector(selector),label=button.getAttribute('aria-label')||button.textContent;
      decorate(button,symbol,label,true);
    }
    const workspaceClose=panel.querySelector('.multi-exit');workspaceClose.classList.add('multi-workspace-close');workspaceClose.title='Close workspace';panel.prepend(workspaceClose);
    const layoutLabel=panel.querySelector('.multi-layout-label');
    layoutLabel.firstChild.remove();layoutLabel.querySelector('select').title='Change multistream layout';
    const chatTabs=document.createElement('div');chatTabs.id='multi-chat-tabs';chatTabs.setAttribute('aria-label','Switch stream chat');
    panel.querySelector('#multi-chat-toggle').before(chatTabs);
    const toolbarToggle=document.createElement('button');toolbarToggle.id='multi-toolbar-toggle';toolbarToggle.setAttribute('aria-controls','multi-settings-bar multi-settings-options');
    panel.querySelector('.multi-header').id='multi-settings-bar';panel.querySelector('.multi-options').id='multi-settings-options';
    const settingsToggleRow=document.createElement('div');settingsToggleRow.className='multi-settings-toggle';settingsToggleRow.append(toolbarToggle);panel.querySelector('.multi-options').after(settingsToggleRow);
    const headerBar=panel.querySelector('.multi-header');headerBar.prepend(layoutLabel);for(const node of [panel.querySelector('#multi-chat-external'),panel.querySelector('#multi-chat-toggle'),panel.querySelector('#multi-chat-channel')])headerBar.append(node);
    const stage=document.createElement('div');stage.className='multi-stage';
    const gridElement=panel.querySelector('#multi-grid');gridElement.before(stage);stage.append(gridElement);
    gridElement.addEventListener('scroll',onPosition,{passive:true});
    const divider=document.createElement('div');divider.className='multi-divider';divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Resize featured stream');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-valuemin','45');divider.setAttribute('aria-valuemax','80');divider.title='Drag to resize · arrow keys to adjust · double-click to reset';stage.append(divider);
    const sizing=document.createElement('label');sizing.className='multi-sizing';sizing.innerHTML='Featured size <input type="range" min="45" max="80" value="74" aria-label="Featured stream size"><output>74%</output>';
    panel.querySelector('.multi-options').append(sizing);
    for(const type of ['keydown','kick-refined-keydown'])shadow.addEventListener(type,event=>{onKeydown?.(event);event.stopPropagation();});
    for(const type of ['keyup','keypress'])shadow.addEventListener(type,event=>event.stopPropagation());
    const $ = s => panel.querySelector(s);
    return {host,shadow,panel,directory,chatTabs,toolbarToggle,stage,gridElement,divider,sizing,$,decorate};
  }
  globalThis.KickRefinedMultiView=Object.freeze({create});
})();
