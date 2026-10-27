"""Readable graph teaching views. Every value is replayed from the immutable trace.

No path finding, union/find, topological scheduling, or degree recomputation occurs
here. Positions are drawn from the original Scene; labels and edges retain IDs.
"""
from __future__ import annotations
import copy
import numpy as np
from manim import Group,VGroup,Rectangle,RoundedRectangle,Circle,Line,Arrow
from visuals import text,TEAL,GOLD,RED,MUTED,INK,PANEL,RULE,display

BLUE='#90B3FF'

def _record(event,run,after):
    state=copy.deepcopy(run['trace']['initialState'])
    for item in run['trace']['events']:
        if item['id']==event['id'] and not after:break
        for change in item['changes']:state[change['target']]=copy.deepcopy(change['after'])
        if item['id']==event['id']:break
    return state

def _badge(label,value,x,y,width=2.35,color=INK):
    box=RoundedRectangle(width=width,height=.63,corner_radius=.09,fill_color=PANEL,fill_opacity=1,stroke_color=RULE,stroke_width=1).move_to([x,y,0])
    return VGroup(box,text(label,15,MUTED,width=width-.18).move_to([x,y+.16,0]),text(value,22,color,width=width-.18).move_to([x,y-.12,0]))

def _graph(snapshot,event,state,algorithm,after):
    # The map fills the left 4.65 units; the right 2.5 units hold recorded values.
    nodes=snapshot.get('nodes',[]);edges=snapshot.get('edges',[])
    labels={n['id']:n.get('label',n['id']) for n in nodes}
    xs=[n['x'] for n in nodes];ys=[n['y'] for n in nodes]
    dx=max(max(xs)-min(xs),1);dy=max(max(ys)-min(ys),1)
    positions={n['id']:np.array([-3.25+(n['x']-min(xs))/dx*3.75,1.46-(n['y']-min(ys))/dy*2.16,0]) for n in nodes}
    group=VGroup();focus=list(map(str,event.get('focus',[])))
    active_pair=set(focus) if len(focus)==2 else set()
    # A union/find focus pair means queried vertex and representative. It is
    # not a physical road, even if the same endpoints happen to have an edge.
    if algorithm=='kruskal' and event.get('ruleId')!='kruskal.choose':active_pair=set()
    chosen=set(state.get('chosen',[]));done=set(map(str,state.get('done',[])));ready=set(map(str,state.get('ready',[])))
    rejected=any(c.get('status')=='rejected' for c in event.get('candidates',[]))
    for edge in edges:
        u=str(edge['from']);v=str(edge['to']);start=positions[u];end=positions[v]
        vector=end-start;length=np.linalg.norm(vector);unit=vector/max(length,.001)
        is_active={u,v}==active_pair and (algorithm!='topological' or focus==[u,v])
        is_chosen=(u+'-'+v in chosen or v+'-'+u in chosen)
        color=(RED if rejected and after else TEAL) if is_active else GOLD if is_chosen else '#657F92'
        stroke=4.5 if is_active or is_chosen else 2.2
        if edge.get('directed'):
            line=Arrow(start+unit*.3,end-unit*.32,buff=0,stroke_width=stroke,color=color,max_tip_length_to_length_ratio=.15,tip_length=.16)
        else:line=Line(start+unit*.3,end-unit*.3,stroke_width=stroke,color=color)
        group.add(line)
        if edge.get('label') is not None:
            # Offset cost text normal to the segment so it cannot hide the road.
            at=(start+end)/2+np.array([-unit[1],unit[0],0])*.14
            label=text(str(edge['label']),21,color)
            backing=RoundedRectangle(width=max(.28,label.width+.12),height=.29,corner_radius=.04,fill_color=PANEL,fill_opacity=1,stroke_width=0).move_to(at)
            group.add(backing,label.move_to(at))
    for node in nodes:
        nid=node['id'];point=positions[nid]
        color=TEAL if nid in focus else GOLD if algorithm=='topological' and nid in done else BLUE if algorithm=='topological' and nid in ready else INK
        circ=Circle(radius=.30,stroke_color=color,stroke_width=3,fill_color=PANEL,fill_opacity=1).move_to(point)
        label=text(labels[nid],27,color,width=.5).move_to(point)
        group.add(circ,label)
    return group,labels

def graph_principle_visual(event,run,snapshot,show_after):
    """Return a centered 7.6×4.25 view for supported graph/matching lessons, otherwise None."""
    algorithm=run['trace']['algorithmId']
    if algorithm=='hungarian':return _hungarian(event,run,snapshot,show_after)
    if algorithm not in {'kruskal','topological'} or snapshot.get('kind')!='graph' or not snapshot.get('nodes'):return None
    state=_record(event,run,show_after)
    graph,labels=_graph(snapshot,event,state,algorithm,show_after)
    body=Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0),graph)
    name=lambda i:labels.get(str(i),str(i))
    stage='本步之后' if show_after else '本步之前'
    if algorithm=='topological':
        body.add(text('剩余前置数 · '+stage,18,MUTED,width=2.55).move_to([2.3,1.77,0]))
        done=set(state['done']);ready=state['ready']
        for i,value in enumerate(state['degree']):
            y=1.30-i*.43
            status='完成' if i in done else '可做' if i in ready else '等待'
            color=GOLD if i in done else BLUE if i in ready else INK
            card=RoundedRectangle(width=2.55,height=.37,corner_radius=.06,stroke_color=RULE,fill_color=PANEL,fill_opacity=1).move_to([2.3,y,0])
            body.add(card,text(name(i),21,color).move_to([1.35,y,0]),text(str(value),24,color).move_to([2.1,y,0]),text(status,17,color).move_to([2.95,y,0]))
        queue=' → '.join(name(i) for i in ready) if ready else '空'
        body.add(_badge('可做队列 · 左端先取',queue,-1.8,-1.58,3.8,BLUE))
        body.add(_badge('已完成顺序',' → '.join(name(i) for i in state['done']) or '尚无',2.1,-1.58,3.4,GOLD))
        body.add(text('青色：本步涉及 · 橙色：已完成 · 蓝色：可做',16,MUTED,width=7.5).move_to([0,-2.02,0]))
    else:
        body.add(_badge('已经选中 · '+stage,str(len(state['chosen']))+' 条边    总费 '+display(state['total']),2.2,1.44,2.75,GOLD))
        body.add(text('组长指针 · 不是道路',17,MUTED,width=2.7).move_to([2.2,.88,0]))
        pointer_focus=set(map(str,event.get('focus',[]))) if event.get('ruleId')=='kruskal.find' else set()
        changed_parent=next((c for c in event.get('changes',[]) if c['target']=='parent'),None)
        for i,parent in enumerate(state['parent']):
            changed=show_after and changed_parent and changed_parent['before'][i]!=changed_parent['after'][i]
            color=TEAL if str(i) in pointer_focus or changed else INK
            body.add(text(name(i)+'  →  '+name(parent),22,color,width=2.6).move_to([2.2,.53-i*.32,0]))
        values=event.get('calculation',{}).get('values',{})
        if 'rootU' in values:
            root_text=name(values['rootU'])+' 与 '+name(values['rootV'])
            body.add(_badge('本次查得的两端代表',root_text,-1.8,-1.58,3.8,TEAL))
            result=event['calculation']['result'] if show_after else '等待比较结果'
            body.add(_badge('跨组才加入',result,2.1,-1.58,3.4,RED if result=='拒绝' else GOLD if result=='接受' else MUTED))
        elif event.get('phase')=='initialize':
            ordered=[]
            for item in state.get('edgeOrder',[]):
                edge,cost=item.split(':');u,v=edge.split('-');ordered.append(name(u)+name(v)+' '+cost)
            body.add(_badge('按费用排序 · 同价保持输入顺序',' · '.join(ordered) or '尚未排序',0,-1.58,7.3,INK))
        else:
            selected=['—'.join(name(k) for k in edge.split('-')) for edge in state['chosen']]
            body.add(_badge('已选道路（真实记录）','，'.join(selected) or '尚无',0,-1.58,7.3,GOLD))
        body.add(text('青色：查询节点/候选边 · 橙色：已选道路 · 红色：拒绝',16,MUTED,width=7.5).move_to([0,-2.02,0]))
    return body


def _value_strip(label,values,names,x,y,width=3.1,colors=None):
    box=RoundedRectangle(width=width,height=.69,corner_radius=.07,fill_color=PANEL,fill_opacity=1,stroke_color=RULE,stroke_width=1).move_to([x,y,0])
    group=VGroup(box,text(label,15,MUTED,width=width-.18).move_to([x,y+.19,0]))
    for i,(name,value) in enumerate(zip(names,values)):
        at=x+(i-(len(names)-1)/2)*(width-.18)/len(names)
        color=(colors or {}).get(i,INK)
        group.add(text(name+': '+display(value),20,color,width=(width-.28)/len(names)).move_to([at,y-.12,0]))
    return group

def _hungarian_context(event,run,after):
    """Project the immutable records. Arithmetic below is presentation, not a new search."""
    before=_record(event,run,False); completed=_record(event,run,True)
    state=completed if after else before
    matrix=run['frames'][0]['scene']['matrix']
    assert len(matrix)==3 and all(len(row)==3 for row in matrix)
    values=event.get('calculation',{}).get('values',{})
    if event.get('phase')=='reduced' and 'cost' in values:
        assert values['cost']-values['u']-values['v']==event['calculation']['result']
    updates=[]
    for c in event.get('changes',[]):
        if c['target'] not in ('u','v','minv'):continue
        if not isinstance(c['before'],list):continue
        for i,(old,new) in enumerate(zip(c['before'],c['after'])):
            if old!=new:updates.append((c['target'],i,old,new))
    reduced=[[matrix[i][j]-state['u'][i+1]-state['v'][j+1] for j in range(3)] for i in range(3)]
    certificate=None
    if event.get('phase')=='stop':
        match=state['match'];costs=[matrix[match[j]-1][j-1] for j in range(1,4)]
        rows=sum(state['u'][1:]);columns=sum(state['v'][1:]);total=sum(costs)
        assert all(value>=0 for row in reduced for value in row)
        assert all(reduced[match[j]-1][j-1]==0 for j in range(1,4))
        assert rows+columns==total==completed['total']
        certificate={'rowSum':rows,'columnSum':columns,'bound':rows+columns,'costs':costs,'total':total}
    return {'state':state,'before':before,'completed':completed,'matrix':matrix,'reduced':reduced,'updates':updates,'certificate':certificate}


def _hungarian_note(value,x,y,width=7.3,size=18,color=INK,key=''):
    label=text(value,size,color,width=width).move_to([x,y,0])
    label._motion_key='label:hungarian:'+key
    return label


def _hungarian(event,run,snapshot,after):
    """Original costs, real bookkeeping updates, and the final dual certificate."""
    if snapshot.get('kind')!='matrix' or len(snapshot.get('matrix',[]))!=3:return None
    context=_hungarian_context(event,run,after)
    state=context['state'];before=context['before'];matrix=context['matrix'];cert=context['certificate']
    names=['甲','乙','丙'];match=state['match'];focus=set(map(str,event.get('focus',[])))
    phase=event.get('phase');values=event.get('calculation',{}).get('values',{})
    body=Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0))
    heading='原工时 / 约化成本' if cert else '原工时表 · 始终不变'
    body.add(_hungarian_note(heading,-1.92,1.86,3.8,19,key='left-title'))
    body.add(_hungarian_note('最优依据' if cert else '比较账 · '+('本步之后' if after else '本步之前'),2.08,1.86,3.2,18,MUTED,'right-title'))
    for j in range(3):body.add(_hungarian_note('任务'+str(j+1),-2.74+j,1.34,.9,16,MUTED,'column-'+str(j)))
    for i in range(3):
        y=.85-i*.61
        body.add(_hungarian_note(names[i],-3.49,y,.5,24,key='row-'+str(i)))
        for j in range(3):
            current=str(i*3+j) in focus;selected=match[j+1]==i+1
            color=TEAL if current else GOLD if selected else RULE
            box=RoundedRectangle(width=.93,height=.55,corner_radius=.045,fill_color=PANEL,fill_opacity=1,stroke_color=color,stroke_width=3 if current or selected else 1).move_to([-2.74+j,y,0]);box._motion_key=f'hungarian:cell:{i}:{j}'
            val=str(matrix[i][j])+(' / '+str(context['reduced'][i][j]) if cert else '')
            body.add(box,_hungarian_note(val,-2.74+j,y,.84,20 if cert else 26,TEAL if current else GOLD if selected else INK,f'value:{i}:{j}'))
    if cert:
        rows=' + '.join(display(v) for v in state['u'][1:])+' = '+display(cert['rowSum'])
        columns=' + '.join('('+display(v)+')' if v<0 else display(v) for v in state['v'][1:])+' = '+display(cert['columnSum'])
        body.add(_badge('各行势之和',rows,2.08,1.17,3.16,TEAL),_badge('真实任务列势之和',columns,2.08,.36,3.16,TEAL),_badge('每种完整分配的下界',display(cert['rowSum'])+' − '+display(-cert['columnSum'])+' = '+display(cert['bound']),2.08,-.45,3.16,GOLD))
    else:
        for key,label,y,labels in [('u','行势 u',1.17,names),('v','真实任务的列势 v',.36,['1','2','3']),('minv','各任务保留的最小余量',-.45,['1','2','3'])]:
            vals=state.get(key,[None]*4)[1:4];prior=before.get(key,[None]*4)[1:4]
            colors={i:TEAL for i,(old,new) in enumerate(zip(prior,vals)) if after and old!=new}
            body.add(_value_strip(label,vals,labels,2.08,y,3.16,colors))
    current_match=' · '.join('任务'+str(j)+' '+(names[match[j]-1] if match[j] else '空') for j in range(1,4))
    body.add(_hungarian_note('已落实：'+current_match,0,-1.04,7.3,17,GOLD,'matching'))
    new_member=names[match[0]-1] if match[0] else '尚无';used=state.get('used',[False]*4)
    tree='、'.join(str(j) for j in range(1,4) if used[j]) or '尚无'
    if cert:
        formula=' + '.join(display(v) for v in cert['costs'])+' = '+display(cert['total'])
        body.add(_hungarian_note('所有约化成本 ≥ 0；已选三格均为 0',0,-1.46,7.3,21,TEAL,'proof-nonnegative'))
        body.add(_hungarian_note('已选工时 '+formula+'，达到下界 → 总成本最优',0,-1.88,7.3,21,GOLD,'proof-equality'))
    elif phase=='adjust':
        delta=values['delta'];lines=[]
        for key,i,old,new in context['updates']:
            name=('行势 '+names[i-1]) if key=='u' and i else ('入口辅助账（非任务）' if key=='v' and i==0 else '任务'+str(i)+('列势' if key=='v' else '余量'))
            sign=' + ' if key=='u' else ' − '
            lines.append(name+'：'+display(old)+sign+display(delta)+' = '+display(new))
        for j,line in enumerate(lines[:2]):body.add(_hungarian_note(('本步计算  ' if not after else '本步已写入  ')+line,0,-1.46-j*.40,7.3,20,TEAL if after else INK,'update-'+str(j)))
        if len(lines)==1:body.add(_hungarian_note('同一调整量；剩余任务逐项更新',0,-1.86,7.3,17,MUTED,'adjust-rule'))
    elif phase=='reduced' and 'cost' in values:
        old=values['old'];new=event['calculation']['result'];better=not isinstance(old,(int,float)) or new<old
        kept=new if better else old
        comparison=display(new)+(' < ' if better else ' ≥ ')+display(old)+' → '+('更新为 ' if better else '保留 ')+display(kept)
        body.add(_hungarian_note('新报价与旧记录：'+comparison,0,-1.46,7.3,22,TEAL if better else GOLD,'reduced-compare'))
        way=context['completed'].get('way',[0]*4)
        body.add(_hungarian_note('本轮新队员 '+new_member+'；已入树任务 '+tree+'；探索还未落实换岗',0,-1.86,7.3,16,MUTED,'search-state'))
    elif phase in ('advance','augment'):
        col=context['completed'].get('column',0)
        if phase=='augment':
            change=next(c for c in event['changes'] if c['target']=='match')
            col=next(j for j in range(1,4) if change['before'][j]!=change['after'][j])
            who=names[change['after'][col]-1]
            desc='任务'+str(col)+'：'+('空位' if not change['before'][col] else names[change['before'][col]-1])+' → '+who
            body.add(_hungarian_note(('沿前驱链落实  ' if after else '本步将落实  ')+desc,0,-1.46,7.3,22,GOLD,'augment'))
        else:
            who=context['completed']['match'][col]
            desc='任务'+str(col)+('已有'+names[who-1]+' → 沿他继续找替代' if who else '为空 → 可以增广')
            body.add(_hungarian_note(desc,0,-1.46,7.3,22,TEAL,'advance'))
        body.add(_hungarian_note('前驱记录：'+' · '.join(str(j)+'←'+('入口' if state['way'][j]==0 else str(state['way'][j])) for j in range(1,4)),0,-1.86,7.3,18,MUTED,'predecessors'))
    else:
        body.add(_badge('本轮新队员 / 已入树任务',new_member+' / '+tree,-2,-1.61,3.45,TEAL))
        way=state.get('way',[0]*4);arrows=' · '.join(str(j)+'←'+('入口' if way[j]==0 else str(way[j])) for j in range(1,4))
        body.add(_badge('前驱列记录 · 不是已换岗路线',arrows,1.8,-1.61,3.7,INK))
    return body
