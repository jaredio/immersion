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
    try {const url=new URL(value);return url.protocol==='https:'&&url.hostname==='pbs.twimg.com'&&!url.username&&!url.password&&!url.port?url.href:'';}catch{return '';}
  }
  function metadata(data,post) {
    const tweet=data?.tweet,author=tweet?.author;
    if(data?.code!==200||tweet?.id!==post.id||typeof author?.screen_name!=='string'||!/^\w{1,15}$/.test(author.screen_name))throw Error('Post unavailable');
    const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
    const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
    return {id:post.id,href:`https://x.com/${author.screen_name}/status/${post.id}`,handle:author.screen_name,name:text(author.name,100)||author.screen_name,
      text:text(tweet.text,12000),avatar:image(author.avatar_url),likes:count(tweet.likes),reposts:count(tweet.retweets),views:count(tweet.views),
      photos:(Array.isArray(tweet.media?.photos)?tweet.media.photos:[]).slice(0,4).map(photo=>image(photo.url)).filter(Boolean),
      videoPoster:image(tweet.media?.videos?.[0]?.thumbnail_url)};
  }
  globalThis.KickRefinedXData=Object.freeze({parse,image,metadata});
})();
