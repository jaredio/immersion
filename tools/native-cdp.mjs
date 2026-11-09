/* Minimal isolated Chromium driver for genuine visibility tests.
 * Playwright intentionally emulates focused pages on its own sessions. */
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

export async function nativeChromium({extension,profile}){
  await mkdir(profile,{recursive:true});
  const args=['--disable-background-networking','--disable-component-update','--disable-default-apps','--mute-audio','--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--autoplay-policy=no-user-gesture-required',`--user-data-dir=${profile}`];
  if(extension)args.push(`--disable-extensions-except=${extension}`,`--load-extension=${extension}`);
  const child=spawn(chromium.executablePath(),args,{windowsHide:true,stdio:'ignore'});
  let ws;
  try{
    let endpoint;
    for(let i=0;i<200;i++){
      try{const [port,suffix]=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');endpoint=`ws://127.0.0.1:${port}${suffix}`;break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    if(!endpoint)throw Error('Native Chromium did not start');
    ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    let sequence=0;const pending=new Map(),listeners=new Map(),errors=[];
    ws.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.id){const job=pending.get(message.id);if(!job)return;pending.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(JSON.stringify(message.error))):job.resolve(message.result);}
      else for(const listener of listeners.get(message.method)||[])Promise.resolve().then(()=>listener(message.params,message.sessionId)).catch(error=>errors.push(error));
    });
    ws.addEventListener('close',()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Native CDP closed'));}pending.clear();});
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
      const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timed out: ${method}`));},15000);
      pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
    return {send,errors,on(method,listener){if(!listeners.has(method))listeners.set(method,new Set());listeners.get(method).add(listener);return()=>listeners.get(method)?.delete(listener);},
      async close(){try{await send('Browser.close');}catch{}ws.close();if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
    };
  }catch(error){ws?.close();child.kill();throw error;}
}
