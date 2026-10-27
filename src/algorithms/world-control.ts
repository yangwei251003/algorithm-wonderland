import {qlearning} from './world-qlearning';
import {rrt,potential,purePursuit} from './world-navigation';
import {kalman,particleFilter} from './world-filter';
import {createPid} from './world-pid';
import type {Runner,Scene} from '../engine/types';
import {clamp,round,palette} from '../engine/utils';
function droneScene(height:number,target:number,wind:number,tick:number):Scene{
 const hy=clamp(88-height*.76,7,90),ty=88-target*.76;
 const paths:NonNullable<Scene['paths']>=[
  {points:[{x:16,y:88},{x:92,y:88}],color:'#46636d'},
  {points:[{x:16,y:12},{x:16,y:88}],color:'#37505e'},
  {points:[{x:18,y:ty},{x:91,y:ty}],color:palette[1],dashed:true},
  {points:[{x:18,y:hy},{x:44,y:hy}],color:'#4a817a',dashed:true},
  {points:[{x:44,y:hy-3},{x:56,y:hy+3}],color:palette[0]},
  {points:[{x:44,y:hy+3},{x:56,y:hy-3}],color:palette[0]},
 ];
 const nodes:NonNullable<Scene['nodes']>=[{x:70,y:ty-2,r:0,label:`目标 ${target}`,color:palette[1]},{x:61,y:hy+2,r:0,label:`高度 ${round(height,1)}`,color:palette[0]}];
 for(const value of [0,20,40,60,80,100]){const y=88-value*.76;paths.push({points:[{x:15,y},{x:17,y}],color:'#5a7c85'});nodes.push({x:8,y:y+1,r:0,label:String(value)});}
 for(const dx of [-6,6])for(const dy of [-3,3]){const x=50+dx,y=hy+dy;paths.push({points:Array.from({length:17},(_,i)=>({x:x+3.6*Math.cos(i/16*Math.PI*2),y:y+1.8*Math.sin(i/16*Math.PI*2)})),color:'#78edd0'});const angle=tick*.7;paths.push({points:[{x:x+3*Math.cos(angle),y:y+1.4*Math.sin(angle)},{x:x-3*Math.cos(angle),y:y-1.4*Math.sin(angle)}],color:'#b6ffe9'});}
 if(wind)for(const y of [53,57,61]){paths.push({points:[{x:72,y},{x:87,y},{x:84,y:y-2}],color:palette[2]});nodes.push({x:72,y:48,r:0,label:'风扰动'});}
 return{kind:'world',title:'无人机悬停 · 一维教学模拟',nodes,paths,polygons:[{points:[{x:16,y:89},{x:92,y:89},{x:92,y:97},{x:16,y:97}],color:'#142d36'},{points:[{x:47.5,y:hy-2.2},{x:52.5,y:hy-2.2},{x:53.4,y:hy+2.2},{x:46.6,y:hy+2.2}],color:palette[0]}],note:wind?'阵风正在施加扰动，观察控制器如何恢复目标高度。':'橙色虚线是目标高度；飞行器位置由真实模拟高度驱动。'};
}
const pid=createPid(droneScene);

export const controlRunners:Record<string,Runner>={pid,kalman,'particle-filter':particleFilter,rrt,'potential-field':potential,'pure-pursuit':purePursuit,qlearning};
