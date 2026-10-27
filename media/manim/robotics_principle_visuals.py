"""Original diagrams projected from recorded robotics teaching events.

No localization, collision checking, policy learning, random draws or control
simulation is rerun. Arithmetic here only maps already recorded quantities to
geometric scales, cumulative-weight interval widths and display labels.
"""
import math
import numpy as np
from manim import Group, Rectangle, RoundedRectangle, Line, DashedLine, Arrow, Dot, Circle, Polygon, Arc
from visuals import text, TEAL, GOLD, INK, MUTED, RED, RULE, PANEL
from signal_principle_visuals import _recorded, _change, _fmt, _card

BLUE='#90B3FF'


def _arrow(a,b,color=TEAL,width=3):
    a=np.array(a,float);b=np.array(b,float)
    if np.linalg.norm(a-b)<.025:return Dot(b,radius=.025,color=color)
    return Arrow(a,b,buff=0,color=color,stroke_width=width,max_tip_length_to_length_ratio=.2)


def _before(event,run,key):
    change=next((c for c in event.get('changes',[]) if c['target']==key),None)
    return change['before'] if change else _recorded(event,run,key)


def _axis(g,y,lo=0,hi=100,x0=-3.4,x1=3.4,ticks=None):
    g.add(Line([x0,y,0],[x1,y,0],color=RULE))
    for value in ticks if ticks is not None else [0,20,40,60,80,100]:
        x=x0+(x1-x0)*(value-lo)/(hi-lo)
        g.add(Line([x,y-.05,0],[x,y+.05,0],color=MUTED),text(_fmt(value,2),15,MUTED).move_to([x,y-.23,0]))
    return lambda value:x0+(x1-x0)*(value-lo)/(hi-lo)


def _particle_predict(event,run,after):
    old=_before(event,run,'particles');new=_change(event,'particles');v=event['calculation']['values'];g=Group()
    g.add(text('150种位置假设 · 共用0—100刻度',22,MUTED).move_to([0,1.85,0]))
    px=_axis(g,.72)
    for i,value in enumerate(new if after else old):
        mark=Dot([px(value),.88+(i%4)*.075,0],radius=.025,color=GOLD if i==0 else TEAL);mark._motion_key=f'particle:{i}';g.add(mark)
    focus=(new if after else old)[0]
    g.add(DashedLine([px(focus),.72,0],[px(focus),1.38,0],color=GOLD),text('粒子1',18,GOLD).move_to([px(focus),1.56,0]))
    # The zoom retains position units; it does not inflate movement on the main axis.
    low=math.floor(min(old[0],new[0])*2)/2-.2;high=low+1.5
    zx=_axis(g,-1.05,low,high,ticks=[math.ceil(low*2)/2,math.ceil(low*2)/2+.5,math.ceil(low*2)/2+1])
    g.add(text('粒子1局部放大：0.5前进 + 记录的过程噪声',19,TEAL,width=7.2).move_to([0,-.18,0]),Dot([zx(old[0]),-.92,0],radius=.06,color=BLUE),text(f'旧 {_fmt(old[0],3)}',18,BLUE).move_to([zx(old[0]),-.6,0]))
    if after:
        g.add(_arrow([zx(old[0]),-.92,0],[zx(new[0]),-.92,0],GOLD,4),Dot([zx(new[0]),-.92,0],radius=.065,color=GOLD),text(f'新 {_fmt(new[0],3)}',18,GOLD).move_to([zx(new[0]),-1.57,0]))
    else:g.add(text(f'本次噪声 {_fmt(v["粒子1噪声"],4)}；尚未写入新位置',19,MUTED,width=7.1).move_to([0,-1.65,0]))
    return g


def _particle_weight(event,run,after):
    positions=_recorded(event,run,'particles');predicted=_change(event,'predictedMeasurements');weights=_change(event,'weights');z=_change(event,'measurement');g=Group()
    # Choosing which recorded example to label is presentation selection only.
    best=max(range(len(weights)),key=lambda i:weights[i]);maxw=max(weights);base=.25;px=_axis(g,base)
    top=1.55;scale=(top-base)/maxw
    g.add(text('相同观测，比较每个假设的测量误差',22,MUTED,width=7.2).move_to([0,2.0,0]),DashedLine([px(z),base,0],[px(z),top+.14,0],color=TEAL),text(f'观测 {_fmt(z,3)}',17,TEAL).move_to([px(z),-.31,0]))
    if after:
        for i,w in enumerate(weights):
            x=px(predicted[i]);y=base+w*scale;color=GOLD if i in [0,best] else BLUE
            stem=Line([x,base,0],[x,max(base+.003,y),0],color=color,stroke_width=1.4);stem._motion_key=f'weight:{i}';g.add(stem,Dot([x,y,0],radius=.023,color=color))
        g.add(text(f'纵轴：归一化权重，峰值{maxw:.2%}',17,MUTED,width=4.2).move_to([1.3,1.44,0]))
    else:
        for i,x in enumerate(predicted):g.add(Dot([px(x),base+.10+(i%3)*.045,0],radius=.023,color=GOLD if i in [0,best] else BLUE))
        g.add(text('执行前：先标观测与假设位置',18,MUTED,width=4.5).move_to([1.1,1.1,0]))
    for row,i in enumerate([best,0]):
        y=-.83-row*.75;c=TEAL if row==0 else RED
        g.add(text(f'粒子{i+1} · {_fmt(predicted[i],3)}',20,c,width=2.7).move_to([-2.05,y,0]),text(f'误差 {_fmt(predicted[i]-z,3)}',19,MUTED,width=2.35).move_to([.1,y,0]))
        if after:
            width=1.35*weights[i]/maxw
            g.add(Rectangle(width=1.35,height=.22,fill_color=RULE,fill_opacity=1,stroke_width=0).move_to([2.25,y-.03,0]))
            if width>.001:g.add(Rectangle(width=width,height=.22,fill_color=c,fill_opacity=1,stroke_width=0).move_to([1.575+width/2,y-.03,0]))
            label=f'{weights[i]:.2%}' if weights[i]>1e-6 else f'{weights[i]:.2g}'
            g.add(text(label,18,c).move_to([2.25,y+.25,0]))
        else:g.add(text('待计算权重',18,MUTED).move_to([2.25,y,0]))
    g.add(text('权重归一化总和=1；远处保留极小正权重',17,MUTED,width=7.3).move_to([0,-2.10,0]))
    return g


def _particle_resample(event,run,after):
    cdf=_recorded(event,run,'cdf');weights=_recorded(event,run,'weights');parents=_change(event,'ancestors');offset=_change(event,'offset');old=_before(event,run,'particles');new=_change(event,'particles');n=len(parents);g=Group()
    def strip(x0,x1,y,upper,show_labels=False):
        previous=0
        for i,end in enumerate(cdf):
            lo=max(0,previous);hi=min(upper,end);previous=end
            if hi<=lo or lo>=upper:continue
            width=(x1-x0)*(hi-lo)/upper;x=x0+(x1-x0)*(lo+hi)/2/upper;c=GOLD if i==parents[0] else TEAL if i%2 else BLUE
            g.add(Rectangle(width=max(.001,width),height=.32,fill_color=c,fill_opacity=.8,stroke_width=0).move_to([x,y,0]))
            if show_labels and width>.7:g.add(text(f'祖先{i+1}',16,INK).move_to([x,y+.34,0]))
        for k,parent in enumerate(parents):
            pointer=offset+k/n
            if pointer>upper:break
            x=x0+(x1-x0)*pointer/upper
            if show_labels:g.add(_arrow([x,y-.62,0],[x,y-.20,0],GOLD if k==0 else MUTED,2))
            else:g.add(Line([x,y-.30,0],[x,y-.19,0],color=GOLD if k==0 else MUTED,stroke_width=1))
        return lambda value:x0+(x1-x0)*value/upper
    g.add(text('累计份额0—1；区间宽度=实际权重',22,MUTED,width=7.2).move_to([0,1.95,0]));strip(-3.35,3.35,1.27,1)
    for x,label in [(-3.35,'0'),(3.35,'1')]:g.add(text(label,17,MUTED).move_to([x,1.65,0]))
    # The first 0.08 cumulative mass is an explicit display zoom, not a new sample.
    upper=.08;xp=strip(-3.35,3.35,.02,upper,True)
    g.add(text('放大累计份额0—0.08；下方指针等距1/150',18,TEAL,width=7.1).move_to([0,.69,0]),text(f'首指针 {_fmt(offset,4)}',17,GOLD).move_to([-2.0,-.88,0]))
    a=parents[0];boundary=cdf[a];g.add(text(f'首个覆盖者：祖先{a+1}，累计到{_fmt(boundary,5)}',18,GOLD,width=7.2).move_to([.25,-1.19,0]))
    if after:
        g.add(text(f'复制 {_fmt(old[a],3)}',23,BLUE).move_to([-2.0,-1.78,0]),_arrow([-.6,-1.78,0],[.6,-1.78,0],GOLD),text(f'抖动后 {_fmt(new[0],3)}',23,GOLD).move_to([2,-1.78,0]))
    else:g.add(text('执行前：已有权重区间；指针决定祖先，尚未写入副本',18,MUTED,width=7.2).move_to([0,-1.78,0]))
    return g


def _obstacles(run):
    # These centers and radii are the geometry already present in the scene.
    values=[]
    for polygon in run['frames'][0]['scene'].get('polygons',[]):
        xs=[p['x'] for p in polygon['points']];ys=[p['y'] for p in polygon['points']]
        values.append(((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,(max(xs)-min(xs))/2))
    return values


def _world(g,run):
    def pos(p):return np.array([-3.65+p[0]*.035,1.75-p[1]*.035,0])
    g.add(Rectangle(width=3.5,height=3.5,stroke_color=RULE).move_to([-1.9,0,0]))
    for i,(x,y,r) in enumerate(_obstacles(run)):
        g.add(Circle(radius=r*.035,fill_color=RULE,fill_opacity=.7,stroke_color=MUTED).move_to(pos([x,y])),text(str(i+1),14,MUTED).move_to(pos([x,y])))
    return pos


def _rrt(event,run,after):
    if int(event['id']) not in {0,1,2,3,4,28,84,85}:return None
    rule=event['ruleId'];g=Group();pos=_world(g,run)
    nodes=_recorded(event,run,'nodes') if after else _before(event,run,'nodes');parents=_recorded(event,run,'parents') if after else _before(event,run,'parents')
    for i,(node,parent) in enumerate(zip(nodes,parents)):
        if parent>=0:g.add(Line(pos(node),pos(nodes[parent]),color=TEAL,stroke_width=1.6))
        g.add(Dot(pos(node),radius=.028,color=TEAL))
    end=next(n for n in run['frames'][0]['scene']['nodes'] if n.get('label')=='终点');goal=[end['x'],end['y']]
    g.add(Dot(pos(goal),radius=.06,color=GOLD),text('终点',15,GOLD).move_to(pos(goal)+[-.2,.2,0]))
    v=event.get('calculation',{}).get('values',{})
    if rule=='rrt-nearest':
        sample=_recorded(event,run,'sample');near=_recorded(event,run,'nearest');distances=_recorded(event,run,'distances')
        g.add(Dot(pos(sample),radius=.055,color=RED),text('本次样本',16,RED).move_to(pos(sample)+[.2,-.2,0]),text('节点到本次样本的距离',20,MUTED,width=3.35).move_to([1.85,1.65,0]))
        for i,d in enumerate(distances):
            color=GOLD if after and i==near else BLUE
            g.add(DashedLine(pos(nodes[i]),pos(sample),color=color,stroke_width=2),text(str(i+1),15,color).move_to(pos(nodes[i])+[-.12,.16,0]))
            y=.82-i*.9;g.add(text(f'节点{i+1}  {_fmt(d,3)}',22,color,width=3.3).move_to([1.85,y+.25,0]),Rectangle(width=3*d/max(distances),height=.23,fill_color=color,fill_opacity=.7,stroke_width=0).move_to([.3+1.5*d/max(distances),y-.1,0]))
        g.add(text('更远的旧节点仍留在树中',18,MUTED,width=3.4).move_to([1.85,-1.65,0]))
    elif rule=='rrt-extend':
        near=_recorded(event,run,'nearest');candidate=_recorded(event,run,'candidate');sample=_recorded(event,run,'sample');accepted=_recorded(event,run,'accepted');origin=nodes[near]
        segment=Line if after and accepted else DashedLine
        g.add(DashedLine(pos(origin),pos(sample),color=BLUE,stroke_width=1),segment(pos(origin),pos(candidate),color=GOLD if accepted else RED,stroke_width=4),Dot(pos(candidate),radius=.045,color=GOLD if accepted else RED))
        if not accepted:g.add(text('红色虚线候选未接入树',15,MUTED,width=3.5).move_to([-1.9,-2.05,0]))
        else:g.add(text('青线为已存树；虚线候选尚未接入' if not after else '碰撞检查通过，新节点与父节点已保存',16,MUTED,width=7.1).move_to([0,-2.13,0]))
        if accepted:
            distance=v['距离'];step=v['步长'];fraction=v['缩放'];g.add(text('朝样本延伸，但限制长度',21,TEAL,width=3.4).move_to([1.85,1.6,0]))
            g.add(Line([.3,.65,0],[3.35,.65,0],color=BLUE,stroke_width=3),Line([.3,.65,0],[.3+3.05*fraction,.65,0],color=GOLD,stroke_width=7),Dot([.3+3.05*fraction,.65,0],radius=.05,color=GOLD))
            g.add(text(f'全距离 {_fmt(distance,3)}',21,BLUE).move_to([1.85,1.12,0]),text(f'本次走 {_fmt(min(step,distance),3)}',23,GOLD).move_to([1.85,.15,0]),text(f'比例 {_fmt(fraction,4)}',20,TEAL).move_to([1.85,-.4,0]),text(f'最小碰撞余量 {_fmt(v["最小碰撞余量"],3)}',18,MUTED,width=3.4).move_to([1.85,-1.05,0]))
        else:
            rejected=next(c for c in event['candidates'] if c['status']=='rejected');oi=int(rejected['target'].split()[-1])-1;ox,oy,r=_obstacles(run)[oi];center=np.array([ox,oy]);points=[origin,candidate,[ox-r-1,oy-r-1],[ox+r+1,oy+r+1]];xs=[p[0] for p in points];ys=[p[1] for p in points];scale=min(2.8/(max(xs)-min(xs)),2.5/(max(ys)-min(ys)));mid=np.array([(max(xs)+min(xs))/2,(max(ys)+min(ys))/2])
            def zoom(p):d=(np.array(p)-mid)*scale;return np.array([1.85+d[0],.05-d[1],0])
            g.add(text('整段检查 · 障碍2局部放大',20,RED,width=3.4).move_to([1.85,1.65,0]),Circle(radius=r*scale,color=MUTED,fill_color=RULE,fill_opacity=.55).move_to(zoom(center)),Circle(radius=(r+1)*scale,color=RED,stroke_width=1).move_to(zoom(center)),Line(zoom(origin),zoom(candidate),color=RED,stroke_width=5),Dot(zoom(candidate),radius=.06,color=RED),text('外圈含1单位安全边距',16,MUTED,width=3.4).move_to([1.85,-1.5,0]),text(f'余量 {_fmt(rejected["values"]["余量"],3)} ≤ 0',20,RED).move_to([1.85,-1.94,0]))
    elif rule=='rrt-goal':
        origin=_recorded(event,run,'candidate');g.add(DashedLine(pos(origin),pos(goal),color=GOLD if v['到终点距离']<v['步长'] else RED,stroke_width=3),text('两个条件缺一不可',24,TEAL,width=3.5).move_to([1.85,1.5,0]))
        near_enough=v['到终点距离']<v['步长'];clear=v['最小余量']>0
        distance_relation='<' if near_enough else '≥';clearance_relation='>' if clear else '≤'
        for y,label,value,passed in [(.55,'距离条件：通过' if near_enough else '距离条件：未通过',f'{_fmt(v["到终点距离"],3)} {distance_relation} {_fmt(v["步长"])}',near_enough),(-.6,'安全余量：通过' if clear else '安全余量：未通过',f'{_fmt(v["最小余量"],3)} {clearance_relation} 0',clear)]:g.add(_card(label,value,[1.85,y,0],TEAL if passed else RED,width=3.2))
    elif rule=='rrt-finish':
        path=_change(event,'path');indices=[nodes.index(point)+1 for point in reversed(path)]
        if after:
            for a,b in zip(path,path[1:]):g.add(Line(pos(a),pos(b),color=GOLD,stroke_width=4))
        g.add(text('沿已记录父节点反向追溯',21,TEAL,width=3.4).move_to([1.85,1.65,0]))
        for k,value in enumerate(indices[:5]):
            y=1.0-k*.47;g.add(text(f'节点 {value}',20,GOLD).move_to([1.85,y,0]))
            if k<4:g.add(_arrow([1.85,y-.18,0],[1.85,y-.29,0],MUTED,2))
        g.add(text(f'… → 节点{indices[-1]}（起点）',19,GOLD,width=3.4).move_to([1.85,-1.65,0]))
    return g


def _potential(event,run,after):
    if int(event['id']) not in {0,1,4,6,261}:return None
    g=Group();pos=_world(g,run);rule=event['ruleId'];old=_before(event,run,'position');new=_recorded(event,run,'position');robot=new if after else old
    goal_node=next(n for n in run['frames'][0]['scene']['nodes'] if n.get('label')=='目标');goal=[goal_node['x'],goal_node['y']]
    g.add(Dot(pos(robot),radius=.065,color=GOLD),Dot(pos(goal),radius=.06,color=TEAL),text('目标',15,TEAL).move_to(pos(goal)+[-.15,.2,0]))
    if rule=='potential-force':
        attr=_change(event,'attraction');reps=_change(event,'repulsion');force=_change(event,'force');ox,oy,r=_obstacles(run)[0]
        g.add(Circle(radius=(r+18)*.035,color=BLUE,stroke_width=1).move_to(pos([ox,oy])),DashedLine(pos(robot),pos([ox,oy]),color=BLUE,stroke_width=1),_arrow(pos(robot),pos(robot)+np.array([attr[0],-attr[1],0])*.12,GOLD,4))
        if int(event['id']) in {0,4}:
            distance=reps[0][2];g.add(text('障碍1：边缘距离与阈值',20,MUTED,width=3.4).move_to([1.85,1.65,0]));x0=.35;scale=3/22
            g.add(Line([x0,.65,0],[x0+3,.65,0],color=RULE),Rectangle(width=18*scale,height=.3,fill_color=BLUE,fill_opacity=.3,stroke_width=0).move_to([x0+9*scale,.65,0]),Line([x0+18*scale,.3,0],[x0+18*scale,1.1,0],color=TEAL),Dot([x0+distance*scale,.65,0],radius=.06,color=GOLD),text('18',18,TEAL).move_to([x0+18*scale,1.34,0]),text(f'实际 {_fmt(distance,3)}',22,GOLD).move_to([1.85,-.02,0]),text('进入范围 → 计入排斥' if distance<18 else '范围之外 → 本步排斥为0',19,TEAL if distance<18 else MUTED,width=3.4).move_to([1.85,-.7,0]),text(f'吸引x {_fmt(attr[0],3)}',19,GOLD).move_to([1.85,-1.3,0]))
        else:
            origin=np.array([.5,.75,0]);g.add(text('同尺度分力相加',21,TEAL,width=3.3).move_to([1.85,1.65,0]),_arrow(origin,origin+[attr[0]*.5,-attr[1]*.5,0],GOLD,4),_arrow(origin,origin+[force[0]*.5,-force[1]*.5,0],BLUE,2),text('本步排斥小，合力近乎重合',17,MUTED,width=3.4).move_to([1.85,.23,0]))
            rp=reps[0];origin=np.array([2.7,-.8,0]);g.add(text('单独放大排斥×1000',19,RED,width=3.4).move_to([1.85,-.3,0]),_arrow(origin,origin+[rp[0]*500,-rp[1]*500,0],RED,4),text(f'({_fmt(rp[0],5)}, {_fmt(rp[1],5)})',17,RED,width=3.5).move_to([1.85,-1.55,0]))
        g.add(text('地图圆环：障碍边缘再向外18；非真实物理磁力',16,MUTED,width=7.2).move_to([0,-2.08,0]))
    else:
        candidate=_recorded(event,run,'candidate');v=event['calculation']['values'];g.add(_arrow(pos(old),pos(candidate),GOLD,3))
        if int(event['id'])==1:
            g.add(text('大合力先归一化，位移最多0.8',20,TEAL,width=3.4).move_to([1.85,1.65,0]));px=_axis(g,-.1,7.8,9,ticks=[8,8.4,8.8],x0=.35,x1=3.35)
            g.add(Dot([px(old[0]),.05,0],radius=.06,color=BLUE),text('旧8',20,BLUE).move_to([px(old[0]),.5,0]))
            if after:g.add(_arrow([px(old[0]),.05,0],[px(new[0]),.05,0],GOLD,4),Dot([px(new[0]),.05,0],radius=.06,color=GOLD))
            g.add(text(f'候选x {_fmt(candidate[0])}',22,GOLD).move_to([1.85,-.8,0]),text('局部坐标放大；整段通过碰撞检查',17,MUTED,width=3.4).move_to([1.85,-1.5,0]))
        else:
            # The target-neighborhood inset has the same 2-unit radius as stop.
            def zp(p):return np.array([1.85+(p[0]-goal[0])*.55,.1-(p[1]-goal[1])*.55,0])
            g.add(text('终点附近放大：半径2',21,TEAL,width=3.4).move_to([1.85,1.65,0]),Circle(radius=1.1,color=TEAL,fill_color=TEAL,fill_opacity=.08).move_to(zp(goal)),Dot(zp(goal),radius=.04,color=TEAL),Dot(zp(old),radius=.05,color=BLUE))
            if after:g.add(_arrow(zp(old),zp(new),GOLD,3),Dot(zp(new),radius=.055,color=GOLD))
            g.add(text(f'新距离 {_fmt(event["calculation"]["result"],3)} < 2',22,GOLD,width=3.4).move_to([1.85,-1.5,0]))
    return g


def _pursuit(event,run,after):
    if int(event['id']) not in {0,1,2,890}:return None
    g=Group();route=run['frames'][0]['scene']['paths'][0]['points'];old=_before(event,run,'position');new=_recorded(event,run,'position');robot=new if after else old;aim=_recorded(event,run,'aim');heading=_before(event,run,'heading');pos=_world(g,run)
    for a,b in zip(route,route[1:]):g.add(Line(pos([a['x'],a['y']]),pos([b['x'],b['y']]),color=BLUE,stroke_width=1.5))
    g.add(Dot(pos(robot),radius=.06,color=GOLD),Dot(pos(aim),radius=.05,color=RED),DashedLine(pos(robot),pos(aim),color=RED,stroke_width=1.5))
    rule=event['ruleId'];v=event['calculation']['values']
    if rule=='pursuit-target':
        nearest=_recorded(event,run,'nearest');target=_recorded(event,run,'target');p=route[nearest]
        g.add(Circle(radius=12*.035,color=TEAL,stroke_width=1).move_to(pos(robot)),Dot(pos([p['x'],p['y']]),radius=.05,color=TEAL),text('最近4',16,TEAL).move_to(pos([p['x'],p['y']])+[.35,.13,0]),text('前视9',16,RED).move_to(pos(aim)+[.35,-.17,0]),text('两个角色，不能混用',22,TEAL,width=3.5).move_to([1.85,1.65,0]))
        for y,label,value,c in [(.8,'最近路点',str(nearest+1),TEAL),(-.15,'前视阈值','12',BLUE),(-1.1,'前视9的真实距离',_fmt(event['calculation']['result'],3),RED)]:g.add(_card(label,value,[1.85,y,0],c,width=3.2))
    elif rule=='pursuit-steer':
        alpha=_recorded(event,run,'alpha');delta=_recorded(event,run,'delta');o=np.array([.55,.25,0]);length=2.55
        g.add(text('车头 / 前视 / 车轮方向',21,TEAL,width=3.4).move_to([1.85,1.65,0]),_arrow(o,o+[length,0,0],BLUE,3),_arrow(o,o+[length*math.cos(alpha),-length*math.sin(alpha),0],RED,3),_arrow(o,o+[1.8*math.cos(delta),-1.8*math.sin(delta),0],TEAL,3),Arc(radius=.8,start_angle=-alpha,angle=alpha,color=GOLD).shift(o),Arc(radius=1.2,start_angle=-delta,angle=delta,color=TEAL).shift(o),text(f'α={math.degrees(alpha):.2f}°',20,GOLD).move_to([1.85,.9,0]),text(f'车轮转角 δ={math.degrees(delta):.2f}°',21,TEAL,width=3.45).move_to([1.85,-1.17,0]),text('蓝=车头；红=前视；青=车轮',17,MUTED,width=3.45).move_to([1.85,-1.77,0]))
    elif rule=='pursuit-motion':
        new_heading=_recorded(event,run,'heading');distance=math.dist(old,new);o=np.array([.7,.35,0]);scale=3
        g.add(text('本步位置和朝向局部放大',20,TEAL,width=3.4).move_to([1.85,1.65,0]),Dot(o,radius=.065,color=BLUE),_arrow(o,o+[1.2*math.cos(heading),-1.2*math.sin(heading),0],BLUE,2))
        if after:
            n=o+[scale*(new[0]-old[0]),-scale*(new[1]-old[1]),0];g.add(_arrow(o,n,GOLD,4),Dot(n,radius=.065,color=GOLD),_arrow(n,n+[.35*math.cos(new_heading),-.35*math.sin(new_heading),0],GOLD,2))
        g.add(text(f'朝向 {_fmt(math.degrees(heading),2)}° → {_fmt(math.degrees(new_heading),2)}°',19,BLUE,width=3.4).move_to([1.85,.95,0]),text(f'实际位移 {_fmt(distance,3)}',22,GOLD).move_to([1.85,-1.43,0]),text('车轮转角不等于车身一步转角',17,MUTED,width=3.4).move_to([1.85,-1.95,0]))
    return g


def _qlearning(event,run,after):
    if int(event['id']) not in {1,2,137,1169}:return None
    rule=event['ruleId'];g=Group();initial=run['trace']['events'][0]['scene'];rows=initial['rows'];cols=initial['cols'];old=_before(event,run,'position');new=_recorded(event,run,'position');cell=.42
    def pos(i):return np.array([-3.55+(i%cols+.5)*cell,1.25-(i//cols+.5)*cell,0])
    for i,status in enumerate(initial['cells']):
        c=RULE if status==1 else PANEL;g.add(Rectangle(width=cell-.02,height=cell-.02,fill_color=c,fill_opacity=1,stroke_color=TEAL if i==47 else MUTED,stroke_width=.5).move_to(pos(i)))
        if i in {old,new,47}:g.add(text(str(i),16,GOLD if i in {old,new} else TEAL).move_to(pos(i)))
    selected=next(c for c in event['candidates'] if c['status']=='chosen');action=selected['target'];directions={'上':[0,1,0],'右':[1,0,0],'下':[0,-1,0],'左':[-1,0,0]}
    g.add(Circle(radius=.19,color=GOLD,stroke_width=2).move_to(pos(new if after else old)),_arrow(pos(old),pos(old)+np.array(directions[action])*.37,RED if old==new else GOLD,3),text(f'格{old} → {new} · 选{action}',21,GOLD,width=3.4).move_to([-1.85,1.65,0]))
    if old==new:g.add(text('越界或撞墙：位置不变',18,RED,width=3.4).move_to([-1.85,-1.7,0]))
    else:g.add(text('同一张环境图；只执行本次动作',17,MUTED,width=3.4).move_to([-1.85,-1.7,0]))
    g.add(text('动作价值Q：越大越好',21,TEAL,width=3.4).move_to([1.85,1.65,0]))
    if rule=='q-update':
        matrix=event['scene']['matrix'];oldq,newq=matrix
        for i,candidate in enumerate(event['candidates']):
            x=.7+i*.8;c=GOLD if candidate['status']=='chosen' else MUTED;g.add(text(candidate['target'],20,c).move_to([x,1.1,0]),text(_fmt(oldq[i],3),17,c).move_to([x,.66,0]))
            if after:g.add(text(_fmt(newq[i],3),19,c).move_to([x,.18,0]))
        g.add(text('旧',15,MUTED).move_to([.1,.66,0]))
        g.add(text('新',15,TEAL).move_to([.1,.18,0]) if after else text('尚未写入新Q',17,TEAL).move_to([1.85,.18,0]))
        draw=_recorded(event,run,'exploreDraw');g.add(text(f'探索抽数 {_fmt(draw,4)} ≥ ε0.25：按Q选',17,MUTED,width=3.55).move_to([1.85,-.35,0]))
        v=event['calculation']['values'];target=_recorded(event,run,'tdTarget');start=v['Q旧'];result=event['calculation']['result'];lo=min(start,target);hi=max(start,target);span=max(.1,hi-lo)
        def qx(value):return .4+2.95*(value-lo)/span
        g.add(Line([.4,-1.15,0],[3.35,-1.15,0],color=RULE),Dot([qx(start),-1.15,0],radius=.05,color=BLUE),Dot([qx(target),-1.15,0],radius=.05,color=RED),text(f'目标 {_fmt(target)}',17,RED).move_to([qx(target),-.84,0]),text(f'旧 {_fmt(start)}',17,BLUE).move_to([qx(start),-1.57,0]))
        if after:g.add(_arrow([qx(start),-1.15,0],[qx(result),-1.15,0],GOLD,4),Dot([qx(result),-1.15,0],radius=.06,color=GOLD),text(f'新 {_fmt(result)}',17,GOLD).move_to([qx(result),-1.9,0]))
    else:
        for i,candidate in enumerate(event['candidates']):
            y=.9-i*.61;c=GOLD if candidate['status']=='chosen' else MUTED;g.add(text(candidate['target'],21,c).move_to([.6,y,0]),text(_fmt(candidate['values']['Q'],4),23,c).move_to([2.05,y,0]))
        g.add(text('关闭探索，Q表冻结不更新',18,TEAL,width=3.45).move_to([1.85,-1.85,0]))
    return g


def robotics_principle_visual(event,run,snapshot,show_after):
    """Return a recorded before/after teaching diagram, or general-scene fallback."""
    aid=run['trace']['algorithmId'];panel=None
    if aid=='particle-filter' and int(event['id'])<3:
        fn={'particle-predict':_particle_predict,'particle-weight':_particle_weight,'particle-resample':_particle_resample}.get(event['ruleId'])
        if fn:panel=fn(event,run,show_after)
    elif aid=='rrt':panel=_rrt(event,run,show_after)
    elif aid=='potential-field':panel=_potential(event,run,show_after)
    elif aid=='pure-pursuit':panel=_pursuit(event,run,show_after)
    elif aid=='qlearning':panel=_qlearning(event,run,show_after)
    if panel is not None:panel._projection_phase='本步完成：结果已写入' if show_after else '执行前：输入与决策依据，结果尚未写入'
    return panel
