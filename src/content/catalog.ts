import {definitions as core} from './core';
import {definitions as intelligence} from './intelligence';
import {definitions as world} from './world';
import type {AlgorithmDefinition} from '../engine/types';
export const algorithms=[...core,...intelligence,...world];
export const byId=Object.assign(Object.create(null) as Record<string,AlgorithmDefinition>,Object.fromEntries(algorithms.map(a=>[a.id,a])));
export const categories=[
 {id:1,name:'找东西与整理',en:'SEARCH & SORT',color:'#78edd0',description:'从一团乱麻里，找到井井有条。',icon:'ScanSearch'},
 {id:2,name:'地图与关系',en:'PATHS & NETWORKS',color:'#91baff',description:'走哪条路，才能更快抵达？',icon:'Route'},
 {id:3,name:'分配与排程',en:'ALLOCATION',color:'#f6c37b',description:'有限的时间和资源，也有聪明解法。',icon:'Boxes'},
 {id:4,name:'找到更好的方案',en:'OPTIMIZATION',color:'#bba3ed',description:'在无数可能中，寻找更好的那个。',icon:'Mountain'},
 {id:5,name:'预测与不确定性',en:'PREDICTION',color:'#80c7e8',description:'看见趋势，也看见答案的不确定。',icon:'ChartNoAxesCombined'},
 {id:6,name:'让机器发现规律',en:'MACHINE LEARNING',color:'#d3d989',description:'给机器一些例子，看它自己找规律。',icon:'BrainCircuit'},
 {id:7,name:'搜索、推荐与关联',en:'CONNECTIONS',color:'#edb09a',description:'你可能喜欢的背后，是怎样的联系？',icon:'Network'},
 {id:8,name:'压缩与可靠传递',en:'INFORMATION',color:'#a6b8f5',description:'让信息更轻、更准、更可靠地抵达。',icon:'Binary'},
 {id:9,name:'图像与声音',en:'SIGNAL & VISION',color:'#eca6bd',description:'像素和声音里，藏着另一个世界。',icon:'AudioLines'},
 {id:10,name:'机器人与自动控制',en:'ROBOTICS',color:'#80d5c3',description:'从摇摇晃晃，到稳稳地完成任务。',icon:'Bot'},
 {id:11,name:'决策、博弈与试错',en:'DECISION & GAMES',color:'#e7bf78',description:'没有完美信息，也能做出更好选择。',icon:'Dices'},
 {id:12,name:'规则创造世界',en:'GENERATIVE WORLDS',color:'#a0beec',description:'简单规则，长出意想不到的复杂。',icon:'Orbit'}
];
export const categoryById=Object.fromEntries(categories.map(c=>[c.id,c]));
export const firstJourney=['binary-search','astar','knapsack','kmeans','huffman','pid','boids','life'];
export const flagshipIds=['binary-search','astar','knapsack','ant-colony','exponential-smoothing','kmeans','collaborative','hamming','median-filter','pid','topsis','boids'];
export const groupFor=(category:number)=>category<=4?'core':category<=8?'intelligence':'world';
