/* Optional audit instrumentation. No image artifacts; collect Chromium execution coverage. */
import playwright from 'playwright';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';

const sourceDirectory=new URL('../extension/',import.meta.url),sources=new Map(),coverage=new Map(),contexts=new WeakSet(),pages=new WeakMap();
for(const file of readdirSync(sourceDirectory))if(file.endsWith('.js'))sources.set(readFileSync(new URL(file,sourceDirectory),'utf8'),file);
function collect(entries){
  for(const entry of entries){
    const source=entry.source?.replace(/\n\/\/[#@] sourceURL=[^\r\n]*\s*$/,'');
    const text=sources.has(entry.source)?entry.source:source,file=sources.get(text);
    if(!file)continue;
    const executed=new Uint8Array(text.length);
    // Inner function and branch ranges override their enclosing execution count.
    const ranges=entry.functions.flatMap(fn=>fn.ranges).sort((a,b)=>a.startOffset-b.startOffset||b.endOffset-a.endOffset);
    for(const {startOffset,endOffset,count}of ranges)executed.fill(Number(count>0),startOffset,endOffset);
    const previous=coverage.get(file);
    if(previous){for(let index=0;index<executed.length;index++)previous[index]|=executed[index];}
    else coverage.set(file,executed);
  }
}
async function attach(page){
  if(pages.has(page))return pages.get(page).ready;
  const state={ready:null,finish:null};pages.set(page,state);
  state.ready=(async()=>{
    if(process.env.KR_AUDIT_SCREENSHOTS!=='1'){
      page.screenshot=async()=>Buffer.alloc(0);
      Object.getPrototypeOf(page.locator('html')).screenshot=async()=>Buffer.alloc(0);
    }
    if(process.env.KR_ENGINE==='chromium'&&process.env.KR_AUDIT_COVERAGE){
      await page.coverage.startJSCoverage({resetOnNavigation:false,reportAnonymousScripts:true});
      state.finish=async()=>{if(!state.finish)return;state.finish=null;try{collect(await page.coverage.stopJSCoverage());}catch(error){console.warn('Could not collect page coverage:',error.message);}};
      const close=page.close.bind(page);page.close=async(...args)=>{await state.finish?.();return close(...args);};
    }
  })();
  return state.ready;
}
function wrapContext(context){
  if(contexts.has(context))return context;contexts.add(context);
  const newPage=context.newPage.bind(context),close=context.close.bind(context);
  context.newPage=async(...args)=>{const page=await newPage(...args);await attach(page);return page;};
  context.on('page',page=>{void attach(page).catch(()=>{});});
  for(const page of context.pages())void attach(page).catch(()=>{});
  context.close=async(...args)=>{for(const page of context.pages()){await pages.get(page)?.ready;await pages.get(page)?.finish?.();}return close(...args);};
  return context;
}
for(const engine of ['chromium','firefox']){
  const type=playwright[engine],launch=type.launch.bind(type),persistent=type.launchPersistentContext.bind(type);
  type.launchPersistentContext=async(...args)=>wrapContext(await persistent(...args));
  type.launch=async(...args)=>{
    const browser=await launch(...args),newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser),close=browser.close.bind(browser);
    browser.newContext=async(...values)=>wrapContext(await newContext(...values));
    browser.newPage=async(...values)=>{const page=await newPage(...values);wrapContext(page.context());await attach(page);return page;};
    browser.close=async(...values)=>{for(const context of browser.contexts())for(const page of context.pages()){await pages.get(page)?.ready;await pages.get(page)?.finish?.();}return close(...values);};
    return browser;
  };
}
process.on('exit',()=>{
  if(!process.env.KR_AUDIT_COVERAGE)return;
  const result={};for(const [file,flags]of coverage){
    const ranges=[];let start=-1;for(let index=0;index<=flags.length;index++){if(flags[index]&&start<0)start=index;else if(!flags[index]&&start>=0){ranges.push([start,index]);start=-1;}}
    result[file]={length:flags.length,ranges};
  }
  writeFileSync(process.env.KR_AUDIT_COVERAGE,JSON.stringify(result));
});
