import type {Frame, LabInput, Params, Runner, Scene, VisualNode} from '../engine/types';
import {clamp,frame,num,result,rng,round,str} from '../engine/utils';
import {TraceRecorder,record,finite,numbers} from './core-teaching';
const depthFirst:Runner=(input,p,seed)=>{
 const cols=clamp(Math.round(Number(input.cols)||20),2,20),rows=clamp(Math.round(Number(input.rows)||12),2,12),size=cols*rows,start=clamp(Math.round(Number(input.start??cols+1)),0,size-1),goal=clamp(Math.round(Number(input.goal??((rows-2)*cols+cols-2))),0,size-1),random=rng(seed),density=clamp(num(p,'density',18),0,65)/100,rough=Math.max(1,num(p,'terrain',4));
 const walls=new Set<number>(input.walls===undefined?Array.from({length:size},(_,i)=>i).filter(()=>random()<density):input.walls.filter(i=>i>=0&&i<size));
 if(input.walls===undefined){for(let x=1;x<cols-1;x++)walls.delete(cols+x);for(let y=1;y<rows-1;y++)walls.delete(y*cols+cols-2);if(str(p,'mode','normal')==='blocked')for(let y=0;y<rows;y++)walls.add(y*cols+Math.floor(cols/2));}walls.delete(start);walls.delete(goal);
 const customCosts=Array.isArray(input.costs)?input.costs as number[]:undefined;
 const costs=Array.from({length:size},(_,i)=>customCosts&&Number.isFinite(customCosts[i])?Math.max(1,customCosts[i]):((Math.floor(i/cols)*7+i%cols*11+seed)%13<5?rough:1)),distance=Array<number>(size).fill(Infinity),parent=Array<number>(size).fill(-1),visited=new Set<number>(),stack:number[]=[],frames:Frame[]=[],route:number[]=[];let current=-1,found=false;distance[start]=0;
 const rec=new TraceRecorder('dfs',seed,{distance:numbers(distance),parent:[...parent],visited:[],stack:[],current:-1,route:[],start,goal,costs,walls:[...walls]});
 const scene=():Scene=>({kind:'grid',cols,rows,title:'深度优先：沿一支深入，再退回岔路',cells:costs.map((c,i)=>i===start?4:i===goal?5:route.includes(i)?3:walls.has(i)?1:visited.has(i)?2:c>1?6:0),palette:['#172630','#34424d','#3c766c','#f6c37b','#78edd0','#ed8fa7','#26314b'],cellLabels:costs.map((_,i)=>walls.has(i)?'':i===start?'起':i===goal?'终':Number.isFinite(distance[i])?String(distance[i]):''),active:current<0?[]:[current],note:'数字为发现时的树深度，不是最短距离。每个栈帧保留尚未检查的方向。'});
 frames.push(frame(scene(),'栈先记起点；每个路口按右、下、左、上依次检查，发现一个新邻居就立即深入。'));
 record(rec,frames,{phase:'initialize',ruleId:'dfs.initialize',action:'准备深度优先调用栈',explanation:'起点深度0，每个新路口记录父节点和下一待查方向。首次进入就标记，避免环形路线重复进入。'});
 const visit=(u:number):boolean=>{
  visited.add(u);stack.push(u);current=u;frames.push(frame(scene(),`进入节点${u}，栈深度${stack.length}。`,{'已探索':visited.size,'当前深度':distance[u]}));
  record(rec,frames,{phase:'select',ruleId:'dfs.select',action:'深入新发现路口',explanation:`进入${u}后暂停父路口尚未检查的方向，先完成这里的探索；第一次发现深度${distance[u]}只描述本次搜索树。`,focus:[String(u)]},{visited:[...visited],stack:[...stack],current:u});
  if(u===goal){found=true;record(rec,frames,{phase:'stop',ruleId:'dfs.stop',action:'进入目标路口',explanation:'已经找到一条可行路线，提前结束剩余分支；本方法不保证最短。'},{found:true});return true;}
  const x=u%cols,y=Math.floor(u/cols);
  for(const [direction,dx,dy]of [['右',1,0],['下',0,1],['左',-1,0],['上',0,-1]] as const){
   current=u;const nx=x+dx,ny=y+dy,v=ny*cols+nx,inside=nx>=0&&nx<cols&&ny>=0&&ny<rows,accept=inside&&!walls.has(v)&&!visited.has(v),reason=!inside?'超出地图边界':walls.has(v)?'该格为障碍':visited.has(v)?'已发现的路口不重复进入；DFS不做最短距离松弛':`尚未访问，记父节点${u}、深度${distance[u]}+1，立即沿这个方向深入`;
   if(accept){parent[v]=u;distance[v]=distance[u]+1;}
   record(rec,frames,{phase:'neighbor',ruleId:'dfs.neighbor',action:'检查'+direction+'侧',explanation:reason,focus:inside?[String(u),String(v)]:[String(u)],candidates:[{target:inside?String(v):'边界外',status:accept?'chosen':'rejected',reason}]},{current:u,distance:numbers(distance),parent:[...parent]},scene());
   if(accept&&visit(v))return true;
  }
  stack.pop();current=stack.at(-1)??-1;record(rec,frames,{phase:'return',ruleId:'dfs.select',action:'该路口查完，退回父层',explanation:`节点${u}四个方向均已检查，弹出它的栈帧；${current<0?'起点也已完成':`返回${current}，继续它尚未检查的下一方向`}。`},{stack:[...stack],current},scene());return false;
 };
 visit(start);
 if(!found)record(rec,frames,{phase:'stop',ruleId:'dfs.stop',action:'调用栈已经清空',explanation:'从起点可达的所有路口都完整检查过，仍未进入目标，因此无路。'},{found:false});
 if(found)for(let at=goal;at!==-1;at=parent[at]){route.unshift(at);frames.push(frame(scene(),`沿首次发现记录从${at}回到${parent[at]===-1?'起点':parent[at]}。`));record(rec,frames,{phase:'backtrack',ruleId:'dfs.backtrack',action:'恢复首次发现的来路',explanation:parent[at]===-1?'起点无父节点，回溯结束。':`首次进入${at}来自${parent[at]}，这个父指针组成一条可行搜索树路径。`,focus:[String(at)]},{route:[...route]});}
 const cost=route.slice(1).reduce((s,v)=>s+costs[v],0),steps=Math.max(0,route.length-1),summary=found?`找到路线：${steps}步，总地形代价${cost}，探索${visited.size}格。深度优先只保证可达性，不保证最少步或最低费用。`:'终点不可达，所有可达分支都已检查。';frames.push(frame(scene(),summary));record(rec,frames,{phase:'result',ruleId:'dfs.backtrack',action:'核对路线',explanation:summary},{route:[...route],cost:found?cost:-1,steps});
 return {...result(frames,summary,{'找到路线':found?1:0,'探索格数':visited.size,'路线步数':steps,'路线代价':found?cost:-1,'路线':route.join(',')}),trace:rec.trace};
};
function pathfinding(method:string):Runner{return(input,p,seed)=>{
 const cols=clamp(Math.round(Number(input.cols)||20),2,20),rows=clamp(Math.round(Number(input.rows)||12),2,12),size=cols*rows;
 const start=clamp(Math.round(Number(input.start??(cols+1))),0,size-1),goal=clamp(Math.round(Number(input.goal??((rows-2)*cols+cols-2))),0,size-1);
 const random=rng(seed),density=clamp(num(p,'density',18),0,65)/100,rough=Math.max(1,num(p,'terrain',4));
 const walls=new Set<number>(input.walls===undefined?Array.from({length:size},(_,i)=>i).filter(()=>random()<density):input.walls.filter(i=>i>=0&&i<size));
 if(input.walls===undefined){for(let x=1;x<cols-1;x++)walls.delete(cols+x);for(let y=1;y<rows-1;y++)walls.delete(y*cols+cols-2);if(str(p,'mode','normal')==='blocked')for(let y=0;y<rows;y++)walls.add(y*cols+Math.floor(cols/2));}
 walls.delete(start);walls.delete(goal);
 const customCosts=Array.isArray(input.costs)?input.costs as number[]:undefined;
 const costs=Array.from({length:size},(_,i)=>customCosts&&Number.isFinite(customCosts[i])?Math.max(1,customCosts[i]):((Math.floor(i/cols)*7+i%cols*11+seed)%13<5?rough:1));
 const dist=Array<number>(size).fill(Infinity),prev=Array<number>(size).fill(-1),seen=new Set<number>(),open=[start],entered=Array<number>(size).fill(-1),frames:Frame[]=[];
 let serial=1,current=-1,found=false;dist[start]=0;entered[start]=0;
 const heuristic=(i:number)=>Math.abs(i%cols-goal%cols)+Math.abs(Math.floor(i/cols)-Math.floor(goal/cols));
 const score=(i:number)=>dist[i]+(method==='astar'?heuristic(i):0);
 const rec=new TraceRecorder(method,seed,{distance:numbers(dist),parent:[...prev],open:[...open],closed:[],current:-1,route:[],start,goal,costs,walls:[...walls]});
 const scene=(route:number[]=[]):Scene=>({kind:'grid',cols,rows,title:'校园路线沙盘',palette:['#172630','#34424d','#3c766c','#f6c37b','#78edd0','#ed8fa7','#26314b','#3b526b'],cells:costs.map((c,i)=>i===start?4:i===goal?5:route.includes(i)?3:walls.has(i)?1:seen.has(i)?2:open.includes(i)?7:c>1?6:0),cellLabels:costs.map((_,i)=>walls.has(i)?'':i===start?'起':i===goal?'终':Number.isFinite(dist[i])?String(method==='astar'?score(i):dist[i]):''),active:current>=0?[current]:[],note:method==='astar'?'格内数字为 f=g+h；蓝色候选尚未确定。右→下→左→上检查。':'格内数字为已知距离；蓝色候选尚未确定。右→下→左→上检查。'});
 frames.push(frame(scene(),'起点进入候选表。点击障碍或移动起终点后，重新计算。',{'已探索':0}));
 record(rec,frames,{phase:'initialize',ruleId:method+'.initialize',action:'登记起点',explanation:'起点距离为0，尚未发现的位置为∞。候选表先只含起点。',focus:[String(start)]});
 while(open.length){
  if(method!=='dfs'&&method!=='bfs')open.sort((a,b)=>score(a)-score(b)||entered[a]-entered[b]);
  const candidates=[...open];const u=method==='dfs'?open.pop()!:open.shift()!;current=u;
  const selection=method==='dfs'?'后进先出，取最后进入栈的候选':method==='bfs'?'先进先出，取最早进入队列的候选':`取最小${method==='astar'?' f=g+h':' g'}，同分时取先入候选表者`;
  frames.push(frame(scene(),selection+'：'+u,{'已探索':seen.size,'待探索':open.length}));
  const selectedId=record(rec,frames,{phase:'select',ruleId:method+'.select',action:'选择下一节点',explanation:selection+'。其他候选只是延后处理，并未被证明无用。',focus:[String(u)],calculation:{formula:method==='astar'?'f(u)=g(u)+|x−gx|+|y−gy|':'priority(u)=g(u)',values:{g:dist[u],h:method==='astar'?heuristic(u):0,sequence:entered[u]},result:score(u)},candidates:candidates.map(v=>({target:String(v),status:v===u?'chosen':'deferred',reason:v===u?selection:'仍留在候选表，之后可以被选中',values:{g:finite(dist[v]),h:method==='astar'?heuristic(v):0,priority:finite(score(v)),sequence:entered[v]}}))},{open:[...open],current:u});
  seen.add(u);record(rec,frames,{parentId:selectedId,phase:'settle',ruleId:method+'.select',action:'登记已处理',explanation:method==='dfs'?'登记这个节点已展开；深度优先不保证最短。':method==='bfs'?'FIFO保证当前层之前的所有层已处理；等步代价下首次距离最少。':method==='astar'?'此处曼哈顿估计相容，且每步代价至少1；被取出的节点可关闭。':'边代价非负，被取出的最小距离已确定。',focus:[String(u)]},{closed:[...seen]},scene());
  if(u===goal){found=true;record(rec,frames,{phase:'stop',ruleId:method+'.stop',action:'终点被取出',explanation:'在从候选表取出终点时停止，而不是一看见终点就停止。',focus:[String(goal)]},{found:true});break;}
  const x=u%cols,y=Math.floor(u/cols);
  for(const [direction,dx,dy]of [['右',1,0],['下',0,1],['左',-1,0],['上',0,-1]] as const){
   const nx=x+dx,ny=y+dy,v=ny*cols+nx,inside=nx>=0&&nx<cols&&ny>=0&&ny<rows;
   let reason='',accept=false,nd=Infinity,step=1;
   if(!inside)reason='超出地图边界';else if(walls.has(v))reason='该格是障碍，没有可通行的边';else if(seen.has(v))reason='节点已处理，不再重复展开';else{
    step=method==='bfs'||method==='dfs'?1:costs[v];nd=dist[u]+step;
    accept=nd<dist[v];reason=accept?`新距离 ${nd} 小于旧距离 ${finite(dist[v])}，更新距离与父节点`:nd===dist[v]?`同为 ${nd}，保留先到的父节点，避免重复入队`:`新距离 ${nd} 更大，保留已有 ${dist[v]}`;
   }
   if(accept){dist[v]=nd;prev[v]=u;if(!open.includes(v)){open.push(v);entered[v]=serial++;}}
   record(rec,frames,{parentId:selectedId,phase:'neighbor',ruleId:method+'.neighbor',action:'检查'+direction+'侧',explanation:reason,focus:inside?[String(u),String(v)]:[String(u)],calculation:inside&&!walls.has(v)&&!seen.has(v)?{formula:'candidate=g(u)+cost(u,v)',values:{g:dist[u],cost:step},result:nd}:undefined,candidates:[{target:inside?String(v):'边界外',status:accept?'chosen':'rejected',reason}]},{distance:numbers(dist),parent:[...prev],open:[...open]},scene());
  }
 }
 if(!found)record(rec,frames,{phase:'stop',ruleId:method+'.stop',action:'候选表为空',explanation:'所有可达候选都已处理，终点仍未被取出，因此无路。'},{found:false});
 const route:number[]=[];
 if(found){let at=goal;while(at!==-1){route.unshift(at);frames.push(frame(scene(route),`从 ${at} 沿父节点 ${prev[at]===-1?'到达起点':prev[at]} 回溯。`));record(rec,frames,{phase:'backtrack',ruleId:method+'.backtrack',action:'沿父指针恢复路线',explanation:prev[at]===-1?'起点没有父节点，回溯结束。':`节点 ${at} 的最好记录来自 ${prev[at]}，因此向它回退。`,focus:[String(at)]},{route:[...route]});at=prev[at];}}
 const cost=route.slice(1).reduce((s,v)=>s+costs[v],0),steps=Math.max(0,route.length-1);
 const summary=found?`找到路线：${steps} 步，总地形代价 ${cost}，探索了 ${seen.size} 格。${method==='dfs'?'深度优先只保证找路，不保证最短。':method==='bfs'?'步数最少不代表地形代价最低。':method==='astar'?'四邻接、步代价至少1与相容曼哈顿估计保证本例最小总代价。':'非负边代价保证本例最小总代价。'}`:'终点不可达。试着在隔断墙上打开一个缺口。';
 frames.push(frame(scene(route),summary,{'已探索':seen.size,'路线步数':steps,'路线代价':found?cost:'无路'}));
 record(rec,frames,{phase:'result',ruleId:method+'.backtrack',action:'核对路线',explanation:summary},{route:[...route],cost:found?cost:-1,steps});
 return {...result(frames,summary,{'找到路线':found?1:0,'探索格数':seen.size,'路线步数':steps,'路线代价':found?cost:-1,'路线':route.join(',')}),trace:rec.trace};
};}
type Edge={u:number;v:number;w:number};
export function network(p:Params,seed:number,directed=false){const random=rng(seed),n=clamp(Math.round(num(p,'nodes',7)),3,10),extra=clamp(num(p,'density',35),0,100)/100,edges:Edge[]=[];for(let i=0;i<n-1;i++)edges.push({u:i,v:i+1,w:1+Math.floor(random()*12)});for(let i=0;i<n;i++)for(let j=i+2;j<n;j++)if(random()<extra)edges.push({u:i,v:j,w:1+Math.floor(random()*12)});const nodes:VisualNode[]=Array.from({length:n},(_,i)=>({id:String(i),x:50+38*Math.cos(i/n*Math.PI*2-Math.PI/2),y:50+37*Math.sin(i/n*Math.PI*2-Math.PI/2),label:String.fromCharCode(65+i)}));return{n,nodes,edges,directed};}
function netScene(net:ReturnType<typeof network>,chosen:Edge[]=[],nodeColors?:string[]):Scene{return{kind:'graph',title:'关系网络',nodes:net.nodes.map((v,i)=>({...v,color:nodeColors?.[i]})),edges:net.edges.map(e=>({from:String(e.u),to:String(e.v),label:net.directed?undefined:String(e.w),directed:net.directed,color:chosen.includes(e)?'#f6c37b':'#355362',width:chosen.includes(e)?3:1}))};}
const kruskal:Runner=(_input,p,seed)=>{
 const net=network(p,seed),parent=Array.from({length:net.n},(_,i)=>i),chosen:Edge[]=[],frames:Frame[]=[],rec=new TraceRecorder('kruskal',seed,{parent:[...parent],chosen:[],total:0});let total=0;
 frames.push(frame(netScene(net),'先让每个地点各自属于一个连通区域。'));record(rec,frames,{phase:'initialize',ruleId:'kruskal.initialize',action:'准备按费用排序的边',explanation:'边按费用升序处理，同费用按原始输入顺序。每个点初始自成一组。'},{edgeOrder:[...net.edges].sort((a,b)=>a.w-b.w).map(e=>`${e.u}-${e.v}:${e.w}`)});
 const find=(v:number)=>{const chain:number[]=[];let root=v;while(parent[root]!==root){chain.push(root);root=parent[root];}record(rec,frames,{phase:'find',ruleId:'kruskal.find',action:'沿组长指针找连通区域',explanation:`节点${v}沿 ${chain.concat(root).join('→')} 找到根${root}。`,focus:[String(v),String(root)]});for(const node of chain){parent[node]=root;record(rec,frames,{phase:'find',ruleId:'kruskal.find',action:'压短组长链',explanation:`把${node}直接指向根${root}，只加快以后查组，不改变连通关系。`},{parent:[...parent]});}return root;};
 for(const e of [...net.edges].sort((a,b)=>a.w-b.w)){
  const a=find(e.u),b=find(e.v),take=a!==b;if(take){parent[a]=b;chosen.push(e);total+=e.w;}
  const explanation=take?`根${a}≠根${b}，边${e.u}—${e.v}连接不同区域，可以加入；总费用增加${e.w}。`:`两端根同为${a}，已有路径连接，再加这条边会成环，拒绝。`;
  frames.push(frame(netScene(net,chosen),explanation,{'已建线路':chosen.length,'总费用':total}));record(rec,frames,{phase:'edge',ruleId:'kruskal.choose',action:'决定是否修这条边',explanation,focus:[String(e.u),String(e.v)],calculation:{formula:'accept ⇔ find(u) ≠ find(v)',values:{rootU:a,rootV:b,weight:e.w},result:take?'接受':'拒绝'},candidates:[{target:`${e.u}—${e.v}`,status:take?'chosen':'rejected',reason:take?'当前最便宜的跨组连接':'同组连接会形成环'}]},{parent:[...parent],chosen:chosen.map(v=>`${v.u}-${v.v}`),total});
  if(chosen.length===net.n-1)break;
 }
 record(rec,frames,{phase:'stop',ruleId:'kruskal.stop',action:'生成树完成',explanation:`已加入${net.n-1}条无环边并连接全部${net.n}个点；其余边无需再选。`});
 return {...result(frames,`用 ${chosen.length} 条线路连通 ${net.n} 个地点，最低总费用 ${total}。`,{'最低总费用':total,'线路数':chosen.length}),trace:rec.trace};
};
const floyd:Runner=(_input,p,seed)=>{
 const net=network(p,seed),n=net.n,d=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:Infinity)),frames:Frame[]=[];
 for(const e of net.edges)d[e.u][e.v]=d[e.v][e.u]=e.w;
 const rec=new TraceRecorder('floyd-warshall',seed,{distances:d.map(numbers)});
 const scene=(i=-1,j=-1,k=-1):Scene=>({kind:'matrix',matrix:d.map(row=>row.map(v=>Number.isFinite(v)?v:-1)),rowLabels:net.nodes.map(v=>v.label!),columnLabels:net.nodes.map(v=>v.label!),active:i<0?[]:[i*n+j,i*n+k,k*n+j],title:'每一对地点的最短距离',note:k<0?'−1表示尚未找到连接':`检查 ${net.nodes[i].label}→${net.nodes[k].label}→${net.nodes[j].label}；−1表示无已知路径`});
 frames.push(frame(scene(),'对角为0，直达边填费用，其余暂记∞。'));record(rec,frames,{phase:'initialize',ruleId:'floyd-warshall.initialize',action:'建立直达表',explanation:'尚未允许任何中转点；同点到自身代价0，无直达边暂为∞。'});
 let updates=0;
 for(let k=0;k<n;k++){let changes=0;frames.push(frame(scene(),`本轮新允许 ${net.nodes[k].label} 作为中转点。`));record(rec,frames,{phase:'intermediate',ruleId:'floyd-warshall.intermediate',action:'扩展允许中转集合',explanation:`k=${k}：以前允许0…${k-1}；现在额外允许${k}，所有地点对都要检查。`},{intermediate:k});
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const before=d[i][j],left=d[i][k],right=d[k][j],via=left+right,improve=via<before;if(improve){d[i][j]=via;changes++;updates++;}
   record(rec,frames,{phase:'compare',ruleId:'floyd-warshall.compare',action:`检查${net.nodes[i].label}到${net.nodes[j].label}`,explanation:!Number.isFinite(via)?'经此中转点有一段尚不可达，不能生成有限的新路线。':improve?`经${net.nodes[k].label}的${left}+${right}=${via}小于旧值${finite(before)}，更新。`:`经${net.nodes[k].label}得到${via}，不小于旧值${finite(before)}，保留原值。`,calculation:{formula:'D[i,j]=min(D[i,j],D[i,k]+D[k,j])',values:{old:finite(before),left:finite(left),right:finite(right)},result:finite(d[i][j])},candidates:[{target:'经'+net.nodes[k].label,status:improve?'chosen':'rejected',reason:!Number.isFinite(via)?'至少一段不可达':improve?'费用更小':via===before?'同值无需更新':'费用更大'}]},{distances:d.map(numbers),updates},scene(i,j,k));
  }
  frames.push(frame(scene(),`允许经过 ${net.nodes[k].label} 后，改善${changes}对路线。`));
 }
 const a=clamp(Math.round(num(p,'origin',0)),0,n-1),b=n-1;record(rec,frames,{phase:'stop',ruleId:'floyd-warshall.stop',action:'任意两点距离已完成',explanation:'所有节点都已依次成为允许的中转点；当前教学图没有负边，也没有负环。'},{query:d[a][b]});
 return {...result(frames,`任意两点最短距离都已算好。${net.nodes[a].label} 到 ${net.nodes[b].label} 的最低费用是 ${d[a][b]}。`,{'查询距离':d[a][b],'改善次数':updates,'地点数':n}),trace:rec.trace};
};
const topological:Runner=(_input,p,seed)=>{
 const net=network(p,seed,true),n=net.n;if(str(p,'cycle','no')==='yes')net.edges.push({u:n-1,v:0,w:1});const degree=Array(n).fill(0);for(const e of net.edges)degree[e.v]++;
 const done:number[]=[],ready=degree.map((v,i)=>v===0?i:-1).filter(v=>v>=0),frames:Frame[]=[],rec=new TraceRecorder('topological',seed,{degree:[...degree],ready:[...ready],done:[]});
 const scene=()=>netScene(net,[],Array.from({length:n},(_,i)=>done.includes(i)?'#78edd0':ready.includes(i)?'#f6c37b':'#52677c'));
 frames.push(frame(scene(),'入度0表示没有未完成的前置条件，现在就可开始。'));record(rec,frames,{phase:'initialize',ruleId:'topological.initialize',action:'统计未完成前置项',explanation:'每条指向任务的边给它的入度加1；入度0的任务按编号进入可做队列。'});
 while(ready.length){const u=ready.shift()!;done.push(u);frames.push(frame(scene(),`安排 ${net.nodes[u].label}。`));record(rec,frames,{phase:'select',ruleId:'topological.select',action:'执行一个可做任务',explanation:`${net.nodes[u].label}入度为0；同样可做的任务不止一个时，本例按FIFO顺序选择。`,focus:[String(u)]},{done:[...done],ready:[...ready]});
  for(const e of net.edges)if(e.u===u){const before=degree[e.v];degree[e.v]--;const freed=degree[e.v]===0;if(freed)ready.push(e.v);record(rec,frames,{phase:'unlock',ruleId:'topological.unlock',action:'移除一项前置依赖',explanation:`${net.nodes[e.v].label}的未完成前置项 ${before}−1=${degree[e.v]}，${freed?'全部满足，加入可做队列':'仍有其他前置项，暂不能开始'}。`,focus:[String(u),String(e.v)],calculation:{formula:'indegree[v] -= 1',values:{before},result:degree[e.v]},candidates:[{target:String(e.v),status:freed?'chosen':'deferred',reason:freed?'入度降至0':'还有未完成前置项'}]},{degree:[...degree],ready:[...ready]},scene());}
 }
 const ok=done.length===n,summary=ok?`可行顺序：${done.map(i=>net.nodes[i].label).join(' → ')}。`:'无法排出完整顺序：依赖中存在循环；未安排节点可能在环上，也可能受环阻挡。';frames.push(frame(scene(),summary));record(rec,frames,{phase:'stop',ruleId:'topological.stop',action:'检查是否覆盖全部任务',explanation:ok?'处理数等于节点数，所有先修关系都满足。':'可做队列为空但任务未完；环使其中一些前置条件永远无法清零。'},{possible:ok});
 return {...result(frames,summary,{'可行':ok?1:0,'已安排任务':done.length,'顺序':done.join(',')}),trace:rec.trace};
};
export const graphRunners:Record<string,Runner>={bfs:pathfinding('bfs'),dfs:depthFirst,dijkstra:pathfinding('dijkstra'),astar:pathfinding('astar'),kruskal,'floyd-warshall':floyd,topological};
