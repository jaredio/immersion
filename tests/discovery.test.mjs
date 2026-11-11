import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('discovery routes cover browsing without taking over players, profiles, chat or account pages',async()=>{
  const context=vm.createContext({location:{pathname:'/'}});vm.runInContext(await readFile('extension/discovery.js','utf8'),context);
  const {route}=context.KickRefinedDiscovery;
  for(const [path,mode]of [['/','home'],['/browse/','live'],['/browse/categories','categories'],['/browse/clips','clips'],['/following','following'],['/following/videos','following'],['/category/just-chatting','category'],['/category/just-chatting/clips','category']])assert.equal(route(path),mode);
  for(const path of ['/nickwhite','/nickwhite/videos','/nickwhite/videos/uuid','/popout/nickwhite/chat','/settings','/browse/unknown','/category/irl/unknown'])assert.equal(route(path),null);
});
