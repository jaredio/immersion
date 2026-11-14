import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/search.js',import.meta.url),'utf8');
const shared=await readFile(new URL('../extension/shared.js',import.meta.url),'utf8');
function setup(extra={}){const context=vm.createContext({URL,URLSearchParams,AbortController,DOMException,TextDecoder,setTimeout,clearTimeout,location:{origin:'https://kick.com'},...extra});vm.runInContext(shared,context);vm.runInContext(source,context);return context.KickRefinedSearch;}
const api=setup(),id='clip_01M5VG3B8WEFY068DP0GCHKSGW';
const clip={id,title:'Road trip moment',duration:30,views:1200,created_at:'2026-10-20T10:00:00Z',privacy:'public',channel:{slug:'cobbruvs'},creator:{slug:'clipper'},category:{name:'IRL'},thumbnail_url:`https://clips.kick.com/${id}/thumbnail.webp`};

test('partial clip retries preserve successful pages and retry only failed channels at the same cursor',async()=>{
 const requests=[];let fail=true;
 const service=setup({fetch:async url=>{const channel=new URL(url).pathname.split('/')[4];requests.push(channel);if(channel==='bad'&&fail)throw Error('Temporary failure');return new Response(JSON.stringify({clips:[{...clip,id:channel==='bad'?'clip_01M5VG3B8WEFY068DP0GCHKSGX':id,channel:{slug:channel}}]}));}}).create();
 const q=api.parse('clips:good,bad');const first=await service.search(q);
 assert.equal(first.rows.length,1);assert.deepEqual(Array.from(first.failedChannels),['bad']);
 fail=false;const recovered=await service.search(q,{retryFailed:true});
 assert.equal(recovered.rows.length,2);assert.deepEqual(requests,['good','bad','bad']);assert.equal(recovered.failedChannels.length,0);
});

test('scoped channel search retries only failed scopes and retains successful rows',async()=>{
 const calls=[];let fail=true;
 const service=setup({fetch:async url=>{const slug=new URL(url).pathname.split('/').pop();calls.push(slug);if(slug==='bad'&&fail)throw Error('Temporary');return new Response(JSON.stringify({slug,user:{username:slug},livestream:null}));}}).create();
 const q=api.parse('channel:good,bad');const first=await service.search(q);assert.equal(first.rows.length,1);
 fail=false;const second=await service.search(q,{retryFailed:true});assert.equal(second.rows.length,2);assert.deepEqual(calls,['good','bad','bad']);
});

test('a failed later clip page retries its cursor without fetching successful scopes again',async()=>{
 const calls=[];let fail=true;
 const service=setup({fetch:async url=>{const parsed=new URL(url),slug=parsed.pathname.split('/')[4],cursor=parsed.searchParams.get('cursor')||'';calls.push([slug,cursor]);if(slug==='bad'&&cursor&&fail)throw Error('Temporary');const suffix=slug==='good'?(cursor?'Y':'W'):(cursor?'Z':'X');return new Response(JSON.stringify({clips:[{...clip,id:id.slice(0,-1)+suffix,channel:{slug}}],...(!cursor?{nextCursor:slug+'-next'}:{})}));}}).create();
 const q=api.parse('clips:good,bad');await service.search(q);const partial=await service.search(q,{append:true});assert.equal(partial.rows.length,3);
 fail=false;const retry=await service.search(q,{retryFailed:true});assert.equal(retry.rows.length,4);
 assert.deepEqual(calls,[['good',''],['bad',''],['good','good-next'],['bad','bad-next'],['bad','bad-next']]);
});
test('search parses multiple scopes, quoted phrases, exclusions and typed filters',()=>{
 const q=api.parse('clips:cobbruvs,xqc "road trip" -spoiler category:IRL sort:views after:2026-10-01 before:2026-10-28 creator:clipper views:>100 duration:<60');
 assert.equal(q.type,'clips');assert.deepEqual(Array.from(q.channels),['cobbruvs','xqc']);assert.deepEqual(Array.from(q.terms),['road trip']);assert.equal(q.views.op,'>');assert.equal(q.before,Date.parse('2026-10-28T23:59:59.999Z'));
 assert.equal(api.fits(api.normalize({clips:[clip]},'clips','cobbruvs')[0],q),true);assert.equal(api.parse('type:vods channel:xqc "late night"').type,'vods');assert.equal(api.parse('category:"Just Chatting" live:true').category,'just chatting');assert.equal(api.parse('https://kick.com/XQC').terms[0],'xqc');
 assert.equal(api.parse('clips:cobbruvs "title: chapter"').terms[0],'title: chapter','quoted text is literal rather than another operator');
});

test('visible search controls round-trip advanced filters without changing their meaning',()=>{
 for(const value of ['clips:cobbruvs,xqc "road trip" -spoiler category:"Just Chatting" sort:views after:2026-10-01 before:2026-10-28 creator:clipper views:>100 duration:<60','remote live:true','vods:xqc time:week "title: chapter"']){
  const query=api.parse(value);assert.deepEqual(api.parse(api.serialize(query)),query);
 }
});

test('an unscoped media tab can prompt for a channel without inventing one',()=>{
 assert.throws(()=>api.parse('type:clips'),/Choose a channel/);
 const draft=api.parse('type:clips',{allowUnscoped:true});assert.equal(draft.type,'clips');assert.equal(draft.channels.length,0);
 assert.equal(api.serialize(draft),'type:clips');
});

test('channel relevance favors exact names, then prefixes, with stable ties and numeric viewer sorting',()=>{
 const rows=[{slug:'other',live:'live',views:10000},{slug:'remoteextra',views:12},{slug:'remote',views:4},{slug:'pinned',views:null}];
 assert.deepEqual(Array.from(api.rank(rows,api.parse('remote'),['pinned']),row=>row.slug),['remote','remoteextra','pinned','other']);
 assert.deepEqual(Array.from(api.rank(rows,api.parse('sort:views')),row=>row.slug),['other','remoteextra','remote','pinned']);
});
test('malformed and unsupported filters fail clearly before fetching',()=>{
 for(const query of ['clips:../../x','clips:cobbruvs vods:xqc','clips:cobbruvs,xqc,foo,bar','clips:cobbruvs after:2026-02-31','clips:cobbruvs after:2026-10-28 before:2026-10-01','duration:30','vods:xqc creator:foo','live:maybe','foo:bar','"unclosed','clips:cobbruvs views:>abc','clips:cobbruvs sort:bogus'])assert.throws(()=>api.parse(query),query);
});
test('search normalizes only public media and safe image/watch destinations',()=>{
 const result=api.normalize({clips:[clip,{...clip,privacy:'private'},{...clip,id:'javascript:alert(1)'},{...clip,channel:{slug:'someone_else'}}]},'clips','cobbruvs');assert.equal(result.length,1);assert.equal(result[0].href,`https://kick.com/cobbruvs/clips/${id}`);
 assert.equal(api.image('https://files.kick.com.evil.test/photo'),'');assert.equal(api.image('https://user:pass@files.kick.com/photo'),'');assert.equal(api.duration(7384),'2:03:04');assert.equal(api.duration(30),'0:30');
 const channels=api.normalize({channels:[{slug:'xqc',isLive:false,user:{username:'xQc',profilePic:'https://files.kick.com/x.webp'}},{slug:'../settings'},{slug:'bad',is_banned:true}]},'channels');assert.equal(channels.length,1);assert.equal(channels[0].live,'offline');assert.equal(channels[0].views,null);
});
test('clip search caches pages, safely encodes cursors and does not repeat a cursor',async()=>{
 const requests=[];const cursor='{"id":"next&value","view":1200}';const service=setup({fetch:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(new URL(url).searchParams.has('cursor')?{clips:[{...clip,id:'clip_01M5VG3B8WEFY068DP0GCHKSGX'}],nextCursor:cursor}:{clips:[clip],nextCursor:cursor}));}}).create();const query=api.parse('clips:cobbruvs sort:views');
 assert.equal((await service.search(query)).more,true);const next=await service.search(query,{append:true});assert.equal(next.rows.length,2);assert.equal(next.more,false);assert.equal(new URL(requests[1].url).searchParams.get('cursor'),cursor);assert.equal(requests[0].options.credentials,'omit');await service.search(query);assert.equal(requests.length,2,'repeated searches reuse parsed public responses');service.destroy();
});
test('new searches abort old requests instead of returning stale results',async()=>{
 let cancelled=false;const service=setup({fetch:(url,options)=>url.includes('slow')?new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{cancelled=true;reject(new DOMException('Cancelled','AbortError'));},{once:true})):Promise.resolve(new Response(JSON.stringify({channels:[{slug:'fast',isLive:true,user:{username:'Fast'}}]})))}).create();
 const old=service.search(api.parse('slow')).catch(error=>error.name);const current=await service.search(api.parse('fast'));assert.equal(await old,'AbortError');assert.equal(cancelled,true);assert.equal(current.rows[0].slug,'fast');service.destroy();
});
