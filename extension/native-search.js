/* Reversible native input registration. One shared search panel owns the results. */
(() => {
  function create({onOpen,onInput,onKeydown,onDetach}){
    const scope=KickRefinedLifetime.create(),inputs=new Map();let active=null,enabled=false,query=null;
    const attributes=['data-kr-native-search','autocomplete','aria-expanded','aria-haspopup'];
    function restore(input){const saved=inputs.get(input);if(!saved)return;for(const [name,value]of saved)if(value===null)input.removeAttribute(name);else input.setAttribute(name,value);inputs.delete(input);}
    function refresh(nextEnabled){
      enabled=nextEnabled;
      for(const input of inputs.keys())if(!enabled||!input.isConnected)restore(input);
      if(active&&(!enabled||!active.isConnected||!active.getClientRects().length)){active=null;onDetach();}
      if(!enabled){query=null;return;}
      for(const input of document.querySelectorAll('input[data-testid="search"],nav input[type="search"],nav input[aria-label*="Search"]')){
        if(inputs.has(input)){if(query!==null&&input.value!==query)input.value=query;continue;}inputs.set(input,new Map(attributes.map(name=>[name,input.getAttribute(name)])));
        input.setAttribute('data-kr-native-search','');input.setAttribute('autocomplete','off');input.setAttribute('aria-haspopup','dialog');input.setAttribute('aria-expanded','false');
        if(query!==null)input.value=query;
      }
    }
    scope.listen(document,'kick-refined-native-search-focusin',event=>{if(enabled&&inputs.has(event.target)){active=event.target;onOpen(active);}});
    scope.listen(document,'kick-refined-native-search-input',event=>{if(enabled&&inputs.has(event.target)){active=event.target;onInput(active);}});
    scope.listen(document,'kick-refined-native-search-keydown',event=>{if(enabled&&inputs.has(event.target)){active=event.target;onKeydown(event,active);}});
    scope.defer(()=>{for(const input of inputs.keys())restore(input);active=null;});
    return {refresh,get input(){return active;},expanded(value){for(const input of inputs.keys())input.setAttribute('aria-expanded',String(value&&input===active));},sync(value){query=value;for(const input of inputs.keys())if(input.value!==value)input.value=value;},destroy:()=>scope.dispose()};
  }
  globalThis.KickRefinedNativeSearch=Object.freeze({create});
})();
