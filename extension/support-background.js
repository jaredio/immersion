/* Firefox-only, one-use framing compatibility for a selected public tip page.
 * Payment requests, nested payment frames, cookies and all other CSP directives are untouched.
 */
(() => {
  const api=globalThis.browser;if(!api?.webRequest?.onHeadersReceived)return;
  const intents=new Map(),kickOrigins=new Set(['https://kick.com','https://www.kick.com']);
  function kick(value){try{return kickOrigins.has(new URL(value).origin);}catch{return false;}}
  function sweep(){for(const [id,intent] of intents)if(intent.until<Date.now())intents.delete(id);}
  function allowFrame(value){
    // CSP permits a comma-separated list of policies. Remove only frame-ancestors from each policy.
    return value.split(',').map(policy=>policy.split(';').filter(part=>!/^\s*frame-ancestors(?:\s|$)/i.test(part)).map(part=>part.trim()).filter(Boolean).join('; ')).filter(Boolean).join(', ');
  }
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(!['immersion:tip-embed','immersion:tip-embed-end'].includes(message?.type))return;
    if(sender.id!==api.runtime.id||!sender.tab||sender.frameId!==0||!kick(sender.url))return;
    sweep();
    if(message.type==='immersion:tip-embed-end'){
      if(intents.get(sender.tab.id)?.token===message.token)intents.delete(sender.tab.id);reply({ok:true});return;
    }
    const page=KickRefinedSupportData.parse(message.href);
    if(!['kickbot','streamelements'].includes(page?.provider)||typeof message.token!=='string'||!message.token||message.token.length>80){reply({ok:false});return;}
    if(intents.size>=20&&!intents.has(sender.tab.id)){reply({ok:false});return;}
    intents.set(sender.tab.id,{href:page.href,token:message.token,until:Date.now()+30000});reply({ok:true});
  });
  api.webRequest.onHeadersReceived.addListener(details=>{
    sweep();const intent=intents.get(details.tabId);
    if(!intent||details.type!=='sub_frame'||details.parentFrameId!==0||details.method!=='GET'||details.url!==intent.href||!kick(details.documentUrl)||!details.responseHeaders)return;
    if(details.statusCode<200||details.statusCode>=300)return;
    intents.delete(details.tabId); // Only this initial document response; no continuing override during payment.
    const responseHeaders=[];
    for(const header of details.responseHeaders){
      const name=header.name.toLowerCase();
      if(name==='x-frame-options')continue;
      if(name==='content-security-policy'&&typeof header.value==='string'){
        const value=allowFrame(header.value);if(value)responseHeaders.push({...header,value});
      }else responseHeaders.push(header);
    }
    return {responseHeaders};
  },{urls:['https://kickbot.com/tips/*','https://www.kickbot.com/tips/*','https://streamelements.com/*/tip*','https://www.streamelements.com/*/tip*'],types:['sub_frame']},['blocking','responseHeaders']);
  api.tabs.onRemoved.addListener(id=>intents.delete(id));
})();
