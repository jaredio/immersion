/* Bounded clip-window gestures. Resizing never reparents or reloads its iframe. */
(() => {
  function create({dialog,handle}){
    const abort=new AbortController(),signal=abort.signal;let gesture=null,custom=false;
    const limits=()=>({left:8,top:8,right:innerWidth-8,bottom:innerHeight-8,minWidth:Math.min(560,innerWidth-16),minHeight:Math.min(540,innerHeight-16)});
    function apply(rect){
      const limit=limits(),width=Math.max(0,Math.min(innerWidth-16,Math.max(limit.minWidth,rect.width))),height=Math.max(0,Math.min(innerHeight-16,Math.max(limit.minHeight,rect.height)));
      const left=Math.max(8,Math.min(rect.left,innerWidth-width-8)),top=Math.max(8,Math.min(rect.top,innerHeight-height-8));
      Object.assign(dialog.style,{position:'fixed',inset:'auto',margin:'0',width:width+'px',height:height+'px',left:left+'px',top:top+'px'});custom=true;
    }
    function finish(){if(!gesture)return;const previous=gesture;gesture=null;delete dialog.dataset.resizing;try{if(previous.target.hasPointerCapture(previous.id))previous.target.releasePointerCapture(previous.id);}catch{}}
    function start(event,edge){
      if(event.button!==0||edge==='move'&&event.target.closest('button,input,select,a'))return;
      event.preventDefault();finish();gesture={edge,id:event.pointerId,x:event.clientX,y:event.clientY,rect:dialog.getBoundingClientRect(),target:event.currentTarget};
      dialog.dataset.resizing='true';try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}
    }
    function move(event){
      if(!gesture||gesture.id!==event.pointerId)return;const {edge,rect,x,y}=gesture,dx=event.clientX-x,dy=event.clientY-y,limit=limits();
      if(edge==='move'){apply({left:rect.left+dx,top:rect.top+dy,width:rect.width,height:rect.height});return;}
      let left=rect.left,right=rect.right,top=rect.top,bottom=rect.bottom;
      if(edge.includes('w'))left=Math.max(limit.left,Math.min(right-limit.minWidth,left+dx));
      if(edge.includes('e'))right=Math.min(limit.right,Math.max(left+limit.minWidth,right+dx));
      if(edge.includes('n'))top=Math.max(limit.top,Math.min(bottom-limit.minHeight,top+dy));
      if(edge.includes('s'))bottom=Math.min(limit.bottom,Math.max(top+limit.minHeight,bottom+dy));
      apply({left,top,width:right-left,height:bottom-top});
    }
    function bind(node,edge){node.addEventListener('pointerdown',event=>start(event,edge),{signal});node.addEventListener('pointermove',move,{signal});for(const type of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(type,finish,{signal});}
    const sheet=document.createElement('style');sheet.textContent=`
      .bar{cursor:grab;touch-action:none}.bar:active{cursor:grabbing}.studio-resize{position:absolute;z-index:100;touch-action:none;user-select:none}.studio-resize[data-edge=n],.studio-resize[data-edge=s]{height:7px;left:18px;right:18px;cursor:ns-resize}.studio-resize[data-edge=n]{top:0}.studio-resize[data-edge=s]{bottom:0}.studio-resize[data-edge=e],.studio-resize[data-edge=w]{width:7px;top:18px;bottom:18px;cursor:ew-resize}.studio-resize[data-edge=e]{right:0}.studio-resize[data-edge=w]{left:0}.studio-resize[data-edge=nw],.studio-resize[data-edge=ne],.studio-resize[data-edge=sw],.studio-resize[data-edge=se]{width:18px;height:18px}.studio-resize[data-edge=nw]{left:0;top:0;cursor:nwse-resize}.studio-resize[data-edge=ne]{right:0;top:0;cursor:nesw-resize}.studio-resize[data-edge=sw]{left:0;bottom:0;cursor:nesw-resize}.studio-resize[data-edge=se]{right:0;bottom:0;cursor:nwse-resize;border:0;background:transparent;padding:0}.studio-resize[data-edge=se]:after{content:'';position:absolute;right:4px;bottom:4px;width:10px;height:10px;background:repeating-linear-gradient(135deg,transparent 0 3px,#9393a7 3px 4px,transparent 4px 6px);clip-path:polygon(100% 0,100% 100%,0 100%)}dialog[data-resizing=true]{user-select:none}dialog[data-resizing=true] iframe{pointer-events:none}.bar:focus-visible{outline:2px solid var(--studio-accent);outline-offset:-3px}
    `;dialog.before(sheet);
    const handles=[];for(const edge of ['n','ne','e','se','s','sw','w','nw']){
      const node=document.createElement(edge==='se'?'button':'div');node.className='studio-resize';node.dataset.edge=edge;
      if(edge==='se'){node.type='button';node.setAttribute('aria-label','Resize clip studio');node.title='Drag to resize; arrow keys adjust; double-click resets';}
      else node.setAttribute('aria-hidden','true');
      dialog.append(node);handles.push(node);bind(node,edge);
    }
    const corner=handles.find(node=>node.dataset.edge==='se');bind(handle,'move');handle.tabIndex=0;handle.setAttribute('aria-label','Move clip studio');
    function open(){
      if(custom){apply(dialog.getBoundingClientRect());return;}
      const width=Math.min(960,innerWidth-24),height=Math.min(980,innerHeight-24);
      apply({left:(innerWidth-width)/2,top:(innerHeight-height)/2,width,height});
    }
    function reset(){finish();custom=false;open();}
    handle.addEventListener('dblclick',event=>{if(!event.target.closest('button,input,select,a'))reset();},{signal});corner.addEventListener('dblclick',reset,{signal});
    for(const [node,kind]of [[handle,'move'],[corner,'resize']])node.addEventListener('keydown',event=>{
      if(event.target!==node||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const rect=dialog.getBoundingClientRect(),step=event.shiftKey?40:10,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
      apply({left:rect.left+(kind==='move'?dx:0),top:rect.top+(kind==='move'?dy:0),width:rect.width+(kind==='resize'?dx:0),height:rect.height+(kind==='resize'?dy:0)});
    },{signal});
    window.addEventListener('resize',()=>{finish();if(custom&&dialog.open)apply(dialog.getBoundingClientRect());},{signal});window.addEventListener('blur',finish,{signal});dialog.addEventListener('close',finish,{signal});
    return {open,finish,reset,destroy(){finish();abort.abort();sheet.remove();for(const node of handles)node.remove();handle.removeAttribute('tabindex');handle.removeAttribute('aria-label');}};
  }
  globalThis.KickRefinedClipWindow=Object.freeze({create});
})();
