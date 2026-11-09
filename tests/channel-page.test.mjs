import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('channel styling follows profile tabs without taking over individual recordings or global pages',async()=>{
 const context=vm.createContext({URL,location:{origin:'https://kick.com',pathname:'/nickwhite'}});
 for(const file of ['shared.js','channel-page.js'])vm.runInContext(await readFile(`extension/${file}`,'utf8'),context);
 for(const path of ['/nickwhite','/nickwhite/about','/nickwhite/videos','/nickwhite/clips','/nickwhite/schedule/'])assert.equal(context.KickRefinedChannelPage.routeSlug(path),'nickwhite');
 for(const path of ['/browse','/videos','/nickwhite/videos/uuid','/nickwhite/clips/id','/popout/nickwhite/chat'])assert.equal(context.KickRefinedChannelPage.routeSlug(path),null);
});
