import {frame,result,str} from '../engine/utils';
export const utf8=(s:string)=>new TextEncoder().encode(s);
export function limitedText(p:Record<string,number|string>,key:string,fallback:string,limit:number){const value=str(p,key,fallback);if(Array.from(value).length>limit)throw new Error(`这段输入超过教学实验的 ${limit} 字符上限，请缩短后再试。`);return value;}
export const bad=(message:string)=>result([frame({kind:'text',text:[message]},message)],message,{'输入有效':0});
export const cosine=(a:number[],b:number[])=>{const den=Math.hypot(...a)*Math.hypot(...b);return den?a.reduce((s,v,i)=>s+v*b[i],0)/den:0;};
export const filmNames=['星际远行','银河漫游','火星日记','城市喜剧','温暖邻居','周末派对'];
export const viewerRatings=[[5,4,4,1,1,0],[4,5,5,2,1,1],[1,1,2,5,4,5],[2,1,0,4,5,4],[5,4,0,1,2,1],[0,2,1,5,4,5],[4,0,5,2,1,0],[1,2,1,4,5,5]];
export const docs=[{title:'校园无人机巡检方案',terms:'校园 无人机 巡检 电力 设备 安全 路线 无人机 巡检'.split(' ')},{title:'校园活动策划',terms:'校园 活动 志愿者 场地 安全 预算 排期'.split(' ')},{title:'无人机航拍入门',terms:'无人机 航拍 图像 相机 飞行 安全'.split(' ')},{title:'设备巡检记录',terms:'设备 巡检 异常 电力 巡检 记录 维护'.split(' ')},{title:'旅行路线优化',terms:'旅行 路线 地图 预算 配送 优化'.split(' ')},{title:'校园科创实践',terms:'校园 科创 机器人 无人机 项目 比赛'.split(' ')}];
export function hash(s:string,salt:number){let h=(2166136261^Math.imul(salt+1,0x9e3779b9))>>>0;for(const b of utf8(s)){h^=b;h=Math.imul(h,16777619)>>>0;}return h;}
