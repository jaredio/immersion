import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context=vm.createContext({URL,location:{href:'https://kick.com/creator/clips'}});
for(const file of ['chat-clips','clip-preview'])vm.runInContext(await readFile(`extension/${file}.js`,'utf8'),context);

test('creating, refreshing and destroying an unused preview touches no document or playback resources',()=>{
  const preview=context.KickRefinedClipPreview.create();preview.refresh();preview.close();preview.destroy();preview.destroy();
});

for(const href of ['https://evil.test/creator/clips/clip_00000000000000000000000001','javascript:alert(1)','https://kick.com/creator/videos/123','https://user:pass@kick.com/creator/clips/clip_00000000000000000000000001']){
  test(`invalid clip links cannot create preview resources: ${href}`,()=>{
    const preview=context.KickRefinedClipPreview.create();assert.equal(preview.open({href}),false);preview.destroy();
  });
}

test('disabled and disposed previews reject even valid clip URLs without creating players',()=>{
  const preview=context.KickRefinedClipPreview.create(),row={href:'https://kick.com/creator/clips/clip_00000000000000000000000001'};
  preview.setEnabled(false);assert.equal(preview.open(row),false);preview.setEnabled(true);preview.destroy();assert.equal(preview.open(row),false);
});
