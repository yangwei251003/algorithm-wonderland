import React, {useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player,type PlayerRef} from '@remotion/player';
import {SmokeComposition} from './SmokeComposition';
import {runSmokeBfs,type SmokeInput} from './smoke';
import './style.css';

function App(){
 const [input,setInput]=useState<SmokeInput>({origin:0,goal:24,walls:[7,12,17]});
 const [mode,setMode]=useState<'origin'|'goal'|'wall'>('wall');
 const [at,setAt]=useState(0);
 const [playing,setPlaying]=useState(false);
 const player=useRef<PlayerRef>(null);
 const result=useMemo(()=>runSmokeBfs(input),[input]);
 const duration=360;
 useEffect(()=>{const ref=player.current;if(!ref)return;ref.pause();ref.seekTo(0);setAt(0);setPlaying(false);},[input]);
 useEffect(()=>{const ref=player.current;if(!ref)return;const listener=(e:{detail:{frame:number}})=>setAt(e.detail.frame);const onPlay=()=>setPlaying(true);const onPause=()=>setPlaying(false);ref.addEventListener('frameupdate',listener);ref.addEventListener('play',onPlay);ref.addEventListener('pause',onPause);return()=>{ref.removeEventListener('frameupdate',listener);ref.removeEventListener('play',onPlay);ref.removeEventListener('pause',onPause);};},[]);
 const edit=(cell:number,kind=mode)=>setInput(previous=>kind==='wall'?(cell===previous.origin||cell===previous.goal?previous:{...previous,walls:previous.walls.includes(cell)?previous.walls.filter(v=>v!==cell):[...previous.walls,cell]}):({...previous,[kind]:cell,walls:previous.walls.filter(v=>v!==cell)}));
 return <main>
  <header><div className="eyebrow">算法奇境 / 制作环境验证</div><h1>Remotion 可交互播放器</h1><p>这是技术验收页，不属于正式算法教材。移动起点、终点或障碍后，重新运行小型 BFS，再让播放器展示真实轨迹。</p></header>
  <section className="layout"><aside><h2>修改输入</h2><div className="modes">{(['wall','origin','goal'] as const).map(kind=><button key={kind} aria-pressed={mode===kind} onClick={()=>setMode(kind)}>{kind==='wall'?'障碍':kind==='origin'?'起点':'终点'}</button>)}</div>
   <div className="editor" aria-label="输入地图">{Array.from({length:25},(_,i)=><button key={i} data-testid={`cell-${i}`} aria-label={`格子 ${i}`} className={i===input.origin?'origin':i===input.goal?'goal':input.walls.includes(i)?'wall':''} draggable={i===input.origin||i===input.goal} onDragStart={e=>e.dataTransfer.setData('text/plain',i===input.origin?'origin':'goal')} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const kind=e.dataTransfer.getData('text/plain');if(kind==='origin'||kind==='goal')edit(i,kind);}} onClick={()=>edit(i)}>{i===input.origin?'起':i===input.goal?'终':input.walls.includes(i)?'×':i}</button>)}</div>
   <p>选择工具后点格子，或直接拖动起点与终点。</p>
   <dl data-testid="computed-result" data-signature={result.signature}><dt>实际计算的最短步数</dt><dd data-testid="distance">{result.distance}</dd><dt>实际路径</dt><dd className="path" data-testid="path">{result.path.join(' → ')||'不可达'}</dd></dl>
   <button onClick={()=>setInput({origin:0,goal:24,walls:[7,12,17]})}>恢复输入</button>
  </aside><article><Player ref={player} component={SmokeComposition} inputProps={input} durationInFrames={duration} compositionWidth={1280} compositionHeight={720} fps={30} controls clickToPlay={false} style={{width:'100%',borderRadius:18,overflow:'hidden'}}/>
   <div className="toolbar"><button data-testid="play-pause" onClick={()=>playing?player.current?.pause():player.current?.play()}>{playing?'暂停':'播放'}</button><button data-testid="previous" onClick={()=>{player.current?.pause();player.current?.seekTo(Math.max(0,at-1));}}>后退一帧</button><button data-testid="next" onClick={()=>{player.current?.pause();player.current?.seekTo(Math.min(duration-1,at+1));}}>前进一帧</button><button data-testid="restart" onClick={()=>{player.current?.pause();player.current?.seekTo(0);}}>回到开头</button><output data-testid="frame">{at}</output></div>
   <label className="timeline">跳转帧 <input data-testid="seek" aria-label="跳转帧" type="range" min="0" max={duration-1} value={at} onChange={e=>{player.current?.pause();player.current?.seekTo(Number(e.target.value));}}/></label>
  </article></section>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
