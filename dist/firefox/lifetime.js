/* Resource ownership without retaining disposed scopes in a global registry. */
(() => {
  let scopes=0,resources=0;
  function create() {
    let disposed=false;const cleanups=new Set();scopes++;
    function defer(cleanup) {
      if(disposed){cleanup();return ()=>{};}
      resources++;let pending=true;
      const release=()=>{if(!pending)return;pending=false;cleanups.delete(release);resources--;cleanup();};
      cleanups.add(release);return release;
    }
    const guard=callback=>(...args)=>{if(!disposed)return callback(...args);};
    function dispose(){
      if(disposed)return;disposed=true;scopes--;const errors=[];
      for(const release of [...cleanups].reverse())try{release();}catch(error){errors.push(error);}
      if(errors.length)throw new AggregateError(errors,'Resource cleanup failed');
    }
    return {
      get disposed(){return disposed;},defer,guard,dispose,
      listen(target,type,callback,options){const handler=guard(callback);target.addEventListener(type,handler,options);return defer(()=>target.removeEventListener(type,handler,options));},
      timeout(callback,ms){let release;const id=setTimeout(()=>{release();if(!disposed)callback();},ms);release=defer(()=>clearTimeout(id));return release;},
      frame(callback){let release;const id=requestAnimationFrame(time=>{release();if(!disposed)callback(time);});release=defer(()=>cancelAnimationFrame(id));return release;},
      child(){const child=create();const release=defer(()=>child.dispose());child.defer(()=>release());return child;}
    };
  }
  globalThis.KickRefinedLifetime=Object.freeze({create,snapshot:()=>({scopes,resources})});
})();
