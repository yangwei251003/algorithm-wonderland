import test from 'node:test';
import assert from 'node:assert/strict';
import {runners} from '../src/algorithms/world';
import {lessons} from '../src/content/lessons/world';
import {replayTrace} from '../src/engine/teaching';

test('AHP trace contains the full attribute-to-ranking derivation used by media',async()=>{
 const out=await runners.ahp({},{costQuality:.5,costPortable:2,qualityPortable:4},42),trace=out.trace!,state=replayTrace(trace);
 const raw=trace.initialState.raw as number[][],normalized=state.normalized as number[][];
 assert.deepEqual(trace.initialState.options,['轻便款','均衡款','性能款']);
 assert.deepEqual(trace.initialState.criteria,['价格友好','性能优秀','便于携带']);
 assert.equal(raw.length,3);
 for(let j=0;j<3;j++){
  const columnTotal=raw.reduce((sum,row)=>sum+row[j],0);
  assert(Math.abs(normalized.reduce((sum,row)=>sum+row[j],0)-1)<1e-12);
  normalized.forEach((row,i)=>assert.equal(row[j],raw[i][j]/columnTotal));
 }
 const expectedWeights=[2/7,4/7,1/7];
 (state.weights as number[]).forEach((w,i)=>assert(Math.abs(w-expectedWeights[i])<1e-12));
 const independentScores=raw.map(row=>row.reduce((sum,v,j)=>sum+v/raw.reduce((s,r)=>s+r[j],0)*expectedWeights[j],0));
 (state.scores as number[]).forEach((score,i)=>assert(Math.abs(score-independentScores[i])<1e-12));
 assert.deepEqual(independentScores.map(s=>s.toFixed(3)),['0.323','0.350','0.327']);
 assert.equal(out.metrics['当前推荐'],'均衡款');assert.deepEqual(state,trace.finalState);
});

test('PID trace matches independent first physical step and records every controller update',async()=>{
 const lesson=lessons.find(l=>l.algorithmId==='pid')!,c=lesson.teachingCase,out=await runners.pid(c.input,c.params,c.seed),trace=out.trace!;
 assert(trace.complete);assert.deepEqual(replayTrace(trace),trace.finalState);
 assert.equal(trace.events.length,320*5+1);
 const first=trace.events.slice(0,5);
 assert.equal(first[0].calculation!.result,50);
 assert.equal(first[1].calculation!.result,4);
 assert.equal(first[2].calculation!.result,61.12);
 assert.equal(first[3].calculation!.result,22);
 assert(Math.abs(Number(first[4].calculation!.result)-10.1408)<1e-10);
 assert.equal(first[3].candidates![0].status,'rejected');
 assert.equal(trace.finalState.time,25.6);
 assert(trace.events.some(e=>e.ruleId==='pid-sum'&&Number(e.calculation?.values.D)<0));
 assert(trace.events.some(e=>e.changes.some(change=>change.target==='gust'&&change.after===2)));
 const known=new Set(lesson.rules.map(r=>r.id));
 for(const e of trace.events){assert(known.has(e.ruleId),e.ruleId);assert(e.frameIndex>=0&&e.frameIndex<out.frames.length);assert(e.explanation.length>5);}
 assert(Number(out.metrics['最终误差'])<2);
});

test('PID changing proportional gain changes the actual trajectory',async()=>{
 const normal=await runners.pid({},{gain:1.2,damping:1.8,target:60,wind:2},42);
 const changed=await runners.pid({},{gain:5,damping:.1,target:60,wind:2},42);
 assert.notEqual(normal.trace!.finalState.height,changed.trace!.finalState.height);
 assert(Number(changed.metrics['最大超调'])>Number(normal.metrics['最大超调']));
 assert.deepEqual(replayTrace(changed.trace!),changed.trace!.finalState);
});

test('Kalman records exact scalar gain and covariance update',async()=>{
 const out=await runners.kalman({},{noise:6,assumed:6,process:.1},42),trace=out.trace!;
 assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(trace.events.length,360);
 assert.equal(trace.events[0].calculation!.result,5.1);
 assert.equal(trace.events[1].calculation!.result,5.1/41.1);
 for(const event of trace.events.filter(e=>e.ruleId==='kalman-update')){
  const v=event.calculation!.values;
  assert(Math.abs(Number(v['新方差'])-(1-Number(v.K))*Number(v['预测方差']))<1e-12);
 }
 assert(Number(out.metrics['滤波RMSE'])<Number(out.metrics['原始测量RMSE']));
});

test('Particle filter preserves full weights and systematic resampling choices',async()=>{
 const out=await runners['particle-filter']({},{count:30,noise:4,sensor:'repeated'},42),trace=out.trace!;
 assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(trace.events.length,270);
 for(const event of trace.events.filter(e=>e.ruleId==='particle-weight')){
  const weights=event.changes.find(c=>c.target==='weights')!.after as number[];
  assert(Math.abs(weights.reduce((s,v)=>s+v,0)-1)<1e-10);assert(weights.every(w=>w>=0));
 }
 const state=replayTrace(trace,2),cdf=state.cdf as number[],ancestors=state.ancestors as number[];
 ancestors.forEach((source,k)=>{const threshold=Number(state.offset)+k/30;assert(cdf[source]>=threshold);if(source>0)assert(cdf[source-1]<threshold);});
});

test('RRT records actual collision rejection and parent-edge path',async()=>{
 const out=await runners.rrt({},{iterations:450,step:7,map:'open'},42),trace=out.trace!;
 assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(out.metrics['找到路线'],'是');
 assert(trace.events.some(e=>e.ruleId==='rrt-extend'&&e.calculation?.result==='拒绝'));
 for(const e of trace.events.filter(e=>e.ruleId==='rrt-nearest')){
  const chosen=e.candidates!.find(c=>c.status==='chosen')!;
  assert.equal(chosen.values!['距离'],Math.min(...e.candidates!.map(c=>Number(c.values!['距离']))));
 }
 const path=trace.finalState.path as number[][],length=path.slice(1).reduce((s,point,i)=>s+Math.hypot(point[0]-path[i][0],point[1]-path[i][1]),0);
 assert(Math.abs(length-Number(trace.finalState.length))<1e-10);assert.deepEqual(path[0],[8,50]);assert.deepEqual(path.at(-1),[92,50]);
 const blocked=await runners.rrt({},{iterations:80,step:7,map:'blocked'},42);assert.equal(blocked.metrics['找到路线'],'否');
});

test('Potential field and pursuit record all fixed-step decisions with valid lesson references',async()=>{
 for(const id of ['potential-field','pure-pursuit']){
  const lesson=lessons.find(l=>l.algorithmId===id)!,c=lesson.teachingCase,out=await runners[id](c.input,c.params,c.seed),trace=out.trace!;
  assert.deepEqual(replayTrace(trace),trace.finalState);assert(trace.events.length>100);
  for(const e of trace.events)assert(lesson.rules.some(rule=>rule.id===e.ruleId));
 }
});

test('Q-learning preserves every action, TD relation and episode parent',async()=>{
 const out=await runners.qlearning({},{episodes:5,explore:.25,map:'open'},42),trace=out.trace!,byId=new Map(trace.events.map(e=>[e.id,e]));
 assert.deepEqual(replayTrace(trace),trace.finalState);
 const updates=trace.events.filter(e=>e.ruleId==='q-update');assert(updates.length>100);
 for(const e of updates){
  assert.equal(byId.get(e.parentId!)!.ruleId,'q-init');const v=e.calculation!.values;
  const expected=Number(v['Q旧'])+Number(v['α'])*(Number(v.r)+Number(v['γ'])*Number(v['下一格最大Q'])-Number(v['Q旧']));
  assert.equal(e.calculation!.result,expected);assert.equal(e.candidates!.filter(c=>c.status==='chosen').length,1);
  assert.equal(e.changes.filter(c=>c.target.startsWith('Q[')).length,1);
 }
 assert.equal(trace.events.filter(e=>e.ruleId==='q-init').length,5);
});

test('AHP and TOPSIS expose actual normalized weights, distances and choices',async()=>{
 for(const id of ['ahp','topsis']){const l=lessons.find(l=>l.algorithmId===id)!,out=await runners[id](l.teachingCase.input,l.teachingCase.params,42);assert.deepEqual(replayTrace(out.trace!),out.trace!.finalState);for(const e of out.trace!.events)assert(l.rules.some(r=>r.id===e.ruleId));}
 const ahp=await runners.ahp({},{costQuality:.5,costPortable:2,qualityPortable:4},42);assert.equal(ahp.metrics['一致性比率CR'],0);
 const top=await runners.topsis({},{price:0,performance:10,portable:0},42);assert.equal(top.metrics['当前推荐'],'视觉检测');
 for(const e of top.trace!.events.filter(e=>e.ruleId==='topsis-distance')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v['D⁻'])/(Number(v['D⁺'])+Number(v['D⁻'])));}
});

test('Bandit choices match UCB score or sampled posterior and preserve feedback',async()=>{
 for(const id of ['ucb','thompson']){
  const out=await runners[id]({},{rounds:20,gap:.16,environment:'fixed'},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
  for(const event of trace.events.filter(e=>e.ruleId===id+'-choose')){
   const candidates=event.candidates!,numeric=(c:typeof candidates[number])=>typeof c.values!['用于比较的数值']==='number'?Number(c.values!['用于比较的数值']):Infinity;
   assert.equal(numeric(candidates.find(c=>c.status==='chosen')!),Math.max(...candidates.map(numeric)));
  }
  assert.equal((trace.finalState.count as number[]).reduce((a,b)=>a+b),20);
 }
});

test('Regret update uses actual counterfactual minus observed payoff',async()=>{
 const out=await runners.regret({},{rounds:20,rock:.7,opponent:'fixed'},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
 for(const e of trace.events.filter(e=>e.ruleId==='regret-update')){
  const chosen=e.candidates!.find(c=>c.status==='chosen')!;assert.equal(chosen.values!['遗憾增量'],0);
  for(const c of e.candidates!)assert.equal(c.values!['遗憾增量'],Number(c.values!['反事实收益'])-Number(e.calculation!.values['本次收益']));
 }
});

test('Minimax actual branch values obey alternating max/min and choose immediate win',async()=>{
 const out=await runners.minimax({},{board:'XX.OO....',depth:9},42),trace=out.trace!;assert.equal(out.metrics['下一步'],3);assert.deepEqual(replayTrace(trace),trace.finalState);
 for(const e of trace.events.filter(e=>e.ruleId==='minimax-branch'&&e.candidates?.length)){
  const scores=e.candidates!.map(c=>Number(c.values!['回传评价'])),isMax=e.calculation!.formula.startsWith('V=max');
  assert.equal(e.calculation!.result,isMax?Math.max(...scores):Math.min(...scores));
 }
 assert(trace.events.some(e=>e.ruleId==='minimax-leaf'));
});

test('MCTS records rollout, each backup contribution and final visit-count decision',async()=>{
 const out=await runners.mcts({},{board:'XX.OO....',iterations:40,explore:1.4},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(trace.finalState.N0,40);
 for(const e of trace.events.filter(e=>e.ruleId==='mcts-backup')){
  const root=e.changes.find(c=>c.target==='N0')!;assert.equal(Number(root.after)-Number(root.before),1);
  assert([0,.5,1].includes(Number(e.calculation!.result)));
 }
 const final=trace.events.at(-1)!;assert.equal(final.ruleId,'mcts-finish');const chosen=final.candidates!.find(c=>c.status==='chosen')!;
 assert.equal(chosen.values!['访问'],Math.max(...final.candidates!.map(c=>Number(c.values!['访问']))));
});

test('Every image pixel records a true neighborhood computation with original input',async()=>{
 for(const id of ['gaussian-filter','median-filter','sobel']){
  const out=await runners[id]({},{noise:18,radius:1,threshold:120},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
  const steps=trace.events.filter(e=>e.ruleId===id+'-apply');assert.equal(steps.length,48*32);
  for(const e of steps){const value=Number(e.calculation!.result);
   if(id==='gaussian-filter'){const vs=e.changes.find(c=>c.target==='window')?.after as number[]|undefined;if(vs)assert(value>=Math.min(...vs)-1e-9&&value<=Math.max(...vs)+1e-9);}
   if(id==='median-filter'){const c=e.candidates!.find(c=>c.status==='chosen')!;assert.equal(value,c.values!['亮度']);}
   if(id==='sobel'){const v=e.calculation!.values;assert.equal(value,Number(v['幅值'])>=120?Math.min(255,Number(v['幅值'])):0);}
  }
 }
});

test('Otsu evaluates all thresholds and chooses maximum valid separation',async()=>{
 const out=await runners.otsu({},{noise:8,contrast:1},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
 assert.equal(trace.events.filter(e=>e.ruleId==='otsu-score'||e.ruleId==='otsu-empty').length,256);
 const scored=trace.events.filter(e=>e.ruleId==='otsu-score'),max=Math.max(...scored.map(e=>Number(e.calculation!.result)));
 assert.equal(trace.finalState.bestScore,max);assert.equal(out.metrics['自动阈值'],trace.finalState.bestThreshold);
});

test('RANSAC explains real support and explicitly rejects vertical-only samples',async()=>{
 const out=await runners.ransac({points:[{x:10,y:10},{x:20,y:20},{x:30,y:30},{x:40,y:90}]},{iterations:10,tolerance:.1},42),trace=out.trace!;
 assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(out.metrics['支持点'],3);
 const bad=await runners.ransac({points:[{x:10,y:10},{x:10,y:30}]},{iterations:3,tolerance:1},42);assert.equal(bad.metrics['支持点'],0);assert.equal(bad.metrics['斜率'],'未得到有效模型');
});

test('FFT records all radix-two butterflies and exact coefficient output',async()=>{
 const out=await runners.fft({},{frequency:7,second:19,noise:0},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
 assert.equal(trace.events.filter(e=>e.ruleId==='fft-butterfly').length,128/2*7);assert.equal(trace.events.filter(e=>e.ruleId==='fft-leaf').length,128);assert.equal(out.metrics['最强频率'],'7 Hz');
 const amps=trace.finalState.amplitudes as number[];assert(Math.abs(amps[7]-1)<1e-10);assert(Math.abs(amps[19]-.55)<1e-10);
});

test('Seam DP records all row predecessors and removes one pixel per row',async()=>{
 const out=await runners['seam-carving']({},{remove:2,pattern:'object'},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
 assert.equal(trace.events.filter(e=>e.ruleId==='seam-dp').length,31*2);assert.equal(trace.finalState.width,46);assert.equal((trace.finalState.pixels as number[]).length,46*32);
 for(const e of trace.events.filter(e=>e.ruleId==='seam-dp')){
  const candidates=e.candidates!,chosen=candidates.find(c=>c.status==='chosen')!;assert.equal(chosen.values!['累计代价'],Math.min(...candidates.map(c=>Number(c.values!['累计代价']))));
 }
});

test('Boids local forces read one shared old flock and synchronous positions follow velocity',async()=>{
 const out=await runners.boids({},{count:12,cohesion:1,separation:1.2,obstacle:1,steps:3},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);
 const initial=trace.initialState.birds as {x:number;y:number;vx:number;vy:number}[];let birds=initial;
 for(let k=0;k<3;k++){
  const f=trace.events[k*2],m=trace.events[k*2+1],forces=f.changes.find(c=>c.target==='forces')!.after as {neighbors:number[];fx:number;fy:number;sep:number[];coh:number[];align:number[];avoid:number[]}[];
  forces.forEach((force,i)=>{const expected=birds.flatMap((b,j)=>{const d=Math.hypot(b.x-birds[i].x,b.y-birds[i].y);return i!==j&&d>.001&&d<22?[j]:[];});assert.deepEqual(force.neighbors,expected);assert(Math.abs(force.fx-force.sep[0]-force.coh[0]-force.align[0]-force.avoid[0])<1e-12);});
  const next=m.changes.find(c=>c.target==='birds')!.after as typeof birds;next.forEach((b,i)=>{assert(Math.abs(b.x-(birds[i].x+b.vx+100)%100)<1e-12);assert(b.x>=0&&b.x<100&&b.y>=0&&b.y<100);});birds=next;
 }
});

test('Life traces every synchronous generation and the known blinker period',async()=>{
 const out=await runners.life({},{pattern:'blinker',steps:2},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);assert.deepEqual(trace.finalState.cells,trace.initialState.cells);
 assert.equal(trace.events.filter(e=>e.ruleId==='life-update').length,2);const event=trace.events.find(e=>e.ruleId==='life-update')!,births=event.changes.find(c=>c.target==='births')!.after as number[],deaths=event.changes.find(c=>c.target==='deaths')!.after as number[];assert.equal(births.length,2);assert.equal(deaths.length,2);assert.equal(trace.finalState.population,3);
});

test('Perlin records every sample row and octave while keeping integer corners zero',async()=>{
 const out=await runners.perlin({},{scale:2,octaves:2,persistence:.5},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);const rows=trace.events.filter(e=>e.ruleId==='perlin-blend');assert.equal(rows.length,48*2);
 const first=rows[0].changes.find(c=>c.target==='samples')!.after as {x:number;y:number;value:number;u:number;v:number;dots:number[]}[];assert.equal(first.length,80);assert.equal(first[0].value,0);assert.equal(first[40].value,0);
 const values=trace.finalState.values as number[];assert.equal(values.length,80*48);assert(values.every(v=>v>=0&&v<=1));assert.equal(trace.finalState.total,1.5);
});

test('L-system records each symbol and stack restoration without drawing a return line',async()=>{
 const out=await runners.lsystem({},{depth:2,angle:25,rule:'branch'},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(out.metrics['线段数'],25);assert.equal(out.metrics['分叉次数'],12);assert.deepEqual(trace.finalState.stack,[]);
 assert.equal(trace.events.filter(e=>e.action.startsWith('F：')).length,1+5+25);
 for(const e of trace.events.filter(e=>e.action.startsWith(']：'))){assert(!e.changes.some(c=>c.target==='segmentCount'));assert(e.explanation.includes('不代表'));}
});

test('Voronoi compares every site under explicit distance and keeps first on ties',async()=>{
 const points=[{x:25,y:50},{x:75,y:50}],out=await runners.voronoi({points},{metric:'euclidean'},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);const owners=trace.finalState.owner as number[];for(let y=0;y<40;y++)for(let x=0;x<64;x++)assert.equal(owners[y*64+x],x<32?0:1);
 const tied=await runners.voronoi({points:[points[0],points[0]]},{metric:'manhattan'},42);assert((tied.trace!.finalState.owner as number[]).every(i=>i===0));
});

test('Reaction diffusion records each full synchronous field with conserved diffusion kernel',async()=>{
 const {reactionLaplacian}=await import('../src/algorithms/world-reaction');assert(Math.abs(reactionLaplacian(Array(9).fill(.4),1,1,3,3))<1e-15);
 const out=await runners['reaction-diffusion']({},{feed:.036,kill:.062,steps:3},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);const events=trace.events.filter(e=>e.ruleId==='reaction-update');assert.equal(events.length,3);
 for(const e of events){const c=e.changes.find(c=>c.target==='focusCalculation')!.after as Record<string,number>;const expectedV=Math.min(1,Math.max(0,c.oldV+.5*c.lapV+c.oldU*c.oldV*c.oldV-(.036+.062)*c.oldV));assert(Math.abs(c.newV-expectedV)<1e-14);
  const uc=e.changes.find(c=>c.target==='u')!,vc=e.changes.find(c=>c.target==='v')!,u=uc.before as number[],v=vc.before as number[],un=uc.after as number[],vn=vc.after as number[];
  // Independent direct wraparound calculation includes every edge and corner,
  // so cached neighbour indices cannot silently change synchronous diffusion.
  for(let i=0;i<u.length;i++){const x=i%48,y=Math.floor(i/48),r=u[i]*v[i]*v[i];assert.equal(un[i],Math.min(1,Math.max(0,u[i]+reactionLaplacian(u,x,y,48,32)-r+.036*(1-u[i]))));assert.equal(vn[i],Math.min(1,Math.max(0,v[i]+.5*reactionLaplacian(v,x,y,48,32)+r-(.036+.062)*v[i])));}
 }
 for(const key of ['u','v']){const field=trace.finalState[key] as number[];assert.equal(field.length,48*32);assert(field.every(x=>x>=0&&x<=1));}
});

test('WFC trace distinguishes random collapse from support elimination and reports contradiction',async()=>{
 const out=await runners.wfc({},{size:4,roads:1.2,rules:'consistent'},42),trace=out.trace!;assert.deepEqual(replayTrace(trace),trace.finalState);assert.equal(out.metrics['约束满足'],'是');
 for(const e of trace.events.filter(e=>e.ruleId==='wfc-propagate'))for(const c of e.candidates!)assert.equal(c.status==='chosen',Number(c.values!['支持数'])>0);
 for(const e of trace.events.filter(e=>e.ruleId==='wfc-select')){const cs=e.candidates!,threshold=Number(e.calculation!.values['阈值']);let sum=0;const selected=cs.findIndex(c=>{sum+=Number(c.values!['权重']);return sum>=threshold;});assert.equal(cs[selected].status,'chosen');}
 const fail=await runners.wfc({},{size:4,roads:1.2,rules:'conflict'},42);assert.equal(fail.metrics['约束满足'],'否');assert.equal(fail.trace!.events.at(-1)!.ruleId,'wfc-stop');assert(fail.trace!.events.some(e=>e.candidates?.some(c=>c.status==='rejected')));
});

test('All 28 world teaching cases have complete replayable traces and declared rule coverage',async()=>{
 const {lessons}=await import('../src/content/lessons/world');assert.equal(lessons.length,28);for(const lesson of lessons){const {input,params,seed}=lesson.teachingCase,out=await runners[lesson.algorithmId](input,params,seed),trace=out.trace!;assert(trace?.complete,lesson.algorithmId);assert.deepEqual(replayTrace(trace),trace.finalState,lesson.algorithmId);const rules=new Set(lesson.rules.map(r=>r.id)),seen=new Set(trace.events.map(e=>e.ruleId));for(const e of trace.events)assert(rules.has(e.ruleId),lesson.algorithmId+':unknown '+e.ruleId);for(const r of rules)assert(seen.has(r),lesson.algorithmId+':not covered '+r);assert.equal(lesson.questions.length,3);assert(lesson.analogy.mappings.length>1);}
});
