"""Trace-only views for six optimization lessons; no search or scoring runs here.

The display reads stored operands, candidates and state changes.  Layout scaling,
rounding and summing recorded probabilities are presentation operations only.
"""
from __future__ import annotations
import copy,re
import numpy as np
from manim import Group,VGroup,Rectangle,RoundedRectangle,Circle,Line,Arrow
from visuals import text,paragraph,TEAL,GOLD,RED,MUTED,INK,PANEL,RULE,display
BLUE='#90B3FF'
SUPPORTED={'annealing','genetic','pso','ant-colony','simplex','branch-bound'}
_CACHE={}

def records(run):
    key=id(run)
    cached=_CACHE.get(key)
    if cached and cached[0] is run:return cached[1]
    state=copy.deepcopy(run['trace']['initialState']);result={}
    current_epoch=-1;bound_epoch=-2;vertex_epoch=-2
    for event in run['trace']['events']:
        before=copy.deepcopy(state);meta_before=(current_epoch,bound_epoch,vertex_epoch)
        if run['trace']['algorithmId']=='branch-bound' and event['phase']=='select':current_epoch=int(event['id'])
        for change in event['changes']:
            state[change['target']]=copy.deepcopy(change['after'])
            if change['target']=='bound':bound_epoch=current_epoch
            if change['target']=='vertex':vertex_epoch=current_epoch
        result[event['id']]={'before':before,'after':copy.deepcopy(state),'epochsBefore':meta_before,'epochsAfter':(current_epoch,bound_epoch,vertex_epoch)}
    _CACHE[key]=(run,result)
    return result

def _n(v):
    if v is None:return '尚未记录'
    if isinstance(v,(int,float)):return f'{v:.2f}'.rstrip('0').rstrip('.')
    return display(v)

def _at(label,x,y,size=22,color=INK,width=None):return text(label,size,color,width=width).move_to([x,y,0])
def _canvas(title,after):
    g=Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0))
    g.add(_at(title,-.3,1.87,21,INK,6.7),_at('之后' if after else '之前',3.39,1.87,16,MUTED,.7))
    return g

def _card(label,value,x,y,w=2.25,color=INK):
    return VGroup(RoundedRectangle(width=w,height=.70,corner_radius=.07,fill_color=PANEL,fill_opacity=1,stroke_color=RULE,stroke_width=1).move_to([x,y,0]),_at(label,x,y+.17,15,MUTED,w-.18),_at(value,x,y-.13,24,color,w-.2))

def _strip(g,label,values,y,colors=None):
    g.add(_at(label,-2.88,y,19,MUTED,1.4))
    count=max(len(values),1);w=min(.85,4.65/count)
    for i,v in enumerate(values):
        x=-1.83+w*(i+.5);col=(colors or {}).get(i,INK)
        g.add(RoundedRectangle(width=w-.07,height=.46,corner_radius=.05,stroke_color=col,stroke_width=2,fill_color=PANEL,fill_opacity=1).move_to([x,y,0]),_at('空' if v==-1 else str(v+1),x,y,24,col,w-.12))

def _genetic(e,r,s,after):
    g=_canvas('路线由城市排列组成 · 每城一次',after);phase=e['phase']
    if phase in {'cross','mutate','offspring'} and 'parentA' in s:
        lo,hi=s.get('lo',0),s.get('hi',-1)
        colors={i:TEAL for i in range(lo,hi+1)}
        count=len(s['parentA']);w=min(.85,4.65/max(count,1))
        for i in range(count):g.add(_at(f'第{i+1}位',-1.83+w*(i+.5),1.58,14,MUTED,w-.08))
        _strip(g,'父 A',s['parentA'],1.18,colors);_strip(g,'父 B',s['parentB'],.51)
        child=s.get('child',[]);changed=[]
        for ch in e['changes']:
            if ch['target']=='child' and isinstance(ch['before'],list):changed=[i for i,(a,b) in enumerate(zip(ch['before'],ch['after'])) if a!=b]
        ccolors={i:GOLD for i in changed};rejected=[c for c in e.get('candidates',[]) if c['status']=='rejected']
        for c in rejected:
            for i,v in enumerate(child):
                if str(v+1)==c['target']:ccolors[i]=RED
        _strip(g,'子代',child,-.16,ccolors)
        g.add(_at('青色：父 A 保留区间   橙色：本步改动',0,-.58 if phase=='offspring' else -.71,15 if phase=='offspring' else 17,MUTED,7))
        if phase=='offspring':g.add(_card('这条子代的已记录闭环长度',_n(s.get('childLength')) if after else '本步将登记',0,-1.15,5,GOLD))
        elif rejected:g.add(_at('城市 '+rejected[0]['target']+' 已出现 → 跳过',0,-1.15,23,RED,7))
        else:g.add(_at('交换保留每城一次；合法不保证更短' if phase=='mutate' else '空位尚未填满，继续补入未出现城市' if -1 in child else '每城已出现一次；还要计算完整路线长度',0,-1.15,18,MUTED,7))
        index_note='记录的位置索引从0开始；上方标尺从第1位开始'
        if phase=='cross' and e['action']=='选定保序交叉区间':index_note=f'记录区间 [{lo},{hi}] = 第{lo+1}至第{hi+1}位（含两端）'
        elif phase=='cross' and e['action']=='复制父A片段':
            match=re.search(r'子代位置(\d+)',e['explanation'])
            if match:index_note=f'记录位置 {match[1]} = 第{int(match[1])+1}位'
        elif phase=='mutate' and e['action']=='交换突变':
            match=re.search(r'交换位置(\d+)与(\d+)',e['explanation'])
            if match:index_note=f'记录位置 {match[1]}、{match[2]} = 第{int(match[1])+1}、第{int(match[2])+1}位'
        if phase!='offspring':g.add(_at(index_note,0,-1.56,16,TEAL,7))
    elif phase=='tournament' and e.get('calculation'):
        vals=e['calculation']['values'];g.add(_card('挑战者长度',_n(vals.get('challenger')),-1.8,.85,3,BLUE),_card('原胜者长度',_n(vals.get('incumbent')),1.8,.85,3,GOLD),_at('长度更短才替换；同长保留原胜者',0,.05,23,TEAL,7))
        g.add(_card('本次比较后的长度',_n(e['calculation']['result']),0,-.75,4,TEAL))
    elif phase=='rank' and e.get('candidates'):
        for i,c in enumerate(e['candidates'][:6]):
            x=-2.43+(i%3)*2.43;y=1.04-(i//3)*1.03
            g.add(_card(c['target'],_n(c.get('values',{}).get('length')),x,y,2.22,TEAL if c['status']=='chosen' else BLUE))
        g.add(_at('本代最短获精英保留；其他候选仍可抽中',0,-1.20,18,MUTED,7))
    else:
        _strip(g,'已见最好',s['best'],.89)
        g.add(_card('闭环长度',_n(s['bestLength']),-1.7,-.12,3,GOLD),_card('已评估代数',str(s['generation']),1.7,-.12,3,TEAL),_at('最后回到出发城；当前最好不等于全局最优',0,-1.12,18,MUTED,7))
    g.add(_at('正式案例数字来自计算记录',0,-1.85,15,MUTED,7));return g

def _matrix(g,m,y=1.05,active=None,labels=None,cellw=.86,cellh=.45,x0=-1.1):
    if not m:return
    n=len(m[0]);labels=labels or [str(i+1) for i in range(n)]
    for j,label in enumerate(labels):g.add(_at(label,x0+j*cellw,y+.42,17,MUTED,cellw-.06))
    for i,row in enumerate(m):
        for j,v in enumerate(row):
            x=x0+j*cellw;yy=y-i*cellh;col=TEAL if (i,j) in (active or set()) else INK
            g.add(Rectangle(width=cellw-.035,height=cellh-.025,stroke_color=col if col==TEAL else RULE,stroke_width=2 if col==TEAL else 1,fill_color=PANEL,fill_opacity=1).move_to([x,yy,0]),_at(_n(v),x,yy,21,col,cellw-.1))

def _ant(e,r,s,after):
    g=_canvas('蚂蚁的本次选择与信息素账本',after);candidates=e.get('candidates',[])
    if candidates and all('probability' in c.get('values',{}) for c in candidates):
        route=s.get('route',[]);g.add(_at('已走：'+' → '.join(str(v+1) for v in route),0,1.37,20,TEAL,7))
        for i,c in enumerate(candidates):
            y=.90-i*.72;p=c['values']['probability'];chosen=c['status']=='chosen';col=TEAL if chosen else BLUE
            g.add(_at('城市 '+c['target'],-2.87,y,22,col,1.3))
            g.add(Rectangle(width=3.7,height=.34,fill_color=RULE,fill_opacity=1,stroke_width=0).move_to([-.2,y,0]))
            if p>0:g.add(Rectangle(width=3.7*p,height=.34,fill_color=col,fill_opacity=1,stroke_width=0).move_to([-2.05+3.7*p/2,y,0]))
            g.add(_at(f'{p*100:.2f}%',2.77,y,22,col,1.4),_at('抽中' if chosen else '本步未抽中',-2.87,y-.27,12,col,1.45))
        vals=e['calculation']['values'];offset=0
        for c in candidates:
            prob=c['values']['probability'];col=TEAL if c['status']=='chosen' else BLUE
            g.add(Rectangle(width=max(6.5*prob,.001),height=.21,stroke_color=INK,stroke_width=1,fill_color=col,fill_opacity=.8 if c['status']=='chosen' else .35).move_to([-3.25+6.5*(offset+prob/2),-1.29,0]));offset+=prob
        x=-3.25+6.5*vals['draw'];g.add(Line([x,-1.1,0],[x,-1.49,0],color=GOLD,stroke_width=4))
        chosen=next(c['target'] for c in candidates if c['status']=='chosen')
        g.add(_at(f"累计概率轴：r = {vals['draw']:.4f} 落入城市 {chosen} 区间",0,-1.84,18,INK,7))
    elif e['phase'] in {'evaporate','deposit'}:
        changed=set();ch=next((x for x in e['changes'] if x['target']=='pheromone'),None)
        if ch:
            for i,row in enumerate(ch['after']):
                for j,v in enumerate(row):
                    if v!=ch['before'][i][j]:changed.add((i,j))
        _matrix(g,s['pheromone'],1.02,changed,cellw=.9,cellh=.53,x0=-2.5)
        for i in range(4):g.add(_at(str(i+1),-3.14,1.02-i*.53,20,MUTED))
        g.add(_at('信号强度 τ',2.15,1.13,22,TEAL,2.3))
        if e['phase']=='deposit':
            vals=e['calculation']['values'];g.add(_card('本只闭环长度',_n(vals['length']),2.12,.39,2.6),_card('每条经过边增加',_n(e['calculation']['result']),2.12,-.5,2.6,GOLD))
            route=next((ch['after'] for ch in e['changes'] if ch['target']=='depositRoute'),s.get('depositRoute',[]));g.add(_at('本次路线：'+' → '.join(str(v+1) for v in route+route[:1]),0,-1.47,23,GOLD,7))
        else:g.add(_card('全部边统一乘',_n(e['calculation']['result']),2.12,.12,2.6,TEAL),_at('蒸发削弱旧信号；不直接决定下一条路',0,-1.47,19,MUTED,7))
        g.add(_at('青框为本步数值改变的格；双向存储分别显示',0,-1.87,16,MUTED,7))
    else:
        _strip(g,'当前路线',s.get('route',[]) or [-1],.88)
        _strip(g,'已见最好',s.get('best',[]),.0)
        g.add(_card('最好闭环长度',_n(s.get('bestLength')),0,-1.15,4,GOLD))
    return g

def _anneal(e,r,s,after):
    g=_canvas('当前位置与历史最好分开保存',after)
    g.add(_card('当前位置',_n(s['position']),-2.4,1.12,2.23,TEAL),_card('最好位置',_n(s['best']),0,1.12,2.23,GOLD),_card('当前温度',_n(s['temperature']),2.4,1.12,2.23,BLUE))
    calc=e.get('calculation',{});vals=calc.get('values',{})
    if 'draw' in vals:
        g.add(_card('原收益',_n(vals['oldValue']),-1.75,.20,3,INK),_card('候选收益',_n(vals['newValue']),1.75,.20,3,INK))
        p=calc['result'];g.add(Rectangle(width=6.5,height=.37,stroke_width=0,fill_color=RULE,fill_opacity=1).move_to([0,-.65,0]))
        if p>0:g.add(Rectangle(width=6.5*p,height=.37,stroke_width=0,fill_color=TEAL,fill_opacity=.75).move_to([-3.25+6.5*p/2,-.65,0]))
        g.add(_at('0',-3.25,-.97,17,MUTED),_at('1',3.25,-.97,17,MUTED),_at('接受概率 p = '+f'{p:.4f}',0,-.28,20,TEAL,6.5))
        draw=vals['draw'];chosen=any(c['status']=='chosen' for c in e.get('candidates',[]))
        if isinstance(draw,(int,float)):
            x=-3.25+6.5*draw;col=TEAL if chosen else RED;g.add(Line([x,-.43,0],[x,-.9,0],color=col,stroke_width=4),_at('r = '+f'{draw:.4f}'+'  '+('接受' if chosen else '拒绝'),0,-1.30,24,col,7))
        else:g.add(_at('收益改善，无需抽签',0,-1.30,24,TEAL,7))
        g.add(_at('本步先比较候选；接受后由记忆步骤提交位置',0,-1.86,16,MUTED,7))
    else:
        g.add(_card('历史最好收益',_n(s['bestValue']),0,.05,4,GOLD))
        g.add(paragraph(e['explanation'],width=6.9,size=22,color=INK).move_to([0,-1.05,0]))
    return g

def _pso(e,r,s,after):
    g=_canvas('速度：惯性 + 个人牵引 + 群体牵引',after)
    if e['phase']=='move':
        vals=e['calculation']['values'];match=re.search(r'惯性([-\d.]+)＋个人牵引([-\d.]+)＋群体牵引([-\d.]+)',e['explanation'])
        if match:
            labels=['惯性','个人牵引','群体牵引']
            for i,v in enumerate(match.groups()):g.add(_card(labels[i],v,-2.4+i*2.4,1.02,2.2,[BLUE,TEAL,GOLD][i]))
        g.add(_card('合计速度',_n(vals['raw']),-1.75,.05,3,INK),_card('限幅后速度',_n(e['calculation']['result']),1.75,.05,3,TEAL))
        g.add(_at('个人最好 '+_n(vals['personal'])+' ｜ 原位置 '+_n(vals['oldX'])+' ｜ 群体最好 '+_n(vals['global']),0,-.73,18,MUTED,7.15))
        i=int(e.get('focus',['0'])[0]);g.add(_card('粒子 '+str(i+1)+' 的已记录位置',_n(s['positions'][i]),0,-1.48,5,TEAL))
    else:
        for i,x in enumerate(s.get('positions',[])):
            g.add(_card('粒子 '+str(i+1)+' 位置',_n(x),-2.4+i*2.4,.98,2.2,TEAL),_card('个人最好',_n(s['personal'][i]),-2.4+i*2.4,.08,2.2,BLUE))
        g.add(_card('群体最好位置',_n(s['best']),-1.75,-1.02,3,GOLD),_card('群体最好收益',_n(s['bestValue']),1.75,-1.02,3,GOLD))
        g.add(_at('更差的新尝试，不会覆盖更好的历史记忆',0,-1.85,17,MUTED,7))
    return g

def _simplex(e,r,s,after):
    g=_canvas('等式账本 · '+('逐格更新中' if e['phase']=='pivot' else '已记录状态'),after);m=s['table'];active=set()
    for ch in e['changes']:
        if ch['target']=='table':
            active={(i,j) for i,row in enumerate(ch['after']) for j,v in enumerate(row) if v!=ch['before'][i][j]}
    if e['phase']=='enter' and e.get('candidates'):active={(4,int(e['candidates'][0]['target']))}
    if e['phase']=='leave' and e.get('candidates'):active={(int(e['candidates'][0]['target']),j) for j in [s.get('enter',0),6]}
    labels=['甲','乙','余1','余2','余3','余4','右侧'];_matrix(g,m,y=1.05,active=active,labels=labels,cellw=.84,cellh=.48,x0=-2.15)
    for i in range(5):g.add(_at('目标' if i==4 else labels[s['basis'][i]],-3.25,1.05-i*.48,19,GOLD if i==4 else MUTED,.9))
    enter=s.get('enter');leave=s.get('leave');et=labels[enter] if enter is not None and enter>=0 else '无';lt=str(leave+1) if leave is not None else '待定'
    g.add(_at('入基候选：'+et+'   离基资源行：'+lt+'   换基次数：'+str(s.get('pivots',0)),0,-1.53,19,TEAL,7.3))
    g.add(_at('行列索引从0计；末行为目标、末列为右侧。青框为当前格。',0,-1.91,15,MUTED,7.3));return g

def _branch(e,r,s,after,meta):
    g=_canvas('乐观上界与可行整数纪录',after);current,bound_epoch,vertex_epoch=meta
    bound_valid=current==bound_epoch and current>=0
    infeasible=e['phase']=='prune' and not e.get('calculation')
    upper='不可行' if infeasible else _n(s.get('bound')) if bound_valid else '本支尚未求完'
    g.add(_card(('等待取分支' if s.get('current',-1)<0 else '分支 '+str(s['current']))+(' · 角点最高暂存' if e['phase']=='bound' else ' · 连续上界'),upper,-1.78,1.05,3.35,RED if infeasible else BLUE),_card('全程已可生产的收益',_n(s['best']),1.78,1.05,3.35,GOLD))
    phase=e['phase'];vals=e.get('calculation',{}).get('values',{})
    if phase=='branch':
        axis='甲' if e['explanation'].startswith('A=') else '乙'
        g.add(_at(axis+' = '+_n(vals.get('relaxed'))+' 含小数',0,.37,22,INK,7))
        g.add(_card('低分支',axis+' ≤ '+_n(vals.get('low')),-1.78,-.37,3.35,TEAL),_card('高分支',axis+' ≥ '+_n(vals.get('high')),1.78,-.37,3.35,BLUE))
        g.add(_at('整数全在两侧；中间没有遗漏的整数',0,-1.12,21,INK,7))
    elif phase in {'intersection','feasibility'}:
        vertex=s.get('vertex') if current==vertex_epoch else None
        if 'x' in vals and 'y' in vals:vertex=[vals['x'],vals['y']]
        g.add(_at('正在检查的交点：'+('尚未登记' if vertex is None else '甲 '+_n(vertex[0])+'，乙 '+_n(vertex[1])),0,.27,23,TEAL,7))
        if 'lhs' in vals:g.add(_card('代入左侧',_n(vals['lhs']),-1.78,-.57,3.35,INK),_card('限制右侧',_n(vals['rhs']),1.78,-.57,3.35,RED if e['calculation']['result']=='拒绝' else TEAL))
        else:g.add(_at('求出交点后，还必须逐条验证全部限制',0,-.55,20,MUTED,7))
    elif phase=='bound':
        g.add(_at('本次角点：甲 '+_n(vals.get('A'))+'，乙 '+_n(vals.get('B')),0,.27,23,TEAL,7))
        g.add(_card('该角点收益',_n(e['calculation']['result']),0,-.57,5,TEAL))
    elif phase=='prune':
        g.add(_at('连续放松不可行 → 整数也不可行' if infeasible else _n(vals['upperBound'])+' ≤ '+_n(vals['incumbent'])+' → 不能改善',0,.1,26,RED,7))
        g.add(_at('整支停止继续探索',0,-.67,24,RED,7))
    else:
        p=s.get('relaxedSolution') if bound_valid else None
        g.add(_at('本支放松解：'+('尚未求完' if p is None else '甲 '+_n(p[0])+'，乙 '+_n(p[1])),0,.20,22,BLUE,7))
        p=s['solution'];g.add(_at('可行整数纪录：甲 '+_n(p[0])+'，乙 '+_n(p[1]),0,-.51,24,GOLD,7))
    g.add(_at('待查栈：'+(', '.join(map(str,s['pending'])) or '空')+'     已剪枝 '+str(s['pruned']),0,-1.64,19,MUTED,7));return g

def optimization_principle_visual(event,run,snapshot,show_after):
    algorithm=run['trace']['algorithmId']
    if algorithm not in SUPPORTED:return None
    rec=records(run)[event['id']];state=rec['after' if show_after else 'before']
    if algorithm=='genetic':return _genetic(event,run,state,show_after)
    if algorithm=='ant-colony':return _ant(event,run,state,show_after)
    if algorithm=='annealing':return _anneal(event,run,state,show_after)
    if algorithm=='pso':return _pso(event,run,state,show_after)
    if algorithm=='simplex':return _simplex(event,run,state,show_after)
    return _branch(event,run,state,show_after,rec['epochsAfter' if show_after else 'epochsBefore'])
