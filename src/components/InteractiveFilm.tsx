import {useEffect,useMemo,useRef,useState} from 'react';
import {Player,type PlayerRef} from '@remotion/player';
import {AbsoluteFill,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import type {RunResult} from '../engine/types';
import type {LessonDefinition,TeachingValue,TraceEvent} from '../engine/teaching';
import {teachingJSON} from '../engine/teaching';
import {useLearning} from '../engine/storage';
import {Icon} from './Primitives';
import {SceneView} from './SceneView';
import {sceneForTraceEvent} from '../engine/traceScene';
import {teachingScene} from './teachingScene';
import {teachingLabel,candidateLabel,calculationResultLabel,calculationFormulaLabel} from './teachingLabels';
import '../remotion-lesson.css';
const fps=30,secondsPerStep=1.8,framesPerStep=Math.round(fps*secondsPerStep);
const statusLabel={chosen:'本步选择',deferred:'暂时保留',rejected:'本步不选'};
const phaseLabels:Record<string,string>={init:'准备条件',initialize:'准备条件',select:'比较与选择',inspect:'检查条件',relax:'尝试改进',update:'更新状态',result:'核对结果',backtrack:'回溯方案',finish:'完成推演',compare:'比较候选',assign:'分配归属',move:'更新位置',predict:'作出预测',correct:'修正估计',train:'调整模型'};
const countSteps=(result:RunResult)=>Math.max(1,result.trace?.events.length||result.frames.length);
function frameAt(result:RunResult,index:number){
 const event=result.trace?.events[index],view=result.frames[Math.min(event?.frameIndex??index,result.frames.length-1)];
 const scene=teachingScene(event?sceneForTraceEvent(result,event):view.scene,event,result.trace);
 // Keep input/output pixels and numerical states exact: animation decorates, never estimates data.
 const paired=scene.kind==='image'&&view.secondaryScene?.kind==='image'&&scene.rows===view.secondaryScene.rows&&scene.cols===view.secondaryScene.cols;
 return {event,view,scene:paired?{...scene,originalPixels:view.secondaryScene!.pixels,originalLabel:view.secondaryScene!.title}:scene};
}
function display(value:TeachingValue|undefined){
 if(value===undefined)return '—';if(typeof value==='string')return value;
 if(typeof value==='number')return Number.isFinite(value)?String(Number(value.toPrecision(7))):String(value);
 return teachingJSON(value);
}
function Composition({result,reducedMotion}:{result:RunResult;reducedMotion:boolean}){
 const frame=useCurrentFrame(),{fps:videoFps}=useVideoConfig(),duration=Math.round(videoFps*secondsPerStep),count=countSteps(result),index=Math.min(count-1,Math.floor(frame/duration));
 const {event,scene}=frameAt(result,index);
 return <AbsoluteFill className="film-composition" data-testid="film-scene" data-event-index={index}>
  <div className="film-canvas-top"><span><i/>当前计算画面</span><span>STEP {String(index+1).padStart(2,'0')} <b>/ {count}</b></span></div>
  <div className="film-canvas-title">{event?.action??scene.title??'观察这一步'}</div>
  <div className="film-canvas-view" style={{borderColor:reducedMotion?'#315b58':`rgba(120,237,208,${interpolate(frame%duration,[0,Math.round(videoFps*.35),duration-1],[.7,.25,.25],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})})`}}><SceneView scene={scene}/></div>
  <div className="film-canvas-footer"><span>{phaseLabels[event?.phase??'']??'按规则推进'}</span><span>数值保持原始计算 · 下方逐条解释依据</span></div>
 </AbsoluteFill>;
}
function Evidence({event,lesson,caption}:{event:TraceEvent|undefined;lesson:LessonDefinition;caption:string}){
 const rule=lesson.rules.find(item=>item.id===event?.ruleId),candidates=event?.candidates??[];
 return <div className="film-evidence" data-testid="film-evidence">
  <div className="film-reason"><span className="film-kicker">这一刻，为什么这样做</span><h3>{event?.action??lesson.variant}</h3><p>{event?.explanation??caption}</p></div>
  <div className="film-evidence-grid">
   <div className="film-rule"><span className="film-kicker">用到的规则</span><strong>{rule?.title??'遵循当前实验规则'}</strong><p>{rule?.statement??lesson.variant}</p>{event?.focus?.length?<div className="film-focus">{event.focus.map((value,i)=><span key={i}>{value}</span>)}</div>:null}</div>
   <div className="film-calculation"><span className="film-kicker">把数值代进去</span>{event?.calculation?<><code>{calculationFormulaLabel(event.ruleId,event.calculation.formula)}</code><dl className="film-values">{Object.entries(event.calculation.values).map(([key,value])=><div key={key}><dt>{teachingLabel(key,lesson.algorithmId,event?.phase)}</dt><dd>{display(value)}</dd></div>)}</dl><div className="film-result"><span>{calculationResultLabel(event.ruleId,event.calculation.values,event.phase)}</span><strong>{display(event.calculation.result)}</strong></div></>:<p>{rule?.formula??'这一步按照规则更新状态，不需要额外数值公式。'}</p>}</div>
  </div>
  {candidates.length>0&&<div className="film-candidates"><div className="film-candidate-heading"><span className="film-kicker">其他选择，为什么没有选</span><span>{candidates.length} 个候选</span></div><div className="film-status-key"><span className="chosen">本步选择</span><span className="deferred">暂时保留</span><span className="rejected">本步不选</span></div><div className="film-candidate-list">{candidates.map((candidate,i)=><article className={'film-candidate '+candidate.status} key={i}><div><b>{candidateLabel(candidate.target,lesson.algorithmId,event?.phase)}</b><span>{statusLabel[candidate.status]}</span></div><p>{candidate.reason}</p>{candidate.values&&<dl className="film-values">{Object.entries(candidate.values).map(([key,value])=><div key={key}><dt>{teachingLabel(key,lesson.algorithmId,event?.phase)}</dt><dd>{display(value)}</dd></div>)}</dl>}</article>)}</div></div>}
  {!!event?.changes.length&&<details className="film-changes"><summary>查看这一步改变了哪些状态（{event.changes.length} 项）</summary><div><table><thead><tr><th>状态</th><th>上一步</th><th>这一步</th></tr></thead><tbody>{event.changes.map((change,i)=><tr key={i}><th>{teachingLabel(change.target,lesson.algorithmId)}</th><td>{display(change.before)}</td><td>{display(change.after)}</td></tr>)}</tbody></table></div></details>}
 </div>;
}
export function InteractiveFilm({result,lesson}:{result:RunResult;lesson:LessonDefinition}){
 const ref=useRef<PlayerRef>(null),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[canvasZoom,setCanvasZoom]=useState(false);
 const {reducedMotion}=useLearning(),count=countSteps(result),safeIndex=Math.min(index,count-1);
 const inputProps=useMemo(()=>({result,reducedMotion}),[result,reducedMotion]);
 const chapters=useMemo(()=>lesson.chapters.map(chapter=>({...chapter,index:result.trace?.events.findIndex(event=>chapter.ruleIds.includes(event.ruleId))??-1})).filter(chapter=>chapter.index>=0),[lesson,result]);
 const activeChapter=chapters.filter(chapter=>chapter.index<=safeIndex).sort((a,b)=>b.index-a.index)[0]?.id;
 useEffect(()=>{ref.current?.pause();ref.current?.seekTo(0);setIndex(0);setPlaying(false);},[result]);
 useEffect(()=>{
  const player=ref.current;if(!player)return;
  const update=({detail}:{detail:{frame:number}})=>setIndex(Math.min(count-1,Math.floor(detail.frame/framesPerStep)));
  const play=()=>setPlaying(true),pause=()=>setPlaying(false);
  player.addEventListener('frameupdate',update);player.addEventListener('play',play);player.addEventListener('pause',pause);player.addEventListener('ended',pause);
  return()=>{player.removeEventListener('frameupdate',update);player.removeEventListener('play',play);player.removeEventListener('pause',pause);player.removeEventListener('ended',pause);};
 },[count]);
 const seek=(next:number)=>{const target=Math.max(0,Math.min(count-1,next));ref.current?.pause();ref.current?.seekTo(target*framesPerStep);setIndex(target);setPlaying(false);};
 const toggle=()=>{if(playing)ref.current?.pause();else{if(safeIndex>=count-1)seek(0);ref.current?.play();}};
 const {event,view}=frameAt(result,safeIndex);
 return <section className="remotion-lesson" id="interactive-film" aria-labelledby="interactive-film-title" data-algorithm-id={lesson.algorithmId} data-step={safeIndex} data-step-count={count}>
  <div className="film-heading"><div><span className="eyebrow">INTERACTIVE FILM / 互动原理放映室</span><h2 id="interactive-film-title">把每一次选择，看明白</h2><p>修改上方实验条件，影片就会用新的计算重演。选一章开始，或暂停在你想弄懂的那一步。</p></div><span className="film-live-badge"><i/>跟随你的实验</span></div>
  <nav className="film-chapters" aria-label="互动影片章节">{chapters.map((chapter,i)=><button key={chapter.id} onClick={()=>seek(chapter.index)} aria-current={activeChapter===chapter.id?'step':undefined}><span>{String(i+1).padStart(2,'0')}</span>{chapter.title}<small>第 {chapter.index+1} 步</small></button>)}<button onClick={()=>seek(count-1)} aria-label="影片跳到最后一步"><Icon name="Flag" size={15}/>完成推演<small>第 {count} 步</small></button></nav>
  <div className="film-view-tools"><span>{canvasZoom?'可以左右拖动画布，查看细节。':'想看清地图或表格里的数字？'}</span><button onClick={()=>setCanvasZoom(value=>!value)} aria-label={canvasZoom?'影片画布恢复适应宽度':'放大影片画布'} aria-pressed={canvasZoom}><Icon name={canvasZoom?'Minimize2':'Maximize2'} size={15}/>{canvasZoom?'适应宽度':'放大查看'}</button></div>
  <div className={'remotion-player-shell'+(canvasZoom?' is-zoomed':'')}><div className="film-player-inner"><Player ref={ref} component={Composition} inputProps={inputProps} durationInFrames={count*framesPerStep} compositionWidth={1280} compositionHeight={800} fps={fps} playbackRate={speed} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} moveToBeginningWhenEnded={false} style={{width:'100%'}} acknowledgeRemotionLicense/></div></div>
  <div className="film-controls"><div className="film-buttons"><button onClick={()=>seek(0)} aria-label="影片重置"><Icon name="RotateCcw" size={18}/><span>重置</span></button><button onClick={()=>seek(safeIndex-1)} disabled={safeIndex===0} aria-label="影片上一步"><Icon name="SkipBack" size={18}/><span>上一步</span></button><button className="film-play" onClick={toggle} aria-label={playing?'暂停影片':'播放影片'}><Icon name={playing?'Pause':'Play'} size={19}/><span>{playing?'暂停':'播放'}</span></button><button onClick={()=>seek(safeIndex+1)} disabled={safeIndex>=count-1} aria-label="影片下一步"><Icon name="SkipForward" size={18}/><span>下一步</span></button></div><label className="film-speed">讲解速度<select aria-label="影片速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,1.5,2,4].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label></div>
  <div className="film-timeline"><input type="range" aria-label="影片真实步骤" min={0} max={count-1} value={safeIndex} disabled={count<2} onChange={e=>seek(Number(e.target.value))}/><output aria-live="off">第 <b>{safeIndex+1}</b> / {count} 步</output></div>
  <p className="film-time-note">每个停点对应一条真实计算记录。播放速度只帮助观察，不表示算法计算速度。</p>
  <Evidence event={event} lesson={lesson} caption={view.caption}/>
  {result.trace&&!result.trace.complete&&<p className="film-coverage">当前推演范围：{result.trace.coverageNote}</p>}
 </section>;
}
