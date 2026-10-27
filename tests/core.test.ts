import test from 'node:test';
import assert from 'node:assert/strict';
import {definitions} from '../src/content/core';
import {runners} from '../src/algorithms/core';
import {defaults,rng} from '../src/engine/utils';
import {network} from '../src/algorithms/core-graph';
import {assignmentCosts,backpackItems} from '../src/algorithms/core-allocation';
import {cities} from '../src/algorithms/core-optimization';

test('28 个展项契约、全部默认与成功/边界预设可执行，固定种子可复现',async()=>{
 assert.equal(definitions.length,28);assert.equal(Object.keys(runners).length,28);
 for(const d of definitions){assert.ok(runners[d.id],d.id);assert.ok(d.controls.length>=2&&d.controls.length<=4,d.id);assert.ok(d.presets.length>=2);assert.ok(d.sources[0].url.startsWith('https://'));assert.ok(d.question.options[d.question.correct]);
  const a=await runners[d.id]({},defaults(d),812),b=await runners[d.id]({},defaults(d),812);assert.deepEqual(a,b,`${d.id} 必须确定性复现`);assert.ok(a.frames.length>0,`${d.id} 缺少轨迹`);assert.ok(a.frames.every(f=>f.caption&&f.scene.kind));assert.ok(a.summary.length>10);
  for(const p of d.presets){const out=await runners[d.id](p.input??{},{...defaults(d),...p.params},812);assert.ok(out.frames.length>0,`${d.id}/${p.name}`);}
 }
});
test('四种排序处理重复、负值、空列表，计数排序拒绝不适合的跨度',async()=>{
 for(const id of ['quick-sort','merge-sort','heap-sort','counting-sort'])for(const values of [[9,0,-3,9,1,0],[],[4]]){const out=await runners[id]({values},{},2);assert.equal(out.metrics['排序结果'],[...values].sort((a,b)=>a-b).join(','),id);}
 const rejected=await runners['counting-sort']({values:[1,100000]},{},2);assert.equal(rejected.metrics['可执行'],0);
});
test('二分与顺序查找返回正确位置，缺失和空输入明确无解',async()=>{
 for(const id of ['binary-search','linear-search']){const out=await runners[id]({values:[2,5,8,42,99]},{target:42},1);assert.equal(out.metrics['找到位置'],3);assert.equal((await runners[id]({values:[2,5,8]},{target:99},1)).metrics['找到位置'],-1);assert.equal((await runners[id]({values:[]},{target:99},1)).metrics['找到位置'],-1);}
});
test('蓄水池保留无重复合法样本，并在多次试验中近似均匀',async()=>{
 const counts=Array(10).fill(0);for(let seed=0;seed<800;seed++){const out=await runners.reservoir({},{count:10,sample:2},seed);const selected=String(out.metrics['样本']).split(',').map(Number);assert.equal(new Set(selected).size,2);for(const i of selected){assert.ok(i>=1&&i<=10);counts[i-1]++;}}for(const c of counts)assert.ok(c>110&&c<215,`频数 ${c} 异常`);
});
test('A* 与 Dijkstra 在非负地图代价一致；BFS 无墙等代价最短；堵墙无路',async()=>{
 for(const seed of [1,7,42,812]){const p={density:22,terrain:7,mode:'normal'};const a=await runners.astar({},p,seed),d=await runners.dijkstra({},p,seed);assert.equal(a.metrics['找到路线'],1);assert.equal(a.metrics['路线代价'],d.metrics['路线代价']);}
 const b=await runners.bfs({walls:[]},{terrain:1},1);assert.equal(b.metrics['路线步数'],26);assert.equal(b.metrics['路线代价'],26);
 for(const id of ['bfs','dfs','dijkstra','astar']){const out=await runners[id]({},{mode:'blocked',density:18,terrain:4},1);assert.equal(out.metrics['找到路线'],0,id);assert.equal((await runners[id]({walls:[]},{mode:'blocked',terrain:1},1)).metrics['找到路线'],1,`${id}: []必须代表清空墙`);}
});
test('Kruskal 最小生成树与独立 Prim 基准一致，Floyd 查询与独立最短路一致',async()=>{
 const p={nodes:6,density:65};for(const seed of [2,10,812]){const net=network(p,seed),chosen=new Set([0]);let total=0;while(chosen.size<net.n){const next=net.edges.filter(e=>chosen.has(e.u)!==chosen.has(e.v)).sort((a,b)=>a.w-b.w)[0];total+=next.w;chosen.add(next.u);chosen.add(next.v);}assert.equal((await runners.kruskal({},p,seed)).metrics['最低总费用'],total);
 const dist=Array(net.n).fill(Infinity);dist[0]=0;for(let k=0;k<net.n;k++)for(const e of net.edges){dist[e.v]=Math.min(dist[e.v],dist[e.u]+e.w);dist[e.u]=Math.min(dist[e.u],dist[e.v]+e.w);}assert.equal((await runners['floyd-warshall']({},p,seed)).metrics['查询距离'],dist[net.n-1]);}
});
test('拓扑排序识别循环',async()=>{assert.equal((await runners.topological({},{nodes:8,cycle:'no'},10)).metrics['可行'],1);assert.equal((await runners.topological({},{nodes:8,cycle:'yes'},10)).metrics['可行'],0);});
test('背包最优值与所有子集穷举一致',async()=>{
 const p={capacity:9,items:'A:4:9,B:2:5,C:3:7,D:3:6,E:7:13,F:2:3'},items=backpackItems(p);let best=0;for(let mask=0;mask<1<<items.length;mask++){let w=0,v=0;items.forEach((x,i)=>{if(mask&(1<<i)){w+=x.weight;v+=x.value;}});if(w<=p.capacity)best=Math.max(best,v);}const out=await runners.knapsack({},p,1);assert.equal(out.metrics['总价值'],best);assert.ok(Number(out.metrics['已用容量'])<=p.capacity);assert.equal((await runners.knapsack({},{...p,capacity:0},1)).metrics['总价值'],0);
});
test('匈牙利分配与独立全排列基准一致',async()=>{
 const p={size:5,specialty:6};for(const seed of [1,32,812]){const cost=assignmentCosts(p,seed);let best=Infinity;const walk=(row:number,used:number,sum:number)=>{if(row===cost.length){best=Math.min(best,sum);return;}for(let j=0;j<cost.length;j++)if(!(used&(1<<j)))walk(row+1,used|1<<j,sum+cost[row][j]);};walk(0,0,0);const out=await runners.hungarian({},p,seed);assert.equal(out.metrics['最小总工时'],best);}
});
test('稳定匹配没有阻挡配对，最大流等于最小割，着色没有冲突',async()=>{
 for(const seed of [0,5,77])for(const preference of ['mixed','aligned'])assert.equal((await runners['stable-matching']({},{size:6,preference},seed)).metrics['不稳定配对'],0);
 for(const capacity of [1,5,10])for(const bottleneck of [0,4,15]){const out=await runners['max-flow']({},{capacity,bottleneck},1);assert.equal(out.metrics['最大流量'],out.metrics['最小割容量']);}
 for(const seed of [1,7,33])assert.equal((await runners['graph-coloring']({},{nodes:10,density:85},seed)).metrics['冲突数'],0);
});
test('关键路径工期与独立两条分支计算一致',async()=>{
 for(const seed of [1,7,33]){const random=rng(seed),d=Array.from({length:7},()=>2+Math.floor(random()*5));d[2]+=8;const expected=d[0]+Math.max(d[1]+d[3],d[2]+d[4])+d[5]+d[6];assert.equal((await runners['critical-path']({},{task:2,delay:8},seed)).metrics['最短工期'],expected);}
});
test('爬山法可被局部最优困住，粒子群和退火保存最好值',async()=>{
 const small=await runners['hill-climbing']({},{start:15,step:3},1),large=await runners['hill-climbing']({},{start:60,step:3},1);assert.ok(Number(large.metrics['当前最好收益'])>Number(small.metrics['当前最好收益'])+20);
 for(const id of ['annealing','pso']){const out=await runners[id]({},{},812),best=out.frames.map(f=>Number(f.metrics?.['最好收益'])).filter(Number.isFinite);for(let i=1;i<best.length;i++)assert.ok(best[i]>=best[i-1]-1e-9,id);}
});
test('遗传与蚁群路线是有效排列，长度来自实际坐标',async()=>{
 for(const id of ['genetic','ant-colony']){const p={cities:8,iterations:25},points=cities({},p,812),out=await runners[id]({},p,812),route=String(out.metrics['路线索引']).split(',').map(Number);assert.equal(route.length,8);assert.equal(new Set(route).size,8);const length=route.reduce((s,v,i)=>s+Math.hypot(points[v].x-points[route[(i+1)%8]].x,points[v].y-points[route[(i+1)%8]].y),0);assert.ok(Math.abs(Number(out.metrics['当前最短路线'])-length)<.011);}
});
test('生成的旅行地点保持可读间距，自定义坐标保留原样',()=>{for(const seed of [0,1,5,42,812,9917]){const points=cities({},{cities:12},seed);for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>=12);}const custom=[{x:10,y:10},{x:10.1,y:10.1},{x:90,y:90}];const points=cities({points:custom},{},1);assert.equal(points[1].x,10.1);});
test('单纯形结果符合资源约束并与独立顶点枚举一致',async()=>{
 for(const p of [{profitA:5,profitB:4,capacity:12,material:18},{profitA:9,profitB:2,capacity:7,material:8},{profitA:1,profitB:12,capacity:16,material:3}]){const cons=[[1,1,p.capacity],[2,1,p.material],[1,0,8],[0,1,9],[-1,0,0],[0,-1,0]];let best=0;for(let i=0;i<cons.length;i++)for(let j=i+1;j<cons.length;j++){const [a,b,c]=cons[i],[d,e,f]=cons[j],det=a*e-b*d;if(!det)continue;const x=(c*e-b*f)/det,y=(a*f-c*d)/det;if(cons.every(([a,b,c])=>a*x+b*y<=c+1e-8))best=Math.max(best,p.profitA*x+p.profitB*y);}assert.ok(Math.abs(Number((await runners.simplex({},p,1)).metrics['最优收益'])-best)<.011);}
});
test('整数规划分支定界与整数网格穷举一致',async()=>{
 for(const budget of [1,8,17,31])for(const time of [1,12,29]){const p={budget,time,profitA:7,profitB:9};let best=0;for(let a=0;a<=budget;a++)for(let b=0;b<=budget;b++)if(2*a+3*b<=budget&&3*a+b<=time)best=Math.max(best,7*a+9*b);const out=await runners['branch-bound']({},p,1);assert.equal(out.metrics['最优收益'],best,JSON.stringify(p));}
});
test('截断长排序轨迹仍保留真实最终帧，并披露省略画面',async()=>{
 const out=await runners['quick-sort']({},{count:40,order:'reverse'},909);assert.ok(Number(out.metrics['省略中间画面'])>0);assert.deepEqual(out.frames.at(-1)?.scene.values,String(out.metrics['排序结果']).split(',').map(Number));assert.match(out.frames.at(-1)!.caption,/省略/);assert.ok(out.frames.length<=651);
});
test('额外种子与全低/全高控件组合均完成，数值指标有限',async()=>{
 for(const d of definitions)for(const high of [false,true]){const p=defaults(d);for(const c of d.controls){if(c.type==='range')p[c.key]=(high?c.max:c.min)??c.defaultValue;if(c.type==='select')p[c.key]=(high?c.options?.at(-1):c.options?.[0])?.value??c.defaultValue;}const out=await runners[d.id]({},p,high?3927:18761);assert.ok(out.frames.length,d.id);for(const [k,v]of Object.entries(out.metrics))if(typeof v==='number')assert.ok(Number.isFinite(v),`${d.id}:${k}`);}
});
test('无效背包条目不会被静默丢弃',async()=>{const out=await runners.knapsack({},{capacity:9,items:'相机:错误:8,雨衣:2:5'},1);assert.equal(out.metrics['输入有效'],0);});
