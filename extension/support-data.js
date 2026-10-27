/* Public tip-page addresses only. Overlay, dashboard and lookalike URLs are excluded. */
(() => {
  const reserved=new Set(['about','admin','api','auth','contact-us','dashboard','features','learn','login','logout','pricing','privacy-policy','register','signup','support','terms-of-service','troubleshooting']);
  function parse(value){
    try{
      if(typeof value!=='string'||value.length>2048)return null;
      const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
      const host=url.hostname.replace(/^www\./,''),parts=url.pathname.split('/').filter(Boolean);
      let provider,label,recipient;
      if(host==='powerchat.live'&&parts.length===1&&!reserved.has(parts[0].toLowerCase())&&/^[a-zA-Z0-9_-]{1,80}$/.test(parts[0])){
        provider='powerchat';label='Powerchat';recipient=parts[0];
      }else if(host==='kickbot.com'&&parts.length===2&&parts[0]==='tips'&&/^[a-zA-Z0-9_-]{1,80}$/.test(parts[1])){
        provider='kickbot';label='KickBot';recipient=parts[1];
      }else if(host==='streamelements.com'&&parts.length===2&&parts[1]==='tip'&&!reserved.has(parts[0].toLowerCase())&&/^[a-zA-Z0-9_-]{1,80}$/.test(parts[0])){
        provider='streamelements';label='StreamElements';recipient=parts[0];
      }else return null;
      // Keep provider options, including Powerchat's ?tab=donation. Fragments are not recipient identity.
      url.hash='';url.hostname=host;url.pathname='/'+parts.join('/');
      return {provider,label,recipient,href:url.href,key:`${provider}:${recipient.toLowerCase()}`};
    }catch{return null;}
  }
  function extract(text,source='Channel panel'){
    if(typeof text!=='string')return [];
    const found=new Map();
    for(const match of text.slice(0,600000).matchAll(/https:\/\/[^\s<>"'\[\]()]+/gi)){
      const value=parse(match[0].replace(/&amp;/g,'&').replace(/[.,;!]+$/,''));
      if(value&&!found.has(value.key))found.set(value.key,{...value,source});
    }
    return [...found.values()];
  }
  globalThis.KickRefinedSupportData=Object.freeze({parse,extract});
})();
