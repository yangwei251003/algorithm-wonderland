"""Readable allocation/constraint views of the recorded teaching cases.

The adapter replays state changes. It does not solve matching, flow, coloring,
critical paths or optimization again. Geometry and labels use recorded operands.
"""
from __future__ import annotations
import copy,re
import numpy as np
from manim import Group,VGroup,Rectangle,RoundedRectangle,Circle,Line,Arrow,DashedLine,Dot,VMobject
from visuals import text,TEAL,GOLD,RED,MUTED,INK,PANEL,RULE,BG,display

BLUE='#90B3FF';PURPLE='#C3A3F5'
SUPPORTED={'stable-matching','max-flow','graph-coloring','critical-path','hill-climbing'}
_CACHE={}

def label(value,x,y,size=21,color=INK,width=None):
    return text(str(value),size,color,width=width).move_to([x,y,0])

def number(value,digits=3):
    if value is None:return '待记录'
    if isinstance(value,(float,int)):
        if value and abs(value)<.0001:return f'{value:.1e}'
        return f'{value:.{digits}f}'.rstrip('0').rstrip('.') if digits else str(round(value))
    return display(value)

def panel(title,after):
    return Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0),label(title,-.25,1.9,21,INK,6.55),label('之后' if after else '之前',3.4,1.9,16,MUTED,.7))

def card(name,value,x,y,width=2.2,color=INK,height=.67):
    return VGroup(RoundedRectangle(width=width,height=height,corner_radius=.055,stroke_color=RULE,fill_color=PANEL,fill_opacity=1).move_to([x,y,0]),label(name,x,y+.16,15,MUTED,width-.13),label(value,x,y-.13,23,color,width-.15))

def foot(g,value):g.add(label(value,0,-1.96,16,MUTED,7.35));return g

def replay(run):
    key=id(run)
    if key in _CACHE and _CACHE[key][0] is run:return _CACHE[key][1]
    state=copy.deepcopy(run['trace']['initialState']);out={}
    meta={'proposal':None,'hillCandidates':None,'earliestKnown':[0],'latestKnown':[]}
    names=[t['label'] for t in run['frames'][0]['scene'].get('tasks',[])]
    for e in run['trace']['events']:
        before=copy.deepcopy(state);mb=copy.deepcopy(meta)
        if run['trace']['algorithmId']=='stable-matching' and e['phase']=='propose':
            m=re.fullmatch(r'申请(\d+)向接收(\d+)提议',e['action'])
            assert m,e['id'];meta['proposal']=[int(m[1])-1,int(m[2])-1]
        if run['trace']['algorithmId']=='hill-climbing' and e['phase']=='compare':meta['hillCandidates']=copy.deepcopy(e['candidates'])
        for c in e['changes']:
            assert state.get(c['target'])==c['before'],(run['trace']['algorithmId'],e['id'],c['target'])
            state[c['target']]=copy.deepcopy(c['after'])
        if names:
            for i,name in enumerate(names):
                if e['phase']=='forward' and e['action']=='更新'+name+'的最早开始' and i not in meta['earliestKnown']:meta['earliestKnown'].append(i)
                if e['phase']=='backward' and e['action']=='推算'+name+'最晚开工' and i not in meta['latestKnown']:meta['latestKnown'].append(i)
        out[e['id']]={'before':before,'after':copy.deepcopy(state),'metaBefore':mb,'metaAfter':copy.deepcopy(meta)}
    _CACHE[key]=(run,out);return out

def stable(e,run,s,after,rec):
    g=panel('双方偏好固定，当前搭配可以改变',after)
    context=rec['metaAfter']['proposal'] if e['phase']=='propose' else rec['metaBefore']['proposal']
    if e['phase'] in {'initialize','stop'}:context=None
    student,mentor=context if context else (None,None)
    g.add(label('学生志愿：左边更喜欢',-1.95,1.42,18,BLUE,3.4),label('导师目前暂留',1.95,1.42,18,TEAL,3.4))
    for i,prefs in enumerate(s['preferences']):
        y=.94-i*.57
        g.add(label('学'+str(i+1),-3.25,y,22,TEAL if i==student else INK,.7))
        for j,target in enumerate(prefs):
            x=-2.45+j*.79;col=BLUE if i==student and target==mentor else MUTED if j<s['next'][i] else INK
            g.add(RoundedRectangle(width=.65,height=.40,corner_radius=.05,stroke_color=col,fill_color=PANEL,fill_opacity=1).move_to([x,y,0]),label('导'+str(target+1),x,y,19,col,.59))
        x=1.0;held=s['receiver'][i];col=GOLD if i==mentor else TEAL
        g.add(label('导'+str(i+1),x,y,24,col,.8),Arrow([1.48,y,0],[2.15,y,0],buff=0,tip_length=.11,color=col,stroke_width=2),label('空缺' if held<0 else '学'+str(held+1),2.8,y,24,MUTED if held<0 else col,1.1))
    queue=' → '.join('学'+str(x+1) for x in s['free']) or '空'
    g.add(card('自由申请队列',queue,-1.95,-.85,3.5,BLUE))
    if mentor is not None:
        ordered=sorted(range(len(s['receiverRanks'][mentor])),key=lambda j:s['receiverRanks'][mentor][j])
        pref=' > '.join('学'+str(j+1) for j in ordered)
        g.add(label('导师'+str(mentor+1)+'完整偏好',1.95,-.68,16,MUTED,3.4),label(pref,1.95,-1.01,21,GOLD,3.4))
    elif e['phase']=='stop':
        for j,ranks in enumerate(s['receiverRanks']):
            ordered=sorted(range(len(ranks)),key=lambda k:ranks[k])
            pref=' > '.join('学'+str(k+1) for k in ordered)
            g.add(label('导'+str(j+1)+'：'+pref,1.95,-.58-j*.28,17,GOLD,3.5))
    else:g.add(card('已完成提议数',number(s.get('proposals',0)),1.95,-.85,3.5,GOLD))
    if e['phase']=='choose':
        v=e['calculation']['values'];result=e['calculation']['result'] if after else '待比较'
        col=(TEAL if result=='接受' else RED) if after else BLUE
        g.add(label('学'+str(student+1)+' → 导'+str(mentor+1)+'   新排名 '+number(v['newRank'])+' / 原排名 '+number(v['oldRank'])+'   '+result,0,-1.48,21,col,7.25))
    elif context:g.add(label('当前提议：学'+str(student+1)+' → 导'+str(mentor+1)+'   提议计数 '+number(s.get('proposals',0)),0,-1.48,21,BLUE,7.2))
    elif e['phase']=='stop':g.add(label('阻挡配对 '+number(s.get('blocking'))+'   ·   双方同时想换的配对',0,-1.48,21,TEAL,7.2))
    else:g.add(label('记录每人已试志愿；灰色志愿不再重试',0,-1.48,20,MUTED,7.2))
    return foot(g,'名次越小越喜欢；暂留只会改善，落选者回自由队列')

def flow_input(run):
    edges=run['frames'][0]['scene']['edges'];adj=[[] for _ in run['trace']['initialState']['level']];links=[]
    for edge in edges:
        u,v=int(edge['from']),int(edge['to']);capacity=float(edge['label'].split('/')[1]);ui=len(adj[u]);vi=len(adj[v])
        adj[u].append((v,vi));adj[v].append((u,ui));links.append((u,v,ui,vi,capacity))
    assert [len(x) for x in adj]==[len(x) for x in run['trace']['initialState']['residual']]
    return adj,links

def flow(e,run,s,after,rec):
    g=panel('层号限定方向，剩余量限定可增送量',after);adj,links=flow_input(run)
    pts=[[-3.3,.17,0],[-2.15,1.0,0],[-2.15,-.68,0],[-.45,1.0,0],[-.45,-.68,0],[.75,.17,0]];pts=[np.array(p) for p in pts]
    match=re.search(r'(\d+)→(\d+)',e['action']+' '+e['explanation']);active=(int(match[1]),int(match[2])) if match else None
    cutting=e['phase'] in {'cut','result'};capacity_view=e['action']=='累计跨割原始容量' or e['phase']=='result';source=set(s.get('sourceSide',[]))
    rejected=bool(e.get('candidates')) and all(c['status']=='rejected' for c in e['candidates'])
    active_color=(RED if rejected else TEAL) if after else BLUE
    for u,v,ui,vi,capacity in links:
        a,b=pts[u],pts[v];vec=b-a;unit=vec/np.linalg.norm(vec);normal=np.array([-unit[1],unit[0],0])
        is_active=active==(u,v);reverse_active=active==(v,u);cross=capacity_view and u in source and v not in source
        col=GOLD if cross else active_color if is_active else RULE
        g.add(Arrow(a+unit*.27,b-unit*.29,buff=0,stroke_width=3 if is_active or cross else 1.8,color=col,tip_length=.12))
        val=capacity if capacity_view else s['residual'][u][ui];mid=(a+b)/2+normal*.16
        edge_text=label(('c=' if capacity_view else 'r=')+number(val),mid[0],mid[1],16,GOLD if cross else active_color if is_active else INK,.65)
        g.add(Rectangle(width=edge_text.width+.07,height=edge_text.height+.025,stroke_width=0,fill_color=BG,fill_opacity=1).move_to(edge_text),edge_text)
        if reverse_active and not capacity_view:
            offset=normal*-.18
            g.add(Arrow(b-unit*.29+offset,a+unit*.27+offset,buff=0,stroke_width=2,color=RED,tip_length=.10))
    for i,p in enumerate(pts):
        col=TEAL if cutting and i in source else BLUE
        g.add(Circle(radius=.235,stroke_color=col,fill_color=PANEL,fill_opacity=1,stroke_width=2).move_to(p),label('s' if i==0 else 't' if i==5 else i,p[0],p[1],24,col,.4))
        level=s['level'][i];node_tag=('源侧' if i in source else '非源侧') if capacity_view else ('未达' if level<0 else '层'+str(level))
        g.add(label(node_tag,p[0],p[1]+(.40 if i in {1,3} else -.40),14,MUTED,.65))
    if e['phase']=='residual' and active:
        u,v=active;idx=next(j for j,(to,_) in enumerate(adj[u]) if to==v);rev=adj[u][idx][1]
        g.add(card('当前更新边',str(u)+' → '+str(v),2.5,1.07,2.15,BLUE),card('正向剩余量',number(s['residual'][u][idx]),2.5,.22,2.15,TEAL),card('反向可撤回量',number(s['residual'][v][rev]),2.5,-.63,2.15,RED))
    elif e['phase']=='admissible':
        v=e['calculation']['values'];g.add(card('待检查边',str(active[0])+' → '+str(active[1]),2.5,1.07,2.15,BLUE),card('剩余量 / 传入量',number(v['residual'])+' / '+number(v['incoming']),2.5,.22,2.15),card('层号变化',str(v['fromLevel'])+' → '+str(v['toLevel']),2.5,-.63,2.15))
    else:
        g.add(card('总流量',number(s['flow']),2.5,1.07,2.15,TEAL),card('割容量累计' if cutting else '汇点层号',number(s.get('cut')) if cutting else ('未到达' if s['level'][-1]<0 else number(s['level'][-1])),2.5,.22,2.15,GOLD))
        if active and not capacity_view:
            u,v=active;idx=next(j for j,(to,_) in enumerate(adj[u]) if to==v)
            g.add(card('本次方向余量',str(u)+'→'+str(v)+' : '+number(s['residual'][u][idx]),2.5,-.63,2.15,BLUE))
        else:g.add(card('原边标签', 'c：原容量' if capacity_view else 'r：剩余量',2.5,-.63,2.15,BLUE))
    if cutting:bottom='已找到源侧：'+(', '.join('s' if i==0 else 't' if i==5 else str(i) for i in s.get('sourceSide',[])) or '待记录')
    elif e['phase']=='admissible':
        result=e['calculation']['result'];bottom=(('本边允许传入 '+number(result)) if isinstance(result,(int,float)) else '本次判断：'+str(result)) if after else '先核对：余量正，且目标层 = 当前层 + 1'
    elif e['phase']=='residual':bottom='正向减本次增量，反向加相同增量；总流量待整条路完成再登记'
    else:bottom='BFS 发现队列：'+(' → '.join('s' if i==0 else 't' if i==5 else str(i) for i in s.get('queue',[])) or '尚未建立')
    g.add(label(bottom,0,-1.48,18,active_color if e['phase']=='admissible' else TEAL if after else BLUE,7.3))
    return foot(g,'源点 s 编号0，终点 t 编号5；反向余量是撤回权限，不是新管道')

def coloring(e,run,s,after,rec):
    g=panel('先选最受限的节点，再试最小可用色',after);scene=run['frames'][0]['scene'];palette=[TEAL,BLUE,GOLD,PURPLE]
    pts={int(p['id']):np.array([-2+(p['x']-50)*.034,.10+(50-p['y'])*.034,0]) for p in scene['nodes']}
    target=int(e['focus'][0]) if e.get('focus') else s.get('current');attempt=None
    if e['phase']=='color':attempt=int(e['candidates'][0]['target'].replace('颜色',''))
    neighbors=[]
    for edge in scene['edges']:
        u,v=int(edge['from']),int(edge['to']);hit=target in {u,v}
        if hit:neighbors.append(v if target==u else u)
        witness=hit and attempt is not None and rec['before']['colors'][v if target==u else u]==attempt
        g.add(Line(pts[u],pts[v],color=RED if witness else RULE,stroke_width=3 if witness else 1.8))
    for i,p in pts.items():
        value=s['colors'][i];col=palette[value%len(palette)] if value>=0 else MUTED
        code=label('未着色' if value<0 else '色'+str(value),p[0],p[1]-.48,15,col,.8)
        g.add(Circle(radius=.26,stroke_color=col,fill_color=PANEL,fill_opacity=1,stroke_width=3).move_to(p),label(chr(65+i),p[0],p[1],24,col,.42),Rectangle(width=code.width+.04,height=code.height+.02,stroke_width=0,fill_color=BG,fill_opacity=1).move_to(code),code)
        if i==target:g.add(Circle(radius=.33,stroke_color=TEAL if after else BLUE,stroke_width=2).move_to(p))
    if e['phase']=='select':
        g.add(label('节点   饱和度   原图度数',1.9,1.40,17,MUTED,3.1))
        for i,c in enumerate(e['candidates']):
            v=c['values'];y=.94-i*.45;col=TEAL if after and c['status']=='chosen' else BLUE
            g.add(label(chr(65+int(c['target'])),.86,y,23,col,.5),label(v['saturation'],1.85,y,23,col,.6),label(v['degree'],2.9,y,23,col,.6))
        g.add(label('并列：度数更大，再编号更小',1.9,-1.47,17,MUTED,3.3))
    elif e['phase']=='color':
        used=[chr(65+j)+':'+str(rec['before']['colors'][j]) for j in sorted(neighbors) if rec['before']['colors'][j]>=0]
        result=e['candidates'][0]['status'];col=(RED if result=='rejected' else TEAL) if after else BLUE
        g.add(card('当前节点',chr(65+target),1.95,1.04,3.1,TEAL),card('当前试色',str(attempt),1.95,.22,3.1,col),card('邻居已有颜色',', '.join(used) or '尚无',1.95,-.60,3.1))
        g.add(label(('冲突，拒绝' if result=='rejected' else '最小可用，采用') if after else '待逐色检查',1.95,-1.47,22,col,3.3))
    else:
        g.add(card('约束','每条边两端异色',1.95,1.04,3.1,BLUE),card('已核对冲突数',number(s.get('conflicts')),1.95,.22,3.1,TEAL),card('方法性质','贪心启发式',1.95,-.60,3.1,GOLD))
    return foot(g,'数字是颜色编号；饱和度统计不同邻色，不把未选节点当成删除')

def critical(e,run,s,after,rec):
    g=panel('两遍时间推算，最后才登记缓冲',after);tasks=run['frames'][0]['scene']['tasks'];meta=rec['metaAfter' if after else 'metaBefore']
    x0=-1.78;span=3.80;limit=30;xs=lambda v:x0+span*v/limit;current=next((i for i,t in enumerate(tasks) if t['label'] in e['action']),None)
    g.add(label('任务 / 工期',-2.8,1.45,15,MUTED,1.7))
    for v in [0,10,20]:g.add(label(v,xs(v),1.45,14,MUTED,.4),Line([xs(v),1.20,0],[xs(v),-1.27,0],color=RULE,stroke_width=.8))
    for x,t in [(2.37,'最早'),(2.92,'最晚'),(3.48,'时差')]:g.add(label(t,x,1.45,14,MUTED,.5))
    for i,t in enumerate(tasks):
        y=1.07-i*.37;col=GOLD if i in s.get('critical',[]) else TEAL
        if i==current:g.add(RoundedRectangle(width=7.35,height=.34,corner_radius=.03,stroke_color=BLUE,stroke_width=1.3).move_to([0,y,0]))
        g.add(label(t['label']+' / '+str(s['duration'][i]),-2.8,y,16,INK,1.75))
        known=i in meta['earliestKnown'];es=s['earliest'][i];ls=s.get('latest',[None]*len(tasks))[i];slack=s.get('slack',[])
        if known:
            width=span*s['duration'][i]/limit;g.add(Rectangle(width=width,height=.22,stroke_width=0,fill_color=col,fill_opacity=.85).move_to([xs(es)+width/2,y,0]))
            if i in meta['latestKnown'] and ls!=es:g.add(Rectangle(width=width,height=.27,stroke_color=BLUE,stroke_width=1.6).move_to([xs(ls)+width/2,y,0]))
        else:g.add(label('待前置推算',-.05,y,13,MUTED,1.8))
        g.add(label(es if known else '—',2.37,y,18,col,.48),label(number(ls) if i in meta['latestKnown'] else '—',2.92,y,18,BLUE,.48),label(number(slack[i]) if i<len(slack) else '—',3.48,y,18,GOLD,.48))
    calc=e.get('calculation');message='实条为最早计划，空框为可延后计划；未推算的时刻不填零'
    if calc:
        v=calc['values'];result=number(calc['result']) if after else '待写入'
        if e['phase']=='forward':message='最早 = max('+number(v['old'])+', '+number(v['parentStart'])+' + '+number(v['duration'])+') → '+result
        elif e['phase']=='backward':message='最晚 = '+number(v['deadline'])+' − '+number(v['duration'])+' → '+result
        elif e['phase']=='slack':message='时差 = '+number(v['latest'])+' − '+number(v['earliest'])+' → '+result
    elif s.get('makespan') is not None:message='已记录项目工期 '+number(s['makespan'])+'   ·   '+('关键任务待计算' if 'critical' not in s else '已确认关键任务 '+str(len(s['critical'])))
    g.add(label(message,0,-1.58,19,TEAL if after else BLUE,7.25))
    return foot(g,'最早等全部前置，最晚服从最紧后继；同一支线的时差可能共享')

def hill(e,run,s,after,rec):
    g=panel('每次重看局部候选，只接受严格改善',after)
    # The input scene already contains the sampled landscape. Map its geometry,
    # without evaluating the objective function or inventing extra candidates.
    scene=run['frames'][0]['scene'];points=scene['paths'][0]['points'];overview=e['phase']=='stop';limit=100 if overview else 40;vertical=95 if overview else 45
    xy=lambda p:np.array([-3.45+p['x']/limit*3.65,-1.03+(95-p['y'])/vertical*2.34,0])
    shown=[xy(p) for p in points if 0<=p['x']<=limit]
    g.add(VMobject(color=MUTED,stroke_width=2).set_points_as_corners(shown),Line([-3.45,-1.1,0],[.2,-1.1,0],color=RULE))
    for v in ([0,25,50,75,100] if overview else [0,10,20,30,40]):g.add(label(v,-3.45+v/limit*3.65,-1.31,14,MUTED,.45))
    g.add(label('观众全域参考：0–100' if overview else '局部放大：位置 0–40',-1.65,1.45,17,BLUE,3.6))
    if overview:g.add(label('灰线含未访问位置，搜索没有遍历它',-1.65,1.13,14,MUTED,3.6))
    candidates=e.get('candidates') or rec['metaBefore']['hillCandidates'] or []
    recorded_points={p['x']:p for p in points}
    for c in candidates:
        pos=c['values']['position'];p=recorded_points.get(pos)
        if p and 0<=pos<=limit:
            col=(TEAL if c['status']=='chosen' else RED) if after else BLUE;g.add(Circle(radius=.10,color=col,stroke_width=3).move_to(xy(p)))
    p=recorded_points.get(s['position'])
    if p and 0<=s['position']<=limit:g.add(Dot(xy(p),radius=.065,color=GOLD))
    for i,c in enumerate(candidates):
        y=1.01-i*.79;v=c['values'];col=(TEAL if c['status']=='chosen' else RED) if after else BLUE
        g.add(card('位置 '+number(v['position']),number(v['value'],4),2.02,y,2.96,col))
    if not candidates:g.add(card('当前收益',number(s['value'],4),2.02,1.01,2.96,GOLD),card('候选评估','尚未执行',2.02,.22,2.96,BLUE))
    g.add(label('当前记录 x = '+number(s['position'])+'   收益 = '+number(s['value'],4),0,-1.61,21,GOLD,7.25))
    return foot(g,'圆环为本轮局部候选，金点是当前位置；远峰未搜索，不能保证全局最好')

def allocation_principle_visual(event,run,snapshot,show_after):
    algorithm=run['trace']['algorithmId']
    if algorithm not in SUPPORTED:return None
    rec=replay(run)[event['id']];state=rec['after' if show_after else 'before']
    fn={'stable-matching':stable,'max-flow':flow,'graph-coloring':coloring,'critical-path':critical,'hill-climbing':hill}[algorithm]
    return fn(event,run,state,show_after,rec)
