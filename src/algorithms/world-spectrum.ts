import type {Runner,Scene} from '../engine/types';
import {rng,num,gaussian,round} from '../engine/utils';
import {WorldRecord} from './world-record';
type FFTEvent={node:string;stage:'split'|'leaf'|'butterfly';n:number;re:number[];im:number[];even?:{re:number[];im:number[]};odd?:{re:number[];im:number[]};k?:number;c?:number;s?:number;tr?:number;ti?:number;};
export function fftCompute(re:number[],im=Array(re.length).fill(0),observe?:(event:FFTEvent)=>void,node='r'):{re:number[];im:number[]}{
 const n=re.length;if(!n||(n&(n-1))||im.length!==n)throw new Error('基2FFT需要非空、等长、长度为2的幂的实部/虚部数组。');
 if(n===1){observe?.({node,stage:'leaf',n,re:[...re],im:[...im]});return{re:[re[0]],im:[im[0]]};}
 observe?.({node,stage:'split',n,re:[...re],im:[...im]});
 const even=fftCompute(re.filter((_,i)=>i%2===0),im.filter((_,i)=>i%2===0),observe,node+'e'),odd=fftCompute(re.filter((_,i)=>i%2===1),im.filter((_,i)=>i%2===1),observe,node+'o'),rr=Array(n).fill(0),ii=Array(n).fill(0);
 for(let k=0;k<n/2;k++){
  const c=Math.cos(-2*Math.PI*k/n),s=Math.sin(-2*Math.PI*k/n),tr=c*odd.re[k]-s*odd.im[k],ti=s*odd.re[k]+c*odd.im[k];rr[k]=even.re[k]+tr;ii[k]=even.im[k]+ti;rr[k+n/2]=even.re[k]-tr;ii[k+n/2]=even.im[k]-ti;
  observe?.({node,stage:'butterfly',n,k,c,s,tr,ti,even,odd,re:[...rr],im:[...ii]});
 }
 return{re:rr,im:ii};
}
export const fft:Runner=(_,p,seed)=>{
 const random=rng(seed),n=128,f=num(p,'frequency',7),g=num(p,'second',19),noise=num(p,'noise',.1),samples=Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*f*i/n)+.55*Math.sin(2*Math.PI*g*i/n)+gaussian(random)*noise),log=new WorldRecord('fft',seed,{samples,samplingRate:128}),nodeEvents=new Map<string,string>();
 const signal:Scene={kind:'lines',series:[{name:'混合信号',points:samples.map((y,x)=>({x:x/n,y}))}]};
 const z=fftCompute(samples,undefined,e=>{
  const parentId=nodeEvents.get(e.node.slice(0,-1));
  if(e.stage==='split'){
   log.add({parentId,phase:'奇偶拆分',ruleId:'fft-split',action:`长度${e.n}分为两段长度${e.n/2}`,explanation:'按当前子序列的偶数索引和奇数索引拆分，分别递归求变换；不是按前后两半切开。每层仍保留原始顺序关系。',calculation:{formula:'偶序列=x[0],x[2],…；奇序列=x[1],x[3],…',values:{'当前长度':e.n},result:e.n/2}},{kind:'lines',series:[{name:'偶索引',points:e.re.map((y,x)=>({x,y})).filter((_,i)=>i%2===0)},{name:'奇索引',points:e.re.map((y,x)=>({x,y})).filter((_,i)=>i%2===1)}]},{node:e.node,subRe:e.re,subIm:e.im});nodeEvents.set(e.node,log.recorder.trace.events.at(-1)!.id);
  }else if(e.stage==='leaf'){
   log.add({parentId,phase:'递归基例',ruleId:'fft-leaf',action:'只剩一个样本，变换值就是它',explanation:'长度1的变换只有一个系数，指数因子为1，不需要再拆分或相加。',calculation:{formula:'DFT₁(x₀)=x₀',values:{'实部':e.re[0],'虚部':e.im[0]},result:e.re[0]}},{kind:'matrix',matrix:[[e.re[0],e.im[0]]],columnLabels:['实部','虚部']},{node:e.node,subRe:e.re,subIm:e.im});
  }else{
   const k=e.k!,even=e.even!,odd=e.odd!,parent=nodeEvents.get(e.node);
   log.add({parentId:parent,phase:'蝶形合并',ruleId:'fft-butterfly',action:`长度${e.n}，配对产生频率索引${k}和${k+e.n/2}`,explanation:'奇分支结果先乘复数旋转因子，再与偶分支分别相加和相减。一次乘法贡献两个频率系数，这种复用使运算从直接DFT的平方量级降到N log N。矩阵每行是一个复数。',calculation:{formula:'T=(cosθ+i sinθ)Oₖ；Xₖ=Eₖ+T；Xₖ₊ₙ/₂=Eₖ−T',values:{'E实':even.re[k],'E虚':even.im[k],'O实':odd.re[k],'O虚':odd.im[k],'cosθ':e.c!,'sinθ':e.s!},result:`(${round(e.re[k],4)},${round(e.im[k],4)}) / (${round(e.re[k+e.n/2],4)},${round(e.im[k+e.n/2],4)})`}},{kind:'matrix',matrix:[[even.re[k],even.im[k]],[odd.re[k],odd.im[k]],[e.tr!,e.ti!],[e.re[k],e.im[k]],[e.re[k+e.n/2],e.im[k+e.n/2]]],rowLabels:['E','O','T','E+T','E−T'],columnLabels:['实部','虚部'],active:[6,7,8,9]},{node:e.node,butterflyIndex:k,partialRe:e.re,partialIm:e.im,completedPairs:k+1});
  }
 });
 const amps=z.re.slice(0,n/2).map((r,i)=>(i===0?1:2)*Math.hypot(r,z.im[i])/n),peak=amps.indexOf(Math.max(...amps));
 log.add({phase:'解释频谱',ruleId:'fft-spectrum',action:`把复数系数转成单边幅度，最高在${peak} Hz`,explanation:'采样率128Hz、128点，所以频率间隔1Hz。只显示0至63Hz；直流幅度为|X₀|/N，其余显示2|Xₖ|/N。噪声和非整周期会使峰扩散，峰本身不证明信号来源。',calculation:{formula:'频率=kFs/N；幅度=2√(Re²+Im²)/N（直流不乘2）',values:{'峰索引':peak,Fs:128,N:n},result:amps[peak]}},{kind:'bars',values:amps,labels:amps.map((_,i)=>i%8===0||i===peak||i===Math.round(g)?String(i):''),active:[peak],title:'真实FFT系数的单边幅度 / Hz'},{re:z.re,im:z.im,amplitudes:amps,peak});
 log.frames[log.frames.length-1].secondaryScene=signal;
 return log.finish('递归基2Cooley–Tukey FFT；完整记录奇偶拆分、长度1基例与每个蝶形配对。动画速度不当作运算效率证据。',{'最强频率':peak+' Hz','采样率':'128 Hz','频率间隔':'1 Hz'});
};
