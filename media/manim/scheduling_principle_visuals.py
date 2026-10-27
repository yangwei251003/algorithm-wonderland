"""Interval scheduling: a readable projection of the recorded teaching case.

This adapter neither schedules activities nor decides acceptance. Task geometry,
inspection order, decisions, and last-end state all come from exported records.
"""
from __future__ import annotations
import copy
from manim import Group,Rectangle,RoundedRectangle,Line,DashedLine
from visuals import text,display,TEAL,GOLD,RED,INK,MUTED,PANEL,RULE

BLUE='#90B3FF'

def _record(event,run,after):
    state=copy.deepcopy(run['trace']['initialState'])
    for item in run['trace']['events']:
        if item['id']==event['id'] and not after:break
        for change in item['changes']:state[change['target']]=copy.deepcopy(change['after'])
        if item['id']==event['id']:break
    return state

def _badge(label,value,x,color=INK):
    card=RoundedRectangle(width=2.43,height=.62,corner_radius=.09,stroke_color=RULE,stroke_width=1,fill_color=PANEL,fill_opacity=1).move_to([x,1.80,0])
    return Group(card,text(label,15,MUTED,width=2.23).move_to([x,1.96,0]),text(value,22,color,width=2.23).move_to([x,1.67,0]))

def scheduling_principle_visual(event,run,snapshot,show_after):
    """Return a 7.6 by 4.25 left-column Mobject only for interval-scheduling."""
    if run['trace']['algorithmId']!='interval-scheduling':return None
    tasks=snapshot.get('tasks',[])
    if snapshot.get('kind')!='schedule' or not tasks:return None
    state=_record(event,run,show_after)
    events=run['trace']['events']
    # The sort result is a recorded change, not a fresh sorting operation.
    order=next((c['after'] for e in events for c in e.get('changes',[]) if c['target']=='order'),list(range(len(tasks))))
    horizon=next((e['calculation']['values']['horizon'] for e in events if 'horizon' in e.get('calculation',{}).get('values',{})),None)
    if horizon is None:return None
    current=event.get('candidates',[{}])[0].get('target') if event.get('candidates') else None
    decisions={}
    for item in events:
        if item['id']==event['id'] and not show_after:break
        for candidate in item.get('candidates',[]):decisions[candidate['target']]=candidate['status']
        if item['id']==event['id']:break
    chosen=state.get('chosen',[])
    chosen_text=' → '.join(str(i+1) for i in chosen) or '尚无'
    phase='本步之后' if show_after else '本步之前'
    body=Group(Rectangle(width=7.6,height=4.25,fill_opacity=0,stroke_width=0))
    body.add(_badge('已选活动 · '+phase,chosen_text,-2.56,GOLD),_badge('已选末尾 · '+phase,display(state['end']),0,GOLD),_badge('场地关闭时刻',display(horizon),2.56,RED))
    body.add(text('检查顺序：'+' → '.join(str(i+1) for i in order),18,MUTED,width=7.45).move_to([0,1.29,0]))
    xmin,xmax=-2.30,3.60
    maximum=max([horizon,1]+[t['start']+t['duration'] for t in tasks])
    def x(time):return xmin+(xmax-xmin)*time/maximum
    bottom,top=-1.43,1.02
    # Axis ticks are layout guides. They do not imply additional algorithm steps.
    ticks=list(range(0,int(maximum)+1,5))
    if maximum not in ticks:ticks.append(maximum)
    if horizon not in ticks:ticks.append(horizon)
    for tick in sorted(ticks):
        color=RED if tick==horizon else MUTED
        body.add(Line([x(tick),bottom,0],[x(tick),top,0],color=RULE,stroke_width=.8),text(display(tick),15,color).move_to([x(tick),-1.62,0]))
    body.add(DashedLine([x(horizon),bottom-.02,0],[x(horizon),top,0],dash_length=.07,color=RED,stroke_width=2.4))
    body.add(DashedLine([x(state['end']),bottom-.02,0],[x(state['end']),top,0],dash_length=.06,color=GOLD,stroke_width=2.4))
    row_height=2.43/len(tasks)
    for row,index in enumerate(order):
        task=tasks[index];label=task['label'];y=.80-row*row_height
        status=decisions.get(label)
        selected=index in chosen
        current_before=label==current and not show_after
        color=TEAL if current_before else GOLD if selected else RED if status=='rejected' else BLUE
        fill='#14343A' if current_before else '#42351F' if selected else '#381F2A' if status=='rejected' else '#15283C'
        start=task['start'];end=start+task['duration']
        width=max(.03,x(end)-x(start))
        bar=RoundedRectangle(width=width,height=row_height*.72,corner_radius=.04,stroke_width=2.7 if label==current else 1.5,stroke_color=color,fill_color=fill,fill_opacity=1).move_to([(x(start)+x(end))/2,y,0])
        # Labels live outside the bar so short intervals remain readable.
        body.add(text(label,20,color,width=1.26).move_to([-3.10,y,0]),bar,text(display(start)+'–'+display(end),18,INK,width=max(.15,width-.08)).move_to(bar))
        if label==current:
            body.add(Line([-3.72,y-.16,0],[-2.49,y-.16,0],color=color,stroke_width=2.2))
    body.add(text('橙：已选 / 末尾   青：当前待判   红：拒绝 / 截止   蓝：待检查',15,MUTED,width=7.5).move_to([0,-1.99,0]))
    return body
