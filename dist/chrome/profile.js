/* Render channel-authored text as local DOM. Never inject publisher HTML. */
(() => {
  function url(value){try{const link=new URL(value);return link.protocol==='https:'&&!link.username&&!link.password?link.href:'';}catch{return '';}}
  function image(src,alt=''){
    const href=url(src);if(!href)return null;
    const element=document.createElement('img');element.src=href;element.alt=alt;element.loading='lazy';element.decoding='async';element.referrerPolicy='no-referrer';
    element.addEventListener('error',()=>{element.hidden=true;},{once:true});return element;
  }
  function link(href){const safe=url(href);if(!safe)return null;const element=document.createElement('a');element.href=safe;element.target='_blank';element.rel='noopener noreferrer';return element;}
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
  globalThis.KickRefinedProfile=Object.freeze({formatted,image,link,url});
})();
