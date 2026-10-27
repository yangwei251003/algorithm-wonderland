"""Forecast diagrams from recorded predictions; no model fitting is performed.

Day numbers are the numbers in the recorded action/explanation. A forecast is
shown only if it is present in the selected pre/post trace state. Evaluation
compares an already recorded forecast against a subsequently observed value.
"""
import re
from manim import *
from visuals import text, display, TEAL, GOLD, MUTED, RULE, INK, PANEL
from principle_visuals import recorded_state


def _label(value, x, y, size=19, color=INK, width=7.4, key=None):
    obj = text(str(value), size, color, width=width).move_to([x, y, 0])
    if key is not None:
        obj._motion_key = 'forecast-label:' + key
    return obj


def _day(event):
    match = re.search(r'第(\d+)天', event['action'] + ' ' + event['explanation'])
    if not match:
        raise ValueError('Forecast event does not record a day: ' + event['id'])
    return int(match.group(1))


def forecast_context(event, run, show_after=True):
    state = recorded_state(event, run, show_after)
    aid = run['trace']['algorithmId']
    raw = state['predictions']
    predictions = ({int(k)+1: v for k, v in raw.items()} if isinstance(raw, dict)
                   else {i+1: v for i, v in enumerate(raw)})
    day = _day(event) if event['phase'] in ('evaluate', 'update') else None
    if event['phase'] == 'evaluate':
        vals = event['calculation']['values']
        expected = vals.get('prediction', vals.get('forecast'))
        if predictions.get(day) != expected or state['data'][day-1] != vals['actual']:
            raise ValueError('Evaluation day differs from recorded operands')
    return dict(state=state, predictions=predictions, day=day, algorithmId=aid)


def _evaluation_plot(event, ctx, show_after):
    state, forecasts, day = ctx['state'], ctx['predictions'], ctx['day']
    values = state['data']; n = len(values)+1
    upper = max([1, *values, *forecasts.values()]) * 1.16
    left, right, bottom, top = -3.15, 3.3, -1.0, 1.25
    point = lambda d, val: [left+(d-1)/(n-1)*(right-left), bottom+val/upper*(top-bottom), 0]
    out = VGroup()
    title = f'第{day}天：事后核对，实际值未参与自己的预测' if day else '已知日期核对误差；下一天仍待观察'
    out.add(_label(title, 0, 1.94, 22, GOLD))
    for value in [0, upper/2, upper]:
        y = point(1, value)[1]
        out.add(Line([left,y,0],[right,y,0],stroke_color=RULE,stroke_width=.7),
                _label(display(value), left-.3,y,14,MUTED,.55))
    for d in range(1,n+1):
        out.add(_label(str(d),point(d,0)[0],bottom-.22,17,GOLD if d==day else MUTED,.5))
    out.add(_label('天',right+.25,bottom-.22,16,MUTED,.3))
    for i in range(len(values)-1):
        out.add(Line(point(i+1,values[i]),point(i+2,values[i+1]),stroke_color=TEAL,stroke_width=2))
    valid = sorted(d for d in forecasts if 1 <= d <= n)
    for a,b in zip(valid,valid[1:]):
        color=MUTED if ctx['algorithmId']=='exponential-smoothing' and a==1 else GOLD
        out.add(DashedLine(point(a,forecasts[a]),point(b,forecasts[b]),stroke_color=color,stroke_width=2,dash_length=.08))
    for d,val in enumerate(values,1):
        dot=Dot(point(d,val),radius=.055,color=TEAL);dot._motion_key=f'forecast-actual:{d}';out.add(dot)
    for d in valid:
        color=MUTED if ctx['algorithmId']=='exponential-smoothing' and d==1 else GOLD
        dot=Circle(radius=.068,stroke_width=2,color=color,fill_opacity=0).move_to(point(d,forecasts[d]));dot._motion_key=f'forecast-prediction:{d}';out.add(dot)
    out.add(_label('实心青点：实际',-2.1,1.58,17,TEAL,2.3), _label('空心橙点：事先预测',1.35,1.58,17,GOLD,3.2))
    if day:
        actual, forecast = values[day-1], forecasts[day]
        out.add(Line(point(day,actual),point(day,forecast),stroke_color=INK,stroke_width=4))
        for val,col in [(actual,TEAL),(forecast,GOLD)]:
            out.add(Circle(radius=.13,color=col,stroke_width=2).move_to(point(day,val)))
        error=event['calculation']['result']
        suffix=f' = {display(error)}' if show_after else ' → 本步核对'
        out.add(_label(f'| 实际 {display(actual)} − 预测 {display(forecast)} |{suffix}',0,-1.57,22,INK))
    elif 'mae' in state:
        count=state['evaluated'];total=state.get('absoluteErrorSum',state.get('errorSum'))
        out.add(_label(f'平均绝对误差：{display(total)} ÷ {count} = {display(state["mae"])}',0,-1.57,21,INK))
    else:
        out.add(_label('待汇总已核对日期的绝对误差',0,-1.57,21,INK))
    note=f'第{n}天预测 {display(forecasts[n])}：尚无实际，不计入误差'
    if ctx['algorithmId']=='exponential-smoothing':note='灰圈第1天仅初始化；'+note
    out.add(_label(note,0,-1.98,17,MUTED))
    return out


def _exp_update(event, ctx, show_after):
    out=VGroup(); state=ctx['state']; day=ctx['day']; vals=event['calculation']['values']
    out.add(_label(f'用第{day-1}天的信息，更新第{day}天预测',0,1.93,23,GOLD))
    for x,label,base,weight,contribution,color,key in [
        (-1.93,f'最新实际 · 第{day-1}天',vals['observed'],vals['alpha'],vals['recent'],TEAL,'recent'),
        (1.93,f'旧预测 · 第{day-1}天',vals['previous'],1-vals['alpha'],vals['history'],GOLD,'history')]:
        box=RoundedRectangle(width=3.45,height=1.55,corner_radius=.12,stroke_color=color,fill_color=color,fill_opacity=.08).move_to([x,.62,0]);box._motion_key='forecast-box:'+key
        out.add(box,_label(label,x,1.1,19,color,3.2),_label(f'{display(base)} × {display(weight)}',x,.63,26,INK,3.2),_label(f'贡献 {display(contribution)}',x,.17,21,color,3.2))
        out.add(Arrow([x,-.2,0],[x*.35,-.8,0],buff=.08,stroke_width=2,color=color))
    out.add(_label('+',0,.56,29,MUTED,.35))
    if show_after:
        if ctx['predictions'].get(day) != event['calculation']['result']:
            raise ValueError('Exponential update result absent from recorded post state')
        line=f'第{day}天预测 = {display(vals["recent"])} + {display(vals["history"])} = {display(ctx["predictions"][day])}'
    else:
        line=f'第{day}天预测待更新：两份贡献相加'
    out.add(_label(line,0,-1.07,23,INK),_label('旧预测已经包含更早的信息；α 决定本次偏向新观察的程度',0,-1.68,18,MUTED),_label('这里只使用已记录的观察和预测，不偷看第'+str(day)+'天实际',0,-2.01,16,MUTED))
    return out


def forecast_principle_visual(event, run, snapshot, show_after=True):
    aid=run['trace']['algorithmId']
    if aid not in ('moving-average','exponential-smoothing'):
        return None
    if aid=='moving-average' and event['phase'] not in ('evaluate','stop'):
        return None
    ctx=forecast_context(event,run,show_after)
    if event['phase'] in ('evaluate','stop'):
        return _evaluation_plot(event,ctx,show_after)
    if event['phase']=='update':
        return _exp_update(event,ctx,show_after)
    if event['phase']=='initialize':
        value=ctx['state']['data'][0]
        return VGroup(_label('先给预测一个起点',0,1.55,25,GOLD),_label(f'第1天实际 {display(value)}',0,.65,30,TEAL),_label('↓  用作初始化',0,-.1,22,MUTED),_label(f'初始预测 F₁ = {display(value)}',0,-.8,28,GOLD),_label('它使用了当天实际，因此不能作为独立预测成绩',0,-1.7,19,MUTED))
    return None
