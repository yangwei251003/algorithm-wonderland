import type {Runner,Scene} from '../engine/types';
import {rng,num,str} from '../engine/utils';
import {WorldRecord} from './world-record';
export function lifeUpdate(cells:number[],cols:number,rows:number,wrap=true){const counts=cells.map((_,i)=>{const x=i%cols,y=Math.floor(i/cols);let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy;if(wrap){xx=(xx+cols)%cols;yy=(yy+rows)%rows;}if(xx>=0&&xx<cols&&yy>=0&&yy<rows)sum+=cells[yy*cols+xx];}return sum;});return{counts,next:cells.map((v,i)=>counts[i]===3||(v===1&&counts[i]===2)?1:0)};}
export function lifeStep(cells:number[],cols:number,rows:number,wrap=true){return lifeUpdate(cells,cols,rows,wrap).next;}
export const life:Runner=(_,p,seed)=>{const random=rng(seed),cols=40,rows=24,pattern=str(p,'pattern','glider'),steps=Math.max(0,Math.round(num(p,'steps',90))),density=num(p,'density',.22);let cells=Array(cols*rows).fill(0);
 if(pattern==='random')cells=cells.map(()=>random()<density?1:0);else if(pattern==='blinker')[0,1,2].forEach(x=>cells[12*cols+18+x]=1);else [[1,0],[2,1],[0,2],[1,2],[2,2]].forEach(([x,y])=>cells[(y+10)*cols+x+16]=1);
 const log=new WorldRecord('life',seed,{cells,cols,rows,generation:0}),scene=(generation:number,focus?:number):Scene=>({kind:'grid',rows,cols,cells:cells.map(v=>v?2:0),palette:['#12242e','#36606a','#78edd0'],title:`第${generation}代`,active:focus===undefined?[]:[focus]});
 log.add({phase:'初始条件',ruleId:'life-rule',action:'八邻域、循环边界、同步更新',explanation:'每格只数周围8格，不数自己。死格恰好3邻居出生；活格有2或3邻居存活；其余变死。所有判断读取上一代，没有先感染谁、后感染谁。'},scene(0),{}, {'存活格子':cells.reduce((a,b)=>a+b,0)});
 for(let t=1;t<=steps;t++){const before=cells,{counts,next}=lifeUpdate(before,cols,rows),births:number[]=[],deaths:number[]=[],survive:number[]=[];next.forEach((v,i)=>{if(v&&!before[i])births.push(i);else if(!v&&before[i])deaths.push(i);else if(v)survive.push(i);});const i=births[0]??deaths[0]??survive[0]??0,n=counts[i];cells=next;
  log.add({phase:`第${t}代`,ruleId:'life-update',action:'同时应用同一规则到所有格',focus:[String(i)],explanation:`示例格${i}：原来${before[i]?'活':'死'}，8邻域有${n}个活格，所以${next[i]?'下一代为活':'下一代为死'}。这一代${births.length}格出生、${deaths.length}格死亡；所有格的邻居数和结果都已保存。`,calculation:{formula:'新活=(邻居数=3) 或 (原活且邻居数=2)',values:{'示例格':i,'原活':before[i],'活邻居':n},result:next[i]},candidates:[{target:'下一代为活',status:next[i]?'chosen':'rejected',reason:next[i]?'满足B3或S23。':'不满足出生或存活条件。'},{target:'下一代为死',status:next[i]?'rejected':'chosen',reason:next[i]?'出生/存活条件已满足。':'过疏、过密或未达到出生条件。'}]},scene(t,i),{generation:t,counts,cells,births,deaths,survive},{'存活格子':cells.reduce((a,b)=>a+b,0)});
 }
 const population=cells.reduce((a,b)=>a+b,0);log.add({phase:'观察结束',ruleId:'life-stop',action:`观察到第${steps}代`,explanation:'停止原因是设定的代数预算，不是证明图案已经稳定。相同初态与规则总产生相同后续；滑翔、振荡和消亡都来自同一规则。'},scene(steps),{population});
 return log.finish('生命游戏用确定规则同步更新八邻域。复杂形状来自简单局部规则，不是某一格有预设目标。',{'最后存活':population,'演化代数':steps,'边界':'循环边界'},'每代是一条同步向量事件，保存全部960格的邻居数、出生/存活/死亡名单与新状态，不依照显示顺序更新。');
};
