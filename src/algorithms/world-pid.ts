import type {Frame,Runner,Scene} from '../engine/types';
import {TraceRecorder,type TraceEvent,type TeachingValue} from '../engine/teaching';
import {clamp,num,palette,result,round} from '../engine/utils';

/** Same discrete plant as the original sandbox; every controller/plant update is recorded. */
export function createPid(draw:(height:number,target:number,wind:number,tick:number)=>Scene):Runner {
 return (_,p,seed)=>{
  const target=num(p,'target',60),kp=num(p,'gain',1.2),kd=num(p,'damping',1.8),wind=num(p,'wind',2),ki=.28,dt=.08,steps=320;
  let height=10,velocity=0,integral=0,lastError=target-height,peak=height;
  const actual:{x:number;y:number}[]=[{x:0,y:height}],desired:{x:number;y:number}[]=[{x:0,y:target}],frames:Frame[]=[];
  const rec=new TraceRecorder('pid',seed,{height,velocity,integral,lastError,time:0,force:0});
  const emit=(event:Omit<TraceEvent,'id'|'frameIndex'|'changes'>,state:Record<string,TeachingValue>,scene:Scene)=>rec.add({...event,frameIndex:frames.length,scene},state);
  for(let i=0;i<steps;i++){
   const time=(i+1)*dt,gust=i>120&&i<210?wind:0,before=draw(height,target,gust,i),error=target-height;
   emit({phase:'测量误差',ruleId:'pid-error',action:'目标减去当前高度',explanation:`目标 ${target}，当前高度 ${round(height,4)}；差值 ${round(error,4)} 决定向上还是向下修正。`,calculation:{formula:'e = 目标高度 − 当前高度',values:{'目标':target,'高度':height},result:error}},{error},before);
   const oldIntegral=integral,rawIntegral=integral+error*dt;
   integral=clamp(rawIntegral,-35,35);
   emit({phase:'记住过去',ruleId:'pid-integral',action:rawIntegral===integral?'累计这一小段误差':'积分超过限制，截到边界',explanation:`先加上 e×dt，再将积分限制在 [−35,35]。${rawIntegral===integral?'这一步没有触及边界。':'本次达到积分限幅，避免数值继续积累。'}这是简单限幅，不是完整的抗积分饱和方案。`,calculation:{formula:'I = clip(旧 I + e × dt, −35, 35)',values:{'旧I':oldIntegral,e:error,dt},result:integral}},{integral},before);
   const proportional=kp*error,integralTerm=ki*integral,derivative=kd*(error-lastError)/dt,rawForce=proportional+integralTerm+derivative;
   emit({phase:'组合反馈',ruleId:'pid-sum',action:'相加 P、I、D 三项',explanation:`P 根据当前差距，I 根据累计差距，D 根据误差变化。D=${round(derivative,4)}，${derivative<0?'误差正在减小，D向下抑制继续上冲。':derivative>0?'误差正在增大，D加强向上修正。':'误差暂未改变，D本次为零。'}`,calculation:{formula:'u原始 = Kp×e + Ki×I + Kd×(e−旧e)/dt',values:{P:proportional,I:integralTerm,D:derivative},result:rawForce}},{proportional,integralTerm,derivative,rawForce},before);
   const force=clamp(rawForce,-22,22),limited=force!==rawForce;
   emit({phase:'执行器限制',ruleId:'pid-limit',action:limited?'指令超出范围，执行器只能限幅':'指令在允许范围内，直接执行',explanation:`本模型的净加速度指令限制为 [−22,22]。${limited?`原始 ${round(rawForce,4)} 无法实现，实际用 ${force}。`:'实际指令等于三项之和。'}播放速度不改变物理时间步长。`,calculation:{formula:'u = clip(u原始, −22, 22)',values:{'原始指令':rawForce,'下限':-22,'上限':22},result:force},candidates:[{target:'原始指令',status:limited?'rejected':'chosen',reason:limited?'超过执行器范围，不能照原数值执行。':'在范围内，原样执行。',values:{u:rawForce}},...(limited?[{target:'限幅后指令',status:'chosen' as const,reason:'取最近的可实现边界。',values:{u:force}}]:[])]},{force},before);
   const oldHeight=height,oldVelocity=velocity,acceleration=force-.6*velocity+gust;
   velocity+=acceleration*dt;height+=velocity*dt;lastError=error;peak=Math.max(peak,height);
   actual.push({x:time,y:height});desired.push({x:time,y:target});
   const scene=draw(height,target,gust,i),eventId=emit({phase:'环境响应',ruleId:'pid-motion',action:'先更新速度，再更新高度',explanation:`净指令 ${round(force,3)}，阻尼 −0.6v=${round(-.6*oldVelocity,3)}，阵风 ${gust}。先用它们改变速度，再用新速度改变高度；下次反馈读取这个新高度。`,calculation:{formula:'v新=v+(u−0.6v+风)dt；h新=h+v新dt',values:{'旧高度':oldHeight,'旧速度':oldVelocity,'加速度':acceleration,dt,'新速度':velocity},result:height}},{height,velocity,lastError,time,gust},scene);
   frames.push({scene,secondaryScene:{kind:'lines',series:[{name:'实际高度',points:[...actual],color:palette[0]},{name:'目标高度',points:[...desired],color:palette[1]}]},caption:`${round(time,2)} 秒：实际高度 ${round(height,2)}；净指令 ${round(force,2)}。${gust?'本步有阵风。':'本步没有阵风。'}`,eventId,metrics:{'高度':round(height,2),'误差':round(target-height,2),'净指令':round(force,2)}});
  }
  rec.add({phase:'模拟结束',ruleId:'pid-stop',action:'到达 320 个固定时间步，结束模拟',explanation:'这里按固定时长 25.6 秒结束，并不是证明已永久稳定。可改变增益、阻尼、阵风，观察超调、振荡与最后误差。',frameIndex:frames.length-1,calculation:{formula:'模拟时长 = 步数 × dt',values:{'步数':steps,dt},result:steps*dt}},{finalError:target-height,peak});
  return {...result(frames,'P看当前误差，I累积误差，D响应误差变化。本实验是一维、固定步长、含指令与积分限幅的离散模型；没有模拟真实飞行器的重力补偿、姿态和电机延迟。',{'最终误差':round(Math.abs(target-height),2),'最大超调':round(Math.max(0,peak-target),2),'模拟时长':'25.6 秒'}),trace:rec.trace};
 };
}
