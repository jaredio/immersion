import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = {
  manifest_version: 3,
  name: 'Immersion',
  version: '0.9.0',
  description: 'A sleek dark experience for Kick, with inline multistream, adjustable layouts, quick chat tabs and leaner chat scrolling.',
  permissions: ['storage'],
  icons: { 16: 'icons/16.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  action: { default_title: 'Immersion', default_popup: 'popup.html', default_icon: { 16: 'icons/16.png', 48: 'icons/48.png' } },
  content_scripts: [
    { matches: ['https://kick.com/*', 'https://www.kick.com/*'], js: ['scroll.js'], run_at: 'document_start', world: 'MAIN', all_frames: true },
    { matches: ['https://kick.com/*', 'https://www.kick.com/*'], css: ['theme.css', 'polish.css'], js: ['shared.js', 'ui.js', 'multiview.js', 'content.js'], run_at: 'document_idle' },
    { matches: ['https://kick.com/popout/*/chat', 'https://www.kick.com/popout/*/chat'], css: ['theme.css', 'polish.css'], js: ['shared.js', 'chat-frame.js'], run_at: 'document_idle', all_frames: true },
    { matches: ['https://player.kick.com/*'], js: ['player-frame.js'], run_at: 'document_start', all_frames: true }
  ],
  web_accessible_resources: [{ resources: ['ui.css'], matches: ['https://kick.com/*', 'https://www.kick.com/*'] }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" }
};
for (const target of ['chrome', 'firefox']) {
  const out = path.join(root, 'dist', target);
  await mkdir(path.join(out, 'icons'), { recursive: true });
  for (const entry of await readdir(path.join(root, 'extension'), { withFileTypes: true })) {
    if (entry.isFile()) await copyFile(path.join(root, 'extension', entry.name), path.join(out, entry.name));
  }
  for (const size of [16, 48, 128]) await copyFile(path.join(root, 'extension', 'icons', `${size}.png`), path.join(out, 'icons', `${size}.png`));
  const manifest = structuredClone(base);
  if (target === 'firefox') manifest.browser_specific_settings = { gecko: {
    id: 'kick-refined@local.extension', strict_min_version: '142.0',
    data_collection_permissions: { required: ['none'] }
  } };
  else manifest.minimum_chrome_version = '120';
  await writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Built dist/${target}`);
}
// Keep the build dependency-free; Python's standard library creates distributable ZIPs.
const { spawnSync } = await import('node:child_process');
const zip = spawnSync('python', [path.join(root, 'tools', 'package.py')], { cwd: root, encoding: 'utf8' });
if (zip.status !== 0) throw new Error(zip.stderr || 'ZIP packaging failed');
console.log(zip.stdout.trim());
