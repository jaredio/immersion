import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({ URL });
vm.runInContext(await readFile(new URL('../extension/shared.js', import.meta.url), 'utf8'), context);
const { normalize, channelSlug } = context.KickRefined;

test('stored settings cannot create unsafe URLs or invalid layout values', () => {
  const settings = normalize({ enabled: 'false', fontSize: -100, chatWidth: 9000, accent: 'url(evil)', pinned: ['xQc', 'xqc', '../settings', '<img>', 'valid_name', 42] });
  assert.equal(settings.enabled, true);
  assert.equal(settings.fontSize, 12);
  assert.equal(settings.chatWidth, 440);
  assert.equal(settings.accent, 'mint');
  assert.deepEqual(Array.from(settings.pinned), ['xqc', 'valid_name']);
  assert.equal(normalize(null).chatWidth, 340);
});

test('channel navigation excludes external, account and non-channel URLs', () => {
  for (const href of ['https://evil.test/xqc', 'javascript:alert(1)', '/settings', '/browse', '/auth', '/xqc/videos', '/xqc?next=1', '/xqc#chat', '/legal']) assert.equal(channelSlug(href), null, href);
  assert.equal(channelSlug('/XQC/'), 'xqc');
  assert.equal(channelSlug('https://kick.com/valid_name'), 'valid_name');
});

test('scroll patch only changes animated native chat scrolling while enabled', async () => {
  const calls = [];
  class Element { scrollTo(...args) { calls.push(args); } scroll(...args) { calls.push(args); } }
  const root = { dataset: { krEnabled: 'true', krPerformance: 'true' } };
  const ctx = vm.createContext({ Element, document: { documentElement: root } });
  vm.runInContext(await readFile(new URL('../extension/scroll.js', import.meta.url), 'utf8'), ctx);
  const chat = new Element(); chat.id = 'chatroom-messages';
  const other = new Element(); other.id = 'other';
  const options = { top: 100, behavior: 'smooth' };
  chat.scrollTo(options); other.scrollTo(options); chat.scrollTo(1, 2);
  root.dataset.krPerformance = 'false'; chat.scroll(options);
  root.dataset.krPerformance = 'true'; root.dataset.krEnabled = 'false'; chat.scrollTo(options);
  assert.equal(calls[0][0].behavior, 'instant');
  assert.equal(options.behavior, 'smooth', 'does not mutate caller-owned options');
  assert.equal(calls[1][0].behavior, 'smooth');
  assert.deepEqual(calls[2], [1, 2]);
  assert.equal(calls[3][0].behavior, 'smooth');
  assert.equal(calls[4][0].behavior, 'smooth');
});

test('both packages contain only scoped permissions and local assets', async () => {
  for (const browser of ['chrome', 'firefox']) {
    const manifest = JSON.parse(await readFile(new URL(`../dist/${browser}/manifest.json`, import.meta.url)));
    assert.equal(manifest.name,'Immersion');
    assert.equal(manifest.action.default_title,'Immersion');
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.ok(!manifest.background && !manifest.externally_connectable);
    for (const script of manifest.content_scripts) {
      for (const match of script.matches) assert.ok(['https://kick.com/*', 'https://www.kick.com/*', 'https://kick.com/popout/*/chat', 'https://www.kick.com/popout/*/chat', 'https://player.kick.com/*'].includes(match), match);
      for (const file of [...(script.js || []), ...(script.css || [])]) await readFile(new URL(`../dist/${browser}/${file}`, import.meta.url));
    }
    if (browser === 'firefox') {
      assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
      assert.equal(manifest.browser_specific_settings.gecko.id,'kick-refined@local.extension','retain the existing add-on identity and storage');
    }
  }
});

test('multiview sessions reject unsafe channels, deduplicate and limit decoder count', () => {
  const state = context.KickRefined.multiState({ channels: ['XQC', 'xqc', '../settings', 'bad?token=abc', 'javascript:alert(1)', 'a', 'b', 'c', 'd', 'e', 'f'], layout: '<script>', chat: 'evil', focus: 'unknown' });
  assert.deepEqual(Array.from(state.channels), ['xqc', 'a', 'b', 'c', 'd', 'e']);
  assert.equal(state.layout, 'grid'); assert.equal(state.chat, 'xqc'); assert.equal(state.focus, 'xqc');
});

test('shared multiview links carry only validated workspace settings on Kick', () => {
  const url = new URL(context.KickRefined.multiURL({ channels: ['xqc', 'synthwave', '../settings'], layout: 'focus', focus: 'synthwave', chat: 'xqc', chatVisible: false }));
  assert.equal(url.origin, 'https://kick.com');
  assert.equal(url.searchParams.get('refined-multi'), 'xqc,synthwave');
  assert.equal(url.searchParams.get('refined-focus'), 'synthwave');
  assert.equal(url.searchParams.get('refined-hide-chat'), '1');
});

test('Immersion layout preferences migrate safely and share only bounded sizes', () => {
  const {multiState,multiURL}=context.KickRefined;
  assert.equal(multiState({channels:['a','b']}).focusSize,67);
  assert.equal(multiState({focusSize:Infinity}).focusSize,67);
  assert.equal(multiState({focusSize:900}).focusSize,80);
  assert.equal(multiState({focusSize:-900}).focusSize,45);
  const url=new URL(multiURL({channels:['a','b'],focusSize:72}));
  assert.equal(url.searchParams.get('immersion-size'),'72');
});

test('player audio bridge rejects unrelated frames and untrusted commands', async () => {
  const source = await readFile(new URL('../extension/player-frame.js', import.meta.url), 'utf8');
  const listeners = {}, parent = { postMessage() {} }, video = { muted:true,volume:1,paused:true,addEventListener(){} };
  const document = { documentElement: {}, querySelectorAll: () => [video] };
  const window = { name: 'kick-refined:xqc', parent, top: {}, addEventListener: (name, cb) => { listeners[name] = cb; } };
  class Observer { observe() {} }
  vm.runInNewContext(source, { window, document, MutationObserver: Observer, setTimeout });
  const command={type:'kick-refined:control',session:'test-session',revision:1,muted:false,volume:.37};
  listeners.message({ source: {}, origin: 'https://kick.com', data:command });
  assert.equal(video.muted, true);
  listeners.message({ source: parent, origin: 'https://evil.test', data:command });
  assert.equal(video.muted, true);
  listeners.message({ source: parent, origin: 'https://kick.com', data:command });
  assert.equal(video.muted, false);
  assert.equal(video.volume,.37);
  listeners.message({source:parent,origin:'https://kick.com',data:{...command,revision:0,muted:true,volume:0}});
  assert.equal(video.muted,false,'stale control commands do not override newer intent');
  listeners.message({source:parent,origin:'https://kick.com',data:{...command,revision:2,volume:900}});
  assert.equal(video.volume,.37,'invalid media values are rejected');
  const unowned = { ...window, name: 'ordinary-embed', addEventListener() { throw Error('must not install'); } };
  vm.runInNewContext(source, { window: unowned, document });
});

test('channel quick views accept public fields and reject unsafe social links',()=>{
  const {channelDetails}=context.KickRefined;
  const result=channelDetails({slug:'aurora',user:{username:'Aurora',bio:'Live music',twitter:'aurora_live',instagram:'https://evil.test/phish',youtube:'javascript:alert(1)',discord:'https://discord.gg/music'},livestream:{is_live:true,session_title:'Friday set',viewer_count:1428,categories:[{name:'Music'}]}},'aurora');
  assert.equal(result.streamTitle,'Friday set');assert.equal(result.viewers,'1,428');assert.equal(result.category,'Music');
  assert.deepEqual(Array.from(result.socials,s=>s.href),['https://x.com/aurora_live','https://discord.gg/music']);
  assert.equal(channelDetails({slug:'someone_else'},'aurora'),null);
  assert.equal(channelDetails({slug:'aurora',livestream:null},'aurora').live,'offline');
});

test('tile widths and audio mixing migrate safely into saved and shared layouts',()=>{
  const {multiState,multiURL}=context.KickRefined;
  const state=multiState({channels:['a','b'],mixAudio:true,sizes:{a:900,b:-1,evil:6}});
  assert.equal(state.sizes.a,6);assert.equal(state.sizes.b,2);assert.equal(state.sizes.evil,undefined);
  assert.equal(multiState({mixAudio:'true'}).mixAudio,false);
  const url=new URL(multiURL(state));assert.equal(url.searchParams.get('immersion-mix'),'1');assert.deepEqual(JSON.parse(url.searchParams.get('immersion-tiles')),{a:6,b:2});
});

test('a delayed player obeys the latest pause and avoids repeated media setters', async () => {
  const source=await readFile(new URL('../extension/player-frame.js',import.meta.url),'utf8');
  let present=false,observer,muted=true,volume=1,mutations=0,plays=0,pauses=0;
  const timers=[],listeners={},parent={postMessage(){}};
  const video={paused:false,addEventListener(){},play(){plays++;},pause(){pauses++;this.paused=true;},
    get muted(){return muted;},set muted(value){mutations++;muted=value;},
    get volume(){return volume;},set volume(value){mutations++;volume=value;}};
  const window={name:'kick-refined:test',parent,top:{},addEventListener:(name,cb)=>{listeners[name]=cb;}};
  const document={documentElement:{},querySelectorAll:()=>present?[video]:[]};
  class Observer{constructor(callback){observer=callback;}observe(){}}
  vm.runInNewContext(source,{window,document,MutationObserver:Observer,setTimeout:callback=>{timers.push(callback);return timers.length;}});
  const send=(revision,action)=>listeners.message({source:parent,origin:'https://kick.com',data:{type:'kick-refined:control',session:'race-test',revision,muted:true,volume:1,action}});
  send(1,'play');send(2,'pause');present=true;observer();
  while(timers.length)timers.shift()();
  assert.equal(plays,0,'a stale queued play must not run when the video arrives');
  assert.equal(pauses,1);
  send(3);send(4);
  assert.equal(mutations,0,'unchanged volume and mute values never invoke setters');
});
