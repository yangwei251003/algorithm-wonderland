"""PID first two cycles: diagrams read the actual recorded operands and changes."""
import numpy as np
from manim import Group, Rectangle, RoundedRectangle, Line, DashedLine, Arrow, Dot
from visuals import text, TEAL, GOLD, MUTED, RED, RULE, PANEL
from signal_principle_visuals import _recorded, _fmt

BLUE='#90B3FF'


def _arrow(a,b,color=TEAL):
    return Arrow(np.array(a,float),np.array(b,float),buff=0,color=color,stroke_width=3,max_tip_length_to_length_ratio=.18)


def _card(label,value,x,y,color=TEAL,width=2.1):
    return Group(RoundedRectangle(width=width,height=1.05,corner_radius=.12,fill_color=PANEL,fill_opacity=1,stroke_color=color),text(label,18,MUTED,width=width-.15).move_to([0,.29,0]),text(value,28,color,width=width-.15).move_to([0,-.15,0])).move_to([x,y,0])


def _error(event,run,after):
    v=event['calculation']['values'];target=v['目标'];height=v['高度'];error=event['calculation']['result'];g=Group()
    # One shared height scale makes the difference a measurable interval.
    y=lambda value:-1.3+value*.045
    g.add(Line([-2.7,-1.3,0],[-2.7,1.6,0],color=RULE))
    for value in [0,20,40,60]:g.add(Line([-2.8,y(value),0],[-2.6,y(value),0],color=MUTED),text(str(value),17,MUTED).move_to([-3.15,y(value),0]))
    g.add(DashedLine([-2.6,y(target),0],[-.3,y(target),0],color=GOLD),text(f'目标 {_fmt(target)}',21,GOLD).move_to([1.3,y(target),0]),Dot([-1.7,y(height),0],radius=.095,color=TEAL),text(f'测量 {_fmt(height,4)}',21,TEAL).move_to([1.3,y(height),0]))
    if after:g.add(_arrow([-.6,y(height),0],[-.6,y(target),0],GOLD),_card('差距 = 目标 − 测量',_fmt(error,4),1.15,-.02,GOLD,3.3))
    else:g.add(text('读取同一时刻的目标和测量',22,MUTED,width=7).move_to([0,-1.85,0]))
    if after:g.add(text('正误差要求向上修正；不代表直接跳到目标',19,MUTED,width=7.2).move_to([0,-1.85,0]))
    return g


def _integral(event,run,after):
    v=event['calculation']['values'];old=v['旧I'];increment=v['e']*v['dt'];new=event['calculation']['result'];g=Group()
    g.add(text('每个小时间段贡献一块“误差面积”',23,TEAL,width=7.2).move_to([0,1.9,0]))
    # This rectangle explicitly depicts e × dt; geometry is illustrative, labels exact.
    g.add(Rectangle(width=2.1,height=1.65,fill_color=TEAL,fill_opacity=.18,stroke_color=TEAL).move_to([-2,.15,0]),text(f'误差 {_fmt(v["e"],4)}',19,TEAL).move_to([-2,1.22,0]),text(f'时间 {_fmt(v["dt"])} 秒',19,MUTED).move_to([-2,-.95,0]),text(f'新增 {_fmt(increment,5)}',23,GOLD).move_to([-2,.15,0]))
    g.add(_card('旧累计',_fmt(old,5),1.8,.8,BLUE),_arrow([1.8,.18,0],[1.8,-.25,0]),_card('新累计（限幅后）',_fmt(new,5) if after else '等待写入',1.8,-.92,GOLD,3.0))
    g.add(text('累计限制在 −35 到 35；这里只是简单限幅',18,MUTED,width=7.2).move_to([0,-1.95,0]))
    return g


def _sum(event,run,after):
    v=event['calculation']['values'];g=Group();zero=-2.55;scale=.071
    g.add(text('三种意见共用一条数轴；负项向左抵消',22,TEAL,width=7.3).move_to([0,1.95,0]))
    for i,(key,label) in enumerate([('P','现在差多少'),('I','过去累多少'),('D','误差变多快')]):
        y=1.1-i*.85;value=v[key];color=[TEAL,BLUE,GOLD][i]
        g.add(text(f'{key} · {label}',18,MUTED).move_to([-1.65,y+.30,0]),Line([zero,y-.13,0],[zero,y+.13,0],color=MUTED))
        if after and abs(value)>.00001:
            bar=Rectangle(width=abs(value)*scale,height=.2,fill_color=color,fill_opacity=1,stroke_width=0).move_to([zero+value*scale/2,y,0]);bar._motion_key='pid-term:'+key;g.add(bar)
        g.add(text(_fmt(value,5) if after else '待算',22,color).move_to([2.55,y,0]))
    g.add(text(f'合计 {_fmt(event["calculation"]["result"],5)}' if after else '先读旧误差和已累计误差，再统一计算',25,GOLD,width=7.2).move_to([0,-1.7,0]))
    return g


def _limit(event,run,after):
    v=event['calculation']['values'];raw=v['原始指令'];lo=v['下限'];hi=v['上限'];chosen=event['calculation']['result'];g=Group()
    low=min(lo-5,raw-5);high=max(hi+5,raw+5);x=lambda value:-3.35+(value-low)/(high-low)*6.7
    g.add(text('先检查能力范围，再交给执行器',23,TEAL,width=7.2).move_to([0,1.9,0]),Rectangle(width=x(hi)-x(lo),height=.48,fill_color=TEAL,fill_opacity=.2,stroke_color=TEAL).move_to([(x(hi)+x(lo))/2,.4,0]),Line([-3.4,.4,0],[3.4,.4,0],color=MUTED))
    for value in [lo,0,hi]:g.add(Line([x(value),.1,0],[x(value),.7,0],color=TEAL),text(_fmt(value),19,TEAL).move_to([x(value),-.15,0]))
    g.add(Dot([x(raw),.4,0],radius=.09,color=RED),text(f'原始 {_fmt(raw,4)}',22,RED).move_to([1.9,1.25,0]))
    if after:g.add(_arrow([x(raw),.95,0],[x(chosen),.95,0],GOLD),Dot([x(chosen),.4,0],radius=.09,color=GOLD),text(f'超过上限，实际执行 {_fmt(chosen)}',25,GOLD,width=7.2).move_to([0,-1.1,0]))
    else:g.add(text('原始要求在范围外，不能照数值执行',23,RED,width=7.2).move_to([0,-1.1,0]))
    g.add(text('红色：无法执行的要求；橙色：最近的可行边界',18,MUTED,width=7.2).move_to([0,-1.85,0]))
    return g


def _motion(event,run,after):
    v=event['calculation']['values'];old=v['旧高度'];new=event['calculation']['result'];dt=v['dt'];g=Group()
    g.add(text('顺序不能交换：先速度，再高度',24,TEAL,width=7.2).move_to([0,1.95,0]),_card('旧速度',_fmt(v['旧速度'],5),-2.5,1.0,BLUE),_card('净加速度',_fmt(v['加速度'],5),0,1.0,TEAL),_card('新速度',_fmt(v['新速度'],5) if after else '等待写入',2.5,1.0,GOLD))
    g.add(text(f'v新 = {_fmt(v["旧速度"],4)} + {_fmt(v["加速度"],4)} × {_fmt(dt)}',23,GOLD,width=7.2).move_to([0,.03,0]))
    x=lambda h:-2.6+(h-old)/(new-old)*5.2
    g.add(Line([-2.6,-1.0,0],[2.6,-1.0,0],color=RULE),Dot([x(old),-1.0,0],radius=.075,color=BLUE),text(f'旧高度 {_fmt(old,4)}',19,BLUE).move_to([-2.0,-1.45,0]))
    if after:g.add(_arrow([x(old),-1.0,0],[x(new),-1.0,0],GOLD),Dot([x(new),-1.0,0],radius=.075,color=GOLD),text(f'新高度 {_fmt(new,5)}',19,GOLD).move_to([2,-1.45,0]))
    g.add(text(f'高度变化局部放大；h新 = h旧 + v新 × {_fmt(dt)}',18,MUTED,width=7.3).move_to([0,-2.03,0]))
    return g


def pid_principle_visual(event,run,snapshot,after=True):
    if int(event['id'])>=10:return None
    renderer={'pid-error':_error,'pid-integral':_integral,'pid-sum':_sum,'pid-limit':_limit,'pid-motion':_motion}.get(event['ruleId'])
    return renderer(event,run,after) if renderer else None
