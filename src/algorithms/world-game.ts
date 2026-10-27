import type {Runner,Frame,Params,Scene} from '../engine/types';
import {TraceRecorder,type TeachingValue} from '../engine/teaching';
import {rng,num,str,round,frame,result} from '../engine/utils';
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function winner(b:string[]){for(const [a,c,d] of wins)if(b[a]!=='.'&&b[a]===b[c]&&b[c]===b[d])return b[a];return b.includes('.')?'':'draw';}
const other=(s:string)=>s==='X'?'O':'X';
function board(p:Params){const b=str(p,'board','XX.OO....').toUpperCase().replace(/\s/g,'').split('');if(b.length!==9||b.some(s=>!['X','O','.'].includes(s)))throw new Error('棋盘请输入9个字符：X、O、.；点表示空位。');const x=b.filter(v=>v==='X').length,o=b.filter(v=>v==='O').length;if(x<o||x>o+1)throw new Error('轮流落子时，X数量应等于O或比O多1。');const wx=wins.some(line=>line.every(i=>b[i]==='X')),wo=wins.some(line=>line.every(i=>b[i]==='O'));if((wx&&wo)||(wx&&x!==o+1)||(wo&&x!==o))throw new Error('棋盘不是合法终局：请检查双方数量和连线。');return{b,player:x===o?'X':'O'};}
const boardScene=(b:string[],active=-1):Scene=>({kind:'grid',rows:3,cols:3,cells:b.map((v,i)=>i===active?3:v==='X'?4:v==='O'?5:0),cellLabels:b.map(v=>v==='.'?'':v)});
export function minimaxValue(b:string[],turn:string,root:string,depth:number):number{const w=winner(b);if(w)return w==='draw'?0:w===root?100+depth:-100-depth;if(depth===0){let score=0;for(const line of wins){const marks=line.map(i=>b[i]);if(!marks.includes(other(root)))score+=marks.filter(v=>v===root).length;if(!marks.includes(root))score-=marks.filter(v=>v===other(root)).length;}return score;}const scores:number[]=[];for(let i=0;i<9;i++)if(b[i]==='.'){b[i]=turn;scores.push(minimaxValue(b,other(turn),root,depth-1));b[i]='.';}return turn===root?Math.max(...scores):Math.min(...scores);}

export const minimax:Runner=(_,p,seed)=>{
 const {b,player}=board(p),depth=Math.max(1,Math.round(num(p,'depth',9))),frames:Frame[]=[],rec=new TraceRecorder('minimax',seed,{rootBoard:b.join(''),player,depth}),memo=new Map<string,{value:number;eventId:string}>();let calls=0,hits=0;
 const evaluate=(position:string[],turn:string,remaining:number,parentId?:string):number=>{
  calls++;const state=position.join(''),key=state+'/'+turn+'/'+remaining,terminal=winner(position),cached=memo.get(key);
  if(cached){hits++;rec.add({parentId,phase:'复用同一局面',ruleId:'minimax-branch',action:'同棋盘、同执子、同剩余层数，复用已算评价',explanation:`缓存键${key}完全相同，直接使用事件${cached.eventId}已算出的值${cached.value}，不是跳过未知分支。`,frameIndex:frames.length,scene:boardScene(position),calculation:{formula:'相同棋盘+轮到谁+剩余深度 → 相同minimax值',values:{'已算事件':cached.eventId,'剩余深度':remaining},result:cached.value}},{currentBoard:state,currentValue:cached.value});return cached.value;}
  if(terminal||remaining===0){
   const value=minimaxValue([...position],turn,player,remaining),lineScores=wins.map(line=>{const marks=line.map(i=>position[i]);return(!marks.includes(other(player))?marks.filter(v=>v===player).length:0)-(!marks.includes(player)?marks.filter(v=>v===other(player)).length:0);});
   const id=rec.add({parentId,phase:terminal?'到达真实终局':'达到深度上限',ruleId:'minimax-leaf',action:terminal?`终局结果：${terminal}`:'只看这么多层，使用开放连线启发分',explanation:terminal?`和局0；根玩家赢为100+剩余深度，输为−100−剩余深度。较早获胜得更高分，较早失败更低。`:'还未终局，但搜索深度用完。对每条未被对方占据的连线累计己方棋子数，再减对方相应分；它可能漏掉更远威胁。',frameIndex:frames.length,scene:boardScene(position),calculation:{formula:terminal?'和局0；我方胜100+d；对方胜−100−d':'启发分=己方开放连线棋子数−对方开放连线棋子数',values:{'剩余深度':remaining,'结果':terminal||'未结束'},result:value}},{currentBoard:state,currentValue:value,terminal:terminal||null,lineScores:terminal?[]:lineScores});memo.set(key,{value,eventId:id});return value;
  }
  const opening=rec.add({parentId,phase:'展开合法走法',ruleId:'minimax-branch',action:`轮到${turn}，检查每个空格`,explanation:turn===player?'这层是根玩家行动，会选择子分支中的最大值。':'这层是对手行动，假设对手尽力让根玩家收益最低，所以选择最小值。',frameIndex:frames.length,scene:boardScene(position)},{currentBoard:state,currentTurn:turn,currentDepth:remaining});
  const choices:{move:number;value:number}[]=[];
  for(let i=0;i<9;i++)if(position[i]==='.'){
   const child=[...position];child[i]=turn;choices.push({move:i,value:evaluate(child,other(turn),remaining-1,opening)});
  }
  const value=turn===player?Math.max(...choices.map(c=>c.value)):Math.min(...choices.map(c=>c.value)),selected=choices.find(c=>c.value===value)!;
  const id=rec.add({parentId:opening,phase:'向上回传评价',ruleId:'minimax-branch',action:`${turn===player?'我方取最大':'对手取最小'}，选择第${selected.move+1}格`,explanation:'所有合法子分支已算出，按当前执子方取最大或最小。相同评价保留格号较小者。这个回传值供上一层使用，不是已经真的下了这一手。',frameIndex:frames.length,scene:boardScene(position,selected.move),calculation:{formula:turn===player?'V=max 子分支V':'V=min 子分支V',values:{'轮到':turn,'子分支数':choices.length},result:value},candidates:choices.map(c=>({target:'第'+(c.move+1)+'格',status:c.move===selected.move?'chosen':'rejected',reason:c.move===selected.move?'符合本层最大/最小原则，同分取较小格号。':'本层评价不优或同分格号较晚。',values:{'回传评价':c.value}}))},{currentBoard:state,currentValue:value,chosen: selected.move});memo.set(key,{value,eventId:id});return value;
 };
 if(winner(b)){evaluate([...b],player,depth);frames.push(frame(boardScene(b),'棋局已结束，不再选择落子。'));return {...result(frames,'终局无需继续搜索。',{'结果':winner(b)}),trace:rec.trace};}
 const choices:{move:number;value:number}[]=[];
 for(let i=0;i<9;i++)if(b[i]==='.'){
  const child=[...b];child[i]=player;const value=evaluate(child,other(player),depth-1);choices.push({move:i,value});frames.push({scene:boardScene(child,i),secondaryScene:{kind:'bars',values:choices.map(c=>c.value),labels:choices.map(c=>'第'+(c.move+1)+'格')},caption:`假设${player}下在第${i+1}格，回传评价为${value}。`});
 }
 const best=Math.max(...choices.map(c=>c.value)),selected=choices.find(c=>c.value===best)!;b[selected.move]=player;
 const finalId=rec.add({phase:'根节点决策',ruleId:'minimax-choose',action:`实际建议第${selected.move+1}格`,explanation:'根玩家在所有候选回传值中取最大，同分选较小格号。搜索到终局才有该棋局内的最优应对意义；截止启发分不保证看见更远威胁。',frameIndex:frames.length,scene:boardScene(b,selected.move),calculation:{formula:'根节点选择=argmax 各合法落子的minimax值',values:{'搜索深度':depth,'计算调用':calls,'缓存命中':hits},result:best},candidates:choices.map(c=>({target:'第'+(c.move+1)+'格',status:c.move===selected.move?'chosen':'rejected',reason:c.move===selected.move?'根层评价最大，同分选较小格号。':'评价较低或同分格号较晚。',values:{'评价':c.value}}))},{finalBoard:b.join(''),best,move:selected.move});
 frames.push({...frame(boardScene(b,selected.move),`选择第${selected.move+1}格。`),eventId:finalId});
 rec.trace.coverageNote='完整记录实际递归展开、终局/截止评价及回传；相同棋盘/轮到方/剩余深度用缓存，命中事件明确链接已算评价。';
 return {...result(frames,depth>=b.filter(v=>v==='.').length+1?'已覆盖终局，评价假设双方都最优应对；相同局面使用精确缓存。':'只搜索有限深度，开放连线启发评分可能漏掉远处威胁。',{'下一步':selected.move+1,'执子':player,'评价':best}),trace:rec.trace};
};

interface Tree {id:number;b:string[];turn:string;parent:Tree|null;move:number;children:Tree[];untried:number[];visits:number;value:number;}
export const mcts:Runner=(_,p,seed)=>{
 const {b,player}=board(p),random=rng(seed),iterations=Math.max(1,Math.round(num(p,'iterations',400))),explore=num(p,'explore',1.4),frames:Frame[]=[],rec=new TraceRecorder('mcts',seed,{rootBoard:b.join(''),N0:0,W0:0});let nodeId=0;
 const make=(bb:string[],turn:string,parent:Tree|null,move:number):Tree=>({id:nodeId++,b:bb,turn,parent,move,children:[],untried:winner(bb)?[]:bb.map((v,i)=>v==='.'?i:-1).filter(v=>v>=0),visits:0,value:0}),root=make(b,player,null,-1);
 if(winner(b)){rec.add({phase:'初始终局',ruleId:'mcts-rollout',action:'棋盘已结束，无需模拟',explanation:'胜负规则已经判定终局，不能继续在已结束棋盘上落子。',frameIndex:0,scene:boardScene(b)},{terminal:winner(b)});frames.push(frame(boardScene(b),'棋局已经结束。'));return{...result(frames,'请选择尚未结束的局面。',{'结果':winner(b)}),trace:rec.trace};}
 for(let i=0;i<iterations;i++){
  let n=root;const group=rec.add({phase:'模拟轮初始化',ruleId:'mcts-select',action:`第${i+1}次模拟，从根开始`,explanation:'先沿已有树选择，再扩展一个未试动作，随机模拟到终局，最后把结果沿祖先路径记账。',frameIndex:frames.length,scene:boardScene(b)},{iteration:i+1,selectedNode:0});
  while(!n.untried.length&&n.children.length){
   const choices=n.children.map(c=>{const empirical=c.value/c.visits,exploitation=n.turn===player?empirical:1-empirical,bonus=explore*Math.sqrt(Math.log(n.visits+1)/c.visits);return{node:c,empirical,exploitation,bonus,score:exploitation+bonus};}),chosen=choices.reduce((a,c)=>c.score>a.score?c:a);
   rec.add({parentId:group,phase:'树内选择',ruleId:'mcts-select',action:`节点${n.id}选择落子第${chosen.node.move+1}格的分支`,explanation:`轮到${n.turn}。${n.turn===player?'根玩家使用平均得分。':'对手用1−根玩家平均得分，从对手角度选择。'}加上访问少的探索奖励，取总分最大，等分按插入先后。`,frameIndex:frames.length,scene:boardScene(n.b),calculation:{formula:'选择分=当前执子视角的平均得分+c√(ln(N父+1)/N子)',values:{'父访问数':n.visits,'探索系数':explore,'所选均值':chosen.exploitation,'探索项':chosen.bonus},result:chosen.score},candidates:choices.map(c=>({target:'第'+(c.node.move+1)+'格',status:c===chosen?'chosen':'rejected',reason:c===chosen?'选择分最高，同分取较早插入分支。':'选择分较低或同分插入较晚。',values:{'访问':c.node.visits,'平均得分':c.exploitation,'选择分':c.score}}))},{selectedNode:chosen.node.id});n=chosen.node;
  }
  if(n.untried.length){
   const draw=random(),index=Math.floor(draw*n.untried.length),available=[...n.untried],move=n.untried.splice(index,1)[0],bb=[...n.b];bb[move]=n.turn;const child=make(bb,other(n.turn),n,move);n.children.push(child);
   rec.add({parentId:group,phase:'扩展',ruleId:'mcts-expand',action:`从尚未试过的动作中抽到第${move+1}格`,explanation:'只扩展一个未试动作，按均匀随机抽数选择，并建立父子连接。扩展本身没有提前知道胜负。',frameIndex:frames.length,scene:boardScene(bb,move),calculation:{formula:'选项索引=floor(均匀随机数×未试动作数)',values:{'随机数':draw,'未试动作数':available.length},result:index}}, {[`node${child.id}`]:{board:bb.join(''),parent:n.id,move},selectedNode:child.id});n=child;
  }
  const sim=[...n.b];let turn=n.turn,w=winner(sim),rolloutStep=0;
  while(!w){
   const empty=sim.map((v,j)=>v==='.'?j:-1).filter(v=>v>=0),draw=random(),move=empty[Math.floor(draw*empty.length)];sim[move]=turn;rolloutStep++;
   rec.add({parentId:group,phase:'随机模拟',ruleId:'mcts-rollout',action:`模拟第${rolloutStep}手，${turn}随机放第${move+1}格`,explanation:'在当前合法空格中均匀抽一个动作，直到胜负或和局。这里用随机对局作估计，不是假设模拟中的每手都最优。',frameIndex:frames.length,scene:boardScene(sim,move),calculation:{formula:'模拟动作=合法动作[floor(u×合法数)]',values:{u:draw,'合法动作数':empty.length},result:move+1}}, {simulationBoard:sim.join(''),rolloutStep});turn=other(turn);w=winner(sim);
  }
  const value=w==='draw'?.5:w===player?1:0,path:Tree[]=[];let up:Tree|null=n;const values:Record<string,TeachingValue>={outcome:w,reward:value};
  while(up){up.visits++;up.value+=value;values['N'+up.id]=up.visits;values['W'+up.id]=up.value;path.push(up);up=up.parent;}
  rec.add({parentId:group,phase:'回传记账',ruleId:'mcts-backup',action:`模拟结果${w}，沿${path.length}个节点回传`,explanation:`从根玩家角度胜1、和0.5、负0。本次得分${value}对经过的每个祖先都让访问数加1、累计得分加${value}；未经过的分支不更新。对手视角的反转只在下次树选择时进行。`,frameIndex:frames.length,scene:{kind:'matrix',matrix:path.map(v=>[v.visits,v.value]),rowLabels:path.map(v=>'节点'+v.id),columnLabels:['访问N','累计W']},calculation:{formula:'路径上每个节点：N+=1；W+=本次根玩家得分',values:{'结果':w,'回传节点数':path.length},result:value}},values);
  if(i%Math.max(1,Math.floor(iterations/25))===0||i===iterations-1){const sorted=[...root.children].sort((a,b)=>a.move-b.move),candidate=[...root.children].sort((a,b)=>b.visits-a.visits)[0],display=[...b];display[candidate.move]=player;frames.push({scene:boardScene(display,candidate.move),secondaryScene:{kind:'bars',values:sorted.map(c=>c.visits),labels:sorted.map(c=>'第'+(c.move+1)+'格')},caption:`已完成${i+1}次模拟，当前最多访问分支为第${candidate.move+1}格。`});}
 }
 const best=[...root.children].sort((a,b)=>b.visits-a.visits)[0];
 rec.add({phase:'预算结束',ruleId:'mcts-finish',action:`按访问次数建议第${best.move+1}格`,explanation:`固定${iterations}次模拟结束。最终选访问最多的根子节点，并不直接选最后一次UCB分最高者；同次数取较早插入者。估计得分不是面对真实对手的胜率保证。`,frameIndex:frames.length-1,scene:boardScene(b,best.move),calculation:{formula:'最终建议=argmax 根子节点访问次数',values:{'访问次数':best.visits,'累计得分':best.value},result:best.value/best.visits},candidates:root.children.map(c=>({target:'第'+(c.move+1)+'格',status:c===best?'chosen':'rejected',reason:c===best?'访问最多，同分取较早插入分支。':'访问较少或同分插入较晚。',values:{'访问':c.visits,'平均得分':c.value/c.visits}}))},{recommended:best.move,rootVisits:root.visits});
 rec.trace.coverageNote='按每次模拟的初始化事件分层；实际选择、扩展、逐手rollout与整条祖先路径的N/W更新全部记录。主动画仅保留每阶段建议，详细事件使用各自真实棋盘。';
 return {...result(frames,'UCT风格的蒙特卡洛树搜索：有限预算与随机rollout给经验性选择；没有对真实对手的胜率保证。',{'建议位置':best.move+1,'模拟次数':iterations,'该分支估计得分':round(best.value/best.visits,3)}),trace:rec.trace};
};
