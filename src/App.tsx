import {Component,useEffect,useState} from 'react';
import {Home} from './components/Home';
import {Explore} from './components/Explore';
import {Lab} from './components/Lab';
import {Finder,Workshops,Resources,Progress} from './components/Discovery';
import {Icon,Link,Logo} from './components/Primitives';
import {OnlineNotice} from './components/OnlineNotice';
import {byId} from './content/catalog';
import {learning,useLearning} from './engine/storage';
class ErrorBoundary extends Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return{error:true};}render(){return this.state.error?<main className="page empty-state"><Icon name="Wrench" size={40}/><h1>这个页面需要重新整理一下</h1><p>你的学习记录仍保留在浏览器中。请刷新页面再试。</p><button className="button primary" onClick={()=>location.reload()}>刷新页面</button></main>:this.props.children;}}
const nav=[['/explore','算法地图','Compass'],['/finder','问题找算法','Lightbulb'],['/workshops','比赛工作坊','Flag'],['/resources','灵感资源','Library'],['/progress','学习足迹','Footprints']];
export default function App(){
 const [hash,setHash]=useState(location.hash.slice(1)||'/');const state=useLearning();const [path,query='']=hash.split('?');
 useEffect(()=>{const listener=()=>{setHash(location.hash.slice(1)||'/');window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
 useEffect(()=>{document.documentElement.dataset.reduced=String(state.reducedMotion);const id=path.startsWith('/lab/')?path.slice(5):'';document.title=id&&byId[id]?byId[id].name+' · 算法奇境':'算法奇境 · 让聪明的想法看得见';},[path,state.reducedMotion]);
 let page:React.ReactNode;
 if(path==='/')page=<Home/>;else if(path==='/explore')page=<Explore query={query}/>;else if(path==='/finder')page=<Finder/>;else if(path==='/workshops')page=<Workshops/>;else if(path==='/resources')page=<Resources/>;else if(path==='/progress')page=<Progress/>;else if(path.startsWith('/lab/')&&byId[path.slice(5)])page=<Lab key={path.slice(5)} algorithm={byId[path.slice(5)]}/>;else page=<main className="page empty-state"><h1>这条小路还没有通向实验</h1><p>回到算法地图，重新选择一个目的地。</p><Link to="/explore" className="button primary">打开算法地图</Link></main>;
 return <><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>跳到主要内容</a><header className="site-header"><div className="header-inner"><Logo/><nav aria-label="主导航">{nav.map(([to,label,icon])=><Link key={to} to={to} className={path===to||(to==='/explore'&&path.startsWith('/lab/'))?'active':''}><Icon name={icon} size={16}/>{label}</Link>)}</nav><button className={'motion-toggle '+(state.reducedMotion?'selected':'')} title="减少动态效果" aria-label="减少动态效果" aria-pressed={state.reducedMotion} onClick={()=>learning.reduce(!state.reducedMotion)}><Icon name={state.reducedMotion?'CirclePause':'Orbit'} size={18}/></button></div></header><div id="main-content" tabIndex={-1}><OnlineNotice/><ErrorBoundary key={path}>{page}</ErrorBoundary></div><footer className="site-footer page"><div><Logo/><p>不必会写代码，也能拥有算法的眼光。</p></div><div><span>保持好奇，亲手试试。</span><small>84 个互动展项 · 独立教学模拟 · 2026</small></div><Link to="/resources">灵感与参考 <Icon name="ArrowUpRight" size={15}/></Link></footer></>;
}

