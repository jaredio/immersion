/* Stable session identity and serialized mutations; shared by worker and fixtures. */
(() => {
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,384}$/.test(id);
  function normalize(input){
    const found=new Map();
    for(const raw of Array.isArray(input)?input:[]){
      if(!raw||typeof raw.name!=='string')continue;
      const name=raw.name.slice(0,48);if(!name.trim())continue;
      const id=validId(raw.id)?raw.id:'legacy-'+[...name].map(char=>char.codePointAt(0).toString(16)).join('-');
      if(!found.has(id))found.set(id,{id,name,state:KickRefined.multiState(raw.state)});
      if(found.size===10)break;
    }
    return [...found.values()];
  }
  function createRepository(storage){
    let queue=Promise.resolve();
    function mutate(operation){
      const job=queue.then(async()=>{
        let sessions=normalize((await storage.get('multiSessions')).multiSessions);
        if(operation.action==='upsert'){
          const value=operation.session;
          if(!validId(value?.id)||typeof value.name!=='string'||!value.name.trim()||value.name.length>48)throw Error('Invalid session');
          const index=sessions.findIndex(item=>item.id===value.id||item.name===value.name);
          const session={id:index>=0?sessions[index].id:value.id,name:value.name,state:KickRefined.multiState(value.state)};
          if(index>=0)sessions[index]=session;else sessions=[session,...sessions].slice(0,10);
        }else if(operation.action==='delete'){
          if(!validId(operation.id))throw Error('Invalid session');
          sessions=sessions.filter(item=>item.id!==operation.id);
        }else throw Error('Unknown session operation');
        await storage.set({multiSessions:sessions});return sessions;
      });
      queue=job.catch(()=>{});return job;
    }
    return {mutate};
  }
  globalThis.KickRefinedSessionData=Object.freeze({normalize,createRepository});
})();
