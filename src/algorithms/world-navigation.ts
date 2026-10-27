import type {Runner,Scene,VisualNode} from '../engine/types';
import {rng,num,str,clamp,round,palette} from '../engine/utils';
import {WorldRecord} from './world-record';
type P={x:number;y:number};
type Obstacle=P&{r:number};
const dist=(a:P,b:P)=>Math.hypot(a.x-b.x,a.y-b.y);
function obstacles(mode:string):Obstacle[]{return mode==='blocked'?Array.from({length:11},(_,i)=>({x:50,y:i*10,r:6})):mode==='trap'?[{x:55,y:35,r:6},{x:55,y:45,r:6},{x:55,y:55,r:6},{x:55,y:65,r:6},{x:45,y:35,r:6},{x:35,y:35,r:6},{x:45,y:65,r:6},{x:35,y:65,r:6}]:[{x:35,y:40,r:10},{x:58,y:63,r:11},{x:68,y:30,r:9}];}
function clearance(a:P,b:P,obs:Obstacle[]){return obs.map(o=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((o.x-a.x)*dx+(o.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(a.x+t*dx-o.x,a.y+t*dy-o.y)-o.r-1;});}
const obstacleNodes=(obs:Obstacle[]):VisualNode[]=>obs.map(o=>({...o,r:0,color:'#354958',label:'障碍'}));
const obstaclePolygons=(obs:Obstacle[])=>obs.map(o=>({points:Array.from({length:32},(_,i)=>({x:o.x+o.r*Math.cos(i/32*2*Math.PI),y:o.y+o.r*Math.sin(i/32*2*Math.PI)})),color:'#354958'}));
const encode=(pts:P[])=>pts.map(a=>[a.x,a.y]);

export const rrt:Runner=(_,p,seed)=>{
 const random=rng(seed),obs=obstacles(str(p,'map','open')),budget=Math.round(num(p,'iterations',280)),step=num(p,'step',7),start={x:8,y:50},goal={x:92,y:50},nodes:P[]=[start],parents=[-1];
 let found=-1,samples=0;const log=new WorldRecord('rrt',seed,{nodes:encode(nodes),parents:[...parents],found});
 const scene=(target?:P,next?:P,near?:number,rejected=false):Scene=>({kind:'world',polygons:obstaclePolygons(obs),nodes:[...obstacleNodes(obs),{...start,label:'起点',color:palette[0],r:4},{...goal,label:'终点',color:palette[1],r:4},...(target?[{...target,label:'采样目标',color:palette[3],r:2}]:[])],paths:[...nodes.slice(1).map((n,i)=>({points:[nodes[parents[i+1]],n],color:'#527c86'})),...(next&&near!==undefined?[{points:[nodes[near],next],color:rejected?'#ef8c91':palette[0]}]:[])]});
 for(let i=0;i<budget;i++){
  samples=i+1;const goalBiased=random()<.12,target=goalBiased?goal:{x:random()*100,y:random()*100},distances=nodes.map(n=>dist(n,target));let near=0;
  for(let j=1;j<nodes.length;j++)if(distances[j]<distances[near])near=j;
  log.add({phase:'采样与最近节点',ruleId:'rrt-nearest',action:goalBiased?'本次采样直接瞄准终点':'随机采样一个位置',explanation:`以12%概率选终点，否则在100×100区域均匀采样。从已有树节点中选欧氏距离最小者${near+1}，同分保留较早加入者；不是从起点重新直连。`,calculation:{formula:'near = argmin 节点到采样点的欧氏距离',values:{'采样x':target.x,'采样y':target.y,'已有节点数':nodes.length,'最近编号':near+1},result:distances[near]},candidates:distances.map((d,j)=>({target:'树节点 '+(j+1),status:j===near?'chosen':'rejected',reason:j===near?'到当前采样点最近，同分选较早编号。':'到采样点更远，或同分但加入较晚。',values:{'距离':d}}))},scene(target),{sample:[target.x,target.y],distances,nearest:near,samples});
  const d=distances[near]||1,scale=Math.min(1,step/d),next={x:nodes[near].x+(target.x-nodes[near].x)*scale,y:nodes[near].y+(target.y-nodes[near].y)*scale},gaps=clearance(nodes[near],next,obs),bad=gaps.findIndex(v=>v<=0);
  if(bad<0){nodes.push(next);parents.push(near);}
  log.add({phase:'延伸与碰撞',ruleId:'rrt-extend',action:bad<0?'整段无碰撞，加入树':'线段碰到障碍，拒绝本次延伸',explanation:`从最近节点朝采样点最多走 ${step}。检查整条线段到每个圆障碍的最近距离，扣除半径和1单位安全边距；${bad<0?'全部余量大于0，保存新节点及父节点。':`障碍${bad+1}余量${round(gaps[bad],3)}≤0，树不改变。`}`,calculation:{formula:'q新=q近+min(1,步长/距离)×(q样本−q近)',values:{'距离':d,'步长':step,'缩放':scale,'最小碰撞余量':Math.min(...gaps)},result:bad<0?'接受':'拒绝'},candidates:gaps.map((v,j)=>({target:'障碍 '+(j+1),status:v<=0?'rejected':'chosen',reason:v<=0?'线段进入含安全边距的障碍。':'线段与该障碍保持正余量。',values:{'余量':v}}))},scene(target,next,near,bad>=0),{nodes:encode(nodes),parents:[...parents],candidate:[next.x,next.y],clearances:gaps,accepted:bad<0});
  if(bad<0){
   const goalDistance=dist(next,goal),goalGaps=clearance(next,goal,obs),canConnect=goalDistance<step&&goalGaps.every(v=>v>0);
   if(canConnect){nodes.push(goal);parents.push(nodes.length-2);found=nodes.length-1;}
   log.add({phase:'检查终点',ruleId:'rrt-goal',action:canConnect?'距离足够近且无碰撞，连上终点':'继续采样，尚不能连接终点',explanation:goalDistance>=step?'到终点还不小于一步长度，继续扩展。':canConnect?'终点在一步范围内，整段也没有障碍；可以沿父节点回溯。':'虽在一步范围内，连接线段仍碰撞，不能穿墙连接。',calculation:{formula:'可连接 = 距离 < 步长 且所有碰撞余量 > 0',values:{'到终点距离':goalDistance,'步长':step,'最小余量':Math.min(...goalGaps)},result:canConnect?'是':'否'}},scene(),{nodes:encode(nodes),parents:[...parents],found});
  }
  if(found>=0)break;
 }
 const path:P[]=[];let length=0,j=found;while(j>=0){path.unshift(nodes[j]);if(parents[j]>=0)length+=dist(nodes[j],nodes[parents[j]]);j=parents[j];}
 const final=scene();if(path.length)final.paths!.push({points:path,color:palette[0]});
 log.add({phase:'回溯或报告预算',ruleId:'rrt-finish',action:found>=0?'沿父节点得到一条可行路径':'采样预算用完，没有找到路线',explanation:found>=0?'从终点反复取父节点直到起点，再反转顺序。这里只保证找到的路径避障，不保证最短。':`已尝试${samples}次；没有找到路线不等于证明无路。封锁预设的圆障碍覆盖了整个中间边界，属于明确不可通行的例子。`,calculation:{formula:'路线长度=相邻路径点欧氏距离之和',values:{'路径点数':path.length,'采样次数':samples,'预算':budget},result:length}},final,{path:encode(path),length});
 return log.finish(found>=0?'普通RRT找到了可行路线，但不保证最短；不含车辆动力学。':'本次预算内未找到路线；一般不能据此证明无路。',{'找到路线':found>=0?'是':'否','路线长度':round(length),'树节点':nodes.length});
};

export const potential:Runner=(_,p,seed)=>{
 const obs=obstacles(str(p,'map','open')),gain=num(p,'repulsion',70),goal={x:92,y:50};let pos={x:8,y:50};const trail:P[]=[{...pos}],log=new WorldRecord('potential-field',seed,{position:[pos.x,pos.y]});
 const scene=():Scene=>({kind:'world',polygons:obstaclePolygons(obs),nodes:[...obstacleNodes(obs),{...goal,color:palette[1],label:'目标',r:4},{...pos,color:palette[0],label:'机器人',r:4}],paths:[{points:[...trail],color:palette[0]}]});
 for(let t=0;t<350;t++){
  const attraction={x:.06*(goal.x-pos.x),y:.06*(goal.y-pos.y)},terms=obs.map(o=>{const d=dist(pos,o),edge=Math.max(.2,d-o.r),magnitude=edge<18?gain*(1/edge-1/18)/(edge*edge):0;return{d,edge,magnitude,x:magnitude*(pos.x-o.x)/(d||1),y:magnitude*(pos.y-o.y)/(d||1)};});
  const fx=attraction.x+terms.reduce((s,v)=>s+v.x,0),fy=attraction.y+terms.reduce((s,v)=>s+v.y,0),norm=Math.hypot(fx,fy);
  log.add({phase:'计算合力',ruleId:'potential-force',action:'把目标吸引与近处障碍排斥相加',explanation:'目标吸引为0.06倍目标方向。只让距离障碍边缘小于18的障碍产生排斥，边缘距离最低按0.2计算以避免除零。全部分力同时相加，可能互相抵消。',calculation:{formula:'F吸=0.06(q目标−q)；F斥=η(1/d−1/18)/d²×远离方向',values:{'吸引x':attraction.x,'吸引y':attraction.y,'合力x':fx,'合力y':fy},result:norm},candidates:terms.map((v,j)=>({target:'障碍 '+(j+1),status:v.edge<18?'chosen':'rejected',reason:v.edge<18?'进入影响范围，计入排斥。':'边缘距离不小于18，本步不施加排斥。',values:{'边缘距离':v.edge,'排斥大小':v.magnitude}}))},scene(),{attraction:[attraction.x,attraction.y],repulsion:terms.map(v=>[v.x,v.y,v.edge]),force:[fx,fy],tick:t});
  const move={x:clamp(pos.x+fx/Math.max(1,norm)*.8,1,99),y:clamp(pos.y+fy/Math.max(1,norm)*.8,1,99)},gaps=clearance(pos,move,obs),blocked=gaps.some(v=>v<=0);
  if(!blocked)pos=move;trail.push({...pos});
  log.add({phase:'移动与停止检查',ruleId:'potential-step',action:blocked?'候选线段碰撞，本步停留':dist(pos,goal)<2?'进入目标2单位范围，停止':'沿合力移动后继续',explanation:`移动向量为0.8F/max(1,|F|)，所以大合力下也限制步长。${blocked?'碰撞检查拒绝候选段。':norm<.2?'合力很小，两股力量接近平衡，可能停在局部极小值。':'候选段通过碰撞检查。'}达到目标2单位范围就停止，否则最多350步。`,calculation:{formula:'q新=clip(q+0.8F/max(1,|F|),1,99)，碰撞则保留q',values:{'合力':norm,'候选x':move.x,'候选y':move.y,'最小碰撞余量':Math.min(...gaps)},result:dist(pos,goal)}},scene(),{position:[pos.x,pos.y],candidate:[move.x,move.y],blocked,distance:dist(pos,goal)}, {'距目标':round(dist(pos,goal)),'合力':round(norm)});
  if(dist(pos,goal)<2)break;
 }
 return log.finish('人工势场只用局部吸引与排斥；U形障碍可能形成平衡点，没有全局可达或最短保证。',{'距目标':round(dist(pos,goal)),'到达目标':dist(pos,goal)<2?'是':'否'});
};

export const purePursuit:Runner=(_,p,seed)=>{
 const look=num(p,'lookahead',12),speed=num(p,'speed',4),offset=num(p,'offset',10),route=Array.from({length:61},(_,i)=>({x:5+90*i/60,y:50+22*Math.sin(i/60*2*Math.PI)}));let pos={x:5,y:50+offset},heading=0,nearest=0,sumError=0,steps=0;const trail:P[]=[{...pos}],log=new WorldRecord('pure-pursuit',seed,{position:[pos.x,pos.y],heading,nearest});
 const scene=(aim:P):Scene=>({kind:'world',paths:[{points:route,color:palette[1],dashed:true},{points:[...trail],color:palette[0]},{points:[pos,aim],color:palette[3]}],nodes:[{...pos,label:'小车',r:4,color:palette[0]},{...aim,label:'前视点',r:3,color:palette[3]}]});
 for(let t=0;t<500;t++){
  let idx=nearest;const candidates=[];for(let i=nearest;i<Math.min(route.length,nearest+12);i++){candidates.push({i,d:dist(pos,route[i])});if(dist(pos,route[i])<dist(pos,route[idx]))idx=i;}nearest=idx;
  let target=nearest;while(target<route.length-1&&dist(pos,route[target])<look)target++;const aim=route[target],distance=dist(pos,aim),alpha=Math.atan2(aim.y-pos.y,aim.x-pos.x)-heading,delta=Math.atan2(8*Math.sin(alpha),Math.max(.1,distance));
  log.add({phase:'选择前视点',ruleId:'pursuit-target',action:'先找附近路线位置，再向前找前视点',explanation:`仅从上次最近编号开始向前检查最多12个路点，选最近者；再前进到首个距离不小于${look}的路点，或路线末点。这里不是精确的圆与连续曲线求交。`,calculation:{formula:'前视点=首个距离≥L的后续离散路点，末点兜底',values:{'最近路点':nearest+1,'前视编号':target+1,'前视阈值':look},result:distance},candidates:candidates.map(c=>({target:'路点 '+(c.i+1),status:c.i===nearest?'chosen':'rejected',reason:c.i===nearest?'当前向前搜索窗口内最近，同分保留较早者。':'在当前窗口内更远或同分编号较晚。',values:{'距离':c.d}}))},scene(aim),{nearest,target,aim:[aim.x,aim.y],tick:t});
  log.add({phase:'计算转向',ruleId:'pursuit-steer',action:'根据前视方向计算转角',explanation:`前视方向与车头差α=${round(alpha,4)}弧度。轴距L=4，转角δ=atan2(2L sinα,距离)。这是几何转向规则，不会直接把车搬到路点。`,calculation:{formula:'δ=atan2(2L sinα, max(0.1,前视距离))',values:{L:4,'α':alpha,'前视距离':distance},result:delta}},scene(aim),{alpha,delta});
  heading+=speed/4*Math.tan(delta)*.1;pos={x:pos.x+speed*Math.cos(heading)*.1,y:pos.y+speed*Math.sin(heading)*.1};trail.push({...pos});sumError+=dist(pos,route[nearest]);steps++;
  log.add({phase:'推进车辆',ruleId:'pursuit-motion',action:dist(pos,route[route.length-1])<1.5?'进入终点范围，停止':'按车辆朝向前进0.1秒',explanation:'使用简化自行车运动学：先更新朝向，再用新朝向更新位置。距终点小于1.5时停止，否则最多500步。速度与前视距离都会影响切弯和误差。',calculation:{formula:'θ新=θ+v/L tanδ×dt；位置+=v(cosθ新,sinθ新)dt',values:{v:speed,L:4,dt:.1,'θ新':heading,'新x':pos.x},result:pos.y}},scene(aim),{heading,position:[pos.x,pos.y],steps}, {'跟踪误差':round(dist(pos,route[nearest])),'前视距离':look});
  if(dist(pos,route[route.length-1])<1.5)break;
 }
 return log.finish('离散路点 Pure Pursuit；近邻搜索只向前看12点，使用固定速度和简化自行车模型，不含打滑、障碍规划和速度规划。',{'平均跟踪误差':round(sumError/steps),'最终距终点':round(dist(pos,route[route.length-1]))});
};
