import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {lessonById} from '../content/lessons';
import {coreInteractiveIds} from '../engine/teaching';
import {LessonIntro,DecisionInspector,TraceLedger,UnderstandingCheck} from './Principles';
import {LessonMedia} from './LessonMedia';
const InteractiveFilm=lazy(()=>import('./InteractiveFilm').then(m=>({default:m.InteractiveFilm}))); 
import type {AlgorithmDefinition,LabInput,Params,RunResult} from '../engine/types';
import {defaults} from '../engine/utils';
import {normalizeInput,normalizeParams} from '../engine/validation';
import {byId,categoryById,firstJourney,flagshipIds} from '../content/catalog';
import {learning,useLearning} from '../engine/storage';
import {useExperiment} from '../engine/useExperiment';
import {SceneView} from './SceneView';
import {sceneForTraceEvent} from '../engine/traceScene';
import {teachingScene} from './teachingScene';
import {RoboticsPrinciples,canShowRobotics} from './RoboticsPrinciples';
import './RoboticsPrinciples.css';
import {DiscoveryPrinciples,canShowDiscovery} from './DiscoveryPrinciples';
import './DiscoveryPrinciples.css';
import {ShaPrinciples,canShowSha} from './ShaPrinciples';
import './ShaPrinciples.css';
import {ApplicationMission} from './ApplicationMission';
import {Icon,Link} from './Primitives';
const comparisons:Record<string,string[]>={astar:['dijkstra','bfs'],dijkstra:['astar','bfs'],bfs:['dijkstra','astar'],'quick-sort':['merge-sort','heap-sort'],'merge-sort':['quick-sort','heap-sort'],'heap-sort':['quick-sort','merge-sort']};
const deterministic=new Set(['pagerank','collaborative','content-recommendation','apriori','bm25','edit-distance','kmp','rle','huffman','lz77','hamming','crc','bloom','sha256','knapsack','max-flow','hill-climbing','simplex','branch-bound','seam-carving','pid','potential-field','pure-pursuit','minimax','ahp','topsis','lsystem']);
function Metrics({values,label="整次实验结果"}:{values:Record<string,number|string>;label?:string}){const all=Object.entries(values),main=all.filter(([,v])=>String(v).length<=34).slice(0,5),extra=all.filter(entry=>!main.includes(entry));return <><p className="metrics-caption">{label}</p><div className="metrics-row">{main.map(([key,value])=><div key={key}><span>{key}</span><strong>{typeof value==='number'&&!Number.isInteger(value)?Number(value.toFixed(3)):String(value)}</strong></div>)}</div>{extra.length>0&&<details className="metric-details"><summary>展开完整结果数据</summary><dl>{extra.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></details>}</>;}
function ComparePane({id,input,params,seed}:{id:string;input:LabInput;params:Params;seed:number}){
 const def=byId[id];const merged=useMemo(()=>({...defaults(def),...params}),[def,params]);const {result,busy,error}=useExperiment(def,input,merged,seed);
 return <div className="compare-pane"><div className="panel-label"><span>同样条件 · {def.name}</span><Icon name="GitCompareArrows" size={16}/></div>{busy?<div className="loading-stage">正在计算对照方案…</div>:error?<p className="error-text">{error}</p>:result&&<><SceneView scene={result.frames.at(-1)!.scene}/><Metrics values={result.metrics}/><p className="compare-summary">{result.summary}</p></>}</div>;
}
export function Lab({algorithm:a}:{algorithm:AlgorithmDefinition}){
 const learningState=useLearning();const saved=learningState.experiments[a.id];const lesson=lessonById[a.id];const [mapTool,setMapTool]=useState<'wall'|'start'|'goal'>('wall');
 const [params,setParams]=useState<Params>(()=>normalizeParams(a,{...defaults(a),...saved?.params}));
 const [input,setInput]=useState<LabInput>(()=>normalizeInput(saved?.input??{}));const [seed,setSeed]=useState(saved?.seed??42);
 const [step,setStep]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
 const pendingMediaJump=useRef<{index:number;input:LabInput;params:Params;seed:number;started:boolean}|null>(null);
 const [preset,setPreset]=useState(-1),[answer,setAnswer]=useState<number|null>(null),[compare,setCompare]=useState(''),[notice,setNotice]=useState(''),[pointClass,setPointClass]=useState(0),[valueInput,setValueInput]=useState(''),[expanded,setExpanded]=useState(false);
 const {result,busy,error,request}=useExperiment(a,input,params,seed);const trace=result?.trace;const event=trace?.events[Math.min(step,trace.events.length-1)];const sourceFrame=result?.frames[Math.min(event?.frameIndex??step,(result?.frames.length??1)-1)];const frame=sourceFrame&&{...sourceFrame,scene:event&&result?sceneForTraceEvent(result,event):sourceFrame.scene,caption:event?.explanation??sourceFrame.caption};
 const pairedImage=frame?.scene.kind==='image'&&frame.secondaryScene?.kind==='image'&&frame.scene.rows===frame.secondaryScene.rows&&frame.scene.cols===frame.secondaryScene.cols;
 const mainScene=frame&&pairedImage?{...frame.scene,originalPixels:frame.secondaryScene!.pixels,originalLabel:frame.secondaryScene!.title}:frame?teachingScene(frame.scene,event,trace):undefined;
 const roboticsFrame=!!trace&&!!event&&canShowRobotics(trace,event);
 const discoveryFrame=!!trace&&!!event&&canShowDiscovery(trace,event);
 const shaFrame=!!trace&&!!event&&canShowSha(trace,event);
 const cat=categoryById[a.category];const isFlagship=flagshipIds.includes(a.id);const randomInput=!deterministic.has(a.id)&&!(a.id==='life'&&params.pattern!=='random');
 useEffect(()=>{learning.visit(a.id);},[a.id]);
 useEffect(()=>{
  setPlaying(false);
  const jump=pendingMediaJump.current;
  if(jump){
   const sameRequest=input===jump.input&&params===jump.params&&seed===jump.seed;
   if(sameRequest){
    jump.started=true;
    // Only the result produced for this exact click may consume the jump.
    // A late effect from an older, equal-valued case is not a matching result.
    if(result&&request?.input===jump.input&&request.params===jump.params&&request.seed===jump.seed){
     setStep(Math.min(jump.index,(result.trace?.events.length||result.frames.length)-1));
     pendingMediaJump.current=null;return;
    }
   }else if(jump.started){
    // A later edit supersedes the chapter's case while its worker is running.
    pendingMediaJump.current=null;
   }
  }
  setStep(0);
 },[result,request,input,params,seed]);
 useEffect(()=>{if(!playing||!result)return;const timer=setInterval(()=>setStep(i=>{if(i>=(result.trace?.events.length||result.frames.length)-1){setPlaying(false);return i;}return i+1;}),Math.max(16,(result.trace?.events.length?2500:180)/speed));return()=>clearInterval(timer);},[playing,result,speed]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{if(!expanded)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=before;window.removeEventListener('keydown',close);};},[expanded]);
 const total=result?.trace?.events.length||result?.frames.length||0;
 const effectiveWalls=useMemo(()=>input.walls??result?.frames[0]?.scene.cells?.flatMap((v,i)=>v===1?[i]:[])??[],[input,result]);
 const compareInput=useMemo(()=>a.interaction==='grid-walls'?{...input,walls:effectiveWalls}:a.category===1?{...input,values:result?.frames[0]?.scene.values??input.values}:input,[input,effectiveWalls,a,result]);
 const changeCell=(i:number)=>{if(!frame)return;const cols=frame.scene.cols??20,rows=frame.scene.rows??12,start=Number(input.start??cols+1),goal=Number(input.goal??(rows-2)*cols+cols-2);setPlaying(false);if(mapTool!=='wall'){setInput({...input,[mapTool]:i,walls:effectiveWalls.filter(v=>v!==i)});return;}if(i===start||i===goal)return;setInput({...input,walls:effectiveWalls.includes(i)?effectiveWalls.filter(v=>v!==i):[...effectiveWalls,i]});};
 const addPoint=(x:number,y:number)=>{const old=input.points??result?.frames[0]?.scene.nodes?.filter(n=>(n.r??1)<2)??[];if(old.length>=150){setNotice('教学画布最多保留150个点。');return;}setInput({...input,points:[...old,{x,y,value:pointClass,label:String(pointClass),id:'custom-'+old.length}]});};
 const selectPreset=(i:number)=>{const p=a.presets[i];setPreset(i);setParams({...defaults(a),...p.params});setInput(p.input??{});setSeed(42);setAnswer(null);setCompare('');};
 const changeParam=(key:string,value:number|string)=>{
  setParams(old=>({...old,[key]:value}));setPreset(-1);
  const regenerate=(a.interaction==='grid-walls'&&input.walls&&['density','mode'].includes(key))||(a.interaction==='values'&&input.values&&['count','order'].includes(key))||(a.interaction==='scatter-points'&&input.points&&['dataset','shape','pattern','noise','count','samples','angle'].includes(key));
  if(regenerate){setInput({});setNotice('已按新条件重新生成示例；自定义输入已恢复为示例模式。');}
 };
 const exportImage=()=>{
  const download=(blob:Blob,extension:string)=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=a.id+'-实验观察.'+extension;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const canvas=document.querySelector<HTMLCanvasElement>('.main-experiment canvas');
  if(canvas){canvas.toBlob(blob=>{if(blob)download(blob,'png');});return;}
  const svg=document.querySelector('.main-experiment .scene-svg');
  if(svg){const copy=svg.cloneNode(true) as SVGElement;copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('style','background:#0b1722');download(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}),'svg');return;}
  const s=frame?.scene;
  if(s?.kind==='grid'&&s.cols&&s.rows){const colors=s.palette??['#122331','#334450','#338b82','#78edd0','#f6c37b','#90b3ff'];const cells=s.cells?.map((v,i)=>'<rect x="'+(i%s.cols!)*24+'" y="'+Math.floor(i/s.cols!)*24+'" width="23" height="23" rx="3" fill="'+(typeof v==='string'?v:colors[Math.abs(Math.round(v))%colors.length])+'"/>').join('');download(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="'+s.cols*24+'" height="'+s.rows*24+'" style="background:#0b1722">'+cells+'</svg>'],{type:'image/svg+xml'}),'svg');return;}
  download(new Blob([a.name+'\n\n'+(frame?.caption??'')+'\n\n'+(s?.text??[]).join('\n')+'\n'+(s?.tokens??[]).map(t=>t.text+(t.sub?' ('+t.sub+')':'')).join(' ')+'\n\n'+(result?.summary??'')],{type:'text/plain;charset=utf-8'}),'txt');
 };
 const journeyIndex=firstJourney.indexOf(a.id);const next=journeyIndex>=0?byId[firstJourney[(journeyIndex+1)%firstJourney.length]]:null;
 return <main className="page lab-page" style={{'--accent':cat.color} as React.CSSProperties}>
  <div className="breadcrumbs"><Link to="/explore">算法地图</Link><Icon name="ChevronRight" size={13}/><Link to={'/explore?category='+a.category}>{cat.name}</Link><Icon name="ChevronRight" size={13}/><span>{a.name}</span></div>
  <div className="lab-heading"><div><div className="eyebrow"><span className="live-dot"/>{isFlagship?'精选应用沙盘':'互动实验'} <span className="separator">/</span> {a.kind}</div><h1>{a.subtitle}</h1><p><strong>{a.name}</strong><span> · </span>{a.description}</p></div><button className={'button secondary '+(learningState.favorites.includes(a.id)?'is-favorite':'')} onClick={()=>learning.favorite(a.id)}><Icon name="Bookmark" size={17}/>{learningState.favorites.includes(a.id)?'已收藏':'收藏实验'}</button></div>
  {lesson&&<><nav className="principle-nav" aria-label="原理学习入口"><a href="#principle-rules" onClick={e=>{e.preventDefault();document.getElementById("principle-rules")?.scrollIntoView({behavior:learningState.reducedMotion?"auto":"smooth"});}}>01 先懂规则</a><a href="#principle-experiment" onClick={e=>{e.preventDefault();document.getElementById("principle-experiment")?.scrollIntoView({behavior:learningState.reducedMotion?"auto":"smooth"});}}>02 逐步推演与选择依据</a><a href="#principle-ledger" onClick={e=>{e.preventDefault();document.getElementById("principle-ledger")?.scrollIntoView({behavior:learningState.reducedMotion?"auto":"smooth"});}}>03 完整计算记录</a><a href="#lesson-media" onClick={e=>{e.preventDefault();document.getElementById("lesson-media")?.scrollIntoView({behavior:learningState.reducedMotion?"auto":"smooth"});}}>04 漫画与短片</a></nav><LessonIntro lesson={lesson} onCase={()=>{setInput(lesson.teachingCase.input);setParams(normalizeParams(a,{...defaults(a),...lesson.teachingCase.params}));setSeed(lesson.teachingCase.seed);setPreset(-1);setCompare("");}}/></>}
  <div id="principle-experiment" className="lab-layout"><section className={"experiment-panel main-experiment "+(expanded?"expanded-experiment":"")}><div className="panel-label"><span><Icon name="FlaskConical" size={16}/> {roboticsFrame?event!.action:mainScene?.title??'亲手试一试'}</span><button className="icon-button expand-button" aria-label={expanded?"收起实验画布":"放大实验画布"} onClick={()=>setExpanded(!expanded)}><Icon name={expanded?"Minimize2":"Maximize2"} size={15}/></button><span className="subtle">{busy?'正在计算':total>1?'步骤 '+(Math.min(step,total-1)+1)+' / '+total:'实时计算结果'}</span></div>
   <div className={'experiment-stage '+(a.interaction?'interactive':'')} aria-busy={busy} data-algorithm-id={a.id} data-request-id={request?.requestId} data-step={step} data-step-count={total}>
   {busy?<div className="loading-stage"><span className="loader"/><p>正在寻找答案<span>每一次变化，都重新计算</span></p></div>:error?<div className="empty-state"><Icon name="TriangleAlert"/><h3>这个条件暂时没有结果</h3><p>{error}</p><button className="button secondary" onClick={()=>selectPreset(0)}>试试默认案例</button></div>:frame&&<>{roboticsFrame?<RoboticsPrinciples trace={trace!} event={event!} scene={frame.scene}/>:(<SceneView scene={mainScene!} onCell={a.interaction==='grid-walls'?changeCell:undefined} onPoint={a.interaction==='scatter-points'?addPoint:undefined}/>)}{frame.secondaryScene&&!pairedImage&&<div className="secondary-scene"><span className="panel-label">{frame.secondaryScene.title??'另一种视角'}</span><SceneView scene={frame.secondaryScene}/></div>}</>}
   </div>
   {a.interaction&&<div className="interaction-hint"><Icon name="MousePointer2" size={14}/>{a.interaction==='grid-walls'?<><span>点选格子</span><select aria-label="地图编辑工具" value={mapTool} onChange={e=>setMapTool(e.target.value as typeof mapTool)}><option value="wall">添加或移除障碍</option><option value="start">设置起点</option><option value="goal">设置终点</option></select><button onClick={()=>setInput({...input,walls:[]})}>清空障碍</button></>:a.interaction==='scatter-points'?<><span>点击画布添加一个点</span><select aria-label="新点类别" value={pointClass} onChange={e=>setPointClass(Number(e.target.value))}><option value={0}>青色类</option><option value={1}>橙色类</option></select><button onClick={()=>setInput({})}>恢复示例</button></>:<span>在右侧修改数字，观察结果变化</span>}</div>}
   <div className="playback"><div className="playback-buttons"><button className="icon-button" onClick={()=>{setStep(0);setPlaying(false);}} disabled={busy} aria-label="回到开始"><Icon name="RotateCcw" size={17}/></button><button className="icon-button" onClick={()=>{setStep(i=>Math.max(0,i-1));setPlaying(false);}} disabled={step===0||busy} aria-label="上一步"><Icon name="SkipBack" size={17}/></button><button className="play-button" onClick={()=>{if(step>=total-1)setStep(0);setPlaying(!playing);}} disabled={total<2||busy} aria-label={playing?'暂停':'播放'}><Icon name={playing?'Pause':'Play'} size={19}/></button><button className="icon-button" onClick={()=>{setStep(i=>Math.min(total-1,i+1));setPlaying(false);}} disabled={step>=total-1||busy} aria-label="下一步"><Icon name="SkipForward" size={17}/></button></div><input className="timeline" type="range" aria-label="播放进度" min={0} max={Math.max(0,total-1)} value={Math.min(step,Math.max(0,total-1))} disabled={busy||total<2} onInput={e=>{setStep(Number(e.currentTarget.value));setPlaying(false);}}/><select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4,8].map(s=><option key={s} value={s}>{s}×</option>)}</select><button className="text-button" disabled={!result} onClick={()=>{setStep(total-1);setPlaying(false);}}>看结果 <Icon name="ArrowRight" size={14}/></button></div>
   <div className="live-explanation" aria-live="polite"><span className="live-dot"/><p>{busy?'正在根据你的条件重新计算…':frame?.caption??'调整条件，开始探索。'}</p></div>
   {discoveryFrame&&<div style={{padding:'clamp(12px,2vw,24px)'}}><DiscoveryPrinciples trace={trace!} event={event!} scene={frame?.scene}/></div>}
   {shaFrame&&<div style={{padding:'clamp(12px,2vw,24px)'}}><ShaPrinciples trace={trace!} event={event!} scene={frame?.scene}/></div>}
   {trace&&event&&<DecisionInspector trace={trace} event={event} lesson={lesson}/>}
   {frame&&<Metrics label={step>=total-1||!Object.keys(frame.metrics??{}).length?"整次实验结果":"该阶段的指标"} values={step>=total-1?result!.metrics:Object.keys(frame.metrics??{}).length?frame.metrics!:result!.metrics}/>}
  </section>
  <aside className="control-panel"><div className="panel-label"><span>你的实验台</span><Icon name="SlidersHorizontal" size={16}/></div><div className="control-body"><h3>换个条件，会怎样？</h3><div className="presets">{a.presets.map((p,i)=><button key={i} className={preset===i?'selected':''} onClick={()=>selectPreset(i)} title={p.description}><Icon name={i===0?'Sparkles':'TriangleAlert'} size={14}/>{p.name}</button>)}</div>{preset>=0&&<p className="preset-description">{a.presets[preset].description}</p>}
   {a.controls.map(c=><div className="control" key={c.key}><label htmlFor={'control-'+c.key}>{c.label}{c.type==='range'&&<output>{params[c.key]}</output>}</label>{c.type==='range'?<input id={'control-'+c.key} type="range" min={c.min} max={c.max} step={c.step??1} value={params[c.key]??c.defaultValue} onChange={e=>{changeParam(c.key,Number(e.target.value));}}/>:c.type==='select'?<select id={'control-'+c.key} value={params[c.key]??c.defaultValue} onChange={e=>{const option=c.options?.find(o=>String(o.value)===e.target.value);changeParam(c.key,option?.value??e.target.value);}}>{c.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<textarea id={'control-'+c.key} value={params[c.key]??c.defaultValue} maxLength={1000} rows={3} onChange={e=>{changeParam(c.key,e.target.value);}}/>}{c.help&&<small>{c.help}</small>}</div>)}
   {a.id==='sha256'&&<div className="control"><label htmlFor="sha-trace-target">展开哪一份输入的内部计算？</label><select id="sha-trace-target" value={String(input.traceTarget??'original')} onChange={e=>{setInput({...input,traceTarget:e.target.value});setPlaying(false);}}><option value="original">输入一：原始文本</option><option value="comparison">输入二：比较文本</option></select><small>两份摘要都会实际计算；下方记录展开所选输入的全部轮次。</small></div>}
   {a.interaction==='values'&&<div className="control"><label htmlFor="custom-values">自己输入一组数字</label><input id="custom-values" placeholder="例如：8, 3, 5, 3, 12" value={valueInput} onChange={e=>setValueInput(e.target.value)}/><button className="text-button" onClick={()=>{const values=valueInput.split(/[,，\s]+/).filter(Boolean).map(Number);if(values.length<2||values.length>40||values.some(v=>!Number.isFinite(v)||Math.abs(v)>1000)){setNotice('请输入2—40个数字，范围为-1000到1000。');return;}setInput({...input,values});}}>使用这组数字 <Icon name="ArrowRight" size={14}/></button></div>}
   <div className="seed-control">{randomInput?<><span>实验种子 <b>{seed}</b></span><button className="text-button" onClick={()=>{setSeed(s=>s+1);setInput({});}}>换一组 <Icon name="Shuffle" size={14}/></button></>:<span>相同输入会得到相同结果。修改上方条件，再观察变化。</span>}</div>
   <button className="button secondary full" onClick={()=>{learning.save(a.id,{params,input,seed});setNotice('实验条件已保存在当前浏览器。');}}><Icon name="Save" size={16}/>保存这次实验</button><button className="text-button full" onClick={()=>{setParams(defaults(a));setInput({});setSeed(42);setPreset(-1);setCompare('');}}>恢复初始条件</button>
   {comparisons[a.id]&&<div className="comparison-control"><label htmlFor="compare">同一问题，换种解法</label><select id="compare" value={compare} onChange={e=>{setCompare(e.target.value);setStep(Math.max(0,total-1));setPlaying(false);}}><option value="">选择对照算法</option>{comparisons[a.id].map(id=><option key={id} value={id}>{byId[id]?.name}</option>)}</select><small>共享输入和种子；比较解的质量与操作量。</small></div>}
  </div></aside></div>
  {notice&&<div className="toast" role="status"><Icon name="Check" size={16}/>{notice}</div>}
  {compare&&<section className="compare-section"><div className="section-heading"><div><span className="eyebrow">SIDE BY SIDE</span><h2>同一个问题，两种思路</h2></div><button className="text-button" onClick={()=>setCompare('')}>关闭对照 <Icon name="X" size={16}/></button></div><div className="compare-grid"><ComparePane id={a.id} input={compareInput} params={params} seed={seed}/><ComparePane id={compare} input={compareInput} params={params} seed={seed}/></div><p className="fine-print">动画播放速度用于理解过程，不代表实际计算性能。</p></section>}
  {trace&&<div id="principle-ledger"><TraceLedger trace={trace} selected={step} onSelect={i=>{setStep(i);setPlaying(false);document.getElementById("principle-experiment")?.scrollIntoView({behavior:"auto"});}}/></div>}
  {lesson&&result&&coreInteractiveIds.includes(a.id)&&<Suspense fallback={<p>正在载入互动讲解…</p>}><InteractiveFilm result={result} lesson={lesson}/></Suspense>}
  <LessonMedia id={a.id} onSelectEvent={(index,chapterCase)=>{if(!lesson||!Number.isSafeInteger(index)||index<0)return;const selectedCase=chapterCase??lesson.teachingCase;const nextParams=normalizeParams(a,{...defaults(a),...selectedCase.params}),nextInput=normalizeInput(selectedCase.input),nextSeed=selectedCase.seed;pendingMediaJump.current={index,input:nextInput,params:nextParams,seed:nextSeed,started:false};setParams(nextParams);setInput(nextInput);setSeed(nextSeed);setPreset(-1);setPlaying(false);document.getElementById('principle-experiment')?.scrollIntoView({behavior:'auto'});}}/>
  {lesson&&<UnderstandingCheck lesson={lesson}/>}
  <ApplicationMission algorithm={a} result={result} params={params} input={input} seed={seed}/><section className="learning-grid"><article className="story-panel"><span className="eyebrow">THE IDEA</span><h2>它是怎么想的？</h2><div className="thought-steps">{a.steps.map((s,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{s}</p></div>)}</div>{result&&<div className="result-callout"><Icon name="Lightbulb" size={19}/><div><strong>这一次，我们发现</strong><p>{result.summary}</p></div></div>}<button className="text-button" onClick={exportImage}><Icon name="Download" size={15}/>导出当前观察结果</button></article><article className="story-panel"><span className="eyebrow">TAKE IT INTO LIFE</span><h2>下次遇到这些问题，想起它</h2><ul className="application-list">{a.applications.map((s,i)=><li key={i}><Icon name="ArrowUpRight" size={17}/>{s}</li>)}</ul><div className="competition-note"><Icon name="Flag" size={18}/><div><strong>比赛里怎么用</strong><p>{a.competition}</p></div></div><details className="limits" open><summary><Icon name="TriangleAlert" size={16}/>什么时候，它会失灵？</summary><p>{a.limitation}</p><small>本实验的条件：{a.assumptions}</small></details></article></section>
  <section className="quiz-panel"><div><span className="eyebrow">ONE MORE THOUGHT</span><h2>换个问题，你会怎么选？</h2><p>{a.question.prompt}</p></div><div className="quiz-answers">{a.question.options.map((o,i)=><button key={i} className={(answer===i?'chosen ':'')+(answer!==null&&i===a.question.correct?'correct':'')} onClick={()=>setAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{o}{answer!==null&&i===a.question.correct&&<Icon name="Check" size={17}/>}</button>)}{answer!==null&&<p className="answer-feedback">{answer===a.question.correct?'判断得对。':'再留意这个条件。'}{a.question.explanation}</p>}</div></section>
  <section className="lab-footer"><div><h3>给这次探索留一个标记</h3><div className="mark-actions"><button className={'button secondary '+(learningState.progress[a.id]==='understood'?'selected':'')} onClick={()=>learning.mark(a.id,'understood')}><Icon name="CircleCheck" size={17}/>我理解了</button><button className={'button secondary '+(learningState.progress[a.id]==='review'?'selected':'')} onClick={()=>learning.mark(a.id,'review')}><Icon name="Clock3" size={17}/>稍后再琢磨</button></div></div>{next&&<Link to={'/lab/'+next.id} className="next-experiment"><small>第一次探索 · 下一站</small><strong>{next.subtitle} <Icon name="ArrowRight" size={18}/></strong></Link>}</section>
  {lesson&&<details className="lesson-references"><summary>这份原理讲解参考了哪些作品？</summary><ol>{lesson.references.map(ref=><li key={ref.id}><a href={ref.url} target="_blank" rel="noreferrer">{ref.title}</a> · {ref.author}<p>{ref.observedDesign}</p><small>对应章节：{ref.section} · 核查：{ref.checkedAt} · {ref.verification==="watched"?"已观看指定片段":ref.verification==="interacted"?"已实际操作":"已查阅原作内容"}{ref.limitations?"。"+ref.limitations:""}</small></li>)}</ol></details>}
  <details className="sources-panel"><summary>分级说明与参考来源 <Icon name="ChevronDown" size={16}/></summary><div className="rating-details">{[['理解难度',a.difficulty,'按理解所需前置概念分级'],['新奇度',a.novelty,'面向初学者的编辑评价'],['创新启发度',a.creativity,'组合与迁移潜力的编辑评价'],['应用普遍度',a.prevalence,a.prevalenceNote]].map(([name,score,note])=><div key={String(name)}><strong>{name} <span>{score??'证据不足'}{score?'/5':''}</span></strong><p>{note}</p></div>)}</div><p className="fine-print">分级用于探索导航，不代表科研领先性或市场使用率。资料整理日期：2026-10-24。</p><div className="source-links">{a.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}<Icon name="ExternalLink" size={14}/></a>)}</div></details>
 </main>;
}




