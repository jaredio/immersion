// Browser fixtures that inject document-idle scripts also need their document-start dependencies.
export function kickIdleScripts(manifest, entry='content.js'){
  const shared=manifest.content_scripts.find(group=>group.js?.includes('player-controls.js')&&group.matches.includes('https://kick.com/*'));
  const idle=manifest.content_scripts.find(group=>group.run_at==='document_idle'&&group.js?.includes(entry));
  return [...shared.js,...idle.js];
}
