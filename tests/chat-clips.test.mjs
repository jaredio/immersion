import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL});
vm.runInContext(await readFile(new URL('../extension/chat-clips.js',import.meta.url),'utf8'),context);
const {parseClip,parseVOD,metadata,mediaURL,vodMetadata}=context.KickRefinedClips;
const id='clip_01M5VG3B8WEFY068DP0GCHKSGW';

test('recordings accept only canonical HTTPS Kick watch routes',()=>{
  const id='01a17936-c150-7263-8800-3dcf734e1a83',href=`https://kick.com/xqc/videos/${id}`;
  assert.equal(parseVOD(href+'?ref=search').href,href);assert.equal(parseVOD(href).kind,'vod');
  for(const value of [href.replace('kick.com','kick.com.evil.test'),href.replace('https:','http:'),href+'/other',href.replace(id,'not-a-video'),href.replace('kick.com','user@kick.com'),href.replace('kick.com','kick.com:444')])assert.equal(parseVOD(value),null,value);
  assert.equal(parseClip(href),null,'recordings do not become automatic chat clip embeds');
});

test('recording metadata uses the video API source and verifies recording ownership and availability',()=>{
  const uuid='7a56d0e3-f920-4aac-8dbc-1869294136b5',vod=parseVOD(`https://kick.com/nickwhite/videos/${uuid}`);
  const src='https://stream.kick.com/archive/media/hls/master.m3u8';
  const data={uuid,source:src,status:'public',is_private:false,is_pruned:false,deleted_at:null,livestream:{session_title:'Sunday Livestream',duration:9159000,channel:{slug:'nickwhite',user:{username:'NickWhite',profilepic:'https://files.kick.com/avatar.webp'}}}};
  const result=vodMetadata(data,vod);assert.equal(result.src,src);assert.equal(result.title,'Sunday Livestream');assert.equal(result.duration,9159);assert.equal(result.channelName,'NickWhite');assert.equal(result.channelImage,'https://files.kick.com/avatar.webp');
  for(const patch of [{uuid:'other'},{is_private:true},{is_pruned:true},{deleted_at:'2026-11-15'},{status:'private'},{source:'https://evil.test/archive/media/hls/master.m3u8'},{source:'https://stream.kick.com.evil.test/archive/media/hls/master.m3u8'},{source:'http://stream.kick.com/archive/media/hls/master.m3u8'},{source:'https://user@stream.kick.com/archive/media/hls/master.m3u8'},{source:null},{livestream:{...data.livestream,channel:{slug:'another'}}}])assert.throws(()=>vodMetadata({...data,...patch},vod));
  assert.throws(()=>vodMetadata('<title>Video Not Found</title>',vod),'HTML pages are not playback metadata');
});
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

test('clip and recording metadata retain dates and view counts, including zero views',()=>{
  const clip=parseClip(`https://kick.com/a/clips/${id}`),created_at='2026-11-14T12:00:00Z';
  const details=metadata({clip:{id,video_url:`https://clips.kick.com/${id}/playlist.m3u8`,views:0,created_at}},clip);
  assert.equal(details.views,0);assert.equal(details.created,Date.parse(created_at));
  const uuid='7a56d0e3-f920-4aac-8dbc-1869294136b5',vod=parseVOD(`https://kick.com/a/videos/${uuid}`);
  const data={uuid,source:'https://stream.kick.com/archive/media/hls/master.m3u8',created_at,views:90,livestream:{views:1234,channel:{slug:'a'}}};
  assert.equal(vodMetadata(data,vod).views,1234);assert.equal(vodMetadata(data,vod).created,Date.parse(created_at));
  assert.equal(vodMetadata({...data,livestream:{...data.livestream,views:0}},vod).views,0);
  assert.equal(vodMetadata({...data,livestream:{channel:{slug:'a'}}},vod).views,90);
});

test('missing or malformed media details stay unknown instead of becoming fabricated counts or dates',()=>{
  const {mediaDetails}=context.KickRefinedClips;
  for(const value of [null,undefined,'',false,-1,NaN,Infinity,{},'1.2K'])assert.equal(mediaDetails({views:value}).views,null);
  for(const value of [null,undefined,'',false,-1,NaN,Infinity,{},'not a date',8640000000000001])assert.equal(mediaDetails({created:value}).created,0);
  assert.equal(mediaDetails({view_count:'1234'}).views,1234);
  assert.equal(mediaDetails({creator:{username:'fake'}}).creator,'');
});
