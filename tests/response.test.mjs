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

test('pre-aborted responses cancel their bodies and preserve the caller cancellation reason',async()=>{
  for(const reason of [new DOMException('Stopped','AbortError'),'custom reason',0,false,'']){
    const controller=new AbortController();controller.abort(reason);let canceled=0;
    const body=new ReadableStream({cancel(){canceled++;}}),response=new Response(body);
    await assert.rejects(readText(response,{signal:controller.signal}),error=>error===reason);
    assert.equal(canceled,1);assert.equal(body.locked,false);
  }
});

for(const declared of [true,false]){
  test(`oversized ${declared?'declared':'streamed'} bodies reject even if stream cancellation never settles`,async()=>{
    let canceled=0,result;
    const body=new ReadableStream({start(c){if(!declared)c.enqueue(new Uint8Array(6));},cancel(){canceled++;return new Promise(()=>{});}});
    const response=new Response(body,declared?{headers:{'content-length':'6'}}:undefined);
    const pending=readText(response,{maxBytes:5}).catch(error=>result=error);
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(result?.message||'',/too large/);assert.equal(canceled,1);assert.equal(body.locked,false);await pending;
  });
  test(`failed cancellation cannot replace the size error of a ${declared?'declared':'streamed'} body`,async()=>{
    const response=new Response(new ReadableStream({start(c){if(!declared)c.enqueue(new Uint8Array(6));},cancel(){throw Error('cancel failed');}}),declared?{headers:{'content-length':'6'}}:undefined);
    await assert.rejects(readText(response,{maxBytes:5}),/too large/);assert.equal(response.body.locked,false);
  });
}

test('response readers release locks after stream errors and remove abort listeners',async()=>{
  const controller=new AbortController(),signal=controller.signal;let added=0,removed=0;
  const add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
  signal.addEventListener=(...args)=>{added++;return add(...args);};signal.removeEventListener=(...args)=>{removed++;return remove(...args);};
  const body=new ReadableStream({pull(c){c.error(Error('connection reset'));}});
  await assert.rejects(readText(new Response(body),{signal}),/connection reset/);
  assert.equal(body.locked,false);assert.equal(added,1);assert.equal(removed,1);controller.abort();
});

test('exact byte limits accept empty, ASCII and multibyte bodies across every split boundary',async()=>{
  for(const value of ['', 'abc', '\u00e9\ud83c\udfb5\u4e2d']){
    const bytes=new TextEncoder().encode(value);
    for(let split=0;split<=bytes.length;split++){
      const response=new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,split));c.enqueue(bytes.slice(split));c.close();}}));
      assert.equal(await readText(response,{maxBytes:bytes.length}),value);
    }
  }
});
