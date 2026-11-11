/* MAIN world: defer DOM enhancements until React owns the requested surface. */
(() => {
  const eventName='kick-refined:surface-ready';
  let nextPage=false;
  function isNextPage(){
    nextPage=nextPage||Array.isArray(window.__next_f)||!!document.querySelector('script[src*="/_next/"]');
    return nextPage;
  }
  document.addEventListener(eventName,event=>{
    if(!isNextPage())return;
    const node=event.target;
    if(!(node instanceof Element)||!Object.keys(node).some(key=>key.startsWith('__reactFiber$')))event.preventDefault();
  },true);
})();
