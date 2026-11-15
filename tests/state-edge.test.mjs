import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context=vm.createContext({URL});
for(const name of ['shared','session-data'])vm.runInContext(await readFile(`extension/${name}.js`,'utf8'),context);
const {normalize,multiState,multiURL,channelDetails}=context.KickRefined;
const plain=value=>JSON.parse(JSON.stringify(value));
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

test('prototype-like channel names have real size entries and round-trip shared URLs',()=>{
  const state=multiState({channels:['__proto__','constructor','toString'],sizes:JSON.parse('{"__proto__":4,"constructor":5,"tostring":6}')});
  assert.equal(Object.getPrototypeOf(state.sizes),null);
  assert.equal(state.sizes.__proto__,4);assert.equal(state.sizes.constructor,5);assert.equal(state.sizes.tostring,6);
  assert.deepEqual(JSON.parse(new URL(multiURL(state)).searchParams.get('immersion-tiles')),JSON.parse('{"__proto__":4,"constructor":5,"tostring":6}'));
  assert.equal(multiState({channels:['constructor']}).sizes.constructor,undefined);
});

test('malformed channel identifiers return no details instead of throwing during metadata refresh',()=>{
  for(const slug of [null,undefined,0,42,{},[],true])assert.equal(channelDetails({slug},'alpha'),null);
});

test('normalizers stop reading after the supported number of valid unique entries',()=>{
  const channels=Array.from({length:6},(_,i)=>'channel'+i),pinned=Array.from({length:30},(_,i)=>'pin'+i);
  Object.defineProperty(channels,6,{get(){throw Error('unused channel read');}});
  Object.defineProperty(pinned,30,{get(){throw Error('unused pin read');}});
  assert.equal(multiState({channels}).channels.length,6);assert.equal(normalize({pinned}).pinned.length,30);
});

test('normalizers skip duplicates and malformed entries without consuming valid capacity',()=>{
  const channels=['../bad','alpha','ALPHA',null,'settings','beta'];
  const pins=['../bad','alpha','ALPHA',null,'beta'];
  assert.deepEqual(Array.from(multiState({channels}).channels),['alpha','beta']);
  assert.deepEqual(Array.from(normalize({pinned:pins}).pinned),['alpha','beta']);
});

for(const seed of [1,7,42,12345,65535,0xdeadbeef]){
  test(`seed ${seed}: 500 corrupted settings/workspace inputs stay bounded, pure and idempotent`,()=>{
    const next=random(seed),pick=items=>items[Math.floor(next()*items.length)];
    const odd=[null,undefined,NaN,Infinity,-Infinity,-10000,0,.6,10000,'true',false,true,{},[]];
    const names=['alpha','ALPHA','beta','__proto__','constructor','toString','../bad','a?x=1','settings','bad name','',null,7];
    for(let i=0;i<500;i++){
      const input={enabled:pick(odd),fontSize:pick(odd),chatWidth:pick(odd),accent:pick(['mint','violet','blue','neutral','constructor',null]),pinned:Array.from({length:50},()=>pick(names))};
      const workspace={channels:Array.from({length:20},()=>pick(names)),sizes:JSON.parse('{"__proto__":4,"constructor":5,"alpha":9999,"beta":-100}'),focusSize:pick(odd),mixAudio:pick(odd),playerMode:pick(['embed','full',null]),playerModes:JSON.parse('{"__proto__":"embed","alpha":"full","beta":"invalid"}'),chat:pick(names),focus:pick(names),layout:pick(['grid','columns','focus','constructor',null])};
      const before=JSON.stringify([input,workspace]),settings=normalize(input),state=multiState(workspace);
      assert.equal(JSON.stringify([input,workspace]),before,'normalization must not mutate caller data');
      assert.deepEqual(plain(normalize(settings)),plain(settings));assert.deepEqual(plain(multiState(state)),plain(state));
      assert.ok(settings.fontSize>=12&&settings.fontSize<=18&&Number.isInteger(settings.fontSize));
      assert.ok(settings.chatWidth>=280&&settings.chatWidth<=440&&Number.isInteger(settings.chatWidth));
      assert.ok(settings.pinned.length<=30);assert.equal(new Set(settings.pinned).size,settings.pinned.length);
      assert.ok(state.channels.length<=6);assert.equal(new Set(state.channels).size,state.channels.length);
      assert.ok(state.focusSize>=45&&state.focusSize<=80);
      assert.ok(state.channels.length?state.channels.includes(state.chat)&&state.channels.includes(state.focus):state.chat===''&&state.focus==='');
      assert.ok(Object.entries(state.sizes).every(([slug,size])=>state.channels.includes(slug)&&Number.isInteger(size)&&size>=2&&size<=6));
      assert.ok(Object.entries(state.playerModes).every(([slug,mode])=>state.channels.includes(slug)&&['embed','full'].includes(mode)));
      const url=new URL(multiURL(state));assert.equal(url.origin,'https://kick.com');
      assert.equal(url.searchParams.get('refined-multi'),state.channels.join(','));
    }
  });
}

test('legacy session names containing emoji have stable IDs, deduplicate and remain within capacity',()=>{
  const sessions=Array.from({length:100},(_,i)=>({name:i%2?'\ud83c\udfb5 '+i:'Session '+i,state:{channels:['alpha']}}));
  const data=context.KickRefinedSessionData,first=data.normalize(sessions),again=data.normalize([...first,...sessions]);
  assert.equal(first.length,10);assert.deepEqual(plain(first),plain(again));
  assert.equal(new Set(first.map(session=>session.id)).size,10);assert.ok(first.every(session=>session.id.length<=384));
});
