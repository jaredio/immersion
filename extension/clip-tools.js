/* Clip ranges are applied through Kick's cropper gestures, never React internals. */
(() => {
  const MIN=10,MAX=180;
  function range(start,end,total){
    total=Number(total);if(!Number.isFinite(total)||total<MIN)return null;
    start=Number(start);end=Number(end);if(!Number.isFinite(start)||!Number.isFinite(end))return null;
    start=Math.max(0,Math.min(total-MIN,start));end=Math.max(start+MIN,Math.min(total,start+MAX,end));
    return {start,end,total,duration:end-start};
  }
  function format(value){value=Math.max(0,Math.round(Number(value)||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
  function read(dialog){
    const middle=dialog.querySelector('[data-testid="clip-cropper-range"]'),selection=middle?.parentElement,track=selection?.parentElement;
    if(!track)return null;
    const values=[...(track.nextElementSibling?.textContent||'').matchAll(/(\d+(?:\.\d+)?)\s*s/g)].map(match=>Number(match[1]));
    const total=values[1],box=track.getBoundingClientRect(),selected=selection.getBoundingClientRect();
    if(!Number.isFinite(total)||total<MIN||!box.width||!selected.width)return null;
    // Kick stores the cropper's geometry inline. Reading that coordinate space
    // avoids counting our timeline border as footage (and subsecond trim drift).
    const position=value=>/^[-\d.]+%$/.test(value)?parseFloat(value)/100*total:/^[-\d.]+px$/.test(value)?parseFloat(value)/box.width*total:null;
    const inlineStart=position(selection.style.left),inlineDuration=position(selection.style.width);
    const start=Math.max(0,inlineStart??(selected.left-box.left)/box.width*total),end=Math.min(total,start+(inlineDuration??selected.width/box.width*total));
    return {...range(start,end,total),track,middle};
  }
  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  async function drag(dialog,part,delta){
    if(Math.abs(delta)<.035)return;
    const current=read(dialog),handle=dialog.querySelector(`[data-testid="clip-cropper-${part}"]`);if(!current||!handle)throw Error('The clip timeline is not ready.');
    const box=handle.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2;
    const event=(type,clientX)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:817,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX,clientY:y});
    handle.dispatchEvent(event('pointerdown',x));
    try{await paint();if(!dialog.isConnected)throw Error('The clip editor was closed.');window.dispatchEvent(event('pointermove',x+delta/current.total*current.track.getBoundingClientRect().width));await paint();}
    finally{window.dispatchEvent(event('pointerup',x));}
  }
  async function apply(dialog,requested){
    const current=read(dialog);if(!current)throw Error('Wait for the clip timeline to load.');
    const wanted=range(requested.start,requested.end,current.total);if(!wanted)throw Error('Enter a valid clip range.');
    await drag(dialog,'range',Math.min(wanted.start,current.total-current.duration)-current.start);
    let next=read(dialog);if(!next)throw Error('The clip timeline changed.');
    await drag(dialog,'end',wanted.end-next.end);
    next=read(dialog);if(!next)throw Error('The clip timeline changed.');
    await drag(dialog,'start',wanted.start-next.start);
    next=read(dialog);if(!next)throw Error('The clip timeline changed.');
    await drag(dialog,'end',wanted.end-next.end);
    next=read(dialog);
    if(!next||Math.abs(next.start-wanted.start)>.35||Math.abs(next.end-wanted.end)>.35)throw Error('Kick did not accept that trim. Use the timeline handles, then try again.');
    return next;
  }
  globalThis.KickRefinedClipTools=Object.freeze({MIN,MAX,range,format,read,apply});
})();
