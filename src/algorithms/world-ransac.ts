import type {Runner,Scene} from '../engine/types';
import {rng,num,clamp,round,gaussian,palette} from '../engine/utils';
import {WorldRecord} from './world-record';
function visibleLine(slope:number,intercept:number){const candidates=[{x:0,y:intercept},{x:100,y:100*slope+intercept},...(Math.abs(slope)>1e-12?[{x:-intercept/slope,y:0},{x:(100-intercept)/slope,y:100}]:[])].filter(p=>p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100),unique=candidates.filter((p,i)=>candidates.findIndex(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-8)===i);return unique.slice(0,2);}
export const ransac:Runner=(input,p,seed)=>{
 const random=rng(seed),n=60,ratio=num(p,'outliers',30)/100,tol=num(p,'tolerance',3),iterations=Math.round(num(p,'iterations',40)),pts=input.points?.length?input.points:Array.from({length:n},()=>{const x=5+90*random();return{x,y:random()<ratio?5+90*random():clamp(20+.55*x+gaussian(random)*1.8,2,98)};});let best:number[]=[],line:number[]|null=null;
 const log=new WorldRecord('ransac',seed,{points:pts.map(v=>[v.x,v.y]),best:[],bestModel:null});
 const scene=(trial?:number[],inliers=best):Scene=>({kind:'scatter',yUp:true,nodes:pts.map((v,j)=>({...v,id:'p'+j,color:inliers.includes(j)?palette[0]:palette[3],r:1.5,label:pts.length<=12?String(j+1):undefined})),paths:[...(line?[{points:visibleLine(line[0],line[1]),color:palette[1]}]:[]),...(trial?[{points:visibleLine(trial[0],trial[1]),color:palette[3],dashed:true}]:[])],note:'实线为当前最多支持模型，虚线为本次候选；距离计算使用完整直线，画面只裁到视口。'});
 if(pts.length<2){log.add({phase:'输入检查',ruleId:'ransac-sample',action:'不足两个点，不能拟合直线',explanation:'两点模型至少需要两个不同数据位置；不凭空补一条默认直线。'},scene(),{validInput:false});return log.finish('至少提供两个点。',{'支持点':0,'总点数':pts.length,'斜率':'未得到有效模型'});}
 for(let i=0;i<iterations;i++){
  const a=Math.floor(random()*pts.length),j=Math.floor(random()*(pts.length-1)),b=j>=a?j+1:j,dx=pts[b].x-pts[a].x,dy=pts[b].y-pts[a].y,valid=Math.abs(dx)>=.0001;
  if(!valid){log.add({phase:'抽样拒绝',ruleId:'ransac-sample',action:'两点横坐标太接近，跳过此模型',explanation:'本实验只拟合y=ax+b形式，不能表示竖直线。|Δx|<0.0001时不除以接近0的数；这次尝试仍计入预算。',calculation:{formula:'有效 ⇔ |x₂−x₁|≥0.0001',values:{'点1':a+1,'点2':b+1,'Δx':dx},result:'拒绝'}},scene(),{sample:[a,b],iteration:i+1,valid:false});continue;}
  const slope=dy/dx,intercept=pts[a].y-slope*pts[a].x;
  log.add({phase:'提出模型',ruleId:'ransac-sample',action:`抽到点${a+1}与${b+1}，提出一条线`,explanation:'在不同数据编号中均匀抽两个点，只用这两个点确定斜率与截距；此时还不知道其他点是否支持。',calculation:{formula:'a=(y₂−y₁)/(x₂−x₁)；b=y₁−a x₁',values:{'x₁':pts[a].x,'y₁':pts[a].y,'x₂':pts[b].x,'y₂':pts[b].y,'截距':intercept},result:slope}},scene([slope,intercept]),{sample:[a,b],candidateModel:[slope,intercept],iteration:i+1,valid:true});
  const distances=pts.map(v=>Math.abs(slope*v.x-v.y+intercept)/Math.hypot(slope,1)),inliers=distances.map((v,j)=>v<=tol?j:-1).filter(j=>j>=0),oldCount=best.length,improved=inliers.length>best.length;if(improved){best=inliers;line=[slope,intercept];}
  log.add({phase:'计数与保留',ruleId:'ransac-consensus',action:improved?'支持者严格更多，换成这个模型':'支持者没有更多，保留已有模型',explanation:`对全部${pts.length}个点计算到完整直线的垂直距离，距离≤${tol}为内点。本次${inliers.length}人支持，旧最好${oldCount}。同支持数保留较早模型；本版不对所有内点再做最小二乘重拟合。`,calculation:{formula:'d=|a x−y+b|/√(a²+1)；内点⇔d≤容差',values:{'斜率':slope,'截距':intercept,'容差':tol,'旧最好支持数':oldCount},result:inliers.length},candidates:distances.map((d,j)=>({target:'点 '+(j+1),status:d<=tol?'chosen':'rejected',reason:d<=tol?'到候选线距离在容差内，计为支持。':'超过容差，本次不计入支持。',values:{'距离':d}}))},scene([slope,intercept],inliers),{distances,inliers,best:[...best],bestModel:line,improved});
 }
 log.add({phase:'预算结束',ruleId:'ransac-finish',action:line?'返回预算内支持最多的候选':'全部采样退化，未获得有效模型',explanation:'固定尝试次数结束。没有穷举所有模型，也没有保证找到真实直线；容差过大可能支持错误线，尝试过少可能错过好线。',calculation:{formula:'当前最好=已尝试有效模型中支持数最多者',values:{'尝试预算':iterations,'总点数':pts.length,'容差':tol},result:best.length}},scene(),{complete:true});
 return log.finish('两点RANSAC直线教学：均匀不放回抽样、垂直距离判内点、同分保留较早模型，无内点重拟合；仅支持非竖直线。',{'支持点':best.length,'总点数':pts.length,'斜率':line?round(line[0]):'未得到有效模型'});
};
