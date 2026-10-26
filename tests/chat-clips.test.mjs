import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL});
vm.runInContext(await readFile(new URL('../extension/chat-clips.js',import.meta.url),'utf8'),context);
const {parseClip,metadata,mediaURL}=context.KickRefinedClips;
const id='clip_01M5VG3B8WEFY068DP0GCHKSGW';
test('chat clip links accept only exact HTTPS Kick origins and supported clip routes',()=>{
  const clip=parseClip(`https://kick.com/sweatergxd/clips/${id}?ref=test`);
  assert.equal(clip.id,id);assert.equal(clip.href,`https://kick.com/sweatergxd/clips/${id}`);
  assert.equal(parseClip(`https://www.kick.com/sweatergxd?clip=${id}`).id,id);
  for(const link of [`https://kick.com.evil.test/a/clips/${id}`,`http://kick.com/a/clips/${id}`,`https://evil.test/a/clips/${id}`,`https://user:pass@kick.com/a/clips/${id}`,`https://kick.com:444/a/clips/${id}`,`https://kick.com/a/clips/${id}/other`,'javascript:alert(1)','https://kick.com/a/clips/invalid'])assert.equal(parseClip(link),null,link);
});
test('clip metadata rejects mismatched IDs and media from untrusted hosts',()=>{
  const clip=parseClip(`https://kick.com/a/clips/${id}`),src=`https://clips.kick.com/clips/6d/${id}/playlist.m3u8`;
  assert.equal(metadata({clip:{id,video_url:src,title:'<b>title</b>'}},clip).title,'<b>title</b>');
  assert.equal(metadata({clip:{id,clip_url:src}},clip).src,src);
  assert.equal(metadata({clip:{id,clip_url:src,creator:{username:'OriginalClipper'}}},clip).creator,'OriginalClipper');
  assert.equal(metadata({clip:{id,clip_url:src,creator:{slug:'clipper'}}},clip).creator,'clipper');
  assert.equal(metadata({clip:{id,clip_url:src,creator:{username:{name:'fake'}}}},clip).creator,'');
  assert.throws(()=>metadata({clip:{id:'wrong',video_url:src}},clip));
  assert.throws(()=>metadata({clip:{id,video_url:'https://evil.test/playlist.m3u8'}},clip));
  assert.equal(mediaURL(`https://clips.kick.com.evil.test/${id}/thumbnail.webp`,id),'');
  assert.equal(mediaURL('javascript:alert(1)',id),'');
  assert.equal(mediaURL('https://clips.kick.com/other/thumbnail.webp',id),'');
});
