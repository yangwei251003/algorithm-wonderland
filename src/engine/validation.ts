import type {AlgorithmDefinition,LabInput,Params,VisualNode} from './types';
export function normalizeParams(def:AlgorithmDefinition,input:Params):Params{
 return Object.fromEntries(def.controls.map(c=>{
  const raw=input[c.key];let value:number|string=c.defaultValue;
  if(c.type==='range'){const n=Number(raw);if(Number.isFinite(n)){const low=c.min??-1e6,high=c.max??1e6,step=c.step??1;value=Math.min(high,Math.max(low,low+Math.round((Math.min(high,Math.max(low,n))-low)/step)*step));}}
  else if(c.type==='select'){const option=c.options?.find(o=>String(o.value)===String(raw));if(option)value=option.value;}
  else if(typeof raw==='string'||typeof raw==='number')value=String(raw).slice(0,1000);
  return[c.key,typeof value==='number'?Number(value.toFixed(8)):value];
 }));
}
export function normalizeInput(raw:LabInput):LabInput{
 const out:LabInput={};
 if(raw.traceTarget==='comparison'||raw.traceTarget==='original')out.traceTarget=raw.traceTarget;
 for(const key of ['rows','cols'] as const){const n=raw[key];if(typeof n==='number'&&Number.isFinite(n))out[key]=Math.min(key==='rows'?12:20,Math.max(2,Math.round(n)));}
 const size=Number(out.rows??12)*Number(out.cols??20);
 for(const key of ['start','goal'] as const){const n=raw[key];if(typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<size)out[key]=n;}
 if(Array.isArray(raw.costs)&&raw.costs.length===size)out.costs=raw.costs.map(n=>typeof n==='number'&&Number.isFinite(n)?Math.max(1,Math.min(20,n)):1);
 if(Array.isArray(raw.walls))out.walls=[...new Set(raw.walls.filter(v=>Number.isInteger(v)&&v>=0&&v<240))];
 if(Array.isArray(raw.values))out.values=raw.values.filter(v=>typeof v==='number'&&Number.isFinite(v)).slice(0,40).map(v=>Math.min(1e9,Math.max(-1e9,v)));
 if(typeof raw.text==='string')out.text=raw.text.slice(0,1000);
 if(Array.isArray(raw.points))out.points=raw.points.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)).slice(0,150).map((n,i):VisualNode=>{const label=Number.isFinite(n.value)?n.value:(n as VisualNode&{c?:number}).c;return{id:typeof n.id==='string'?n.id.slice(0,40):String(i),x:Math.min(100,Math.max(0,n.x)),y:Math.min(100,Math.max(0,n.y)),value:typeof label==='number'&&Number.isFinite(label)?Math.min(1,Math.max(0,Math.round(label))):undefined,label:typeof n.label==='string'?n.label.slice(0,40):undefined};});
 return out;
}


