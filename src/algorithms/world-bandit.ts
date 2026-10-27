import type {Runner,Scene} from '../engine/types';
import {rng,num,str,round,gaussian,palette} from '../engine/utils';
import {WorldRecord} from './world-record';
function gamma(shape:number,random:()=>number):number{if(shape<1)return gamma(shape+1,random)*random()**(1/shape);const d=shape-1/3,c=1/Math.sqrt(9*d);for(;;){let x=gaussian(random),v=1+c*x;if(v<=0)continue;v=v*v*v;const u=random();if(u<1-.0331*x**4||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v;}}
const finite=(x:number)=>Number.isFinite(x)?x:'∞（尚未尝试）';

export const bandit=(method:'ucb'|'thompson'):Runner=>(_,p,seed)=>{
 const random=rng(seed),rounds=Math.round(num(p,'rounds',240)),gap=num(p,'gap',.16),change=str(p,'environment','fixed')==='change',count=[0,0,0],success=[0,0,0],names=['摊位 A','摊位 B','摊位 C'],log=new WorldRecord(method,seed,{count:[...count],success:[...success]}),cumulative:{x:number;y:number}[]=[];let reward=0,regret=0;
 const scene=(choice:number):Scene=>({kind:'bars',values:count.map((n,i)=>n?success[i]/n:0),labels:names,active:[choice],title:'经验成功率；未知真值不参与选择'});
 for(let t=0;t<rounds;t++){
  const probs=change&&t>=rounds/2?[.85,.5,.3]:[.4,.55,Math.min(.95,.55+gap)],bonus=count.map(n=>n?Math.sqrt(2*Math.log(t+1)/n):Infinity),alphas=success.map(s=>s+1),betas=count.map((n,i)=>n-success[i]+1),scores=count.map((n,i)=>{if(method==='ucb')return n?success[i]/n+bonus[i]:Infinity;const a=gamma(alphas[i],random),b=gamma(betas[i],random);return a/(a+b);}),choice=scores.indexOf(Math.max(...scores));
  log.add({phase:'比较候选',ruleId:method+'-choose',action:`第${t+1}次，选择${names[choice]}`,explanation:method==='ucb'?'每个已尝试选项的分数等于经验均值加探索奖励；未尝试视为无穷大，先轮流试过。选最大分，同分取A、B、C较早者。分数可能超过1，它不是成功概率。':'各选项从Beta(成功+1,失败+1)后验分别抽一个成功率。只比较这次抽样，选最大值，同分按A、B、C；并非永远选择后验均值最高者。',calculation:method==='ucb'?{formula:'UCB=成功/次数+√(2 ln(总次数+1)/次数)；未试为∞',values:{'成功':success[choice],'次数':count[choice],'探索奖励':finite(bonus[choice])},result:finite(scores[choice])}:{formula:'θᵢ~Beta(成功ᵢ+1,失败ᵢ+1)；选θ最大',values:{'α':alphas[choice],'β':betas[choice]},result:scores[choice]},candidates:scores.map((score,i)=>({target:names[i],status:i===choice?'chosen':'rejected',reason:i===choice?'本轮分数或抽样最大，同分取较早编号。':'本轮较小或同分顺序较晚；后续仍有机会。',values:{'用于比较的数值':finite(score),'已尝试':count[i],'成功':success[i]}}))},scene(choice),{choice,scores:scores.map(finite),alphas,betas,round:t+1});
  const outcomeDraw=random(),win=outcomeDraw<probs[choice]?1:0;count[choice]++;success[choice]+=win;reward+=win;regret+=Math.max(...probs)-probs[choice];cumulative.push({x:t+1,y:regret});
  log.add({phase:'接收反馈',ruleId:method+'-update',action:win?'实际得到一次奖励':'本次没有奖励',explanation:`只更新被选摊位的次数和成功数。${method==='thompson'?`成功会使α加1，失败会使β加1。`:'下一次将用新的平均回报与次数重算探索奖励。'}真实概率只用于生成反馈和评估遗憾，算法选择时看不到它；环境中途变化时旧经验仍被保留。`,calculation:method==='thompson'?{formula:'α=成功+1；β=次数−成功+1',values:{'次数':count[choice],'成功':success[choice],'α新':success[choice]+1},result:count[choice]-success[choice]+1}:{formula:'新经验均值=累计成功/累计尝试',values:{'成功':success[choice],'尝试':count[choice]},result:success[choice]/count[choice]}},scene(choice),{count:[...count],success:[...success],outcomeDraw,observedReward:win,cumulativeReward:reward,evaluationProbabilities:probs,regret},{'总奖励':reward,'A尝试':count[0],'B尝试':count[1],'C尝试':count[2]});
  log.frames[log.frames.length-1].secondaryScene={kind:'lines',series:[{name:'按隐藏真值评价的期望遗憾',points:[...cumulative],color:palette[1]}]};
 }
 return log.finish(`${method==='ucb'?'UCB1上置信界':'Beta-Bernoulli Thompson Sampling'}在有限${rounds}次反馈中平衡探索与收益。模拟真值不参与选择；非平稳环境中保留旧经验会拖慢适应。`,{'累计奖励':reward,'期望遗憾':round(regret),'尝试最多':'ABC'[count.indexOf(Math.max(...count))]});
};

function pick(prob:number[],draw:number){let u=draw;for(let i=0;i<prob.length;i++){u-=prob[i];if(u<=0)return i;}return prob.length-1;}
export const regret:Runner=(_,p,seed)=>{
 const random=rng(seed),rounds=Math.round(num(p,'rounds',400)),bias=num(p,'rock',.7),mode=str(p,'opponent','fixed'),regrets=[0,0,0],totals=[0,0,0],names=['石头','布','剪刀'],log=new WorldRecord('regret',seed,{regrets:[...regrets],totals:[...totals]}),scoreHistory:{x:number;y:number}[]=[];let score=0;
 const utility=(a:number,b:number)=>a===b?0:(a-b+3)%3===1?1:-1;
 for(let t=0;t<rounds;t++){
  const positive=regrets.map(v=>Math.max(0,v)),sum=positive.reduce((a,b)=>a+b,0),strategy=sum?positive.map(v=>v/sum):[1/3,1/3,1/3];
  log.add({phase:'从遗憾分配概率',ruleId:'regret-policy',action:sum?'按正遗憾比例选择':'没有正遗憾，三种动作均匀分配',explanation:'遗憾是“如果以前总换成某动作，会多获得多少收益”。只把正遗憾拿来分配概率，负值不变成负概率；正值总和为0时各1/3。',calculation:{formula:'p(a)=max(R(a),0)/Σmax(R,0)；全零则1/3',values:{'石头正遗憾':positive[0],'布正遗憾':positive[1],'剪刀正遗憾':positive[2],'总和':sum},result:strategy[0]}},{kind:'bars',values:strategy,labels:names,title:'本轮混合策略（尚未见本轮对手动作）'}, {strategy,round:t+1});
  const opponentDraw=mode==='adaptive'?null:random(),opp=mode==='adaptive'?(totals.indexOf(Math.max(...totals))+1)%3:pick([bias,(1-bias)/2,(1-bias)/2],opponentDraw!),actionDraw=random(),action=pick(strategy,actionDraw),pay=utility(action,opp),alternatives=names.map((_,a)=>utility(a,opp)),increments=alternatives.map(v=>v-pay);
  score+=pay;totals[action]++;for(let a=0;a<3;a++)regrets[a]+=increments[a];scoreHistory.push({x:t+1,y:score});
  log.add({phase:'比较反事实并记账',ruleId:'regret-update',action:`你出${names[action]}，对手出${names[opp]}，净收益${pay}`,explanation:`先按概率随机抽动作，看到对手后再计算三种反事实收益。每个动作累计“假如选它的收益−本次实际收益”；实际选中的动作本轮增量为0。${mode==='adaptive'?'对手根据你过去最常用动作选择克制动作。':'对手按固定偏好随机选择。'}`,calculation:{formula:'R(a) += u(a,对手动作) − u(本次动作,对手动作)',values:{'本次收益':pay,'石头反事实':alternatives[0],'布反事实':alternatives[1],'剪刀反事实':alternatives[2]},result:regrets.join(', ')},candidates:names.map((name,a)=>({target:name,status:a===action?'chosen':'rejected',reason:a===action?'由本轮混合策略随机抽中，不保证当轮最好。':'本轮未抽中；事后反事实只用于下一轮更新。',values:{'本轮概率':strategy[a],'反事实收益':alternatives[a],'遗憾增量':increments[a]}}))},{kind:'bars',values:regrets,labels:names,active:[action],title:'更新后的累计遗憾，可为负数'}, {action,opponent:opp,opponentDraw,actionDraw,regrets:[...regrets],totals:[...totals],pay,score,alternatives,increments});
  log.frames[log.frames.length-1].secondaryScene={kind:'lines',series:[{name:'累计净胜',points:[...scoreHistory],color:palette[1]}]};
 }
 return log.finish('这是外部遗憾匹配：对同一个已观察对手动作比较所有替代动作，再按正累计遗憾分配下一轮概率。固定预算结束，不保证每轮获胜。',{'累计净胜':score,'石头比例':round(totals[0]/rounds,2),'布比例':round(totals[1]/rounds,2),'剪刀比例':round(totals[2]/rounds,2)});
};
