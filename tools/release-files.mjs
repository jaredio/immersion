import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../extension/',import.meta.url));
export async function releaseFiles(target){
  if(!['chrome','firefox'].includes(target))throw Error('Unknown browser target');
  const omitted=target==='chrome'?'support-background.js':'background.js';
  const entries=await readdir(source,{withFileTypes:true});
  return [...entries.filter(entry=>entry.isFile()&&entry.name!==omitted).map(entry=>entry.name),
    'manifest.json',...['16','48','128'].map(size=>`icons/${size}.png`),'vendor/hls.light.mjs','vendor/hls-LICENSE.txt'].sort();
}
