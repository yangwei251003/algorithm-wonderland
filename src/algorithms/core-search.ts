import type {Frame, LabInput, Params, Runner} from '../engine/types';
import {clamp, frame, num, result, rng, str} from '../engine/utils';
import {TraceRecorder,record} from './core-teaching';

export function arrayData(input:LabInput,p:Params,seed:number):number[]{
 const entered=input.values??(str(p,'values','').trim()?str(p,'values','').split(/[,，\s]+/).map(Number).filter(Number.isFinite):null);
 if(entered)return entered.filter(Number.isFinite).slice(0,60);
 const random=rng(seed),n=clamp(Math.round(num(p,'count',18)),3,48),mode=str(p,'order','random');
 let a=Array.from({length:n},()=>Math.floor(random()*(mode==='duplicates'?6:90))+1);
 if(mode==='reverse')a.sort((a,b)=>b-a); if(mode==='nearly'){a.sort((a,b)=>a-b);if(n>3)[a[1],a[n-2]]=[a[n-2],a[1]];}return a;
}
function search(binary:boolean):Runner{return(input,p,seed)=>{
 const id=binary?'binary-search':'linear-search',a=arrayData(input,p,seed);if(input.values===undefined&&!str(p,'values','').trim()&&a.length)a[Math.floor(a.length*.7)]=42;if(binary)a.sort((a,b)=>a-b);
 const target=num(p,'target',42),frames:Frame[]=[],rec=new TraceRecorder(id,seed,{array:[...a],target,low:0,high:a.length-1,found:-1,comparisons:0});let comparisons=0,found=-1;
 const scene=(active:number[]=[],secondary:number[]=[]):import('../engine/types').Scene=>({kind:'bars',values:[...a],active,secondary,labels:a.map(String),title:binary?'有序价格表':'逐个寻找目标'});
 frames.push(frame(scene(),binary?'输入已按升序准备；二分查找只计查找比较，不把排序开销藏进效率结论。':'从第一件开始依次查看。'));
 record(rec,frames,{phase:'initialize',ruleId:id+'.initialize',action:'准备搜索范围',explanation:binary?'二分的前提是有序；已排序的数组是本次查找的输入。':'不要求有序，每次只看一个位置。'});
 if(binary){let lo=0,hi=a.length-1;while(lo<=hi){const mid=Math.floor((lo+hi)/2);comparisons++;const relation=a[mid]===target?'相等':a[mid]<target?'偏小':'偏大';
  frames.push(frame(scene([mid],Array.from({length:hi-lo+1},(_,i)=>lo+i)),`中间价格 ${a[mid]}，与目标 ${target} 比较：${relation}。`,{'已查看':comparisons,'目标':target}));
  record(rec,frames,{phase:'compare',ruleId:id+'.compare',action:'取中点比较',explanation:`low=${lo}、high=${hi}，中点向下取整为${mid}。${a[mid]}与${target}${relation}。`,focus:[String(mid)],calculation:{formula:'mid=floor((low+high)/2)',values:{low:lo,high:hi,value:a[mid],target},result:mid}},{comparisons,mid});
  if(a[mid]===target){found=mid;record(rec,frames,{phase:'stop',ruleId:id+'.stop',action:'命中目标',explanation:'当前值等于目标，返回一个匹配位置；重复值时不承诺第一个。'},{found});break;}
  const oldLo=lo,oldHi=hi;if(a[mid]<target)lo=mid+1;else hi=mid-1;
  record(rec,frames,{phase:'discard',ruleId:id+'.discard',action:a[mid]<target?'排除左半边':'排除右半边',explanation:a[mid]<target?`升序保证[${oldLo},${mid}]所有值≤${a[mid]}<${target}，它们都不可能是目标。`:`升序保证[${mid},${oldHi}]所有值≥${a[mid]}>${target}，它们都不可能是目标。`,candidates:[{target:a[mid]<target?`[${oldLo},${mid}]`:`[${mid},${oldHi}]`,status:'rejected',reason:'有序性与当前比较共同证明该区间不含目标'},{target:`[${lo},${hi}]`,status:'deferred',reason:'只在剩余非空区间继续查找'}]},{low:lo,high:hi},scene([],Array.from({length:Math.max(0,hi-lo+1)},(_,i)=>lo+i)));
 }}else for(let i=0;i<a.length;i++){comparisons++;const equal=a[i]===target;frames.push(frame(scene([i]),`查看第 ${i+1} 件：${a[i]}${equal?'，找到目标':'，不等于目标，继续'}。`,{'已查看':comparisons,'目标':target}));record(rec,frames,{phase:'compare',ruleId:id+'.compare',action:'逐件核对',explanation:`${a[i]} ${equal?'=':'≠'} ${target}，${equal?'命中并停止':'只能排除这一件，不能据此排除后面的值'}。`,focus:[String(i)],calculation:{formula:'array[i] == target',values:{i,value:a[i],target},result:equal?'相等':'不等'},candidates:[{target:String(i),status:equal?'chosen':'rejected',reason:equal?'值等于目标':'值不等于目标'}]},{comparisons,index:i});if(equal){found=i;break;}}
 const summary=found<0?'目标不在这批数据中。没有找到也是有效答案。':`用 ${comparisons} 次查看找到目标，位于第 ${found+1} 个位置。`;frames.push(frame(scene(found<0?[]:[found]),summary));record(rec,frames,{phase:'result',ruleId:id+'.stop',action:'给出查找结果',explanation:found<0?(binary?'剩余区间已空，所有排除都有比较依据。':'已检查全部位置，没有相等项。'):summary},{found});
 return {...result(frames,summary,{'查看次数':comparisons,'找到位置':found,'数据数量':a.length}),trace:rec.trace};
};}
function sorting(kind:string):Runner{return(input,p,seed)=>{
 const a=arrayData(input,p,seed),frames:Frame[]=[],rec=new TraceRecorder(kind,seed,{array:[...a],comparisons:0,moves:0});let comparisons=0,moves=0,skipped=0;
 const scene=(active:number[]=[]):import('../engine/types').Scene=>({kind:'bars',values:[...a],labels:a.map(String),active,title:'把一排商品按价格整理'});
 const snap=(caption:string,active:number[]=[],force=false)=>{if(force||frames.length<650)frames.push(frame(scene(active),caption,{'比较':comparisons,'移动':moves}));else skipped++;};
 const emit=(rule:string,action:string,explanation:string,active:number[]=[],extra:Partial<import('../engine/teaching').TraceEvent>={})=>record(rec,frames,{phase:rule,ruleId:kind+'.'+rule,action,explanation,focus:active.map(String),...extra},{array:[...a],comparisons,moves},scene(active));
 const swap=(i:number,j:number,why:string)=>{const before=[a[i],a[j]];if(i!==j){[a[i],a[j]]=[a[j],a[i]];moves+=2;}emit('move','交换位置',i===j?`位置${i}与自身相同，无需实际写入。`:`${why}；位置${i}的${before[0]}与位置${j}的${before[1]}交换。`,[i,j]);};
 snap('先记录原始商品顺序，再逐步应用排序规则。');emit('initialize','开始整理','目标是升序，值可相等；比较次数与写入次数分别记录。');
 if(!a.length){emit('stop','空表结束','没有元素，也就没有需要比较或移动的位置。');return {...result(frames,'清单为空，没有需要整理的项目。',{'比较次数':0,'移动次数':0,'排序结果':''}),trace:rec.trace};}
 if(kind==='quick-sort'){
  const part=(lo:number,hi:number)=>{if(lo>=hi){emit('partition','区间已经有序',`区间[${lo},${hi}]不足两个元素，不再递归。`);return;}const pivot=a[hi];let k=lo;snap(`选择末尾 ${pivot} 为分界。`,[hi]);emit('partition','选择分界值',`Lomuto分区：末尾${pivot}作pivot，k=${k}是下一个“小于等于pivot”位置。`,[hi],{calculation:{formula:'pivot=array[high]',values:{low:lo,high:hi},result:pivot}});
   for(let j=lo;j<hi;j++){const value=a[j],take=value<=pivot;comparisons++;snap(`比较 ${value} 与分界 ${pivot}。`,[j,hi]);emit('compare','和分界比较',`${value}${take?'≤':'>'}${pivot}，${take?'放入左侧已处理区域':'暂留右侧区域'}。`,[j,hi],{calculation:{formula:'value ≤ pivot',values:{value,pivot},result:take?'是':'否'},candidates:[{target:String(j),status:take?'chosen':'deferred',reason:take?'属于小值侧':'属于大值侧，后续递归处理'}]});if(take){swap(j,k,'维持左侧≤pivot的分区不变量');k++;record(rec,frames,{phase:'partition',ruleId:kind+'.partition',action:'推进小值边界',explanation:`小值区结束位置推进到${k}。`},{boundary:k});}}
   swap(k,hi,'把分界值放到两侧之间');snap(`分界 ${pivot} 归位，再整理左右两侧。`,[k]);emit('partition','分区完成',`位置${k}已归位；左右区间分别递归，不能把“分区”当成整列已排序。`,[k]);part(lo,k-1);part(k+1,hi);
  };part(0,a.length-1);
 }else if(kind==='merge-sort'){
  const merge=(lo:number,hi:number)=>{emit('divide','拆分区间',`半开区间[${lo},${hi})有${hi-lo}项；${hi-lo<2?'单项自然有序':'先分别整理左右一半'}。`);if(hi-lo<2)return;const mid=(lo+hi)>>1;merge(lo,mid);merge(mid,hi);const left=a.slice(lo,mid),right=a.slice(mid,hi);let i=0,j=0,k=lo;
   while(i<left.length||j<right.length){const both=i<left.length&&j<right.length,takeLeft=j>=right.length||(i<left.length&&left[i]<=right[j]);if(both)comparisons++;const value=takeLeft?left[i]:right[j];emit('compare','比较两队队首',!both?`${i>=left.length?'左':'右'}队已经为空，只能取另一队。`:`左队首${left[i]}与右队首${right[j]}比较，取${takeLeft?'左':'右'}；相等取左保持稳定。`,[k],{calculation:{formula:'takeLeft = rightEmpty || leftHead ≤ rightHead',values:{left:i<left.length?left[i]:'空',right:j<right.length?right[j]:'空'},result:takeLeft?'左':'右'}});if(takeLeft)i++;else j++;a[k]=value;moves++;snap(`合并两队，把 ${value} 写入第 ${k+1} 位。`,[k]);emit('move','写入较小队首',`只移动选中队列的读指针，另一队队首留给下一次比较。`,[k]);k++;}
  };merge(0,a.length);
 }else if(kind==='heap-sort'){
  const sink=(i:number,n:number)=>{while(true){let largest=i;const l=i*2+1,r=l+1;for(const child of [l,r]){if(child>=n){emit('compare','检查子节点',`子位置${child}超出当前堆大小${n}，不参与比较。`,[i]);continue;}comparisons++;const bigger=a[child]>a[largest];emit('compare','选择局部最大值',`子值${a[child]} ${bigger?'>':'≤'} 当前候选${a[largest]}，${bigger?'改选子节点':'保留候选'}。`,[child,largest],{calculation:{formula:'child > currentLargest',values:{child:a[child],current:a[largest]},result:bigger?'改选':'保留'}});if(bigger)largest=child;}if(largest===i){emit('heap','该子树已满足大顶堆',`父节点${a[i]}不小于两个有效子节点，停止下沉。`,[i]);return;}swap(i,largest,'将三者中最大的放到父节点');snap('修复父子关系，继续检查被换下的元素。',[i,largest]);i=largest;}};
  for(let i=(a.length>>1)-1;i>=0;i--){emit('heap','从最后非叶节点向前建堆',`修复根为${i}的子树；它下面的子树已先处理。`,[i]);sink(i,a.length);}for(let end=a.length-1;end>0;end--){swap(0,end,'堆顶是未排序部分的最大值');snap('最大值移到尾部，并缩小堆。',[end]);emit('heap','缩小待排序范围',`位置${end}已归位，新堆只包含[0,${end})。`,[end]);sink(0,end);}
 }else{
  if(a.some(v=>!Number.isInteger(v))){emit('initialize','拒绝小数输入','计数盒必须对应离散整数；不能把小数悄悄取整。');return {...result([frames[0]],'输入含小数：先明确离散刻度，不能直接套用计数排序。',{'可执行':0}),trace:rec.trace};}
  const lo=Math.min(...a),hi=Math.max(...a);if(hi-lo>2000){emit('initialize','拒绝过宽数值域',`跨度${hi-lo}>2000，教学实验不分配大量空计数盒。`);return {...result([frames[0]],'本演示限制数值跨度不超过 2000。',{'输入状态':'跨度过大','可执行':0}),trace:rec.trace};}
  const counts=Array<number>(hi-lo+1).fill(0);for(let i=0;i<a.length;i++){counts[a[i]-lo]++;const occupied=counts.map((count,index)=>({count,value:index+lo})).filter(v=>v.count>0);frames.push({scene:scene([i]),secondaryScene:{kind:'bars',values:occupied.map(v=>v.count),labels:occupied.map(v=>String(v.value)),title:'计数盒'},caption:`价格${a[i]}的盒子增加1。`});record(rec,frames,{phase:'count',ruleId:kind+'.count',action:'给对应盒子加一',explanation:`盒子索引=${a[i]}−最小值${lo}=${a[i]-lo}；累计${counts[a[i]-lo]}件。`,focus:[String(i)],calculation:{formula:'count[value−min] += 1',values:{value:a[i],min:lo},result:counts[a[i]-lo]}},{counts:[...counts]});}
  let k=0;for(let v=0;v<counts.length;v++){record(rec,frames,{phase:'rebuild',ruleId:kind+'.rebuild',action:'按盒子顺序重建',explanation:`值${v+lo}有${counts[v]}件，${counts[v]?'依次写回':'空盒直接越过'}。`},{box:v});for(let j=0;j<counts[v];j++){a[k]=v+lo;moves++;snap(`按值从低到高取出 ${v+lo}。`,[k]);emit('move','写回已计数的值',`这是盒${v+lo}中的第${j+1}/${counts[v]}件。`,[k]);k++;}}
 }
 const summary=`整理完成：${a.length} 件商品，${comparisons} 次值比较、${moves} 次写入或移动。${skipped?`为方便观看，省略了 ${skipped} 次中间画面；完整原理记录仍可逐步展开，结果与计数完整。`:''}`;snap(summary,[],true);emit('stop','全部有序',summary);return {...result(frames,summary,{'比较次数':comparisons,'移动次数':moves,'排序结果':a.join(','),'省略中间画面':skipped}),trace:rec.trace};
};}
const reservoir:Runner=(input,p,seed)=>{
 const count=clamp(Math.round(num(p,'count',40)),5,120),k=clamp(Math.round(num(p,'sample',5)),1,count),random=rng(seed),sample:number[]=[],frames:Frame[]=[],rec=new TraceRecorder('reservoir',seed,{sample:[],seen:0});
 for(let i=0;i<count;i++){let changed=false,draw:number|null=null,replaced:number|null=null;if(i<k){sample.push(i+1);changed=true;}else{draw=Math.floor(random()*(i+1));if(draw<k){replaced=sample[draw];sample[draw]=i+1;changed=true;}}
  frames.push(frame({kind:'bars',values:[...sample],labels:sample.map(v=>`报名${v}`),active:changed?[sample.indexOf(i+1)]:[],title:'不断到来的报名者'},i<k?`先填满第${i+1}个空槽。`:`第${i+1}位抽签${draw}，${changed?'替换槽位'+draw:'不进入保留区'}。`,{'已报名':i+1,'样本容量':k}));
  record(rec,frames,{phase:i<k?'fill':'draw',ruleId:'reservoir.'+(i<k?'fill':'draw'),action:i<k?'填充空槽':'均匀抽签决定替换',explanation:i<k?'尚未超过容量，当前所有人都保留。':`从0到${i}等概率抽整数j=${draw}。只有j<${k}才替换第j槽，${changed?`原报名${replaced}离开样本`:'本次保留原样本'}。`,calculation:{formula:i<k?'keep=1':'P(新者保留)=k/i；旧者保留率=(k/(i−1))×(1−1/i)=k/i',values:{seen:i+1,k,j:draw??'尚无需抽签'},result:i<k?'1':`${k}/${i+1}`},candidates:i<k?undefined:[{target:String(i+1),status:changed?'chosen':'rejected',reason:changed?`j=${draw}<k=${k}`:`j=${draw}≥k=${k}`} ]},{sample:[...sample],seen:i+1,draw});
 }
 record(rec,frames,{phase:'stop',ruleId:'reservoir.stop',action:'读到当前流末尾',explanation:'没有预知总人数；在当前时刻，每人的边际入选概率相同，样本中没有重复的人。'});
 return {...result(frames,`从 ${count} 位报名者中保留 ${k} 位。算法只保存样本，无需提前知道总人数。`,{'样本':sample.join(','),'报名人数':count,'每人入选概率':`${k}/${count}`}),trace:rec.trace};
};
export const searchRunners:Record<string,Runner>={'linear-search':search(false),'binary-search':search(true),'quick-sort':sorting('quick-sort'),'merge-sort':sorting('merge-sort'),'heap-sort':sorting('heap-sort'),'counting-sort':sorting('counting-sort'),reservoir};
