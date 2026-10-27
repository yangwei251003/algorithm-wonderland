import type {Runner,Frame} from '../engine/types';
import {TraceRecorder} from '../engine/teaching';
import {rng,num,clamp,result,frame} from '../engine/utils';
const gradients=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
export function perlinKernel(seed:number){const random=rng(seed),p=Array.from({length:256},(_,i)=>i);for(let i=255;i>0;i--){const j=Math.floor(random()*(i+1));[p[i],p[j]]=[p[j],p[i]];}const perm=[...p,...p],fade=(t:number)=>t*t*t*(t*(t*6-15)+10),lerp=(a:number,b:number,t:number)=>a+t*(b-a);
 return{permutation:p,sample(x:number,y:number){const X=Math.floor(x)&255,Y=Math.floor(y)&255,xx=x-Math.floor(x),yy=y-Math.floor(y),u=fade(xx),v=fade(yy),hashes=[perm[perm[X]+Y],perm[perm[X+1]+Y],perm[perm[X]+Y+1],perm[perm[X+1]+Y+1]],offsets=[[xx,yy],[xx-1,yy],[xx,yy-1],[xx-1,yy-1]],gs=hashes.map(h=>gradients[h&7]),dots=gs.map((g,i)=>g[0]*offsets[i][0]+g[1]*offsets[i][1]),top=lerp(dots[0],dots[1],u),bottom=lerp(dots[2],dots[3],u);return{x,y,xx,yy,hashes,gradients:gs,dots,u,v,top,bottom,value:lerp(top,bottom,v)};}};
}
export function makePerlin(seed:number){const kernel=perlinKernel(seed);return(x:number,y:number)=>kernel.sample(x,y).value;}
const terrainColor=(v:number)=>v<.38?[28,65+v*70,110+v*80,255]:v<.48?[58,129,151,255]:v<.53?[190,183,128,255]:v<.68?[64,126,100,255]:v<.8?[111,143,125,255]:[210,224,215,255];
export const perlin:Runner=(_,p,seed)=>{const kernel=perlinKernel(seed),cols=80,rows=48,scale=num(p,'scale',4),octaves=Math.max(1,Math.round(num(p,'octaves',4))),persistence=num(p,'persistence',.5),sum=Array(cols*rows).fill(0),frames:Frame[]=[],log=new TraceRecorder('perlin',seed,{permutation:kernel.permutation,scale,octaves,persistence});let total=0;
 const init=log.add({frameIndex:0,phase:'随机但一致的梯度场',ruleId:'perlin-gradient',action:'固定种子打乱0至255，角点按哈希选择梯度',explanation:'同一角点始终使用同一梯度；样本点不是独立掷骰子。每个格的四个角先各自计算梯度与位移的点积。8种梯度含对角向量，未统一长度；格坐标256周期。',scene:{kind:'matrix',matrix:gradients,rowLabels:gradients.map((_,i)=>String(i)),columnLabels:['gx','gy'],title:'角点可选的8种梯度'}},{});
 frames.push({...frame({kind:'matrix',matrix:gradients,columnLabels:['gx','gy'],title:'共享角点梯度'},'同一角点共用同一方向，固定种子可复现。'),eventId:init});
 for(let o=0;o<octaves;o++){const amp=persistence**o;total+=amp;for(let y=0;y<rows;y++){
  const samples=Array.from({length:cols},(_,x)=>kernel.sample(x/cols*scale*2**o,y/rows*scale*2**o));for(let x=0;x<cols;x++)sum[y*cols+x]+=samples[x].value*amp;
  const s=samples[31];log.add({frameIndex:frames.length-1,parentId:init,phase:`第${o+1}层·第${y+1}行`,ruleId:'perlin-blend',action:'四个角的影响经平滑权重相连',explanation:'本行80个位置分别计算四角点积，用五次曲线产生横纵权重，先横向两次插值再纵向一次。全部样本的梯度、点积和插值都已记录；公式展示第32列。',calculation:{formula:'fade(t)=6t⁵−15t⁴+10t³；noise=(1−v)×top+v×bottom',values:{'x':s.x,'y':s.y,'横权重u':s.u,'纵权重v':s.v,top:s.top,bottom:s.bottom},result:s.value},scene:{kind:'matrix',matrix:[[s.dots[0],s.dots[1]],[s.dots[2],s.dots[3]],[s.top,s.bottom],[s.u,s.v]],rowLabels:['上两角点积','下两角点积','两次横插值','横/纵权重'],columnLabels:['左 / u','右 / v'],title:`第${o+1}层，第${y+1}行第32列`}},{octave:o,row:y,samples,amplitude:amp,[`sumRow:${y}`]:sum.slice(y*cols,(y+1)*cols)});
 }
 const values=sum.map(v=>clamp(.5+v/total*.7,0,1)),scene={kind:'image' as const,cols,rows,pixels:values.flatMap(terrainColor),title:`叠加${o+1}层平滑噪声`},id=log.add({frameIndex:frames.length,phase:`第${o+1}层完成`,ruleId:'perlin-layer',action:'频率翻倍、振幅衰减，再映射成地形颜色',explanation:'每层的频率为基础尺度乘2的层号次方，振幅为持久度的层号次方。累计后除振幅总和再映射颜色；海洋与山地是人为解释，不是物理地形预测。',calculation:{formula:'数值=clip(0.5+0.7×Σ(噪声×振幅)/Σ振幅,0,1)',values:{'层号从0':o,'本层振幅':amp,'累计振幅':total,'示例累计':sum[31]},result:values[31]}},{total,values});frames.push({...frame(scene,'低频铺大形状，高频补小细节。',{'噪声层数':o+1}),eventId:id});
 }
 log.trace.coverageNote='每行是一条80位置的向量事件，包含各位置四角梯度、点积、平滑权重和结果；全48行×所有层均记录。主画面按完成的层显示，逐行事件显示实际数值。';return{...result(frames,'Perlin噪声把随机梯度平滑连接；相邻点共享角点影响。多层叠加生成细节，不是把独立白噪声直接涂成地图。',{'层数':octaves,'基础尺度':scale,'像素数':cols*rows}),trace:log.trace};
};
