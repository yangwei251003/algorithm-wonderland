"""Posterior density diagrams from recorded Bernoulli observations.

The diagram evaluates a density for drawing; it never draws another random
sample, chooses an arm, changes an observation, or reruns the experiment.
"""
import math
from manim import Group,Rectangle,RoundedRectangle,VMobject,Line,DashedLine,Dot
from principle_visuals import recorded_state
from visuals import text,TEAL,GOLD,INK,MUTED,RULE,PANEL,display

BLUE='#90B3FF'

def beta_density(x,a,b):
    if x<=0:return float(b) if a==1 else 0.
    if x>=1:return float(a) if b==1 else 0.
    return math.exp((a-1)*math.log(x)+(b-1)*math.log1p(-x)+math.lgamma(a+b)-math.lgamma(a)-math.lgamma(b))

def posterior_projection(event,run,after):
    state=recorded_state(event,run,after)
    choosing=event['ruleId']=='thompson-choose'
    choice=next(e for e in reversed(run['trace']['events'][:int(event['id'])+1]) if e.get('candidates'))
    rows=[]
    for i,candidate in enumerate(choice['candidates']):
        count=state['count'][i];success=state['success'][i]
        rows.append({'name':candidate['target'],'count':count,'success':success,'a':success+1,'b':count-success+1,'sample':candidate['values']['用于比较的数值'],'chosen':candidate['status']=='chosen'})
    return {'rows':rows,'choosing':choosing,'reward':state.get('observedReward') if not choosing and after else None,'after':after}

def thompson_principle_visual(event,run,snapshot,show_after):
    if run['trace']['algorithmId']!='thompson':return None
    data=posterior_projection(event,run,show_after);rows=data['rows']
    # All three small plots in this frame share exactly the same density scale.
    samples=[i/100 for i in range(101)]
    peak=max(beta_density(x,r['a'],r['b']) for r in rows for x in samples)
    ymax=max(1.,math.ceil(peak*10)/10)
    body=Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0))
    headline='从各自分布抽一个值，再比大小' if data['choosing'] else '只把实际反馈计入被试过的一家'
    body.add(text(headline,22,TEAL,width=7.5).move_to([0,1.94,0]))
    for i,row in enumerate(rows):
        cx=(i-1)*2.53;color=GOLD if row['chosen'] else BLUE
        box=RoundedRectangle(width=2.4,height=3.36,corner_radius=.10,stroke_color=color,fill_color=PANEL,fill_opacity=1).move_to([cx,-.04,0])
        body.add(box,text(row['name'],23,color).move_to([cx,1.39,0]),text(f"Beta({row['a']},{row['b']})",23,INK).move_to([cx,.99,0]))
        left=cx-.94;right=cx+.94;bottom=-.38;top=.63
        body.add(Line([left,bottom,0],[right,bottom,0],color=MUTED,stroke_width=1.4),Line([left,bottom,0],[left,top,0],color=MUTED,stroke_width=1.2))
        for tick in [0,.5,1]:
            x=left+(right-left)*tick
            body.add(Line([x,bottom,0],[x,bottom-.04,0],color=MUTED,stroke_width=1),text(str(tick) if tick==.5 else str(int(tick)),14,MUTED).move_to([x,bottom-.15,0]))
        body.add(text('密度',13,MUTED).move_to([left+.22,top+.08,0]),text(display(ymax),13,MUTED).move_to([left-.04,top-.08,0]))
        points=[[left+(right-left)*x,bottom+(top-bottom)*beta_density(x,row['a'],row['b'])/ymax,0] for x in samples]
        curve=VMobject(stroke_color=TEAL,stroke_width=3).set_points_as_corners(points);body.add(curve)
        if data['choosing']:
            sx=left+(right-left)*row['sample'];sy=bottom+(top-bottom)*beta_density(row['sample'],row['a'],row['b'])/ymax
            body.add(DashedLine([sx,bottom,0],[sx,top,0],color=color,stroke_width=2,dash_length=.055),Dot([sx,sy,0],radius=.045,color=color))
            body.add(text('本轮抽样 '+f"{row['sample']:.3f}",19,color,width=2.22).move_to([cx,-.84,0]))
            status='本轮最大 · 选择' if row['chosen'] else '本轮未选 · 以后仍可选'
        else:
            status=('奖励 '+str(data['reward'])+' · 更新这一家') if row['chosen'] and data['after'] else '等待本步反馈' if row['chosen'] else '本轮未试 · 保持分布'
            body.add(text('成功 '+str(row['success'])+' / 尝试 '+str(row['count']),19,INK,width=2.22).move_to([cx,-.84,0]))
        body.add(text(status,15,color,width=2.22).move_to([cx,-1.18,0]))
        body.add(text('α=成功+1；β=失败+1',14,MUTED,width=2.24).move_to([cx,-1.48,0]))
    body.add(text('横轴：可能成功率 0–1 · 三图共用密度刻度 · 曲线不是本轮奖励',15,MUTED,width=7.5).move_to([0,-1.98,0]))
    body._projection_phase='当前分布：'+('抽样选择时' if data['choosing'] else '本步反馈后' if data['after'] else '本步反馈前')
    body._posterior_projection=data
    return body
