import assert from 'node:assert/strict';
import {writeFile,readFile,access,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {releaseFiles} from './release-files.mjs';
const token=`audit-unused-${Date.now()}`,owned=[];
try{
  for(const browser of ['chrome','firefox'])for(const relative of [`${token}.js`,`vendor/${token}.txt`]){
    const file=`dist/${browser}/${relative}`;await writeFile(file,'unused release fixture',{flag:'wx'});owned.push(file);
  }
  execFileSync(process.execPath,['tools/build.mjs'],{stdio:'pipe',windowsHide:true});
  const pkg=JSON.parse(await readFile('package.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));
  assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
  for(const browser of ['chrome','firefox'])assert.equal(JSON.parse(await readFile(`dist/${browser}/manifest.json`,'utf8')).version,pkg.version,'manifest version comes from package.json');
  for(const browser of ['chrome','firefox'])await assert.rejects(access(`dist/${browser}/${token}.js`),'build removes obsolete top-level assets');
  const expected=Object.fromEntries(await Promise.all(['chrome','firefox'].map(async browser=>[browser,await releaseFiles(browser)])));
  const verify=`import json,sys
from zipfile import ZipFile
for browser, files in json.load(sys.stdin).items():
    with ZipFile('dist/immersion-'+browser+'.zip') as archive:
        actual, expected = set(archive.namelist()), set(files)
        assert actual == expected, (browser, actual ^ expected)
`;
  execFileSync('python',['-c',verify],{input:JSON.stringify(expected),stdio:['pipe','pipe','pipe'],windowsHide:true});
  assert.equal(expected.chrome.includes('support-background.js'),false);
  assert.equal(expected.firefox.includes('background.js'),false);
  console.log('PASS release inventories: obsolete assets pruned, nested leftovers excluded, exact ZIP contents verified');
}finally{for(const file of owned)await rm(file,{force:true});}
