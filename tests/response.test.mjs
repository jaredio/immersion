import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL,DOMException,TextDecoder});
vm.runInContext(await readFile('extension/shared.js','utf8'),context);
const readText=context.KickRefined.readText;
test('bounded responses reject declared and streamed oversized bodies and cancel downloads',async()=>{
  let canceled=0;
  const declared=new Response(new ReadableStream({cancel(){canceled++;}}),{headers:{'content-length':'100'}});
  await assert.rejects(readText(declared,{maxBytes:5}),/too large/);assert.equal(canceled,1);
  const streamed=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([65,66,67]));c.enqueue(new Uint8Array([68,69,70]));},cancel(){canceled++;}}));
  await assert.rejects(readText(streamed,{maxBytes:5}),/too large/);assert.equal(canceled,2);
});
test('bounded responses decode split UTF-8, enforce byte counts and cancel pending reads',async()=>{
  const bytes=new TextEncoder().encode('A😀B');
  const response=()=>new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,3));c.enqueue(bytes.slice(3));c.close();}}));
  assert.equal(await readText(response(),{maxBytes:6}),'A😀B');
  await assert.rejects(readText(response(),{maxBytes:4}),/too large/);
  const abort=new AbortController();let canceled=false;
  const pending=readText(new Response(new ReadableStream({cancel(){canceled=true;}})),{signal:abort.signal});
  abort.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(canceled,true);
});
