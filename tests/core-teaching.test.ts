import test from 'node:test';
import assert from 'node:assert/strict';
import {runners} from '../src/algorithms/core';
import {lessons} from '../src/content/lessons/core';
import {replayTrace} from '../src/engine/teaching';
import {assignmentCosts} from '../src/algorithms/core-allocation';

for(const lesson of lessons)test('teaching trace replays and rules resolve: '+lesson.algorithmId,async()=>{
 const {input,params,seed}=lesson.teachingCase,out=await runners[lesson.algorithmId](input,params,seed);
 assert.ok(out.trace);assert.ok(out.trace.complete);
 assert.deepEqual(replayTrace(out.trace),out.trace.finalState);
 const rules=new Set(lesson.rules.map(r=>r.id));
 for(const event of out.trace.events){assert.ok(rules.has(event.ruleId),event.ruleId);assert.ok(event.frameIndex>=0&&event.frameIndex<out.frames.length);assert.ok(event.explanation.length>5);if(event.parentId!==undefined)assert.ok(Number(event.parentId)<Number(event.id));}
 assert.equal(lesson.questions.length,3);assert.equal(lesson.references.filter(r=>r.role==='visual').length,3);
});

test('BFS records every right/down/left/up check and FIFO layers',async()=>{
 const out=await runners.bfs({cols:3,rows:3,start:0,goal:8,walls:[4]},{terrain:1},42),trace=out.trace!;
 const selected=trace.events.filter(e=>e.phase==='select'),expanded=selected.filter(e=>e.focus?.[0]!=='8');
 assert.equal(trace.events.filter(e=>e.phase==='neighbor').length,expanded.length*4);
 assert.ok(trace.events.some(e=>e.explanation.includes('超出地图边界')));
 assert.ok(trace.events.some(e=>e.explanation.includes('该格是障碍')));
 const distances=selected.map(e=>Number(e.calculation!.values.g));
 for(let i=1;i<distances.length;i++)assert.ok(distances[i]>=distances[i-1]);
 assert.equal(out.metrics['路线步数'],4);
 assert.deepEqual(trace.events.filter(e=>e.phase==='neighbor').slice(0,4).map(e=>e.action),['检查右侧','检查下侧','检查左侧','检查上侧']);
});

test('DFS pauses the parent and goes immediately into the first unvisited neighbor',async()=>{
 const out=await runners.dfs({cols:3,rows:3,start:0,goal:6,walls:[4]},{terrain:1},42),trace=out.trace!;
 assert.deepEqual(trace.events.filter(e=>e.phase==='select').map(e=>e.focus![0]),['0','1','2','5','8','7','6']);
 assert.equal(out.metrics['路线步数'],6);assert.deepEqual(trace.finalState.route,[0,1,2,5,8,7,6]);
 const neighbors=trace.events.filter(e=>e.phase==='neighbor');assert.ok(neighbors.some(e=>e.explanation.includes('不做最短距离松弛')));
 const selected=trace.events.filter(e=>e.phase==='select').map(e=>e.focus![0]);assert.equal(new Set(selected).size,selected.length);
 assert.deepEqual(replayTrace(trace),trace.finalState);
});

test('A* and Dijkstra weighted traces match an independent relaxation oracle',async()=>{
 const cols=4,rows=3,walls=[5],costs=[1,9,9,1,1,1,8,1,1,1,1,1],start=0,goal=3;
 const d=Array(12).fill(Infinity);d[start]=0;
 for(let pass=0;pass<12;pass++)for(let u=0;u<12;u++)if(!walls.includes(u))for(let v=0;v<12;v++)if(!walls.includes(v)&&Math.abs(u%cols-v%cols)+Math.abs(Math.floor(u/cols)-Math.floor(v/cols))===1)d[v]=Math.min(d[v],d[u]+costs[v]);
 for(const id of ['astar','dijkstra']){
  const out=await runners[id]({cols,rows,start,goal,walls,costs},{},42);
  assert.equal(out.metrics['路线代价'],d[goal]);assert.deepEqual(replayTrace(out.trace!),out.trace!.finalState);
  for(const e of out.trace!.events.filter(e=>e.phase==='select')){
   const chosen=e.candidates!.find(c=>c.status==='chosen')!;
   for(const c of e.candidates!)assert.ok(Number(chosen.values!.priority)<=Number(c.values!.priority));
   assert.ok(e.candidates!.filter(c=>c.status!=='chosen').every(c=>c.status==='deferred'));
  }
 }
});

test('path edge cases and actual backwards parent links are explicit',async()=>{
 for(const id of ['bfs','astar']){
  const same=await runners[id]({cols:3,rows:3,start:0,goal:0,walls:[]},{terrain:1},42);assert.equal(same.metrics['路线步数'],0);assert.equal(same.metrics['路线'],'0');
  const blocked=await runners[id]({cols:3,rows:3,start:0,goal:8,walls:[3,4,5]},{terrain:1},42);assert.equal(blocked.metrics['找到路线'],0);assert.ok(blocked.trace!.events.some(e=>e.action==='候选表为空'));
  const path=await runners[id]({cols:3,rows:3,start:0,goal:8,walls:[4]},{terrain:1},42);const final=path.trace!.finalState,route=final.route as number[],parents=final.parent as number[];
  for(let i=1;i<route.length;i++)assert.equal(parents[route[i]],route[i-1]);
  assert.equal(path.trace!.events.filter(e=>e.phase==='backtrack').length,route.length);
 }
});

test('knapsack records each cell with correct numerical choice and recovers optimum',async()=>{
 const out=await runners.knapsack({},{capacity:5,items:'雨衣:2:4,水:1:3,相机:3:5'},42);
 assert.equal(out.metrics['总价值'],9);
 const cells=out.trace!.events.filter(e=>e.phase==='cell');assert.equal(cells.length,3*6);
 for(const e of cells){const v=e.calculation!.values;assert.equal(e.calculation!.result,v.take==='放不下'?v.skip:Math.max(Number(v.skip),Number(v.take)));}
 assert.ok(cells.some(e=>e.candidates?.some(c=>c.reason==='容量不足')));
 assert.deepEqual(out.trace!.finalState.selected,[0,2]);
 assert.deepEqual(replayTrace(out.trace!),out.trace!.finalState);
});

test('full sort trace survives compact-frame limit and preserves the input multiset',async()=>{
 const input=Array.from({length:40},(_,i)=>40-i),out=await runners['quick-sort']({values:input},{},42),trace=out.trace!;
 assert.ok(out.frames.length<=651);assert.ok(Number(out.metrics['省略中间画面'])>0);
 assert.equal(trace.events.filter(e=>e.phase==='compare').length,40*39/2);
 assert.deepEqual(trace.finalState.array,[...input].sort((a,b)=>a-b));
 for(const e of trace.events.filter(e=>e.phase==='move')){
  const delta=e.changes.find(c=>c.target==='array');
  if(delta)assert.deepEqual([...(delta.before as number[])].sort((a,b)=>a-b),[...(delta.after as number[])].sort((a,b)=>a-b));
 }
 assert.deepEqual(replayTrace(trace),trace.finalState);
});

test('Hungarian final potentials certify the independently evaluated assignment cost',async()=>{
 for(const seed of [3,17,42]){
  const params={size:4,specialty:2},cost=assignmentCosts(params,seed),out=await runners.hungarian({},params,seed),state=out.trace!.finalState,u=state.u as number[],v=state.v as number[],match=state.match as number[];
  assert.equal(new Set(match.slice(1)).size,4);
  let primal=0;for(let i=1;i<=4;i++)for(let j=1;j<=4;j++)assert.ok(cost[i-1][j-1]-u[i]-v[j]>=-1e-9);
  for(let j=1;j<=4;j++){const i=match[j];assert.ok(Math.abs(cost[i-1][j-1]-u[i]-v[j])<1e-9);primal+=cost[i-1][j-1];}
  assert.equal(primal,u.slice(1).reduce((a,b)=>a+b,0)+v.slice(1).reduce((a,b)=>a+b,0));
  assert.equal(state.total,primal);
 }
});

test('Dinic completed augmentations conserve flow and residual changes are paired',async()=>{
 const out=await runners['max-flow']({},{capacity:3,bottleneck:2},42),trace=out.trace!;
 for(const event of trace.events.filter(e=>e.phase==='residual')){
  const change=event.changes.find(c=>c.target==='residual')!;
  const a=(change.before as number[][]).flat(),b=(change.after as number[][]).flat(),delta=b.map((v,i)=>v-a[i]).filter(v=>v!==0);
  assert.equal(delta.length,2);assert.equal(delta[0]+delta[1],0);assert.ok(b.every(v=>v>=0));
 }
 for(const event of trace.events.filter(e=>e.phase==='augment')){
  const state=replayTrace(trace,Number(event.id)),balance=Array(6).fill(0);
  const edges=out.frames[event.frameIndex].scene.edges!;
  for(const e of edges){const [flow,capacity]=e.label!.split('/').map(Number);assert.ok(flow>=0&&flow<=capacity);balance[Number(e.from)]-=flow;balance[Number(e.to)]+=flow;}
  assert.deepEqual(balance.slice(1,5),[0,0,0,0]);assert.equal(balance[5],state.flow);assert.equal(balance[0],-Number(state.flow));
 }
 assert.equal(trace.finalState.flow,trace.finalState.cut);
});

test('DSATUR selects lexicographic saturation/original-degree/id and CPM retains real slack',async()=>{
 const coloring=await runners['graph-coloring']({},{nodes:7,density:.5},42);
 for(const e of coloring.trace!.events.filter(e=>e.phase==='select')){
  const candidates=e.candidates!,sorted=[...candidates].sort((a,b)=>Number(b.values!.saturation)-Number(a.values!.saturation)||Number(b.values!.degree)-Number(a.values!.degree)||Number(a.values!.id)-Number(b.values!.id));
  assert.equal(candidates.find(c=>c.status==='chosen')!.target,sorted[0].target);
 }
 const out=await runners['critical-path']({},{design:4,build:6,test:3},42),s=out.trace!.finalState,es=s.earliest as number[],ls=s.latest as number[],slack=s.slack as number[];
 assert.deepEqual(slack,ls.map((v,i)=>v-es[i]));assert.ok(slack.every(v=>v>=0));
 assert.deepEqual(s.critical,slack.flatMap((v,i)=>v===0?[i]:[]));
});

test('annealing exposes its actual acceptance probability and never loses a historical best',async()=>{
 const out=await runners.annealing({},{start:15,temperature:25,cooling:.97},42),trace=out.trace!;
 const accepts=trace.events.filter(e=>e.phase==='accept');assert.equal(accepts.length,160);
 let worseAccepted=0;
 for(const e of accepts){const v=e.calculation!.values,delta=Number(v.newValue)-Number(v.oldValue),p=Math.min(1,Math.exp(delta/Math.max(.001,Number(v.T))));assert.ok(Math.abs(Number(e.calculation!.result)-p)<1e-12);
  const selected=e.candidates![0].status==='chosen';assert.equal(selected,delta>=0||Number(v.draw)<p);if(delta<0&&selected)worseAccepted++;
 }
 assert.ok(worseAccepted>0);assert.equal(trace.finalState.acceptedWorse,worseAccepted);
 for(const e of trace.events)for(const change of e.changes)if(change.target==='bestValue')assert.ok(Number(change.after)>=Number(change.before));
});

test('PSO exposes sampled pulls and respects both velocity and position limits',async()=>{
 const out=await runners.pso({},{particles:3,iterations:10,inertia:1.2},42),trace=out.trace!,moves=trace.events.filter(e=>e.phase==='move');assert.equal(moves.length,30);
 for(const e of moves){const v=e.calculation!.values,raw=Number(v.inertia)*Number(v.oldVelocity)+1.5*Number(v.r1)*(Number(v.personal)-Number(v.oldX))+1.5*Number(v.r2)*(Number(v.global)-Number(v.oldX)),speed=Math.min(18,Math.max(-18,raw));assert.ok(Math.abs(speed-Number(e.calculation!.result))<1e-10);
  const state=replayTrace(trace,Number(e.id)),i=Number(e.focus![0]);assert.ok(Math.abs((state.positions as number[])[i]-Math.min(100,Math.max(0,Number(v.oldX)+speed)))<1e-10);
 }
 for(const e of trace.events)for(const c of e.changes)if(c.target==='bestValue')assert.ok(Number(c.after)>=Number(c.before));
});

test('genetic crossover and mutation produce complete permutations and keep elite distance',async()=>{
 const out=await runners.genetic({},{cities:4,population:6,mutation:1,iterations:5},42),trace=out.trace!,offspring=trace.events.filter(e=>e.phase==='offspring');assert.equal(offspring.length,4*5);
 for(const e of offspring){const child=replayTrace(trace,Number(e.id)).child as number[];assert.deepEqual([...child].sort((a,b)=>a-b),[0,1,2,3]);}
 for(const e of trace.events)for(const c of e.changes)if(c.target==='bestLength')assert.ok(Number(c.after)<=Number(c.before));
 assert.ok(trace.events.some(e=>e.phase==='cross'&&e.candidates?.some(c=>c.status==='rejected')));
});

test('Ant System normalizes choice probabilities and deposits precisely on closed-route edges',async()=>{
 const out=await runners['ant-colony']({},{cities:4,ants:3,iterations:5,evaporation:.25},42),trace=out.trace!;
 for(const e of trace.events.filter(e=>e.phase==='choose')){
  const c=e.candidates!,sum=c.reduce((s,v)=>s+Number(v.values!.probability),0);assert.ok(Math.abs(sum-1)<1e-12);
  const chosen=c.find(v=>v.status==='chosen')!,p=Number(chosen.values!.probability),idx=c.indexOf(chosen),lo=c.slice(0,idx).reduce((s,v)=>s+Number(v.values!.probability),0),r=Number(e.calculation!.values.draw);assert.ok(r>=lo-1e-12&&r<=lo+p+1e-12);
 }
 for(const e of trace.events.filter(e=>e.phase==='evaporate')){const c=e.changes.find(c=>c.target==='pheromone')!;const a=(c.before as number[][]).flat(),b=(c.after as number[][]).flat();b.forEach((v,i)=>assert.ok(Math.abs(v-a[i]*.75)<1e-12));}
 for(const e of trace.events.filter(e=>e.phase==='deposit')){
  const change=e.changes.find(c=>c.target==='pheromone')!,before=change.before as number[][],after=change.after as number[][],state=replayTrace(trace,Number(e.id)),route=state.depositRoute as number[],amount=Number(e.calculation!.result),expected=before.map(r=>[...r]);
  route.forEach((u,i)=>{const v=route[(i+1)%route.length];expected[u][v]+=amount;expected[v][u]+=amount;});assert.deepEqual(after,expected);
 }
});

test('simplex elementary operations agree with operands and final reduced costs certify optimality',async()=>{
 const out=await runners.simplex({},{capacity:7,material:8,profitA:5,profitB:4},42),trace=out.trace!;
 for(const e of trace.events.filter(e=>e.phase==='pivot')){const v=e.calculation!.values,expected=e.calculation!.formula.includes('/pivot')?Number(v.old)/Number(v.pivot):Number(v.old)-Number(v.factor)*Number(v.pivotValue);assert.ok(Math.abs(Number(e.calculation!.result)-expected)<1e-10);}
 const table=trace.finalState.table as number[][],basis=trace.finalState.basis as number[];
 assert.equal(trace.finalState.status,'optimal');assert.ok(table.at(-1)!.slice(0,-1).every(v=>v>=-1e-8));assert.ok(table.slice(0,-1).every(row=>row.at(-1)!>=-1e-8));
 basis.forEach((variable,row)=>table.forEach((r,i)=>assert.ok(Math.abs(r[variable]-(i===row?1:0))<1e-8)));
 assert.deepEqual(trace.finalState.solution,[1,6]);assert.equal(trace.finalState.value,29);
});

test('branch-and-bound incumbent equals an independent integer oracle and pruning obeys its bound',async()=>{
 for(const params of [{budget:17,time:14,profitA:7,profitB:9},{budget:0,time:14,profitA:7,profitB:9},{budget:21,time:9,profitA:6,profitB:8}]){
  let optimum=0;for(let a=0;a<=params.budget;a++)for(let b=0;b<=params.budget;b++)if(2*a+3*b<=params.budget&&3*a+b<=params.time)optimum=Math.max(optimum,params.profitA*a+params.profitB*b);
  const out=await runners['branch-bound']({},params,42),trace=out.trace!;assert.equal(trace.finalState.best,optimum);assert.equal(trace.finalState.status,'optimal');assert.deepEqual(trace.finalState.pending,[]);
  for(const e of trace.events.filter(e=>e.phase==='prune'&&e.calculation)){const v=e.calculation!.values;assert.ok(Number(v.upperBound)<=Number(v.incumbent)+1e-7);}
  for(const e of trace.events.filter(e=>e.phase==='branch')){const v=e.calculation!.values;assert.equal(Number(v.high)-Number(v.low),1);assert.ok(Number(v.low)<Number(v.relaxed)&&Number(v.relaxed)<Number(v.high));}
 }
});
