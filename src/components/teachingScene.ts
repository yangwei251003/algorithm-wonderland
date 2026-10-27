import type {Scene} from '../engine/types';
import type {ExecutionTrace,TraceEvent} from '../engine/teaching';
import {stateAtTrace} from '../engine/teaching';
type Point={x:number;y:number};
/** Clip the display plane against the current recorded logistic score, without fitting. */
function logisticHalfPlane(weights:number[],positive:boolean):Point[]{
 const corners=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],out:Point[]=[];
 const score=(p:Point)=>weights[0]+weights[1]*(p.x-50)/40+weights[2]*(p.y-50)/40;
 corners.forEach((a,i)=>{const b=corners[(i+1)%4],va=score(a),vb=score(b),ina=positive?va>=0:va<=0,inb=positive?vb>=0:vb<=0;if(ina)out.push(a);if(ina!==inb){const t=va/(va-vb);out.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}});return out;
}
/** Present already-recorded inputs while an intermediate prediction does not exist yet. */
export function teachingScene(scene:Scene,event:TraceEvent|undefined,trace:ExecutionTrace|undefined):Scene {
 if(trace?.algorithmId==='kalman'&&event&&Number(event.id)<6){
  const index=Number(event.id),start=index-index%3,predict=trace.events[start].calculation!,gain=trace.events[start+1].calculation!,update=trace.events[start+2].calculation!,p=predict.values,u=update.values;
  const beliefs=index%3===0?[{label:'上次估计',mean:Number(p['旧位置']),variance:Number(p['旧方差']),color:'#9eafba'},{label:'本步预测',mean:Number(p['预测位置']),variance:Number(predict.result),color:'#78edd0'}]:[{label:'预测',mean:Number(p['预测位置']),variance:Number(predict.result),color:'#78edd0'},{label:'本次测量',mean:Number(u.z),variance:Number(gain.values.R),color:'#90b3ff'}];
  if(index%3===2)beliefs.push({label:'融合结果',mean:Number(update.result),variance:Number(u['新方差']),color:'#f6c37b'});
  return {kind:'beliefs',beliefs,mixWeight:index%3===1?Number(gain.result):undefined,title:'同一把位置尺：估计在哪里，有多不确定',note:'横线宽度是±1个标准差，不是必然落入的范围。横坐标为位置；越窄表示设定的方差越小。'};
 }
 if(trace?.algorithmId==='logistic-regression'&&event){
  const state=stateAtTrace(trace,Number(event.id)),weights=state.weights as number[],train=state.train as number[][],test=state.test as number[][];
  const trainIndex=event.phase==='sample'?Number(event.action.match(/样本(\d+)/)?.[1])-1:-1,testIndex=event.phase==='evaluate'?Number(event.action.match(/点(\d+)/)?.[1])-1:-1;
  const zero=weights.every(w=>Math.abs(w)<1e-14),positive=logisticHalfPlane(weights,true),negative=logisticHalfPlane(weights,false);
  const score=(p:Point)=>weights[0]+weights[1]*(p.x-50)/40+weights[2]*(p.y-50)/40;
  const boundary=positive.filter(p=>Math.abs(score(p))<1e-10).filter((p,i,all)=>all.findIndex(q=>Math.abs(q.x-p.x)<1e-9&&Math.abs(q.y-p.y)<1e-9)===i);
  return {kind:'scatter',yUp:true,title:zero?'初始概率均为0.5，尚未学出区分':'当前权重决定边界：概率≥0.5判为1',polygons:zero?[]:[{points:negative,color:'#78edd0'},{points:positive,color:'#f6c37b'}],paths:!zero&&boundary.length>=2?[{points:boundary.slice(0,2),color:'#ffffff'}]:[],nodes:[...train.map((p,i)=>({id:'train'+i,x:p[0],y:p[1],color:p[2]?'#f6c37b':'#78edd0',r:i===trainIndex?2.4:1.1,label:i===trainIndex?'训练'+(i+1):undefined})),...test.map((p,i)=>({id:'test'+i,x:p[0],y:p[1],color:p[2]?'#f6c37b':'#78edd0',r:i===testIndex?2.4:1.3,hollow:true,label:i===testIndex?'验证'+(i+1):undefined}))],note:`实心是训练样本，空心是验证样本；点色是真实类别，底色是当前模型的预测。权重 [${weights.map(w=>w.toFixed(3)).join('、')}]，验证点不更新权重。`};
 }
 if(trace&&event&&['moving-average','exponential-smoothing'].includes(trace.algorithmId)&&['evaluate','stop'].includes(event.phase)){
  const state=stateAtTrace(trace,Number(event.id)),data=state.data as number[],predictions=state.predictions as Record<string,number>,day=Number((event.action+' '+event.explanation).match(/第(\d+)天/)?.[1]),vals=event.calculation?.values??{};
  const forecast=Number(vals.prediction??vals.forecast),actual=Number(vals.actual),series=[{name:'实际值',color:'#78edd0',points:data.map((y,i)=>({x:i+1,y}))},{name:'事先预测',color:'#f6c37b',points:Object.entries(predictions).filter(([i])=>trace.algorithmId!=='exponential-smoothing'||Number(i)!==0).map(([i,y])=>({x:Number(i)+1,y})).sort((a,b)=>a.x-b.x)}];
  if(Number.isFinite(day))series.push({name:'本次绝对误差',color:'#ffffff',points:[{x:day,y:actual},{x:day,y:forecast}]});
  return {kind:'lines',series,title:Number.isFinite(day)?`第${day}天：事后核对预测`:'汇总已观察日期的误差',note:`${Number.isFinite(day)?`|实际 ${actual} − 预测 ${forecast}| = ${Number(event.calculation?.result).toFixed(3)}。`:''}未来一天尚无实际值，不计入误差。${trace.algorithmId==='exponential-smoothing'?'第1天只用于初始化，也不计入误差。':''}`};
 }
 if(trace?.algorithmId==='exponential-smoothing'&&event?.phase==='update'){
  const v=event.calculation?.values??{};
  return {kind:'bars',values:[Number(v.recent),Number(v.history)],labels:['最新实际的贡献','旧预测的贡献'],colors:['#78edd0','#f6c37b'],title:'新预测 = 两部分按权重相加',note:`${v.observed} × ${v.alpha} + ${v.previous} × ${(1-Number(v.alpha)).toFixed(2)} = ${Number(event.calculation?.result).toFixed(3)}；只用预测前已经知道的信息。`};
 }
 if(trace&&['minimax','mcts'].includes(trace.algorithmId)&&scene.kind==='grid')return {...scene,showNodeIds:true,nodeIdOffset:1,note:'格号从左到右、从上到下为 1—9；X/O 是当前推演局面。'};
 if(trace&&event&&['ucb','thompson'].includes(trace.algorithmId)){
  const state=stateAtTrace(trace,Number(event.id)),count=state.count as number[],success=state.success as number[];
  const chosen=[...trace.events.slice(0,Number(event.id)+1)].reverse().find(e=>e.candidates)?.candidates?.findIndex(c=>c.status==='chosen');
  return {...scene,values:count.map((n,i)=>n?success[i]/n:0),active:chosen===undefined?[]:[chosen],note:`柱高仅表示已观察的历史成功率；暖橙标出本轮选中者。选择依据是${trace.algorithmId==='ucb'?'含探索奖励的UCB分':'本轮后验抽样值'}，详见本步计算。尚未尝试的零柱不代表真实成功率为零。`};
 }
 if(trace?.algorithmId==='floyd-warshall'&&event&&scene.kind==='matrix'){
  const state=stateAtTrace(trace,Number(event.id)),distances=state.distances as (number|string)[][];
  return {...scene,matrix:distances.map(row=>row.map(value=>value==='∞'?Infinity:Number(value))),note:'∞ 表示还没有已知路线，不是负数票价；橙框是本次比较涉及的单元格。'};
 }
 if(trace&&scene.kind==='grid'&&['bfs','dfs','astar','dijkstra'].includes(trace.algorithmId)){
  const meaning=trace.algorithmId==='dfs'?'本次搜索树的深度':trace.algorithmId==='bfs'?'已走步数':trace.algorithmId==='astar'?'预计总代价f=g+h':'当前已走代价g';
  return {...scene,showNodeIds:(scene.cols??0)<=10&&(scene.rows??0)<=10,note:`格内大字：${meaning}；小地图角标 # 是固定节点编号。${scene.note??''}`};
 }
 if(trace?.algorithmId==='counting-sort'&&event&&event.phase!=='initialize'){
  const state=stateAtTrace(trace,Number(event.id)),original=trace.initialState.array as number[],minimum=Math.min(...original),counts=(state.counts??Array(Math.max(...original)-minimum+1).fill(0)) as number[],written=Number(state.moves??0);
  const active=event.phase==='count'?Number(event.calculation?.values.value)-minimum:Number(state.box??-1);
  return {kind:'bars',values:counts,labels:counts.map((_,i)=>'值'+(i+minimum)),active:[active],title:'频数盒：柱高表示出现次数，0表示空盒',note:`原输入：${original.join('、')}；已写回：${written?(state.array as number[]).slice(0,written).join('、'):'尚未开始'}。频数保持原统计。`};
 }
 if(trace?.algorithmId==='quick-sort'&&event){
  const state=stateAtTrace(trace,Number(event.id));let boundary:number|undefined,pivot:number|undefined;
  for(const e of trace.events.slice(0,Number(event.id)+1)){
   if(e.calculation?.formula==='pivot=array[high]'){boundary=Number(e.calculation.values.low);pivot=Number(e.calculation.values.high);}
   if(e.action==='推进小值边界')boundary=Number(e.changes.find(c=>c.target==='boundary')?.after);
   if(e.action==='分区完成'){pivot=Number(e.focus?.[0]);boundary=undefined;}
  }
  const values=state.array as number[],checking=event.phase==='compare'?Number(event.focus?.[0]):-1;
  return {...scene,values,active:event.focus?.map(Number),labels:values.map((_,i)=>'#'+i+(i===boundary?' 待放':'')+(i===checking?' 检查':'')+(i===pivot?' 分界':'')),note:'待放是下一个小值位置；检查是当前比较位置；分界是当前pivot。'};
 }
 if(trace?.algorithmId==='knapsack'&&event&&scene.kind==='matrix'){
  const cols=scene.matrix?.[0]?.length??0,done=new Set(Array.from({length:cols},(_,i)=>i));
  for(const e of trace.events.slice(0,Number(event.id)+1))if(e.ruleId==='knapsack.compare')done.add(Number(e.focus?.[0]));
  const focused=Number(event.focus?.[0]),secondary=event.phase==='backtrack'&&focused>=cols?[focused-cols]:event.focus?.slice(1).map(Number);
  return {...scene,secondary,matrixLabels:scene.matrix?.map((row,r)=>row.map((v,c)=>done.has(r*cols+c)?String(v):'—')),note:'橙框是当前格子；蓝框是读取的上一行答案；— 表示尚未计算，不能当作价值0。'};
 }
 if(trace?.algorithmId==='knn'&&event){
  const state=stateAtTrace(trace,Number(event.id)),train=state.train as number[][],test=state.test as number[][],query=Number(state.query??0),point=test[query],neighbors=state.neighbors as number[]|undefined;
  const current=event.phase==='distance'?Number(state.neighbor):-1,chosen=['choose','vote'].includes(event.phase)?neighbors??[]:[];
  const paths=(current>=0?[current]:chosen).map(i=>({points:[{x:point[0],y:point[1]},{x:train[i][0],y:train[i][1]}],color:'#78edd0'}));
  return {kind:'scatter',yUp:true,nodes:[...train.map((p,i)=>({id:String(i),x:p[0],y:p[1],label:'#'+i,color:p[2]?'#f6c37b':'#78edd0',r:1.5})),{id:'query',x:point[0],y:point[1],label:'查询'+query,color:'#ffffff',r:2.3}],paths,title:event.phase==='initialize'?'分清训练邻居与独立查询点':'查询点连向本步参与比较或投票的邻居',note:'# 是训练集编号；连线表示本步比较。点的类别色不参与距离计算。'};
 }
 if(trace?.algorithmId==='linear-regression'&&event){
  const state=stateAtTrace(trace,Number(event.id)),data=state.data as number[][],n=Number(state.sampleCount??data.length);
  const nodes=data.map((p,i)=>({id:String(i),x:p[0],y:p[1],color:i<n?'#78edd0':'#354957',r:1.5}));
  if(typeof state.meanX==='number'&&typeof state.meanY==='number')nodes.push({id:'mean',x:state.meanX,y:state.meanY,color:'#90b3ff',r:2.3});
  return {...scene,nodes,note:`青色为本次前${n}个样本；蓝色为已算出的均值中心；灰色暂未参与。`};
 }
 if(trace&&event&&['linear-search','binary-search'].includes(trace.algorithmId)){
  const state=stateAtTrace(trace,Number(event.id)),binary=trace.algorithmId==='binary-search',values=state.array as number[],found=Number(state.found??-1),active=Number(state[binary?'mid':'index']??-1),low=binary?Number(state.low):Math.max(0,active),high=Number(state.high);
  return {...scene,values,labels:values.map((_,i)=>'#'+i),colors:values.map((_,i)=>i===found?'#f6c37b':(event.phase==='result'&&found<0)||i<low||i>high?'#354957':i===active?'#78edd0':'#90b3ff'),title:`寻找 ${state.target}，观察仍有可能的位置`,note:'蓝色待查 · 青色当前 · 灰色已排除 · 暖橙命中目标'};
 }
 if(trace?.algorithmId==='moving-average'&&event&&['initialize','sum','forecast'].includes(event.phase)){
  const state=stateAtTrace(trace,Number(event.id)),data=state.data as number[],window=Number(state.window),day=Number(state.day??window+1),start=Number(state.windowStart??1);
  return {kind:'bars',values:data.slice(start-1,day-1),labels:data.slice(start-1,day-1).map((_,i)=>'第'+(start+i)+'天'),active:event.phase==='sum'?[Number(event.calculation?.values.day)-start]:[],title:`预测第${day}天，只读第${start}—${day-1}天`,note:event.phase==='initialize'?'窗口里每个已观察值等权；未来值未参与。':event.phase==='sum'?`本步累计 ${state.partialSum}，还没有除以窗口天数。`:`累计 ${state.partialSum} ÷ ${window} = ${event.calculation?.result}`};
 }
 return scene;
}
