import type {Frame, LabInput, Params, Runner, Scene} from '../engine/types';
import {clamp,frame,num,palette,result,rng,str} from '../engine/utils';
import {network} from './core-graph';
import {TraceRecorder,record,finite,numbers} from './core-teaching';

const interval:Runner=(_input,p,seed)=>{
 const random=rng(seed),n=clamp(Math.round(num(p,'count',10)),4,18),horizon=num(p,'horizon',30),jobs=Array.from({length:n},(_,i)=>({label:`活动${i+1}`,start:Math.floor(random()*25),duration:2+Math.floor(random()*8),row:i})),chosen:number[]=[],frames:Frame[]=[],rec=new TraceRecorder('interval-scheduling',seed,{chosen:[],end:0});let end=0;
 const scene=():Scene=>({kind:'schedule',tasks:jobs.map((t,i)=>({...t,color:chosen.includes(i)?'#78edd0':'#3a4a5d'})),title:'单个场地的活动排程'});
 const ordered=jobs.map((x,i)=>({...x,index:i})).sort((a,b)=>(a.start+a.duration)-(b.start+b.duration));frames.push(frame(scene(),'按结束时刻升序，结束一样时保留原顺序。'));record(rec,frames,{phase:'initialize',ruleId:'interval-scheduling.initialize',action:'先结束者优先',explanation:'目标只最大化不重叠活动数量；最早结束者为后来留下不小于其他可选活动的空间。'},{order:ordered.map(v=>v.index)});
 for(const j of ordered){const previousEnd=end,finish=j.start+j.duration,fits=j.start>=end&&finish<=horizon;if(fits){chosen.push(j.index);end=finish;}const explanation=fits?`${j.start}≥已选末尾${previousEnd}，且结束${finish}≤时段上限${horizon}，接受。`:j.start<previousEnd?`开始${j.start}<已选末尾${previousEnd}，冲突，拒绝。`:`结束${finish}>时段上限${horizon}，放不进可用时段。`;frames.push(frame(scene(),j.label+'：'+explanation,{'已安排':chosen.length,'可用结束时间':horizon}));record(rec,frames,{phase:'choose',ruleId:'interval-scheduling.choose',action:'检查'+j.label,explanation,calculation:{formula:'start ≥ lastEnd AND start+duration ≤ horizon',values:{start:j.start,lastEnd:previousEnd,duration:j.duration,horizon},result:fits?'接受':'拒绝'},candidates:[{target:j.label,status:fits?'chosen':'rejected',reason:explanation}]},{chosen:[...chosen],end});}
 record(rec,frames,{phase:'stop',ruleId:'interval-scheduling.stop',action:'检查完所有活动',explanation:'每场都按结束时间检查过一次；所选活动互不重叠，数量在该目标与条件下最优。'});
 return {...result(frames,`按结束时间选择，在 ${horizon} 小时内安排了 ${chosen.length} 场不重叠活动。此目标只数活动数量，不比较活动价值。`,{'活动数量':chosen.length,'选择':chosen.join(',')}),trace:rec.trace};
};

export function backpackItems(p:Params){return str(p,'items','相机:4:9,雨衣:2:5,电池:3:7,水壶:3:6,帐篷:7:13,零食:2:3').split(/[,，\n]+/).map((s,i)=>{const [name,w,v]=s.trim().split(/[:：]/);return{name:name||`物品${i+1}`,weight:Number(w),value:Number(v)};}).filter(a=>Number.isFinite(a.weight)&&Number.isFinite(a.value)&&Number.isInteger(a.weight)&&a.weight>0&&a.value>=0).slice(0,14);}
const knapsack:Runner=(_input,p,seed)=>{
 const items=backpackItems(p),rawEntries=str(p,'items','相机:4:9,雨衣:2:5,电池:3:7,水壶:3:6,帐篷:7:13,零食:2:3').split(/[,，\n]+/).map(v=>v.trim()).filter(Boolean),cap=clamp(Math.round(num(p,'capacity',12)),0,60),n=items.length,dp=Array.from({length:n+1},()=>Array<number>(cap+1).fill(0)),frames:Frame[]=[];
 const rec=new TraceRecorder('knapsack',seed,{table:dp.map(row=>[...row]),selected:[],remaining:cap});
 if(!n||rawEntries.length!==n){frames.push(frame({kind:'text',text:['请输入 名称:占用:价值，例如 相机:4:9','占用是正整数，价值非负，最多14件。']},'没有计算不完整清单，请先修正格式或数量。'));record(rec,frames,{phase:'validate',ruleId:'knapsack.initialize',action:'拒绝不完整输入',explanation:'无效条目不能被静默忽略，否则求解的已不是你的原问题。'},{valid:false});return {...result(frames,'输入格式或数量不符合要求：请保留最多14件，每项按名称、正整数占用、非负价值填写。',{'输入有效':0}),trace:rec.trace};}
 const scene=(i=0,w=0):Scene=>({kind:'matrix',matrix:dp.map(row=>[...row]),rowLabels:['不带物品',...items.map(v=>v.name)],columnLabels:Array.from({length:cap+1},(_,w)=>String(w)),active:[i*(cap+1)+w],title:'每个格子：前 i 件物品、容量 w 的最好价值',note:'只读上一行，确保每件物品至多用一次；同值时优先不带。'});
 frames.push(frame(scene(),'没有物品时，任何容量的最好价值都是0。'));record(rec,frames,{phase:'initialize',ruleId:'knapsack.initialize',action:'建立空包边界',explanation:'第0行全为0；容量是非负整数，物品不能拆分。'});
 for(let i=1;i<=n;i++){
  frames.push(frame(scene(i,0),`开始考虑第 ${i} 件「${items[i-1].name}」。`));
  for(let w=0;w<=cap;w++){
   const item=items[i-1],skip=dp[i-1][w],fits=item.weight<=w,take=fits?dp[i-1][w-item.weight]+item.value:null;
   dp[i][w]=take===null?skip:Math.max(skip,take);const picked=take!==null&&take>skip;
   const explanation=!fits?`${item.name}占用${item.weight}>容量${w}，放不下，继承上一行${skip}。`:`不带得${skip}；带上得剩余容量${w-item.weight}的${dp[i-1][w-item.weight]} + 价值${item.value} = ${take}；${picked?'带上更好':'保留不带方案'+(take===skip?'（同值）':'')}。`;
   record(rec,frames,{phase:'cell',ruleId:'knapsack.compare',action:`计算表格 [${i},${w}]`,explanation,focus:[String(i*(cap+1)+w),String((i-1)*(cap+1)+w),...(fits?[String((i-1)*(cap+1)+w-item.weight)]:[])],calculation:{formula:fits?'D[i,w]=max(D[i−1,w],D[i−1,w−weight]+value)':'D[i,w]=D[i−1,w]',values:{capacity:w,weight:item.weight,value:item.value,skip,take:take??'放不下'},result:dp[i][w]},candidates:[{target:'不带'+item.name,status:picked?'rejected':'chosen',reason:picked?'价值更低':take===skip?'相同价值，按约定保留不带':'可行且不差于带上',values:{value:skip}},{target:'带上'+item.name,status:picked?'chosen':'rejected',reason:!fits?'容量不足':picked?'总价值更高':take===skip?'同值按约定不带':'总价值较低',values:{value:take??'不可行'}}]},{table:dp.map(row=>[...row])},scene(i,w));
  }
  frames.push({scene:{kind:'bars',values:items.map(v=>v.value),labels:items.map(v=>`${v.name} · 占${v.weight}`),active:[i-1],title:'每件物品只能选一次'},secondaryScene:{kind:'lines',series:[{name:'当前最好价值',color:'#78edd0',points:dp[i].map((v,w)=>({x:w,y:v}))}]},caption:`已逐格比较「${items[i-1].name}」，容量 ${cap} 的最好价值为 ${dp[i][cap]}。`,metrics:{'已考虑物品':i,'当前最好价值':dp[i][cap]}});
 }
 const selected:number[]=[];let w=cap;
 for(let i=n;i>0;i--){const differs=dp[i][w]!==dp[i-1][w],before=w;if(differs){selected.push(i-1);w-=items[i-1].weight;}record(rec,frames,{phase:'backtrack',ruleId:'knapsack.backtrack',action:'恢复'+items[i-1].name+'的选择',explanation:differs?`本行${dp[i][before]}高于上一行${dp[i-1][before]}，必定带了它；剩余容量减为${w}。`:`与上一行同为${dp[i][before]}，按同值不带约定跳过。`,focus:[String(i*(cap+1)+before)],calculation:{formula:'selected ⇔ D[i,w] ≠ D[i−1,w]',values:{current:dp[i][before],previous:dp[i-1][before]},result:differs?'带':'不带'}},{selected:[...selected].sort((a,b)=>a-b),remaining:w},scene(i,before));}
 selected.reverse();const used=selected.reduce((s,i)=>s+items[i].weight,0),summary=`选择 ${selected.length?selected.map(i=>items[i].name).join('、'):'空集合'}；占用 ${used}/${cap}，总价值 ${dp[n][cap]}。在当前离散条件下这是最优值。`;
 frames.push(frame({kind:'bars',values:items.map(v=>v.value),labels:items.map(v=>`${v.name} · 占${v.weight}`),colors:items.map((_,i)=>selected.includes(i)?'#78edd0':'#334553'),title:'你的最优装包方案'},summary,{'总价值':dp[n][cap],'已用容量':used,'剩余容量':cap-used}));record(rec,frames,{phase:'result',ruleId:'knapsack.backtrack',action:'核对恢复方案',explanation:summary},{selected:[...selected],totalValue:dp[n][cap],used});
 return {...result(frames,summary,{'总价值':dp[n][cap],'已用容量':used,'选择索引':selected.join(',')}),trace:rec.trace};
};

export function assignmentCosts(p:Params,seed:number){const random=rng(seed),n=clamp(Math.round(num(p,'size',4)),2,7),bias=num(p,'specialty',8);return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Math.max(1,3+Math.floor(random()*17)-(i===j?bias:0))));}
const hungarian:Runner=(_input,p,seed)=>{
 const cost=assignmentCosts(p,seed),n=cost.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),match=Array(n+1).fill(0),way=Array(n+1).fill(0),frames:Frame[]=[],rec=new TraceRecorder('hungarian',seed,{u:[...u],v:[...v],match:[...match],way:[...way]});
 const scene=():Scene=>({kind:'matrix',matrix:cost,rowLabels:cost.map((_,k)=>`队员${k+1}`),columnLabels:cost.map((_,k)=>`任务${k+1}`),active:match.slice(1).flatMap((worker,j)=>worker?[(worker-1)*n+j]:[]),title:'一人一个任务，总工时最小',note:'原成本不改；行势u与列势v组成可调整的比较基准。'});
 frames.push(frame(scene(),'从空匹配与零势函数开始。'));record(rec,frames,{phase:'initialize',ruleId:'hungarian.initialize',action:'建立一对一分配账本',explanation:'match[j]表示任务j当前匹配的队员；0号列是增广搜索用的虚拟入口，不是真任务。'});
 for(let i=1;i<=n;i++){
  match[0]=i;let j0=0;const minv=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
  record(rec,frames,{phase:'start',ruleId:'hungarian.initialize',action:'让新队员进入搜索',explanation:`队员${i}尚未安排，从虚拟入口找能扩展匹配的交替链。`},{match:[...match],minv:numbers(minv),used:[...used]});
  do{
   used[j0]=true;const i0=match[j0];let delta=Infinity,j1=0;
   record(rec,frames,{phase:'tree',ruleId:'hungarian.reduced',action:'扩展交替树',explanation:`当前任务列${j0}对应队员${i0}，检查他到所有未用任务的约化成本。`},{used:[...used]});
   for(let j=1;j<=n;j++){
    if(used[j]){record(rec,frames,{phase:'reduced',ruleId:'hungarian.reduced',action:'跳过树内任务',explanation:`任务${j}已在当前交替树中，不再作为新扩展列。`});continue;}
    const cur=cost[i0-1][j-1]-u[i0]-v[j],old=minv[j],improve=cur<old;if(improve){minv[j]=cur;way[j]=j0;}const better=minv[j]<delta;if(better){delta=minv[j];j1=j;}
    record(rec,frames,{phase:'reduced',ruleId:'hungarian.reduced',action:`检查队员${i0}→任务${j}`,explanation:`原成本${cost[i0-1][j-1]}−行势${u[i0]}−列势${v[j]}=${cur}；${improve?'改善该列最小余量':'保留更小旧余量'}。${better?'它成为目前最小余量列':'当前其他列余量更小或同值先到'}。`,focus:[String((i0-1)*n+j-1)],calculation:{formula:'reduced=cost[i,j]−u[i]−v[j]',values:{cost:cost[i0-1][j-1],u:u[i0],v:v[j],old:finite(old)},result:cur},candidates:[{target:'列'+j,status:better?'chosen':'deferred',reason:better?'当前最小余量':'保留为后续候选'}]},{minv:numbers(minv),way:[...way],delta:finite(delta),nextColumn:j1},scene());
   }
   for(let j=0;j<=n;j++){
    if(used[j]){u[match[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;
    record(rec,frames,{phase:'adjust',ruleId:'hungarian.adjust',action:'按最小余量统一调势',explanation:used[j]?`树内列${j}：匹配队员行势加${delta}，该列势减${delta}，维持已紧边。`:`树外列${j}余量减${delta}，至少一个候选将变为0，产生新紧边。`,calculation:{formula:used[j]?'u[match[j]]+=δ; v[j]−=δ':'slack[j]−=δ',values:{delta,column:j},result:used[j]?v[j]:finite(minv[j])}},{u:[...u],v:[...v],minv:numbers(minv)});
   }
   j0=j1;record(rec,frames,{phase:'advance',ruleId:'hungarian.augment',action:'转到新紧边的列',explanation:match[j0]===0?`任务${j0}尚未匹配，可以沿交替链增广。`:`任务${j0}已有队员${match[j0]}，将沿他继续寻找替代安排。`},{column:j0});
  }while(match[j0]!==0);
  do{const j1=way[j0],old=match[j0];match[j0]=match[j1];record(rec,frames,{phase:'augment',ruleId:'hungarian.augment',action:'沿交替链重配',explanation:`任务${j0}从${old||'未分配'}改由队员${match[j1]}负责，再回到前驱列${j1}。`},{match:[...match]},scene());j0=j1;}while(j0!==0);
  frames.push(frame(scene(),`已安排${i}名队员；重排旧搭配是为了保持整体最小成本。`,{'已分配任务':i}));
 }
 const assignment=match.slice(1).map((worker,j)=>({worker:worker-1,task:j})),total=assignment.reduce((s,a)=>s+cost[a.worker][a.task],0);record(rec,frames,{phase:'stop',ruleId:'hungarian.stop',action:'一对一完整匹配',explanation:'所有队员与任务均匹配；每次增广与调势维持可行对偶和紧匹配，最终总成本最小。'},{total});
 return {...result(frames,`最小总工时 ${total}。最适合某个任务的人，不一定应该独占它：要看全局搭配。`,{'最小总工时':total,'分配':assignment.map(a=>`${a.worker}:${a.task}`).join(',')}),trace:rec.trace};
};

const stable:Runner=(_input,p,seed)=>{const random=rng(seed),n=clamp(Math.round(num(p,'size',4)),2,7),shuffle=()=>{const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};let pref=Array.from({length:n},()=>shuffle()),other=Array.from({length:n},()=>shuffle());if(str(p,'preference','mixed')==='aligned')pref=Array.from({length:n},()=>Array.from({length:n},(_,i)=>i));if(str(p,'side','student')==='mentor')[pref,other]=[other,pref];const rank=other.map(a=>Array.from({length:n},(_,i)=>a.indexOf(i))),next=Array(n).fill(0),receiver=Array(n).fill(-1),free=Array.from({length:n},(_,i)=>i),frames:Frame[]=[],rec=new TraceRecorder('stable-matching',seed,{receiver:[...receiver],next:[...next],free:[...free],preferences:pref,receiverRanks:rank});let proposals=0;
 const scene=():Scene=>({kind:'graph',title:'双向志愿，允许暂时搭配',nodes:Array.from({length:n*2},(_,i)=>({id:String(i),x:i<n?20:80,y:15+(i%n)*70/Math.max(1,n-1),label:`${i<n?'申请':'接收'}${i%n+1}`})),edges:receiver.flatMap((person,j)=>person<0?[]:[{from:String(person),to:String(n+j),color:'#78edd0',width:3}])});
 frames.push(frame(scene(),'所有申请者未匹配，每人先从自己的第一志愿开始。'));record(rec,frames,{phase:'initialize',ruleId:'stable-matching.initialize',action:'准备双方偏好',explanation:'双方完整无并列偏好；接收方可暂时接受，但之后只会换成更喜欢的提议。'});
 while(free.length){const a=free.shift()!,b=pref[a][next[a]++];proposals++;const old=receiver[b];record(rec,frames,{phase:'propose',ruleId:'stable-matching.propose',action:`申请${a+1}向接收${b+1}提议`,explanation:`这是申请${a+1}尚未尝试的最高志愿；已试过的志愿不再重试。`},{free:[...free],next:[...next],proposals});
 const accept=old<0||rank[b][a]<rank[b][old];if(accept){receiver[b]=a;if(old>=0)free.push(old);}else free.push(a);
 const explanation=old<0?`接收${b+1}尚无搭配，暂时接受。`:`接收方排名：新申请${a+1}为${rank[b][a]+1}，旧申请${old+1}为${rank[b][old]+1}；${accept?'新申请更受喜欢，原搭配回到自由队列':'旧搭配更受喜欢，新申请回到自由队列'}。`;
 frames.push(frame(scene(),explanation,{'提议次数':proposals}));record(rec,frames,{phase:'choose',ruleId:'stable-matching.choose',action:'接收方保留更喜欢者',explanation,calculation:{formula:'accept = unmatched OR rank(new)<rank(old)',values:{newRank:rank[b][a]+1,oldRank:old<0?'未匹配':rank[b][old]+1},result:accept?'接受':'拒绝'},candidates:[{target:'申请'+(a+1),status:accept?'chosen':'rejected',reason:explanation}]},{receiver:[...receiver],free:[...free]});
 }
 const partner=Array(n).fill(-1);receiver.forEach((a,b)=>partner[a]=b);let blocking=0;for(let a=0;a<n;a++)for(let b=0;b<n;b++)if(pref[a].indexOf(b)<pref[a].indexOf(partner[a])&&rank[b][a]<rank[b][receiver[b]])blocking++;
 record(rec,frames,{phase:'stop',ruleId:'stable-matching.stop',action:'全部申请者已匹配',explanation:'每个被拒绝的人都尝试过更喜欢的选项；接收方只向更喜欢者改配，因此不存在双方都愿意私下改配的一对。'},{partner:[...partner],blocking});
 return {...result(frames,'搭配稳定：没有一对参与者同时更想离开现有搭档、转而互选。稳定不等于让所有人拿到第一志愿。',{'提议次数':proposals,'不稳定配对':blocking,'搭配':partner.join(',')}),trace:rec.trace};};

const maxflow:Runner=(_input,p,seed)=>{
 type E={to:number;rev:number;cap:number;initial:number};const n=6,g:E[][]=Array.from({length:n},()=>[]),scale=clamp(Math.round(num(p,'capacity',5)),1,15),bottleneck=clamp(Math.round(num(p,'bottleneck',4)),0,20),original:{u:number;idx:number}[]=[];
 const add=(u:number,v:number,c:number)=>{original.push({u,idx:g[u].length});g[u].push({to:v,rev:g[v].length,cap:c,initial:c});g[v].push({to:u,rev:g[u].length-1,cap:0,initial:0});};[[0,1,scale*2],[0,2,scale],[1,2,scale],[1,3,bottleneck],[2,4,scale*2],[4,3,scale],[3,5,scale*2],[4,5,bottleneck]].forEach(([u,v,c])=>add(u,v,c));
 const frames:Frame[]=[],rec=new TraceRecorder('max-flow',seed,{residual:g.map(row=>row.map(e=>e.cap)),flow:0,level:Array(n).fill(-1)});let flow=0;
 const nodes=[{x:8,y:50},{x:32,y:25},{x:32,y:75},{x:68,y:25},{x:68,y:75},{x:92,y:50}].map((q,i)=>({...q,id:String(i),label:i===0?'水源':i===5?'用户':String(i)}));
 const scene=(residual=false):Scene=>({kind:'graph',nodes,edges:residual?g.flatMap((row,u)=>row.filter(e=>e.cap>0).map(e=>({from:String(u),to:String(e.to),label:'余'+e.cap,directed:true,color:e.initial===0?'#ed8fa7':'#78edd0',width:2}))):original.map(({u,idx})=>{const e=g[u][idx];return{from:String(u),to:String(e.to),label:`${e.initial-e.cap}/${e.initial}`,directed:true,color:e.cap===0?'#f6c37b':'#78edd0',width:2};}),title:residual?'剩余网络：粉色反向边可撤回旧分配':'水管容量与实际输送量'});
 frames.push(frame(scene(),'每条正向管道配一条初始容量0的反向边。'));record(rec,frames,{phase:'initialize',ruleId:'max-flow.initialize',action:'建立剩余网络',explanation:'正向余量是还能多送多少，反向余量是可以撤回多少旧分配；反向边不是实际新增管道。'});
 const level=Array(n).fill(-1);
 while(true){level.fill(-1);level[0]=0;const q=[0];record(rec,frames,{phase:'level',ruleId:'max-flow.level',action:'重新建立分层图',explanation:'从源点沿正剩余容量边做BFS，层号是剩余网络中的最少边数。'},{level:[...level],queue:[...q]});
  for(let k=0;k<q.length;k++)for(const e of g[q[k]]){const u=q[k],accept=e.cap>0&&level[e.to]<0;if(accept){level[e.to]=level[u]+1;q.push(e.to);}record(rec,frames,{phase:'level',ruleId:'max-flow.level',action:`检查剩余边${u}→${e.to}`,explanation:e.cap<=0?'余量为0，不能通过。':accept?`首次可达，层号${level[u]}+1=${level[e.to]}，入BFS队列。`:'该节点已有最短层号，不重复登记。',candidates:[{target:`${u}→${e.to}`,status:accept?'chosen':'rejected',reason:e.cap<=0?'无余量':accept?'首次发现':'已有层号'}]},{level:[...level],queue:[...q]},scene(true));}
  if(level[5]<0){record(rec,frames,{phase:'stop',ruleId:'max-flow.stop',action:'汇点在剩余网络中不可达',explanation:'已不存在增广路径，不能继续增加总流量。'});break;}
  frames.push(frame(scene(),'分层图建立完成，只沿层号恰好加1的边送水。',{'当前流量':flow}));const it=Array(n).fill(0);
  const dfs=(u:number,f:number):number=>{if(u===5){record(rec,frames,{phase:'push',ruleId:'max-flow.push',action:'路径到达汇点',explanation:`本条路径最多可增送${finite(f)}单位，这是沿途余量最小值。`},{pathBottleneck:finite(f)});return f;}
   for(;it[u]<g[u].length;it[u]++){const e=g[u][it[u]],eligible=e.cap>0&&level[e.to]===level[u]+1;
    record(rec,frames,{phase:'admissible',ruleId:'max-flow.push',action:`尝试层间边${u}→${e.to}`,explanation:!eligible?(e.cap<=0?'没有剩余容量，跳过。':`层号${level[u]}→${level[e.to]}不是恰好前进1层，跳过。`):`容量正且层号前进1，递归传入min(${finite(f)},${e.cap})=${Math.min(f,e.cap)}。`,calculation:{formula:'pass=min(incoming, residual)',values:{incoming:finite(f),residual:e.cap,fromLevel:level[u],toLevel:level[e.to]},result:eligible?Math.min(f,e.cap):'不通过'},candidates:[{target:`${u}→${e.to}`,status:eligible?'chosen':'rejected',reason:eligible?'满足分层与余量条件':e.cap<=0?'无余量':'不沿下一层'}]},{currentArc:[...it]});
    if(eligible){const pushed=dfs(e.to,Math.min(f,e.cap));if(pushed){const old=e.cap;e.cap-=pushed;g[e.to][e.rev].cap+=pushed;record(rec,frames,{phase:'residual',ruleId:'max-flow.residual',action:'正向减余量、反向加余量',explanation:`${u}→${e.to}增送${pushed}：正向${old}−${pushed}=${e.cap}；反向增加${pushed}，允许以后撤回重分配。`,calculation:{formula:'r(u,v)−=Δ; r(v,u)+=Δ',values:{delta:pushed,oldForward:old},result:e.cap}},{residual:g.map(row=>row.map(e=>e.cap))},scene(true));return pushed;}}
   }
   record(rec,frames,{phase:'dead-end',ruleId:'max-flow.push',action:'本轮该节点已无可增送路径',explanation:`节点${u}所有合格后继都试过，返回0，调用者继续试其他边。`},{currentArc:[...it]});return 0;
  };
  let delta;while((delta=dfs(0,Infinity))>0){flow+=delta;frames.push(frame(scene(),`本次增送${delta}，总流量变为${flow}。`,{'总流量':flow}));record(rec,frames,{phase:'augment',ruleId:'max-flow.residual',action:'完成一次路径增广',explanation:'整条路径的余量更新已完成，内部节点流入等于流出；源点总流量加上本次瓶颈值。'},{flow});}
  record(rec,frames,{phase:'blocking',ruleId:'max-flow.level',action:'本分层图已形成阻塞流',explanation:'沿当前层次已无可增送路径，重新在剩余网络中建立层次。'});
 }
 const reachable=new Set([0]),q=[0];for(let i=0;i<q.length;i++)for(const e of g[q[i]]){const accept=e.cap>0&&!reachable.has(e.to);if(accept){reachable.add(e.to);q.push(e.to);}record(rec,frames,{phase:'cut',ruleId:'max-flow.cut',action:'找最终源侧可达集合',explanation:`${q[i]}→${e.to}：${e.cap<=0?'无余量':accept?'加入源侧':'已在源侧'}。`},{sourceSide:[...reachable]});}
 let cut=0;for(const {u,idx}of original){const e=g[u][idx],cross=reachable.has(u)&&!reachable.has(e.to);if(cross)cut+=e.initial;record(rec,frames,{phase:'cut',ruleId:'max-flow.cut',action:'累计跨割原始容量',explanation:`${u}→${e.to}${cross?'从源侧通向非源侧，计入原容量'+e.initial:'不跨这个割，不计入'}。`},{cut});}
 const summary=`最大可输送 ${flow} 单位。最窄整体截面容量也是 ${cut}，只加宽非瓶颈管道可能没有收益。`;frames.push(frame(scene(),summary,{'最大流量':flow,'最小割容量':cut}));record(rec,frames,{phase:'result',ruleId:'max-flow.stop',action:'用最小割验证上限',explanation:`可行流${flow}等于割容量${cut}，两边夹住同一最优值。`},{flow,cut});return {...result(frames,summary,{'最大流量':flow,'最小割容量':cut}),trace:rec.trace};
};

const coloring:Runner=(_input,p,seed)=>{
 const net=network(p,seed),n=net.n,colors=Array(n).fill(-1),adj=Array.from({length:n},()=>new Set<number>()),frames:Frame[]=[],rec=new TraceRecorder('graph-coloring',seed,{colors:[...colors]});for(const e of net.edges){adj[e.u].add(e.v);adj[e.v].add(e.u);}
 const scene=():Scene=>({kind:'graph',nodes:net.nodes.map((q,i)=>({...q,color:colors[i]<0?'#405062':palette[colors[i]%palette.length],label:`${q.label}${colors[i]<0?'':` · 时段${colors[i]+1}`}`})),edges:net.edges.map(e=>({from:String(e.u),to:String(e.v),color:'#355362'})),title:'有冲突的考试不能同一时段'});
 frames.push(frame(scene(),'所有节点初始未着色。每条边表示必须错开的冲突。'));record(rec,frames,{phase:'initialize',ruleId:'graph-coloring.initialize',action:'建立冲突邻接表',explanation:'饱和度是已着色邻居的不同颜色数，不是邻居总数。'});
 for(let k=0;k<n;k++){
  const saturation=(i:number)=>new Set([...adj[i]].map(v=>colors[v]).filter(v=>v>=0)).size;
  const candidates=Array.from({length:n},(_,i)=>i).filter(i=>colors[i]<0).sort((a,b)=>saturation(b)-saturation(a)||adj[b].size-adj[a].size||a-b),u=candidates[0],used=new Set([...adj[u]].map(v=>colors[v]).filter(c=>c>=0));
  record(rec,frames,{phase:'select',ruleId:'graph-coloring.select',action:'选择限制最紧的未染色节点',explanation:`先比饱和度，再比原图度数，最后按编号小优先。本轮选${net.nodes[u].label}，饱和度${saturation(u)}、度数${adj[u].size}。`,focus:[String(u)],candidates:candidates.map(i=>({target:String(i),status:i===u?'chosen':'deferred',reason:i===u?'按饱和度/原图度/编号排序第一':'仍未染色，之后再安排',values:{saturation:saturation(i),degree:adj[i].size,id:i}}))},{current:u});
  let c=0;while(used.has(c)){record(rec,frames,{phase:'color',ruleId:'graph-coloring.color',action:'拒绝冲突颜色',explanation:`颜色${c}已被相邻节点使用，不能给${net.nodes[u].label}。`,candidates:[{target:'颜色'+c,status:'rejected',reason:'至少一个邻居已占用'}]});c++;}
  colors[u]=c;frames.push(frame(scene(),`${net.nodes[u].label}使用最小未冲突颜色${c}。`,{'已安排':k+1,'使用时段':Math.max(...colors)+1}));record(rec,frames,{phase:'color',ruleId:'graph-coloring.color',action:'分配最小可用颜色',explanation:`已用邻色为[${[...used].join(',')}]，颜色${c}不在其中，且更小颜色都已检查。`,candidates:[{target:'颜色'+c,status:'chosen',reason:'最小未被邻居占用颜色'}]},{colors:[...colors]});
 }
 const conflicts=net.edges.filter(e=>colors[e.u]===colors[e.v]).length;record(rec,frames,{phase:'stop',ruleId:'graph-coloring.stop',action:'核对全部冲突边',explanation:`所有节点已着色，冲突${conflicts}条；这是贪心DSATUR，不保证颜色数全局最少。`},{conflicts});return {...result(frames,`安排为 ${Math.max(...colors)+1} 个时段，冲突 ${conflicts} 个。DSATUR 是启发式，这个颜色数不保证全局最少。`,{'使用时段':Math.max(...colors)+1,'冲突数':conflicts,'颜色':colors.join(',')}),trace:rec.trace};
};
const critical:Runner=(_input,p,seed)=>{
 const random=rng(seed),names=['需求确认','设计海报','采购物料','线上宣传','布置场地','举办活动','复盘'],duration=names.map(()=>2+Math.floor(random()*5)),delayed=clamp(Math.round(num(p,'task',2)),0,6);duration[delayed]+=clamp(Math.round(num(p,'delay',0)),0,15);
 const edges=[[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[5,6]],n=7,earliest=Array(n).fill(0),frames:Frame[]=[],rec=new TraceRecorder('critical-path',seed,{earliest:[...earliest],duration:[...duration]});
 const scene=(latest?:number[]):Scene=>({kind:'schedule',tasks:names.map((label,i)=>({label:latest?`${label} · 余量${latest[i]-earliest[i]}`:label,start:earliest[i],duration:duration[i],row:i,color:latest&&latest[i]===earliest[i]?'#f6c37b':'#78edd0'})),title:'前置全部完工，后续才能开始'});
 frames.push(frame(scene(),'按无环依赖的拓扑顺序，先向前算最早时间。'));record(rec,frames,{phase:'initialize',ruleId:'critical-path.initialize',action:'明确工期与依赖',explanation:'活动时长固定，资源足够并行；节点编号已是拓扑顺序，不能任意交换计算顺序。'});
 for(let u=0;u<n;u++){
  for(const [a,b]of edges)if(a===u){const old=earliest[b],candidate=earliest[u]+duration[u];earliest[b]=Math.max(old,candidate);record(rec,frames,{phase:'forward',ruleId:'critical-path.forward',action:'更新'+names[b]+'的最早开始',explanation:`它必须等${names[u]}完成：${earliest[u]}+${duration[u]}=${candidate}；与已有前置要求${old}取较晚者${earliest[b]}。`,calculation:{formula:'ES(v)=max(ES(v),ES(u)+duration(u))',values:{old,parentStart:earliest[u],duration:duration[u]},result:earliest[b]}},{earliest:[...earliest]},scene());}
  frames.push(frame(scene(),`「${names[u]}」最早第${earliest[u]}天开始，第${earliest[u]+duration[u]}天结束。`));
 }
 const makespan=earliest[6]+duration[6],latest=Array(n).fill(makespan);record(rec,frames,{phase:'backward',ruleId:'critical-path.backward',action:'从项目完成时刻向后推',explanation:`项目最早完成时刻${makespan}，用它作为最晚时间的终端条件。`},{makespan,latest:[...latest]});
 for(let u=n-1;u>=0;u--){const successors=edges.filter(([a])=>a===u).map(([,b])=>b),deadline=successors.length?Math.min(...successors.map(v=>latest[v])):makespan;latest[u]=deadline-duration[u];record(rec,frames,{phase:'backward',ruleId:'critical-path.backward',action:'推算'+names[u]+'最晚开工',explanation:successors.length?`要赶上所有后继，完成不能晚于它们最晚开始中的最早值${deadline}，减工期${duration[u]}得${latest[u]}。`:`最后任务最迟${makespan}完成，减工期${duration[u]}得${latest[u]}。`,calculation:{formula:'LS(u)=min(LS(successors))−duration(u)',values:{deadline,duration:duration[u]},result:latest[u]},candidates:successors.map(v=>({target:names[v],status:latest[v]===deadline?'chosen':'deferred',reason:latest[v]===deadline?'最早后继截止限制':'截止较宽，但仍须满足',values:{latestStart:latest[v]}}))},{latest:[...latest]},scene(latest));}
 const criticalNodes:number[]=[],slack:number[]=[];for(let i=0;i<n;i++){slack[i]=latest[i]-earliest[i];if(slack[i]===0)criticalNodes.push(i);record(rec,frames,{phase:'slack',ruleId:'critical-path.slack',action:'计算'+names[i]+'的余量',explanation:`最晚${latest[i]}−最早${earliest[i]}=${slack[i]}；${slack[i]===0?'没有拖延余地，是关键任务':'可在该余量内延迟而不改变当前总工期'}。`,calculation:{formula:'slack=LS−ES',values:{latest:latest[i],earliest:earliest[i]},result:slack[i]}},{slack:[...slack],critical:[...criticalNodes]});}
 frames.push(frame(scene(latest),'金色任务没有时间余量；可能存在多条关键路径。',{'项目工期':makespan,'关键任务数':criticalNodes.length}));record(rec,frames,{phase:'stop',ruleId:'critical-path.stop',action:'给出当前工期与关键任务',explanation:'结论依赖当前时长与资源假设；若多条关键路并行，只缩短其中一个任务未必缩短项目。'});
 return {...result(frames,`最短项目工期 ${makespan} 天。关键任务：${criticalNodes.map(i=>names[i]).join('、')}。它们可能分属并行的关键路径。`,{'最短工期':makespan,'关键任务数':criticalNodes.length,'时间余量':slack.join(',')}),trace:rec.trace};
};
export const allocationRunners:Record<string,Runner>={'interval-scheduling':interval,knapsack,hungarian,'stable-matching':stable,'max-flow':maxflow,'graph-coloring':coloring,'critical-path':critical};
