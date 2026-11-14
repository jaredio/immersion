/* Native layout ownership: discover surfaces, restore styles and batch frames. */
(() => {
  const {channelSlug}=KickRefined;
    function findContext() {
      const slug=globalThis.KickRefinedChannelPage?.routeSlug()||channelSlug(location.pathname,location.origin);
      const anchor=slug && [...document.querySelectorAll('#video-player,#injected-channel-player')].find(el=>el.closest('main') && !el.closest('#clip-creator-dialog,[role="dialog"]') && el.getBoundingClientRect().width>0);
      const main=anchor?.closest('main') || [...document.querySelectorAll('main')].find(el=>el.getBoundingClientRect().width>0);
      if(!main) return null;
      let player=anchor||null;
      while(player && player.parentElement!==main) player=player.parentElement;
      const chat=slug && [...document.querySelectorAll('#channel-chatroom')].find(el=>el.getBoundingClientRect().width>40);
      let branch=chat||null;
      if(chat) {
        let common=main.parentElement; while(common && !common.contains(chat)) common=common.parentElement;
        if(common) while(branch.parentElement!==common) branch=branch.parentElement;
      }
      return {slug,path:location.pathname,main,player,chat,branch};
    }

  function createStyles() {
    const restored = new Map();
    function style(element, property, value) {
      if (!element) return;
      let properties = restored.get(element);
      if (!properties) { properties = new Map(); restored.set(element, properties); }
      if (!properties.has(property)) properties.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      });
      if (value === '') element.style.removeProperty(property);
      else if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== 'important') {
        element.style.setProperty(property, value, 'important');
      }
    }
    function restoreElement(element,properties) {
      for (const [property, original] of properties) {
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
      }
      restored.delete(element);
    }
    function pruneStyles(){for(const [element,properties]of restored)if(element.isConnected===false)restoreElement(element,properties);}
    function restoreStyles() {
      for(const [element,properties]of restored)restoreElement(element,properties);
      restored.clear();
    }
    return {style,restoreStyles,pruneStyles,originalStyle:(element,property)=>restored.get(element)?.get(property),snapshot:()=>({elements:restored.size,detached:[...restored.keys()].filter(element=>element.isConnected===false).length})};
  }
  function createScheduler({isActive,run}){
    let frame=0,disposed=false;
    function cancel(){cancelAnimationFrame(frame);frame=0;}
    return {
      schedule(){
        if(disposed||!isActive()||frame)return;
        frame=requestAnimationFrame(()=>{frame=0;if(!disposed&&isActive()){const start=globalThis.KickRefinedPerf?.enabled?performance.now():null;try{run();}finally{if(start!==null)globalThis.KickRefinedPerf.sample('layout.ms',performance.now()-start);}}});
      },
      cancel,
      destroy(){disposed=true;cancel();}
    };
  }
  function focusPlan({width,focusSize,gap,featured,rail}) {
    if(!rail.length)return null;
    const split=focusSize/100,mainWidth=width*split-gap/2,sideWidth=width-mainWidth-gap;
    const heightAt=(box,target)=>Math.ceil(box.chromeHeight+(target-box.borderWidth)/box.aspectRatio);
    const mainHeight=heightAt(featured,mainWidth);
    let count=1,used=0,best=Infinity;
    for(let i=0;i<Math.min(4,rail.length);i++){
      used+=(i?gap:0)+heightAt(rail[i],sideWidth);
      const distance=Math.abs(used-mainHeight);
      if(distance<best){best=distance;count=i+1;}
    }
    // A modest fit adjustment can keep the last stream in the side column.
    if(rail.length<=4&&rail.length-count===1&&used<=mainHeight*1.25)count++;
    // Avoid a single small overflow card when two balanced cards fit below.
    if(rail.length>=4&&rail.length-count===1&&count>1)count--;
    const rowHeight=(mainHeight-gap*(count-1))/count,overflow=rail.length-count;
    const capacity=Math.max(2,Math.min(4,Math.round(width/320))),rowCount=Math.ceil(overflow/capacity);
    const groups=[];let start=count;
    for(let row=0;row<rowCount;row++){const size=Math.floor(overflow/rowCount)+(row<overflow%rowCount?1:0);groups.push({start,size});start+=size;}
    // Shared column boundaries let overflow rows divide the entire width evenly
    // while keeping the user's featured split exact and iframe nodes in place.
    const boundaries=[0,split,1];
    for(const {size}of groups)for(let i=1;i<size;i++)if(boundaries.every(value=>Math.abs(value-i/size)*width>gap+1))boundaries.push(i/size);
    boundaries.sort((a,b)=>a-b);
    const line=value=>1+boundaries.reduce((best,current,index)=>Math.abs(current-value)<Math.abs(boundaries[best]-value)?index:best,0);
    const columns=boundaries.slice(1).map((end,index)=>(end-boundaries[index])*width-gap*((index===0||index===boundaries.length-2)?0.5:1));
    const positions=rail.map((_,index)=>index<count?{column:`${line(split)} / -1`,row:String(index+1),height:rowHeight}:null);
    for(const [row,{start,size}]of groups.entries())for(let i=0;i<size;i++)positions[start+i]={column:size===1?`1 / ${line(split)}`:`${line(i/size)} / ${line((i+1)/size)}`,row:String(count+row+1)};
    return {mainHeight,sideCount:count,templateColumns:columns.map(value=>`${value}px`).join(' '),
      templateRows:Array(count).fill(`${rowHeight}px`).join(' '),
      featured:{column:`1 / ${line(split)}`,row:`1 / span ${count}`},rail:positions};
  }
  globalThis.KickRefinedMultiLayout=Object.freeze({findContext,createStyles,createScheduler,focusPlan});
})();
