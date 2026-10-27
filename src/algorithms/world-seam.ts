import type {Runner,Scene} from '../engine/types';
import {num,str,round} from '../engine/utils';
import {W,H,rgba,image,picture} from './world-image';
import {WorldRecord} from './world-record';
type SeamEvent={phase:'energy'|'row'|'bottom'|'backtrack';width:number;height:number;energy:number[];cost:number[];prev:number[];row?:number;choices?:{x:number;columns:number[];costs:number[];selected:number}[];x?:number;seam?:number[]};
export function removeSeam(a:number[],w:number,h:number,observe?:(event:SeamEvent)=>void):{pixels:number[];seam:number[];energy:number}{
 if(w<2||h<1||a.length!==w*h)throw new Error('接缝裁剪需要有效矩形且宽度至少2。');
 const e=a.map((_,i)=>{const x=i%w,y=Math.floor(i/w);return Math.abs(a[y*w+Math.min(w-1,x+1)]-a[y*w+Math.max(0,x-1)])+Math.abs(a[Math.min(h-1,y+1)*w+x]-a[Math.max(0,y-1)*w+x]);}),cost=[...e],prev=Array(w*h).fill(-1);
 observe?.({phase:'energy',width:w,height:h,energy:e,cost,prev});
 for(let y=1;y<h;y++){
  const choices:NonNullable<SeamEvent['choices']>=[];
  for(let x=0;x<w;x++){
   let best=x;const columns=[];for(let z=Math.max(0,x-1);z<=Math.min(w-1,x+1);z++){columns.push(z);if(cost[(y-1)*w+z]<cost[(y-1)*w+best])best=z;}
   choices.push({x,columns,costs:columns.map(z=>cost[(y-1)*w+z]),selected:best});cost[y*w+x]+=cost[(y-1)*w+best];prev[y*w+x]=best;
  }
  observe?.({phase:'row',width:w,height:h,energy:e,cost,prev,row:y,choices});
 }
 let x=0;for(let z=1;z<w;z++)if(cost[(h-1)*w+z]<cost[(h-1)*w+x])x=z;
 const energy=cost[(h-1)*w+x],seam=Array(h).fill(-1);observe?.({phase:'bottom',width:w,height:h,energy:e,cost,prev,x});
 for(let y=h-1;y>=0;y--){seam[y]=x;observe?.({phase:'backtrack',width:w,height:h,energy:e,cost,prev,row:y,x,seam});x=prev[y*w+x];}
 return{pixels:a.filter((_,i)=>i%w!==seam[Math.floor(i/w)]),seam,energy};
}
export const seamCarving:Runner=(_,p,seed)=>{
 const count=Math.max(1,Math.min(W-1,Math.round(num(p,'remove',10)))),pattern=str(p,'pattern','object');let a=picture(),w=W;if(pattern==='stripes')a=a.map((_,i)=>(Math.floor(i%W/3)%2)*200+20);const original=[...a],log=new WorldRecord('seam-carving',seed,{pixels:[...a],width:w,height:H});
 for(let k=0;k<count;k++){
  let parentId:string|undefined;
  const cut=removeSeam(a,w,H,e=>{
   const ww=e.width;
   if(e.phase==='energy'){
    log.add({phase:`第${k+1}条·能量`,ruleId:'seam-energy',action:'重新计算当前图片的局部变化',explanation:'能量等于左右亮度差绝对值加上下亮度差绝对值。边界夹到最近像素。每删一条缝都重新计算；低能量只是梯度小，不代表语义不重要。',calculation:{formula:'E=|右−左|+|下−上|',values:{'当前宽度':ww,'高度':H,'第一个像素':a[0]},result:e.energy[0]}},image(e.energy,ww,H,'局部梯度能量'),{energy:[...e.energy],width:ww,cut:k+1});parentId=log.recorder.trace.events.at(-1)!.id;
   }else if(e.phase==='row'){
    const y=e.row!,representative=e.choices![Math.floor(ww/2)],x=representative.x,terms=representative.costs;
    log.add({parentId,phase:`第${k+1}条·第${y}行动态规划`,ruleId:'seam-dp',action:`这一行每个像素比较上一行最多三个前驱`,explanation:'同一行的所有格只依赖上一行，按同一规则批量更新。候选限左上、正上、右上；取最小累计代价加本格能量。平局优先正上，再左上，再右上。完整本行候选与前驱都保存在状态。',calculation:{formula:'D[y,x]=E[y,x]+min(D[y−1,x−1],D[y−1,x],D[y−1,x+1])',values:{'示例x':x,y,'本格能量':e.energy[y*ww+x],'最小前驱代价':Math.min(...terms)},result:e.cost[y*ww+x]},candidates:representative.columns.map((column,j)=>({target:'上一行列 '+column,status:column===representative.selected?'chosen':'rejected',reason:column===representative.selected?'代价最小，平局采用正上/左上/右上顺序。':'代价更高或平局优先级较晚。',values:{'累计代价':terms[j]}}))},{kind:'bars',values:[...terms,e.energy[y*ww+x],e.cost[y*ww+x]],labels:[...representative.columns.map(column=>'前驱'+column),'本格能量','累计'],title:`第${y}行，示例列${x}`},{[`costRow:${y}`]:e.cost.slice(y*ww,(y+1)*ww),[`parentRow:${y}`]:e.prev.slice(y*ww,(y+1)*ww),rowChoices:e.choices!.map(c=>({x:c.x,columns:c.columns,costs:c.costs,selected:c.selected}))});
   }else if(e.phase==='bottom'){
    const last=e.cost.slice((H-1)*ww);
    log.add({parentId,phase:'选择底端',ruleId:'seam-backtrack',action:`底行最小累计代价位于列${e.x}`,explanation:'底行每个值表示从顶行到这个位置的最小累计能量。取最小值，同分取较小列号，接着沿保存的前驱向上走。',calculation:{formula:'底端=argmin D[最后一行,x]',values:{'选中列':e.x!},result:last[e.x!]},candidates:last.map((v,x)=>({target:'底行列 '+x,status:x===e.x?'chosen':'rejected',reason:x===e.x?'累计代价最小，同分取较小列号。':'代价较大或同分列号较晚。',values:{'累计代价':v}}))},{kind:'bars',values:last,active:[e.x!],title:'所有可能缝底端的累计能量'},{bottom:e.x!,seamEnergy:last[e.x!]});
   }else{
    const pixels=rgba(a);e.seam!.forEach((x,y)=>{if(x<0)return;const i=(y*ww+x)*4;pixels[i]=246;pixels[i+1]=105;pixels[i+2]=143;});
    log.add({parentId,phase:'按前驱回溯',ruleId:'seam-backtrack',action:`回到第${e.row}行的列${e.x}`,explanation:e.row===0?'已回溯到顶行，这些相邻行列号最多相差1，组成一条完整竖直接缝。':'读取动态规划已经保存的前驱，而不是重新随意找一个小能量像素。相邻行只能从三个合法前驱中衔接。',calculation:{formula:'上一行列号=prev[当前行,当前列]',values:{'当前行':e.row!,'当前列':e.x!},result:e.row===0?'已到顶行':e.prev[e.row!*ww+e.x!]}},{kind:'image',cols:ww,rows:H,pixels},{partialSeam:[...e.seam!]});
   }
  });
  a=cut.pixels;w--;
  log.add({parentId,phase:'删除并继续',ruleId:'seam-remove',action:`每行删除缝上的一个像素，宽度变为${w}`,explanation:'删除后把每行剩余像素左移连接，下一次在新图片上重算能量。单条缝由动态规划精确最小化当前能量，多次贪心删除不保证整体视觉损失最小。',calculation:{formula:'新宽度=旧宽度−1；删除像素数=高度',values:{'旧宽度':w+1,'高度':H,'本条总能量':cut.energy},result:w}},image(a,w,H),{pixels:[...a],width:w,seam:cut.seam});
 }
 log.frames[log.frames.length-1].secondaryScene=image(original,W,H,'原图');
 return log.finish('按当前梯度能量用行动态规划找最低代价竖直缝，回溯后逐条删除。低梯度不是语义重要性，多次删除可能扭曲主体。',{'原宽度':W,'新宽度':w,'移除像素':count*H},'每行DP作为同步向量步骤：完整保留这一行所有像素候选代价和前驱，公式以中间列示例；回溯逐行记录，无跳过前驱。');
};
