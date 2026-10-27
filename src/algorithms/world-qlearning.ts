import type {Runner,Frame,Scene} from '../engine/types';
import {TraceRecorder,type TeachingValue} from '../engine/teaching';
import {rng,num,str,round,frame,result,palette} from '../engine/utils';

export const qlearning:Runner=(_,p,seed)=>{
 const random=rng(seed),cols=8,rows=6,n=48,goal=n-1,episodes=Math.round(num(p,'episodes',250)),epsilon=num(p,'explore',.25),blocked=str(p,'map','open')==='blocked',walls=new Set(blocked?[4,12,20,28,36,44]:[10,11,12,26,34,35]),q=Array.from({length:n},()=>[0,0,0,0]),dirs=[-cols,1,cols,-1],names=['上','右','下','左'],rewards:{x:number;y:number}[]=[],frames:Frame[]=[];
 const initial:Record<string,TeachingValue>={position:0,episode:0};for(let s=0;s<n;s++)for(let a=0;a<4;a++)initial[`Q[${s},${a}]`]=0;
 const rec=new TraceRecorder('qlearning',seed,initial);let successes=0;
 const transition=(s:number,a:number)=>{const x=s%cols,y=Math.floor(s/cols),valid=a===0?y>0:a===1?x<cols-1:a===2?y<rows-1:x>0;return valid&&!walls.has(s+dirs[a])?s+dirs[a]:s;};
 const map=(visited:number[]):Scene=>{const cells=Array(n).fill(0);walls.forEach(w=>cells[w]=1);visited.forEach(v=>{if(!walls.has(v))cells[v]=2;});cells[0]=4;cells[goal]=5;return{kind:'grid',rows,cols,cells,cellLabels:q.map((v,i)=>walls.has(i)?'':i===goal?'★':['↑','→','↓','←'][v.indexOf(Math.max(...v))])};};
 for(let ep=0;ep<episodes;ep++){
  let s=0,total=0;const visited=[s];
  const parentId=rec.add({phase:'训练轮初始化',ruleId:'q-init',action:`第${ep+1}轮从起点重新尝试`,explanation:'位置重置为起点，但不清空已经学到的Q值。每轮最多150步；到终点立即结束本轮。动作顺序上、右、下、左，贪心同分选第一个。',frameIndex:frames.length,scene:map([0])},{position:0,episode:ep+1,totalReward:0});
  for(let t=0;t<150;t++){
   const exploreDraw=random(),exploring=exploreDraw<epsilon,greedy=q[s].indexOf(Math.max(...q[s])),action=exploring?Math.floor(random()*4):greedy,current=s,before=[...q[s]],next=transition(s,action),reward=next===goal?20:next===s?-1:-.15,old=q[s][action],nextMaximum=next===goal?0:Math.max(...q[next]),target=reward+.93*nextMaximum,updated=old+.3*(target-old);
   q[s][action]=updated;total+=reward;s=next;visited.push(s);
   const eventId=rec.add({parentId,phase:`第${ep+1}轮·第${t+1}步`,ruleId:'q-update',action:`在格${current}选${names[action]}，得到奖励${reward}`,explanation:`探索抽数${round(exploreDraw,4)}${exploring?'<':'≥'}ε=${epsilon}，所以${exploring?'随机探索，动作不必是当前Q最大者':'选择Q最大的动作，同分按上右下左'}。${next===current?'越界或撞墙，留在原格并得−1。':next===goal?'到终点得20，终止状态不再加未来价值。':'合法移动得−0.15。'}把旧Q朝“奖励+折扣后的下一状态最好Q”移动30%。`,frameIndex:frames.length,scene:{kind:'matrix',matrix:[before,[...q[current]]],rowLabels:['更新前','更新后'],columnLabels:names,active:[4+action],title:`第${ep+1}轮第${t+1}步 · 当前格${current} → ${next}`,note:'只更新本次选中的一个Q值；未选动作保持原值。'},calculation:{formula:'Q新=Q旧+α[r+γ max Q(下一格)−Q旧]；终点未来项=0',values:{'Q旧':old,r:reward,'下一格最大Q':nextMaximum,'α':.3,'γ':.93},result:updated},candidates:before.map((value,a)=>({target:names[a],status:a===action?'chosen':'rejected',reason:exploring?(a===action?'本次探索均匀随机抽到了这个动作。':'本次探索未抽中，不代表价值更低。'):a===action?'Q最大；同分按上、右、下、左顺序。':value===before[greedy]?'Q同分，但顺序较晚。':'Q小于本次贪心选择。',values:{Q:value}}))},{[`Q[${current},${action}]`]:updated,position:s,step:t+1,action,exploring,exploreDraw,reward,tdTarget:target,totalReward:total});
   if(s===goal){successes++;break;}
   void eventId;
  }
  rewards.push({x:ep+1,y:total});frames.push({scene:map(visited),secondaryScene:{kind:'lines',series:[{name:'每轮累计奖励',points:[...rewards],color:palette[0]}]},caption:`第${ep+1}轮结束：${s===goal?'到达终点':'150步预算已用完'}。Q值保留到下一轮。`,metrics:{'完成轮数':successes,'本轮奖励':round(total)},eventId:parentId});
 }
 let s=0;const path=[s],evaluationParent=rec.add({phase:'停止训练',ruleId:'q-stop',action:'训练轮数用完，冻结Q表评估',explanation:`已完成${episodes}轮。下面不再探索或更新Q值，只选择当前最大Q来检查策略能否到达。训练奖励不等于保证可达。`,frameIndex:frames.length,scene:map([0])},{position:0,trainingComplete:true});
 for(let t=0;t<n;t++){
  const action=q[s].indexOf(Math.max(...q[s])),next=transition(s,action),loop=path.includes(next),current=s;
  if(!loop){s=next;path.push(s);}
  rec.add({parentId:evaluationParent,phase:'冻结策略评估',ruleId:'q-evaluate',action:loop?'策略回到已有位置，停止检测循环':s===goal?'当前策略到达终点':`从格${current}沿当前最好动作前进`,explanation:loop?'冻结策略是确定性的，重访已有位置会重复同一循环；这里停止而不伪装成成功。':'取当前Q最大动作，同分选上、右、下、左。评估不更新Q；最多检查48步或到达终点。',frameIndex:frames.length,scene:map(path),calculation:{formula:'评估动作=argmax Q(s,a)，不含探索',values:{'当前格':current,'动作':names[action],'下一格':next},result:q[current][action]},candidates:q[current].map((v,a)=>({target:names[a],status:a===action?'chosen':'rejected',reason:a===action?'当前Q最大；同分取较早动作。':'不是本次贪心动作。',values:{Q:v}}))},{position:s,policyPath:[...path],loop});
  if(loop||s===goal)break;
 }
 frames.push(frame(map(path),s===goal?'冻结Q表后，当前策略走到了终点。':'当前策略没有到终点；可以检查探索、训练预算和可达性。'));
 rec.trace.coverageNote='全部真实动作与TD更新逐步记录，以每轮初始化事件为parentId分层。每步使用更新前后Q行的小矩阵，不复制整幅静态地图；完整轮末轨迹另存主动画帧。';
 return {...result(frames,'表格Q-learning：ε贪心探索、α=0.3、γ=0.93；每轮最多150步。所有真实动作和Q更新均可展开，不保证有限训练后一定找到成功策略。',{'训练成功轮数':successes,'总轮数':episodes,'最终策略到达':s===goal?'是':'否','策略步数':path.length-1}),trace:rec.trace};
};
