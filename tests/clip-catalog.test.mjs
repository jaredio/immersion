import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL,location:{origin:'https://kick.com'}});vm.runInContext(await readFile(new URL('../extension/clip-catalog.js',import.meta.url),'utf8'),context);
const {fromData}=context.KickRefinedClipCatalog;
const liveId='12345678-1234-7234-8234-123456789abc',pastId='22345678-1234-7234-8234-123456789abc';
test('current recording models use id, channel and duration in seconds, with live first',()=>{
 const rows=fromData({data:[{id:pastId,channel:{slug:'alpha'},title:'Previous broadcast',status:'public',duration:7200,start_time:'2026-01-01T10:00:00Z'},{id:liveId,channel:{slug:'alpha'},title:'Current broadcast',status:'public',duration:0,is_live:true,start_time:'2026-01-02T10:00:00Z'}]},'alpha',{scoped:true});
 assert.equal(rows.length,2);assert.equal(rows[0].id,liveId);assert.equal(rows[0].live,true);assert.equal(rows[1].duration,7200,'current-model durations are already seconds');
 assert.equal(fromData({data:[{id:pastId,channel:{slug:'other'},status:'public'},{id:liveId,channel:{slug:'alpha'},status:'private'}]},'alpha').length,0);
});
test('current channel metadata exposes the ongoing archive as livestream.vod_id',()=>{
 const rows=fromData({slug:'alpha',id:42,livestream:{vod_id:liveId,channel_id:42,session_title:'Live right now',is_live:true,duration:0,start_time:'2026-01-01T10:00:00Z'}},'alpha',{scoped:true});
 assert.equal(rows.length,1);assert.equal(rows[0].id,liveId);assert.equal(rows[0].live,true);
 const old=fromData([{video:{uuid:pastId,status:'public'},duration:7200000,session_title:'Legacy replay'}],'alpha',{scoped:true});assert.equal(old[0].duration,7200,'legacy nested responses retain millisecond conversion');
});
