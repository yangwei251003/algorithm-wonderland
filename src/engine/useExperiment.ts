import {useEffect,useRef,useState} from 'react';
import type {AlgorithmDefinition,LabInput,Params,RunResult} from './types';
import {groupFor} from '../content/catalog';
import {normalizeInput,normalizeParams} from './validation';
export function useExperiment(def:AlgorithmDefinition,input:LabInput,params:Params,seed:number){
 const sequence=useRef(0);
 const [state,setState]=useState<{result:RunResult|null;busy:boolean;error:string;request:{requestId:number;input:LabInput;params:Params;seed:number}|null}>({result:null,busy:true,error:'',request:null});
 useEffect(()=>{
  let worker:Worker|undefined;let dead=false;
  // Keep the originating state references with the result. Equal-valued inputs
  // can still belong to different requests (for example a second chapter click).
  const request={requestId:++sequence.current,input,params,seed};
  setState({result:null,busy:true,error:'',request});
  const timer=setTimeout(()=>{
   worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
   worker.onmessage=e=>{if(!dead)setState({result:e.data.result??null,busy:false,error:e.data.error??'',request});};
   worker.onerror=()=>{if(!dead)setState({result:null,busy:false,error:'实验没有顺利载入，请刷新页面或更换案例。',request});};
   worker.postMessage({id:def.id,group:groupFor(def.category),input:normalizeInput(input),params:normalizeParams(def,params),seed:Number.isFinite(seed)?seed|0:42,requestId:request.requestId});
  },100);
  return()=>{dead=true;clearTimeout(timer);worker?.terminate();};
 },[def.id,input,params,seed]);
 return state;
}
