import type {Runner,Frame,Scene} from '../engine/types';
import {TraceRecorder} from '../engine/teaching';
import {num,round,frame,result} from '../engine/utils';
import {W,H,rgba,image,noiseImage,windowValues,mse} from './world-image';
const matrixWindow=(values:number[],r:number,title:string):Scene=>({kind:'matrix',matrix:Array.from({length:2*r+1},(_,y)=>values.slice(y*(2*r+1),(y+1)*(2*r+1))),active:[Math.floor(values.length/2)],title});

function pixelFilter(method:'gaussian-filter'|'median-filter'|'sobel'):Runner{return(_,p,seed)=>{
 const {clean,noisy}=noiseImage(seed,num(p,'noise',method==='sobel'?3:method==='median-filter'?18:24),method==='median-filter'),r=method==='sobel'?1:Math.max(1,Math.round(num(p,'radius',1))),sigma=Math.max(.5,r*.75),threshold=num(p,'threshold',120),out=method==='sobel'?Array(W*H).fill(0):[...noisy],frames:Frame[]=[frame(image(noisy),'固定带噪输入；每个窗口都读取原始输入，不读取已经处理的输出。')],rec=new TraceRecorder(method,seed,{source:[...noisy],width:W,height:H}),kernel:number[]=[],kx=[-1,0,1,-2,0,2,-1,0,1],ky=[-1,-2,-1,0,0,0,1,2,1];let count=0;
 for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)kernel.push(Math.exp(-(dx*dx+dy*dy)/(2*sigma*sigma)));const kernelSum=kernel.reduce((a,b)=>a+b,0);
 rec.add({phase:'明确局部规则',ruleId:method+'-rule',action:method==='gaussian-filter'?'按距离建立高斯权重':method==='median-filter'?'采用奇数窗口，取排序中间项':'水平和竖直分别用3×3差分核',explanation:method==='gaussian-filter'?`窗口半径${r}，σ=${sigma}，原始权重按exp(−距离平方/(2σ²))，最后除权重和。边界向最近合法像素夹取。`:method==='median-filter'?'窗口总数为奇数；收集后升序排序取中间项。边界重复最近合法像素，所有窗口始终读未处理的原图。':'采用标准Sobel两个3×3核。像素亮度与对应核系数乘后求和得到Gx/Gy，再比较梯度幅值与阈值。',frameIndex:0,scene:method==='gaussian-filter'?matrixWindow(kernel.map(v=>v/kernelSum),r,'归一化高斯权重'):method==='sobel'?{kind:'matrix',matrix:[kx,ky],rowLabels:['Gx核','Gy核'],columnLabels:['左上','上','右上','左','中','右','左下','下','右下']}:matrixWindow(windowValues(noisy,Math.floor(W/2),Math.floor(H/2),r),r,'一个原始窗口'),calculation:method==='gaussian-filter'?{formula:'权重=exp(−(dx²+dy²)/(2σ²)) / 权重总和',values:{r,'σ':sigma,'权重总和':kernelSum},result:1}:method==='median-filter'?{formula:'中间索引=floor(窗口像素数/2)，从0开始',values:{'像素数':(2*r+1)**2},result:Math.floor((2*r+1)**2/2)}:{formula:'Gx=Σ亮度×横向核；Gy=Σ亮度×纵向核',values:{'阈值':threshold},result:'两个方向各算一次'}},{kernel:method==='gaussian-filter'?kernel.map(v=>v/kernelSum):method==='sobel'?[kx,ky]:[],radius:r});
 for(let y=0;y<H;y++){
  for(let x=0;x<W;x++){
   const index=y*W+x,values=windowValues(noisy,x,y,r),scene=matrixWindow(values,r,`处理像素(${x},${y}) · 原始输入窗口`);
   if(method==='gaussian-filter'){
    const terms=values.map((v,i)=>v*kernel[i]),weightedSum=terms.reduce((a,b)=>a+b,0);out[index]=weightedSum/kernelSum;
    rec.add({phase:'逐像素加权平均',ruleId:method+'-apply',action:`计算(${x},${y})的输出亮度`,explanation:'每个邻居亮度乘对应的非负高斯权重，再求和除以总权重。近邻权重大；原图边缘使用最近像素重复填充，不把图外当黑色。',frameIndex:frames.length,scene,calculation:{formula:'输出=Σ(原始邻居亮度×原始权重)/Σ原始权重',values:{x,y,'窗口中心亮度':values[Math.floor(values.length/2)],'加权和':weightedSum,'权重和':kernelSum},result:out[index]}},{[`computed:${index}`]:out[index],window:values,weightedTerms:terms});
   }else if(method==='median-filter'){
    const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);out[index]=sorted[middle];
    rec.add({phase:'逐像素选中位数',ruleId:method+'-apply',action:`(${x},${y})取排序后第${middle+1}项`,explanation:'把这个窗口的原始亮度升序排列，取唯一的中间项，不做平均。少量0或255会留在两端；但坏点过半时，中间项也可能是坏点。完整排序数组在状态变化中。',frameIndex:frames.length,scene,calculation:{formula:'输出=sort(窗口)[floor(n/2)]',values:{x,y,n:sorted.length,'索引（从0）':middle,'最小值':sorted[0],'最大值':sorted.at(-1)!},result:out[index]},candidates:sorted.map((v,i)=>({target:'排序第'+(i+1)+'项',status:i===middle?'chosen':'rejected',reason:i===middle?'两侧各有相同个数的项，是本窗口中位数。':'不是奇数窗口唯一的中间项。',values:{'亮度':v}}))},{[`computed:${index}`]:out[index],window:values,sortedWindow:sorted});
   }else{
    const tx=values.map((v,i)=>v*kx[i]),ty=values.map((v,i)=>v*ky[i]),gx=tx.reduce((a,b)=>a+b,0),gy=ty.reduce((a,b)=>a+b,0),magnitude=Math.hypot(gx,gy),passes=magnitude>=threshold;out[index]=passes?Math.min(255,magnitude):0;if(passes)count++;
    rec.add({phase:'梯度与阈值',ruleId:'sobel-apply',action:passes?`(${x},${y})达到阈值，保留`:`(${x},${y})低于阈值，置零`,explanation:`先用两个核分别求和得到Gx=${round(gx,4)}、Gy=${round(gy,4)}，幅值=${round(magnitude,4)}。${passes?'幅值不小于阈值，显示时最大截到255。':'幅值小于阈值，输出0。'}阈值判断用截断前的幅值。`,frameIndex:frames.length,scene,calculation:{formula:'幅值=√(Gx²+Gy²)；幅值≥阈值则min(255,幅值)，否则0',values:{Gx:gx,Gy:gy,'幅值':magnitude,'阈值':threshold},result:out[index]},candidates:[{target:'保留边缘',status:passes?'chosen':'rejected',reason:passes?'幅值≥阈值。':'幅值不足阈值。'},{target:'置为0',status:passes?'rejected':'chosen',reason:passes?'此处达到阈值。':'此处低于阈值。'}]},{[`computed:${index}`]:out[index],window:values,xProducts:tx,yProducts:ty,gx,gy,magnitude,passes});
   }
  }
  frames.push(frame(image(out),`已真实计算${y+1}行。尚未处理行${method==='sobel'?'为零':'仍显示带噪输入'}。`,{'已处理行':y+1}));
 }
 const before=mse(noisy,clean),after=mse(out,clean),finalScene={...image(out),originalPixels:rgba(noisy),originalLabel:'带噪输入'};
 rec.add({phase:'全部像素完成',ruleId:method+'-finish',action:'用相同输入比较处理前后',explanation:method==='sobel'?'已对全部1536像素应用同一个梯度与阈值规则。边缘仅代表亮度变化，不证明是真实物体边界。':'已对全部1536像素应用同一个局部规则。均方误差依靠本例已知的干净合成图评价；真实照片通常没有这个参考真值。去噪收益要与细节损失一起看。',frameIndex:frames.length,scene:finalScene,calculation:method==='sobel'?{formula:'边缘占比=达到阈值的像素/总像素',values:{'边缘数':count,'总像素':W*H},result:count/(W*H)}:{formula:'MSE=Σ(处理亮度−干净参考亮度)²/像素数',values:{'处理前MSE':before,'像素数':W*H},result:after}},{output:[...out],complete:true});frames.push(frame(finalScene,'同一幅带噪图的前后对照。'));
 rec.trace.coverageNote='全部1536个像素逐项记录；每个窗口读取原始输入，状态保存完整窗口与真实计算。主动画每行一帧；单步事件使用局部窗口矩阵，避免复制1536次完整图片。';
 return{...result(frames,method==='sobel'?'Sobel先算两个方向的局部亮度差，再阈值化；噪声也会产生边缘。':method==='median-filter'?'中值抵抗少量极端值，但密集坏点和过大窗口会破坏细节。':'高斯平滑减弱随机波动，也会模糊细小边缘。',method==='sobel'?{'边缘像素':count,'占比':round(count/(W*H)*100)+'%'}:{'处理前均方误差':round(before),'处理后均方误差':round(after),'窗口宽度':2*r+1}),trace:rec.trace};
};}
export const gaussianFilter=pixelFilter('gaussian-filter'),medianFilter=pixelFilter('median-filter'),sobel=pixelFilter('sobel');

export const otsu:Runner=(_,p,seed)=>{
 const {noisy}=noiseImage(seed,num(p,'noise',8),false,num(p,'contrast',1)),a=noisy.map(Math.round),hist=Array(256).fill(0);a.forEach(v=>hist[v]++);const total=a.length,all=a.reduce((s,v)=>s+v,0),frames:Frame[]=[frame(image(a),'先统计每种亮度有多少像素。')],rec=new TraceRecorder('otsu',seed,{histogram:hist,source:a,total,all});let wb=0,sb=0,best=-1,tBest=0;
 for(let t=0;t<256;t++){
  wb+=hist[t];sb+=hist[t]*t;const wf=total-wb,valid=wb>0&&wf>0,mb=wb?sb/wb:0,mf=wf?(all-sb)/wf:0,score=valid?wb*wf*(mb-mf)**2:0,improved=valid&&score>best,previous=best;if(improved){best=score;tBest=t;}
  rec.add({phase:'遍历阈值',ruleId:valid?'otsu-score':'otsu-empty',action:valid?(improved?`阈值${t}改进当前最好分数`:`阈值${t}没有改进当前最好`):`阈值${t}产生空组，跳过评分`,explanation:valid?`暗组${wb}像素，均值${round(mb,3)}；亮组${wf}像素，均值${round(mf,3)}。分数是组大小乘积乘均值差平方。${improved?'严格大于旧最好，更新阈值。':'没有严格超过，保留较早阈值。'}这个未归一化分数与标准类间方差只差固定总像素数平方。`:'一组没有像素就无法计算该组均值，不把它当作有效分割候选。',frameIndex:frames.length,scene:{kind:'bars',values:Array.from({length:32},(_,i)=>hist.slice(i*8,i*8+8).reduce((x,y)=>x+y,0)),labels:Array.from({length:32},(_,i)=>String(i*8)),active:[Math.floor(t/8)],title:`阈值${t} · 每柱合并8种亮度`},calculation:{formula:'分数=n暗×n亮×(均值暗−均值亮)²；空组跳过',values:{'暗组数':wb,'亮组数':wf,'暗组均值':mb,'亮组均值':mf,'旧最好':previous},result:valid?score:'空组，不评分'},candidates:valid?[{target:'阈值 '+t,status:improved?'chosen':'rejected',reason:improved?'严格超过之前最好分数。':'分数较低或同分，保留较早阈值。',values:{'分数':score}}]:[]},{threshold:t,darkCount:wb,darkSum:sb,brightCount:wf,score:valid?score:null,bestScore:best,bestThreshold:tBest});
  frames.push(frame(image(a.map(v=>v>t?240:15),W,H,`尝试阈值${t}`),valid?'按当前阈值查看分组。':'当前阈值使一组为空，不可作为有效评分。'));
 }
 const output=a.map(v=>v>tBest?240:15),finalScene={...image(output),originalPixels:rgba(a),originalLabel:'原图'};
 rec.add({phase:'应用最佳阈值',ruleId:'otsu-apply',action:`全图用阈值${tBest}`,explanation:'遍历0至255后，保留最高分的较早阈值。严格大于阈值的像素为前景；其余为背景。这是一条全局界线，不理解物体语义。',frameIndex:frames.length,scene:finalScene,calculation:{formula:'前景 ⇔ 亮度 > 最佳阈值',values:{'阈值':tBest,'最好分数':best},result:a.filter(v=>v>tBest).length}},{output});frames.push(frame(finalScene,'自动阈值的真实前后对照。'));
 return {...result(frames,'Otsu穷举灰度阈值并最大化类间区分；空组跳过，同分保留较早阈值。光照不均或两类亮度重叠时，全局阈值可能不够。',{'自动阈值':tBest,'前景像素':a.filter(v=>v>tBest).length}),trace:rec.trace};
};
