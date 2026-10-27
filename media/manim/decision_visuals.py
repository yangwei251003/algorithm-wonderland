"""Distinguish a bandit's actual selection score from observed success rates."""
from manim import Group,RoundedRectangle
from visuals import text,display,INK,MUTED,TEAL,GOLD,PANEL,RULE
from principle_visuals import recorded_state

def bandit_visual(event,run,after):
    state=recorded_state(event,run,after)
    choice=next((e for e in reversed(run['trace']['events'][:int(event['id'])+1]) if e.get('candidates')),None)
    candidates=choice.get('candidates',[]) if choice else []
    thompson=run['trace']['algorithmId']=='thompson'
    current=event['ruleId'].endswith('-choose')
    title=('本轮后验抽样值' if thompson else '本轮UCB选择分') if current else ('本轮选择时的抽样值' if thompson else '本轮选择时的UCB分')
    body=Group(text(title,27,TEAL,width=7.6).move_to([0,1.8,0]))
    for i,candidate in enumerate(candidates):
        x=(i-1)*2.5;color=GOLD if candidate['status']=='chosen' else '#90B3FF'
        box=RoundedRectangle(width=2.3,height=2.5,corner_radius=.13,stroke_color=color,fill_color=PANEL,fill_opacity=1).move_to([x,.1,0])
        score=candidate['values']['用于比较的数值']
        count=state['count'][i];success=state['success'][i]
        body.add(box,text(candidate['target'],24,color).move_to([x,1,0]),text(display(score),29,color,width=2.1).move_to([x,.45,0]))
        body.add(text('本轮选中' if candidate['status']=='chosen' else '本轮未选',18,color).move_to([x,-.1,0]))
        body.add(text(f'已观察成功 {success} / {count}',17,MUTED,width=2.1).move_to([x,-.6,0]))
        body.add(text('历史成功率 '+(f'{success/count:.3f}' if count else '未知'),17,INK,width=2.1).move_to([x,-.95,0]))
    stage='本步反馈之后' if after and not current else '选择时已知的数据'
    body.add(text(stage,18,MUTED,width=7.6).move_to([0,-1.55,0]))
    body.add(text('抽样大小决定本轮选择；历史成功率不等于抽样值' if thompson else '选择分 = 历史成功率 + 探索奖励；未试时优先探索',18,MUTED,width=7.6).move_to([0,-2.05,0]))
    return body
