import shared from '../content/teaching-labels.json';
const names:Record<string,string>={
 initialize:'初始化',select:'选择下一项',settle:'确认当前节点',neighbor:'检查相邻位置',backtrack:'回溯答案',stop:'检查停止条件',finish:'得到结果',compare:'比较',swap:'交换',partition:'划分',merge:'合并',count:'计数',place:'放回位置',cell:'计算表格',augment:'沿增广路调整',relax:'尝试改善代价',update:'更新',accept:'接受新方案',reject:'拒绝新方案',evaluate:'评价候选',mutation:'产生变异',crossover:'重组',generation:'进入下一代',pivot:'更换基变量',branch:'拆分子问题',bound:'计算边界',prune:'剪去分支',sample:'抽样',edge:'检查连接',color:'安排颜色',forward:'向前计算',backward:'向后计算',
 open:'待处理列表',closed:'已处理节点',current:'当前节点',distance:'已知最小代价',parent:'首次发现或改善它的前驱',sequence:'入队次序',g:'已走代价 g',h:'剩余代价估计 h',priority:'选择优先值',cost:'这一步的代价',capacity:'可用容量',weight:'占用容量',value:'价值',skip:'不带的价值',take:'带上的价值',
 labels:'当前归属',centers:'当前中心坐标',iteration:'轮次',sse:'组内距离平方和',changed:'归属是否发生变化',values:'当前数值',sorted:'已排好部分',left:'左边界',right:'右边界',mid:'中间位置',target:'要寻找的目标',found:'是否找到',index:'当前位置',pivotValue:'基准值',comparisons:'比较次数',swaps:'交换次数',
 table:'状态表',selected:'已选对象',assignment:'分配关系',matching:'当前匹配',mate:'匹配对象',flow:'当前流量',residual:'剩余通行能力',level:'层级',colors:'已用颜色',degrees:'相连数量',indegree:'剩余前置数量',order:'处理顺序',earliest:'最早时间',latest:'最迟时间',slack:'可推迟时间',temperature:'当前温度',best:'目前最好方案',bestValue:'目前最好值',population:'当前种群',fitness:'方案得分',velocity:'当前速度',position:'当前位置',pheromone:'信息素强度',incumbent:'已知最好整数方案',
 messageBytes:'原消息的UTF-8字节',bitLength:'原消息位数',paddedBytes:'补齐后的字节',block:'当前消息块',chain:'八个链式状态字',registers:'a至h八个寄存器',round:'当前轮次',digest:'最终摘要',T1:'第一项混合值 T1',T2:'第二项混合值 T2',
 time:'时间',error:'当前误差',integral:'累积误差',derivative:'误差变化率',control:'控制输出',output:'实际输出',height:'当前高度',acceleration:'当前加速度',proportional:'比例项',measurement:'测量值',estimate:'估计值',prediction:'预测值',loss:'预测误差',weights:'当前权重',bias:'偏置',gradient:'梯度',learningRate:'学习步长',probability:'发生概率',score:'评分',sum:'累计值',mean:'平均值',variance:'方差',path:'当前路线',queue:'等待队列',stack:'待处理栈',visited:'已发现集合'
};
export function teachingLabel(key:string,algorithmId?:string,phase?:string):string{
 if(algorithmId==='bayes'&&key==='falsePositive'&&phase==='normalize')return '正常且亮灯的比例';
 if(algorithmId==='mcts'&&key==='u'&&phase==='随机模拟')return '随机抽样值';
 const specific=(shared.algorithms as Record<string,Record<string,string>>)[algorithmId??''];
 if(specific?.[key])return specific[key];
 if((shared.common as Record<string,string>)[key])return (shared.common as Record<string,string>)[key];
 if(names[key])return names[key];
 const bracket=key.match(/^([a-zA-Z]+)(\[.*\])$/);if(bracket&&names[bracket[1]])return names[bracket[1]]+bracket[2];
 return key;
}
export function candidateLabel(target:string,algorithmId?:string,phase?:string):string{if(algorithmId==='dbscan'&&/^\d+$/.test(target))return '点 '+(Number(target)+1);if(algorithmId==='topological'&&/^\d$/.test(target))return '任务 '+String.fromCharCode(65+Number(target));if(['bfs','dfs','dijkstra','astar'].includes(algorithmId??'')&&phase==='neighbor'&&/^\d+$/.test(target))return '本次到达编号 '+target+' 的路线';return /^-?\d+$/.test(target)?'编号 '+target:target;}
export function calculationResultLabel(ruleId:string,values?:Record<string,unknown>,phase?:string):string{if(ruleId==='hungarian.adjust'&&values?.column===0)return '入口辅助账（非任务）';return (shared.phaseResults as Record<string,Record<string,string>>)[ruleId]?.[phase??'']??(shared.results as Record<string,string>)[ruleId]??'得到';}
export function calculationFormulaLabel(ruleId:string,original:string):string{return (shared.formulaVariants as Record<string,Record<string,string>>)[ruleId]?.[original]??(shared.formulas as Record<string,string>)[ruleId]??original;}
