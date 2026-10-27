import './OnlineNotice.css';
export function OnlineNotice(){
 if(import.meta.env.VITE_SITE_MODE!=='online-preview')return null;
 return <aside className="online-notice page" aria-label="在线版说明"><strong>2.0 · 在线预览</strong><span>84 个原理实验 · 252 张漫画 · 16 项交互讲解</span><small>高清短片在本地审查版中提供</small></aside>;
}
