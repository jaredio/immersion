import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('telemetry protection serializes settings changes and recovers after a failed update',async()=>{
  const source=await readFile('extension/privacy-background.js','utf8');
  let settings={},changed,installed,startup,fail=false;const calls=[];
  const api={storage:{local:{get:async()=>({settings})},onChanged:{addListener:fn=>changed=fn}},
    runtime:{onInstalled:{addListener:fn=>installed=fn},onStartup:{addListener:fn=>startup=fn}},
    declarativeNetRequest:{updateEnabledRulesets:async value=>{if(fail){fail=false;throw Error('temporary');}calls.push(JSON.parse(JSON.stringify(value)));}}};
  vm.runInNewContext(source,{chrome:api,console:{warn(){}}});
  const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
  assert.deepEqual(calls.at(-1).enableRulesetIds,['kick-telemetry']);
  settings={blockTelemetry:false};changed({settings:{}},'local');await settle();
  assert.deepEqual(calls.at(-1).disableRulesetIds,['kick-telemetry']);
  settings={enabled:false};installed();await settle();
  assert.deepEqual(calls.at(-1).disableRulesetIds,['kick-telemetry']);
  fail=true;settings={};startup();await settle();
  changed({settings:{}},'local');await settle();
  assert.deepEqual(calls.at(-1).enableRulesetIds,['kick-telemetry']);
  settings={blockTelemetry:false};changed({settings:{}},'local');
  settings={};changed({settings:{}},'local');await settle();
  assert.deepEqual(calls.at(-1).enableRulesetIds,['kick-telemetry']);
});
