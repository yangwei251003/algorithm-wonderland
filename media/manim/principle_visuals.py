"""Specialized displays of exported values. These adapters never run the algorithms."""
from manim import *
import re
from visuals import text,paragraph,scene_visual,TEAL,GOLD,MUTED,RULE,INK,PANEL

def recorded_state(event,run,after=True):
    state=dict(run['trace']['initialState'])
    for e in run['trace']['events'][:int(event['id'])+(1 if after else 0)]:
        for change in e['changes']:state[change['target']]=change['after']
    return state

def floyd_visual(event,run,snapshot,after=True):
    # The historical picture used -1 as a drawing sentinel. Only the recorded
    # distance table knows whether a cell is unreachable or really negative.
    state=recorded_state(event,run,after)
    names=snapshot.get('rowLabels',[str(i) for i in range(len(state['distances']))])
    intermediate=state.get('intermediate',-1)
    allowed='、'.join(names[:intermediate+1]) if intermediate>=0 else '尚无，仅直达'
    group=Group(Rectangle(width=7.6,height=4.25,stroke_width=0,fill_opacity=0))
    group.add(text('允许中转：'+allowed,20,TEAL,width=7.5).move_to([0,1.96,0]))
    matrix=scene_visual({**snapshot,'matrix':state['distances']},7.6,3.1).move_to([0,.12,0])
    group.add(matrix)
    active=snapshot.get('active',[]);values=event.get('calculation',{}).get('values',{})
    n=len(state['distances'])
    if len(active)==3 and all(k in values for k in ['old','left','right']):
        def cell(index):return names[index//n]+'→'+names[index%n]
        target,left,right=active
        # These are the two operands saved in the trace, not freshly solved paths.
        line=cell(left)+' '+str(values['left'])+'  +  '+cell(right)+' '+str(values['right'])+'    与旧 '+cell(target)+' '+str(values['old'])+' 比较'
        group.add(text(line,19,INK,width=7.5).move_to([0,-1.67,0]))
    elif event.get('phase')=='stop':
        group.add(text('全站结果 · 每行是起点，每列是终点',19,INK,width=7.5).move_to([0,-1.67,0]))
    else:
        group.add(text('每行是起点，每列是终点 · 本轮检查全部地点对',19,INK,width=7.5).move_to([0,-1.67,0]))
    group.add(text('∞：尚无已知路线，不是负票价 · 橙框：目标与两段报价',16,MUTED,width=7.5).move_to([0,-2.06,0]))
    return group

def counting_visual(event,run,after=True):
    state=recorded_state(event,run,after);original=run['trace']['initialState']['array']
    if event['phase']=='initialize':return scene_visual({'kind':'bars','values':original,'labels':['#'+str(i) for i in range(len(original))]},7.6,3.5)
    minimum=min(original);counts=state.get('counts',[0]*(max(original)-minimum+1))
    active=int(event.get('calculation',{}).get('values',{}).get('value',minimum))-minimum if event['phase']=='count' else int(state.get('box',-1))
    bars=scene_visual({'kind':'bars','values':counts,'labels':['值'+str(i+minimum) for i in range(len(counts))],'active':[active]},7.6,2.8)
    written=state.get('moves',0)
    return Group(bars,text('原输入：'+', '.join(map(str,original)),19,MUTED,width=7.6).move_to([0,1.85,0]),text('已写回：'+(', '.join(map(str,state['array'][:written])) if written else '尚未开始'),20,GOLD,width=7.6).move_to([0,-1.95,0]),text('柱高是记录的频数 · 0表示空盒 · 写回不改变原频数',16,MUTED,width=7.6).move_to([0,-2.3,0]))

def quicksort_visual(event,run,snapshot,after=True):
    current=recorded_state(event,run,after);boundary=None;pivot=None
    for e in run['trace']['events'][:int(event['id'])+1]:
        if e.get('calculation',{}).get('formula')=='pivot=array[high]':
            boundary=e['calculation']['values']['low'];pivot=e['calculation']['values']['high']
        if e['action']=='推进小值边界':boundary=next(c['after'] for c in e['changes'] if c['target']=='boundary')
        if e['action']=='分区完成':pivot=int(e['focus'][0]);boundary=None
    checking=int(event['focus'][0]) if event['phase']=='compare' and event.get('focus') else None
    labels=['#'+str(i)+(' 待放' if i==boundary else '')+(' 检查' if i==checking else '')+(' 分界' if i==pivot else '') for i in range(len(current['array']))]
    bars=scene_visual({**snapshot,'values':current['array'],'labels':labels,'active':[int(i) for i in event.get('focus',[])]},7.6,3.7)
    return Group(bars,text('待放：下一个小值位置 · 检查：正在比较 · 分界：当前pivot',16,MUTED,width=7.6).move_to([0,-2.25,0]))

def knn_visual(event,run,mode,candidates):
    state=recorded_state(event,run);train=state['train'];test=state['test'];q=int(state.get('query',0));query=test[q]
    nodes=[{'id':str(i),'x':p[0],'y':p[1],'label':'#'+str(i),'color':GOLD if p[2] else TEAL,'r':1.5} for i,p in enumerate(train)]
    nodes.append({'id':'query','x':query[0],'y':query[1],'label':'查询'+str(q),'color':INK,'r':2.3})
    targets=[state['neighbor']] if event['phase']=='distance' else state.get('neighbors',[]) if event['phase'] in {'choose','vote'} else []
    color=TEAL
    if mode.startswith('comparison:') and candidates:
        candidate=candidates[int(mode.split(':')[-1])];targets=[int(candidate['target'])];color='#fb8f98' if candidate['status']=='rejected' else TEAL
    paths=[{'points':[{'x':query[0],'y':query[1]},{'x':train[i][0],'y':train[i][1]}],'color':color} for i in targets]
    plot=scene_visual({'kind':'scatter','yUp':True,'nodes':nodes,'paths':paths},7.6,3.8,targets)
    return Group(plot,text('# 为训练点编号 · 连线是本步比较；类别色不参与距离',17,MUTED,width=7.6).move_to([0,-2.35,0]))

def regression_visual(event,run,snapshot,after):
    state=recorded_state(event,run,after);data=state['data'];n=state.get('sampleCount',len(data))
    nodes=[{'id':str(i),'x':p[0],'y':p[1],'color':TEAL if i<n else '#354957','r':1.5} for i,p in enumerate(data)]
    if 'meanX' in state:nodes.append({'id':'mean','x':state['meanX'],'y':state['meanY'],'color':'#90b3ff','r':2.2,'label':'均值中心'})
    return scene_visual({**snapshot,'nodes':nodes},7.6,4.05)

def search_visual(event,run,after=True):
    state=dict(run['trace']['initialState'])
    for e in run['trace']['events'][:int(event['id'])+(1 if after else 0)]:
        for c in e['changes']:state[c['target']]=c['after']
    binary=run['trace']['algorithmId']=='binary-search';values=state['array'];found=state.get('found',-1)
    active=state.get('mid' if binary else 'index',-1);low=state['low'] if binary else max(0,active);high=state['high']
    if event.get('focus') and event['phase']=='compare':
        active=int(event['focus'][0])
        if not binary:low=max(0,active)
    if event['phase']=='result' and found<0:low=len(values)
    colors=[GOLD if i==found else '#354957' if i<low or i>high else TEAL if i==active else '#90B3FF' for i in range(len(values))]
    bars=scene_visual({'kind':'bars','values':values,'colors':colors,'labels':['#'+str(i) for i in range(len(values))]},7.6,3.6)
    return Group(bars,text(f'寻找 {state["target"]} · 蓝色待查 / 青色当前 / 灰色已排除',19,MUTED,width=7.6).move_to([0,-2.15,0]))

def bit_rows(rows,width=7.6,height=4.1,note=None):
    group=VGroup();left=-width/2;bits_left=left+1.55;unit=(width-1.65)/32
    dy=min(.48 if note else .56,height/max(1,len(rows)))
    for row,(label,value,color) in enumerate(rows):
        y=(len(rows)-1)/2*dy-row*dy
        group.add(text(label,18,color,width=1.48).move_to([left+.72,y,0]))
        value=int(value,16)
        for bit in range(32):
            one=(value>>(31-bit))&1
            cell=Rectangle(width=unit*.91,height=.25,fill_color=color if one else '#1B2B3A',fill_opacity=1,stroke_color=RULE,stroke_width=.6).move_to([bits_left+(bit+.5)*unit,y,0])
            cell._motion_key=f'bit:{label}:{bit}'
            group.add(cell)
    group.add(text('每行32位 · 亮格=1，暗格=0 · 左高位、右低位',17,MUTED,width=width).move_to([0,-len(rows)*dy/2-.25,0]))
    if note:group.add(text(note,18,GOLD,width=width).move_to([0,-len(rows)*dy/2-.62,0]))
    return group

def sha_visual(event,snapshot,run=None,mode='rule'):
    values=event.get('calculation',{}).get('values',{})
    tokens={t['text'].split(' = ')[0]:t['text'].split(' = ')[1] for t in snapshot.get('tokens',[]) if ' = ' in t['text']}
    if 'ROTR6(e)' in values:
        rows=[('旧e',tokens['e'],MUTED),('右转6',values['ROTR6(e)'],TEAL),('右转11',values['ROTR11(e)'],TEAL),('右转25',values['ROTR25(e)'],TEAL),('三行异或',values['Σ1(e)'],GOLD),('逐位选择Ch',values['Ch'],GOLD),('T1加和结果',event['calculation']['result'],GOLD)]
        return bit_rows(rows,note='Ch：e=1取f，e=0取g；异或：奇数个1得1')
    if 'ROTR2(a)' in values:
        return bit_rows([('旧a',tokens['a'],MUTED),('右转2',values['ROTR2(a)'],TEAL),('右转13',values['ROTR13(a)'],TEAL),('右转22',values['ROTR22(a)'],TEAL),('三行异或',values['Σ0(a)'],GOLD),('逐位多数Maj',values['Maj'],GOLD),('T2加和结果',event['calculation']['result'],GOLD)],note='Maj：每位至少两个1得1；异或：奇数个1得1')
    if 'W[t−16]' in values:
        if mode.startswith('calculation') and run:
            t=int(re.search(r'W\[(\d+)\]',event['action']).group(1))
            state=dict(run['trace']['initialState'])
            for e in run['trace']['events'][:int(event['id'])]:
                for c in e['changes']:state[c['target']]=c['after']
            part=int(mode.split(':')[-1]) if ':' in mode else 0
            if part<2:
                return bit_rows([('x=W[t−15]',state[f'W[{t-15}]'],MUTED),('循环右转7',values['ROTR7(x)'],TEAL),('循环右转18',values['ROTR18(x)'],TEAL),('右移3补零',values['x>>>3'],TEAL),('三行异或σ₀',values['σ0'],GOLD)],note='逐位异或：奇数个1得1；循环移动与补零不同')
            return bit_rows([('y=W[t−2]',state[f'W[{t-2}]'],MUTED),('循环右转17',values['ROTR17(y)'],TEAL),('循环右转19',values['ROTR19(y)'],TEAL),('右移10补零',values['y>>>10'],TEAL),('三行异或σ₁',values['σ1'],GOLD)],note='σ₀、σ₁是固定配方；再与两个旧字相加')
        return bit_rows([('W[t−16]',values['W[t−16]'],TEAL),('σ₀',values['σ0'],TEAL),('W[t−7]',values['W[t−7]'],TEAL),('σ₁',values['σ1'],TEAL),('四行加和',event['calculation']['result'],GOLD)])
    if event['ruleId']=='sha256-registers':
        change=next((c for c in event['changes'] if c['target']=='registers'),None)
        if change and isinstance(change['before'],list):
            group=VGroup();before,after=change['before'],change['after']
            group.add(text('同一份旧状态',20,MUTED).move_to([-2.3,2,0]),text('同时提交新状态',20,TEAL).move_to([2.1,2,0]))
            for i,(old,new) in enumerate(zip(before,after)):
                y=1.52-i*.43;letter=chr(97+i)
                group.add(text(letter+'  '+old,21,MUTED).move_to([-2.25,y,0]),text(letter+'  '+new,21,TEAL if i in [0,4] else INK).move_to([2.15,y,0]))
                if i in [1,2,3,5,6,7]:group.add(Arrow([-1,1.52-(i-1)*.43,0],[.84,y,0],buff=.1,color='#90B3FF',stroke_width=1.3,max_tip_length_to_length_ratio=.06))
                elif i==0:group.add(text('T1 + T2',18,GOLD).move_to([0,y+.08,0]))
                else:group.add(text('旧d + T1',18,GOLD).move_to([0,y+.08,0]))
            group.add(text('加法只保留低32位；禁止把刚写的新a当成旧a',17,MUTED,width=7.6).move_to([0,-2.05,0]))
            return group
    return None

def pid_visual(event,run,snapshot,after=True):
    index=int(event['id'])-(0 if after else 1);actual=[{'x':0,'y':run['trace']['initialState']['height']}]
    for e in run['trace']['events'][:index+1]:
        if e['ruleId']=='pid-motion':
            updates={c['target']:c['after'] for c in e['changes']}
            actual.append({'x':updates['time'],'y':updates.get('height',actual[-1]['y'])})
    target=run['frames'][0]['secondaryScene']['series'][1]['points'][0]['y']
    final=run['frames'][-1]['secondaryScene']
    yy=[p['y'] for s in final['series'] for p in s['points']]
    curve={'kind':'lines','xDomain':[0,25.6],'yDomain':[min(0,min(yy)),max(100,max(yy))],'series':[{'name':'实际高度','color':TEAL,'points':actual},{'name':'目标高度','color':GOLD,'points':[{'x':0,'y':target},{'x':25.6,'y':target}]}]}
    # Put the two moving labels outside the flight lane: near the target they
    # otherwise overlap precisely when the controller succeeds.
    drawing={**snapshot,'nodes':[n for n in snapshot.get('nodes',[]) if not str(n.get('label','')).startswith(('目标','高度'))]}
    drone=scene_visual(drawing,3.3,3.5).move_to([-2,0,0]);chart=scene_visual(curve,3.55,3.4).move_to([1.95,0,0])
    return Group(drone,chart,text(f'目标高度 {target:g}',20,GOLD).move_to([-2,1.9,0]),text(f'当前高度 {actual[-1]["y"]:.2f}',20,TEAL).move_to([-2,-1.7,0]),text('高度随时间变化 / 秒',17,MUTED).move_to([1.95,-2,0]))

def moving_average_visual(event,run,after=True):
    if event['phase'] not in ['initialize','sum','forecast']:return None
    state=dict(run['trace']['initialState'])
    for e in run['trace']['events'][:int(event['id'])+(1 if after else 0)]:
        for c in e['changes']:state[c['target']]=c['after']
    data=state['data'];window=state['window'];day=state.get('day',window+1);start=state.get('windowStart',1)
    current=event.get('calculation',{}).get('values',{}).get('day') if event['phase']=='sum' else None
    cards=VGroup()
    for i,value in enumerate(data[start-1:day-1]):
        n=start+i;color=TEAL if n==current else '#90B3FF'
        box=RoundedRectangle(width=min(1.2,6.8/window),height=1.05,corner_radius=.1,stroke_color=color,fill_color=PANEL,fill_opacity=1)
        cards.add(VGroup(box,text(value,30,color).move_to(box.get_center()+UP*.15),text(f'第{n}天',17,MUTED).move_to(box.get_center()+DOWN*.28)))
    cards.arrange(RIGHT,buff=.2).move_to([0,.7,0])
    group=Group(text(f'预测第{day}天 · 只读第{start}—{day-1}天',25,TEAL).move_to([0,1.75,0]),cards)
    total=state.get('partialSum',0)
    group.add(text(f'已登记的部分和 = {total}',30,GOLD).move_to([0,-.45,0]))
    if event['phase']=='forecast':group.add(text(f'除以 {window}，得到 {event["calculation"]["result"]}',30,GOLD).move_to([0,-1.15,0]))
    else:group.add(text('每个已观察值都贡献一次；未来值不参与',21,MUTED,width=7.6).move_to([0,-1.15,0]))
    return group
