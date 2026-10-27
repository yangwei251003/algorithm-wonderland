import type {Frame,Runner,Scene,VisualNode} from '../engine/types';
import {TraceRecorder} from '../engine/teaching';
import {clamp,num,palette,result,rng,round} from '../engine/utils';
export interface ClusterDatum {x:number;y:number;c:number;}
export function createKmeans(makeData:(input:Parameters<Runner>[0],p:Parameters<Runner>[1],seed:number)=>ClusterDatum[]):Runner {
 return (input,p,seed)=>{
  const data=makeData(input,p,seed),random=rng(seed+91),k=Math.round(clamp(num(p,'k',3),2,6));
  const frames:Frame[]=[],labels:number[]=Array(data.length).fill(-1);
  let centers=Array.from({length:k},()=>{const d=data[Math.floor(random()*data.length)];return{x:d.x,y:d.y};}),iterations=0;
  const trace=new TraceRecorder('kmeans',seed,{labels:[...labels],centers:centers.map(c=>[c.x,c.y]),iteration:0});
  const distance=(d:{x:number;y:number},c:{x:number;y:number})=>(d.x-c.x)**2+(d.y-c.y)**2;
  const cost=()=>data.reduce((sum,d,i)=>sum+(labels[i]<0?0:distance(d,centers[labels[i]])),0);
  const scene=(focus=-1):Scene=>({kind:'scatter',yUp:true,title:'K-means · 分组与移动是两个不同步骤',note:'点的颜色是当前归属，✚是组中心；距离使用两个同尺度特征的欧氏距离平方。',nodes:[...data.map((d,i):VisualNode=>({...d,id:'p'+i,color:labels[i]<0?'#7893a3':palette[labels[i]],r:i===focus?2.5:1.5,label:data.length<=12?String(i+1):undefined})),...centers.map((c,j)=>({...c,id:'c'+j,color:palette[j],r:3.5,label:'✚'+(j+1)}))],paths:focus>=0?centers.map((c,j)=>({points:[data[focus],c],color:j===labels[focus]?palette[j]:'#53708055',dashed:j!==labels[focus]})):[]});
  const emit=(e:Omit<Parameters<TraceRecorder['add']>[0],'frameIndex'>,values:Parameters<TraceRecorder['add']>[1]={},focus=-1)=>{
   const id=trace.add({...e,frameIndex:frames.length},values);
   frames.push({scene:scene(focus),caption:e.explanation,eventId:id,metrics:{'迭代次数':iterations,'组内距离平方和':round(cost()),'组数':k}});
  };
  emit({phase:'准备',ruleId:'kmeans-init',action:'先放置 '+k+' 个中心',explanation:'中心从当前数据点中按固定种子抽取。初始位置会影响最后分组；原始类别颜色不参与计算。'},{centers:centers.map(c=>[c.x,c.y])});
  for(let it=0;it<30;it++){
   iterations=it+1;let changed=false;
   for(let i=0;i<data.length;i++){
    const d=data[i],distances=centers.map(c=>distance(d,c));let chosen=0;
    for(let j=1;j<k;j++)if(distances[j]<distances[chosen])chosen=j;
    const previous=labels[i];if(previous!==chosen)changed=true;labels[i]=chosen;
    emit({phase:'分配 · 第'+iterations+'轮',ruleId:'kmeans-nearest',action:'点 '+(i+1)+' 选择中心 '+(chosen+1),focus:['p'+i,'c'+chosen],explanation:'分别计算到每个中心的距离平方，选最小值 '+round(distances[chosen],3)+'。'+(distances.filter(v=>Math.abs(v-distances[chosen])<1e-12).length>1?'出现同分，本实验保留编号较小的中心。':'其余中心更远，因此这次不分给它们。'),calculation:{formula:'距离平方 = (x − 中心x)² + (y − 中心y)²',values:{x:d.x,y:d.y,'中心x':centers[chosen].x,'中心y':centers[chosen].y},result:distances[chosen]},candidates:distances.map((v,j)=>({target:'中心 '+(j+1),status:j===chosen?'chosen':'rejected',reason:j===chosen?'距离平方最小；同分按编号较小者。':v===distances[chosen]?'距离相同，本实验保留编号较小者。':'比所选中心更远，本轮不分配。',values:{'距离平方':round(v,4)}}))},{labels:[...labels],iteration:iterations},i);
   }
   const beforeMove=cost();
   for(let j=0;j<k;j++){
    const group=data.filter((_,i)=>labels[i]===j),old={...centers[j]};
    if(!group.length){emit({phase:'移动中心',ruleId:'kmeans-mean',action:'第 '+(j+1)+' 组为空，保留原中心',explanation:'没有成员就无法求平均。本实验采用保留原中心的明确约定；并不是所有实现都用同一种空组策略。',focus:['c'+j]});continue;}
    const sumX=group.reduce((s,d)=>s+d.x,0),sumY=group.reduce((s,d)=>s+d.y,0);centers[j]={x:sumX/group.length,y:sumY/group.length};
    emit({phase:'移动中心',ruleId:'kmeans-mean',action:'把中心 '+(j+1)+' 移到 '+group.length+' 位成员的平均位置',explanation:'先固定当前分组，再分别平均横坐标和纵坐标。旧中心('+round(old.x)+', '+round(old.y)+')移动到('+round(centers[j].x)+', '+round(centers[j].y)+')，这使本组距离平方和最小。',focus:['c'+j],calculation:{formula:'新中心 = (横坐标之和 ÷ 人数, 纵坐标之和 ÷ 人数)',values:{'横坐标之和':sumX,'纵坐标之和':sumY,'人数':group.length},result:'('+round(centers[j].x,4)+', '+round(centers[j].y,4)+')'}},{centers:centers.map(c=>[c.x,c.y])});
   }
   emit({phase:'检查停止',ruleId:'kmeans-stop',action:changed?(iterations===30?'达到30轮预算，仍有归属变化':'归属有变化，继续下一轮'):'归属不再变化，停止',explanation:'本轮移动前距离平方和为 '+round(beforeMove)+'，移动后为 '+round(cost())+'。'+(changed?(iterations===30?'至少一个点仍更换了组，但已达到30轮预算，返回当前结果，尚不能声称归属稳定。':'至少一个点更换了组，需要用新中心重新比较距离。'):'所有点保持原组，当前分组与中心相互一致。'),calculation:{formula:'SSE = 每个点到所属中心的距离平方之和',values:{'移动前SSE':beforeMove,'移动后SSE':cost()},result:cost()}},{sse:cost(),changed});
   if(!changed)break;
  }
  const output=result(frames,'先分配到最近中心，再把中心移到组内均值，直到归属稳定。得到局部解，不保证全局最优；环形分组不符合它偏好的紧凑形状。',{'组数':new Set(labels).size,'组内距离平方和':round(cost()),'迭代次数':iterations,'样本数':data.length});
  return {...output,trace:trace.trace};
 };
}
