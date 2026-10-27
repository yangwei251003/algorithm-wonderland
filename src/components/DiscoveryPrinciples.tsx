import {useMemo,type ReactNode} from 'react';
import {stateAtTrace,type ExecutionTrace,type TraceEvent,type TeachingValue,type Candidate} from '../engine/teaching';
import type {Scene} from '../engine/types';

// The host imports DiscoveryPrinciples.css; projections remain usable without a browser.
const focusCache=new WeakMap<ExecutionTrace,Set<string>>();
function focusEvents(trace:ExecutionTrace){
 let ids=focusCache.get(trace);if(ids)return ids;
 ids=new Set<string>();const seen=new Set<string>();
 for(const e of trace.events){let key='';
  if(trace.algorithmId==='neural-network'){
   if(e.phase==='forward')key='forward';
   if(e.phase==='gradient')key='gradient';
   if(e.phase==='update')key=e.calculation?.formula.startsWith('a[')?'hidden-update':'output-update';
  }else if(trace.algorithmId==='life'&&e.ruleId==='life-update')key='first-generation';
  else if(trace.algorithmId==='wfc'){
   if(['wfc-select','wfc-queue'].includes(e.ruleId))key=e.ruleId;
   if(e.ruleId==='wfc-propagate')key=Number(e.calculation?.result)===0?'contradiction':e.candidates?.some(c=>c.status==='rejected')?'prune':'retain';
  }
  if(key&&!seen.has(key)){seen.add(key);ids.add(e.id);}
 }
 focusCache.set(trace,ids);return ids;
}
export function canShowDiscovery(trace:ExecutionTrace,event:TraceEvent){
 if(['bfs','astar'].includes(trace.algorithmId))return event.ruleId===trace.algorithmId+'.neighbor'||event.ruleId===trace.algorithmId+'.select'||event.ruleId===trace.algorithmId+'.backtrack'&&event.phase==='backtrack';
 return focusEvents(trace).has(event.id);
}
type State=Record<string,TeachingValue>;
const arr=(x:TeachingValue|undefined)=>Array.isArray(x)?x as number[]:[];
const matrix=(x:TeachingValue|undefined)=>Array.isArray(x)?x as number[][]:[];
const n=(x:TeachingValue|undefined)=>typeof x==='number'?x:NaN;
const fmt=(x:number,d=3)=>!Number.isFinite(x)?x===Infinity?'∞':x===-Infinity?'−∞':'未记录':Number(x.toFixed(d)).toString();
const valueText=(x:TeachingValue|undefined)=>typeof x==='number'?fmt(x):x===undefined||x===null?'未记录':String(x);
interface BaseProjection{algorithmId:string;eventId:string;rule:string;state:State;before:(key:string)=>TeachingValue|undefined;}
export interface SearchProjection extends BaseProjection{kind:'search';mode:'select'|'settle'|'neighbor'|'backtrack';openBefore:number[];openAfter:number[];current:number;target:number|null;distance:TeachingValue[];oldDistance:TeachingValue[];parent:number[];route:number[];candidates:Candidate[];}
export interface NeuralProjection extends BaseProjection{kind:'neural';mode:'forward'|'gradient'|'update';weights:number[][];outputWeights:number[];preactivation:number[];activation:number[];hiddenDelta:number[];hiddenGradient:number[][];outputGradient:number[];updates:{label:string;old:number;next:number;meanGradient:number}[];}
export interface LifeProjection extends BaseProjection{kind:'life';generation:number;cols:number;rows:number;oldCells:number[];cells:number[];counts:number[];examples:{label:string;index:number;old:number;next:number;neighbors:number;window:{index:number;value:number;center:boolean}[]}[];}
export interface WfcProjection extends BaseProjection{kind:'wfc';mode:'select'|'queue'|'propagate';source:number;target:number;sourceDomain:number[];oldDomain:number[];domain:number[];supports:number[][];weights:number[];threshold:number;queueBefore:number[];queueAfter:number[];choices:number[];}
export type DiscoveryProjection=SearchProjection|NeuralProjection|LifeProjection|WfcProjection;
/** Projection only: no search, neural inference, cellular update or constraint solve is run here. */
export function projectDiscovery(trace:ExecutionTrace,event:TraceEvent):DiscoveryProjection|null{
 if(!canShowDiscovery(trace,event))return null;
 const state=stateAtTrace(trace,Number(event.id)),before=(key:string)=>{const c=event.changes.find(c=>c.target===key);return c?c.before:state[key];},base={algorithmId:trace.algorithmId,eventId:event.id,rule:event.ruleId,state,before};
 if(['bfs','astar'].includes(trace.algorithmId)){
  const target=event.candidates?.[0]?.target,mode=event.phase as SearchProjection['mode'];
  return {...base,kind:'search',mode,openBefore:arr(before('open')),openAfter:arr(state.open),current:n(state.current),target:target!==undefined&&/^\d+$/.test(target)?Number(target):null,distance:(state.distance??[]) as TeachingValue[],oldDistance:(before('distance')??[]) as TeachingValue[],parent:arr(state.parent),route:arr(state.route),candidates:event.candidates??[]};
 }
 if(trace.algorithmId==='neural-network'){
  const weights=matrix(state.hiddenWeights),outputWeights=arr(state.outputWeights),hiddenGradient=matrix(state.hiddenGradient),outputGradient=arr(state.outputGradient),N=Number(event.calculation?.values.N),updates:NeuralProjection['updates']=[];
  if(event.phase==='update'){
   const hidden=event.changes.find(c=>c.target==='hiddenWeights');
   if(event.calculation?.formula.startsWith('a[')){const old=hidden?matrix(hidden.before):weights,j=Number(event.action.match(/隐藏单元(\d+)/)?.[1])-1;if(weights[j])weights[j].forEach((v,k)=>updates.push({label:`隐藏${j+1} · ${['x权重','y权重','偏置'][k]}`,old:old[j][k],next:v,meanGradient:hiddenGradient[j][k]/N}));}
   else{const old=arr(before('outputWeights'));outputWeights.forEach((v,j)=>updates.push({label:j===weights.length?'输出偏置':`隐藏${j+1}→输出`,old:old[j],next:v,meanGradient:outputGradient[j]/N}));}
  }
  return {...base,kind:'neural',mode:event.phase as NeuralProjection['mode'],weights,outputWeights,preactivation:arr(state.hiddenPreactivation),activation:arr(state.activation),hiddenDelta:arr(state.hiddenDelta),hiddenGradient,outputGradient,updates};
 }
 if(trace.algorithmId==='life'){
  const oldCells=arr(before('cells')),cells=arr(state.cells),counts=arr(state.counts),cols=n(state.cols),rows=n(state.rows),selections=[['出生',arr(state.births)[0]],['存活',arr(state.survive)[0]],['死亡',arr(state.deaths)[0]]] as [string,number|undefined][];
  if(!selections.some(([,i])=>i!==undefined))selections.push(['保持死亡',Number(event.focus?.[0]??0)]);
  const examples=selections.filter((s):s is [string,number]=>s[1]!==undefined).map(([label,index])=>({label,index,old:oldCells[index],next:cells[index],neighbors:counts[index],window:Array.from({length:9},(_,k)=>{const dx=k%3-1,dy=Math.floor(k/3)-1,i=((Math.floor(index/cols)+dy+rows)%rows)*cols+(index%cols+dx+cols)%cols;return {index:i,value:oldCells[i],center:k===4};})}));
  return {...base,kind:'life',generation:n(state.generation),cols,rows,oldCells,cells,counts,examples};
 }
 if(trace.algorithmId==='wfc'){
  const mode=event.ruleId.slice(4) as WfcProjection['mode'],source=n(state.from),target=mode==='select'?n(state.selectedCell):n(state.to),domainKey='domain:'+target;
  const oldQueue=event.calculation?.values['出队前'];
  return {...base,kind:'wfc',mode,source,target,sourceDomain:arr(state['domain:'+source]),oldDomain:arr(before(domainKey)),domain:arr(state[domainKey]),supports:matrix(state.supports),weights:arr(state.weights),threshold:n(state.threshold),queueBefore:mode==='queue'&&typeof oldQueue==='string'?oldQueue.split(' → ').filter(Boolean).map(Number):arr(before('queue')),queueAfter:arr(state.queue),choices:arr(state.choices)};
 }
 return null;
}

const C={teal:'#78edd0',blue:'#90b3ff',gold:'#f6c37b',red:'#ed8fa7',muted:'#aabdc9',line:'#344a59'};
function Chart({label,children,height=200}:{label:string;children:ReactNode;height?:number}){return <div className="dp-chart"><svg viewBox={`0 0 280 ${height}`} role="img" aria-label={label}>{children}</svg></div>;}
function Arrow({from,to,color=C.gold}:{from:[number,number];to:[number,number];color?:string}){if(Math.hypot(to[0]-from[0],to[1]-from[1])<.5)return <circle cx={from[0]} cy={from[1]} r="3" fill={color}/>;const a=Math.atan2(to[1]-from[1],to[0]-from[0]);return <g fill="none" stroke={color} strokeWidth="2"><line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}/><path d={`M${to[0]-7*Math.cos(a-.45)},${to[1]-7*Math.sin(a-.45)} L${to} L${to[0]-7*Math.cos(a+.45)},${to[1]-7*Math.sin(a+.45)}`}/></g>;}
function Stat({label,children}:{label:string;children:ReactNode}){return <div className="dp-stat"><span>{label}</span><strong>{children}</strong></div>;}
function Queue({items,label,highlight,fifo=true}:{items:number[];label:string;highlight?:number;fifo?:boolean}){return <div className="dp-queue"><strong>{label}</strong><ol aria-label={label} tabIndex={0}>{items.length?items.map((i,k)=><li key={k} className={i===highlight?'dp-current':''}><small>{fifo?(k===0?'队首':k===items.length-1?'队尾':`第${k+1}位`):`保留项${k+1}`}</small><b>#{i}</b></li>):<li className="dp-empty">空</li>}</ol></div>;}
function MapInset({data,event,scene}:{data:SearchProjection;event:TraceEvent;scene?:Scene}){
 if(!scene?.cols||!scene.rows)return <p className="dp-note">没有传入当前地图；候选与父指针仍来自本步记录。</p>;
 const cols=scene.cols,rows=scene.rows,w=252/cols,h=252/rows,p=(i:number):[number,number]=>[14+(i%cols+.5)*w,14+(Math.floor(i/cols)+.5)*h],route=data.route,chosen=event.focus?.map(Number)??[],walls=new Set(arr(data.state.walls)),open=new Set(data.openAfter),closed=new Set(arr(data.state.closed)),goal=n(data.state.goal),start=n(data.state.start);
 return <><Chart label="当前地图；橙色本步、蓝色待处理、灰色障碍" height={285}>{Array.from({length:cols*rows},(_,i)=><rect key={i} x={14+i%cols*w} y={14+Math.floor(i/cols)*h} width={Math.max(.5,w-1)} height={Math.max(.5,h-1)} fill={walls.has(i)?'#344a59':chosen.includes(i)?C.gold:open.has(i)?'#587db4':closed.has(i)?'#27584e':'#102231'} stroke={i===start||i===goal?C.teal:'none'} strokeWidth="2"/>)}{route.length>1&&<polyline points={route.map(i=>p(i).join(',')).join(' ')} stroke={C.gold} strokeWidth="3" fill="none"/>}{cols<=7&&rows<=7&&Array.from({length:cols*rows},(_,i)=><text key={i} x={p(i)[0]} y={p(i)[1]+5} textAnchor="middle" fill={chosen.includes(i)&&!walls.has(i)?'#102231':'#ecf4f8'}>{i}</text>)}</Chart><p className="dp-note">节点号从0开始。橙=本步，蓝=待处理，深灰=障碍；大地图编号在候选卡中显示。</p></>;
}
function SearchFigure({data,event,scene}:{data:SearchProjection;event:TraceEvent;scene?:Scene}){
 const astar=data.algorithmId==='astar',v=event.calculation?.values??{},target=data.target,select=data.mode==='select',neighbor=data.mode==='neighbor',chosen=data.candidates.find(c=>c.status==='chosen'),max=Math.max(1,...data.candidates.map(c=>Number(c.values?.priority??0)));
 return <div className="dp-two"><section><h4>{data.mode==='backtrack'?'沿已记录父指针找回路线':'地图与当前处理位置'}</h4><MapInset data={data} event={event} scene={scene}/></section><section>
 {select?<><h4>{astar?'为什么选它：比较预计总代价':'为什么选它：先到队首先处理'}</h4>{!astar&&<Queue items={data.openBefore} label="取出前 · 从队首取" highlight={data.current}/>}<div className="dp-candidate-list" tabIndex={0}>{data.candidates.map(c=><article key={c.target} className={'dp-candidate '+(c.status==='chosen'?'dp-current':'')}><div><strong>节点 #{c.target}</strong><b>{c.status==='chosen'?'本步选中':'稍后处理'}</b></div>{astar?<><p><span className="dp-blue">已走 g={c.values?.g}</span> + <span className="dp-teal">估计 h={c.values?.h}</span> = <strong>f={c.values?.priority}</strong></p><div className="dp-stacked" aria-label={`g=${c.values?.g}，h=${c.values?.h}，合计${c.values?.priority}`}><i style={{width:100*Number(c.values?.g)/max+'%',background:C.blue}}/><i style={{width:100*Number(c.values?.h)/max+'%',background:C.teal}}/></div></>:<p>离起点 {c.values?.g} 步 · 入队序号 {c.values?.sequence}</p>}<small>{c.reason}</small></article>)}</div><Queue items={data.openAfter} fifo={!astar} label={astar?'取出后 · 待处理集合（保留插入次序）':'取出后 · 队首在左'}/><p className="dp-note">{astar?'条形共用尺度；f相同时按入队先后选择。蓝色候选没有被淘汰。':'先入先出使第d层先于第d+1层处理。等步代价时，它保证最少步数。'}</p></>:neighbor?<><h4>{event.action}，先判断能不能走</h4><div className="dp-neighbor-flow"><span>当前 #{data.current}</span><b>→</b><span className={chosen?'dp-current':'dp-rejected'}>{target!==null?'节点 #'+target:'地图外'}</span></div>{event.calculation&&<><div className="dp-stats"><Stat label="当前已走代价">{v.g}</Stat><Stat label="本次步代价">{v.cost}</Stat><Stat label="新候选距离">{event.calculation.result}</Stat><Stat label="此前已知距离">{target!==null?valueText(data.oldDistance[target]):'不适用'}</Stat></div><p className="dp-equation">{v.g} + {v.cost} = {event.calculation.result}</p></>}<div className={'dp-verdict '+(chosen?'dp-current':'dp-rejected')}>{data.candidates.map(c=><p key={c.target}>{c.reason}</p>)}</div>{chosen&&target!==null&&<p>写入父指针：节点 #{target} → 父节点 #{data.parent[target]}。以后回溯时沿这个记录找路。</p>}<Queue items={data.openAfter} fifo={!astar} label="本步完成后的待处理节点"/><p className="dp-note">检查次序：右→下→左→上。没有增加候选时，队列保持原样。</p></>:data.mode==='settle'?<><h4>从“待办”变为“已处理”</h4><div className="dp-neighbor-flow"><span>节点 #{data.current}</span><b>→</b><span className="dp-current">已处理</span></div><p>{event.explanation}</p><div className="dp-stats"><Stat label="已处理节点数">{arr(data.state.closed).length}</Stat><Stat label="仍待处理">{data.openAfter.length}</Stat></div><Queue items={data.openAfter} fifo={!astar} label="后续仍要检查"/></>:<><h4>回溯一格，读取一次父指针</h4><div className="dp-route" aria-label="真实父指针路线">{data.route.slice().reverse().map((i,k)=><span key={i}>{k>0&&' → '}#{i}</span>)}</div><p>{event.explanation}</p><p className="dp-note">箭头表示从终点追到父节点；顺序反过来才是出发路线。回溯不重新搜索。</p></>}
 </section></div>;
}

function Network({data,event}:{data:NeuralProjection;event:TraceEvent}){
 const H=data.weights.length,height=Math.max(250,H*66+58),y=(j:number)=>35+(j+.5)*(height-70)/H,mid=height/2,gradient=data.mode==='gradient',v=event.calculation?.values??{};
 return <Chart label={gradient?'真实输出误差沿连接传回每个隐藏单元':'真实输入经过隐藏单元到输出概率'} height={height}>
 {data.weights.map((_,j)=><g key={j}><line x1="49" y1={mid-40} x2="111" y2={y(j)} stroke={C.line}/><line x1="49" y1={mid+40} x2="111" y2={y(j)} stroke={C.line}/>{gradient?<Arrow from={[222,mid]} to={[169,y(j)]} color={C.red}/>:<Arrow from={[169,y(j)]} to={[222,mid]} color={C.teal}/>}<rect x="104" y={y(j)-22} width="72" height="44" rx="8" fill="#18323f" stroke={gradient?C.red:C.teal}/><text x="140" y={y(j)-3} textAnchor="middle" fill={C.muted}>隐藏{j+1}</text><text x="140" y={y(j)+15} textAnchor="middle" fill={gradient?C.red:C.teal}>{fmt(gradient?data.hiddenDelta[j]:data.activation[j])}</text></g>)}
 <text x="14" y={mid-68} fill={C.blue}>输入 x</text><text x="14" y={mid-48} fill={C.blue}>{fmt(Number(v.x))}</text><circle cx="37" cy={mid-38} r="8" fill={C.blue}/><circle cx="37" cy={mid+38} r="8" fill={C.blue}/><text x="14" y={mid+66} fill={C.blue}>输入 y</text><text x="14" y={mid+86} fill={C.blue}>{fmt(Number(v.y))}</text>
 <rect x="217" y={mid-24} width="60" height="48" rx="8" fill="#302b24" stroke={gradient?C.red:C.gold}/><text x="247" y={mid-5} textAnchor="middle" fill={C.muted}>{gradient?'误差':'概率'}</text><text x="247" y={mid+15} textAnchor="middle" fill={gradient?C.red:C.gold}>{fmt(gradient?Number(v.error):n(data.state.probability))}</text>
 <text x="14" y="18" fill={C.muted}>{gradient?'误差反传；本步不改权重':'前向：输入 → 隐藏 → 输出'}</text></Chart>;
}
function SignedValue({label,value,max}:{label:string;value:number;max:number}){return <div className="dp-signed"><div><span>{label}</span><b>{fmt(value,6)}</b></div><div className="dp-zero"><i style={{left:(value<0?50-50*Math.abs(value)/max:50)+'%',width:50*Math.abs(value)/max+'%',background:value<0?C.red:C.teal}}/><b/></div></div>;}
function NeuralFigure({data,event}:{data:NeuralProjection;event:TraceEvent}){
 const v=event.calculation?.values??{},rate=n(data.state.rate),gradient=data.mode==='gradient';
 if(data.mode==='update')return <><h4>只改本事件记录的参数，沿平均梯度反方向移动</h4><div className="dp-update-list">{data.updates.map((u,i)=>{const lo=Math.min(u.old,u.next),span=Math.abs(u.next-u.old)||1,position=(x:number)=>24+232*(x-lo)/span;return <article className="dp-card" key={i}><h5>{u.label}</h5><Chart label={`${u.label}从${u.old}更新为${u.next}`} height={98}><line x1="24" x2="256" y1="45" y2="45" stroke={C.line}/><circle cx={position(u.old)} cy="45" r="4" fill={C.blue}/><Arrow from={[position(u.old),45]} to={[position(u.next),45]}/><circle cx={position(u.next)} cy="45" r="4" fill={C.gold}/><text x={position(u.old)} y="23" textAnchor={u.old<=u.next?'start':'end'} fill={C.blue}>旧 {fmt(u.old,5)}</text><text x={position(u.next)} y="77" textAnchor={u.next>u.old?'end':'start'} fill={C.gold}>新 {fmt(u.next,5)}</text></Chart><p className="dp-equation">{fmt(u.old,5)} − {fmt(rate)} × ({fmt(u.meanGradient,6)})<br/>= {fmt(u.next,5)}</p><p className="dp-note">平均梯度=本轮累计梯度÷{v.N}。{u.old===u.next?'本步数值未变化。':'箭头作本参数的局部放大，不能跨卡比较长度。'}</p></article>;})}</div><p>本轮全部训练样本先累积梯度，再更新权重；没有边算某个样本边改它所用的权重。</p></>;
 return <div className="dp-two"><section><h4>{gradient?'从“猜错多少”追到每个连接':'两项输入，逐层形成预测'}</h4><Network data={data} event={event}/><p className="dp-note">线表示实际连接；隐藏单元内数字为{gradient?'该单元的反传误差δ':'tanh后的激活值h'}，不是分类标签。</p>{gradient&&<p className="dp-equation">输出误差 = {fmt(Number(v.probability))} − {v.label} = {fmt(Number(v.error))}</p>}</section><section><h4>{gradient?'每条连接为什么这样改':'每个中间数如何得到'}</h4><div className="dp-candidate-list dp-network-details" tabIndex={0}>{data.weights.map((w,j)=><article className="dp-card" key={j}><h5>隐藏单元 {j+1}</h5>{gradient?<><p className="dp-equation">δ = {fmt(Number(v.error))} × {fmt(data.outputWeights[j])} × (1 − {fmt(data.activation[j])}²)<br/>= {fmt(data.hiddenDelta[j],6)}</p>{data.hiddenGradient[j].map((g,k)=><SignedValue key={k} label={['x连接梯度','y连接梯度','偏置梯度'][k]} value={g} max={Math.max(1e-9,...data.hiddenGradient.flat().map(Math.abs))}/>)}<small>中线=0；梯度条共用尺度。偏置相当于乘输入1。</small></>:<><p className="dp-equation">{fmt(w[0])} × ({fmt(Number(v.x))})<br/>+ {fmt(w[1])} × ({fmt(Number(v.y))})<br/>+ {fmt(w[2])} = <b>{fmt(data.preactivation[j])}</b></p><div className="dp-flow"><span>加权和 {fmt(data.preactivation[j])}</span><b>↓ tanh</b><strong>{fmt(data.activation[j])}</strong></div></>}</article>)}</div>{!gradient&&<div className="dp-card"><h5>汇总到输出</h5><p>输出连接权重 [{data.outputWeights.slice(0,-1).map(x=>fmt(x)).join('、')}]；偏置 {fmt(data.outputWeights.at(-1)??NaN)}。</p><div className="dp-flow"><span>加权汇总 {fmt(Number(v.logit))}</span><b>↓ sigmoid</b><strong>概率 {fmt(n(data.state.probability))}</strong></div><p className="dp-note">输入使用本次记录的归一化值。显示数值经过四舍五入，计算仍使用完整精度。</p></div>}</section></div>;
}

function LifeFigure({data}:{data:LifeProjection}){
 return <><h4>第{data.generation-1}代 → 第{data.generation}代：都读旧邻居，再一起更新</h4><div className="dp-life-grid">{data.examples.map(e=><article className="dp-card" key={e.index}><h5>#{e.index} · {e.label}</h5><div className="dp-life-window" role="img" aria-label={`节点${e.index}旧状态${e.old}，八邻域活格${e.neighbors}，新状态${e.next}`}><div className="dp-nine">{e.window.map((v,k)=><span key={k} className={(v.value?'dp-alive ':'')+(v.center?'dp-center':'')} title={`节点${v.index}`}><b>{v.center?'中心':v.value?'活':'死'}</b><small>#{v.index}</small></span>)}</div><div className="dp-flow"><span>八邻域：{e.neighbors} 个活格</span><b>↓ {e.old?'活格要2或3个':'死格要恰好3个'}</b><strong className={e.next?'dp-teal':'dp-red'}>新状态：{e.next?'活':'死'}</strong></div></div><p className="dp-note">中心原来{e.old?'活':'死'}，不计入邻居数；新结果来自本代记录。</p></article>)}</div><p>同一代不能把刚更新的状态传给后面格子。本版边界循环相接；边缘格的3×3邻域会从另一边读取。</p></>;
}
function Tile({mask,tone='normal',port}:{mask:number;tone?:'normal'|'removed'|'selected';port?:number}){
 const ends:[[number,number],number][]=[[[35,4],1],[[66,35],2],[[35,66],4],[[4,35],8]],color=tone==='removed'?C.red:tone==='selected'?C.gold:C.teal;
 return <svg className="dp-tile" viewBox="0 0 70 70" role="img" aria-label={`图块${mask}：${ends.filter(([,bit])=>mask&bit).map(([,bit])=>({1:'上',2:'右',4:'下',8:'左'})[bit as 1|2|4|8]).join('、')||'没有'}端口`}><rect x="2" y="2" width="66" height="66" rx="7" fill="#102231" stroke={color}/>{ends.filter(([,bit])=>mask&bit).map(([to,bit])=><line key={bit} x1="35" y1="35" x2={to[0]} y2={to[1]} stroke={color} strokeWidth="6"/>)}{mask===0&&<circle cx="35" cy="35" r="4" fill={C.muted}/>} {port&&ends.filter(([,bit])=>bit===port).map(([to,bit])=><circle key={bit} cx={to[0]} cy={to[1]} r="6" fill="none" stroke={C.gold} strokeWidth="2"/>)}{tone==='removed'&&<path d="M9,9 L61,61 M61,9 L9,61" stroke={C.red} strokeWidth="2"/>}</svg>;
}
function WfcFigure({data,event}:{data:WfcProjection;event:TraceEvent}){
 const v=event.calculation?.values??{},sourcePort=Number(v['源端口位']),targetPort=Number(v['相对端口位']),direction:Record<number,string>={1:'上',2:'右',4:'下',8:'左'};
 if(data.mode==='queue')return <><h4>候选减少，才把变化传给邻居</h4><Queue items={data.queueBefore} label="FIFO取出前" highlight={Number(v['取出'])}/><div className="dp-flow"><b>↓ 取出 #{String(v['取出'])}</b><span>接下来检查它四个方向的邻居</span></div><Queue items={data.queueAfter} label="本步取出后的队列"/><p>这里取出的是待传播的格子，不是重新选一次图块。后续每个方向都会留下兼容检查记录。</p></>;
 if(data.mode==='select'){
  const total=Number(v['总权重']);let offset=0;
  return <div className="dp-two"><section><h4>先选最少候选格，再选一个合法图块</h4><div className="dp-stats"><Stat label="最少候选数">{v['最少候选数']}</Stat><Stat label="本次选格">#{data.target}</Stat></div><div className="dp-chip-list" aria-label="最少候选数并列的格子">{data.choices.map(i=><span key={i} className={i===data.target?'dp-current':''}>#{i}</span>)}</div><p>并列 {data.choices.length} 格，用已记录随机数 {fmt(Number(v['选格随机数']),4)} 选出。这里按候选个数比较，不是计算香农熵。</p><Chart label="记录的加权区间和随机阈值" height={120}>{data.weights.map((w,k)=>{const x=14+252*offset/total;offset+=w;return <g key={k}><rect x={x} y="22" width={252*w/total} height="32" fill={data.oldDomain[k]===Number(event.calculation?.result)?C.gold:C.blue}/><text x={x+126*w/total} y="44" textAnchor="middle" fill="#102231">{data.oldDomain[k]}</text></g>;})}<Arrow from={[14+252*data.threshold/total,87]} to={[14+252*data.threshold/total,56]}/><text x="14" y="112" fill={C.muted}>0—{fmt(total)} · 随机阈值 {fmt(data.threshold,4)}</text></Chart></section><section><h4>随机没选中，仍不等于图块非法</h4><div className="dp-tile-options">{data.oldDomain.map((mask,k)=><article key={mask}><Tile mask={mask} tone={data.domain[0]===mask?'selected':'normal'}/><strong>图块 {mask}</strong><span>权重 {data.weights[k]}</span><small>{data.domain[0]===mask?'本次选中':'合法，本次未选'}</small></article>)}</div><p className="dp-note">本步完成后格#{data.target}只保留图块{data.domain[0]}；相邻格接下来传播约束。</p></section></div>;
 }
 return <><h4>格#{data.source}的{direction[sourcePort]}侧 → 格#{data.target}的{direction[targetPort]}侧</h4><p>每个候选只需找到<strong>至少一个</strong>支持图块。下方连线读取本次已记录的支持名单。</p><div className="dp-support-list">{data.oldDomain.map((mask,k)=>{const supports=data.supports[k]??[],kept=data.domain.includes(mask);return <article className={'dp-support '+(kept?'':'dp-removed')} key={mask}><div><small>源格 #{data.source}</small><div className="dp-support-tiles">{supports.length?supports.map(s=><div key={s}><Tile mask={s} port={sourcePort}/><span>图块{s}</span></div>):<><div><Tile mask={data.sourceDomain[0]} port={sourcePort}/><span>例如图块{data.sourceDomain[0]}</span></div><p>全部{data.sourceDomain.length}种都无支持</p></>}</div></div><div className="dp-support-arrow" aria-hidden="true">{kept?'→':'×'}</div><div><small>邻格候选</small><Tile mask={mask} port={targetPort} tone={kept?'selected':'removed'}/><strong>图块{mask} · {kept?'保留':'删除'}</strong></div><p className="dp-support-result">{supports.length}个支持 · {kept?'有一个就足够':'端口冲突'}</p></article>;})}</div><div className="dp-stats"><Stat label="原候选数">{data.oldDomain.length}</Stat><Stat label="本步剩余">{data.domain.length}</Stat></div><p>{data.domain.length===0?'候选空了，记录矛盾并停止。本版没有回溯或暗中重选。':data.domain.length<data.oldDomain.length?'候选减少，把邻格加入队尾，继续传递变化。':'每项至少有一个支持，什么也不删，也不再次入队。'}</p><Queue items={data.queueAfter} label="传播队列 · 本步完成"/><p className="dp-note">支持箭头不是道路方向。图块始终上北下南；橙圈标出本次检查端口。掩码是上1、右2、下4、左8相加；图块0无路，也是一种合法图块。</p></>;
}

export function DiscoveryPrinciples({trace,event,scene}:{trace:ExecutionTrace;event:TraceEvent;scene?:Scene}){
 const data=useMemo(()=>projectDiscovery(trace,event),[trace,event]);if(!data)return null;
 return <section className="discovery-principles" aria-label="本步发现原理图"><header><span>真实步骤 {Number(event.id)+1}</span><h3>{event.action}</h3><b>本步已完成</b></header>{data.kind==='search'?<SearchFigure data={data} event={event} scene={scene}/>:data.kind==='neural'?<NeuralFigure data={data} event={event}/>:data.kind==='life'?<LifeFigure data={data}/>:<WfcFigure data={data} event={event}/>}<details><summary>本步完整依据</summary><p>{event.explanation}</p>{event.calculation&&<code>{event.calculation.formula}</code>}</details></section>;
}
