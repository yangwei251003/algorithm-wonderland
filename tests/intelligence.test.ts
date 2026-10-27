import test from 'node:test';
import assert from 'node:assert/strict';
import { definitions } from '../src/content/intelligence';
import { runners, fitLine } from '../src/algorithms/intelligence';
import { defaults } from '../src/engine/utils';
import type { LabInput, Params, RunResult } from '../src/engine/types';

const run=(id:string,input:LabInput={},params:Params={},seed=42)=>Promise.resolve(runners[id](input,{...defaults(definitions.find(d=>d.id===id)!),...params},seed));
const points=Array.from({length:40},(_,i)=>({x:i%2?80:20,y:i%2?75:25,value:i%2}));
function finite(r:RunResult){assert.ok(r.frames.length>0);assert.ok(r.summary.length>0);const serialized=JSON.stringify(r);assert.ok(!serialized.includes('NaN'));for(const v of Object.values(r.metrics))if(typeof v==='number')assert.ok(Number.isFinite(v));}

test('intelligence has 28 unique complete entries and bounded defaults',()=>{
 assert.equal(definitions.length,28);assert.equal(new Set(definitions.map(d=>d.id)).size,28);
 for(const d of definitions){assert.ok(runners[d.id],d.id);assert.ok(d.controls.length>=2&&d.controls.length<=4,d.id);assert.ok(d.presets.length>=2,d.id);assert.ok(d.steps.length>=3,d.id);assert.ok(d.applications.length>=2,d.id);assert.ok(d.sources.length>0,d.id);assert.ok(d.question.explanation.length>10,d.id);for(const c of d.controls){if(c.type==='range'){assert.ok(Number(c.defaultValue)>=c.min!&&Number(c.defaultValue)<=c.max!,`${d.id}.${c.key}`);for(const p of d.presets)if(p.params[c.key]!==undefined)assert.ok(Number(p.params[c.key])>=c.min!&&Number(p.params[c.key])<=c.max!,`${d.id}.${p.name}.${c.key}`);}}}
});

test('all 28 default and boundary experiments produce finite genuine results',async()=>{
 for(const d of definitions){finite(await run(d.id));for(const p of d.presets)finite(await run(d.id,p.input??{},p.params));}
});

test('least squares recovers an exact line and handles vertical/single-point input',async()=>{
 assert.deepEqual(fitLine([{x:1,y:3},{x:2,y:5},{x:3,y:7}]),{slope:2,intercept:1});
 assert.deepEqual(fitLine([{x:2,y:2},{x:2,y:8}]),{slope:0,intercept:5});
 finite(await run('linear-regression',{points:[{x:10,y:20}]}));
});

test('moving average and alpha=1 smoothing equal independent last-window calculation',async()=>{
 const ys=Array.from({length:32},(_,i)=>Math.round((45+i*.7+8*Math.sin(i*.4))*10)/10);
 const ma=await run('moving-average',{}, {window:4,noise:0,jump:0});
 assert.equal(ma.metrics['下一天预测'],Math.round(ys.slice(-4).reduce((a,b)=>a+b,0)/4*100)/100);
 const es=await run('exponential-smoothing',{}, {alpha:1,noise:0,jump:0});assert.equal(es.metrics['下一天预测'],ys.at(-1));
});

test('Bayesian posterior includes false positives from the large normal population',async()=>{
 const r=await run('bayes',{}, {prior:5,sensitivity:90,falsePositive:10});assert.equal(r.metrics['红灯后缺陷概率'],'32.14%');
 const rare=await run('bayes',{}, {prior:.1,sensitivity:95,falsePositive:5});assert.ok(parseFloat(String(rare.metrics['红灯后缺陷概率']))<2);
});

test('Monte Carlo honors deterministic deadline boundary without noise',async()=>{
 const yes=await run('monte-carlo',{}, {spread:0,deadline:110,samples:40});assert.equal(yes.metrics['按时完成比例'],'100%');
 const no=await run('monte-carlo',{}, {spread:0,deadline:109,samples:40});assert.equal(no.metrics['按时完成比例'],'0%');
});

test('Bootstrap has zero spread for constant observations and handles missing data',async()=>{
 const r=await run('bootstrap',{}, {data:'10,10,10,10',samples:100});assert.equal(r.metrics['95%区间'],'10—10');assert.equal(r.metrics['样本平均'],10);
 finite(await run('bootstrap',{}, {data:'not numbers'}));
});

test('KNN, CART, Gaussian Bayes, logistic regression classify separated held-out points',async()=>{
 for(const id of ['knn','decision-tree','naive-bayes','logistic-regression']){const r=await run(id,{points});assert.equal(r.metrics['验证正确率'],'100%',id);}
});

test('classification frames preserve labels for adding a new point',async()=>{
 const r=await run('logistic-regression',{points});assert.equal(r.frames[0].scene.nodes!.length,points.length);
 r.frames[0].scene.nodes!.forEach((n,i)=>assert.equal(n.value,points[i].value));
 const added=await run('logistic-regression',{points:[...r.frames[0].scene.nodes!,{x:22,y:28,value:0}]});assert.equal(added.frames[0].scene.nodes![1].value,1);
});

test('K-means finds two compact groups and DBSCAN leaves isolated noise',async()=>{
 const km=await run('kmeans',{points},{k:2});assert.equal(km.metrics['组数'],2);
 const db=await run('dbscan',{points:[...points,{x:50,y:2,value:0}]},{eps:8,minimum:3});assert.equal(db.metrics['发现组数'],2);assert.equal(db.metrics['噪声点'],1);
});

test('PCA retains all variance of collinear points',async()=>{
 const r=await run('pca',{points:[{x:20,y:30},{x:40,y:50},{x:60,y:70}]});assert.equal(r.metrics['保留变化'],'100%');
});

test('neural network really reduces training loss and keeps validation separate',async()=>{
 const r=await run('neural-network',{points},{hidden:6,rate:.6});const first=Number(r.frames[0].metrics!['训练损失']),last=Number(r.frames.at(-1)!.metrics!['训练损失']);assert.ok(last<first*.2);assert.equal(r.metrics['验证正确率'],'100%');
});

test('seeded simulation and learning replay identically',async()=>{
 for(const id of ['monte-carlo','bootstrap','kmeans','neural-network'])assert.deepEqual(await run(id,{}, {},123),await run(id,{}, {},123),id);
});

test('each statistical and learning experiment accepts a one-point or empty editing edge',async()=>{
 for(const id of ['linear-regression','logistic-regression','knn','decision-tree','naive-bayes','kmeans','dbscan','pca','neural-network'])finite(await run(id,{points:[{x:50,y:50,value:1}]}));
});
