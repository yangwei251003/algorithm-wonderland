import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {runners as core} from '../src/algorithms/core';
import {runners as intelligence} from '../src/algorithms/intelligence';
import {runners as world} from '../src/algorithms/world';
import {lessons as coreLessons} from '../src/content/lessons/core';
import {lessons as intelligenceLessons} from '../src/content/lessons/intelligence';
import {lessons as worldLessons} from '../src/content/lessons/world';
import {teachingJSON} from '../src/engine/teaching';
import {sceneForTraceEvent} from '../src/engine/traceScene';
import {canShowDiscovery,projectDiscovery,DiscoveryPrinciples,type SearchProjection,type NeuralProjection,type LifeProjection,type WfcProjection} from '../src/components/DiscoveryPrinciples';
import type {RunResult} from '../src/engine/types';
const runners={...core,...intelligence,...world},lessons=[...coreLessons,...intelligenceLessons,...worldLessons],cache=new Map<string,Promise<RunResult>>();
function example(id:string){let p=cache.get(id);if(!p){const c=lessons.find(l=>l.algorithmId===id)!.teachingCase;p=Promise.resolve(runners[id](c.input,c.params,c.seed));cache.set(id,p);}return p;}
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('BFS queue and A* candidate graphics preserve recorded ordering and deferred status',async()=>{
 const bfs=(await example('bfs')).trace!,astar=(await example('astar')).trace!,snapshot=teachingJSON([bfs,astar]);
 const b=projectDiscovery(bfs,bfs.events[13]) as SearchProjection,a=projectDiscovery(astar,astar.events[13]) as SearchProjection;
 assert.deepEqual(b.openBefore,[5,2,6]);assert.deepEqual(b.openAfter,[2,6]);assert.equal(b.current,5);
 assert.deepEqual(a.openBefore,[1,6,10]);assert.deepEqual(a.openAfter,[1,10]);assert.equal(a.current,6);
 assert.deepEqual(a.candidates.map(c=>[c.target,c.values?.g,c.values?.h,c.values?.priority,c.status]),[['6',2,6,8,'chosen'],['1',4,7,11,'deferred'],['10',5,6,11,'deferred']]);
 const neighbor=projectDiscovery(astar,astar.events[3]) as SearchProjection;assert.equal(neighbor.oldDistance[1],'∞');assert.equal(neighbor.distance[1],4);assert.equal(neighbor.parent[1],0);
 assert.equal(teachingJSON([bfs,astar]),snapshot);
});
test('search diagrams follow changed maps, no-path runs and start=goal without fixed step IDs',async()=>{
 for(const id of ['bfs','astar'])for(const input of [{cols:4,rows:3,start:3,goal:8,walls:[6]},{cols:3,rows:3,start:0,goal:8,walls:[1,3]},{cols:3,rows:3,start:4,goal:4,walls:[]}]){
  const run=await runners[id](input,{density:0,terrain:3},91),trace=run.trace!;
  for(const event of trace.events){
   const active=event.ruleId===id+'.neighbor'||event.ruleId===id+'.select'||event.phase==='backtrack';assert.equal(canShowDiscovery(trace,event),active);
   if(!active)continue;const p=projectDiscovery(trace,event) as SearchProjection;
   if(event.phase==='select'){assert(p.openBefore.includes(p.current));assert(!p.openAfter.includes(p.current));assert.equal(event.candidates?.find(c=>c.status==='chosen')?.target,String(p.current));}
   const html=renderToStaticMarkup(createElement(DiscoveryPrinciples,{trace,event,scene:sceneForTraceEvent(run,event)}));assert(!html.includes('NaN'));assert(!html.includes('未记录'));
  }
 }
});
test('network projections read forward values, reverse errors and actual batch updates',async()=>{
 const trace=(await example('neural-network')).trace!,snapshot=teachingJSON(trace),forward=projectDiscovery(trace,trace.events[2]) as NeuralProjection,gradient=projectDiscovery(trace,trace.events[3]) as NeuralProjection,hidden=projectDiscovery(trace,trace.events[10]) as NeuralProjection,output=projectDiscovery(trace,trace.events[12]) as NeuralProjection;
 assert.deepEqual(forward.preactivation,[.4894069223912313,-1.332549567609806]);assert.deepEqual(forward.activation,[.45374558765414863,-.8698710824679549]);
 close(gradient.hiddenDelta[0],-.0037161953333757253);close(gradient.hiddenGradient[0][0],.003397664304800663);
 assert.equal(hidden.updates.length,3);close(hidden.updates[0].old,-.7746714239386705);close(hidden.updates[0].next,-.7774922022159069);close(hidden.updates[0].meanGradient,.004701297128727341);
 assert.equal(output.updates.length,3);close(output.updates[0].next,-.09541078862957093);
 for(const p of [hidden,output])for(const u of p.updates)close(u.old-.6*u.meanGradient,u.next);
 assert(!canShowDiscovery(trace,trace.events[4]));assert(!canShowDiscovery(trace,trace.events[13]));assert.equal(teachingJSON(trace),snapshot);
});
test('no-training-data updates remain truthful with no changed weight fields',async()=>{
 const run=await runners['neural-network']({points:[{x:50,y:50,value:0}]},{hidden:3,rate:.6},42),trace=run.trace!,events=trace.events.filter(e=>canShowDiscovery(trace,e));
 assert.equal(events.length,2);
 for(const event of events){const p=projectDiscovery(trace,event) as NeuralProjection;if(p.mode==='update'){assert(p.updates.length>0);p.updates.forEach(u=>assert.equal(u.old,u.next));}}
});
test('Life shows a real old-generation neighborhood for birth, survival and death',async()=>{
 const trace=(await example('life')).trace!,p=projectDiscovery(trace,trace.events[1]) as LifeProjection;
 assert.deepEqual(p.examples.map(e=>[e.label,e.index,e.old,e.neighbors,e.next]),[['出生',456,0,3,1],['存活',458,1,3,1],['死亡',417,1,1,0]]);
 for(const e of p.examples){assert.equal(e.window[4].index,e.index);assert.equal(e.window[4].value,e.old);assert.equal(e.window.filter(v=>!v.center).reduce((s,v)=>s+v.value,0),e.neighbors);}
 assert(!canShowDiscovery(trace,trace.events[2]));
 const empty=await world.life({}, {pattern:'random',steps:2,density:0},42),et=empty.trace!,ep=projectDiscovery(et,et.events[1]) as LifeProjection;
 assert.equal(ep.examples.length,1);assert.equal(ep.examples[0].label,'保持死亡');assert.deepEqual(ep.examples[0].window.map(c=>c.index),[959,920,921,39,0,1,79,40,41]);
});
test('WFC uses saved support identities, preserves no-prune case and exposes contradiction',async()=>{
 const trace=(await example('wfc')).trace!,snapshot=teachingJSON(trace),select=projectDiscovery(trace,trace.events[1]) as WfcProjection,prune=projectDiscovery(trace,trace.events[3]) as WfcProjection,retain=projectDiscovery(trace,trace.events[6]) as WfcProjection;
 assert.equal(select.target,30);assert.deepEqual(select.oldDomain,[0,3]);assert.deepEqual(select.weights,[1,1.2]);close(select.threshold,.9862392297945918);
 assert.deepEqual(prune.oldDomain,[0,5,3,6]);assert.deepEqual(prune.domain,[0,3]);assert.deepEqual(prune.supports,[[0],[],[0],[]]);assert.deepEqual(prune.queueAfter,[24]);
 assert.deepEqual(retain.sourceDomain,[0,3]);assert.deepEqual(retain.oldDomain,retain.domain);assert.deepEqual(retain.supports,[[0],[3],[0],[3]]);assert.equal(teachingJSON(trace),snapshot);
 const failed=await world.wfc({}, {size:6,roads:1.2,rules:'conflict'},42),ft=failed.trace!,failure=ft.events.find(e=>e.ruleId==='wfc-propagate'&&e.calculation?.result===0)!;
 assert(canShowDiscovery(ft,failure));const fp=projectDiscovery(ft,failure) as WfcProjection;assert.deepEqual(fp.domain,[]);assert(fp.supports.every(s=>!s.length));
 const qe=ft.events.find(e=>e.ruleId==='wfc-queue')!,qp=projectDiscovery(ft,qe) as WfcProjection;assert.deepEqual(qp.queueBefore,[21,22]);assert.deepEqual(qp.queueAfter,[22]);
});
test('all chosen presentation events SSR cleanly and keep ordinary frames available',async()=>{
 let count=0;
 for(const id of ['bfs','astar','neural-network','life','wfc']){const run=await example(id),trace=run.trace!;
  for(const event of trace.events){if(!canShowDiscovery(trace,event)){assert.equal(projectDiscovery(trace,event),null);continue;}
   const html=renderToStaticMarkup(createElement(DiscoveryPrinciples,{trace,event,scene:sceneForTraceEvent(run,event)}));
   assert(html.includes('aria-label="本步发现原理图"'),id+'/'+event.id);if(id==='astar')assert(!html.includes('队首')&&!html.includes('队尾'));assert(!/\b(?:NaN|undefined)\b/.test(html),id+'/'+event.id);assert(!html.includes('未记录'),id+'/'+event.id);
   assert(!/(?:cx|cy|x|y|x1|x2|y1|y2|width|height)="(?:NaN|Infinity|-Infinity)"/.test(html));count++;
  }
 }
 assert(count>250);
});
