import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const engine=process.env.KR_ENGINE==='firefox'?firefox:chromium,browser=await engine.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://kick.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><style>body{margin:24px;background:#09090b;color:#eee;font:14px system-ui}.surface{padding:20px;margin:20px 0;border:1px solid #ffffff18;border-radius:14px;overflow:clip}h2{font-size:15px}</style></head><body><h2>Channel profile</h2><div id="single" class="surface"></div><h2>Workspace profile</h2><div id="workspace" class="surface"></div></body></html>'}));
  await page.route(/^https:\/\/(?:pbs\.twimg\.com|scontent\.cdninstagram\.com|cdn\.discordapp\.com|p16\.tiktokcdn\.com|i\.ytimg\.com)\//,route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="380" height="160"><defs><linearGradient id="a"><stop stop-color="#387069"/><stop offset="1" stop-color="#8a4d74"/></linearGradient></defs><rect width="380" height="160" fill="url(#a)"/><circle cx="210" cy="95" r="65" fill="#ffffff20"/></svg>'}));
  await page.goto('https://kick.com/creator');
  await page.addStyleTag({path:'extension/ui.css'});
  await page.evaluate(()=>{
    window.profileRequests=[];
    window.KickRefined={api:{runtime:{sendMessage:async message=>{
      if(message.type!=='immersion:social-profile')return {};
      profileRequests.push(message.href);
      const item=KickRefinedSocialData.parse(message.href);
      if(item.provider==='instagram'){
        const user={username:item.handle,full_name:'Creator Photos',is_verified:true,profile_pic_url:'https://scontent.cdninstagram.com/avatar.jpg',biography:'Photos, streams and behind the scenes.',followers_count:250000,following_count:120,posts_count:85,graphql_media:Array.from({length:6},(_,i)=>({shortcode_media:{shortcode:`POST${i}`,display_url:`https://scontent.cdninstagram.com/post${i}.jpg`,owner:{username:item.handle},edge_media_to_caption:{edges:[{node:{text:`Recent photo ${i+1}`}}]}}}))};
        return {ok:true,item:KickRefinedSocialData.instagram(JSON.stringify({contextJSON:JSON.stringify({context:user})}),item)};
      }
      if(item.provider==='discord')return {ok:true,item:KickRefinedSocialData.discord({code:item.handle,guild:{id:'123456789',name:'Creator Community',description:'The creator’s real Discord community.',icon:'a_1234567890abcdef1234567890abcdef',banner:'1234567890abcdef1234567890abcdef',features:['VERIFIED']},approximate_member_count:45000,approximate_presence_count:1250},item)};
      if(item.provider==='tiktok')return {ok:true,item:KickRefinedSocialData.tiktokEmbed(`<script id="__FRONTITY_CONNECT_STATE__">${JSON.stringify({source:{data:{'/embed/@creator':{userInfo:{uniqueId:'creator',nickname:'Creator TikToks',avatarThumbUrl:'https://p16.tiktokcdn.com/avatar.jpg',followerCount:5000,followingCount:120,heartCount:25000,code:200},videoList:Array.from({length:4},(_,i)=>({id:'770141103419980521'+i,authorUniqueId:'creator',coverUrl:`https://p16.tiktokcdn.com/video${i}.jpg`,desc:`Recent TikTok ${i+1}`}))}}}})}</script>`,item)};
      if(item.provider==='youtube'&&!message.retry)return {ok:false};
      if(item.provider==='youtube')return {ok:true,item:KickRefinedSocialData.youtube(`<meta property="og:url" content="${item.href}"><meta property="og:title" content="Creator Music - YouTube"><script>var ytInitialData = ${JSON.stringify({contents:{items:['dQw4w9WgXcQ','abcdefghijk','12345678901','ZYXWVUTSRQP'].map((id,i)=>({videoRenderer:{videoId:id,title:{simpleText:`Recent upload ${i+1}`},lengthText:{simpleText:'3:21'},thumbnail:{thumbnails:[{url:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}]}}}))}})};</script>`,item)};
      return {ok:true,item:{...item,author:'Creator Name',description:'Public creator biography. Music, streams and community.',verified:true,avatar:'https://pbs.twimg.com/profile_images/creator/avatar.jpg',banner:'https://pbs.twimg.com/profile_banners/creator/cover.jpg',stats:{followers:19800,following:123,posts:456}}};
    }}}};
  });
  for(const name of ['media-data','social-profile-data','profile','channel-library'])await page.addScriptTag({path:`extension/${name}.js`});
  await page.evaluate(()=>{
    const links=[['Instagram','https://instagram.com/creator.name'],['X','https://x.com/creator'],['Discord','https://discord.gg/community'],['TikTok','https://www.tiktok.com/@creator'],['YouTube','https://www.youtube.com/@CreatorMusic']];
    for(const id of ['single','workspace']){
      const root=document.getElementById(id).attachShadow({mode:'open'}),style=document.createElement('link');style.rel='stylesheet';style.href='https://kick.com/ui.css';
      // Keep the fixture's local styles; no provider documents are embedded.
      const library=KickRefinedChannelLibrary.create();library.update({slug:'creator',tab:'about',integrated:true},[]);root.append(library.host);
      const socials=document.createElement('div');socials.className='profile-socials';
      for(const [label,href]of links){const anchor=document.createElement('a');anchor.href=href;anchor.textContent=label;anchor.target='_blank';anchor.rel='noopener noreferrer';socials.append(anchor);}
      root.append(socials);KickRefinedProfile.decorateSocials(socials);KickRefinedProfile.decorateSocials(socials);
    }
  });
  // Apply the actual social button CSS to both shadow roots.
  const css=await (await import('node:fs/promises')).readFile('extension/ui.css','utf8');
  await page.evaluate(css=>{for(const id of ['single','workspace']){const style=document.createElement('style');style.textContent=css;document.getElementById(id).shadowRoot.prepend(style);}},css);
  assert.equal(await page.evaluate(()=>profileRequests.length),0,'profile arrival never requests social previews');
  const popup=page.locator('#kr-social-preview');
  for(const id of ['single','workspace']){
    const surface=page.locator('#'+id);
    assert.deepEqual(await surface.locator('.nav a').allTextContents(),['About','Schedule','Overview','Videos','Clips']);
    const tabs=await surface.locator('.nav a').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().left));assert.ok(tabs[2]>tabs[1],'media tabs sit on the opposite side of About/Schedule');
    assert.deepEqual(await surface.locator('.profile-social-link').allTextContents(),['@creator.name','@creator','discord.gg/community','@creator','@CreatorMusic']);
    assert.equal(await surface.locator('.profile-social-link > svg').count(),5,'decorating twice never duplicates logos');
    await surface.locator('[data-social-platform="X"]').hover();
    await popup.getByText('Creator Name',{exact:true}).waitFor();
    assert.deepEqual(await popup.locator('.stat strong').allTextContents(),['19.8K','123','456']);
    assert.equal(await popup.locator('.avatar img').count(),1);assert.equal(await popup.locator('.cover img').count(),1);assert.equal(await popup.locator('.verified').count(),1);
    assert.equal(await popup.getByRole('link',{name:'View full X profile'}).getAttribute('href'),'https://x.com/creator');
    await popup.locator('.card').hover();assert.equal(await popup.isVisible(),true,'hover card remains usable when the pointer enters it');
    await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
    const instagram=surface.locator('[data-social-platform="Instagram"]');await instagram.focus();await popup.getByText('Creator Photos',{exact:true}).waitFor();
    assert.equal(await popup.locator('.gallery a').count(),6,'Instagram shows the actual public post grid');assert.deepEqual(await popup.locator('.stat strong').allTextContents(),['250K','120','85']);
    assert.ok(await popup.locator('.cover').evaluate(node=>node.getBoundingClientRect().height<=42),'profiles without a banner have a compact heading');
    await page.keyboard.press('ArrowDown');assert.equal(await popup.getByRole('link',{name:'View full Instagram profile'}).evaluate(node=>node.getRootNode().activeElement===node),true,'keyboard users can enter the preview');
    await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
  }
  assert.equal(await page.evaluate(()=>profileRequests.length),2,'cached profile data is reused across workspace and channel hovers');
  await page.mouse.move(1,1);await page.locator('#single [data-social-platform="Discord"]').hover();await popup.getByText('Creator Community',{exact:true}).waitFor();
  assert.deepEqual(await popup.locator('.stat small').allTextContents(),['members','online']);assert.equal(await popup.locator('.cover img').count(),1);
  await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
  await page.mouse.move(1,1);await page.locator('#single [data-social-platform="YouTube"]').hover();await popup.getByRole('button',{name:'Retry preview'}).waitFor();
  assert.ok((await popup.locator('.status').textContent()).includes('could not be loaded'));await popup.getByRole('button',{name:'Retry preview'}).click();await popup.getByText('Creator Music',{exact:true}).waitFor();
  assert.equal(await popup.locator('.gallery[data-format="landscape"] a').count(),2);assert.equal(await popup.locator('.post-title').first().textContent(),'Recent upload 1');
  await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
  await page.mouse.move(1,1);await page.locator('#single [data-social-platform="TikTok"]').hover();await popup.getByText('Creator TikToks',{exact:true}).waitFor();
  assert.equal(await popup.locator('.gallery[data-format="portrait"] a').count(),2);assert.equal(await popup.locator('.post-play').count(),2);
  await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
  for(const width of [1100,390]){
    await page.setViewportSize({width,height:800});
    await page.mouse.move(1,1);
    await page.locator('#single [data-social-platform="X"]').hover();await popup.getByText('Creator Name',{exact:true}).waitFor();
    assert.equal(await popup.locator('.card').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true,'hover window fits the viewport');
    await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/${engine.name()}-social-profile-${width}.png`});
    await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
    await page.mouse.move(1,1);await page.locator('#single [data-social-platform="Instagram"]').hover();await popup.getByText('Creator Photos',{exact:true}).waitFor();
    assert.equal(await popup.locator('.card').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true);
    await page.screenshot({path:`artifacts/${engine.name()}-instagram-profile-${width}.png`});
    await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
    for(const [platform,name]of [['TikTok','Creator TikToks'],['YouTube','Creator Music']]){
      await page.mouse.move(1,1);await page.locator(`#single [data-social-platform="${platform}"]`).hover();await popup.getByText(name,{exact:true}).waitFor();
      assert.equal(await popup.locator('.card').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true);
      await page.screenshot({path:`artifacts/${engine.name()}-${platform.toLowerCase()}-profile-${width}.png`});await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});
    }
  }
  await page.setViewportSize({width:1100,height:800});
  await page.locator('#single').evaluate(node=>node.style.marginTop='380px');await page.evaluate(()=>window.scrollTo(0,0));
  await page.mouse.move(1,1);const source=page.locator('#single [data-social-platform="X"]'),sourceBox=await source.boundingBox();
  await source.hover({position:{x:12,y:12}});await popup.getByText('Creator Name',{exact:true}).waitFor();
  assert.equal(await popup.getAttribute('data-placement'),'above','profile tooltip prefers the space above the cursor');
  const tooltipBox=await popup.locator('.card').boundingBox();assert.ok(tooltipBox.y+tooltipBox.height<=sourceBox.y+12-8,'the tooltip sits above the pointer');assert.ok(tooltipBox.width<=320,'social hovers use compact terminal-style widths');
  await page.screenshot({path:`artifacts/${engine.name()}-profile-above-pointer.png`});
  await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});await page.locator('#single').evaluate(node=>node.style.marginTop='');await page.evaluate(()=>window.scrollTo(0,0));
  await page.mouse.move(1,1);await page.locator('#workspace [data-social-platform="X"]').hover();await popup.waitFor();
  await page.locator('#workspace').evaluate(node=>node.remove());await popup.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log(`${engine.name()}: swapped profile tab groups, account handles, colored logos, cached public profile previews, keyboard access, responsive hover cards and cleanup passed`);
}finally{await browser.close();}
