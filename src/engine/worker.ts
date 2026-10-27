import type {LabInput,Params} from './types';
self.onmessage=async(event:MessageEvent<{id:string;group:string;input:LabInput;params:Params;seed:number}>)=>{
 try{
  const {id,group,input,params,seed}=event.data;
  const module=group==='core'?await import('../algorithms/core'):group==='intelligence'?await import('../algorithms/intelligence'):await import('../algorithms/world');
  if(!module.runners[id])throw new Error('这个实验尚未载入，请刷新后重试。');
  const result=await module.runners[id](input,params,seed);
  if(!result.frames.length)throw new Error('当前条件没有生成可展示的步骤，请换一个案例。');
  self.postMessage({result});
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
