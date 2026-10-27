import type {AlgorithmDefinition, Frame, Params, RunResult, Scene} from './types';
export const palette=['#78edd0','#f6c37b','#91aaff','#ed8fa7','#b5a0ee','#80c7e8','#c5da8c'];
export function rng(seed:number){let a=seed|0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export const num=(p:Params,k:string,f:number)=>Number.isFinite(Number(p[k]))?Number(p[k]):f;
export const str=(p:Params,k:string,f:string)=>String(p[k]??f);
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const round=(v:number,d=2)=>Number(v.toFixed(d));
export const defaults=(d:AlgorithmDefinition):Params=>Object.fromEntries(d.controls.map(c=>[c.key,c.defaultValue]));
export const frame=(scene:Scene,caption:string,metrics:Record<string,number|string>={}):Frame=>({scene,caption,metrics});
export const result=(frames:Frame[],summary:string,metrics:Record<string,number|string>={}):RunResult=>({frames,summary,metrics});
export function gaussian(random:()=>number){return Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());}
export function bounds(values:number[]){const min=Math.min(...values),max=Math.max(...values);return {min,max,range:max-min||1};}
