"""SHA-256 teaching geometry, projected only from the immutable execution trace.

No hash, padding, message schedule, compression round, or alternate input is
computed here. Bit extraction is number formatting; counts/positions describe
recorded values. Before views withhold the event's outputs. `focus` selects an
authored close-up of an existing event, never a second calculation.
"""
import re
from manim import Group, VGroup, Rectangle, RoundedRectangle, Line, Arrow
from visuals import text, TEAL, GOLD, INK, MUTED, RULE, PANEL
from principle_visuals import recorded_state
from film_contract import event_scene

BLUE='#90B3FF'
DIM='#1B2B3A'


def _label(value,x,y,size=20,color=INK,width=None):
    return text(str(value),size,color,width=width).move_to([x,y,0])


def _change(event,key):
    return next((c for c in event.get('changes',[]) if c['target']==key),None)


def _int(value):
    return int(value,16) if isinstance(value,str) else int(value)


def _bits(value,n=32):
    return [(_int(value)>>(n-1-i))&1 for i in range(n)]


def _cell(value,x,y,w=.45,h=.38,color=TEAL,key=None):
    c=RoundedRectangle(width=w,height=h,corner_radius=.035,
        stroke_color=color,stroke_width=1.2,fill_color=color if value==1 else DIM,fill_opacity=1).move_to([x,y,0])
    if key:c._motion_key=key
    digit=_label('—' if value is None else value,x,y,17,DIM if value==1 else INK)
    return Group(c,digit)


def _cards(words,names,heading,after=True,subtitle=None):
    g=Group(_label(heading,0,1.99,22,TEAL,width=7.3))
    for i,word in enumerate(words):
        x=-1.85 if i%2==0 else 1.85;y=1.31-(i//2)*.82
        box=RoundedRectangle(width=3.35,height=.66,corner_radius=.08,stroke_color=TEAL if after else BLUE,fill_color=PANEL,fill_opacity=1).move_to([x,y,0])
        box._motion_key='sha:word-card:'+names[i]
        g.add(box,_label(names[i],x-1.34,y,22,TEAL if after else BLUE),_label(word,x+.18,y,23,INK,width=2.55))
    if subtitle:g.add(_label(subtitle,0,-1.96,18,MUTED,width=7.3))
    return g


def _bytes(event,run,after):
    values=run['trace']['initialState']['messageBytes'];n=min(6,len(values));g=Group()
    g.add(_label(f'UTF-8 字节 · 当前输入共 {len(values)} 字节',0,1.95,22,TEAL,width=7.2))
    gap=min(.72,3.2/max(n,1))
    for i,v in enumerate(values[:n]):
        y=(n-1)*gap/2-i*gap+.1
        g.add(_label(f'字节 {i}',-2.85,y,19,MUTED),_label(f'0x{v:02x}',-1.94,y,18,BLUE,width=.88))
        for j,b in enumerate(_bits(v,8)):g.add(_cell(b,-1.23+j*.57,y,key=f'sha:byte:{i}:{j}'))
    for j in range(8):g.add(_label(7-j,-1.23+j*.57,1.56,13,MUTED))
    total=event['calculation']['result']
    g.add(_label(f'{len(values)} × 8 = {total} 位' if after else '每行 8 位；总位数尚待登记',0,-1.89,23,GOLD))
    if len(values)>n:g.add(_label(f'这里只放大前 {n} 个字节；未删除其余输入',0,-2.18,15,MUTED,width=7.2))
    return g


def _padding(event,run,after):
    original=run['trace']['initialState']['messageBytes'];padded=_change(event,'paddedBytes')['after'];n=len(original);g=Group()
    g.add(_label(f'{len(padded)//64} 块 × 64 字节；本图显示第 1 块',0,2.03,21,TEAL,width=7.3))
    for i in range(min(64,len(padded))):
        x=-2.88+(i%8)*.49;y=1.47-(i//8)*.395
        kind=TEAL if i<n else BLUE if i==n else GOLD if i>=len(padded)-8 else MUTED
        value=padded[i] if after or i<n else None
        box=Rectangle(width=.445,height=.34,stroke_color=kind,stroke_width=1.1,fill_color=kind if value not in [None,0] else PANEL,fill_opacity=1).move_to([x,y,0]);box._motion_key=f'sha:pad-byte:{i}'
        g.add(box,_label(f'{value:02x}' if value is not None else '·',x,y,15,DIM if value not in [None,0] else kind))
    for r in range(8):g.add(_label(str(r*8),-3.3,1.47-r*.395,13,MUTED))
    g.add(_label('字节编号',-1.15,-1.73,15,MUTED),_label('青：原消息',2.3,1.28,21,TEAL,width=2.55),_label('蓝：0x80 = 10000000₂',2.3,.65,18,BLUE,width=2.55),_label('灰：继续补 0',2.3,.02,21,MUTED,width=2.55),_label('橙：原长度字段',2.3,-.61,20,GOLD,width=2.55))
    bit_length=recorded_state(event,run,False).get('bitLength')
    g.add(_label(f'末 8 字节记录 {bit_length} 位' if after else '待填充：末 8 字节预留长度',2.3,-1.16,17,GOLD,width=2.65))
    g.add(_label(f'格内为十六进制；{n} + 1 + {len(padded)-n-9} + 8 = {len(padded)} 字节' if after else '格内为十六进制；空格尚未写入',0,-2.08,17,MUTED,width=7.4))
    return g


def _read(event,run,after):
    state=recorded_state(event,run,False);v=event['calculation']['values'];t=v['t'];offset=v['字节偏移'];source=state['paddedBytes'][offset:offset+4];g=Group()
    g.add(_label(f'读取 W[{t}] · 相邻四字节，高位在前',0,1.95,23,TEAL,width=7.3))
    for i,b in enumerate(source):
        x=-2.55+i*1.7
        box=RoundedRectangle(width=1.4,height=.92,corner_radius=.07,stroke_color=BLUE,fill_color=PANEL,fill_opacity=1).move_to([x,.95,0]);box._motion_key=f'sha:read-byte:{i}'
        g.add(box,_label(f'字节 {offset+i}',x,1.66,15,MUTED),_label(f'0x{b:02x}',x,.97,27,BLUE),Arrow([x,.44,0],[x,-.12,0],buff=0,color=BLUE,stroke_width=2,max_tip_length_to_length_ratio=.2))
        bits=_bits(b,8)
        for j,bit in enumerate(bits):
            cx=x-.65+j*.185
            cell=Rectangle(width=.165,height=.27,stroke_color=RULE,stroke_width=.7,fill_color=TEAL if after and bit else DIM,fill_opacity=1).move_to([cx,-.36,0]);cell._motion_key=f'sha:read-bit:{i*8+j}';g.add(cell)
    g.add(_label(event['calculation']['result'] if after else '尚未写入消息字',0,-1.06,33,GOLD),_label('4 字节 × 8 位 = 32 位；字节次序必须保留',0,-1.86,21,MUTED,width=7.4))
    return g


def _rows(rows,after=True,heading=None,note=None,legend=None):
    g=Group();dy=min(.57,3.25/max(1,len(rows)));y0=(len(rows)-1)*dy/2+.1
    if heading:g.add(_label(heading,0,2.02,21,TEAL,width=7.3))
    for i,(name,value,color,is_result) in enumerate(rows):
        y=y0-i*dy;g.add(_label(name,-2.78,y,17,color,width=1.75))
        bits=None if is_result and not after else _bits(value)
        for j in range(32):
            x=-1.77+(j+.5)*.163
            cell=Rectangle(width=.15,height=.29,stroke_color=RULE,stroke_width=.55,fill_color=color if bits and bits[j] else DIM,fill_opacity=1).move_to([x,y,0]);cell._motion_key=f'sha:bit:{name}:{j}';g.add(cell)
        if bits is None:g.add(_label('待计算',.8,y,16,MUTED))
    g.add(_label(legend or '每行 32 位 · 亮格=1，暗格=0 · 左高位，右低位',0,-1.82,17,MUTED,width=7.3))
    if note:g.add(_label(note,0,-2.12,17,GOLD,width=7.3))
    return g


def _schedule(event,run,after,focus):
    v=event['calculation']['values'];t=int(re.search(r'W\[(\d+)\]',event['action']).group(1))
    if focus=='sha-sigma1':
        state=recorded_state(event,run,False)
        return _rows([(f'W[{t-2}]',state[f'W[{t-2}]'],BLUE,False),('循环右移 17',v['ROTR17(y)'],TEAL,True),('循环右移 19',v['ROTR19(y)'],TEAL,True),('右移 10 补零',v['y>>>10'],MUTED,True),('三行异或 σ₁',v['σ1'],GOLD,True)],after,'非零长度字：绕回与补零产生不同结果',f'本步 σ₁ = {v["σ1"]}' if after else '先看原字，再核对三次移动的结果')
    return _rows([(f'W[{t-16}]',v['W[t−16]'],BLUE,False),('移位混合 σ₀',v['σ0'],TEAL,False),(f'W[{t-7}]',v['W[t−7]'],BLUE,False),('移位混合 σ₁',v['σ1'],TEAL,False),(f'加和 W[{t}]',event['calculation']['result'],GOLD,True)],after,f'扩展 W[{t}]：四个 32 位数相加','σ₁：右转17 ⊕ 右转19 ⊕ 右移10（补0）','σ₀：右转7 ⊕ 右转18 ⊕ 右移3（补0）')


def _round_rotate(event,run,after,first=True):
    v=event['calculation']['values'];regs=recorded_state(event,run,False)['registers'];name='e' if first else 'a';source=regs[4 if first else 0];shifts=[6,11,25] if first else [2,13,22];sig='Σ1(e)' if first else 'Σ0(a)'
    rows=[('旧 '+name,source,BLUE,False)]+[(f'循环右移 {n}',v[f'ROTR{n}({name})'],TEAL,True) for n in shifts]+[('三行异或',v[sig],GOLD,True)]
    if not first:rows.extend([('逐位多数 Maj',v['Maj'],TEAL,True),('加和得到 T2',event['calculation']['result'],GOLD,True)])
    return _rows(rows,after,'先移位，再逐位异或','同一列：奇数个 1 得 1；循环右移不丢弃移出的位')


def _choice(event,run,after,majority=False):
    state=recorded_state(event,run,False);regs=state['registers'];v=event['calculation']['values'];names=['a','b','c'] if majority else ['e','f','g'];words=regs[:3] if majority else regs[4:7];bits=[_bits(w) for w in words];result=v['Maj' if majority else 'Ch'];out=_bits(result);g=Group()
    g.add(_label('放大最高 8 位（第 31—24 位），其余位用同一规则',0,1.99,20,TEAL,width=7.3))
    ys=[1.2,.52,-.16];xs=[-1.55+i*.62 for i in range(8)]
    for row,name in enumerate(names):
        g.add(_label(name+(' 选择器' if not majority and row==0 else ''),-2.75,ys[row]+.10,20,BLUE,width=1.55),_label(words[row],-2.75,ys[row]-.18,13,MUTED,width=1.55))
        for i,x in enumerate(xs):
            chosen=(bits[row][i]==out[i]) if majority else (row==0 or row==(1 if bits[0][i] else 2))
            color=(GOLD if majority else TEAL if row!=2 else BLUE) if chosen and after else MUTED
            g.add(_cell(bits[row][i],x,ys[row],.47,.36,color,key=f'sha:choice:{name}:{i}'))
    for i,x in enumerate(xs):
        g.add(_label(31-i,x,1.57,13,MUTED),_cell(out[i] if after else None,x,-1.03,.47,.4,GOLD,key=f'sha:choice:out:{i}'))
        if after and not majority:
            source=1 if bits[0][i] else 2;y=ys[source]-.18;lane=x+.285
            g.add(Line([x+.235,y+.1,0],[lane,y+.1,0],color=TEAL if source==1 else BLUE,stroke_width=1.7),Line([lane,y+.1,0],[lane,-.65,0],color=TEAL if source==1 else BLUE,stroke_width=1.7),Arrow([lane,-.65,0],[x+.13,-.83,0],buff=0,color=TEAL if source==1 else BLUE,stroke_width=1.7,max_tip_length_to_length_ratio=.35))
    g.add(_label('多数 Maj' if majority else '选择 Ch',-2.75,-1.03,19,GOLD,width=1.55),_label('橙框来源：与多数结果相同的至少两票' if majority else 'e=1 沿青线取 f；e=0 沿蓝线取 g',0,-1.63,19,TEAL,width=7.3),_label(('完整 32 位结果：'+result) if after else '执行前：源位已知，结果尚未写入',0,-2.04,21,GOLD,width=7.3))
    return g


def _round_sum(event,run,after):
    v=event['calculation']['values'];g=Group();keys=['h','Σ1(e)','Ch','K','W']
    g.add(_label('五项相加；溢出的高位不保留',0,2.0,22,TEAL,width=7.3))
    for i,k in enumerate(keys):
        y=1.37-i*.51
        g.add(_label('+' if i else '',-2.9,y,23,MUTED),_label(k,-1.8,y,23,BLUE),_label(v[k],.9,y,27,INK))
    g.add(Line([-2.7,-1.04,0],[3.05,-1.04,0],color=RULE),_label('T1',-1.8,-1.43,27,GOLD),_label(event['calculation']['result'] if after else '待写入',.9,-1.43,30,GOLD),_label('加法按模 2³²：只取最终低 32 位',0,-2.04,20,MUTED,width=7.3))
    return g


def _registers(event,run,after):
    change=_change(event,'registers')
    if not change:return None
    if change['before'] is None:
        return _cards(change['after'],list('abcdefgh'),'标准初值 → 工作寄存器' if after else '已知链式状态；工作寄存器尚待装入',after,'本例是第 1 块，从标准规定的 8 个初值开始')
    g=Group(_label('同一份旧状态',-2.18,1.99,20,BLUE),_label('同步提交新状态' if after else '待同步写入',2.05,1.99,20,TEAL))
    for i,(old,new) in enumerate(zip(change['before'],change['after'])):
        y=1.5-i*.425;letter=chr(97+i)
        g.add(_label(letter+' '+old,-2.2,y,20,BLUE,width=2.95),_label(letter+' '+(new if after else '—'),2.05,y,20,GOLD if i in [0,4] else INK,width=2.95))
        if i in [1,2,3,5,6,7]:g.add(Arrow([-.64,1.5-(i-1)*.425,0],[.55,y,0],buff=.06,color=BLUE,stroke_width=1.5,max_tip_length_to_length_ratio=.1))
        else:g.add(_label('T1+T2' if i==0 else '旧d+T1',0,y,17,GOLD,width=1.3))
    g.add(_label('b 接旧 a；c 接旧 b；所有读取来自左边同一时刻',0,-2.03,18,MUTED,width=7.3))
    return g


def _chain(event,run,after):
    change=_change(event,'chain');regs=recorded_state(event,run,False)['registers'];g=Group()
    for label,x in [('入块前 H',-2.28),('最终工作字',.05),('新 H',2.37)]:g.add(_label(label,x,1.96,21,TEAL if x>1 else BLUE))
    for i,(old,work,new) in enumerate(zip(change['before'],regs,change['after'])):
        y=1.45-i*.42
        g.add(_label(str(i),-3.48,y,14,MUTED),_label(old[2:],-2.27,y,23,BLUE,width=1.95),_label('+',-1.12,y,21,MUTED),_label(work[2:],.04,y,23,INK,width=1.95),_label('=',1.19,y,21,MUTED),_label(new[2:] if after else '待计算',2.36,y,23,GOLD if after else MUTED,width=1.95))
    g.add(_label('均为十六进制；逐行相加，只保留低 32 位',0,-2.04,19,MUTED,width=7.3))
    return g


def _output(event,run,after):
    state=recorded_state(event,run,False);words=state['chain']
    return _cards([v[2:] for v in words],[f'H{i}' for i in range(8)],'按 H0 → H7 依次连接；不是相加',after,'8 × 32 = 256 位 = 64 个十六进制字符' if after else '八个字已知；完整摘要字符串尚未写入')


def _compare(event,run,after):
    snapshot=event_scene(event,run);cells=snapshot['cells'];cols=snapshot['cols'];rows=snapshot['rows'];changed=sum(str(c).lower()=='#f6c37b' for c in cells);g=Group()
    g.add(_label(f'真实不同位数：{changed} / {len(cells)}' if after else '比较两份已算完的摘要：逐位检查',0,1.99,26,GOLD,width=7.3))
    for i,c in enumerate(cells):
        x=-2.98+(i%cols)*.199;y=1.2-(i//cols)*.31
        box=Rectangle(width=.183,height=.265,fill_color=c if after else DIM,fill_opacity=1,stroke_color=RULE,stroke_width=.6).move_to([x,y,0]);box._motion_key=f'sha:comparison:{i}';g.add(box)
    for i in range(rows):g.add(_label(f'H{i}',-3.38,1.2-i*.31,14,MUTED))
    g.add(_label('每格一个真实输出位 · 每行 32 位',0,-1.55,20,MUTED,width=7.3),_label('橙：不同    青：同为 1    暗：同为 0',0,-1.92,19,TEAL,width=7.3))
    return g


def sha_pipeline_principle_visual(event,run,snapshot,show_after,focus=None):
    """Return a recorded-value diagram or None for unrelated algorithms/events."""
    if run['trace']['algorithmId']!='sha256':return None
    rule=event['ruleId'];values=event.get('calculation',{}).get('values',{})
    if rule=='sha256-bytes':return _bytes(event,run,show_after)
    if rule=='sha256-padding':return _padding(event,run,show_after)
    if rule=='sha256-schedule':
        return _read(event,run,show_after) if 't' in values else _schedule(event,run,show_after,focus)
    if rule=='sha256-registers':return _registers(event,run,show_after)
    if rule=='sha256-chain':return _chain(event,run,show_after)
    if rule=='sha256-output':
        return _compare(event,run,show_after) if event.get('phase')=='对照' else _output(event,run,show_after)
    if rule=='sha256-round':
        if focus=='sha-ch':return _choice(event,run,show_after)
        if focus=='sha-maj':return _choice(event,run,show_after,True)
        if focus=='sha-round-sum':return _round_sum(event,run,show_after)
        return _round_rotate(event,run,show_after,'ROTR6(e)' in values)
    return None
