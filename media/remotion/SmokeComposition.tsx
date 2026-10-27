import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {runSmokeBfs, type SmokeInput} from './smoke';

export function SmokeComposition(props: SmokeInput) {
  const trace = useMemo(() => runSmokeBfs(props), [props.origin, props.goal, props.walls]);
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const event = trace.events[Math.min(trace.events.length - 1, Math.floor(frame / durationInFrames * trace.events.length))];
  return <AbsoluteFill style={{backgroundColor:'#0c1722',color:'#eef7fa',fontFamily:'Microsoft YaHei, sans-serif',padding:48,boxSizing:'border-box'}}>
    <div style={{fontSize:18,color:'#8aa9bd',letterSpacing:3}}>REMOTION · 环境可用性探针</div>
    <div style={{fontSize:38,fontWeight:700,marginTop:14}}>真实计算，随参数重新生成</div>
    <div style={{display:'flex',gap:48,marginTop:30}}>
      <svg viewBox="0 0 400 400" width="440" height="440" aria-label="Remotion 计算画面" data-testid="remotion-scene" data-event-index={event.index} data-signature={trace.signature}>
        {Array.from({length:25},(_,i)=><g key={i} transform={`translate(${i%5*80},${Math.floor(i/5)*80})`}>
          <rect x="4" y="4" width="72" height="72" rx="12" fill={i===props.origin?'#78edd0':i===props.goal?'#ed8fa7':props.walls.includes(i)?'#364759':event.path.includes(i)?'#f6c37b':event.reached.includes(i)?'#31665f':'#172a38'} stroke={event.current===i?'#fff':'transparent'} strokeWidth="3"/>
          <text x="40" y="40" textAnchor="middle" dominantBaseline="middle" fontSize="24" fill={i===props.origin||i===props.goal?'#10232c':'#ecf3f6'}>{i===props.origin?'起':i===props.goal?'终':props.walls.includes(i)?'×':event.distances[i]>=0?event.distances[i]:i}</text>
        </g>)}
      </svg>
      <div style={{width:650,display:'flex',flexDirection:'column',gap:22,paddingTop:12}}>
        <div style={{color:'#78edd0',fontSize:20}}>状态 {event.index+1} / {trace.events.length}</div>
        <div data-testid="event-message" style={{fontSize:32,lineHeight:1.55,minHeight:110}}>{event.message}</div>
        <div style={{backgroundColor:'#172a38',borderRadius:16,padding:24,fontSize:24,lineHeight:1.6}}><span style={{color:'#a5bac7'}}>当前队列</span><br/>{event.queue.join(' → ') || '空'}</div>
        <div style={{fontSize:20,color:'#a5bac7'}}>起点 {props.origin} · 终点 {props.goal} · 障碍 {props.walls.length}<br/>本页仅验证播放器与真实计算的连接。</div>
      </div>
    </div>
  </AbsoluteFill>;
}
