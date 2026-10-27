import test from 'node:test';
import assert from 'node:assert/strict';
import {runners} from '../src/algorithms/core';
import {sceneForTraceEvent} from '../src/engine/traceScene';
import {stateAtTrace} from '../src/engine/teaching';
import {teachingScene} from '../src/components/teachingScene';
import {runners as intelligence} from '../src/algorithms/intelligence';
import {modelLessons} from '../src/content/lessons/intelligence-models';
import {predictionLessons} from '../src/content/lessons/intelligence-prediction';
import {runners as world} from '../src/algorithms/world';

test('Floyd display distinguishes unreachable from a genuine negative distance',()=>{
 const trace={algorithmId:'floyd-warshall',seed:0,initialState:{distances:[[0,'∞'],[-1,0]]},finalState:{},events:[],complete:true} as unknown as Parameters<typeof teachingScene>[2];
 const event={id:'0',phase:'initialize',changes:[]} as Parameters<typeof teachingScene>[1];
 const shown=teachingScene({kind:'matrix',matrix:[[0,-1],[-1,0]]},event,trace);
 assert.deepEqual(shown.matrix,[[0,Infinity],[-1,0]]);
});

test('metadata-only partition events never visually undo a completed quicksort swap',async()=>{
 const run=await runners['quick-sort']({values:[5,2,7,2,4]},{count:5},42);
 for(const event of run.trace!.events){
  const scene=sceneForTraceEvent(run,event),state=stateAtTrace(run.trace!,Number(event.id));
  assert.deepEqual(scene.values,state.array,`event ${event.id}: ${event.action}`);
 }
});

test('a new base frame replaces previous custom state, while metadata preserves its frame',()=>{
 const old={kind:'bars' as const,values:[2,1]},changed={kind:'bars' as const,values:[1,2]},newFrame={kind:'bars' as const,values:[7,8]};
 const make=(id:number,frameIndex:number,scene?:typeof old)=>({id:String(id),frameIndex,scene,phase:'x',ruleId:'x',action:'x',explanation:'x',changes:[]});
 const events=[make(0,0,changed),make(1,0),make(2,1)];
 const run={frames:[{scene:old,caption:''},{scene:newFrame,caption:''}],summary:'',metrics:{},trace:{algorithmId:'test',seed:0,initialState:{},finalState:{},events,complete:true}} as Parameters<typeof sceneForTraceEvent>[0];
 assert.equal(sceneForTraceEvent(run,events[1]),changed);assert.equal(sceneForTraceEvent(run,events[2]),newFrame);
});

test('logistic presentation uses current weights and preserves held-out membership',async()=>{
 const c=modelLessons.find(l=>l.algorithmId==='logistic-regression')!.teachingCase,run=await intelligence['logistic-regression'](c.input,c.params,c.seed),trace=run.trace!;
 const seen=new Set<string>();
 for(const e of trace.events){
  const state=stateAtTrace(trace,Number(e.id)),weights=state.weights as number[],shown=teachingScene(sceneForTraceEvent(run,e),e,trace);
  assert.equal(shown.nodes!.filter(n=>n.hollow).length,(state.test as unknown[]).length);
  for(const p of shown.paths?.[0]?.points??[])assert.ok(Math.abs(weights[0]+weights[1]*(p.x-50)/40+weights[2]*(p.y-50)/40)<1e-9);
  for(const [i,polygon] of (shown.polygons??[]).entries())for(const p of polygon.points){const z=weights[0]+weights[1]*(p.x-50)/40+weights[2]*(p.y-50)/40;assert.ok(i?z>=-1e-9:z<=1e-9);}
  if(e.phase==='update')seen.add(JSON.stringify(shown.paths));
  if(e.phase==='evaluate')assert.equal(shown.nodes!.filter(n=>n.label?.startsWith('验证')).length,1);
 }
 assert.ok(seen.size>2,'The recorded parameter updates must move the displayed boundary');
});

for(const id of ['moving-average','exponential-smoothing'])test(id+' evaluation plots the recorded day and both operands',async()=>{
 const c=predictionLessons.find(l=>l.algorithmId===id)!.teachingCase,run=await intelligence[id](c.input,c.params,c.seed);
 for(const e of run.trace!.events.filter(e=>e.phase==='evaluate')){
  const shown=teachingScene(sceneForTraceEvent(run,e),e,run.trace),day=Number((e.action+' '+e.explanation).match(/第(\d+)天/)![1]),v=e.calculation!.values,comparison=shown.series!.find(s=>s.name==='本次绝对误差')!;
  assert.deepEqual(comparison.points,[{x:day,y:Number(v.actual)},{x:day,y:Number(v.prediction??v.forecast)}]);
  assert.ok(shown.series!.flatMap(s=>s.points).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  if(id==='exponential-smoothing')assert.ok(shown.series![1].points.every(p=>p.x>1),'The initialized first day is not a validated forecast');
 }
});

test('knapsack distinguishes computed zero from cells still awaiting a decision',async()=>{
 const run=await runners.knapsack({items:[{name:'雨衣',weight:2,value:4},{name:'水',weight:1,value:3},{name:'相机',weight:3,value:5}]},{capacity:5},42),trace=run.trace!;
 for(const event of trace.events){const base=sceneForTraceEvent(run,event);if(base.kind!=='matrix')continue;
  const shown=teachingScene(base,event,trace),cols=shown.matrix![0].length,known=trace.events.slice(0,Number(event.id)+1).filter(e=>e.ruleId==='knapsack.compare').map(e=>Number(e.focus![0]));
  assert.equal(shown.matrixLabels!.flat().filter(v=>v!=='—').length,cols+known.length);
  for(const i of known)assert.equal(shown.matrixLabels![Math.floor(i/cols)][i%cols],String(shown.matrix![Math.floor(i/cols)][i%cols]));
 }
});

test('Kalman belief view uses the exact prediction, measurement and posterior in order',async()=>{
 const run=await world.kalman({},{noise:6,assumed:6,process:.1},42),trace=run.trace!;
 for(let i=0;i<6;i++){
  const e=trace.events[i],shown=teachingScene(sceneForTraceEvent(run,e),e,trace),start=i-i%3,p=trace.events[start].calculation!,g=trace.events[start+1].calculation!,u=trace.events[start+2].calculation!;
  assert.equal(shown.kind,'beliefs');assert.equal(shown.beliefs!.length,i%3===2?3:2);
  assert.equal(shown.beliefs![i%3===0?1:0].mean,p.values['预测位置']);
  assert.equal(shown.beliefs![i%3===0?1:0].variance,p.result);
  if(i%3!==0){assert.equal(shown.beliefs![1].mean,u.values.z);assert.equal(shown.beliefs![1].variance,g.values.R);}
  if(i%3===1)assert.equal(shown.mixWeight,g.result);
  if(i%3===2){assert.equal(shown.beliefs![2].mean,u.result);assert.equal(shown.beliefs![2].variance,u.values['新方差']);}
 }
});
