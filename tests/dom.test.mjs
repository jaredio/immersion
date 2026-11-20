import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('extension/dom.js','utf8');
function setup(){
  const observers=[],errors=[];let chat={};
  const context=vm.createContext({performance,Event,queueMicrotask:fn=>{try{fn();}catch(error){errors.push(error);}},document:{getElementById:()=>chat},MutationObserver:class{
    constructor(callback){this.callback=callback;this.pending=[];observers.push(this);}
    observe(target,options){this.target=target;this.options=options;}
    disconnect(){this.target=null;this.pending=[];}
    takeRecords(){const records=this.pending;this.pending=[];return records;}
  }});
  vm.runInContext(source,context);
  return {api:context.KickRefinedDOM,observers,errors,chat:records=>observers[0].callback(records),page:records=>observers[1].callback(records),replace(value){chat=value;}};
}
function row(){
  let scans=0,lookups=0;const anchors=[{}];
  const value={nodeType:1,closest:()=>{lookups++;return value;},querySelectorAll:selector=>{if(selector==='a[href]'){scans++;return [...anchors];}return [];}};
  return {value,anchors,get scans(){return scans;},get lookups(){return lookups;}};
}
const mutation=(target,attributeName)=>({type:attributeName?'attributes':'childList',attributeName,target,addedNodes:[],removedNodes:[]});

test('non-link attributes and text-only edits keep the shared anchor index warm',()=>{
  const s=setup(),r=row(),seen=[];
  s.api.subscribeChat({attributes:['href','src','data-index'],onMutations(records,{rows}){for(const node of rows)seen.push(s.api.links(node));}}).setEnabled(true);
  const initial=s.api.links(r.value);
  for(const attribute of ['src','data-index'])s.chat([mutation(r.value,attribute)]);
  s.chat([{...mutation(r.value),addedNodes:[{nodeType:3,parentElement:r.value}],removedNodes:[{nodeType:3}]}]);
  assert.equal(r.scans,1);assert.ok(seen.every(anchors=>anchors===initial));
});

test('href changes and element insertion/removal invalidate links exactly once per batch',()=>{
  const s=setup(),r=row();
  for(let i=0;i<3;i++)s.api.subscribeChat({onMutations(records,{rows}){for(const node of rows)s.api.links(node);}}).setEnabled(true);
  s.api.links(r.value);r.anchors.push({});
  s.chat([mutation(r.value,'href'),mutation(r.value,'href')]);assert.equal(r.scans,2);assert.equal(s.api.links(r.value).length,2);
  r.anchors.pop();s.chat([{...mutation(r.value),removedNodes:[{nodeType:1}]}]);assert.equal(r.scans,3);assert.equal(s.api.links(r.value).length,1);
  s.chat([{...mutation(r.value),addedNodes:[{nodeType:1,closest:()=>r.value,querySelectorAll:()=>[]}]}]);assert.equal(r.scans,4);
});

test('a burst of mutations resolves each distinct row target once',()=>{
  const s=setup(),r=row();let delivered=0;
  s.api.subscribeChat({onMutations(records,{rows}){delivered=records.length;assert.equal(rows.size,1);}}).setEnabled(true);
  s.chat(Array.from({length:1000},()=>mutation(r.value,'data-index')));
  assert.equal(delivered,1000);assert.equal(r.lookups,1);
});

test('chat removal batches identify detached and recycled rows for preview cleanup',()=>{
  const s=setup(),removed=row().value,nested=row().value;
  const recycled={nodeType:1,closest:()=>null};
  removed.matches=selector=>selector==='[data-index]';
  const wrapper={nodeType:1,matches:()=>false,querySelectorAll:()=>[nested]};
  const list={nodeType:1,closest:()=>null};
  let affected;
  s.api.subscribeChat({onMutations(_records,{rows}){affected=Array.from(rows);}}).setEnabled(true);
  s.chat([{...mutation(list),removedNodes:[removed,wrapper]},mutation(recycled,'data-index')]);
  assert.deepEqual(affected,[removed,nested,recycled]);
});

test('a row that loses its index drops cached links before it is reused',()=>{
  const s=setup(),r=row();
  s.api.subscribeChat({onMutations(){}}).setEnabled(true);
  const before=s.api.links(r.value);
  r.value.hasAttribute=()=>false;
  s.chat([mutation(r.value,'data-index')]);
  r.anchors.splice(0,1,{href:'https://example.com/new'});
  r.value.hasAttribute=()=>true;
  s.chat([mutation(r.value,'data-index')]);
  const after=s.api.links(r.value);
  assert.notEqual(after,before);
  assert.equal(after[0],r.anchors[0]);
});

test('subscribers retain independent row sets and requested attribute filters',()=>{
  const s=setup(),r=row(),seen=[];
  s.api.subscribeChat({onMutations(records,{rows}){seen.push([records.length,rows.size]);rows.clear();records.length=0;}}).setEnabled(true);
  s.api.subscribeChat({onMutations(records,{rows}){seen.push([records.length,rows.size]);}}).setEnabled(true);
  s.api.subscribeChat({attributes:['src'],onMutations(records,{rows}){seen.push([records.length,rows.size]);}}).setEnabled(true);
  s.chat([mutation(r.value,'href'),mutation(r.value,'src')]);
  assert.deepEqual(seen,[[1,1],[1,1],[1,1]]);
});

test('a subscriber disposed during dispatch is skipped and callback errors do not stop peers',()=>{
  const s=setup(),r=row();let calls=0,second;
  s.api.subscribeChat({onMutations(){second.destroy();throw Error('subscriber failed');}}).setEnabled(true);
  second=s.api.subscribeChat({onMutations(){assert.fail('disposed subscriber ran');}});second.setEnabled(true);
  const third=s.api.subscribeChat({onMutations(){calls++;}});third.setEnabled(true);
  s.chat([mutation(r.value,'href')]);assert.equal(calls,1);assert.equal(s.errors.length,1);
});

test('unobserved attributes perform no row discovery or delivery',()=>{
  const s=setup(),r=row();s.api.subscribeChat({attributes:['href'],onMutations(){assert.fail('irrelevant record delivered');}}).setEnabled(true);
  s.chat([mutation(r.value,'src')]);assert.equal(r.lookups,0);
});

test('row draining respects time budgets and leaves unprocessed rows for the next batch',()=>{
  const s=setup(),dirty=new Set(Array.from({length:100},()=>({})));
  assert.equal([...s.api.drainRows(dirty,{budgetMs:0})].length,1);assert.equal(dirty.size,99);
  assert.equal([...s.api.drainRows(dirty,{maxRows:3,budgetMs:1000})].length,3);assert.equal(dirty.size,96);
});
