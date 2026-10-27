"""Learning diagrams project the recorded parameters without retraining.

The logistic boundary is the exact clipped line z=0 (p=0.5). Class shading is
computed only from the current pre/post weights. Train/test membership comes
from the trace's separate arrays, never from a shuffled visual point order.
"""
import math
import re
from manim import *
from visuals import text, display, TEAL, GOLD, MUTED, RULE, INK, PANEL
from principle_visuals import recorded_state


def _label(value,x,y,size=18,color=INK,width=7.4,key=None):
    obj=text(str(value),size,color,width=width).move_to([x,y,0])
    if key is not None:obj._motion_key='learning-label:'+key
    return obj


def logistic_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after);values=event.get('calculation',{}).get('values',{})
    train_index=test_index=None
    if event['phase']=='sample':
        match=re.search(r'样本(\d+)',event['action'])
        if not match:raise ValueError('Sample index absent from trace')
        train_index=int(match.group(1))-1
        x,y,label=state['train'][train_index]
        if abs((x-50)/40-values['x'])>1e-12 or abs((y-50)/40-values['y'])>1e-12 or label!=values['label']:
            raise ValueError('Highlighted training point differs from event operands')
    if event['phase']=='evaluate':
        match=re.search(r'点(\d+)',event['action'])
        if not match:raise ValueError('Validation index absent from trace')
        test_index=int(match.group(1))-1
        x,y,label=state['test'][test_index];w=state['weights']
        z=w[0]+w[1]*(x-50)/40+w[2]*(y-50)/40
        probability=1/(1+math.exp(-z))
        if abs(probability-values['probability'])>1e-12 or label!=values['label']:
            raise ValueError('Validation point or weights differ from recorded probability')
    return dict(state=state,train_index=train_index,test_index=test_index)


def _clip_halfplane(vertices,weights,positive):
    def value(p):return weights[0]+weights[1]*(p[0]-50)/40+weights[2]*(p[1]-50)/40
    def inside(p):return value(p)>=0 if positive else value(p)<=0
    result=[]
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):
        ina,inb=inside(a),inside(b)
        if ina:result.append(a)
        if ina!=inb:
            va,vb=value(a),value(b);t=va/(va-vb)
            result.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return result


def _logistic_plot(event,ctx,show_after):
    state=ctx['state'];w=state['weights'];out=VGroup()
    left,right,bottom,top=-3.15,3.2,-1.12,1.28
    pt=lambda x,y:[left+x/100*(right-left),bottom+y/100*(top-bottom),0]
    score=lambda x,y:w[0]+w[1]*(x-50)/40+w[2]*(y-50)/40
    zero=all(abs(x)<1e-14 for x in w)
    title='初始概率全部 0.5；尚未学出区分' if zero else '当前权重决定分类边界 · p ≥ 0.5 判为 1'
    out.add(_label(title,0,1.90,22,GOLD))
    vertices=[(0,0),(100,0),(100,100),(0,100)]
    if zero:
        out.add(Rectangle(width=right-left,height=top-bottom,stroke_width=0,fill_color=PANEL,fill_opacity=1).move_to([(right+left)/2,(top+bottom)/2,0]))
    else:
        for positive,color in [(False,TEAL),(True,GOLD)]:
            poly=_clip_halfplane(vertices,w,positive)
            if len(poly)>=3:
                shape=Polygon(*(pt(*p) for p in poly),stroke_width=0,fill_color=color,fill_opacity=.13);shape._motion_key='learning-region:'+str(positive);out.add(shape)
        intersections=[]
        for a,b in zip(vertices,vertices[1:]+vertices[:1]):
            va,vb=score(*a),score(*b)
            if va==0:intersections.append(a)
            if va*vb<0:
                t=va/(va-vb);intersections.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
        unique=list(dict.fromkeys(intersections))
        if len(unique)>=2:
            line=Line(pt(*unique[0]),pt(*unique[1]),color=INK,stroke_width=2);line._motion_key='learning-boundary';out.add(line)
    for value in [0,50,100]:
        x=pt(value,0)[0];y=pt(0,value)[1]
        out.add(Line([x,bottom,0],[x,top,0],stroke_color=RULE,stroke_width=.5),Line([left,y,0],[right,y,0],stroke_color=RULE,stroke_width=.5),_label(value,x,bottom-.18,13,MUTED,.4),_label(value,left-.27,y,13,MUTED,.45))
    out.add(_label('x',right+.4,bottom-.18,15,MUTED,.3),_label('y',left-.27,top+.18,15,MUTED,.3))
    for kind,points,active in [('训练',state['train'],ctx['train_index']),('验证',state['test'],ctx['test_index'])]:
        for i,(x,y,label) in enumerate(points):
            color=GOLD if label else TEAL
            dot=(Dot(radius=.065,color=color) if kind=='训练' else Circle(radius=.093,color=color,stroke_width=2.5,fill_opacity=0)).move_to(pt(x,y));dot._motion_key=f'learning-point:{kind}:{i}';out.add(dot)
            if i==active:
                ring=Circle(radius=.16,color=INK,stroke_width=2).move_to(pt(x,y));ring._motion_key='learning-focus';out.add(ring)
                out.add(_label(kind+str(i+1),pt(x,y)[0],pt(x,y)[1]+.23,16,INK,1.15))
    out.add(_label(f'实心：训练 {len(state["train"])} 点',-2.2,1.55,17,MUTED,2.7),_label(f'空心：验证 {len(state["test"])} 点，权重不更新',1.45,1.55,17,MUTED,3.7))
    out.add(_label('权重 ['+', '.join(display(v) for v in w)+']',0,-1.62,19,INK))
    vals=event.get('calculation',{}).get('values',{})
    if event['phase']=='sample':
        note=f'本点 p={display(vals["p"])}；误差 p−类别={display(vals["error"])}；概率不是梯度'
    elif event['phase']=='evaluate':
        note=f'验证{ctx["test_index"]+1}：p={display(vals["probability"])}；真实类别 {vals["label"]}；仅核对'
    elif event['phase']=='update':
        note='本步完成后使用新权重；边界来自这些权重' if show_after else '执行前：仍用旧权重；本步将更新一个参数'
    elif event['phase']=='stop':
        note='固定训练轮数结束，不是收敛证明；直线边界表达能力有限'
    else:
        note='点色是真实类别：青 0 / 橙 1；底色是模型预测，不能混为一谈'
    out.add(_label(note,0,-1.98,17,MUTED))
    return out


def learning_principle_visual(event,run,snapshot,show_after=True):
    if run['trace']['algorithmId']!='logistic-regression':return None
    return _logistic_plot(event,logistic_context(event,run,show_after),show_after)

# KNN: only project operands, recorded ranking and recorded vote outcomes.
def knn_context(event,run,show_after=True):
    before=recorded_state(event,run,False);completed=recorded_state(event,run,True)
    state=completed if show_after else before;phase=event['phase'];query=int(completed.get('query',0))
    train=state['train'];test=state['test'];values=event.get('calculation',{}).get('values',{})
    neighbor=int(completed['neighbor']) if phase=='distance' else None
    if neighbor is not None:
        x,y,_=train[neighbor];qx,qy,_=test[query]
        assert (x,y,qx,qy)==tuple(values[k] for k in ['x','y','qx','qy'])
        assert x-qx==values['dx'] and y-qy==values['dy']
        assert values['dx']**2+values['dy']**2==event['calculation']['result']
    ranking=event.get('candidates',[]) if phase=='choose' else []
    if ranking:
        assert [c['values']['rank'] for c in ranking]==list(range(1,len(train)+1))
        distances=[]
        for c in ranking:
            i=int(c['target']);x,y,label=train[i];qx,qy,_=test[query]
            assert (x-qx)**2+(y-qy)**2==c['values']['distance'] and label==c['values']['class']
            distances.append((c['values']['distance'],i))
            assert (c['status']=='chosen')==(c['values']['rank']<=state['k'])
        assert distances==sorted(distances)
    neighbors=completed.get('neighbors',[]) if phase in ['choose','vote'] else []
    if phase=='vote':
        ones=sum(train[i][2] for i in neighbors)
        assert ones==values['ones'] and len(neighbors)==values['count']
        assert ones/len(neighbors)==values['probability']
        assert int(ones/len(neighbors)>=.5)==event['calculation']['result']
    outcomes=[]
    for e in run['trace']['events'][:int(event['id'])+(1 if show_after else 0)]:
        if e['phase']=='vote':
            s=recorded_state(e,run,True);outcomes.append((s['query'],s['predicted'],e['calculation']['values']['truth']))
    return dict(state=state,query=query,neighbor=neighbor,ranking=ranking,neighbors=neighbors,values=values,outcomes=outcomes)


def _knn_label(value,x,y,size=18,color=INK,width=3.45,key=None):
    item=text(str(value),size,color,width=width).move_to([x,y,0])
    if key is not None:item._motion_key='label:knn:'+key
    return item


def knn_principle_visual(event,run,snapshot,show_after=True,mode='rule',candidates=None):
    if run['trace']['algorithmId']!='knn':return None
    ctx=knn_context(event,run,show_after);state=ctx['state'];phase=event['phase'];train=state['train'];test=state['test'];q=ctx['query'];values=ctx['values']
    out=VGroup(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0))
    point=lambda x,y: [-3.35+x*.033,-1.53+y*.033,0]
    # Equal coordinate scales make the visible distance triangle geometrically honest.
    for v in [0,50,100]:
        a=point(v,0);b=point(0,v)
        out.add(Line(a,point(v,100),stroke_color=RULE,stroke_width=.5),Line(b,point(100,v),stroke_color=RULE,stroke_width=.5),_knn_label(v,a[0],a[1]-.15,11,MUTED,.4),_knn_label(v,b[0]-.18,b[1],11,MUTED,.4))
    focus=ctx['neighbor'];selected=ctx['neighbors'];choice=None
    if mode.startswith('comparison:') and candidates:
        choice=candidates[int(mode.split(':')[-1])];focus=int(choice['target'])
    if phase=='distance':
        p=train[focus];a=point(*test[q][:2]);b=point(*p[:2]);corner=point(p[0],test[q][1])
        for begin,end,color in [(a,corner,TEAL),(corner,b,GOLD),(a,b,INK)]:
            if sum((end[i]-begin[i])**2 for i in [0,1])>1e-12:out.add(Line(begin,end,color=color,stroke_width=2 if color!=INK else 1))
    elif phase in ['choose','vote']:
        for i in ([focus] if choice else selected):
            out.add(Line(point(*test[q][:2]),point(*train[i][:2]),color=('#fb8f98' if choice and choice['status']=='rejected' else TEAL),stroke_width=1.5))
    for i,(x,y,label) in enumerate(train):
        dot=Dot(point(x,y),radius=.065,color=GOLD if label else TEAL);dot._motion_key='knn:train:'+str(i);out.add(dot)
        if i==focus:
            out.add(Circle(radius=.115,color=INK,stroke_width=2).move_to(point(x,y)))
    for i,(x,y,_) in enumerate(test):
        dot=Circle(radius=.09,color=INK if i==q else MUTED,stroke_width=2).move_to(point(x,y));dot._motion_key='knn:test:'+str(i);out.add(dot)
        out.add(_knn_label('验'+str(i+1),point(x,y)[0]+(.3 if i else -.23),point(x,y)[1]+.2,13,INK if i==q else MUTED,.6))
    out.add(_knn_label('宽 x',-1.7,-1.82,14,MUTED,.55),_knn_label('高 y',-3.5,2.0,12,MUTED,.6))
    out.add(_knn_label(f'实心：{len(train)}个训练邻居 · 空心：{len(test)}个独立验证点',0,2.02,18,TEAL,7.4,'legend'))
    out.add(_knn_label('#0 对应训练1；编号从0开始 · 点色：青0 / 橙1',0,-2.02,16,MUTED,7.4,'legend2'))
    x=1.83
    if phase=='initialize':
        lines=[('候选来自训练组',TEAL),('只取最近 '+str(state['k'])+' 位',GOLD),('验证点不能给自己投票',INK),('同距离：按训练输入顺序',MUTED),('计算距离时不读类别',MUTED)]
        for i,(s,color) in enumerate(lines):out.add(_knn_label(s,x,1.25-i*.5,20,color))
    elif phase=='distance':
        result=event['calculation']['result'];prefix='已计算' if show_after else '本步计算'
        lines=[(f'验证{q+1} → 候选 #{focus}',INK),(f'({values["qx"]}, {values["qy"]}) → ({values["x"]}, {values["y"]})',MUTED),(f'横差 dx = {values["x"]} − {values["qx"]} = {values["dx"]}',TEAL),(f'纵差 dy = {values["y"]} − {values["qy"]} = {values["dy"]}',GOLD),(f'距离平方 = ({values["dx"]})² + ({values["dy"]})²',INK),(f'{prefix}：{result}',GOLD),('尚未排序；尚未投票',MUTED)]
        for i,(s,color) in enumerate(lines):out.add(_knn_label(s,x,1.48-i*.44,18,color,key='distance:'+str(i)))
    elif phase=='choose':
        out.add(_knn_label(f'验证{q+1} · 按真实距离排名',x,1.6,21,TEAL))
        for i,c in enumerate(ctx['ranking']):
            chosen=c['status']=='chosen';color=TEAL if chosen else MUTED
            if choice and c['target']==choice['target']:color='#fb8f98' if not chosen else GOLD
            line=f'{c["values"]["rank"]}.  #{c["target"]}   d²={c["values"]["distance"]}   '+('入选' if chosen else '未入选')
            out.add(_knn_label(line,x,1.22-i*.32,17,color,key='rank:'+str(i)))
            if i==state['k']-1:out.add(Line([.2,1.06-i*.32,0],[3.48,1.06-i*.32,0],color=GOLD,stroke_width=1))
        out.add(_knn_label('名额线以上才有投票资格',x,-1.6,18,GOLD))
    elif phase=='vote':
        ones=values['ones'];zeros=values['count']-ones
        out.add(_knn_label(f'验证{q+1} · 入选邻居每人一票',x,1.48,20,TEAL))
        for i,n in enumerate(selected):
            xx=.6+i*.97;color=GOLD if train[n][2] else TEAL
            out.add(Circle(radius=.2,color=color,fill_color=color,fill_opacity=.3).move_to([xx,.8,0]),_knn_label('#'+str(n),xx,.8,16,color,.7),_knn_label('投 '+str(train[n][2]),xx,.3,18,color,.7))
        out.add(_knn_label(f'零类 {zeros} 票   |   一类 {ones} 票',x,-.2,24,GOLD),_knn_label('每人一票；没有距离加权',x,-.7,18,MUTED))
        if show_after:out.add(_knn_label(f'预测 {event["calculation"]["result"]}  →  核对真实 {values["truth"]}',x,-1.28,21,TEAL))
        else:out.add(_knn_label('先投票；尚未拿真实标签核对',x,-1.28,18,MUTED))
    else:
        out.add(_knn_label('独立验证记录',x,1.3,23,TEAL))
        for i,(qi,p,t) in enumerate(ctx['outcomes']):out.add(_knn_label(f'验证{qi+1}：预测 {p} / 真实 {t}',x,.65-i*.65,21,INK))
        out.add(_knn_label(f'{sum(p==t for _,p,t in ctx["outcomes"])} 个点答对 / 共 {len(test)} 个点',x,-.75,22,GOLD),_knn_label('小验证集不能保证未来正确',x,-1.35,18,MUTED))
    return out


def regression_context(event,run,show_after=True):
    before=recorded_state(event,run,False);completed=recorded_state(event,run,True)
    state=completed if show_after else before;values=event.get('calculation',{}).get('values',{});phase=event['phase'];events=run['trace']['events'];eid=int(event['id']);data=state['data']
    n=int(completed.get('sampleCount',min(2,len(data))));focus=None
    if phase=='mean' and not values:
        focus=int(re.search(r'样本(\d+)',event['action']).group(1))-1
        assert completed['sumX']==sum(p[0] for p in data[:focus+1]) and completed['sumY']==sum(p[1] for p in data[:focus+1])
    if phase=='mean' and values:
        assert completed['meanX']==values['sumX']/values['n'] and completed['meanY']==values['sumY']/values['n']
    if phase=='contribution':
        start=eid
        while start>0 and events[start-1]['phase']=='contribution':start-=1
        focus=eid-start;x,y=data[focus];assert x-before['meanX']==values['dx'] and y-before['meanY']==values['dy']
        assert values['dx']*values['dy']==values['product'] and values['dx']**2==values['square']
        assert completed['numerator']==sum(e['calculation']['values']['product'] for e in events[start:eid+1])
        assert completed['denominator']==sum(e['calculation']['values']['square'] for e in events[start:eid+1])
    if phase=='fit':
        if values['denominator']!=0:assert abs(completed['slope']-values['numerator']/values['denominator'])<1e-10
        assert abs(completed['intercept']-(values['meanY']-completed['slope']*values['meanX']))<1e-10
    if phase=='residual':
        focus=int(re.search(r'点(\d+)',event['action']).group(1))-1;x,y=data[focus]
        assert y==values['actual'] and abs(state['intercept']+state['slope']*x-values['predicted'])<1e-10
        assert abs(values['actual']-values['predicted']-values['residual'])<1e-10
        assert abs(values['residual']**2-event['calculation']['result'])<1e-10
    available=events[:eid+(1 if show_after else 0)];fits=[e for e in available if e['phase']=='fit'];fit_count=recorded_state(fits[-1],run,True)['sampleCount'] if fits else None
    residuals=[(int(re.search(r'点(\d+)',e['action']).group(1)),e['calculation']['values']['residual']) for e in available if e['phase']=='residual']
    if phase=='stop':assert abs(completed['rmse']-math.sqrt(sum(r*r for _,r in residuals)/len(data)))<1e-10
    return dict(state=state,before=before,completed=completed,values=values,n=n,focus=focus,fit_count=fit_count,residuals=residuals)


def _regression_label(value,x,y,size=18,color=INK,width=3.45,key=None):
    obj=text(str(value),size,color,width=width).move_to([x,y,0])
    if key is not None:obj._motion_key='label:regression:'+key
    return obj


def regression_principle_visual(event,run,snapshot,show_after=True):
    if run['trace']['algorithmId']!='linear-regression':return None
    ctx=regression_context(event,run,show_after);state=ctx['state'];complete=ctx['completed'];v=ctx['values'];n=ctx['n'];phase=event['phase'];data=state['data'];focus=ctx['focus'];fit_count=ctx['fit_count']
    out=VGroup(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0))
    # Axes keep the same scale for base/counterexample so line changes remain comparable.
    pt=lambda x,y:[-3.35+x*.066,-1.42+y*.031,0]
    for x in [0,10,20,30,40,50]:
        p=pt(x,0);out.add(Line(p,pt(x,100),stroke_color=RULE,stroke_width=.5),_regression_label(x,p[0],p[1]-.14,11,MUTED,.4))
    for y in [0,20,40,60,80,100]:
        p=pt(0,y);out.add(Line(p,pt(50,y),stroke_color=RULE,stroke_width=.5),_regression_label(y,p[0]-.18,p[1],11,MUTED,.4))
    old_fit=fit_count is not None and fit_count!=n
    if fit_count is not None:
        b=state['slope'];a=state['intercept'];xs=[0,50]
        if b!=0:xs=[max(0,min((0-a)/b,(100-a)/b)),min(50,max((0-a)/b,(100-a)/b))]
        if xs[0]<=xs[1]:
            line=Line(pt(xs[0],a+b*xs[0]),pt(xs[1],a+b*xs[1]),color=MUTED if old_fit else GOLD,stroke_width=1.5 if old_fit else 2.5)
            line._motion_key='regression:fit-line';out.add(line)
    is_old_mean=phase=='mean' and (not v or not show_after)
    if 'meanX' in state:
        mx,my=state['meanX'],state['meanY'];color=MUTED if is_old_mean else '#90B3FF'
        out.add(Dot(pt(mx,my),radius=.085,color=color))
        if phase=='contribution':
            x,y=data[focus]
            for p1,p2,color in [(pt(mx,my),pt(x,my),TEAL),(pt(x,my),pt(x,y),GOLD)]:
                if sum((p2[i]-p1[i])**2 for i in [0,1])>1e-12:out.add(Line(p1,p2,color=color,stroke_width=3))
    for i,(x,y) in enumerate(data):
        color=TEAL if i<n else '#354957';dot=Dot(pt(x,y),radius=.06,color=color);dot._motion_key='regression:point:'+str(i);out.add(dot)
        out.add(_regression_label(str(i+1),pt(x,y)[0]-.18,pt(x,y)[1]+.17,12,color,.35))
        if i==focus:out.add(Circle(radius=.12,color=INK,stroke_width=2).move_to(pt(x,y)))
    if phase=='residual':
        x,y=data[focus];pred=v['predicted'];gap=abs(y-pred)
        if gap>1e-10:out.add(Line(pt(x,pred),pt(x,y),color='#fb8f98',stroke_width=4))
        else:out.add(Line([pt(x,y)[0]-.1,pt(x,y)[1],0],[pt(x,y)[0]+.1,pt(x,y)[1],0],color='#fb8f98',stroke_width=3))
    out.add(_regression_label(f'本轮拟合前 {n} 点 · 灰点尚未使用',0,2.0,19,TEAL,7.4,'batch'),_regression_label('横坐标 x',-1.7,-1.77,13,MUTED,1.4),_regression_label('纵坐标 y',-3.2,1.85,13,MUTED,1.1))
    x=1.8;lines=[]
    if phase=='initialize':lines=[('本轮先用前两点',TEAL),('分别求横、纵坐标均值',INK),('再计算偏差与直线',INK),('其余数据暂不参与',MUTED)]
    elif phase=='mean' and not v:
        p=data[focus];written=show_after or focus>0
        lines=[(f'当前样本 {focus+1}：({p[0]}, {p[1]})',TEAL),(f'本轮横坐标累计：{state.get("sumX",0)}' if written else '本轮坐标和尚未写入',INK),(f'本轮纵坐标累计：{state.get("sumY",0)}' if written else '将从第一个点重新累计',INK),('均值尚在重算',MUTED)]
    elif phase=='mean':
        lines=[(f'横均值 = {v["sumX"]} ÷ {v["n"]}',TEAL),(f'纵均值 = {v["sumY"]} ÷ {v["n"]}',GOLD),(f'均值中心 ({complete["meanX"]}, {complete["meanY"]})',INK),('带截距的最小二乘线经过中心',MUTED)]
    elif phase=='contribution':
        p=data[focus];lines=[(f'当前样本 {focus+1}：({p[0]}, {p[1]})',INK),(f'横向差 = {p[0]} − {state["meanX"]} = {v["dx"]}',TEAL),(f'纵向差 = {p[1]} − {state["meanY"]} = {v["dy"]}',GOLD),(f'本点乘积 {v["product"]}；平方 {v["square"]}',INK),(f'累计乘积 {complete["numerator"]} / 平方 {complete["denominator"]}' if show_after else '本点贡献将在本步累计',MUTED)]
    elif phase=='fit':
        b=complete['slope'];a=complete['intercept'];lines=[(f'斜率 = {v["numerator"]} ÷ {v["denominator"]} = {display(b)}',TEAL),(f'截距 = {v["meanY"]} − {display(b)} × {v["meanX"]}',GOLD),(f'截距 = {display(a)}',GOLD),(f'新直线：y = {display(a)} + {display(b)}x',INK),('本步完成后，直线采用新参数',MUTED)]
    elif phase=='residual':
        lines=[(f'当前核对样本 {focus+1}',TEAL),(f'实际 y = {v["actual"]}',INK),(f'预测 y = {display(v["predicted"])}',GOLD),(f'竖直残差 = {display(v["residual"])}',INK),(f'平方贡献 = {display(event["calculation"]["result"])}',GOLD),('零残差：点与预测位置重合' if v['residual']==0 else '红线是实际值减去预测值',MUTED)]
    else:
        lines=[('逐点核对的竖直残差',TEAL)]+[(f'点 {i}：{display(r)}',INK) for i,r in ctx['residuals']]+[(f'均方根误差 = {display(complete["rmse"])}',GOLD)]
    start=1.35;gap=.49 if len(lines)>5 else .55
    for i,(s,color) in enumerate(lines):out.add(_regression_label(s,x,start-i*gap,18,color,key='detail:'+str(i)))
    note=(f'灰线仍为前 {fit_count} 点的旧拟合；本轮新线尚未求出' if old_fit else '蓝点是均值中心；白圈是当前样本；橙线是已求出的拟合')
    if is_old_mean and 'meanX' in state:note+=' · 灰色中心也是旧值'
    out.add(_regression_label(note,0,-2.02,16,MUTED,7.4,'legend'))
    return out
