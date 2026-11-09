/* A nonmodal search tool with bounded, tab-local geometry and scoped input. */
(() => {
  function create({dialog,handle,resize,reset}){
    const scope=KickRefinedLifetime.create();let bounds=null,floatingBounds=null,gesture=null,mode='floating',anchor=null,positionFrame=null;
    function clamp(rect){const margin=8,width=Math.min(Math.max(340,rect.width),innerWidth-margin*2),height=Math.min(Math.max(320,rect.height),innerHeight-margin*2);return {width:Math.max(0,width),height:Math.max(0,height),left:Math.max(margin,Math.min(rect.left,innerWidth-width-margin)),top:Math.max(margin,Math.min(rect.top,innerHeight-height-margin))};}
    function apply(rect){bounds=clamp(rect);if(mode==='floating')floatingBounds={...bounds};for(const [key,value]of Object.entries(bounds))if(dialog.style[key]!==`${value}px`)dialog.style[key]=`${value}px`;}
    function positionDock(){
      if(mode!=='docked'||!dialog.open||!anchor?.isConnected)return;
      const rect=(anchor.closest('[data-kr-search-field]')||anchor).getBoundingClientRect(),width=Math.max(0,Math.min(rect.width,innerWidth-16)),below=innerHeight-rect.bottom-16,above=rect.top-16;
      const height=Math.max(0,Math.min(620,Math.max(below,above))),top=below>=Math.min(360,above)?rect.bottom+6:Math.max(8,rect.top-height-6),left=Math.max(8,Math.min(rect.left,innerWidth-width-8));
      for(const [key,value]of Object.entries({left,top,width,height:Math.min(height,innerHeight-top-8)}))if(dialog.style[key]!==`${value}px`)dialog.style[key]=`${value}px`;
    }
    function scheduleDock(){if(mode==='docked'&&!positionFrame)positionFrame=scope.frame(()=>{positionFrame=null;positionDock();});}
    function setMode(value){finish();mode=value;dialog.dataset.searchMode=value;handle.tabIndex=value==='docked'?-1:0;}
    function center(){const width=Math.min(680,innerWidth-24),height=Math.min(680,innerHeight-48);apply({width,height,left:(innerWidth-width)/2,top:Math.min(80,Math.max(12,(innerHeight-height)/3))});}
    function finish(){if(!gesture)return;const {element,id}=gesture;gesture=null;delete dialog.dataset.moving;if(element.hasPointerCapture(id))element.releasePointerCapture(id);}
    function bind(element,kind){
      scope.listen(element,'pointerdown',event=>{if(mode!=='floating'||event.button!==0||event.target.closest('button,input,select'))return;event.preventDefault();finish();gesture={element,id:event.pointerId,x:event.clientX,y:event.clientY,rect:{...bounds},kind};element.setPointerCapture(event.pointerId);dialog.dataset.moving='true';});
      scope.listen(element,'pointermove',event=>{if(!gesture||event.pointerId!==gesture.id)return;const {rect,x,y}=gesture,dx=event.clientX-x,dy=event.clientY-y;apply(gesture.kind==='move'?{...rect,left:rect.left+dx,top:rect.top+dy}:{...rect,width:rect.width+dx,height:rect.height+dy});});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])scope.listen(element,type,finish);
      const keydown=event=>{if(mode!=='floating'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.target!==element)return;event.preventDefault();const step=event.shiftKey?40:10,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;apply(kind==='move'?{...bounds,left:bounds.left+dx,top:bounds.top+dy}:{...bounds,width:bounds.width+dx,height:bounds.height+dy});};
      for(const type of ['keydown','kick-refined-keydown'])scope.listen(element,type,keydown);
    }
    bind(handle,'move');bind(resize,'resize');scope.listen(handle,'dblclick',event=>{if(mode==='floating'&&!event.target.closest('button'))center();});scope.listen(reset,'click',center);
    scope.listen(window,'resize',()=>{finish();if(mode==='docked')positionDock();else if(bounds)apply(bounds);});scope.listen(window,'scroll',scheduleDock,{capture:true,passive:true});scope.listen(window,'blur',finish);scope.listen(dialog,'close',()=>{finish();positionFrame?.();positionFrame=null;});scope.defer(finish);
    return {get mode(){return mode;},open(){setMode('floating');anchor=null;floatingBounds?apply(floatingBounds):center();},dock(input){setMode('docked');anchor=input;positionDock();},refresh:positionDock,destroy:()=>scope.dispose()};
  }
  globalThis.KickRefinedSearchWindow=Object.freeze({create});
})();
