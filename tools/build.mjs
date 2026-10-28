import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = {
  manifest_version: 3,
  name: 'Immersion',
  version: '0.10.0',
  description: 'A sleek dark experience for Kick, with inline multistream, adjustable layouts, quick chat tabs and leaner chat scrolling.',
  permissions: ['storage'],
  host_permissions: ['https://api.fxtwitter.com/*','https://www.tiktok.com/*','https://vt.tiktok.com/*','https://vm.tiktok.com/*','https://www.youtube.com/oembed*'],
  icons: { 16: 'icons/16.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  action: { default_title: 'Immersion', default_popup: 'popup.html', default_icon: { 16: 'icons/16.png', 48: 'icons/48.png' } },
  content_scripts: [
    { matches: ['https://kick.com/*', 'https://www.kick.com/*'], js: ['scroll.js'], run_at: 'document_start', world: 'MAIN', all_frames: true },
    { matches: ['https://kick.com/*', 'https://www.kick.com/*'], css: ['theme.css', 'polish.css'], js: ['shared.js', 'ui.js', 'profile.js', 'support-data.js', 'support.js', 'channel-panel.js', 'multiview.js', 'chat-clips.js', 'clip-bridge.js', 'x-post-data.js', 'x-posts.js', 'media-data.js', 'media-embeds.js', 'reply-preview.js', 'notices.js', 'checkouts.js', 'content.js'], run_at: 'document_idle' },
    { matches: ['https://powerchat.live/*', 'https://www.powerchat.live/*','https://kickbot.com/tips/*','https://www.kickbot.com/tips/*','https://streamelements.com/*/tip*','https://www.streamelements.com/*/tip*'], css:['support-form.css'], js: ['support-data.js', 'support-frame.js'], run_at: 'document_idle', all_frames: true },
    { matches: ['https://kick.com/popout/*/chat', 'https://www.kick.com/popout/*/chat'], css: ['theme.css', 'polish.css'], js: ['shared.js', 'chat-clips.js', 'clip-bridge.js', 'x-post-data.js', 'x-posts.js', 'media-data.js', 'media-embeds.js', 'reply-preview.js', 'chat-frame.js'], run_at: 'document_idle', all_frames: true },
    { matches: ['https://player.kick.com/*'], js: ['player-frame.js'], run_at: 'document_start', all_frames: true }
  ],
  web_accessible_resources: [{ resources: ['ui.css', 'vendor/hls.light.mjs'], matches: ['https://kick.com/*', 'https://www.kick.com/*'] }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" }
};
for (const target of ['chrome', 'firefox']) {
  const out = path.join(root, 'dist', target);
  await mkdir(path.join(out, 'icons'), { recursive: true });
  await mkdir(path.join(out, 'vendor'), { recursive: true });
  await copyFile(path.join(root,'node_modules/hls.js/dist/hls.light.mjs'),path.join(out,'vendor/hls.light.mjs'));
  await copyFile(path.join(root,'node_modules/hls.js/LICENSE'),path.join(out,'vendor/hls-LICENSE.txt'));
  for (const entry of await readdir(path.join(root, 'extension'), { withFileTypes: true })) {
    if (entry.isFile()) await copyFile(path.join(root, 'extension', entry.name), path.join(out, entry.name));
  }
  for (const size of [16, 48, 128]) await copyFile(path.join(root, 'extension', 'icons', `${size}.png`), path.join(out, 'icons', `${size}.png`));
  const manifest = structuredClone(base);
  manifest.background=target==='firefox'?{scripts:['x-post-data.js','x-background.js','media-data.js','media-background.js']}:{service_worker:'x-background.js'};
  if (target === 'firefox') {
    // Firefox MV3 explicitly forbids relaxing framing headers through webRequest.
    // Its supported MV2 build permits the one-response, per-checkout compatibility hook.
    manifest.manifest_version=2;
    manifest.permissions.push('webRequest','webRequestBlocking',...manifest.host_permissions,'https://kick.com/*','https://www.kick.com/*','https://kickbot.com/*','https://www.kickbot.com/*','https://streamelements.com/*','https://www.streamelements.com/*');
    delete manifest.host_permissions;
    manifest.background.scripts.push('support-data.js','support-background.js');
    manifest.background.persistent=false;
    manifest.browser_action=manifest.action;delete manifest.action;
    manifest.content_security_policy=manifest.content_security_policy.extension_pages;
    manifest.web_accessible_resources=manifest.web_accessible_resources.flatMap(item=>item.resources);
    manifest.browser_specific_settings = { gecko: {
    id: 'kick-refined@local.extension', strict_min_version: '142.0',
    data_collection_permissions: { required: ['none'] }
    } };
  }
  else manifest.minimum_chrome_version = '120';
  await writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Built dist/${target}`);
}
// Python's standard library creates the ZIPs without extra packaging dependencies.
const { spawnSync } = await import('node:child_process');
const zip = spawnSync('python', [path.join(root, 'tools', 'package.py')], { cwd: root, encoding: 'utf8' });
if (zip.status !== 0) throw new Error(zip.stderr || 'ZIP packaging failed');
console.log(zip.stdout.trim());
