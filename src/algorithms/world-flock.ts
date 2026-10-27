import type {Runner,Scene} from '../engine/types';
import {rng,num,clamp,round,palette} from '../engine/utils';
import {WorldRecord} from './world-record';
type Bird={x:number;y:number;vx:number;vy:number};
export function flockScene(birds:Bird[],obstacle:boolean,title:string):Scene{return{kind:'world',title,polygons:[...(obstacle?[{points:Array.from({length:32},(_,i)=>({x:50+12*Math.cos(i/32*2*Math.PI),y:50+12*Math.sin(i/32*2*Math.PI)})),color:'#263f4d'}]:[]),...birds.map((b,i)=>{const a=Math.atan2(b.vy,b.vx),c=Math.cos(a),s=Math.sin(a);return{points:[{x:b.x+2.2*c,y:b.y+2.2*s},{x:b.x-1.5*c-s,y:b.y-1.5*s+c},{x:b.x-.7*c,y:b.y-.7*s},{x:b.x-1.5*c+s,y:b.y-1.5*s-c}],color:palette[i%3]};})],nodes:obstacle?[{id:'obstacle',x:50,y:50,r:0,color:'#263f4d',label:'障碍'}]:[],paths:birds.map(b=>({points:[{x:b.x-b.vx*2,y:b.y-b.vy*2},{x:b.x,y:b.y}],color:'#78edd080'}))};}
export const boids:Runner=(_,p,seed)=>{
 const random=rng(seed),count=Math.max(2,Math.round(num(p,'count',65))),cohesion=num(p,'cohesion',1),separation=num(p,'separation',1.2),obstacle=num(p,'obstacle',1)>0,steps=Math.max(1,Math.round(num(p,'steps',220)));
 let birds:Bird[]=Array.from({length:count},()=>({x:random()*100,y:random()*100,vx:(random()-.5)*2,vy:(random()-.5)*2}));
 const log=new WorldRecord('boids',seed,{birds,cohesion,separation,obstacle,step:0});
 for(let t=1;t<=steps;t++){
  const forces=birds.map((a,i)=>{let sx=0,sy=0,cx=0,cy=0,ax=0,ay=0;const neighbors:number[]=[],near:number[]=[];
   for(let j=0;j<birds.length;j++)if(i!==j){const b=birds[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<22&&d>.001){neighbors.push(j);cx+=b.x;cy+=b.y;ax+=b.vx;ay+=b.vy;if(d<9){near.push(j);sx-=dx/(d*d);sy-=dy/(d*d);}}}
   const n=neighbors.length,sep=[sx*.7*separation,sy*.7*separation],coh=n?[(cx/n-a.x)*.0018*cohesion,(cy/n-a.y)*.0018*cohesion]:[0,0],align=n?[(ax/n-a.vx)*.035,(ay/n-a.vy)*.035]:[0,0];
   const dx=a.x-50,dy=a.y-50,d=Math.hypot(dx,dy),avoid=obstacle&&d<20?[dx/(d||1)*(20-d)*.035,dy/(d||1)*(20-d)*.035]:[0,0];
   return{neighbors,near,sep,coh,align,avoid,fx:sep[0]+coh[0]+align[0]+avoid[0],fy:sep[1]+coh[1]+align[1]+avoid[1]};
  });
  const a=birds[0],f=forces[0],parentId=String(log.recorder.trace.events.length);
  log.add({phase:`第${t}步·计算局部规则`,ruleId:'boids-force',action:'所有鸟读取同一份旧位置与速度',explanation:'只统计距离在0.001至22内的邻居；9以内额外分离。分离、靠拢、对齐和障碍排斥相加。邻居没有先后优先级，鸟1只是数值示例；全部鸟的邻居与四项力都已保存。',calculation:{formula:'fx=分离x+靠拢x+对齐x+避障x',values:{'示例鸟':1,'邻居数':f.neighbors.length,'分离x':f.sep[0],'靠拢x':f.coh[0],'对齐x':f.align[0],'避障x':f.avoid[0]},result:f.fx},candidates:birds.slice(1).map((b,j)=>{const d=Math.hypot(b.x-a.x,b.y-a.y),chosen=f.neighbors.includes(j+1);return{target:'鸟'+(j+2),status:chosen?'chosen':'rejected',reason:chosen?(d<9?'可见且太近，同时参与分离、靠拢、对齐。':'可见，参与靠拢、对齐。'):'距离不在(0.001,22)内，不参与本鸟邻域。',values:{'距离':d}};})},flockScene(birds,obstacle,`第${t}步：先看邻居`),{forces,step:t});
  const updates=birds.map((a,i)=>{const f=forces[i],cx=clamp(f.fx,-.18,.18),cy=clamp(f.fy,-.18,.18);let vx=a.vx+cx,vy=a.vy+cy;const speed=Math.hypot(vx,vy),limited=speed>1.6,kick=speed<.3;if(limited){vx=vx/speed*1.6;vy=vy/speed*1.6;}if(kick){vx+=.02;vy+=.01;}return{cx,cy,speed,limited,kick,bird:{x:(a.x+vx+100)%100,y:(a.y+vy+100)%100,vx,vy}};});
  birds=updates.map(u=>u.bird);
  log.add({parentId,phase:`第${t}步·同步移动`,ruleId:'boids-move',action:'限制转向与速度，再一次更新全部鸟',explanation:'每轴力限在±0.18；速度过1.6按比例缩短，低于0.3时加固定小推力（不保证最低速度）。最后位置按100循环。邻居距离仍按普通平面计算，边界两侧不自动算近邻。',calculation:{formula:'v新=v旧+clip(力,−0.18,0.18)，再按规则限速；x新=(x旧+vx新+100) mod 100',values:{'示例旧x':a.x,'力x':f.fx,'限幅后力x':updates[0].cx,'新vx':birds[0].vx},result:birds[0].x}},flockScene(birds,obstacle,`第${t}步：局部动作形成群体`),{birds,updates:updates.map(({bird,...u})=>u)},{'个体数':count});
 }
 const mean=birds.reduce((sum,b,i)=>sum+Math.min(...birds.filter((_,j)=>i!==j).map(a=>Math.hypot(a.x-b.x,a.y-b.y))),0)/count;
 log.add({phase:'预算结束',ruleId:'boids-stop',action:`完成${steps}次同步更新`,explanation:'固定步数结束后统计平均最近邻距离。没有领队，也没有最优队形目标；局部规则不保证绝不碰撞。'},flockScene(birds,obstacle,'局部规则，整体涌现'),{meanNearest:mean},{'平均最近距离':round(mean)});
 return log.finish('Boids没有领队或预设整群路线。每只鸟根据邻居作出小调整，复杂群体形状由局部行为涌现。',{'个体数':count,'平均最近距离':round(mean),'边界':'位置循环；邻域普通平面'},'每步两条向量事件：全体邻居/力与全体同步移动均保存；鸟1只是公式和候选的示例，不以它代替其他鸟计算。');
};
