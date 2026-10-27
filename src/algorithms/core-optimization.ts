import type {Frame, LabInput, Params, Runner, Scene, VisualNode} from '../engine/types';
import {clamp,frame,num,result,rng,round} from '../engine/utils';
import {TraceRecorder,record,finite,numbers} from './core-teaching';

const height=(x:number)=>40*Math.exp(-(((x-24)/13)**2))+72*Math.exp(-(((x-76)/12)**2))+4*Math.sin(x/5);
const landscape=(positions:number[],best:number,title:string):Scene=>({kind:'scatter',title,paths:[{points:Array.from({length:101},(_,x)=>({x,y:92-height(x)})),color:'#547c88'}],nodes:positions.map<VisualNode>((x,i)=>({id:String(i),x,y:92-height(x),r:3,color:'#78edd0'})).concat([{id:'best',x:best,y:92-height(best),r:5,color:'#f6c37b',label:`最好 ${round(height(best))}`}]),note:'横轴：候选方案；高度越高，收益越好。金色记录目前最好。'});
const hill:Runner=(_input,p,seed)=>{
 let x=clamp(num(p,'start',15),0,100);const step=clamp(num(p,'step',3),0.5,15),frames:Frame[]=[],rec=new TraceRecorder('hill-climbing',seed,{position:x,value:height(x)});let stopped=false;
 frames.push(frame(landscape([x],x,'只朝附近更高的地方走'),'先固定起点和左右步长。'));record(rec,frames,{phase:'initialize',ruleId:'hill-climbing.initialize',action:'选择起点',explanation:`从${x}开始，每次只看左右各${step}的邻居，边界限制0到100。`});
 for(let i=0;i<120;i++){
  const candidates=[clamp(x-step,0,100),x,clamp(x+step,0,100)].sort((a,b)=>height(b)-height(a)),best=candidates[0],better=height(best)>height(x)+1e-9;
  frames.push(frame(landscape([x],x,'只朝附近更高的地方走'),`当前位置${round(x)}，收益${round(height(x))}。`,{'当前收益':round(height(x)),'移动次数':i}));
  record(rec,frames,{phase:'compare',ruleId:'hill-climbing.compare',action:'比较左右与原地',explanation:better?`邻居${round(best)}的收益${round(height(best))}严格更高，接受小步。`:'左右邻居都没有严格提高，附近无改进。',candidates:candidates.map(v=>({target:String(round(v)),status:(better?v===best:v===x)?'chosen':'rejected',reason:v===x?'保留当前基准':height(v)>height(x)+1e-9?(v===best?'可达邻居中收益最高':'比所选邻居收益低'):'没有严格高于当前位置',values:{position:v,value:height(v)}})),calculation:{formula:'accept iff max(neighborValue)>currentValue+ε',values:{current:height(x),candidate:height(best),epsilon:1e-9},result:better?'移动':'停止'}});
  if(!better){stopped=true;break;}x=best;record(rec,frames,{phase:'move',ruleId:'hill-climbing.move',action:'移动到更高邻居',explanation:`只采用已经比较出的严格改进，位置更新为${round(x)}。`},{position:x,value:height(x)},landscape([x],x,'小步改善'));
 }
 record(rec,frames,{phase:'stop',ruleId:'hill-climbing.stop',action:stopped?'局部无改进':'达到教学迭代上限',explanation:stopped?'只证明当前步长下邻居不更好，不能证明远处没有更高峰。':'已完整记录120轮，按预设预算停止，不声称已到局部最优。'},{stopped});
 return {...result(frames,`停在方案 ${round(x)}，收益 ${round(height(x))}。${stopped?'附近已没有更好的固定小步，但远处可能还有更高的山。':'本次已用完120轮预算，仍不保证全局最优。'}`,{'当前最好收益':round(height(x)),'方案位置':round(x)}),trace:rec.trace};
};
const annealing:Runner=(_input,p,seed)=>{
 const random=rng(seed);let x=clamp(num(p,'start',15),0,100),best=x,temp=clamp(num(p,'temperature',25),0.01,100);const cooling=clamp(num(p,'cooling',0.97),0.8,0.999),frames:Frame[]=[],rec=new TraceRecorder('annealing',seed,{position:x,best,temperature:temp,bestValue:height(best)});let acceptedWorse=0;
 frames.push(frame(landscape([x],best,'偶尔下坡，寻找更高的山'),'最大化收益；较差方案按温度相关概率接受。'));record(rec,frames,{phase:'initialize',ruleId:'annealing.initialize',action:'建立探索温度',explanation:`初温${temp}，冷却保留率${cooling}，总预算160轮；比较时温度下限0.001。`});
 for(let i=0;i<160;i++){
  const randomOffset=random(),candidate=clamp(x+(randomOffset*2-1)*18,0,100),delta=height(candidate)-height(x),probability=delta>=0?1:Math.exp(delta/Math.max(.001,temp)),draw=delta>=0?null:random(),accept=delta>=0||draw!<probability;
  record(rec,frames,{phase:'accept',ruleId:'annealing.accept',action:'比较新尝试并抽签',explanation:delta>=0?`收益提高${round(delta)}，直接接受，不需要接受抽签。`:`收益差Δ=${round(delta)}<0；p=exp(Δ/T)=${round(probability,5)}，抽签${round(draw!,5)}${accept?'<':'≥'}p，${accept?'接受暂时变差':'拒绝本次尝试'}。`,calculation:{formula:'p=min(1, exp((newValue−oldValue)/max(T,0.001)))',values:{oldValue:height(x),newValue:height(candidate),delta,T:temp,draw:draw??'无需抽签'},result:probability},candidates:[{target:String(round(candidate)),status:accept?'chosen':'rejected',reason:delta>=0?'不差于当前':accept?'抽签落在允许下坡概率内':'抽签未落入接受区间'}]},{candidate,delta,accept},landscape([x,candidate],best,'比较新尝试与接受概率'));
  if(accept){if(delta<0)acceptedWorse++;x=candidate;const improve=height(x)>height(best);if(improve)best=x;record(rec,frames,{phase:'remember',ruleId:'annealing.remember',action:'更新当前位置与历史最好',explanation:improve?'本次还超过历史最好，更新最好记录。':'当前位置改变，但历史最好不因下坡而丢失。'},{position:x,best,bestValue:height(best),acceptedWorse},landscape([x],best,'当前位置与历史最好分开记'));
  }
  if(i%2===0)frames.push(frame(landscape([x],best,'偶尔下坡，寻找更高的山'),`${accept?delta<0?'接受一次下坡':'接受不差方案':'拒绝本次尝试'}，温度${round(temp)}。`,{'当前收益':round(height(x)),'最好收益':round(height(best)),'温度':round(temp)}));
  const oldTemp=temp;temp*=cooling;record(rec,frames,{phase:'cool',ruleId:'annealing.cool',action:'降低探索温度',explanation:`温度${round(oldTemp,5)}×${cooling}=${round(temp,5)}；同样差距的下坡以后更难接受。`,calculation:{formula:'Tnext=T×cooling',values:{T:oldTemp,cooling},result:temp}},{temperature:temp});
 }
 record(rec,frames,{phase:'stop',ruleId:'annealing.stop',action:'预算结束，返回历史最好',explanation:'完整160轮已执行；有限退火只提供当前发现的最好方案，不是最优性证明。'});
 return {...result(frames,`目前最好收益 ${round(height(best))}；接受了 ${acceptedWorse} 次下坡。随机探索不保证每次找到全局最高点。`,{'当前最好收益':round(height(best)),'方案位置':round(best),'接受下坡次数':acceptedWorse}),trace:rec.trace};
};
const pso:Runner=(_input,p,seed)=>{
 const random=rng(seed),n=clamp(Math.round(num(p,'particles',16)),3,35),inertia=clamp(num(p,'inertia',.65),0,1.2),iterations=clamp(Math.round(num(p,'iterations',60)),10,100),x=Array.from({length:n},()=>random()*100),velocity=Array(n).fill(0),personal=[...x];let best=x.reduce((a,b)=>height(a)>height(b)?a:b);
 const frames:Frame[]=[],rec=new TraceRecorder('pso',seed,{positions:[...x],velocity:[...velocity],personal:[...personal],best,bestValue:height(best)});
 frames.push(frame(landscape(x,best,'一群探索者分享好位置'),'每个粒子记住自己的最好经历，并共享群体最好位置。'));record(rec,frames,{phase:'initialize',ruleId:'pso.initialize',action:'初始化群体与记忆',explanation:'初速度为0；初始位置就是各自最好，群体取其中收益最大者。',candidates:x.map((v,i)=>({target:String(i),status:v===best?'chosen':'deferred',reason:v===best?'初始最高收益':'仍参与探索',values:{position:v,value:height(v)}}))});
 for(let t=0;t<iterations;t++){
  for(let i=0;i<n;i++){
   const r1=random(),r2=random(),oldX=x[i],oldV=velocity[i],personalPull=1.5*r1*(personal[i]-oldX),socialPull=1.5*r2*(best-oldX),raw=inertia*oldV+personalPull+socialPull;
   velocity[i]=clamp(raw,-18,18);x[i]=clamp(oldX+velocity[i],0,100);
   record(rec,frames,{phase:'move',ruleId:'pso.move',action:`更新第${i+1}个粒子`,explanation:`惯性${round(inertia*oldV)}＋个人牵引${round(personalPull)}＋群体牵引${round(socialPull)}=${round(raw)}；速度限幅±18后为${round(velocity[i])}，位置截回0…100。`,calculation:{formula:'v=clip(w·v+1.5·r1·(pbest−x)+1.5·r2·(gbest−x),−18,18)',values:{inertia,oldVelocity:oldV,r1,r2,personal:personal[i],global:best,oldX,raw},result:velocity[i]},focus:[String(i)]},{positions:[...x],velocity:[...velocity]},landscape(x,best,'三个分量共同决定移动'));
   const pOld=personal[i],personalBetter=height(x[i])>height(pOld);if(personalBetter)personal[i]=x[i];record(rec,frames,{phase:'personal',ruleId:'pso.remember',action:'比较个人最好',explanation:`新收益${round(height(x[i]))}${personalBetter?'>':'≤'}历史${round(height(pOld))}，${personalBetter?'更新':'保留'}个人记忆。`},{personal:[...personal]});
   const gOld=best,globalBetter=height(x[i])>height(gOld);if(globalBetter)best=x[i];record(rec,frames,{phase:'global',ruleId:'pso.remember',action:'比较群体最好',explanation:`新收益${round(height(x[i]))}${globalBetter?'>':'≤'}群体记录${round(height(gOld))}，${globalBetter?'立即更新，后面的粒子会参考新记录':'保留群体记录'}。`},{best,bestValue:height(best)});
  }
  frames.push(frame(landscape(x,best,'一群探索者分享好位置'),`第${t+1}轮已逐个更新粒子；本版采用即时共享的顺序更新。`,{'轮次':t+1,'最好收益':round(height(best))}));
 }
 record(rec,frames,{phase:'stop',ruleId:'pso.stop',action:'固定轮数结束',explanation:`完成${iterations}轮。共享记忆引导搜索，但有限群体不证明全局最优。`});return {...result(frames,`粒子群目前找到收益 ${round(height(best))} 的位置。交流能加快搜索，也可能让全群过早聚到同一区域。`,{'当前最好收益':round(height(best)),'粒子数量':n,'方案位置':round(best)}),trace:rec.trace};
};

export function cities(input:LabInput,p:Params,seed:number){if(input.points&&input.points.length>=3)return input.points.slice(0,14).map((v,i)=>({...v,id:String(i),label:String(i+1)}));const random=rng(seed),n=clamp(Math.round(num(p,'cities',9)),4,12),points:VisualNode[]=[];for(let i=0;i<n;i++){let point:VisualNode={id:String(i),x:12,y:12,label:String(i+1)};for(let trial=0;trial<800;trial++){point={id:String(i),x:12+random()*76,y:12+random()*76,label:String(i+1)};if(points.every(q=>Math.hypot(q.x-point.x,q.y-point.y)>=12))break;}points.push(point);}return points;}
const distance=(a:VisualNode,b:VisualNode)=>Math.hypot(a.x-b.x,a.y-b.y);
const tourLength=(points:VisualNode[],tour:number[])=>tour.reduce((s,v,i)=>s+distance(points[v],points[tour[(i+1)%tour.length]]),0);
function tourScene(points:VisualNode[],tour:number[],title:string):Scene{return{kind:'graph',title,nodes:points,edges:tour.map((v,i)=>({from:String(v),to:String(tour[(i+1)%tour.length]),color:'#78edd0',width:2})),note:'每个地点恰好访问一次，最后回到出发点。距离单位为地图坐标单位。'};}
const genetic:Runner=(input,p,seed)=>{
 const points=cities(input,p,seed),n=points.length,random=rng(seed+991),size=clamp(Math.round(num(p,'population',30)),6,60),mutation=clamp(num(p,'mutation',.18),0,1),generations=clamp(Math.round(num(p,'iterations',60)),5,100);
 const shuffled=()=>{const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let population=Array.from({length:size},shuffled),best=[...population[0]],bestLength=tourLength(points,best);const frames:Frame[]=[],rec=new TraceRecorder('genetic',seed,{best:[...best],bestLength,generation:0});
 const fitness=(a:number[])=>tourLength(points,a);frames.push(frame(tourScene(points,best,'让旅行路线一代代进化'),'初始每条候选都是所有城市的一个排列。'));record(rec,frames,{phase:'initialize',ruleId:'genetic.initialize',action:'准备有效路线种群',explanation:`${size}条随机排列，每条均恰好访问各城一次并返回起点。总长度是要最小化的适应度。`});
 for(let g=0;g<generations;g++){
  population.sort((a,b)=>fitness(a)-fitness(b));const improved=fitness(population[0])<bestLength;if(improved){best=[...population[0]];bestLength=fitness(best);}
  frames.push(frame(tourScene(points,best,'让旅行路线一代代进化'),`第${g+1}代排名与最好记录。`,{'代数':g+1,'当前最短':round(bestLength)}));record(rec,frames,{phase:'rank',ruleId:'genetic.select',action:'按真实路线长度排名',explanation:`最短候选${round(fitness(population[0]))}，${improved?'改进历史最好':'未超过历史最好'}。`,candidates:population.map((route,i)=>({target:'候选'+i,status:i===0?'chosen':'deferred',reason:i===0?'本代最短，精英保留':'仍可参加随机锦标赛',values:{length:fitness(route)}}))},{generation:g+1,best:[...best],bestLength});
  if(g===generations-1)break;
  const tournament=()=>{let index=Math.floor(random()*size);record(rec,frames,{phase:'tournament',ruleId:'genetic.select',action:'抽取锦标赛首位',explanation:`均匀抽到候选${index}，长度${round(fitness(population[index]))}。`},{parentCandidate:index});for(let k=0;k<2;k++){const challenger=Math.floor(random()*size),old=index,win=fitness(population[challenger])<fitness(population[index]);if(win)index=challenger;record(rec,frames,{phase:'tournament',ruleId:'genetic.select',action:'三人锦标赛逐次比较',explanation:`候选${challenger}长${round(fitness(population[challenger]))}，对比${old}长${round(fitness(population[old]))}，${win?'替换胜者':'保留原胜者'}。`,calculation:{formula:'choose shorter of sampled candidates',values:{challenger:fitness(population[challenger]),incumbent:fitness(population[old])},result:fitness(population[index])}},{parentCandidate:index});}return population[index];};
  const next=[best];record(rec,frames,{phase:'elite',ruleId:'genetic.select',action:'保留精英',explanation:'将历史最好直接放入下一代，避免交叉与突变使它丢失。'});
  while(next.length<size){const a=tournament(),b=tournament();let lo=Math.floor(random()*n),hi=Math.floor(random()*n);if(lo>hi)[lo,hi]=[hi,lo];const child=Array<number>(n).fill(-1),used=new Set<number>();record(rec,frames,{phase:'cross',ruleId:'genetic.cross',action:'选定保序交叉区间',explanation:`父A区间[${lo},${hi}]原位复制，其余按父B的循环次序补入未出现城市。`},{parentA:[...a],parentB:[...b],child:[...child],lo,hi});
   for(let i=lo;i<=hi;i++){child[i]=a[i];used.add(a[i]);record(rec,frames,{phase:'cross',ruleId:'genetic.cross',action:'复制父A片段',explanation:`子代位置${i}放入城市${a[i]+1}，同时登记它已使用。`},{child:[...child]});}
   let pos=(hi+1)%n;for(let k=0;k<n;k++){const city=b[(hi+1+k)%n],skip=used.has(city);if(!skip){child[pos]=city;pos=(pos+1)%n;}record(rec,frames,{phase:'cross',ruleId:'genetic.cross',action:'按父B顺序填空位',explanation:skip?`城市${city+1}已在父A片段中，跳过以避免重复。`:`城市${city+1}尚未出现，填入下一个空位。`,candidates:[{target:String(city+1),status:skip?'rejected':'chosen',reason:skip?'已使用，不能重复访问':'未使用且保持父B相对顺序'}]},{child:[...child]});}
   const draw=random(),mutate=draw<mutation;if(mutate){const i=Math.floor(random()*n),j=Math.floor(random()*n);[child[i],child[j]]=[child[j],child[i]];record(rec,frames,{phase:'mutate',ruleId:'genetic.mutate',action:'交换突变',explanation:`抽签${round(draw,4)}<${mutation}，交换位置${i}与${j}；排列合法性不变。`},{child:[...child]});}else record(rec,frames,{phase:'mutate',ruleId:'genetic.mutate',action:'本次不突变',explanation:`抽签${round(draw,4)}≥${mutation}，保留交叉结果。`});
   next.push(child);record(rec,frames,{phase:'offspring',ruleId:'genetic.cross',action:'将合法子代加入下一代',explanation:`子代含${n}个不同城市，路线长${round(fitness(child))}；下一代已有${next.length}/${size}条。`},{childLength:fitness(child),nextSize:next.length});
  }
  population=next;
 }
 record(rec,frames,{phase:'stop',ruleId:'genetic.stop',action:'代数预算结束',explanation:`评估了${generations}代；返回最好已见路线，不承诺遍历所有排列。`});return {...result(frames,`经过 ${generations} 代，当前最好路线长 ${round(bestLength)}。它是搜索到的最好方案，不是最优性证明。`,{'当前最短路线':round(bestLength),'访问顺序':best.map(v=>v+1).concat(best[0]+1).join(' → '),'地点数':n,'路线索引':best.join(',')}),trace:rec.trace};
};
const ant:Runner=(input,p,seed)=>{
 const points=cities(input,p,seed),n=points.length,random=rng(seed+991),ants=clamp(Math.round(num(p,'ants',15)),3,40),evaporation=clamp(num(p,'evaporation',.25),.01,.9),iterations=clamp(Math.round(num(p,'iterations',50)),5,100),pheromone=Array.from({length:n},()=>Array(n).fill(1)),dist=points.map(a=>points.map(b=>Math.max(.01,distance(a,b))));let best=Array.from({length:n},(_,i)=>i),bestLength=tourLength(points,best);
 const frames:Frame[]=[],rec=new TraceRecorder('ant-colony',seed,{best:[...best],bestLength,pheromone:pheromone.map(row=>[...row]),route:[]});frames.push(frame(tourScene(points,best,'好路线留下更多信息素'),'基础Ant System：信息素一次方、距离倒数平方，按权重随机选。'));record(rec,frames,{phase:'initialize',ruleId:'ant-colony.initialize',action:'建立信息素与距离表',explanation:'初始信息素全1；本例α=1、β=2，不使用ACS的局部更新或确定性选最优分支。'});
 for(let t=0;t<iterations;t++){
  const tours:number[][]=[];
  for(let a=0;a<ants;a++){
   const route=[a%n],unvisited=new Set(Array.from({length:n},(_,i)=>i).filter(i=>i!==route[0]));record(rec,frames,{phase:'start',ruleId:'ant-colony.choose',action:`第${a+1}只蚂蚁从城市${route[0]+1}出发`,explanation:'已访问城市从候选中删除，每个城市本次只能访问一次。'},{route:[...route],unvisited:[...unvisited]});
   while(unvisited.size){const candidates=[...unvisited],last=route.at(-1)!,weights=candidates.map(v=>pheromone[last][v]/dist[last][v]**2),sum=weights.reduce((s,v)=>s+v,0),draw=random();let remaining=draw*sum,chosen=candidates.at(-1)!;for(let j=0;j<candidates.length;j++){remaining-=weights[j];if(remaining<=0){chosen=candidates[j];break;}}
    route.push(chosen);unvisited.delete(chosen);record(rec,frames,{phase:'choose',ruleId:'ant-colony.choose',action:'按信息素与距离加权抽签',explanation:`从城市${last+1}出发，权重τ/d²归一化成概率。抽签r=${round(draw,5)}落入城市${chosen+1}的累积区间；没有选中的城市仍可在本趟稍后访问。`,calculation:{formula:'P(v)=τ(last,v)/d(last,v)² ÷ Σweights',values:{draw,totalWeight:sum,chosenP:weights[candidates.indexOf(chosen)]/sum},result:chosen+1},candidates:candidates.map((v,j)=>({target:String(v+1),status:v===chosen?'chosen':'deferred',reason:v===chosen?'随机数落在该候选累积概率段':'本步未抽中，不表示路线无用',values:{pheromone:pheromone[last][v],distance:dist[last][v],weight:weights[j],probability:weights[j]/sum}}))},{route:[...route],unvisited:[...unvisited]});
   }
   tours.push(route);const length=tourLength(points,route),improve=length<bestLength;if(improve){best=[...route];bestLength=length;}record(rec,frames,{phase:'evaluate',ruleId:'ant-colony.evaluate',action:'回到起点并计算闭环长度',explanation:`${route.map(v=>v+1).concat(route[0]+1).join('→')}长${round(length)}，${improve?'更新历史最好':'保留已有更短或相等路线'}。`},{best:[...best],bestLength,tourLength:length});
  }
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)pheromone[i][j]*=1-evaporation;
  record(rec,frames,{phase:'evaporate',ruleId:'ant-colony.evaporate',action:'所有边统一蒸发',explanation:`每条有向存储边都乘(1−${evaporation})；独立的相同更新在一次批操作中完成，变化表保留全部矩阵值。`,calculation:{formula:'τ(i,j)←(1−ρ)τ(i,j)',values:{rho:evaporation,factor:1-evaporation},result:1-evaporation}},{pheromone:pheromone.map(row=>[...row])});
  for(const route of tours){const length=tourLength(points,route),deposit=100/length;for(let k=0;k<n;k++){const a=route[k],b=route[(k+1)%n];pheromone[a][b]+=deposit;pheromone[b][a]+=deposit;}
   record(rec,frames,{phase:'deposit',ruleId:'ant-colony.deposit',action:'沿这只蚂蚁的每条边留信号',explanation:`闭环长度${round(length)}，每条经过边两方向都增加100/L=${round(deposit,5)}。完整路线 ${route.map(v=>v+1).concat(route[0]+1).join('→')}；短路线每边留得更多。`,calculation:{formula:'Δτ=100/L; τ(edge) += Δτ',values:{length,Q:100,edgeCount:n},result:deposit}},{pheromone:pheromone.map(row=>[...row]),depositRoute:[...route]});
  }
  frames.push(frame(tourScene(points,best,'好路线留下更多信息素'),`第${t+1}轮：${ants}只蚂蚁完成旅行，旧信号蒸发${round(evaporation*100)}%，再增加各条路线信号。`,{'轮次':t+1,'当前最短':round(bestLength)}));
 }
 record(rec,frames,{phase:'stop',ruleId:'ant-colony.stop',action:'迭代预算结束',explanation:'返回搜索中实际发现的最短闭环；概率选择与蒸发均不提供有限步全局最优保证。'});
 return {...result(frames,`蚁群当前找到长度 ${round(bestLength)} 的闭合路线。调整蒸发率可以改变探索与跟随的平衡。`,{'当前最短路线':round(bestLength),'访问顺序':best.map(v=>v+1).concat(best[0]+1).join(' → '),'地点数':n,'路线索引':best.join(',')}),trace:rec.trace};
};

type Constraint={a:number;b:number;c:number};
function vertices(constraints:Constraint[]){const out:{x:number;y:number}[]=[];for(let i=0;i<constraints.length;i++)for(let j=i+1;j<constraints.length;j++){const a=constraints[i],b=constraints[j],det=a.a*b.b-a.b*b.a;if(Math.abs(det)<1e-9)continue;const x=(a.c*b.b-a.b*b.c)/det,y=(a.a*b.c-a.c*b.a)/det;if(constraints.every(c=>c.a*x+c.b*y<=c.c+1e-7))out.push({x,y});}return out;}
const simplex:Runner=(_input,p,seed)=>{
 const ca=num(p,'profitA',5),cb=num(p,'profitB',4),capacity=Math.max(0,num(p,'capacity',12)),material=Math.max(0,num(p,'material',18)),a=[[1,1],[2,1],[1,0],[0,1]],b=[capacity,material,8,9],m=a.length,n=2,table=a.map((row,i)=>[...row,...Array.from({length:m},(_,j)=>i===j?1:0),b[i]]);table.push([-ca,-cb,...Array(m).fill(0),0]);
 const basis=Array.from({length:m},(_,i)=>n+i),frames:Frame[]=[],rec=new TraceRecorder('simplex',seed,{table:table.map(row=>[...row]),basis:[...basis]});let pivots=0,status='budget';
 const constraints:Constraint[]=a.map((row,i)=>({a:row[0],b:row[1],c:b[i]})).concat([{a:-1,b:0,c:0},{a:0,b:-1,c:0}]),verts=vertices(constraints),center={x:verts.reduce((s,v)=>s+v.x,0)/Math.max(1,verts.length),y:verts.reduce((s,v)=>s+v.y,0)/Math.max(1,verts.length)};verts.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));const scale=Math.max(10,capacity,material/2),display=(v:{x:number;y:number})=>({x:8+v.x/scale*84,y:92-v.y/scale*84});
 const solution=()=>{const x=[0,0];basis.forEach((v,i)=>{if(v<n)x[v]=table[i][n+m];});return x;};
 const tableScene=(row=-1,col=-1):Scene=>({kind:'matrix',matrix:table.map(r=>[...r]),columnLabels:['A','B','余量1','余量2','余量3','余量4','右侧'],rowLabels:[...basis.map(v=>'基'+v),'目标行'],active:row>=0?[row*(n+m+1)+col]:[],title:'每一步都是等式账本的合法变换'});
 const snap=(caption:string)=>{const [x,y]=solution();frames.push({scene:{kind:'scatter',title:'在可行区域的角点间移动',polygons:[{points:verts.map(display),color:'rgba(120,237,208,0.18)'}],paths:[{points:verts.concat(verts.slice(0,1)).map(display),color:'#78edd0'}],nodes:[{...display({x,y}),label:`A ${round(x)} / B ${round(y)}`,color:'#f6c37b',r:5}]},secondaryScene:tableScene(),caption,metrics:{'A产量':round(x),'B产量':round(y),'收益':round(ca*x+cb*y)}});};
 snap('从零产量与非负资源余量构成的可行基开始。');record(rec,frames,{phase:'initialize',ruleId:'simplex.initialize',action:'把资源限制变成等式账本',explanation:'加入非负余量变量；目标行记负收益系数，负系数表示还有能提高收益的方向。'});
 for(let iter=0;iter<30;iter++){
  let enter=-1;for(let j=0;j<n+m;j++){const improves=table[m][j]<-1e-8,better=improves&&(enter<0||table[m][j]<table[m][enter]);if(better)enter=j;record(rec,frames,{phase:'enter',ruleId:'simplex.enter',action:'检查入基变量'+j,explanation:`目标行系数${round(table[m][j],6)}${improves?'为负，有改进方向':'不够负，没有严格改进'}；${better?'成为目前最负候选':'保留已有候选'}。`,calculation:{formula:'choose most negative reduced coefficient < −1e−8',values:{coefficient:table[m][j]},result:enter},candidates:[{target:String(j),status:better?'chosen':improves?'deferred':'rejected',reason:better?'目前最负':improves?'存在更负或同值先到候选':'无改进方向'}]},{enter},tableScene(m,j));}
  if(enter<0){status='optimal';record(rec,frames,{phase:'stop',ruleId:'simplex.stop',action:'没有改进方向',explanation:'可行基的所有目标行系数都不够负，本线性规划已最优。'});break;}
  let leave=-1;for(let i=0;i<m;i++){const coeff=table[i][enter],positive=coeff>1e-8,ratio=positive?table[i][n+m]/coeff:Infinity,better=positive&&(leave<0||ratio<table[leave][n+m]/table[leave][enter]-1e-9);if(better)leave=i;record(rec,frames,{phase:'leave',ruleId:'simplex.leave',action:'检查离基资源行'+i,explanation:positive?`右侧${round(table[i][n+m])}÷正系数${round(coeff)}=${round(ratio)}；${better?'成为最小可行比值':'已有更紧或同值先到限制'}。`:'入基列系数非正，增加入基量不会消耗这项余量，不参加比值限制。',calculation:{formula:'ratio=rhs/a[i,enter] only when a>0',values:{rhs:table[i][n+m],coefficient:coeff},result:finite(ratio)},candidates:[{target:String(i),status:better?'chosen':positive?'deferred':'rejected',reason:positive?(better?'目前最先触碰资源限制':'其他行更先触碰'):'系数非正不限制增加'}]},{leave},tableScene(i,enter));}
  if(leave<0){status='unbounded';record(rec,frames,{phase:'stop',ruleId:'simplex.stop',action:'改进方向没有资源上限',explanation:'存在改善目标的入基变量，却没有正系数比值限制，因此目标无界。'});break;}
  const pivot=table[leave][enter];for(let j=0;j<=n+m;j++){const old=table[leave][j];table[leave][j]/=pivot;record(rec,frames,{phase:'pivot',ruleId:'simplex.pivot',action:'把主元行除以主元',explanation:`行${leave}列${j}：${old}÷${pivot}=${table[leave][j]}，保持同一等式。`,calculation:{formula:'row[j]←row[j]/pivot',values:{old,pivot},result:table[leave][j]}},{table:table.map(row=>[...row])},tableScene(leave,j));}
  for(let i=0;i<=m;i++)if(i!==leave){const factor=table[i][enter];for(let j=0;j<=n+m;j++){const old=table[i][j];table[i][j]-=factor*table[leave][j];record(rec,frames,{phase:'pivot',ruleId:'simplex.pivot',action:'消去其他行的入基系数',explanation:`行${i}列${j}：${round(old,6)}−${round(factor,6)}×${round(table[leave][j],6)}=${round(table[i][j],6)}。`,calculation:{formula:'row_i[j]←row_i[j]−factor×pivotRow[j]',values:{old,factor,pivotValue:table[leave][j]},result:table[i][j]}},{table:table.map(row=>[...row])},tableScene(i,j));}}
  basis[leave]=enter;pivots++;record(rec,frames,{phase:'basis',ruleId:'simplex.pivot',action:'换入新基变量',explanation:`第${leave}行基变量改为${enter}，得到相邻可行基本解；退化时目标值可能不变。`},{basis:[...basis],pivots});snap('合法行变换完成，在新角点继续检查收益方向。');
 }
 if(status==='budget')record(rec,frames,{phase:'stop',ruleId:'simplex.stop',action:'达到换基预算',explanation:'完成30轮预算，不能直接把当前可行解称为已证最优。'});
 const [x,y]=solution(),value=ca*x+cb*y;record(rec,frames,{phase:'result',ruleId:'simplex.stop',action:'读取产量与收益',explanation:`A=${round(x)}、B=${round(y)}，状态${status}。`},{solution:[x,y],value,status});
 return {...result(frames,`${status==='optimal'?'连续配比最优':'当前连续配比'}：A=${round(x)}、B=${round(y)}，收益 ${round(value)}。允许小数产量；完整件数需要整数规划。`,{'最优收益':round(value),'A产量':round(x),'B产量':round(y),'换基次数':pivots,'求解状态':status}),trace:rec.trace};
};

const branchBound:Runner=(_input,p,seed)=>{
 const budget=Math.max(0,num(p,'budget',17)),time=Math.max(0,num(p,'time',14)),ca=num(p,'profitA',7),cb=num(p,'profitB',9),base:Constraint[]=[{a:2,b:3,c:budget},{a:3,b:1,c:time},{a:-1,b:0,c:0},{a:0,b:-1,c:0}];
 type Node={id:number;parent:number;depth:number;constraints:Constraint[];label:string};
 const pending:Node[]=[{id:0,parent:-1,depth:0,constraints:base,label:'放宽整数'}],displayNodes:{node:Node;x:number;y:number;color:string;text:string}[]=[],frames:Frame[]=[];
 let serial=1,best=0,bx=0,by=0,pruned=0;
 const rec=new TraceRecorder('branch-bound',seed,{best:0,solution:[0,0],pending:[0],current:-1,pruned:0});
 const scene=():Scene=>({kind:'graph',title:'只细查仍有希望的分支',nodes:displayNodes.map(v=>({id:String(v.node.id),x:v.x,y:v.y,label:`${v.node.label} ${v.text}`,color:v.color,r:4})),edges:displayNodes.filter(v=>v.node.parent>=0).map(v=>({from:String(v.node.parent),to:String(v.node.id),color:'#456070',directed:true}))});
 frames.push(frame({kind:'graph',title:'先区分已找到的整数收益与乐观上界',nodes:[{id:'0',x:12,y:16,label:'根：放宽整数',r:4}],edges:[]},'零产量是可行整数方案，先记收益0；连续放松仅作为乐观上界。'));
 record(rec,frames,{phase:'initialize',ruleId:'branch-bound.initialize',action:'登记可行整数下界',explanation:'预算和时间非负，所以A=B=0满足限制，当前已实现收益为0。允许小数扩大可行集合，其最优收益只作为整数分支的上界。'});
 while(pending.length&&displayNodes.length<160){
  const node=pending.pop()!;record(rec,frames,{phase:'select',ruleId:'branch-bound.branch',action:`取出分支${node.id}`,explanation:'使用后进先出栈；先压入高分支再压入低分支，因此优先深入“至多floor”一侧。'},{current:node.id,pending:pending.map(v=>v.id),constraints:node.constraints.map(c=>({...c}))});
  // A bounded two-variable LP reaches its optimum at a feasible vertex.
  // Enumerate and audit each line-pair and each actual feasibility comparison.
  const points:{x:number;y:number}[]=[];
  for(let i=0;i<node.constraints.length;i++)for(let j=i+1;j<node.constraints.length;j++){
   const a=node.constraints[i],b=node.constraints[j],det=a.a*b.b-a.b*b.a;
   if(Math.abs(det)<1e-9){record(rec,frames,{phase:'intersection',ruleId:'branch-bound.relax',action:`检查边界${i}与${j}`,explanation:'两条边界的行列式接近0，平行或重合，不产生唯一交点。',calculation:{formula:'det=a1·b2−b1·a2',values:{a1:a.a,b1:a.b,a2:b.a,b2:b.b},result:det},candidates:[{target:`${i},${j}`,status:'rejected',reason:'无唯一交点'}]});continue;}
   const x=(a.c*b.b-a.b*b.c)/det,y=(a.a*b.c-a.c*b.a)/det;
   record(rec,frames,{phase:'intersection',ruleId:'branch-bound.relax',action:`求边界${i}与${j}交点`,explanation:`联立两条边界得到A=${round(x,5)}、B=${round(y,5)}。还要检查所有不等式，交点本身不保证可行。`,calculation:{formula:'x=(c1·b2−b1·c2)/det; y=(a1·c2−c1·a2)/det',values:{det,a1:a.a,b1:a.b,c1:a.c,a2:b.a,b2:b.b,c2:b.c,x,y},result:`(${x},${y})`}},{vertex:[x,y]});
   let feasible=true;
   for(let k=0;k<node.constraints.length;k++){const c=node.constraints[k],lhs=c.a*x+c.b*y,pass=lhs<=c.c+1e-7;record(rec,frames,{phase:'feasibility',ruleId:'branch-bound.relax',action:`检验交点的限制${k}`,explanation:`${c.a}×${round(x,5)}＋${c.b}×${round(y,5)}=${round(lhs,5)}${pass?'≤':'>'}${c.c}（误差容限1e−7）；${pass?'通过这一项':'违反限制，交点不能作为方案'}。`,calculation:{formula:'a·x+b·y≤c+1e−7',values:{a:c.a,b:c.b,x,y,lhs,rhs:c.c},result:pass?'通过':'拒绝'},candidates:[{target:`限制${k}`,status:pass?'chosen':'rejected',reason:pass?'不等式成立':'交点违反本项限制'}]});if(!pass){feasible=false;break;}}
   if(feasible)points.push({x,y});
  }
  let optimum:{x:number;y:number}|undefined,bound=-Infinity;
  for(const point of points){const value=ca*point.x+cb*point.y,better=value>bound;if(better){optimum=point;bound=value;}record(rec,frames,{phase:'bound',ruleId:'branch-bound.bound',action:'比较可行角点收益',explanation:`收益${ca}×${round(point.x,5)}＋${cb}×${round(point.y,5)}=${round(value,5)}；${better?'成为目前最高连续收益':'不超过已有角点'}。本二维连续区域有界，最高角点给出本分支的乐观上界。`,calculation:{formula:'z=profitA·A+profitB·B',values:{profitA:ca,profitB:cb,A:point.x,B:point.y},result:value},candidates:[{target:`(${point.x},${point.y})`,status:better?'chosen':'rejected',reason:better?'当前最大角点目标值':'已有不低的可行角点'}]},{bound,relaxedSolution:optimum?[optimum.x,optimum.y]:[]});}
  let color='#78edd0',text='',caption='';
  if(!optimum){pruned++;color='#526477';text='不可行';caption='有界连续放松没有可行角点，因此该分支不可行。';record(rec,frames,{phase:'prune',ruleId:'branch-bound.prune',action:'不可行剪枝',explanation:caption},{pruned});}
  else if(bound<=best+1e-7){pruned++;color='#526477';text=`上界${round(bound)}`;caption='即使允许分数件也不优于已有整数方案，因此剪枝。';record(rec,frames,{phase:'prune',ruleId:'branch-bound.prune',action:'上界剪枝',explanation:`本分支连续上界${round(bound,5)}≤已有整数收益${round(best,5)}（容限1e−7），无需再查其中整数点。`,calculation:{formula:'upperBound≤incumbent+1e−7',values:{upperBound:bound,incumbent:best},result:'剪枝'}},{pruned});}
  else {
   const integerX=Math.abs(optimum.x-Math.round(optimum.x))<1e-7,integerY=Math.abs(optimum.y-Math.round(optimum.y))<1e-7;
   record(rec,frames,{phase:'integrality',ruleId:'branch-bound.incumbent',action:'检查连续最优解是否为整数',explanation:`A=${round(optimum.x,5)}${integerX?'接近整数':'含小数'}，B=${round(optimum.y,5)}${integerY?'接近整数':'含小数'}；两个变量都为整数才可直接更新实际方案。`},{integerX,integerY});
   if(integerX&&integerY){best=bound;bx=Math.round(optimum.x);by=Math.round(optimum.y);color='#f6c37b';text=`整数${round(best)}`;caption=`找到完整件数方案A=${bx}、B=${by}，收益${round(best)}。`;record(rec,frames,{phase:'incumbent',ruleId:'branch-bound.incumbent',action:'更新可行整数纪录',explanation:caption+'它已达到本分支的连续上界，此分支无需再拆。'},{best,solution:[bx,by]});}
   else {const useX=!integerX,value=useX?optimum.x:optimum.y,low=Math.floor(value),high=Math.ceil(value);text=`上界${round(bound)}`;caption=`含${round(value)}件，分为至多${low}件与至少${high}件。`;pending.push({id:serial++,parent:node.id,depth:node.depth+1,constraints:[...node.constraints,{a:useX?-1:0,b:useX?0:-1,c:-high}],label:`${useX?'A':'B'}≥${high}`},{id:serial++,parent:node.id,depth:node.depth+1,constraints:[...node.constraints,{a:useX?1:0,b:useX?0:1,c:low}],label:`${useX?'A':'B'}≤${low}`});record(rec,frames,{phase:'branch',ruleId:'branch-bound.branch',action:'用两条整数限制分支',explanation:`${useX?'A':'B'}=${round(value,5)}含小数；任何整数都满足≤${low}或≥${high}。两分支覆盖所有整数可能，排除的只有不合法的小数间隙。`,calculation:{formula:'x≤floor(x*) OR x≥ceil(x*)',values:{relaxed:value,low,high},result:`≤${low} 或 ≥${high}`}},{pending:pending.map(v=>v.id)});}
  }
  const depthCount=displayNodes.filter(v=>v.node.depth===node.depth).length;displayNodes.push({node,x:12+Math.min(node.depth,6)*12,y:16+(depthCount%5)*16,color,text});frames.push(frame(scene(),caption,{'已检查分支':displayNodes.length,'剪枝':pruned,'当前最好':round(best)}));
 }
 const status=pending.length?'budget':'optimal';record(rec,frames,{phase:'stop',ruleId:'branch-bound.stop',action:status==='optimal'?'全部分支已解决':'达到分支预算',explanation:status==='optimal'?'每个分支均已证明不可行、不能改进、或达到整数上界；待查栈为空，已有整数纪录是全局最优。':'检查160个分支后仍有待查节点；返回当前最好可行解，不能宣称最优。'},{status,pending:pending.map(v=>v.id),best,solution:[bx,by]});
 return {...result(frames,`${status==='optimal'?'最优整数方案':'当前整数方案'}：A ${bx} 件、B ${by} 件，收益 ${round(best)}。检查 ${displayNodes.length} 个分支，剪掉 ${pruned} 个。`,{'最优收益':round(best),'A件数':bx,'B件数':by,'检查分支':displayNodes.length,'剪枝数':pruned,'求解状态':status}),trace:rec.trace};
};
export const optimizationRunners:Record<string,Runner>={'hill-climbing':hill,annealing,genetic,pso,'ant-colony':ant,simplex,'branch-bound':branchBound};
