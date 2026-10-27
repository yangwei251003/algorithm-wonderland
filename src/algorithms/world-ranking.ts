import type {Runner,Scene} from '../engine/types';
import {num,round,palette} from '../engine/utils';
import {WorldRecord} from './world-record';

export const ahp:Runner=(_,p,seed)=>{
 const a=num(p,'costQuality',.5),b=num(p,'costPortable',2),c=num(p,'qualityPortable',3);if([a,b,c].some(v=>!Number.isFinite(v)||v<=0))throw new Error('两两比较值必须为正有限数。');
 const m=[[1,a,b],[1/a,1,c],[1/b,1/c,1]],names=['价格友好','性能优秀','便于携带'],raw=[[.8,.5,.9],[.6,.8,.7],[.3,1,.4]],options=['轻便款','均衡款','性能款'],log=new WorldRecord('ahp',seed,{weights:[1/3,1/3,1/3],raw,options,criteria:names});
 const matrix:Scene={kind:'matrix',matrix:m,rowLabels:names,columnLabels:names};let weights=[1/3,1/3,1/3],lastChange=0;
 log.add({phase:'建立判断矩阵',ruleId:'ahp-matrix',action:'把成对偏好写成互反矩阵',explanation:'对角线为1；若价格相对性能为a，则性能相对价格为1/a。判断矩阵表达主观偏好，并非候选产品的客观分数。',calculation:{formula:'aᵢᵢ=1；aⱼᵢ=1/aᵢⱼ',values:{a,b,c},result:'3×3互反矩阵'}},matrix,{matrix:m});
 for(let t=0;t<18;t++){
  const before=[...weights],next=m.map(row=>row.reduce((s,v,i)=>s+v*weights[i],0)),sum=next.reduce((x,y)=>x+y,0);weights=next.map(v=>v/sum);lastChange=Math.max(...weights.map((v,i)=>Math.abs(v-before[i])));
  log.add({phase:'幂迭代',ruleId:'ahp-power',action:`第${t+1}次乘矩阵并归一化`,explanation:`每一行与旧权重相乘相加，再除以三行总和。权重总和保持1。本例固定做18次幂迭代，不把固定次数当作严格收敛证明。`,calculation:{formula:'z=A×w；w新=z/Σz',values:{'第1行乘积和':next[0],'第2行乘积和':next[1],'第3行乘积和':next[2],'总和':sum},result:weights[0]}},{kind:'bars',values:[...weights],labels:names,title:'判断矩阵的主特征向量近似'}, {weights:[...weights],product:next,iteration:t+1,lastChange});
 }
 const mw=m.map(row=>row.reduce((s,v,i)=>s+v*weights[i],0)),lambda=mw.reduce((s,v,i)=>s+v/weights[i],0)/3,cr=Math.max(0,(lambda-3)/2/.58);
 log.add({phase:'检查一致性',ruleId:'ahp-consistency',action:cr>.1?'CR超过0.1，建议重审偏好':'CR不超过0.1，可作参考',explanation:`用平均比值估计最大特征值λ，再算CI=(λ−3)/2和CR=CI/0.58。CR=${round(cr,4)}。0.1是常用检查阈值，不会把主观偏好变成客观真理。`,calculation:{formula:'λ≈平均((Aw)ᵢ/wᵢ)；CR=max(0,(λ−3)/2/0.58)',values:{'λ':lambda,'维数':3,'随机一致性指标RI':.58,'末次权重变化':lastChange},result:cr}},matrix,{lambda,cr});
 const columnSum=raw[0].map((_,j)=>raw.reduce((s,row)=>s+row[j],0)),normalized=raw.map(row=>row.map((v,j)=>v/columnSum[j])),scores=normalized.map(row=>row.reduce((s,v,j)=>s+v*weights[j],0)),best=scores.indexOf(Math.max(...scores));
 log.add({phase:'示例候选汇总',ruleId:'ahp-score',action:`固定教学属性下，${options[best]}加权分最高`,explanation:'候选的三个属性为固定教学数据，均按越大越好设置。各列先除以该列总和，再乘偏好权重相加。若CR高，应先重审判断，不能只看排名。',calculation:{formula:'候选分=Σ(属性/该列总和)×指标权重',values:{'价格权重':weights[0],'性能权重':weights[1],'便携权重':weights[2]},result:scores[best]},candidates:scores.map((score,i)=>({target:options[i],status:i===best?'chosen':'rejected',reason:i===best?'给定属性和权重下最高，同分取较早候选。':'在给定偏好下分数较低或同分顺序较晚。',values:{'加权分':score}}))},{kind:'bars',values:scores,labels:options,active:[best]}, {scores,columnSum,normalized});
 return log.finish('AHP整理主观两两偏好；本例用18次幂迭代近似权重，用三维RI=0.58检查一致性，再对固定教学候选做加权汇总。',{'一致性比率CR':round(cr,3),'一致性提示':cr<=.1?'可接受参考':'建议重审判断','最重视指标':names[weights.indexOf(Math.max(...weights))],'当前推荐':options[best]});
};

export function topsisScores(data:number[][],weights:number[],benefits:boolean[]){
 const sum=weights.reduce((a,b)=>a+b,0);if(sum<=0||weights.some(v=>v<0))throw new Error('权重应非负，且至少给一个指标大于0的权重。');
 const norms=data[0].map((_,j)=>Math.sqrt(data.reduce((s,row)=>s+row[j]**2,0))),normalized=data.map(row=>row.map((v,j)=>v/(norms[j]||1))),weighted=normalized.map(row=>row.map((v,j)=>v*weights[j]/sum)),ideal=weights.map((_,j)=>benefits[j]?Math.max(...weighted.map(r=>r[j])):Math.min(...weighted.map(r=>r[j]))),worst=weights.map((_,j)=>benefits[j]?Math.min(...weighted.map(r=>r[j])):Math.max(...weighted.map(r=>r[j]))),distances=weighted.map(row=>[Math.hypot(...row.map((v,j)=>v-ideal[j])),Math.hypot(...row.map((v,j)=>v-worst[j]))]),scores=distances.map(([a,b])=>a+b?b/(a+b):.5);
 return{norms,normalized,weighted,ideal,worst,distances,scores};
}
export const topsis:Runner=(_,p,seed)=>{
 const data=[[3999,65,1.2],[5999,85,1.6],[8999,98,2.4],[4999,72,1]],names=['校园配送','节能助手','视觉检测','教学工具'],weights=[num(p,'price',5),num(p,'performance',5),num(p,'portable',4)],benefits=[false,true,false],calc=topsisScores(data,weights,benefits),best=calc.scores.indexOf(Math.max(...calc.scores)),labels=['预算','价值','负担'],log=new WorldRecord('topsis',seed,{data,weights});
 log.add({phase:'统一尺度',ruleId:'topsis-normalize',action:'每列除以该列向量长度',explanation:'预算和实施负担越小越好，价值越大越好。先按每列平方和开方归一化，不把元、分、负担系数直接相加。全零列分母按1处理。',calculation:{formula:'rᵢⱼ=xᵢⱼ / √Σᵢxᵢⱼ²',values:{'预算列长度':calc.norms[0],'价值列长度':calc.norms[1],'负担列长度':calc.norms[2]},result:calc.normalized[0][0]}},{kind:'matrix',matrix:calc.normalized,rowLabels:names,columnLabels:labels},{norms:calc.norms,normalized:calc.normalized});
 const weightSum=weights.reduce((s,v)=>s+v,0);
 log.add({phase:'表达偏好',ruleId:'topsis-weight',action:'归一化后的值乘归一化权重',explanation:'权重先除以权重总和，再逐列乘到归一化属性。零权重使该指标不参与距离，正权重越大，该指标在距离里影响越大。',calculation:{formula:'vᵢⱼ=rᵢⱼ × wⱼ/Σw',values:{'预算权重':weights[0]/weightSum,'价值权重':weights[1]/weightSum,'负担权重':weights[2]/weightSum},result:calc.weighted[0][0]}},{kind:'matrix',matrix:calc.weighted,rowLabels:names,columnLabels:labels},{weighted:calc.weighted});
 log.add({phase:'确定理想点',ruleId:'topsis-ideal',action:'按每列好坏方向拼出理想和最差组合',explanation:'价值取最大为理想；预算和负担取最小为理想。最差点反过来取。理想组合不必对应某一个真实候选，它只是距离参照。',calculation:{formula:'效益列理想=max；成本列理想=min；最差相反',values:{'预算理想':calc.ideal[0],'价值理想':calc.ideal[1],'负担理想':calc.ideal[2]},result:'两个参照点'}},{kind:'matrix',matrix:[calc.ideal,calc.worst],rowLabels:['理想','最差'],columnLabels:labels},{ideal:calc.ideal,worst:calc.worst});
 for(let i=0;i<data.length;i++){
  const [good,bad]=calc.distances[i];
  log.add({phase:'计算贴近度',ruleId:'topsis-distance',action:`计算${names[i]}到两个参照点的距离`,explanation:`到理想距离${round(good,4)}，到最差距离${round(bad,4)}。贴近度=离最差距离/两段距离总和，越大越好。两段同时为0时所有参照重合，本例约定0.5。`,calculation:{formula:'D⁺=||v−理想||；D⁻=||v−最差||；C=D⁻/(D⁺+D⁻)',values:{'D⁺':good,'D⁻':bad},result:calc.scores[i]}},{kind:'bars',values:calc.scores.slice(0,i+1),labels:names.slice(0,i+1),active:[i]}, {[`distance:${i}`]:[good,bad],[`score:${i}`]:calc.scores[i]});
 }
 log.add({phase:'排序',ruleId:'topsis-rank',action:`当前偏好推荐${names[best]}`,explanation:'选贴近度最大者；同分保留列表中较早候选。排名依赖候选、属性方向和权重，改变它们需要重新归一化并计算。',calculation:{formula:'推荐=argmax Cᵢ',values:{'候选数':data.length},result:calc.scores[best]},candidates:calc.scores.map((score,i)=>({target:names[i],status:i===best?'chosen':'rejected',reason:i===best?'贴近度最高，同分取较早候选。':'贴近度较低或同分顺序较晚。',values:{'贴近度':score}}))},{kind:'bars',values:calc.scores,labels:names,active:[best],colors:calc.scores.map((_,i)=>i===best?palette[0]:palette[3])},{best,scores:calc.scores});
 return log.finish('TOPSIS按给定指标与权重排序；理想点可以是不存在的属性组合，增加候选也可能导致排序改变。',{'当前推荐':names[best],'贴近度':round(calc.scores[best],3),'候选数':4});
};
