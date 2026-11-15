/* The serviceworker event can precede Chrome API binding and importScripts. */
export async function extensionWorker(context,{timeout=10000,pollMs=50}={}){
  const matches=worker=>worker.url().startsWith('chrome-extension://');
  const worker=context.serviceWorkers().find(matches)||await context.waitForEvent('serviceworker',{predicate:matches,timeout});
  const deadline=Date.now()+timeout;
  while(true){
    if(await worker.evaluate(()=>!!globalThis.chrome?.storage?.local&&!!globalThis.KickRefinedPreviewQueue))return worker;
    const remaining=deadline-Date.now();if(remaining<=0)throw Error('Extension worker APIs and scripts did not initialize');
    await new Promise(resolve=>setTimeout(resolve,Math.min(pollMs,remaining)));
  }
}
