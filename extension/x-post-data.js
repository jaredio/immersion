/* Only public post metadata; never execute provider HTML or scripts. */
(() => {
  function parse(href) {
    try {
      const url=new URL(href);
      if(url.protocol!=='https:'||url.username||url.password||url.port||!['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(url.hostname))return null;
      const match=/^\/([a-zA-Z0-9_]{1,15})\/status\/(\d{1,25})\/?$/.exec(url.pathname);
      return match?{id:match[2],handle:match[1],href:`https://x.com/${match[1]}/status/${match[2]}`}:null;
    } catch { return null; }
  }
  function image(value) {
    try {if(typeof value!=='string'||value.length>4096)return '';const url=new URL(value);return url.protocol==='https:'&&url.hostname==='pbs.twimg.com'&&!url.username&&!url.password&&!url.port?url.href:'';}catch{return '';}
  }
  function video(value){try{if(typeof value!=='string'||value.length>4096)return '';const url=new URL(value);return url.protocol==='https:'&&url.hostname==='video.twimg.com'&&!url.username&&!url.password&&!url.port&&/\.mp4$/i.test(url.pathname)?url.href:'';}catch{return '';}}
  function metadata(data,post) {
    const tweet=data?.tweet,author=tweet?.author;
    if(data?.code!==200||tweet?.id!==post.id||typeof author?.screen_name!=='string'||!/^\w{1,15}$/.test(author.screen_name))throw Error('Post unavailable');
    const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
    const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
    return {id:post.id,href:`https://x.com/${author.screen_name}/status/${post.id}`,handle:author.screen_name,name:text(author.name,100)||author.screen_name,
      text:text(tweet.text,12000),avatar:image(author.avatar_url),likes:count(tweet.likes),reposts:count(tweet.retweets),views:count(tweet.views),
      photos:(Array.isArray(tweet.media?.photos)?tweet.media.photos:[]).slice(0,4).map(photo=>image(photo.url)).filter(Boolean),
      videoPoster:image(tweet.media?.videos?.[0]?.thumbnail_url),
      videos:(Array.isArray(tweet.media?.videos)?tweet.media.videos:[]).filter(item=>item&&typeof item==='object').slice(0,4).map(item=>{
        const candidates=[...(Array.isArray(item.formats)?item.formats:[]),...(Array.isArray(item.variants)?item.variants:[]),item];
        const sources=[],seen=new Set();
        for(const candidate of candidates){
          const src=video(candidate?.url);if(!src||seen.has(src))continue;
          const path=new URL(src).pathname,dimensions=/\/(\d{2,5})x(\d{2,5})\//.exec(path);
          const codec=candidate.codec||(/\/avc1\//.test(path)?'h264':/\/(?:hvc1|hev1)\//.test(path)?'hevc':/\/av01\//.test(path)?'av1':/\/vp09\//.test(path)?'vp9':'');
          // Avoid HEVC-only files; browser/OS support varies, especially in Firefox.
          if(codec&&!['h264','vp9','av1'].includes(codec))continue;
          const height=Number.isFinite(candidate.height)&&candidate.height>0?candidate.height:dimensions?Math.min(Number(dimensions[1]),Number(dimensions[2])):0;
          seen.add(src);sources.push({src,codec,height});
        }
        sources.sort((a,b)=>{
          const rank=source=>(source.codec==='h264'?0:source.codec?2:1)*3+(source.height>720?2:source.height?0:1);
          return rank(a)-rank(b)||(a.height>720?a.height-b.height:b.height-a.height);
        });
        const urls=sources.slice(0,8).map(source=>source.src),src=urls[0];
        return src?{src,sources:urls,poster:image(item.thumbnail_url),duration:Number.isFinite(item.duration)&&item.duration>0?item.duration:null}:null;
      }).filter(Boolean)};
  }
  globalThis.KickRefinedXData=Object.freeze({parse,image,video,metadata});
})();
