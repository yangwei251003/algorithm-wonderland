import type {Runner,Scene} from '../engine/types';
import {rng,num,gaussian,round,palette,clamp,str} from '../engine/utils';
import {WorldRecord} from './world-record';

export const kalman:Runner=(_,p,seed)=>{
 const random=rng(seed),sigma=num(p,'noise',6),assumed=num(p,'assumed',6),q=num(p,'process',.1);
 let truth=10,mean=10,variance=5,sensorError=0,filterError=0;
 const ts:{x:number;y:number}[]=[],ms:{x:number;y:number}[]=[],es:{x:number;y:number}[]=[];
 const log=new WorldRecord('kalman',seed,{mean,variance});
 const scene=():Scene=>({kind:'lines',series:[{name:'真实位置（只作评价）',points:[...ts],color:palette[1]},{name:'有噪测量',points:[...ms],color:palette[3]},{name:'融合估计',points:[...es],color:palette[0]}]});
 for(let t=0;t<120;t++){
  truth+=.45+gaussian(random)*.2;const z=truth+gaussian(random)*sigma;ts.push({x:t,y:truth});ms.push({x:t,y:z});
  const oldMean=mean,oldVariance=variance;mean+=.45;variance+=q;
  log.add({phase:'预测',ruleId:'kalman-predict',action:'先依运动模型预测',explanation:`预测每步前进0.45，位置由 ${round(oldMean)} 变为 ${round(mean)}；方差增加过程方差 ${q}。真实轨迹只作误差评价，滤波器读取的是测量值。`,calculation:{formula:'m预测=m旧+0.45；P预测=P旧+Q',values:{'旧位置':oldMean,'旧方差':oldVariance,Q:q,'预测位置':mean},result:variance}},scene(),{mean,variance,measurement:z,time:t});
  const predictedMean=mean,predictedVariance=variance,r=assumed*assumed,k=variance/(variance+r);
  log.add({phase:'分配信任',ruleId:'kalman-gain',action:'比较预测与测量的不确定度',explanation:`假定测量标准差 ${assumed}，方差 R=${r}。新测量权重 K=${round(k,4)}；预测越不确定，K越大；测量越不确定，K越小。`,calculation:{formula:'K = P预测 / (P预测 + R)',values:{'P预测':variance,R:r},result:k},candidates:[{target:'完全相信新测量',status:k===1?'chosen':'rejected',reason:k===1?'假设测量方差为零，模型把测量视为精确。':'测量也有不确定度，不能把全部权重给它。',values:{'新测量权重':1}},{target:'融合预测与测量',status:k===1?'deferred':'chosen',reason:'用模型规定的相对不确定度计算权重。',values:{'新测量权重':k}}]},scene(),{gain:k});
  mean+=k*(z-mean);variance*=(1-k);sensorError+=(z-truth)**2;filterError+=(mean-truth)**2;es.push({x:t,y:mean});
  log.add({phase:'更新',ruleId:'kalman-update',action:'按权重吸收测量误差',explanation:`新测量与预测差 ${round(z-predictedMean,4)}，只吸收其中 ${round(k*100,2)}%。更新后位置 ${round(mean,4)}，方差 ${round(variance,4)}；这是下一步预测的起点。`,calculation:{formula:'m新=m预测+K(z−m预测)；P新=(1−K)P预测',values:{'预测位置':predictedMean,z,K:k,'预测方差':predictedVariance,'新方差':variance},result:mean}},scene(),{mean,variance}, {'新测量权重':round(k,3),'估计不确定度':round(Math.sqrt(variance),2)});
 }
 return log.finish('本例为已知恒速增量的一维标量 Kalman 滤波。方差假设错误会影响融合；不能把平滑曲线自动当作真实轨迹。固定处理120个测量后结束。',{'原始测量RMSE':round(Math.sqrt(sensorError/120)),'滤波RMSE':round(Math.sqrt(filterError/120))});
};

export const particleFilter:Runner=(_,p,seed)=>{
 const random=rng(seed),n=Math.max(1,Math.round(num(p,'count',150))),sigma=Math.max(.01,num(p,'noise',4)),ambiguous=str(p,'sensor','unique')==='repeated';
 let truth=25,particles=Array.from({length:n},()=>random()*100),err=0;
 const sensor=(x:number)=>ambiguous?Math.min(Math.abs(x-20),Math.abs(x-80)):x;
 const log=new WorldRecord('particle-filter',seed,{particles:[...particles]});
 const scene=(estimate?:number,weights?:number[]):Scene=>({kind:'world',nodes:[...particles.map((x,i)=>({id:'p'+i,x,y:45+(i%11)*2,color:palette[0],r:weights?1+3*weights[i]:1.5})),{x:truth,y:28,label:'真实位置（只作评价）',color:palette[1],r:4},...(estimate===undefined?[]:[{x:estimate,y:78,label:'粒子平均',color:palette[3],r:4}])],paths:[{points:[{x:0,y:60},{x:100,y:60}],color:'#324b5b'}],title:'每个粒子是一种位置猜测'});
 for(let t=0;t<90;t++){
  truth=(truth+.5)%100;const before=[...particles],noise=particles.map(()=>gaussian(random)*.8);
  particles=particles.map((x,i)=>(x+.5+noise[i]+100)%100);
  log.add({phase:'预测粒子',ruleId:'particle-predict',action:'每个猜测随运动前进，再加过程扰动',explanation:'全部粒子按同一运动公式同步预测。每个独立扰动均由固定种子抽取并保存在状态记录；位置超过边界会循环。',calculation:{formula:'x预测 = (x旧 + 0.5 + 过程噪声 + 100) mod 100',values:{'粒子1旧位置':before[0],'粒子1噪声':noise[0]},result:particles[0]}},scene(),{particles:[...particles],processNoise:noise,time:t});
  const measurement=sensor(truth)+gaussian(random)*sigma,predictedMeasurements=particles.map(sensor),raw=predictedMeasurements.map(h=>Math.exp(-.5*((h-measurement)/sigma)**2)+1e-12),sum=raw.reduce((a,b)=>a+b,0),weights=raw.map(w=>w/sum),cdf:number[]=[];
  weights.reduce((s,v,i)=>(cdf[i]=s+v),0);
  log.add({phase:'证据加权',ruleId:'particle-weight',action:'与新测量更相容的粒子得到更大权重',explanation:`测量值 ${round(measurement,4)}。按高斯测量误差计算全部粒子的似然再归一化；${ambiguous?'重复地标使不同位置可能得到相近预测测量，所以不应只保留一个峰。':'本例传感器直接测量位置。'}额外的1e−12避免全部权重下溢为零。`,calculation:{formula:'w原始=exp(−0.5((h(x)−z)/σ)²)+10⁻¹²；w=w原始/总和',values:{'粒子1预测测量':predictedMeasurements[0],z:measurement,'σ':sigma,'权重总和':sum},result:weights[0]}},scene(undefined,weights),{measurement,predictedMeasurements,weights,cdf});
  let idx=0;const offset=random()/n,next:number[]=[],ancestors:number[]=[],jitter:number[]=[];
  for(let k=0;k<n;k++){const u=offset+k/n;while(idx<n-1&&cdf[idx]<u)idx++;ancestors.push(idx);const delta=gaussian(random)*.15;jitter.push(delta);next.push(clamp(particles[idx]+delta,0,100));}
  const firstParent=particles[ancestors[0]];particles=next;
  const estimate=particles.reduce((a,b)=>a+b,0)/n;err+=(estimate-truth)**2;
  log.add({phase:'系统重采样',ruleId:'particle-resample',action:'沿累计权重等间隔取样，复制更受支持的猜测',explanation:`先在 [0,1/N) 抽一个偏移，再按间隔1/N走过累计权重。较宽的权重区间可能被选中多次。每个祖先编号及微小抖动都记录；本实现抖动后截到[0,100]。平均位置只是摘要，多峰时可能不对应可信位置。`,calculation:{formula:'uₖ=偏移+k/N；选首个 CDF≥uₖ 的粒子，再加小抖动',values:{N:n,'偏移':offset,'首个祖先编号':ancestors[0]+1,'祖先位置':firstParent,'抖动':jitter[0]},result:particles[0]}},scene(estimate),{particles:[...particles],ancestors,jitter,offset,estimate},{'真实位置':round(truth),'平均估计':round(estimate)});
 }
 return log.finish('bootstrap 粒子滤波：运动预测、似然加权、系统重采样。此版每步重采样并添加微小抖动，90次测量后结束；平均值不能概括多峰分布。',{'粒子数':n,'均方根位置误差':round(Math.sqrt(err/90))},'每个事件为同步向量规则；全部粒子的位置、过程噪声、归一化权重、累计权重和重采样祖先都保存在状态变化中，示例公式展示粒子1。');
};
