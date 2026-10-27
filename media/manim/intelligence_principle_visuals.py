"""Eight readable intelligence views, replaying recorded states and operands only.

No classifier, optimizer, recommender, distance or eigenvalue is run here. Input
coordinates and recorded arithmetic determine geometry; displayed values retain
event provenance and before/after timing. Future results are never backfilled.
"""
from __future__ import annotations
import copy,re
import numpy as np
from manim import Group,VGroup,Rectangle,RoundedRectangle,Circle,Line,Arrow,DashedLine,Dot
from visuals import text,paragraph,TEAL,GOLD,RED,MUTED,INK,PANEL,RULE,display
BLUE='#90B3FF'
SUPPORTED={'decision-tree','naive-bayes','dbscan','pca','neural-network','pagerank','collaborative','content-recommendation'}
_CACHE={}

def records(run):
    key=id(run)
    if key in _CACHE and _CACHE[key][0] is run:return _CACHE[key][1]
    state=copy.deepcopy(run['trace']['initialState']);out={};fitted={};scores={}
    for e in run['trace']['events']:
        before=copy.deepcopy(state);meta_before=copy.deepcopy({'fitted':fitted,'scores':scores})
        for c in e['changes']:state[c['target']]=copy.deepcopy(c['after'])
        if run['trace']['algorithmId']=='naive-bayes':
            if e['phase']=='fit':fitted[state['classStats']['class']]=copy.deepcopy(state['classStats'])
            if e['phase']=='score':scores[(state['query'],state['class'])]=state['score']
        out[e['id']]={'before':before,'after':copy.deepcopy(state),'metaBefore':meta_before,'metaAfter':copy.deepcopy({'fitted':fitted,'scores':scores})}
    _CACHE[key]=(run,out);return out

def n(v,d=3):
    if v is None:return '待记录'
    if isinstance(v,(float,int)):
        if v and abs(v)<.0001:return f'{v:.2e}'
        return f'{v:.{d}f}'.rstrip('0').rstrip('.') if d else str(round(v))
    return display(v)
def at(t,x,y,size=22,col=INK,w=None):return text(str(t),size,col,width=w).move_to([x,y,0])
def canvas(title,after):
    return Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0),at(title,-.3,1.88,21,INK,6.6),at('之后' if after else '之前',3.38,1.88,16,MUTED,.7))
def card(label,value,x,y,w=2.2,col=INK):
    return VGroup(RoundedRectangle(width=w,height=.68,corner_radius=.06,stroke_color=RULE,fill_color=PANEL,fill_opacity=1).move_to([x,y,0]),at(label,x,y+.17,15,MUTED,w-.15),at(value,x,y-.13,23,col,w-.16))
def foot(g,t):g.add(at(t,0,-1.91,16,MUTED,7.3));return g
def axes(g,x0=-3.32,y0=-1.28,side=2.7,lo=0,hi=100):
    xy=lambda x,y:np.array([x0+(x-lo)/(hi-lo)*side,y0+(y-lo)/(hi-lo)*side,0])
    g.add(Line(xy(lo,lo),xy(hi,lo),color=RULE),Line(xy(lo,lo),xy(lo,hi),color=RULE))
    for v in [lo,(lo+hi)/2,hi]:g.add(at(n(v),*xy(v,lo)[:2]-[0,.18],14,MUTED),at(n(v),*xy(lo,v)[:2]-[.23,0],14,MUTED))
    return xy
def current(e,s,key):return next((c['after'] for c in e['changes'] if c['target']==key),s.get(key))

def decision(e,r,s,after,meta):
    g=canvas('候选问题与已选问题分开看',after);xy=axes(g,side=2.7)
    for x,y,c in s['train']:g.add(Dot(xy(x,y),radius=.065,color=TEAL if c==0 else GOLD))
    axis=s.get('splitAxis');threshold=s.get('splitThreshold');candidate=e.get('candidates',[])
    if e['phase']=='candidate' and candidate:
        m=re.fullmatch(r'([xy])<(.+)',candidate[0]['target']);axis=m[1];threshold=float(m[2]);col=(RED if candidate[0]['status']=='rejected' else TEAL) if after else BLUE
    else:col=TEAL
    if axis is not None:
        g.add(DashedLine(xy(threshold,0),xy(threshold,100),color=col) if axis=='x' else DashedLine(xy(0,threshold),xy(100,threshold),color=col))
        g.add(at(('试问 ' if e['phase']=='candidate' else '已选 ')+axis+' < '+n(threshold),-1.96,1.55,19,col,3.25))
    v=e.get('calculation',{}).get('values',{})
    if e['phase']=='candidate':
        g.add(card('左堆人数 / 混杂度',n(v['nL'])+' / '+n(v['GL']),1.75,1.06,3.2,TEAL),card('右堆人数 / 混杂度',n(v['nR'])+' / '+n(v['GR']),1.75,.24,3.2,GOLD),card('本次加权混杂度',n(e['calculation']['result']) if after else '待比较',1.75,-.58,3.2,col))
        g.add(at('暂存 '+str(s.get('bestAxis','x'))+' < '+n(s.get('bestThreshold'))+'  ｜  G = '+n(s.get('bestGini')),1.75,-1.45,18,MUTED,3.2))
    elif e['phase']=='predict':
        val=v.get('value');idx=current(e,s,'validationPoint')
        if val is None and idx is not None:val=s['test'][idx][0]
        point=next((p for p in s['test'] if p[0]==val),None)
        if point:g.add(Circle(radius=.13,color=BLUE,stroke_width=3).move_to(xy(*point[:2])))
        g.add(card('验证横坐标',n(val),1.75,1.03,3.2,BLUE),card('分支规则','x < '+n(threshold),1.75,.2,3.2,TEAL))
        if 'leafProbability' in [c['target'] for c in e['changes']]:g.add(card('本次叶子橙色比例',n(s.get('leafProbability')) if after else '到叶子再读取',1.75,-.63,3.2,GOLD))
        elif e.get('calculation'):g.add(card('本次分支',e['calculation']['result'] if after else '待判断',1.75,-.63,3.2,GOLD))
    else:
        g.add(card('当前训练子堆',s.get('node','root'),1.75,1.03,3.2,BLUE),card('人数 / 混杂度',n(s.get('nodeCount'))+' / '+n(s.get('impurity')),1.75,.20,3.2,TEAL),card('叶子橙色比例',n(s.get('leafProbability')) if e['phase']=='leaf' and after else '停止后才登记',1.75,-.63,3.2,GOLD))
    return foot(g,'实心是训练点，蓝圈是验证点；候选线正式分裂时才采用')

def bayes(e,r,s,after,meta):
    g=canvas('类别各有一套均值、波动与先验',after);xy=axes(g,side=2.7)
    for x,y,c in s['train']:g.add(Dot(xy(x,y),radius=.065,color=TEAL if c==0 else GOLD))
    for c,p in meta['fitted'].items():
        g.add(Circle(radius=.12,color=TEAL if c==0 else GOLD,stroke_width=3).move_to(xy(p['mx'],p['my'])))
    cls=current(e,s,'class');phase=e['phase'];v=e.get('calculation',{}).get('values',{})
    if phase=='fit':cls=current(e,s,'classStats')['class']
    name='绿色' if cls==0 else '橙色' if cls==1 else '未选择'
    if phase=='stop':
        for point in s['test']:g.add(Circle(radius=.14,color=BLUE,stroke_width=3).move_to(xy(*point[:2])))
        g.add(card('留出验证点',str(len(s['test'])),1.75,.85,3.2,BLUE),card('已预测正确',n(s.get('correct')),1.75,.07,3.2,TEAL),at('两点全对，不等于普遍保证',1.75,-.85,19,MUTED,3.3))
    elif phase in {'score','choose'}:
        query=current(e,s,'query');p=s['test'][query] if query is not None else None
        if p:g.add(Circle(radius=.14,color=BLUE,stroke_width=3).move_to(xy(*p[:2])))
        g.add(at('当前验证点 '+('('+n(p[0])+', '+n(p[1])+')' if p else '待选'),1.75,1.44,20,BLUE,3.3))
        for c in [0,1]:
            value=meta['scores'].get((query,c));g.add(card(('绿色' if c==0 else '橙色')+' 对数证据',n(value),1.75,.83-c*.85,3.2,TEAL if c==0 else GOLD))
        if phase=='choose':g.add(card('模型橙色概率',n(e['calculation']['result']) if after else '待归一化',1.75,-.89,3.2,BLUE))
        else:g.add(at('正在用'+name+'的参数解释同一个点',1.75,-.91,17,MUTED,3.3))
    else:
        g.add(at('正在拟合：'+name,1.75,1.45,21,TEAL if cls==0 else GOLD,3.2))
        if phase=='mean':
            # count is the total class size, not the number already accumulated.
            # Count only completed trace additions; never borrow a future fit.
            past=r['trace']['events'][:int(e['id'])+(1 if after else 0)]
            included=sum(1 for old in past if old['phase']=='mean' and records(r)[old['id']]['after'].get('class')==cls)
            total=sum(1 for row in s['train'] if row[2]==cls)
            fresh_class=s.get('class')!=cls
            sx=0 if fresh_class else s.get('sumX',0);sy=0 if fresh_class else s.get('sumY',0)
            for i,(label,value) in enumerate([('已累计 / 本类总数',f'{included} / {total}'),('宽累计',n(sx)),('高累计',n(sy))]):g.add(card(label,value,1.75,.85-i*.78,3.2))
            if included==total and total:
                g.add(at('宽均值：'+n(sx)+' ÷ '+str(total)+' = '+n(sx/total),1.75,-1.28,18,TEAL,3.35),at('高均值：'+n(sy)+' ÷ '+str(total)+' = '+n(sy/total),1.75,-1.60,18,GOLD,3.35))
        elif phase=='variance':
            for i,(k,label) in enumerate([('sumVX','宽平方偏差和'),('sumVY','高平方偏差和')]):g.add(card(label,n(s.get(k)),1.75,.85-i*.78,3.2))
        else:
            p=meta['fitted'].get(cls,{})
            for i,(label,value) in enumerate([('均值 宽 / 高',n(p.get('mx'))+' / '+n(p.get('my'))),('平滑方差 宽 / 高',n(p.get('vx'))+' / '+n(p.get('vy'))),('类别先验',n(p.get('prior')))]):g.add(card(label,value,1.75,.85-i*.78,3.2))
    return foot(g,'圆环为已拟合均值；蓝圈是验证点，不参与参数拟合')

def density(e,r,s,after,meta):
    if e['phase']=='stop':
        g=canvas('全部点检查后，回到完整地图',after);xy=axes(g,side=3.1)
        for i,p in enumerate(s['data']):
            col=GOLD if s['labels'][i]>=0 else RED if s['labels'][i]==-1 else MUTED
            g.add(Dot(xy(*p[:2]),radius=.045,color=col))
        g.add(card('已完成群组',n(s.get('groups')),1.85,1.05,3.1,GOLD),card('最终噪声点',n(s.get('noise')),1.85,.23,3.1,RED))
        grouped=[str(i+1) for i,label in enumerate(s['labels']) if label>=0];noise=[str(i+1) for i,label in enumerate(s['labels']) if label==-1]
        g.add(at('已成组：'+', '.join(grouped),1.85,-.65,18,GOLD,3.2),at('噪声：'+', '.join(noise),1.85,-1.16,18,RED,3.2))
        return foot(g,'按真实坐标显示全部点；邻域细节可回到前面的放大图')
    g=canvas('把邻域放大：距离包含边界与自身',after);data=s['data'];query=current(e,s,'query')
    if e['phase']=='visit':
        ch=next((c for c in e['changes'] if c['target']=='seen'),None)
        if ch:query=next((i for i,(a,b) in enumerate(zip(ch['before'],ch['after'])) if a!=b),query)
    if query is None:query=0
    q=data[query];scale=.22;xy=lambda x,y:np.array([-1.85+(x-q[0])*scale,.05+(y-q[1])*scale,0]);rad=s['eps']*scale
    g.add(Rectangle(width=3.7,height=2.6,stroke_color=RULE).move_to([-1.85,.10,0]),Circle(radius=rad,color=BLUE,stroke_width=2).move_to(xy(*q[:2])),at('点'+str(query+1)+'为中心 · ε = '+n(s['eps']),-1.95,1.53,18,BLUE,3.8))
    candidate=int(e['candidates'][0]['target']) if e['phase']=='distance' else None
    for i,p in enumerate(data):
        atp=xy(*p[:2])
        if not(-3.8<atp[0]<-.05 and -1.15<atp[1]<1.35):continue
        label=s['labels'][i];col=GOLD if label>=0 else RED if label==-1 else MUTED
        if i==query and label!=-1:col=TEAL
        if i==candidate:col=(TEAL if e['candidates'][0]['status']=='chosen' else RED) if after else BLUE
        g.add(Circle(radius=.105,stroke_color=col,fill_color=PANEL,fill_opacity=1,stroke_width=3).move_to(atp),at(str(i+1),atp[0],atp[1]+.25,18,col))
    g.add(at('中心坐标 ('+n(q[0])+', '+n(q[1])+')',-1.85,-.95,18,MUTED,3.5))
    neighbors=s.get('neighbors',[]) if s.get('query')==query else []
    g.add(card('已确认邻居',', '.join(str(i+1) for i in neighbors) or '尚无',1.85,1.1,3.1,TEAL),card('继续扩展所需人数',str(s['minimum'])+'（含自身）',1.85,.27,3.1,BLUE))
    if e['phase']=='distance':g.add(card('当前候选点 '+str(candidate+1)+' 距离',n(e['calculation']['result']) if after else '待检查',1.85,-.56,3.1,(TEAL if e['candidates'][0]['status']=='chosen' else RED) if after else BLUE))
    else:g.add(card('最近启动群组',n(s.get('group')),1.85,-.56,3.1,GOLD))
    queue=s.get('queue',[]);head=s.get('queueHead',0)
    label='扩展队列' if not queue or query in queue else '上一组队列记录'
    g.add(at(label+'：'+(' → '.join(str(i+1) for i in queue) or '尚无')+'   记录头位置 '+str(head+1 if queue else '—'),0,-1.53,19,BLUE,7.2))
    return foot(g,'局部窗外的点仍逐个检查；未访问、噪声、已分组不能混为一谈')

def principal(e,r,s,after,meta):
    g=canvas('原平面与一维投影账本',after);xy=axes(g,side=2.8,lo=0,hi=60)
    for x,y in s['data']:g.add(Dot(xy(x,y),radius=.07,color=TEAL))
    if 'meanX' in s:
        center=xy(s['meanX'],s['meanY']);g.add(Circle(radius=.10,color=GOLD).move_to(center))
        if 'direction' in s:
            v=np.array([*s['direction'],0]);g.add(Line(center-v*1.65,center+v*1.65,color=BLUE,stroke_width=3))
        g.add(at('中心 ('+n(s['meanX'])+', '+n(s['meanY'])+')',-1.9,1.55,18,GOLD,3.6))
    phase=e['phase']
    if phase=='project':
        vals=e['calculation']['values'];g.add(Circle(radius=.13,color=GOLD).move_to(xy(vals['x'],vals['y'])))
        g.add(card('当前原点',f"({n(vals['x'])}, {n(vals['y'])})",1.75,1.03,3.2),card('一维坐标 t',n(e['calculation']['result']) if after else '待投影',1.75,.19,3.2,BLUE),card('还原到平面',display(s['projectedPoint']) if after else '待记录',1.75,-.65,3.2,TEAL))
    elif 'covariance' in s:
        c=s['covariance'];g.add(card('协方差矩阵',f"[{n(c[0][0])}, {n(c[0][1])}; {n(c[1][0])}, {n(c[1][1])}]",1.75,1.03,3.2),card('两方向方差',' / '.join(n(x) for x in s['eigenvalues']),1.75,.19,3.2,TEAL),card('单位主方向',' / '.join(n(x) for x in s['direction']),1.75,-.65,3.2,BLUE))
    else:
        keys=['sumXX','sumXY','sumYY'] if phase in {'covariance','direction'} else ['sumX','sumY']
        labels=['横向平方和','横纵乘积和','纵向平方和'] if len(keys)==3 else ['横坐标累计','纵坐标累计']
        for i,(k,label) in enumerate(zip(keys,labels)):g.add(card(label,n(s.get(k)),1.75,1.03-i*.83,3.2))
    return foot(g,'主方向仅在求出后出现；本例共线所以一维可完整还原')

def network(e,r,s,after,meta):
    g=canvas('两输入 → 两个隐藏单元 → 一个输出',after);phase=e['phase'];v=e.get('calculation',{}).get('values',{})
    if phase=='update':
        ch=next(c for c in e['changes'] if c['target'] in {'hiddenWeights','outputWeights'})
        if ch['target']=='hiddenWeights':
            row=next(i for i,(a,b) in enumerate(zip(ch['before'],ch['after'])) if a!=b);old=ch['before'][row];new=ch['after'][row];grad=[v.get(k) for k in ['gx','gy','gBias']];label='隐藏单元'+str(row+1)
        else:
            old=ch['before'];new=ch['after'];label='输出单元'
            # The snapshot stores the completed batch sum, unchanged by this
            # parameter update. Divide once by the event's actual batch size.
            grad=[value/v['N'] for value in s['outputGradient']]
        g.add(at(label+'：旧值 − 学习率 × 平均梯度',0,1.4,23,TEAL,7.2))
        for j,(name,values) in enumerate([('旧值',old),('平均梯度',grad),('本步后' if after else '本步前',new if after else old)]):
            g.add(at(name,-2.9,.8-j*.75,19,MUTED,1.3))
            for i in range(3):g.add(card(['连接1','连接2','偏置'][i],n(values[i],5) if values is not None else '见累计 / N',-.9+i*1.75,.8-j*.75,1.62,TEAL if j==2 and after else INK))
        return foot(g,'平均梯度已除以批次人数；此处不再次除 N，也不重新计算梯度')
    if phase in {'evaluate','stop','loss'}:
        g.add(card('训练轮次',n(s.get('epoch')),0,1.02,5,TEAL),card('已记录训练损失',n(s.get('loss'),6),0,.19,5,GOLD))
        if phase=='evaluate':g.add(card('当前验证概率',n(v['probability'],6),-1.8,-.65,3.2,BLUE),card('当前验证预测',n(e['calculation']['result']) if after else '阈值 0.5 待判',1.8,-.65,3.2,TEAL))
        else:g.add(card('已验证正确数量',n(s.get('correct')),0,-.65,5,BLUE))
        return foot(g,'验证点只核对；不沿用上一个训练点的隐藏激活或概率')
    pos=[np.array([-2.85,.75,0]),np.array([-2.85,-.58,0])];hidden=[np.array([-.25,.75,0]),np.array([-.25,-.58,0])];output=np.array([2.55,.08,0])
    backward=phase=='gradient'
    for p in pos:
        for q in hidden:
            start=p+[.80,0,0];end=q+[-.95,0,0]
            g.add(Arrow(end,start,buff=.03,color=RED,stroke_width=2.1,tip_length=.12) if backward else Arrow(start,end,buff=.03,color=BLUE,stroke_width=2.1,tip_length=.12))
    for q in hidden:
        start=q+[.95,0,0];end=output+[-1.03,0,0]
        g.add(Arrow(end,start,buff=.03,color=RED,stroke_width=2.5,tip_length=.12) if backward else Arrow(start,end,buff=.03,color=TEAL,stroke_width=2.5,tip_length=.12))
    forward_ready=phase=='forward' and after
    activation=s.get('hiddenActivation') if forward_ready or backward else None
    # Some lessons spell the recorded vector 'activation'; use the exact key present.
    if activation is None and (forward_ready or backward):activation=s.get('activation')
    for i,p in enumerate(pos):g.add(card(['归一化 x','归一化 y'][i],n(v.get(['x','y'][i])),p[0],p[1],1.55,BLUE))
    for i,p in enumerate(hidden):
        values=(s.get('hiddenDelta') if after else None) if backward else activation
        g.add(card(('误差 δ' if backward else '隐藏 h')+str(i+1),n(values[i],5) if values else '待本点计算',p[0],p[1],1.85,RED if backward else TEAL))
    prob=v.get('probability') if backward else s.get('probability') if forward_ready else None
    g.add(card('输出误差 p − y' if backward else '输出概率 p',n(v.get('error') if backward else prob,5),output[0],output[1],2.0,RED if backward else GOLD))
    detail='仅累计梯度，参数还没有改变' if backward else '隐藏层 tanh；输出层 sigmoid；偏置也参与加权'
    if forward_ready:
        z=s.get('hiddenPreactivation',[])
        if len(z)==2:detail='加权值 z₁ = '+n(z[0],4)+'   z₂ = '+n(z[1],4)+'   输出 logit = '+n(v.get('logit'),4)
    g.add(at(detail,0,-1.28,18,MUTED,7.2))
    return foot(g,'红箭头表示反向链式求导；箭头动画不是实际数值变化')

def rank(e,r,s,after,meta):
    committed=e['phase']=='iteration' and after
    g=canvas('新账本完成 → 整体提交' if committed else '旧份额负责分配 · 新账本负责接收',after);points=[[-3.0,.82,0],[-1.0,.82,0],[-3.0,-.30,0],[-1.0,-.30,0]];points=[np.array(p) for p in points]
    init=r['trace']['events'][0];edges=next(c['after'] for c in init['changes'] if c['target']=='edges');active=None
    if e['phase']=='edge':
        m=re.search(r'([ABCD]).*?([ABCD])',e['action']);active=(ord(m[1])-65,ord(m[2])-65) if m else None
    for u,v in edges:
        delta=points[v]-points[u];unit=delta/np.linalg.norm(delta);offset=np.array([-unit[1],unit[0],0])*.07 if (v,u) in [tuple(x) for x in edges] else np.zeros(3)
        g.add(Arrow(points[u]+unit*.29+offset,points[v]-unit*.32+offset,buff=0,stroke_width=4 if active==(u,v) else 2,color=TEAL if active==(u,v) else RULE,tip_length=.16))
    for i,p in enumerate(points):g.add(Circle(radius=.27,stroke_color=TEAL if active and i in active else BLUE,fill_color=PANEL,fill_opacity=1).move_to(p),at(s['names'][i],p[0],p[1],26))
    outdegree=s.get('outdegree')
    g.add(at('出链数 '+('  '.join(name+':'+n(value) for name,value in zip(s['names'],outdegree)) if outdegree else '待记录'),-2,-.83,16,MUTED,3.7))
    old_label='已提交' if committed else '最终份额' if e['phase']=='result' else '旧份额'
    next_label='最后账本' if e['phase']=='result' else '新账本'
    g.add(at('页',.8,1.33,17,MUTED),at(old_label,1.75,1.33,17,BLUE),at(next_label,2.98,1.33,17,TEAL))
    for i in range(4):
        y=.86-i*.51;old=s.get('rank',[None]*4)[i];new=s.get('next',[None]*4)[i]
        # New-iteration dangling collection occurs before the next base reset.
        if e['phase'] in {'dangling','initialize'}:new=None
        g.add(at(s['names'][i],.8,y,23),at(n(old,5),1.75,y,23,BLUE,1.0),at(n(new,5),2.98,y,23,TEAL,1.0))
    delta=s.get('delta') if e['phase'] in {'difference','iteration','result'} else None
    g.add(card('无出链份额记录',n(s.get('dangling'),5),-1.95,-1.38,3.7,GOLD),card('本轮变化总量',n(delta,6),2,-1.38,3.4,TEAL))
    return foot(g,'每轮分配读取旧账；全部接收完成，才整体替换为新账')

def collaborative(e,r,s,after,meta):
    g=canvas('共同观众 → 物品相似 → 个人加权',after);scene=r['frames'][0]['scene'];names=scene['columnLabels'];matrix=scene['matrix'];phase=e['phase']
    if phase in {'neighbors','stop'}:
        for i,c in enumerate(e.get('candidates',[])[:3]):
            col=(TEAL if c['status']=='chosen' else RED) if after else BLUE;y=1.02-i*.93;v=c['values'];value=n(v.get('similarity',v.get('score')),5)
            g.add(card(c['target'],value,-1.75,y,3.2,col),at(('采用' if c['status']=='chosen' else '舍弃') if after else '待比较',.7,y+.13,23,col,1.2),at(c['reason'] if after else '读取已计算分数',1.7,y-.19,16,MUTED,3.3))
    elif phase in {'weight','predict'}:
        g.add(card('当前待推荐影片',names[s.get('target',1)],0,1.10,6.6,BLUE),card('加权分子',n(s.get('numerator'),5),-1.75,.24,3.2,TEAL),card('权重分母',n(s.get('weight'),5),1.75,.24,3.2,GOLD))
        if phase=='predict':g.add(card('预测评分',n(e['calculation']['result'],5) if after else '待除以总权重',0,-.69,5,TEAL))
        else:g.add(at(e['explanation'].split('：')[0]+'：个人评分 × 相似度',0,-.69,24,INK,7))
    else:
        target=current(e,s,'target');reference=current(e,s,'reference');target=1 if target is None else target;reference=0 if reference is None else reference
        g.add(at(names[reference],-2.10,1.42,17,TEAL,1.65),at(names[target],-.45,1.42,17,BLUE,1.65))
        m=re.search(r'观众(\d+)',e['action']);person=int(m[1])-1 if m else None
        for i,row in enumerate(matrix[:-1]):
            y=1.04-i*.31;active=i==person;col=RED if active and e.get('candidates',[{}])[0].get('status')=='rejected' else TEAL if active else INK
            g.add(at(str(i+1),-3.24,y,17,MUTED))
            for x,j in [(-2.10,reference),(-.45,target)]:g.add(at('缺失' if row[j]==0 else row[j],x,y,20,RED if row[j]==0 else col,1.4))
            if active:g.add(RoundedRectangle(width=3.1,height=.29,corner_radius=.03,stroke_color=col,stroke_width=2).move_to([-1.45,y,0]))
        # At the first pair event the state before belongs to the previous pair.
        newpair=any(c['target'] in {'target','reference'} and c['before']!=c['after'] for c in e['changes']);pending=newpair and not after
        vals=[('共同人数','coRaters'),('乘积累计','dot'),('两列平方和',None)]
        for i,(label,key) in enumerate(vals):g.add(card(label,'待本对累计' if pending else n(s.get(key)) if key else n(s.get('squareA'))+' / '+n(s.get('squareB')),2.02,1.03-i*.81,2.95,TEAL))
        if phase=='similarity':g.add(at('收缩后相似度 '+(n(e['calculation']['result'],5) if after else '待计算'),0,-1.56,22,GOLD,7))
    return foot(g,'缺失评分不参与；显示评分只来自输入，累计量只来自本步记录')

def content(e,r,s,after,meta):
    g=canvas('同维度相乘，再用长度归一化',after);phase=e['phase']
    names=[];vectors=[]
    for item in r['trace']['events']:
        if item['phase']=='dimension':
            m=re.search(r'^(.*?)的第(\d+)项',item['action']);p=re.search(r'点积增加([\d.]+)×([\d.]+)',item['explanation'])
            if m and p:
                if m[1] not in names:names.append(m[1]);vectors.append([None]*3)
                vectors[names.index(m[1])][int(m[2])-1]=float(p[2])
    if phase=='stop':
        for i,c in enumerate(e['candidates']):
            y=1.35-i*.43;score=c['values']['score'];col=GOLD if after and c['status']=='chosen' else BLUE
            g.add(at(c['target'],-2.35,y,17,col,2.35),Rectangle(width=3.0*score,height=.25,stroke_width=0,fill_color=col,fill_opacity=.8).move_to([-.8+3.0*score/2,y,0]),at(n(score,4),3.05,y,20,col,1.15))
    else:
        movie=current(e,s,'movie');movie=0 if movie is None else movie;dim=current(e,s,'dimension') if phase=='dimension' else None
        g.add(at('当前影片：'+names[movie],0,1.40,22,BLUE,7))
        for j,label in enumerate(['冒险','幽默','科学']):
            x=-.8+j*1.6;col=TEAL if dim==j else INK
            g.add(at(label,x,.97,18,MUTED),card('你的偏好',n(s['preference'][j]),x,.48,1.44,col),card('影片标签',n(vectors[movie][j]),x,-.29,1.44,col))
        newmovie=any(c['target']=='movie' and c['before']!=c['after'] for c in e['changes']);pending=newmovie and not after
        for i,(k,label) in enumerate([('dot','点积累计'),('squarePreference','偏好平方和'),('squareMovie','影片平方和')]):g.add(card(label,'本片待累计' if pending else n(s.get(k)),-2.4+i*2.4,-1.17,2.22,TEAL))
        if phase=='cosine':g.add(at('余弦 = '+(n(e['calculation']['result'],5) if after else '等待本步归一化'),-2.75,.23,18,GOLD,1.65))
    return foot(g,'本例标签非负，余弦在 0–1；全零向量没有方向，相似度不等于概率')

def intelligence_principle_visual(event,run,snapshot,show_after):
    algorithm=run['trace']['algorithmId']
    if algorithm not in SUPPORTED:return None
    rec=records(run)[event['id']];s=rec['after' if show_after else 'before'];meta=rec['metaAfter' if show_after else 'metaBefore']
    fn={'decision-tree':decision,'naive-bayes':bayes,'dbscan':density,'pca':principal,'neural-network':network,'pagerank':rank,'collaborative':collaborative,'content-recommendation':content}[algorithm]
    return fn(event,run,s,show_after,meta)
