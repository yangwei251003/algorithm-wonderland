"""Probability diagrams use exported event operands and recorded outcomes only.

No random number is drawn here. Product counts are explicitly proportional
counts, not newly simulated products. Monte Carlo stages and bootstrap tickets
are reconstructed from completed trace events and the selected pre/post state.
"""
import re
from manim import *
from visuals import text, display, TEAL, GOLD, MUTED, RULE, INK, PANEL
from principle_visuals import recorded_state

RED='#F28E91'
BLUE='#90B3FF'


def _label(value,x,y,size=19,color=INK,width=7.4,key=None):
    obj=text(str(value),size,color,width=width).move_to([x,y,0])
    if key is not None:obj._motion_key='probability-label:'+key
    return obj


def _box(x,y,w,h,color,key):
    box=RoundedRectangle(width=w,height=h,corner_radius=.07,stroke_color=color,stroke_width=1.5,fill_color=color,fill_opacity=.08).move_to([x,y,0])
    box._motion_key='probability-box:'+key
    return box


def _bayes(event,run,show_after):
    s=recorded_state(event,run,show_after);n=s['total'];out=VGroup()
    out.add(_label(f'按 {display(n)} 件折算比例 · 不是额外模拟的真实货物',0,1.91,21,GOLD))
    branches=[(-1.95,'缺陷品',s['prior'],s['sensitivity'],'truePositive',GOLD),
              (1.95,'正常品',1-s['prior'],s['falsePositive'],'falsePositiveJoint',TEAL)]
    for x,name,prior,rate,key,color in branches:
        out.add(_box(x,1.17,3.5,.65,color,name),_label(f'{name}：{display(n*prior)} 件',x,1.17,22,color,3.3))
        out.add(Arrow([x-1.40,.8,0],[x-1.40,.11,0],buff=.04,stroke_width=2,color=color),
                _label(f'各自的亮灯率 {display(rate*100)}%',x+.23,.55,18,INK,2.9))
        val=s.get(key);content='亮灯数量待计算' if val is None else f'亮灯 {display(n*val)} 件'
        out.add(_box(x,-.18,3.5,.62,color,key),_label(content,x,-.18,23,color,3.3))
    if 'truePositive' in s and 'falsePositiveJoint' in s:
        for x,color in [(-1.95,GOLD),(1.95,TEAL)]:
            out.add(Arrow([x,-.52,0],[x*.32,-1.02,0],buff=.04,color=color,stroke_width=2))
        truth=n*s['truePositive'];false=n*s['falsePositiveJoint']
        out.add(_label(f'只看亮灯：{display(truth)} + {display(false)} = {display(truth+false)} 件',0,-1.2,22,INK))
        if 'posterior' in s:
            out.add(_label(f'缺陷占亮灯：{display(truth)} ÷ {display(truth+false)} ≈ {display(s["posterior"]*100)}%',0,-1.72,23,GOLD))
        else:
            out.add(_label('下一步：缺陷且亮灯 ÷ 所有亮灯',0,-1.72,20,MUTED))
    else:
        out.add(_label('每条路先乘自己的亮灯率，再汇合两类亮灯产品',0,-1.17,20,MUTED),
                _label('灵敏度的分母是缺陷品；误报率的分母是正常品',0,-1.72,18,MUTED))
    out.add(_label('亮灯不是确定判决；新概率仍依赖这三个输入比例',0,-2.02,16,MUTED))
    return out


def monte_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after);events=run['trace']['events']
    limit=int(event['id'])+(1 if show_after else 0);prefix=events[:limit]
    stages={};trial=None
    if event['phase']=='sample':
        match=re.search(r'世界(\d+)的工序(\d+)',event['action'])
        if not match:raise ValueError('Monte Carlo trial/stage is not recorded')
        trial=int(match.group(1))
    else:trial=state.get('trial')
    bases={}
    for item in events:
        if item['phase']=='sample':
            match=re.search(r'世界(\d+)的工序(\d+)',item['action'])
            if match:
                stage=int(match.group(2));base=item['calculation']['values']['base']
                if stage in bases and bases[stage]!=base:raise ValueError('Stage baseline changed inside trace')
                bases[stage]=base
    totals=[]
    for item in prefix:
        if item['phase']=='sample':
            match=re.search(r'世界(\d+)的工序(\d+)',item['action'])
            if int(match.group(1))==trial:stages[int(match.group(2))]=item['calculation']['result']
        elif item['phase']=='evaluate':totals.append(item['calculation']['values']['duration'])
    success=sum(v<=state['deadline'] for v in totals)
    if success!=state['successes']:raise ValueError('Completed trials disagree with recorded success count')
    return dict(state=state,bases=bases,stages=stages,trial=trial,totals=totals,successes=success)


def _monte(event,run,show_after):
    ctx=monte_context(event,run,show_after);s=ctx['state'];out=VGroup();colors=[TEAL,BLUE,GOLD,RED]
    if event['phase']=='stop':
        totals=ctx['totals'];passed=ctx['successes'];out.add(_label(f'{len(totals)} 次真实模拟的按时记录',0,1.9,23,GOLD))
        columns=10;rows=(len(totals)+columns-1)//columns;unit=min(.54,2.4/max(rows,1));size=unit*.8
        for i,val in enumerate(totals):
            x=(i%columns-(columns-1)/2)*.58;y=.95-i//columns*unit
            col=TEAL if val<=s['deadline'] else RED
            out.add(_box(x,y,size,size,col,'trial'+str(i)),_label(i+1,x,y,13,col,size-.05))
        out.add(_label('青：按时；粉：超时 · 每格是一遍，不是一道工序',0,-1.35,18,MUTED),
                _label(f'{passed} ÷ {len(totals)}'+(f' = {display(s["probability"]*100)}%' if show_after else ' → 待记录比例'),0,-1.79,28,GOLD))
        return out
    trial=ctx['trial'];out.add(_label('四道工序串行：完成一道，才能接着下一道' if trial is None else f'第 {trial} 遍：四道工序逐道抽样并累加',0,1.9,22,GOLD))
    bases=ctx['bases'];stages=ctx['stages'];count=len(bases)
    for i in range(count):
        x=(i-(count-1)/2)*1.85;col=colors[i%4];duration=stages.get(i+1)
        out.add(_box(x,.83,1.65,1.35,col,f'stage{i+1}'),_label(f'工序{i+1}',x,1.26,20,col,1.5),
                _label(f'基准 {display(bases[i+1])}',x,.82,17,MUTED,1.5),
                _label('待抽样' if duration is None else display(round(duration,2))+' 分',x,.4,20,col,1.5))
    maximum=max(sum(bases.values())*(1+s['spread']/100),s['deadline']*1.1)
    x=lambda t:-3.35+t/maximum*6.7
    out.add(Line([x(0),-.5,0],[x(maximum),-.5,0],color=RULE,stroke_width=1))
    elapsed=0
    for i in range(count):
        duration=stages.get(i+1)
        if duration is None:continue
        width=x(elapsed+duration)-x(elapsed)
        bar=Rectangle(width=width,height=.42,stroke_width=0,fill_color=colors[i%4],fill_opacity=.75).move_to([(x(elapsed)+x(elapsed+duration))/2,-.5,0]);bar._motion_key=f'time-segment:{i}';out.add(bar);elapsed+=duration
    deadline=s['deadline'];out.add(DashedLine([x(deadline),-.95,0],[x(deadline),.02,0],color=INK,dash_length=.07),_label(f'截止 {display(deadline)} 分',x(deadline)-.3,-1.13,17,INK,2.1))
    out.add(_label(f'已抽工序累计 {display(round(elapsed,2))} 分钟',-1.45,-1.1,21,TEAL,4.1))
    if event['phase']=='evaluate':
        val=event['calculation']['values']['duration'];on_time=val<=deadline
        note=(f'{display(round(val,2))} '+('≤' if on_time else '>')+f' {display(deadline)}：'+('计入按时' if on_time else '不计入按时')) if show_after else f'待判断：{display(round(val,2))} 分钟是否超过 {display(deadline)}'
        out.add(_label(note,0,-1.65,23,(TEAL if on_time else RED) if show_after else INK))
    elif event['phase']=='sample':
        vals=event['calculation']['values'];out.add(_label(f'本步独立随机数：{display(vals["u1"])}、{display(vals["u2"])}；波动幅度 {vals["spread"]}%',0,-1.65,18,MUTED))
    else:out.add(_label('每道抽两个独立均匀数：u₁+u₂−1，中心更常见的三角波动',0,-1.65,18,MUTED))
    out.add(_label(f'已核对 {len(ctx["totals"])} 遍，按时 {ctx["successes"]} 遍；未完成的一遍不计数',0,-2.02,16,MUTED))
    return out


def bootstrap_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after)
    # Initialization's input parsing is a recorded state change, never guessed.
    values=state.get('values')
    if values is None:
        values=next(c['after'] for c in run['trace']['events'][0]['changes'] if c['target']=='values')
    replicate=state.get('replicate');draw=list(state.get('draw',[]))
    if event['phase']=='draw':
        match=re.search(r'第(\d+)组抽签(\d+)',event['action'])
        if not match:raise ValueError('Bootstrap draw/replicate not recorded')
        target=int(match.group(1))
        if target!=replicate:draw=[]
        replicate=target
        v=event['calculation']['values']
        if values[v['index']]!=v['value']:raise ValueError('Bootstrap ticket differs from recorded value')
    means=[e['calculation']['result'] for e in run['trace']['events'][:int(event['id'])+(1 if show_after else 0)] if e['phase']=='statistic']
    return dict(state=state,values=values,draw=draw,replicate=replicate,means=means)


def _bootstrap(event,run,show_after):
    ctx=bootstrap_context(event,run,show_after);s=ctx['state'];values=ctx['values'];draw=ctx['draw'];out=VGroup();n=len(values)
    if event['phase']=='interval':
        # Pre-state retains sampled order. Post-state uses the recorded sorting.
        ordered=s['sortedMeans'] if show_after else ctx['means'];v=event['calculation']['values'];lo=v['loIndex'];hi=v['hiIndex']
        if len(ordered)!=v['replicates']:raise ValueError('Bootstrap ordered record length mismatch')
        out.add(_label(f'{len(ordered)} 个均值'+('已排序' if show_after else '尚未排序')+' · 从左到右、从上到下',0,1.91,21,GOLD))
        columns=10;rows=(len(ordered)+9)//10;dy=min(.52,2.6/rows)
        for i,val in enumerate(ordered):
            x=(i%columns-4.5)*.69;y=1.25-(i//columns)*dy;col=GOLD if show_after and i in (lo,hi) else TEAL
            out.add(_box(x,y,.64,.40,col,'mean'+str(i)),_label(display(val),x,y,16,col,.59))
        note=f'索引 {lo} → 第{lo+1}个 = {display(ordered[lo])}；索引 {hi} → 第{hi+1}个 = {display(ordered[hi])}' if show_after else f'待排序后取索引 {lo}、{hi}；当前排列不能直接取端点'
        out.add(_label(note,0,-1.51,20,GOLD),
                _label('本版下取整，不插值；近似区间不保证每次包含真实均值',0,-1.98,17,MUTED))
        return out
    out.add(_label('原始抽签袋一直保留全部票；记录副本后放回',0,1.91,21,GOLD))
    unit=min(1.52,6.8/n);active=event.get('calculation',{}).get('values',{}).get('index') if event['phase']=='draw' else None
    for i,val in enumerate(values):
        x=(i-(n-1)/2)*unit;col=GOLD if i==active else TEAL
        out.add(_box(x,1.12,unit*.85,.65,col,'original'+str(i)),_label(display(val),x,1.12,25,col,unit*.8),_label('索引 '+str(i),x,.61,16,MUTED,unit*.9))
    if event['phase']=='draw':
        v=event['calculation']['values'];out.add(_label(f'{display(v["r"])} × {n}，向下取整 → 索引 {v["index"]}',0,.06,20,INK))
    else:out.add(_label('每个原始位置的概率都是 1/'+str(n),0,.06,20,MUTED))
    for i in range(n):
        x=(i-(n-1)/2)*unit;known=i<len(draw);col=GOLD if known else RULE
        out.add(_box(x,-.59,unit*.85,.6,col,'copy'+str(i)),_label(display(values[draw[i]]) if known else '待抽',x,-.59,23,col if known else MUTED,unit*.8))
    if event['phase']=='initialize':
        note=f'原样本均值 {display(s["originalMean"])}' if 'originalMean' in s else '先计算原样本均值'
    elif event['phase']=='statistic':
        total=event['calculation']['values']['sum'];note=f'第{ctx["replicate"]}袋：{display(total)} ÷ {n}'+(' = '+display(event['calculation']['result']) if show_after else ' → 待记录均值')
    else:note=f'第{ctx["replicate"]}袋已记录 {len(draw)} 张；累计和 {display(sum(values[i] for i in draw))}'
    out.add(_label(note,0,-1.37,23,GOLD),_label(f'已保存 {len(ctx["means"])} 个重抽均值；这些不是新增真实调查',0,-1.97,17,MUTED))
    return out


def probability_principle_visual(event,run,snapshot,show_after=True):
    aid=run['trace']['algorithmId']
    if aid=='bayes':return _bayes(event,run,show_after)
    if aid=='monte-carlo':return _monte(event,run,show_after)
    if aid=='bootstrap':return _bootstrap(event,run,show_after)
    return None
