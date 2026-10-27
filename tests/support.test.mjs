import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/support-data.js',import.meta.url),'utf8');
const context=vm.createContext({URL});vm.runInContext(source,context);
const {parse,extract}=context.KickRefinedSupportData;
test('tip links preserve recipient/options and reject lookalikes, private routes and credentials',()=>{
  assert.equal(parse('https://powerchat.live/creator?tab=donation').href,'https://powerchat.live/creator?tab=donation');
  assert.equal(parse('https://kickbot.com/tips/custom-brand').recipient,'custom-brand');
  assert.equal(parse('https://www.streamelements.com/xqc/tip?amount=5').href,'https://streamelements.com/xqc/tip?amount=5');
  assert.equal(parse('https://streamelements.com/xqc/tip').label,'StreamElements');
  for(const url of ['http://powerchat.live/creator','https://powerchat.live.evil.test/creator','https://user:secret@powerchat.live/creator','https://powerchat.live:444/creator','https://powerchat.live/creator/tts','https://powerchat.live/dashboard','https://powerchat.live/login','https://powerchat.live/','https://kickbot.com/dashboard/tipping','https://kickbot.com/external/123/tts','https://kickbot.com/tips/creator/other','https://kickbot.com.evil.test/tips/creator','javascript:alert(1)'])assert.equal(parse(url),null,url);
});
test('different providers and creator aliases remain distinct published destinations',()=>{
  const links=extract('https://powerchat.live/alias https://kickbot.com/tips/alias https://streamelements.com/alias/tip');
  assert.equal(links.length,3);assert.deepEqual(Array.from(links,value=>value.provider),['powerchat','kickbot','streamelements']);
  for(const href of ['https://streamelements.com/xqc','https://streamelements.com/dashboard/tip','https://streamelements.com/xqc/overlay','https://streamelements.com/xqc/tip/extra','https://streamelements.com.evil.test/xqc/tip','https://user:pass@streamelements.com/xqc/tip','http://streamelements.com/xqc/tip'])assert.equal(parse(href),null,href);
});
test('extracts plain, markdown and HTML URLs without turning markup into DOM',()=>{
  const items=extract('[Tip](https://powerchat.live/alias?tab=donation) <a href="https://kickbot.com/tips/custom?x=1&amp;y=2">Tip</a> https://powerchat.live/alias?tab=about https://powerchat.live.evil.test/no');
  assert.equal(items.length,2);assert.equal(items[0].recipient,'alias');assert.equal(items[0].source,'Channel panel');assert.equal(items[1].href,'https://kickbot.com/tips/custom?x=1&y=2');
});
const background=await readFile(new URL('../extension/support-background.js',import.meta.url),'utf8');
function gateway(){
  let message,headers,removed,filter;let now=1000;
  const browser={runtime:{id:'immersion',onMessage:{addListener:fn=>message=fn}},webRequest:{onHeadersReceived:{addListener:(fn,options)=>{headers=fn;filter=options;}}},tabs:{onRemoved:{addListener:fn=>removed=fn}}};
  const sandbox=vm.createContext({URL,browser,Date:{now:()=>now}});vm.runInContext(source,sandbox);vm.runInContext(background,sandbox);
  const sender={id:'immersion',tab:{id:7},frameId:0,url:'https://kick.com/channel'};
  const request={tabId:7,type:'sub_frame',parentFrameId:0,method:'GET',url:'https://kickbot.com/tips/custom-brand',documentUrl:'https://kick.com/channel',statusCode:200,responseHeaders:[{name:'X-Frame-Options',value:'DENY'},{name:'Content-Security-Policy',value:"default-src 'self'; frame-ancestors 'none'; script-src 'self' https://js.stripe.com"},{name:'Content-Security-Policy',value:"frame-ancestors 'self', object-src 'none'; frame-ancestors 'self'"},{name:'Set-Cookie',value:'provider=session; Secure; HttpOnly; SameSite=Lax'}]};
  const authorize=(patch={},from=sender)=>{let result;message({type:'immersion:tip-embed',href:request.url,token:'selected-checkout',...patch},from,value=>result=value);return result;};
  return {authorize,request,headers,removed,sender,message,filter,advance:()=>now+=31000};
}
test('Firefox compatibility removes only framing directives for one selected tip response',()=>{
  const g=gateway();assert.equal(g.headers(g.request),undefined,'not enabled globally');assert.equal(g.authorize().ok,true);
  const result=g.headers(g.request);
  assert.equal(result.responseHeaders.some(h=>h.name.toLowerCase()==='x-frame-options'),false);
  const policies=result.responseHeaders.filter(h=>h.name.toLowerCase()==='content-security-policy').map(h=>h.value);
  assert.deepEqual(Array.from(policies),["default-src 'self'; script-src 'self' https://js.stripe.com","object-src 'none'"],'script, resource and object protections are preserved');
  assert.equal(result.responseHeaders.find(h=>h.name==='Set-Cookie').value,g.request.responseHeaders.at(-1).value,'cookie policy is untouched');
  assert.equal(g.headers(g.request),undefined,'authorization is consumed after the initial document response');
  assert.deepEqual(Array.from(g.filter.types),['sub_frame']);
});
test('Firefox compatibility rejects other tabs, recipients, websites, payment requests and expired intents',()=>{
  const g=gateway();
  for(const sender of [{...g.sender,id:'other'},{...g.sender,frameId:4},{...g.sender,url:'https://evil.test'},{...g.sender,tab:null}])assert.equal(g.authorize({},sender),undefined);
  assert.equal(g.authorize({href:'https://kickbot.com/dashboard'}).ok,false);
  assert.equal(g.authorize({href:'https://powerchat.live/creator'}).ok,false);
  g.authorize();
  for(const patch of [{tabId:8},{parentFrameId:4},{type:'main_frame'},{method:'POST'},{url:'https://kickbot.com/tips/another'},{url:'https://api.stripe.com/payment'},{documentUrl:'https://evil.test'}])assert.equal(g.headers({...g.request,...patch}),undefined,JSON.stringify(patch));
  let result;g.message({type:'immersion:tip-embed-end',token:'wrong'},g.sender,value=>result=value);assert.equal(result.ok,true);assert.ok(g.headers(g.request),'wrong token cannot cancel the selected page');
  g.authorize();g.message({type:'immersion:tip-embed-end',token:'selected-checkout'},g.sender,()=>{});assert.equal(g.headers(g.request),undefined);
  g.authorize();g.advance();assert.equal(g.headers(g.request),undefined);
  g.authorize();g.removed(7);assert.equal(g.headers(g.request),undefined,'closing the Kick tab removes authorization');
});
test('StreamElements uses the same one-response framing scope without affecting other recipients',()=>{
  const g=gateway(),href='https://streamelements.com/xqc/tip';assert.equal(g.authorize({href}).ok,true);
  assert.equal(g.headers({...g.request,url:'https://streamelements.com/another/tip'}),undefined);
  assert.ok(g.headers({...g.request,url:href}));assert.equal(g.headers({...g.request,url:href}),undefined);
});
