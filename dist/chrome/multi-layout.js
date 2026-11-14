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
    function restoreStyles() {
      for (const [element, properties] of restored) for (const [property, original] of properties) {
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
      }
      restored.clear();
    }
    return {style, restoreStyles, originalStyle: (element, property) => restored.get(element)?.get(property)};
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
    const mainWidth=width*focusSize/100-gap/2,sideWidth=Math.round((width-mainWidth-gap)*1000)/1000;
    const heightAt=(box,target)=>Math.ceil(box.height-box.playerHeight+(target-box.width+box.playerWidth)*box.playerHeight/box.playerWidth);
    const mainHeight=heightAt(featured,mainWidth),heights=rail.map(box=>heightAt(box,sideWidth));
    let count=0,used=0;
    // Fill to the featured bottom before wrapping, allowing the last side pane
    // to extend past it rather than leaving a nearly pane-sized empty slot.
    while(count<heights.length&&(count===0||used+gap<mainHeight-.5)){
      used+=(count?gap:0)+heights[count++];
    }
    const columns=Math.max(1,Math.min(4,Math.round(mainWidth/sideWidth)));
    const rows=heights.slice(0,count);
    rows[count-1]=Math.max(rows[count-1],mainHeight-rows.slice(0,-1).reduce((sum,height)=>sum+height+gap,0));
    return {columns,mainHeight,templateColumns:`repeat(${columns},minmax(0,1fr)) ${sideWidth}px`,
      templateRows:rows.map(height=>`${height}px`).join(' '),
      featured:{column:`1 / span ${columns}`,row:`1 / span ${count}`},
      rail:rail.map((_,index)=>index<count?{column:String(columns+1),row:String(index+1)}:
        {column:String((index-count)%(columns+1)+1),row:String(count+1+Math.floor((index-count)/(columns+1)))})};
  }
  globalThis.KickRefinedMultiLayout=Object.freeze({findContext,createStyles,createScheduler,focusPlan});
})();
