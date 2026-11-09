/* Render channel-authored text as local DOM. Never inject publisher HTML. */
(() => {
  function url(value){try{const link=new URL(value);return link.protocol==='https:'&&!link.username&&!link.password?link.href:'';}catch{return '';}}
  function image(src,alt=''){
    const href=url(src);if(!href)return null;
    const element=document.createElement('img');element.src=href;element.alt=alt;element.loading='lazy';element.decoding='async';element.referrerPolicy='no-referrer';
    element.addEventListener('error',()=>{element.hidden=true;},{once:true});return element;
  }
  function link(href){const safe=url(href);if(!safe)return null;const element=document.createElement('a');element.href=safe;element.target='_blank';element.rel='noopener noreferrer';return element;}
  const platforms=[
    ['Instagram',['instagram.com'],'#e4408b','M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6m5-4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3'],
    ['X',['x.com','twitter.com'],'#f1f1f5','M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.4L5.6 22H2.4l8.2-9.4L2 2h6.4l4.5 6.8zm-1.1 18h1.7L7.4 4H5.6z'],
    ['YouTube',['youtube.com','youtu.be'],'#ff4242','M23 7s-.2-2-1-2.8C21.2 3.4 20 3.4 20 3.4 17.2 3.2 12 3.2 12 3.2s-5.2 0-8 .2c0 0-1.2 0-2 .8C1.2 5 1 7 1 7s-.2 2.3-.2 4.5V14s.2 2 .9 2.8c.8.8 2.1.8 2.1.8 2.8.2 8.2.2 8.2.2s5.2 0 8-.2c0 0 1.2 0 2-.8.8-.8 1-2.8 1-2.8s.2-2.3.2-4.5S23 7 23 7M10 14V7l6 3.5z'],
    ['Discord',['discord.com','discord.gg'],'#8b91ff','M20 4a19 19 0 0 0-5-1l-.6 1.2a18 18 0 0 0-4.8 0L9 3a19 19 0 0 0-5 1C1 8 0 12 1 17a20 20 0 0 0 6 3l1.3-2-2-1a13 13 0 0 0 11.4 0l-2 1 1.3 2a20 20 0 0 0 6-3c1-5 0-9-3-13M8 14c-1 0-1.8-1-1.8-2.2S7 9.6 8 9.6s1.8 1 1.8 2.2S9 14 8 14m8 0c-1 0-1.8-1-1.8-2.2s.8-2.2 1.8-2.2 1.8 1 1.8 2.2S17 14 16 14'],
    ['TikTok',['tiktok.com'],'#25f4ee','M15 2h3c.2 2.5 1.6 4 4 4.5V10a10 10 0 0 1-4-1.3V17a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z'],
    ['Facebook',['facebook.com','fb.com'],'#4599ff','M14 22v-9h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5A25 25 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9z'],
    ['Twitch',['twitch.tv'],'#b78aff','M3 1 1 5v16h6v3h3l3-3h5l4-4V1zm18 14-3 3h-5l-3 3v-3H5V4h16zM17 7h-2v6h2zm-5 0h-2v6h2z']
  ];
  function decorateSocials(root){
    for(const anchor of root.querySelectorAll('a[href]')){
      if(anchor.dataset.socialPlatform||anchor.querySelector('img'))continue;
      let host;try{host=new URL(anchor.href).hostname.toLowerCase();}catch{continue;}
      const platform=platforms.find(([,hosts])=>hosts.some(domain=>host===domain||host.endsWith('.'+domain)));if(!platform)continue;
      const [label,,color,path]=platform,original=anchor.textContent.trim();anchor.dataset.socialPlatform=label;anchor.classList.add('profile-social-link');anchor.style.setProperty('--social-color',color);anchor.title=original&&original!==label?`${label} · ${original}`:label;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);const text=document.createElement('span');text.textContent=label;anchor.replaceChildren(svg,text);
    }
  }
  function inline(parent,text,depth=0){
    if(depth>5){parent.append(document.createTextNode(text));return;}
    const tokens=/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|(?<!\w)_(\w[^_]*?)_(?!\w)/g;
    let start=0;
    for(const match of text.matchAll(tokens)){
      parent.append(document.createTextNode(text.slice(start,match.index)));let node;
      if(match[2])node=image(match[2],match[1]);
      else if(match[4]){node=link(match[4]);if(node)inline(node,match[3],depth+1);}
      else {node=document.createElement(match[5]||match[6]?'strong':match[7]?'code':'em');node.textContent=match[5]||match[6]||match[7]||match[8]||match[9];}
      parent.append(node||document.createTextNode(match[0]));start=match.index+match[0].length;
    }
    parent.append(document.createTextNode(text.slice(start)));
  }
  function formatted(parent,input){
    const text=typeof input==='string'?input.slice(0,20000).replace(/\r\n?/g,'\n'):'';
    // HTML sometimes appears in panel descriptions. Rebuild only readable tags.
    if(/<(?:p|div|br|img|h[1-6]|ul|ol|strong|a)\b/i.test(text)){
      const parsed=new DOMParser().parseFromString(text,'text/html');
      function copy(source,target,depth=0){
        if(depth>24)return;
        for(const child of source.childNodes){
          if(child.nodeType===3){target.append(document.createTextNode(child.textContent));continue;}
          if(child.nodeType!==1||/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|FORM|INPUT|META|LINK)$/.test(child.tagName))continue;
          let node;if(child.tagName==='IMG')node=image(child.getAttribute('src'),child.getAttribute('alt')||'');
          else if(child.tagName==='A')node=link(child.getAttribute('href'));
          else if(/^(P|DIV|BR|STRONG|B|EM|I|U|S|H[1-6]|UL|OL|LI|BLOCKQUOTE|CODE|PRE|HR|TABLE|THEAD|TBODY|TR|TH|TD)$/.test(child.tagName))node=document.createElement(child.tagName.toLowerCase());
          if(node){if(child.tagName!=='IMG')copy(child,node,depth+1);target.append(node);}else copy(child,target,depth+1);
        }
      }
      copy(parsed.body,parent);return;
    }
    let paragraph=null,list=null,code=null;
    for(const line of text.split('\n')){
      if(/^```/.test(line)){if(code){code=null;}else{const pre=document.createElement('pre');code=document.createElement('code');pre.append(code);parent.append(pre);}paragraph=list=null;continue;}
      if(code){code.append(document.createTextNode(line+'\n'));continue;}
      if(!line.trim()){paragraph=list=null;continue;}
      const heading=/^(#{1,6})\s+(.+)/.exec(line),item=/^\s*([-*+]|\d+\.)\s+(.+)/.exec(line);
      if(heading){const h=document.createElement(`h${Math.min(6,heading[1].length+2)}`);inline(h,heading[2]);parent.append(h);paragraph=list=null;}
      else if(item){const tag=/\d/.test(item[1])?'ol':'ul';if(!list||list.tagName.toLowerCase()!==tag){list=document.createElement(tag);parent.append(list);}const li=document.createElement('li');inline(li,item[2]);list.append(li);paragraph=null;}
      else if(/^>\s?/.test(line)){const quote=document.createElement('blockquote');inline(quote,line.replace(/^>\s?/,''));parent.append(quote);paragraph=list=null;}
      else if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){parent.append(document.createElement('hr'));paragraph=list=null;}
      else{list=null;if(!paragraph){paragraph=document.createElement('p');parent.append(paragraph);}else paragraph.append(document.createElement('br'));inline(paragraph,line);}
    }
  }
  globalThis.KickRefinedProfile=Object.freeze({formatted,image,link,url,decorateSocials});
})();
