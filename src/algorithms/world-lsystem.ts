import type {Runner,Frame,Scene} from '../engine/types';
import {TraceRecorder} from '../engine/teaching';
import {num,str,palette,result,frame} from '../engine/utils';
type Point={x:number;y:number};
export const lsystem:Runner=(_,p,seed)=>{const depth=Math.max(0,Math.round(num(p,'depth',4))),angle=num(p,'angle',25),rule=str(p,'rule','branch')==='binary'?'F[+F][-F]':'F[+F]F[-F]F',frames:Frame[]=[],log=new TraceRecorder('lsystem',seed,{sequence:'F',rule,angle,depth});let sequence='F',finalCount=0;
 for(let d=0;d<=depth;d++){
  const previous=sequence;if(d>0)sequence=sequence.replaceAll('F',rule);const parentId=log.add({frameIndex:Math.max(0,frames.length-1),phase:`第${d}代·重写`,ruleId:'lsystem-rewrite',action:d===0?'从公理F开始':'同时替换这一代每个F',explanation:d===0?'F是向前画一段；+和−转向；方括号保存和恢复位置方向。':'只替换上一代的F，新产生的F留到下一代才再替换。其他符号保持不变；不是一轮内无限展开。',calculation:{formula:'F → '+rule,values:{'上一代长度':previous.length,'上一代F数':previous.split('F').length-1,'本代符号数':sequence.length},result:sequence.split('F').length-1},scene:{kind:'text',text:['F → '+rule,sequence.length<90?sequence:sequence.slice(0,80)+'…',`本代共${sequence.length}个符号`],title:`第${d}代的生长指令`}},{sequence,generation:d});
  let x=0,y=0,a=-Math.PI/2;const stack:{x:number;y:number;a:number}[]=[],segments:{points:Point[];color:string}[]=[];
  for(let i=0;i<sequence.length;i++){const c=sequence[i],before={x,y,a},oldDepth=stack.length;let action='',ruleId='lsystem-draw';
   if(c==='F'){const next={x:x+Math.cos(a),y:y+Math.sin(a)};segments.push({points:[{x,y},next],color:palette[0]});x=next.x;y=next.y;action='沿当前朝向向前画一单位';}
   else if(c==='+'){a+=angle*Math.PI/180;action='按屏幕坐标顺时针转指定角度';}
   else if(c==='-'){a-=angle*Math.PI/180;action='按屏幕坐标逆时针转指定角度';}
   else if(c==='['){stack.push({x,y,a});action='把当前位置与方向压入栈';ruleId='lsystem-stack';}
   else if(c===']'){const saved=stack.pop();if(!saved)throw new Error('L-system 方括号不匹配');({x,y,a}=saved);action='恢复最近保存的分叉点，不画回程线';ruleId='lsystem-stack';}
   log.add({parentId,frameIndex:Math.max(0,frames.length-1),phase:`第${d}代·符号${i+1}/${sequence.length}`,ruleId,action:`${c}：${action}`,explanation:c==='F'?'F按当前位置和方向画直线，不选最近节点。每个符号严格按程序从左到右执行。':c==='['?'栈保存分叉前的状态，方便稍后画另一根枝条。':c===']'?'后保存先恢复；恢复位置不代表沿线移动或生长。':'正角度在本画布向下为正的坐标中顺时针；转向只改变方向，不改变位置。',calculation:{formula:c==='F'?'x新=x+cos(a)；y新=y+sin(a)':c==='['?'push(x,y,a)':c===']'?'(x,y,a)=pop()':'a新=a±角度×π/180',values:{'符号':c,'旧x':before.x,'旧y':before.y,'旧角度°':before.a*180/Math.PI,'旧栈深':oldDepth},result:c==='F'?`(${x},${y})`:c==='['||c===']'?stack.length:a*180/Math.PI},scene:{kind:'matrix',matrix:[[before.x,before.y,before.a*180/Math.PI],[x,y,a*180/Math.PI]],rowLabels:['执行前','执行后'],columnLabels:['x','y','角度°'],title:`指令${c}：${action}`}},{symbolIndex:i,symbol:c,x,y,heading:a,stack:stack.map(s=>({...s})),segmentCount:segments.length});
  }
  const all=segments.flatMap(s=>s.points),xs=all.map(p=>p.x),ys=all.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),rangeX=Math.max(...xs)-minX||1,rangeY=Math.max(...ys)-minY||1,scale=85/Math.max(rangeX,rangeY),paths=segments.map(s=>({...s,points:s.points.map(p=>({x:50+(p.x-minX-rangeX/2)*scale,y:92+(p.y-minY-rangeY)*scale}))})),scene:Scene={kind:'world',paths,title:`第${d}代：${segments.length}段`};finalCount=segments.length;
  const id=log.add({parentId,frameIndex:frames.length,phase:`第${d}代·画完`,ruleId:'lsystem-finish',action:'全部指令已执行，等比例放入画布',explanation:d===depth?'达到预设展开深度。相似分叉来自同一重写规则重复出现，不是植物生理模拟。':'这一代画完后才开始下一次重写；画布缩放仅用于展示，不改变枝条之间的角度和长度比例。'},{rawSegments:segments.map(s=>s.points.map(p=>[p.x,p.y])),scale,segmentCount:segments.length});frames.push({...frame(scene,`规则${rule}，转角${angle}°；按符号顺序画出每一条枝。`,{'线段数':segments.length}),eventId:id});
 }
 log.trace.coverageNote='每代同时重写一次，随后每个F、转向、入栈、出栈指令逐一记录。主帧展示整代，指令事件展示真实位置、朝向与栈变化；没有把整棵树当作单步结果。';return{...result(frames,'L-system先重写符号，再让画笔逐条执行。分叉靠保存与恢复状态产生，复杂重复来自简单规则的迭代。',{'展开次数':depth,'线段数':finalCount,'分叉次数':sequence.split('[').length-1}),trace:log.trace};
};
