import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context=vm.createContext({URL});
vm.runInContext(await readFile('extension/profile.js','utf8'),context);
const {socialIdentity}=context.KickRefinedProfile;

test('social labels use account handles and preserve platform identity',()=>{
  for(const [href,label,display]of [
    ['https://www.instagram.com/creator.name/','Instagram','@creator.name'],
    ['https://twitter.com/Creator_1','X','@Creator_1'],
    ['https://www.tiktok.com/@creator.name','TikTok','@creator.name'],
    ['https://www.youtube.com/@Creator','YouTube','@Creator'],
    ['https://www.youtube.com/c/Creator','YouTube','@Creator'],
    ['https://www.twitch.tv/creator','Twitch','@creator'],
    ['https://discord.gg/myserver','Discord','discord.gg/myserver'],
    ['https://discord.com/invite/myserver','Discord','discord.gg/myserver'],
    ['https://www.facebook.com/creator','Facebook','@creator']
  ]){const result=socialIdentity(href);assert.equal(result.label,label);assert.equal(result.display,display);assert.ok(result.color);assert.ok(result.path);}
});

test('social labels do not invent usernames for generic routes or accept lookalike hosts',()=>{
  for(const href of ['https://instagram.com/p/post','https://x.com/intent/follow','https://youtube.com/watch?v=123','https://facebook.com/profile.php?id=123'])assert.equal(socialIdentity(href).handle,'');
  for(const href of ['javascript:alert(1)','http://instagram.com/creator','https://instagram.com.evil.test/creator','https://user:pass@x.com/creator','https://x.com:444/creator'])assert.equal(socialIdentity(href),null);
});
