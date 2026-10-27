"""Visual projections of recorded generative-system and regret events.

No simulation, random selection, interpolation or rule propagation is rerun.
All decisions and numerical values come from trace records. Coordinate mapping,
recorded-vector drawing and arithmetic formatting are display operations only.
"""
import math
import re
import numpy as np
from manim import Group, Rectangle, RoundedRectangle, Line, DashedLine, Arrow, Dot, Circle, ImageMobject
from visuals import text, TEAL, GOLD, INK, MUTED, RED, RULE, PANEL
from signal_principle_visuals import _recorded, _change, _fmt, _matrix, _card
from film_contract import event_scene

BLUE='#90B3FF'
COLORS=[TEAL,GOLD,BLUE]


def _arrow(start,end,color=TEAL,width=3):
    start=np.array(start,float);end=np.array(end,float)
    if np.linalg.norm(end-start)<.025:return Dot(start,radius=.025,color=color)
    return Arrow(start,end,buff=0,color=color,stroke_width=width,max_tip_length_to_length_ratio=.20)


def _caption(words,y=-1.95,color=MUTED,size=18):
    return text(words,size,color,width=7.3).move_to([0,y,0])


def _regret(event,run):
    names=['石头','布','剪刀'];rule=event['ruleId']
    if rule not in {'regret-policy','regret-update'}:return None
    regrets=_recorded(event,run,'regrets');strategy=_recorded(event,run,'strategy');g=Group()
    if rule=='regret-policy':
        scale=1.55/max(1,max(abs(v) for v in regrets))
        g.add(text('累计遗憾：可为负',22,MUTED).move_to([-1.9,1.75,0]),
              Line([-3.55,.35,0],[-.25,.35,0],color=RULE),
              text('本轮概率：只归一化正部',22,TEAL,width=3.6).move_to([1.95,1.75,0]))
        for i,(r,p) in enumerate(zip(regrets,strategy)):
            x=-3.05+i*1.1;h=max(.015,abs(r)*scale)
            bar=Rectangle(width=.6,height=h,fill_opacity=1,fill_color=TEAL if r>0 else RED,stroke_width=0).move_to([x,.35+(h/2 if r>=0 else -h/2),0]);bar._motion_key=f'regret:{i}'
            g.add(bar,text(_fmt(r),20,TEAL if r>0 else RED).move_to([x,.75,0]),text(names[i],18,MUTED).move_to([x,-1.55,0]))
            y=1-i*.85;g.add(text(names[i],20,INK).move_to([.55,y,0]),Rectangle(width=2,height=.3,fill_color=RULE,fill_opacity=1,stroke_width=0).move_to([2,y,0]))
            if p:
                fill=Rectangle(width=2*p,height=.3,fill_color=COLORS[i],fill_opacity=1,stroke_width=0).move_to([1+p,y,0]);fill._motion_key=f'probability:{i}';g.add(fill)
            g.add(text(f'{p:.3g}',19,COLORS[i]).move_to([3.4,y,0]))
        g.add(_caption('概率在看到本轮对手前确定；历史出拳次数不是这张概率图'))
    else:
        old=next(c['before'] for c in event['changes'] if c['target']=='regrets')
        inc=_recorded(event,run,'increments');alts=_recorded(event,run,'alternatives');act=_recorded(event,run,'action');opp=_recorded(event,run,'opponent');pay=_recorded(event,run,'pay')
        g.add(text(f'实际：{names[act]}  对  {names[opp]}   收益 {_fmt(pay)}',25,GOLD,width=7.2).move_to([0,1.75,0]))
        for x,t in [(-2.8,'动作'),(-1.65,'假如收益'),(-.45,'减实际'),(.8,'本轮差'),(2.6,'旧账 → 新账')]:g.add(text(t,17,MUTED).move_to([x,1.08,0]))
        for i in range(3):
            y=.42-i*.77;color=GOLD if i==act else BLUE
            box=RoundedRectangle(width=7.1,height=.63,corner_radius=.08,stroke_color=color if i==act else RULE,fill_color=PANEL,fill_opacity=1).move_to([0,y,0]);g.add(box)
            for x,t,c in [(-2.8,names[i],color),(-1.65,_fmt(alts[i]),INK),(-.45,_fmt(pay),INK),(.8,_fmt(inc[i]),TEAL if inc[i]>0 else RED if inc[i]<0 else MUTED),(2.6,f'{_fmt(old[i])} → {_fmt(regrets[i])}',color)]:
                g.add(text(t,22,c,width=1.7).move_to([x,y,0]))
        g.add(_caption('同一个已观察的对手动作；实际动作的本轮增量必为0'))
        if event['id']==run['trace']['events'][-1]['id']:
            totals=_recorded(event,run,'totals');score=_recorded(event,run,'score');rounds=_recorded(event,run,'round')
            g.add(_caption(f'{rounds}轮累计次数：石头{totals[0]} / 布{totals[1]} / 剪刀{totals[2]}；净胜{score}',-1.63,GOLD,17))
    return g


def _boids(event,run):
    if event['ruleId']=='boids-stop':
        from visuals import scene_visual
        birds=_recorded(event,run,'birds');mean=_recorded(event,run,'meanNearest')
        scene=event_scene(event,run)
        g=Group(scene_visual(scene,width=7.25,height=3.25).move_to([0,.40,0]))
        g.add(_caption(f'{len(birds)}只鸟：各自最近邻距离求平均 = {_fmt(mean,4)}',-1.58,GOLD,20),
              _caption('统计普通平面距离；平均间距不保证任意两只鸟不碰撞',-1.96,size=17))
        return g
    if event['id'] not in {'0','1'}:return None
    if event['ruleId'] not in {'boids-force','boids-move'}:return None
    forces=_recorded(event,run,'forces');f=forces[0]
    change=next((c for c in event['changes'] if c['target']=='birds'),None)
    birds=change['before'] if change else _recorded(event,run,'birds');b=birds[0]
    def pos(x,y):return np.array([-3.55+x*.034,1.65-y*.034,0])
    g=Group(Rectangle(width=3.4,height=3.4,stroke_color=RULE).move_to([-1.85,-.05,0]))
    g.add(Circle(radius=22*.034,color=TEAL,stroke_opacity=.65).move_to(pos(b['x'],b['y'])),Circle(radius=9*.034,color=RED,stroke_opacity=.45).move_to(pos(b['x'],b['y'])))
    if run['trace']['initialState']['obstacle']:g.add(Circle(radius=7*.034,stroke_color=RED,fill_color=RED,fill_opacity=.15).move_to(pos(50,50)))
    for i,p in enumerate(birds):
        c=GOLD if i==0 else TEAL if i in f['neighbors'] else MUTED
        mark=Dot(pos(p['x'],p['y']),radius=.047 if i==0 else .027,color=c);mark._motion_key=f'bird:{i}';g.add(mark)
        if i==0 or i in f['neighbors']:
            g.add(text(str(i+1),14,c).move_to(pos(p['x'],p['y'])+[.10,.13,0]))
        if i in f['neighbors']:g.add(DashedLine(pos(b['x'],b['y']),pos(p['x'],p['y']),color=TEAL,stroke_opacity=.35))
    g.add(text('邻域半径22 / 分离半径9',17,MUTED,width=3.5).move_to([-1.85,1.96,0]))
    if event['ruleId']=='boids-force':
        origin=np.array([1.45,.35,0]);scale=4.2
        g.add(Line([.2,.35,0],[3.5,.35,0],color=RULE),Line([1.45,-1.1,0],[1.45,1.65,0],color=RULE))
        for key,label,color in [('sep','分离',RED),('coh','靠拢',TEAL),('align','对齐',BLUE),('avoid','避障',GOLD)]:
            vec=f[key];g.add(_arrow(origin,origin+[vec[0]*scale,-vec[1]*scale,0],color))
        g.add(_arrow(origin,origin+[f['fx']*scale,-f['fy']*scale,0],INK,4),text('合力',17,INK).move_to(origin+[f['fx']*scale+.27,-f['fy']*scale+.17,0]))
        g.add(text('四项力同尺度放大',20,MUTED).move_to([1.85,1.96,0]))
        for i,(key,label,c) in enumerate([('sep','分离',RED),('coh','靠拢',TEAL),('align','对齐',BLUE),('avoid','避障',GOLD)]):g.add(text(f'{label}x {_fmt(f[key][0])}',16,c,width=1.65).move_to([1.02+(i%2)*1.72,-1.35-(i//2)*.35,0]))
    else:
        after=change['after'][0];origin=np.array([.65,.1,0]);scale=1.55
        g.add(_arrow(origin,origin+[b['vx']*scale,-b['vy']*scale,0],MUTED),_arrow(origin,origin+[after['vx']*scale,-after['vy']*scale,0],GOLD,4))
        g.add(text('速度放大图（同一尺度）',20,MUTED,width=3.5).move_to([1.85,1.96,0]),text('灰：旧速度 / 橙：新速度',18,MUTED,width=3.5).move_to([1.85,1.4,0]))
        g.add(text(f'每轴先限 ±0.18',23,TEAL).move_to([1.85,-1.05,0]),text(f'新vx {_fmt(after["vx"])}',22,GOLD).move_to([1.85,-1.5,0]))
    g.add(_caption('示例鸟1；所有鸟都读旧状态，再同步移动',-2.15,size=17))
    return g


def _life(event,run):
    if event['id'] not in {'0','1'}:return None
    sample=run['trace']['events'][1]
    ch=next(c for c in sample['changes'] if c['target']=='cells');old,new=ch['before'],ch['after'];counts=_change(sample,'counts');cols=run['trace']['initialState']['cols'];rows=run['trace']['initialState']['rows']
    g=Group();roles=[('births','出生',GOLD),('survive','存活',TEAL),('deaths','死亡',RED)]
    for k,(key,title,color) in enumerate(roles):
        index=_change(sample,key)[0];cx=index%cols;cy=index//cols;x=(k-1)*2.5
        g.add(text(f'{title} · 格{index}',21,color).move_to([x,1.65,0]))
        for dy in [-1,0,1]:
            for dx in [-1,0,1]:
                j=((cy+dy)%rows)*cols+(cx+dx)%cols;center=[x+dx*.59,.45-dy*.59,0];alive=old[j]
                box=Rectangle(width=.55,height=.55,fill_color=TEAL if alive else PANEL,fill_opacity=.65 if alive else 1,stroke_color=color if dx==dy==0 else RULE,stroke_width=3 if dx==dy==0 else 1).move_to(center);g.add(box,text(str(alive),18,INK).move_to(center))
        g.add(text(f'旧 {old[index]} · 邻居 {counts[index]}',20,MUTED).move_to([x,-.8,0]),_arrow([x,-1,0],[x,-1.3,0],color),text(f'新 {new[index]}',26,color).move_to([x,-1.58,0]))
    g.add(_caption('三组都读取同一旧代；中心不计数，橙/青/红框只是标记',-2.08,size=17))
    return g


def _perlin(event,run):
    if event['ruleId']=='perlin-gradient':return None
    v=event.get('calculation',{}).get('values',{});g=Group()
    if event['ruleId']=='perlin-blend':
        samples=_change(event,'samples');sample=next(p for p in samples if abs(p['x']-v['x'])<1e-9)
        def pt(x,y):return np.array([-3.0+2.4*x,1.1-2.4*y,0])
        g.add(Rectangle(width=2.4,height=2.4,stroke_color=RULE).move_to(pt(.5,.5)))
        p=pt(sample['xx'],sample['yy']);g.add(Dot(p,radius=.065,color=GOLD),text('P',20,GOLD).move_to(p+[.13,-.25,0]))
        for i,(x,y) in enumerate([(0,0),(1,0),(0,1),(1,1)]):
            at=pt(x,y);grad=sample['gradients'][i];g.add(Dot(at,radius=.04,color=TEAL),_arrow(at,at+[grad[0]*.28,-grad[1]*.28,0],TEAL),DashedLine(at,p,color=GOLD,stroke_opacity=.45))
            g.add(text(f'd{i}={_fmt(sample["dots"][i])}',18,TEAL if sample['dots'][i]>=0 else RED,width=1.7).move_to(at+[0,.48 if y==0 else -.43,0]))
        g.add(text('角点箭头=真实梯度；虚线=到P位移',16,MUTED,width=4.0).move_to([-1.8,-1.97,0]))
        for y,label,val,c in [(1.25,'上方横向混合',sample['top'],TEAL),(.15,'下方横向混合',sample['bottom'],BLUE),(-1.13,'纵向混合结果',sample['value'],GOLD)]:g.add(_card(label,_fmt(val,4),[1.95,y,0],c,width=3.0))
        g.add(_arrow([.34,1.25,0],[.34,-1.13,0],TEAL),_arrow([.34,.15,0],[.34,-1.13,0],BLUE),_arrow([.34,-1.13,0],[.44,-1.13,0],GOLD))
        g.add(text(f'u={_fmt(sample["u"],4)} · v={_fmt(sample["v"],4)}',18,MUTED,width=3.4).move_to([1.95,-1.97,0]))
        return g
    if event['ruleId']=='perlin-layer':
        total=v['累计振幅'];acc=v['示例累计'];value=event['calculation']['result'];generation=v['层号从0']+1
        g.add(text(f'第{generation}层完成：示例同一位置',24,TEAL).move_to([0,1.75,0]))
        g.add(Line([-3.35,.7,0],[3.35,.7,0],color=RULE),text('累计带符号值',20,MUTED).move_to([-2.2,1.2,0]))
        g.add(Rectangle(width=max(.025,abs(acc)*8),height=.5,fill_color=TEAL if acc>=0 else RED,fill_opacity=1,stroke_width=0).move_to([acc*4,.7,0]),Dot([0,.7,0],radius=.04,color=INK),text(_fmt(acc,5),23,GOLD).move_to([2.4,1.2,0]))
        g.add(_card('除以累计振幅',_fmt(total),[-1.9,-.45,0],BLUE,width=2.8),_arrow([-.4,-.45,0],[.4,-.45,0],GOLD),_card('0.5 + 0.7×归一化值',_fmt(value,4),[1.95,-.45,0],GOLD,width=3.0))
        for i in range(60):
            shade=i/59;c='#%02x%02x%02x'%(int(20+70*shade),int(65+160*shade),int(85+100*shade));g.add(Rectangle(width=.1,height=.22,fill_color=c,fill_opacity=1,stroke_width=0).move_to([-2.95+i*.1,-1.4,0]))
        g.add(_arrow([-3+6*value,-1.03,0],[-3+6*value,-1.27,0],GOLD),_caption('显示颜色的位置；并非计算真实海拔',-1.92))
        return g
    return None


def _lsystem(event,run):
    rule=event['ruleId'];generation=_recorded(event,run,'generation');seq=_recorded(event,run,'sequence');g=Group()
    if rule=='lsystem-rewrite':
        g.add(text(f'第{generation}代的真实指令',26,TEAL).move_to([0,1.7,0]))
        line=seq if len(seq)<=22 else seq[:22]+'…'
        for j,symbol in enumerate(line):
            x=(j-(len(line)-1)/2)*min(.56,7/max(1,len(line)));g.add(text(symbol,28,GOLD if symbol=='F' else BLUE).move_to([x,.65,0]))
        g.add(_caption(f'本代 {len(seq)} 个符号 / {seq.count("F")} 个F画线',-.3,INK,24),_caption('F → '+run['trace']['initialState']['rule'],-1.05,TEAL,26),_caption('只替换上一代的F；新生F等下一代',-1.85))
        return g
    if rule=='lsystem-finish':
        # A finish event records this generation's complete geometry. Project
        # those segments directly; the generic snapshot can still be the last
        # turtle-operation matrix, especially for generation zero.
        segments=_recorded(event,run,'rawSegments') or []
        if not segments:return None
        pairs=[(s[:2],s[2:]) if isinstance(s[0],(int,float)) else (s[0],s[1]) for s in segments]
        xs=[p[0] for pair in pairs for p in pair];ys=[p[1] for pair in pairs for p in pair]
        scale=min(6.5/max(.1,max(xs)-min(xs)),2.85/max(.1,max(ys)-min(ys)))
        mid=[(min(xs)+max(xs))/2,(min(ys)+max(ys))/2]
        def complete_pos(p):return np.array([(p[0]-mid[0])*scale,.05-(p[1]-mid[1])*scale,0])
        for a,b in pairs:g.add(Line(complete_pos(a),complete_pos(b),color=TEAL,stroke_width=3))
        g.add(text(f'第{generation}代完成 · {len(segments)}条线段',25,TEAL,width=7.1).move_to([0,1.85,0]),
              _caption('本代真实线段等比例显示；缩放不改变角度和长度比',-1.85,size=18))
        return g
    if rule not in {'lsystem-draw','lsystem-stack'}:return None
    matrix=event['scene']['matrix'];before,after=matrix;symbol=event['calculation']['values']['符号'];eid=int(event['id'])
    start=eid
    while start>0 and run['trace']['events'][start]['ruleId']!='lsystem-rewrite':start-=1
    finish=eid
    while finish<len(run['trace']['events'])-1 and run['trace']['events'][finish]['ruleId']!='lsystem-finish':finish+=1
    bounds=_change(run['trace']['events'][finish],'rawSegments')
    coordinates=[p for segment in bounds for p in segment]
    # rawSegments stores [x1,y1,x2,y2]; support explicit point pairs as well.
    if coordinates and isinstance(coordinates[0],(float,int)):
        xs=[s[0] for s in bounds]+[s[2] for s in bounds];ys=[s[1] for s in bounds]+[s[3] for s in bounds]
    else:
        xs=[p[0] for p in coordinates];ys=[p[1] for p in coordinates]
    scale=min(3.05/max(.1,max(xs)-min(xs)),3.05/max(.1,max(ys)-min(ys)));mid=[(min(xs)+max(xs))/2,(min(ys)+max(ys))/2]
    def pos(p):return np.array([-1.8+(p[0]-mid[0])*scale,.0-(p[1]-mid[1])*scale,0])
    for previous in run['trace']['events'][start+1:eid+1]:
        if previous.get('calculation',{}).get('values',{}).get('符号')=='F':
            a,b=previous['scene']['matrix'];g.add(Line(pos(a),pos(b),color=GOLD if previous['id']==event['id'] else TEAL,stroke_width=4 if previous['id']==event['id'] else 2))
    g.add(Dot(pos(after),radius=.055,color=GOLD),_arrow(pos(after),pos(after)+[.4*math.cos(math.radians(after[2])),-.4*math.sin(math.radians(after[2])),0],GOLD))
    if symbol==']':g.add(DashedLine(pos(before),pos(after),color=BLUE,stroke_opacity=.7))
    g.add(text('虚线仅示恢复，不新增枝条' if symbol==']' else '真实指令产生的部分枝条',17,MUTED,width=3.7).move_to([-1.8,-1.95,0]))
    stack=_recorded(event,run,'stack') or []
    g.add(text(f'当前符号 {symbol}',27,GOLD).move_to([1.95,1.7,0]),text(f'保存栈：{len(stack)}层',21,TEAL).move_to([1.95,1.13,0]))
    for i,frame in enumerate(stack[-3:]):
        x,y,heading=frame['x'],frame['y'],frame['a'];g.add(_card('栈顶' if i==len(stack[-3:])-1 else '较早保存',f'({_fmt(x,2)},{_fmt(y,2)}) {math.degrees(heading):.0f}°',[1.95,.45-i*.74,0],GOLD if i==len(stack[-3:])-1 else BLUE,width=3.2))
    if not stack:g.add(text('空栈',25,MUTED).move_to([1.95,.4,0]))
    g.add(text(f'位置 ({_fmt(after[0],3)}, {_fmt(after[1],3)})',20,INK,width=3.4).move_to([1.95,-1.23,0]),text(f'方向 {after[2]:.0f}°',21,BLUE).move_to([1.95,-1.67,0]))
    return g


def _voronoi(event,run):
    sites=run['trace']['initialState']['sites'];owner=_recorded(event,run,'owner');width=64;height=40
    colors=np.array([[20,35,49],[45,134,126],[199,139,62],[85,109,170]],dtype=np.uint8);rgb=colors[np.array(owner).reshape(height,width)+1]
    # The sampled array is 64x40, but the physical source coordinates span a
    # 100x100 square. Explicit stretch avoids ImageMobject's aspect-preserving
    # height setter expanding the map into the adjacent distance bars.
    image=ImageMobject(rgb);image.stretch_to_fit_width(3.45);image.stretch_to_fit_height(3.45);image.move_to([-1.85,0,0]);g=Group(image)
    def pos(x,y):return np.array([-3.575+x*.0345,1.725-y*.0345,0])
    focus=run['trace']['events'][1]['calculation']['values']['示例格'];p=pos((focus%width+.5)/width*100,(focus//width+.5)/height*100)
    g.add(Dot(p,radius=.05,color=INK),text('示例格',15,INK).move_to(p+[.33,-.16,0]))
    site=_recorded(event,run,'site');site=-1 if site is None else site
    best=owner[focus]
    for i,s in enumerate(sites):
        g.add(Dot(pos(s['x'],s['y']),radius=.065,color=COLORS[i]),text(str(i+1),18,INK).move_to(pos(s['x'],s['y'])+[.12,.13,0]))
        if i<=site:g.add(DashedLine(p,pos(s['x'],s['y']),color=GOLD if i==best else MUTED,stroke_width=3 if i==best else 1))
    for i in range(site+1):
        record=run['trace']['events'][i+1];distance=record['calculation']['values']['新距离'];y=1.05-i*.9;c=GOLD if i==best else MUTED
        g.add(text(f'站点{i+1}：{_fmt(distance,3)}',23,c,width=3.5).move_to([1.85,y+.27,0]),Rectangle(width=distance*.048,height=.28,fill_color=c,fill_opacity=1,stroke_width=0).move_to([.25+distance*.024,y-.2,0]))
    if site<0:g.add(text('尚未比较站点\n全部归属为空',26,MUTED,width=3.3).move_to([1.85,.3,0]))
    if event['ruleId']=='voronoi-stop':
        # Keep the same physical square and owner colors at completion. This
        # statistic is recorded over every grid center, not the highlighted one.
        farthest=_recorded(event,run,'farthest')
        g.add(text('全网格：最远的最近距离',17,MUTED,width=3.5).move_to([1.85,-1.35,0]),
              text(_fmt(farthest,3),23,GOLD).move_to([1.85,-1.69,0]))
    g.add(_caption('线段显示已比较的直线距离；格心归属是离散近似',-2.0,size=17))
    return g


def _reaction(event,run):
    if event['id'] not in {'0','1'}:
        # A recorded matrix is the input window, whereas recorded image scenes
        # are the completed global field. Keep these phases visibly distinct.
        scene=event.get('scene',{})
        if event['ruleId']!='reaction-update' or scene.get('kind')!='matrix':return None
        v=event['calculation']['values'];window=[value for row in scene['matrix'] for value in row]
        g=Group(_matrix(window,'本步读取的旧V',-2.0,.15,width=2.6,chosen=4,places=4,key='old-v'),
                _card('本步计算的新V',_fmt(event['calculation']['result'],4),[1.9,1.15,0],GOLD,width=3.0),
                _arrow([-.5,.15,0],[.2,.15,0],GOLD))
        for y,label,value in [(.22,'扩散 0.5×lapV',.5*v['lapV']),(-.4,'反应 +UV²',v['UV²']),(-1.02,'移除 −(f+k)V',-v['移除V'])]:
            g.add(text(f'{label} = {_fmt(value,4)}',19,TEAL if value>=0 else RED,width=3.3).move_to([1.9,y,0]))
        g.add(_caption(f'格{v["示例格"]}：旧V {_fmt(v["V"],4)} → 新V {_fmt(event["calculation"]["result"],4)}',-1.75,GOLD,20),
              _caption('左侧是本步输入邻域；右侧是该格更新结果，不是同一时点',-2.12,size=16))
        return g
    initial=run['trace']['initialState'];focus=initial['focus'];cols=initial['cols'];rows=initial['rows'];x=focus%cols;y=focus//cols
    old=initial['v'];window=[old[((y+dy)%rows)*cols+(x+dx)%cols] for dy in [-1,0,1] for dx in [-1,0,1]]
    if event['id']=='0':
        return Group(_matrix([.05,.2,.05,.2,-1,.2,.05,.2,.05],'扩散核：权重和为0',-1.9,.1,width=2.5,key='laplace'),_matrix(window,f'真实V邻域 · 格{focus}',1.9,.1,width=2.5,chosen=4,places=3,key='v'),_caption('正邻居×0.2，斜邻居×0.05，减去中心；均匀值相互抵消',-1.8,size=17))
    v=event['calculation']['values'];parts=[v['V'],.5*v['lapV'],v['UV²'],-v['移除V']];labels=['旧V','扩散','反应','移除'];g=Group(_matrix(window,'本步读取的旧V',-2.4,.3,width=1.9,chosen=4,places=3,key='v'))
    g.add(text(f'U={_fmt(v["U"],4)}',19,TEAL).move_to([-2.4,-1,0]),text(f'UV²={_fmt(v["UV²"],4)}',19,GOLD).move_to([-2.4,-1.45,0]))
    base=-1.1;scale=7;acc=0
    for i,(amount,label) in enumerate(zip(parts,labels)):
        px=-.25+i*.9;previous=acc;acc+=amount;low=min(previous,acc);h=max(.015,abs(amount)*scale);color=TEAL if amount>=0 else RED
        g.add(Rectangle(width=.62,height=h,fill_color=color,fill_opacity=.85,stroke_width=0).move_to([px,base+(low+abs(amount)/2)*scale,0]),text(_fmt(amount,4),16,color,width=.85).move_to([px,base+max(previous,acc)*scale+.2,0]),text(label,17,MUTED).move_to([px,-1.46,0]))
        if i<3:g.add(DashedLine([px+.31,base+acc*scale,0],[px+.59,base+acc*scale,0],color=MUTED))
    g.add(text('V浓度逐项收支（同一纵轴）',21,MUTED,width=4.3).move_to([1.18,1.75,0]),text(f'新V = {_fmt(event["calculation"]["result"],4)}',24,GOLD).move_to([1.2,-1.95,0]))
    return g


def _tile(mask,x,y,size=.55,color=TEAL,rejected=False):
    g=Group(Rectangle(width=size,height=size,stroke_color=color,fill_color=PANEL,fill_opacity=1).move_to([x,y,0]))
    for bit,dx,dy in [(1,0,1),(2,1,0),(4,0,-1),(8,-1,0)]:
        if mask&bit:g.add(Line([x,y,0],[x+dx*size*.46,y+dy*size*.46,0],color=color,stroke_width=4))
    if not mask:g.add(Dot([x,y,0],radius=size*.09,color=color))
    if rejected:g.add(Line([x-size*.44,y-size*.44,0],[x+size*.44,y+size*.44,0],color=RED,stroke_width=3),Line([x-size*.44,y+size*.44,0],[x+size*.44,y-size*.44,0],color=RED,stroke_width=3))
    return g


def _wfc(event,run):
    rule=event['ruleId'];n=run['trace']['initialState']['size']
    # The first seven recorded events are the detailed candidate/queue lesson.
    # Repeated propagation and later choices use the full evolving road scene.
    if rule=='wfc-stop' or int(event['id'])>6:return None
    if n>8:return None
    domains=[_recorded(event,run,f'domain:{i}') for i in range(n*n)];g=Group();cell=3.4/n
    def pos(i):return np.array([-3.55+(i%n+.5)*cell,1.7-(i//n+.5)*cell,0])
    selected=_recorded(event,run,'selectedCell');source=_recorded(event,run,'from') if rule=='wfc-propagate' else _recorded(event,run,'current');target=_recorded(event,run,'to') if rule=='wfc-propagate' else None
    for i,domain in enumerate(domains):
        center=pos(i);color=GOLD if i in [selected,target] else TEAL if len(domain)==1 else RULE
        box=Rectangle(width=cell-.025,height=cell-.025,stroke_color=color,fill_color=PANEL,fill_opacity=1,stroke_width=2 if color!=RULE else 1).move_to(center);g.add(box,text(str(len(domain)),17,color if color!=RULE else BLUE).move_to(center),text(str(i),9,MUTED).move_to(center+[-cell*.29,cell*.28,0]))
    if rule=='wfc-propagate':g.add(_arrow(pos(source),pos(target),GOLD,3))
    g.add(text('格内数字：仍可能的图块数',17,MUTED,width=3.5).move_to([-1.85,-1.95,0]))
    if rule in {'wfc-init','wfc-select'}:
        index=0 if rule=='wfc-init' else selected
        ch=next((c for c in event['changes'] if c['target']==f'domain:{index}'),None);domain=ch['before'] if rule=='wfc-select' else domains[index]
        g.add(text(f'格{index}的候选图块',23,TEAL).move_to([1.85,1.7,0]))
        for i,mask in enumerate(domain):
            px=.8+i*1.8;g.add(_tile(mask,px,.7,size=.9,color=GOLD if rule=='wfc-select' and mask in domains[index] else BLUE),text(f'掩码{mask}',18,MUTED).move_to([px,.04,0]))
        if rule=='wfc-select':
            weights=_recorded(event,run,'weights');total=sum(weights);threshold=_recorded(event,run,'threshold');left=.2;unit=3.2/total
            for i,w in enumerate(weights):g.add(Rectangle(width=w*unit,height=.4,fill_color=COLORS[i%3],fill_opacity=.7,stroke_color=PANEL).move_to([left+w*unit/2,-.75,0]));left+=w*unit
            marker=.2+threshold*unit;g.add(_arrow([marker,-.05,0],[marker,-.49,0],GOLD),text(f'阈值 {_fmt(threshold,3)} / 总权重 {_fmt(total)}',17,MUTED,width=3.5).move_to([1.8,-1.42,0]))
        else:g.add(text('边界不许道路伸出\n角落只剩2种合法图块',22,MUTED,width=3.5).move_to([1.85,-.95,0]))
    elif rule=='wfc-queue':
        v=event['calculation']['values'];old=[int(i) for i in re.findall(r'\d+',v['出队前'])];queue=_recorded(event,run,'queue') or []
        g.add(text('FIFO：从队首取出',24,TEAL).move_to([1.85,1.7,0]))
        for y,items,title in [(.5,old,'出队前'),(-.85,queue,'出队后')]:
            g.add(text(title,18,MUTED).move_to([1.85,y+.65,0]))
            if not items:g.add(text('空',25,MUTED).move_to([1.85,y,0]))
            for i,item in enumerate(items[:4]):g.add(_card('队首' if i==0 else '等待',str(item),[.65+i*.8,y,0],GOLD if y>0 and i==0 else BLUE,width=.7))
        g.add(text('检查方向：↑ → ↓ ←',20,MUTED).move_to([1.85,-1.65,0]))
    elif rule=='wfc-propagate':
        source_domain=domains[source];candidates=event['candidates'];g.add(text(f'源格{source}：至少一个支持即可',19,TEAL,width=3.5).move_to([1.85,1.78,0]))
        for i,mask in enumerate(source_domain[:4]):g.add(_tile(mask,.6+i*.8,1.1,size=.55,color=TEAL))
        g.add(_arrow([1.85,.67,0],[1.85,.27,0],GOLD),text(f'邻格{target}逐项检查',18,MUTED).move_to([1.85,.05,0]))
        for i,c in enumerate(candidates):
            mask=int(re.search(r'\d+',c['target']).group());x=.55+(i%4)*.88;y=-.64-(i//4)*.9;keep=c['status']=='chosen';g.add(_tile(mask,x,y,size=.58,color=TEAL if keep else RED,rejected=not keep),text(f'{c["values"]["支持数"]}支持',13,TEAL if keep else RED).move_to([x,y-.4,0]))
    return g


def generative_principle_visual(event,run,snapshot,show_after):
    """Project a real event, or None for the renderer's general scene.

    Specialized panels juxtapose the recorded operands and this step's derived
    output. Use _projection_phase as the footer rather than calling them a pure
    pre-state. Long-world evolution intentionally keeps the general full scene.
    """
    aid=run['trace']['algorithmId']
    functions={'regret':_regret,'boids':_boids,'life':_life,'perlin':_perlin,'lsystem':_lsystem,'voronoi':_voronoi,'reaction-diffusion':_reaction,'wfc':_wfc}
    panel=functions[aid](event,run) if aid in functions else None
    if panel is not None:panel._projection_phase='本步计算依据与推导（并列展示）'
    return panel
