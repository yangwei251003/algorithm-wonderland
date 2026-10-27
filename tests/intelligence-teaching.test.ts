import {calculationResultLabel} from '../src/components/teachingLabels';
import test from 'node:test';
import assert from 'node:assert/strict';
import {kmeans} from '../src/algorithms/intelligence';
import {lessons} from '../src/content/lessons/intelligence';
import {replayTrace} from '../src/engine/teaching';
import {runners} from '../src/algorithms/intelligence';
import {predictionLessons} from '../src/content/lessons/intelligence-prediction';
import {modelLessons} from '../src/content/lessons/intelligence-models';
import {retrievalLessons} from '../src/content/lessons/intelligence-retrieval';
import {compressionLessons} from '../src/content/lessons/intelligence-compression';
import {crcRemainder,huffmanDecode,lzDecode,rleDecode} from '../src/algorithms/intelligence-compression';

for(const lesson of [...predictionLessons,...modelLessons,...retrievalLessons,...compressionLessons])test('intelligence teaching contract: '+lesson.algorithmId,async()=>{
 const c=lesson.teachingCase,out=await runners[lesson.algorithmId](c.input,c.params,c.seed),trace=out.trace!;
 assert.ok(trace?.complete);assert.deepEqual(replayTrace(trace),trace.finalState);
 for(const e of trace.events){assert.ok(lesson.rules.some(r=>r.id===e.ruleId));assert.ok(e.frameIndex>=0&&e.frameIndex<out.frames.length);assert.ok(e.explanation.length>5);}
 assert.equal(lesson.questions.length,3);assert.equal(lesson.references.filter(r=>r.role==='visual').length,3);
});

test('RLE trace starts a new run only on an adjacent character change and losslessly expands it',async()=>{
 const out=await runners.rle({},{text:'AABAA🙂🙂',repeat:1},42),trace=out.trace!,tokens=trace.finalState.tokens as {char:string;count:number}[];
 assert.deepEqual(tokens,[{char:'A',count:2},{char:'B',count:1},{char:'A',count:2},{char:'🙂',count:2}]);assert.equal(rleDecode(tokens),'AABAA🙂🙂');assert.equal(trace.events.filter(e=>e.phase==='encode').length,7);assert.equal(trace.finalState.restored,'AABAA🙂🙂');
});

test('Huffman always merges the smallest two live weights and each emitted code is prefix-free',async()=>{
 const out=await runners.huffman({},{text:'BANANA',repeat:1},42),trace=out.trace!,codes=trace.finalState.codes as Record<string,string>;
 for(const e of trace.events.filter(e=>e.phase==='merge')){const chosen=e.candidates!.filter(v=>v.status==='chosen').map(v=>Number(v.values!.frequency)).sort((a,b)=>a-b),all=e.candidates!.map(v=>Number(v.values!.frequency)).sort((a,b)=>a-b);assert.deepEqual(chosen,all.slice(0,2));assert.equal(e.calculation!.result,chosen[0]+chosen[1]);}
 for(const [symbol,code]of Object.entries(codes))for(const [other,otherCode]of Object.entries(codes))if(symbol!==other)assert.ok(!otherCode.startsWith(code));
 assert.equal(huffmanDecode(String(trace.finalState.encodedBits),codes),'BANANA');assert.equal(out.metrics['载荷位数'],9);assert.equal(trace.finalState.decoded,'BANANA');
});

test('LZ77 uses dynamic overlapping copies and recovers all real token choices',async()=>{
 const out=await runners.lz77({},{text:'AAAAAAAAAA',window:4},42),trace=out.trace!,tokens=trace.finalState.tokens as {distance:number;length:number;next:string}[];
 assert.ok(tokens.some(t=>t.length>t.distance&&t.distance>0));assert.equal(lzDecode(tokens),'AAAAAAAAAA');assert.equal(trace.finalState.decoded,'AAAAAAAAAA');
 const copyEvents=trace.events.filter(e=>e.phase==='copy');assert.equal(copyEvents.length,tokens.reduce((sum,t)=>sum+t.length,0));
});

test('Hamming parity records use XOR and the syndrome recovers every single error location',async()=>{
 for(let bit=1;bit<=7;bit++){
  const out=await runners.hamming({},{data:'1011',flip:bit,flip2:0},42),trace=out.trace!;assert.equal(out.metrics['校验综合结果'],bit);assert.equal(trace.finalState.decoded,'1011');
  for(const e of trace.events.filter(e=>e.phase==='parity'||e.phase==='check')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.old)^Number(v.bit));}
  assert.deepEqual(replayTrace(trace),trace.finalState);
 }
 const double=await runners.hamming({},{data:'1011',flip:3,flip2:5},42);assert.equal(double.trace!.finalState.actualErrors,2);assert.equal(double.trace!.finalState.restored,false);
});

test('CRC traced long division follows each XOR and exposes a deliberate undetected error',async()=>{
 const out=await runners.crc({},{data:'1101',polynomial:'1011',error:'1011'},42),trace=out.trace!;
 for(const e of trace.events.filter(e=>e.ruleId==='crc.divide'&&e.calculation)){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.old)^Number(v.polynomialBit));}
 assert.equal(crcRemainder(String(trace.finalState.encoded),'1011'),'000');assert.equal(trace.finalState.detected,false);assert.ok(Number(trace.finalState.actualFlips)>0);
});

test('Bloom inserts never clear bits and each hash-to-position map uses the actual remainder',async()=>{
 const out=await runners.bloom({},{keys:'a,b,c',query:'b',size:16,hashes:3},42),trace=out.trace!;
 for(const e of trace.events.filter(e=>e.phase==='insert'))for(const c of e.changes.filter(c=>c.target==='bits')){const before=c.before as number[],after=c.after as number[];after.forEach((v,i)=>assert.ok(v>=before[i]));}
 for(const e of trace.events.filter(e=>e.phase==='position')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.hash)%Number(v.size));}
 assert.equal(trace.finalState.maybe,true);assert.equal(trace.finalState.really,true);assert.equal(trace.finalState.falsePositive,false);
});

test('PageRank conserves probability even with dangling pages and uses prior-round ranks',async()=>{
 const out=await runners.pagerank({},{links:'A>B,B>C',damping:.85},42),trace=out.trace!;
 for(const e of trace.events.filter(e=>e.phase==='iteration')){const state=replayTrace(trace,Number(e.id)),rank=state.rank as number[];assert.ok(Math.abs(rank.reduce((s,v)=>s+v,0)-1)<1e-12);assert.ok(rank.every(v=>v>=0));}
 for(const e of trace.events.filter(e=>e.phase==='edge')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.d)*Number(v.oldRank)/Number(v.outdegree));}
 const zero=await runners.pagerank({},{links:'A>B,B>C',damping:0},42);assert.deepEqual(zero.trace!.finalState.rank,[1/3,1/3,1/3]);
});

test('cosine recommendations are scale-invariant and collaborative predictions normalize their weights',async()=>{
 const a=await runners['content-recommendation']({},{adventure:1,humor:1,science:2},42),b=await runners['content-recommendation']({},{adventure:2,humor:2,science:4},42);
 const x=a.trace!.finalState.scores as number[],y=b.trace!.finalState.scores as number[];x.forEach((v,i)=>assert.ok(Math.abs(v-y[i])<1e-12));
 const out=await runners.collaborative({},{ratings:'5,0,4,0,1,0',neighbors:2,shrinkage:1},42);
 for(const e of out.trace!.events.filter(e=>e.phase==='predict')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.numerator)/Number(v.weight));assert.ok(Number(e.calculation!.result)>=1&&Number(e.calculation!.result)<=5);}
});

test('Apriori frequent sets and rule confidence agree with independent basket subset enumeration',async()=>{
 const baskets=[['a','b'],['a','c'],['b','c'],['a','b','c']],out=await runners.apriori({},{transactions:baskets.map(v=>v.join(',')).join(';'),support:50,confidence:60},42),state=out.trace!.finalState,sets=state.frequentCounts as {items:string[];count:number}[];
 const expected=new Map<string,number>();for(let mask=1;mask<8;mask++){const set=['a','b','c'].filter((_,i)=>mask&(1<<i)),count=baskets.filter(b=>set.every(v=>b.includes(v))).length;if(count>=2)expected.set(JSON.stringify(set),count);}
 assert.equal(sets.length,expected.size);sets.forEach(v=>assert.equal(v.count,expected.get(JSON.stringify(v.items))));
 for(const e of out.trace!.events.filter(e=>e.phase==='rule')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.joint)/Number(v.antecedent));}
});

test('BM25 absent terms contribute zero and term frequency uses the documented saturation',async()=>{
 const out=await runners.bm25({},{query:'无人机 不存在词',k1:1.5,b:.75},42);
 for(const e of out.trace!.events.filter(e=>e.phase==='score')){const v=e.calculation!.values;const expected=Number(v.idf)*Number(v.tf)*(Number(v.k1)+1)/(Number(v.tf)+Number(v.k1)*(1-Number(v.b)+Number(v.b)*Number(v.length)/Number(v.averageLength)));assert.ok(Math.abs(Number(e.calculation!.result)-expected)<1e-12);if(Number(v.tf)===0)assert.equal(e.calculation!.result,0);}
});

test('edit distance records all cells and prefers insertion/deletion when substitution is expensive',async()=>{
 const out=await runners['edit-distance']({},{from:'a',to:'b',substitution:3},42);assert.equal(out.trace!.finalState.distance,2);assert.equal(out.trace!.events.filter(e=>e.phase==='cell').length,1);assert.deepEqual(out.trace!.finalState.operations,['插入 b','删除 a']);
 for(const e of out.trace!.events.filter(e=>e.phase==='cell')){const v=e.calculation!.values;assert.equal(e.calculation!.result,Math.min(Number(v.diagonal),Number(v.deletion),Number(v.insertion)));}
});

test('KMP keeps text index monotonic, builds true-prefix lengths, and returns overlapping matches',async()=>{
 for(const [text,pattern]of [['AAAA','AAA'],['ABABABCABABABC','ABABC'],['你好你好你','你好你']]){
  const out=await runners.kmp({},{text,pattern},42),trace=out.trace!,chars=Array.from(pattern),expected=Array(chars.length).fill(0);
  for(let end=0;end<chars.length;end++)for(let len=1;len<=end;len++)if(chars.slice(0,len).join('')===chars.slice(end-len+1,end+1).join(''))expected[end]=len;
  assert.deepEqual(trace.finalState.lps,expected);const tc=Array.from(text),matches=tc.flatMap((_,i)=>tc.slice(i,i+chars.length).join('')===pattern?[i]:[]);assert.deepEqual(trace.finalState.matches,matches);
  for(const e of trace.events)for(const c of e.changes)if(c.target==='i'&&c.before!==null)assert.ok(Number(c.after)>=Number(c.before));
 }
});

test('logistic gradient agrees with finite differences of binary cross entropy',async()=>{
 const lesson=modelLessons.find(l=>l.algorithmId==='logistic-regression')!,c=lesson.teachingCase,out=await runners['logistic-regression'](c.input,c.params,c.seed),trace=out.trace!,train=trace.initialState.train as number[][];
 const loss=(weights:number[])=>train.reduce((sum,[x,y,label])=>{const z=weights[0]+weights[1]*(x-50)/40+weights[2]*(y-50)/40;return sum+Math.log(1+Math.exp(z))-label*z;},0)/train.length;
 const firstUpdate=trace.events.find(e=>e.phase==='update')!,gradient=replayTrace(trace,Number(firstUpdate.id)-1).gradient as number[],h=1e-5;
 for(let j=0;j<3;j++){const plus=[0,0,0],minus=[0,0,0];plus[j]=h;minus[j]=-h;const numeric=(loss(plus)-loss(minus))/(2*h);assert.ok(Math.abs(numeric-gradient[j]/train.length)<1e-7);}
});

test('KNN rejects all farther neighbors and keeps held-out points out of voters',async()=>{
 const c=modelLessons.find(l=>l.algorithmId==='knn')!.teachingCase,out=await runners.knn(c.input,c.params,c.seed),trace=out.trace!;
 const train=trace.initialState.train as number[][],held=trace.initialState.test as number[][];assert.equal(train.length,8);assert.equal(held.length,2);
 for(const e of trace.events.filter(e=>e.phase==='choose')){const chosen=e.candidates!.filter(v=>v.status==='chosen'),rejected=e.candidates!.filter(v=>v.status==='rejected');assert.equal(chosen.length,3);assert.ok(Math.max(...chosen.map(v=>Number(v.values!.distance)))<=Math.min(...rejected.map(v=>Number(v.values!.distance))));}
});

test('CART weighted Gini is recomputable and final validation paths preserve threshold decisions',async()=>{
 const c=modelLessons.find(l=>l.algorithmId==='decision-tree')!.teachingCase,out=await runners['decision-tree'](c.input,c.params,c.seed),trace=out.trace!;
 for(const e of trace.events.filter(e=>e.phase==='candidate'&&e.calculation)){const v=e.calculation!.values;assert.equal(e.calculation!.result,(Number(v.nL)*Number(v.GL)+Number(v.nR)*Number(v.GR))/Number(v.n));}
 for(const e of trace.events.filter(e=>e.phase==='predict'&&e.calculation)){const v=e.calculation!.values;assert.equal(e.calculation!.result,Number(v.value)<Number(v.threshold)?'左':'右');}
 assert.equal(trace.finalState.correct,2);
});

test('DBSCAN border points do not propagate to another sparse point',async()=>{
 const points=[0,1,2,3,7,11].map(x=>({x,y:10})),out=await runners.dbscan({points},{eps:4,minimum:4},42),labels=out.trace!.finalState.labels as number[];
 assert.equal(labels[4],0);assert.equal(labels[5],-1);assert.equal(out.metrics['发现组数'],1);
 assert.ok(out.trace!.events.some(e=>e.phase==='core-test'&&e.explanation.includes('不是核心')));
});

test('PCA direction is an eigenvector and every reconstructed residual is perpendicular',async()=>{
 const points=[{x:10,y:20},{x:20,y:35},{x:30,y:38},{x:40,y:55}],out=await runners.pca({points},{},42),s=out.trace!.finalState,[vx,vy]=s.direction as number[],cov=s.covariance as number[][],[lambda]=s.eigenvalues as number[],projected=s.projected as number[][];
 assert.ok(Math.abs(vx*vx+vy*vy-1)<1e-12);assert.ok(Math.abs(cov[0][0]*vx+cov[0][1]*vy-lambda*vx)<1e-9);assert.ok(Math.abs(cov[1][0]*vx+cov[1][1]*vy-lambda*vy)<1e-9);
 points.forEach((d,i)=>assert.ok(Math.abs((d.x-projected[i][0])*vx+(d.y-projected[i][1])*vy)<1e-9));
});

test('neural first backpropagation equals independent numerical derivatives',async()=>{
 const points=[{x:10,y:20,value:0},{x:25,y:30,value:1}],out=await runners['neural-network']({points},{hidden:2,rate:.6},42),trace=out.trace!,a=trace.initialState.hiddenWeights as number[][],b=trace.initialState.outputWeights as number[],d=(trace.initialState.train as number[][])[0],first=trace.events.find(e=>e.phase==='gradient')!,s=replayTrace(trace,Number(first.id)),ga=s.hiddenGradient as number[][],gb=s.outputGradient as number[],h=1e-5;
 const loss=(aa:number[][],bb:number[])=>{const hidden=aa.map(w=>Math.tanh(w[0]*(d[0]-50)/35+w[1]*(d[1]-50)/35+w[2])),z=bb[2]+hidden.reduce((sum,v,j)=>sum+v*bb[j],0);return Math.log(1+Math.exp(z))-d[2]*z;};
 for(let j=0;j<2;j++)for(let k=0;k<3;k++){const plus=a.map(v=>[...v]),minus=a.map(v=>[...v]);plus[j][k]+=h;minus[j][k]-=h;assert.ok(Math.abs((loss(plus,b)-loss(minus,b))/(2*h)-ga[j][k])<1e-7);}
 for(let j=0;j<3;j++){const plus=[...b],minus=[...b];plus[j]+=h;minus[j]-=h;assert.ok(Math.abs((loss(a,plus)-loss(a,minus))/(2*h)-gb[j])<1e-7);}
 assert.equal(trace.events.filter(e=>e.phase==='forward').length,500);
});

test('forecast traces use only past observations and report independently calculated errors',async()=>{
 const values=[10,12,14,30,32,34],out=await runners['moving-average']({values},{window:3},42),state=out.trace!.finalState;
 assert.equal(state.forecast,32);assert.equal(state.mae,(18+(32-56/3)+(34-76/3))/3);
 for(const e of out.trace!.events.filter(e=>e.phase==='sum')){const s=replayTrace(out.trace!,Number(e.id));assert.ok(Number(e.calculation!.values.day)<Number(s.day));}
 const smooth=await runners['exponential-smoothing']({values},{alpha:.5},42),pred=[10];for(let i=1;i<=values.length;i++)pred.push((values[i-1]+pred[i-1])/2);
 assert.deepEqual(smooth.trace!.finalState.predictions,pred);
 assert.equal(smooth.trace!.finalState.mae,values.slice(1).reduce((s,v,i)=>s+Math.abs(v-pred[i+1]),0)/5);
});

test('least-squares final residuals satisfy the two normal-equation orthogonality conditions',async()=>{
 const points=[{x:1,y:3},{x:2,y:3},{x:4,y:8},{x:6,y:10}],out=await runners['linear-regression']({points},{},42),s=out.trace!.finalState;
 const residual=points.map(d=>d.y-Number(s.intercept)-Number(s.slope)*d.x);assert.ok(Math.abs(residual.reduce((a,b)=>a+b,0))<1e-9);assert.ok(Math.abs(residual.reduce((a,b,i)=>a+b*points[i].x,0))<1e-9);
 assert.ok(Math.abs(Number(s.sse)-residual.reduce((sum,v)=>sum+v*v,0))<1e-9);
 const vertical=await runners['linear-regression']({points:[{x:2,y:1},{x:2,y:5}]},{},42);assert.equal(vertical.trace!.finalState.slope,0);assert.equal(vertical.trace!.finalState.intercept,3);assert.ok(vertical.trace!.events.some(e=>e.explanation.includes('无法唯一识别')));
});

test('Bayes trace normalizes disjoint true/false positive branches',async()=>{
 const out=await runners.bayes({},{prior:5,sensitivity:90,falsePositive:10},42),s=out.trace!.finalState;
 assert.ok(Math.abs(Number(s.evidence)-.14)<1e-12);assert.ok(Math.abs(Number(s.posterior)-45/140)<1e-12);
});

test('Monte Carlo exposes each actual random draw and evaluates each completed world once',async()=>{
 const out=await runners['monte-carlo']({},{samples:40,spread:30,deadline:110},42),trace=out.trace!,events=trace.events.filter(e=>e.phase==='sample');assert.equal(events.length,160);
 let successes=0,total=0;for(const e of trace.events.filter(e=>e.phase==='evaluate')){const v=e.calculation!.values;if(Number(v.duration)<=110)successes++;total+=Number(v.duration);assert.equal(Number(v.successes),successes);}
 for(const e of events){const v=e.calculation!.values;assert.ok(Number(v.u1)>=0&&Number(v.u1)<1&&Number(v.u2)>=0&&Number(v.u2)<1);assert.ok(Math.abs(Number(e.calculation!.result)-Number(v.base)*(1+(Number(v.u1)+Number(v.u2)-1)*.3))<1e-12);}
 assert.equal(trace.finalState.probability,successes/40);assert.equal(trace.finalState.mean,total/40);
});

test('Bootstrap draws are with replacement, statistics derive from selected positions, quantiles are explicit',async()=>{
 const values=[10,12,14,16],out=await runners.bootstrap({},{data:values.join(','),samples:50},42),trace=out.trace!,stats=trace.events.filter(e=>e.phase==='statistic');assert.equal(stats.length,50);
 for(const e of stats)assert.equal(calculationResultLabel(e.ruleId,e.calculation?.values,e.phase),'重采样均值');
 for(const e of trace.events.filter(e=>e.ruleId==='bootstrap.resample'&&e.phase!=='statistic'))assert.equal(calculationResultLabel(e.ruleId,e.calculation?.values,e.phase),'累计和');
 let repeated=false;const means:number[]=[];for(const e of stats){const state=replayTrace(trace,Number(e.id)),draw=state.draw as number[];if(new Set(draw).size<draw.length)repeated=true;const m=draw.reduce((sum,index)=>sum+values[index],0)/4;assert.equal(e.calculation!.result,m);means.push(m);}
 assert.ok(repeated);means.sort((a,b)=>a-b);assert.deepEqual(trace.finalState.sortedMeans,means);assert.equal(trace.finalState.lower,means[1]);assert.equal(trace.finalState.upper,means[48]);
});
test('K-means explains real nearest-center choices and mean movement separately',async()=>{
 const lesson=lessons.find(l=>l.algorithmId==='kmeans')!,c=lesson.teachingCase;
 const output=await kmeans(c.input,c.params,c.seed),trace=output.trace!;
 assert.equal(trace.complete,true);assert.deepEqual(replayTrace(trace),trace.finalState);
 const first=trace.events.find(e=>e.ruleId==='kmeans-nearest')!;assert.equal(first.calculation?.result,4808);
 assert.equal(first.candidates?.find(c=>c.status==='chosen')?.target,'中心 2');
 for(const event of trace.events){assert(lesson.rules.some(r=>r.id===event.ruleId));if(event.ruleId==='kmeans-nearest'){const values=event.candidates!.map(c=>Number(c.values!['距离平方']));assert.equal(Number(event.calculation!.result.toFixed?.(4)??event.calculation!.result),Math.min(...values));}}
 assert.equal(output.metrics['组内距离平方和'],200);assert.equal(output.metrics['迭代次数'],3);
 assert(trace.events.some(e=>e.ruleId==='kmeans-mean'&&e.calculation));
 const sse=trace.events.filter(e=>e.ruleId==='kmeans-stop').map(e=>Number(e.calculation!.result));for(let i=1;i<sse.length;i++)assert(sse[i]<=sse[i-1]+1e-8);
});
