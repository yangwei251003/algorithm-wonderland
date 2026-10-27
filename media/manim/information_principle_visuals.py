"""Recorded-state diagrams for information algorithms; no algorithm is re-run.

Current operands may be named before execution. Counts, decisions and outputs
are shown only after the corresponding recorded event, never from a later one.
"""
import re
from manim import *
from visuals import text, display, TEAL, GOLD, MUTED, RULE, INK
from principle_visuals import recorded_state

RED='#F28E91'
BLUE='#90B3FF'

def _label(value,x,y,size=19,color=INK,width=7.35,key=None):
    m=text(str(value),size,color,width=width).move_to([x,y,0])
    if key:m._motion_key='information-label:'+key
    return m

def _box(x,y,w,h,color,key):
    m=RoundedRectangle(width=w,height=h,corner_radius=.07,stroke_color=color,stroke_width=1.5,fill_color=color,fill_opacity=.08).move_to([x,y,0])
    m._motion_key='information-box:'+key
    return m

def apriori_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after)
    events=run['trace']['events'];pos=next(i for i,e in enumerate(events) if e['id']==event['id'])
    prefix=events[:pos+(1 if show_after else 0)]
    ctx={'state':state,'baskets':run['trace']['initialState']['baskets'],'prefix':prefix,'phase':event['phase']}
    if event['phase'] in ['count','support']:
        if event['phase']=='count':
            m=re.fullmatch(r'核对(.+)是否出现在篮(\d+)',event['action'])
            if not m:raise ValueError('Apriori count operands missing')
            candidate=m.group(1);current=int(m.group(2))
        else:
            candidate='+'.join(state['candidate']);current=None
        checks={}
        for e in prefix:
            if e['phase']!='count':continue
            m=re.fullmatch(r'核对(.+)是否出现在篮(\d+)',e['action'])
            if m and m.group(1)==candidate:checks[int(m.group(2))]=e['candidates'][0]['status']=='chosen'
        count=sum(checks.values())
        if show_after and event['phase']=='count' and state.get('count')!=count:raise ValueError('Apriori accumulated count disagrees with trace')
        ctx.update(candidate=candidate,current=current,checks=checks,count=count)
    elif event['phase'] in ['join','subset','candidate']:
        join=next((e for e in reversed(events[:pos+1]) if e['phase']=='join'),None)
        if not join:raise ValueError('Apriori join missing')
        m=re.search(r'([^，]+?)与([^，]+?)合成([^，]+)，',join['explanation'])
        if not m:raise ValueError('Apriori join operands missing')
        checks=[]
        for e in prefix:
            if int(e['id'])>int(join['id']) and e['phase']=='subset':checks.append(e['candidates'][0])
        ctx.update(left=m.group(1),right=m.group(2),candidate=m.group(3),checks=checks)
    elif event['phase']=='rule':
        m=re.fullmatch(r'检验(.+)→(.+)',event['action']);a,b=m.groups()
        pool=[i+1 for i,basket in enumerate(ctx['baskets']) if all(v in basket for v in a.split('+'))]
        joint=[i for i in pool if b in ctx['baskets'][i-1]]
        values=event['calculation']['values']
        assert len(pool)==values['antecedent'] and len(joint)==values['joint']
        ctx.update(antecedent=a,consequent=b,pool=pool,joint=joint)
    return ctx

def _apriori(event,run,show_after):
    c=apriori_context(event,run,show_after);s=c['state'];phase=c['phase'];out=VGroup()
    if phase in ['initialize','count','support']:
        cand=c.get('candidate');out.add(_label('五篮输入：一篮中的重复件数不重复计数' if cand is None else f'当前候选：{cand}',0,1.91,23,GOLD))
        for i,basket in enumerate(c['baskets'],1):
            y=1.28-(i-1)*.53;status=c.get('checks',{}).get(i);active=i==c.get('current')
            col=GOLD if active else TEAL if status else RED if status is False else RULE
            out.add(_box(0,y,7.1,.43,col,'basket'+str(i)),_label(f'篮{i}   '+'、'.join(basket),-1.0,y,20,INK,4.8))
            mark='待核对' if status is None else '包含：计1' if status else '缺少：计0'
            if cand is None:mark='一个集合'
            out.add(_label(mark,2.48,y,17,col if col!=RULE else MUTED,1.8))
        if cand is None:
            out.add(_label('5 × 40% = 2：至少两篮才频繁',0,-1.51,23,TEAL),_label('先查单品，再连接通过门槛的小组合',0,-1.98,18,MUTED))
        else:
            out.add(_label(f'本候选已核对 {len(c["checks"])} 篮；累计 {c["count"]} 篮',0,-1.5,23,TEAL))
            if phase=='support':
                count=event['calculation']['values']['count'];minimum=event['calculation']['values']['minCount'];ok=count>=minimum
                msg=f'{count} '+('≥' if ok else '<')+f' {minimum}：'+('保留' if ok else '淘汰') if show_after else f'待比较：{count} 篮与门槛 {minimum} 篮'
                out.add(_label(msg,0,-1.97,22,(TEAL if ok else RED) if show_after else INK))
            else:out.add(_label('必须包含候选的全部商品，才能让本候选加一',0,-1.97,18,MUTED))
        return out
    if phase in ['join','subset','candidate']:
        out.add(_label('连接已频繁的小组合，再检查所有少一件的子集',0,1.9,21,GOLD))
        for x,key in [(-2.0,'left'),(2.0,'right')]:
            out.add(_box(x,1.2,3.25,.55,TEAL,key),_label(c[key],x,1.2,22,TEAL,3.0),Arrow([x,.87,0],[x*.32,.32,0],color=TEAL,buff=.02,stroke_width=2))
        out.add(_box(0,.02,5.5,.57,GOLD,'union'),_label(c['candidate'],0,.02,23,GOLD,5.2))
        checks={x['target']:x for x in c['checks']}
        current=event.get('candidates',[{}])[0].get('target') if phase=='subset' else None
        pieces=c['candidate'].split('+');subsets=['+'.join(pieces[:i]+pieces[i+1:]) for i in range(len(pieces))]
        for i,sub in enumerate(subsets):
            x=(i-(len(subsets)-1)/2)*2.4;known=checks.get(sub);col=GOLD if sub==current else TEAL if known and known['status']=='chosen' else RULE
            out.add(_box(x,-.94,2.23,.75,col,'subset'+sub),_label(sub,x,-.8,18,INK,2.06),_label('已频繁' if known and known['status']=='chosen' else '待检查',x,-1.1,16,TEAL if known else MUTED,2.06))
        out.add(_label('全部子集通过 ≠ 整体已经频繁',0,-1.6,24,GOLD))
        note='候选已存入下一层；仍须逐篮统计' if phase=='candidate' and show_after else '先检查必要条件；重复候选只存一份'
        out.add(_label(note,0,-2.0,18,MUTED));return out
    if phase=='rule':
        out.add(_label(f'方向：{c["antecedent"]} → {c["consequent"]}',0,1.91,25,GOLD))
        for i,basket in enumerate(c['baskets'],1):
            y=1.28-(i-1)*.51;inside=i in c['pool'];joint=i in c['joint'];col=TEAL if joint else GOLD if inside else RULE
            out.add(_box(0,y,7.1,.42,col,'basket'+str(i)),_label(f'篮{i}  '+'、'.join(basket),-1.08,y,19,INK if inside else MUTED,4.75),_label('分母中，也有后件' if joint else '分母中，缺少后件' if inside else '不在条件人群',2.24,y,16,col if inside else MUTED,2.4))
        a=len(c['pool']);j=len(c['joint']);out.add(_label(f'条件人群 {a} 篮；其中同时出现 {j} 篮',0,-1.42,22,INK))
        v=event['calculation'];result=v['result'];threshold=v['values']['threshold'];ok=result>=threshold
        message=f'{j} ÷ {a} ≈ {display(result)} '+('≥' if ok else '<')+f' {display(threshold)}：'+('保留' if ok else '拒绝') if show_after else f'待计算：{j} ÷ {a}，再与 {display(threshold)} 比较'
        out.add(_label(message,0,-1.97,23,(TEAL if ok else RED) if show_after else GOLD));return out
    if phase=='stop':
        rows=s.get('rules')
        if rows is None:
            rows=[]
            for e in c['prefix']:
                if e['phase']=='rule' and e['candidates'][0]['status']=='chosen':
                    m=re.fullmatch(r'检验(.+)→(.+)',e['action']);rows.append({'from':m.group(1),'to':m.group(2),'confidence':e['calculation']['result']})
        out.add(_label('已核对并保留的方向规则',0,1.89,24,GOLD))
        for i,r in enumerate(rows):
            x=(-1.9 if i%2==0 else 1.9);y=.77-(i//2)*1.25
            direction=r.get('label') or r.get('rule') or ((r.get('from') or r.get('antecedent',''))+' → '+(r.get('to') or r.get('consequent','')))
            out.add(_box(x,y,3.55,1.0,TEAL,'rule'+str(i)),_label(direction,x,y+.19,22,INK,3.3),_label('置信度 '+display(r['confidence']),x,y-.23,18,TEAL,3.3))
        out.add(_label('只有五篮：关联帮助探索，不证明因果',0,-1.72,23,GOLD),_label('方向改变，条件人群与分母也会改变',0,-2.03,17,MUTED));return out
    return None

def bm25_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after);events=run['trace']['events'];pos=next(i for i,e in enumerate(events) if e['id']==event['id'])
    docs=run['frames'][0]['scene']['tokens']
    if len(docs)!=len(state['scores']):raise ValueError('BM25 corpus size mismatch')
    prefix=events[:pos+(1 if show_after else 0)];phase=event['phase'];current=None;term=state.get('term');checks={};parts=[[0.0]*len(state['terms']) for _ in docs]
    if phase=='document-frequency':
        m=re.fullmatch(r'检查「(.+)」是否出现在文档(\d+)',event['action']);term=m.group(1);current=int(m.group(2))-1
    active=None
    for e in prefix:
        if e['phase']=='document-frequency':
            m=re.fullmatch(r'检查「(.+)」是否出现在文档(\d+)',e['action']);active=m.group(1);idx=int(m.group(2))-1
            if active==term:checks[idx]=active in docs[idx]['sub'].split()
        elif e['phase']=='score':
            title=re.fullmatch(r'给「(.+)」计入该词贡献',e['action']).group(1);idx=next(i for i,d in enumerate(docs) if d['text']==title)
            parts[idx][state['terms'].index(active)]+=e['calculation']['result']
    assert all(abs(sum(v)-score)<1e-10 for v,score in zip(parts,state['scores']))
    if phase=='score':
        title=re.fullmatch(r'给「(.+)」计入该词贡献',event['action']).group(1);current=next(i for i,d in enumerate(docs) if d['text']==title)
        words=docs[current]['sub'].split();values=event['calculation']['values']
        assert len(words)==values['length'] and words.count(term)==values['tf']
    return dict(state=state,docs=docs,parts=parts,term=term,current=current,checks=checks,phase=phase)

def _bm25(event,run,show_after):
    c=bm25_context(event,run,show_after);s=c['state'];out=VGroup();phase=c['phase'];term=c['term'];colors=[TEAL,GOLD,BLUE]
    if phase in ['initialize','document-frequency','idf']:
        out.add(_label('查询：'+' · '.join(s['terms']) if phase=='initialize' else f'当前词「{term}」：每篇最多贡献一个出现记录',0,1.94,21,GOLD))
        for i,d in enumerate(c['docs']):
            y=1.38-i*.45;status=c['checks'].get(i);col=GOLD if i==c['current'] else TEAL if status else RED if status is False else RULE
            out.add(_box(0,y,7.2,.37,col,'doc'+str(i)),_label(f'{i+1}  {d["text"]}',-1.05,y,18,INK,4.95))
            msg=f'{len(d["sub"].split())} 词' if phase=='initialize' else '待检查' if status is None else '有：计1篇' if status else '没有：计0篇'
            out.add(_label(msg,2.58,y,17,col if col!=RULE else MUTED,1.7))
        if phase=='initialize':out.add(_label(f'平均长度 {display(s["averageLength"])} 词；k₁={display(s["k1"])}，b={display(s["b"])}',0,-1.49,22,TEAL),_label('长度按这里给定的分词结果计，不是汉字数',0,-1.98,19,MUTED))
        else:
            df=sum(c['checks'].values());out.add(_label(f'已核对 {len(c["checks"])} / {len(c["docs"])} 篇；出现 {df} 篇',0,-1.48,23,TEAL))
            note='每篇重复多次，也只记一次“出现”'
            if phase=='idf':note=f'IDF ≈ {display(event["calculation"]["result"])}：篇数越普遍，区分权重通常越小' if show_after else '篇数核对完毕，接着代入这版 IDF 公式'
            out.add(_label(note,0,-1.99,19,MUTED))
        return out
    if phase=='score':
        idx=c['current'];d=c['docs'][idx];v=event['calculation']['values'];actual=v['tf'];out.add(_label(f'{idx+1}  {d["text"]} · 当前词「{term}」',0,1.94,22,GOLD))
        words=d['sub'].split();count=len(words)
        for i,word in enumerate(words):
            col=GOLD if word==term else RULE;x=(i-(count-1)/2)*min(.79,6.9/count)
            out.add(_box(x,1.34,min(.72,6.5/count),.45,col,'word'+str(i)),_label(word,x,1.34,17,col if word==term else INK,min(.67,6.2/count)))
        out.add(_label(f'词频 {actual} 次；本文 {len(words)} 词；平均 {display(v["averageLength"])} 词',0,.86,20,INK))
        # Analytic projection of this exact formula, explicitly hypothetical tf;
        # it is not another document and does not update exported scores.
        x0=-3.05;x1=3.03;y0=-1.05;y1=.26;upper=v['idf']*(v['k1']+1)
        px=lambda t:x0+(x1-x0)*t/len(words)
        score=lambda t:0.0 if t==0 else v['idf']*t*(v['k1']+1)/(t+v['normalizer'])
        py=lambda z:y0+(y1-y0)*z/upper if upper>0 else y0
        out.add(Line([x0,y0,0],[x1+.12,y0,0],color=RULE),Line([x0,y0,0],[x0,y1+.12,0],color=RULE))
        curve=VMobject(color=TEAL,stroke_width=3).set_points_as_corners([[px(i*len(words)/50),py(score(i*len(words)/50)),0] for i in range(51)]);out.add(curve)
        for t in sorted(set([0,actual,len(words)])):out.add(_label(str(t),px(t),y0-.19,15,MUTED,.5))
        out.add(_label('词贡献 ↑',-3.05,.48,15,MUTED,1.2),_label('固定长度与参数，只改变想定词频',.49,.44,17,MUTED,5.8),_label('想定词频 →',2.55,y0-.42,15,MUTED,1.55))
        if show_after:
            point=Dot([px(actual),py(event['calculation']['result']),0],radius=.055,color=GOLD);point._motion_key='bm25-actual-score';out.add(point)
            out.add(_label(f'真实本篇：贡献 +{display(event["calculation"]["result"])}；累计 {display(s["scores"][idx])}',0,-1.69,22,GOLD))
        else:out.add(_label(f'待计算本词贡献；本篇已有总分 {display(s["scores"][idx])}',0,-1.69,21,GOLD))
        out.add(_label('同词越重复，新增收益越小；词频零则本项为零',0,-2.04,17,MUTED));return out
    if phase=='stop':
        out.add(_label('每篇总分 = 三个查询词的真实贡献相加',0,1.92,23,GOLD))
        maximum=max(s['scores']) or 1
        for i,d in enumerate(c['docs']):
            y=1.32-i*.46;chosen=s.get('best')==i
            out.add(_label(f'{i+1} {d["text"]}',-2.37,y,17,GOLD if chosen else INK,2.55))
            start=-.93
            for j,val in enumerate(c['parts'][i]):
                w=val/maximum*3.61
                if w>0:
                    bar=Rectangle(width=w,height=.24,stroke_width=0,fill_color=colors[j%3],fill_opacity=.85).move_to([start+w/2,y,0]);bar._motion_key=f'bm25-score:{i}:{j}';out.add(bar);start+=w
            out.add(_label(display(s['scores'][i]),3.13,y,17,GOLD if chosen else INK,.95))
        for j,t in enumerate(s['terms']):out.add(_label(t,(j-1)*2.1,-1.65,19,colors[j%3],1.9))
        out.add(_label('最高分排在前面；不是相关概率，也不验证内容真假',0,-2.03,18,MUTED));return out
    return None

def edit_context(event,run,show_after=True):
    s=recorded_state(event,run,show_after);events=run['trace']['events'];pos=next(i for i,e in enumerate(events) if e['id']==event['id'])
    prefix=events[:pos+(1 if show_after else 0)];computed=set();current=None
    def cell(e):
        if e['phase']=='boundary':
            a=re.fullmatch(r'源前缀(\d+)变空串',e['action'])
            return (int(a.group(1)),0) if a else (0,int(re.fullmatch(r'空串变目标前缀(\d+)',e['action']).group(1)))
        if e['phase']=='cell':return tuple(map(int,re.fullmatch(r'计算D\[(\d+),(\d+)\]',e['action']).groups()))
    for e in prefix:
        if e['phase'] in ['boundary','cell']:computed.add(cell(e))
    if event['phase'] in ['boundary','cell']:current=cell(event)
    if event['phase']=='backtrack':
        m=re.search(r'D\[(\d+),(\d+)\].*回到\[(\d+),(\d+)\]',event['explanation'])
        if not m:raise ValueError('Edit backtrack endpoints missing')
        old=tuple(map(int,m.groups()[:2]));new=tuple(map(int,m.groups()[2:]));current=new if show_after else old
    else:old=new=None
    if event['phase']=='cell':
        i,j=current;v=event['calculation']['values'];table=s['table']
        assert table[i-1][j-1]+v['matchCost']==v['diagonal']
        assert table[i-1][j]+1==v['deletion'] and table[i][j-1]+1==v['insertion']
        if show_after:assert table[i][j]==event['calculation']['result']
    return dict(state=s,computed=computed,current=current,old=old,new=new,prefix=prefix)

def _edit(event,run,show_after):
    c=edit_context(event,run,show_after);s=c['state'];phase=event['phase'];out=VGroup();source=''.join(s['from']);target=''.join(s['to'])
    out.add(_label(f'把 {source} 变成 {target}：比较前缀的最低编辑代价',0,1.95,21,GOLD))
    if phase=='stop':
        forward=s.get('operations');ops=forward if forward is not None else s.get('reverseOperations',[])
        out.add(_label('正向执行顺序' if forward is not None else '倒查记录：下一步反转顺序',0,1.25,25,TEAL))
        for i,op in enumerate(ops):
            x=(i-(len(ops)-1)/2)*2.38;col=TEAL if op.startswith('保留') else GOLD
            out.add(_box(x,.2,2.15,1.15,col,'op'+str(i)),_label(op,x,.4,25,col,1.95),_label('代价 0' if op.startswith('保留') else f'代价 {s["substitution"]}',x,-.05,19,MUTED,1.95))
        out.add(_label('最少代价：'+display(s['distance']) if 'distance' in s else '尚未写入最终操作列表',0,-1.02,26,GOLD),_label('保留不是额外编辑；这里仅替换中间一次',0,-1.58,22,INK),_label('具体方案由实际前驱回溯；可能有同价方案',0,-2.02,17,MUTED));return out
    table=s['table'];rows=len(table);cols=len(table[0]);stepx=min(.96,3.8/cols);stepy=min(.6,2.45/rows)
    xy=lambda i,j:np.array([-2.98+j*stepx,1.05-i*stepy,0.])
    rlabels=['∅']+[''.join(s['from'][:i]) for i in range(1,rows)];clabels=['∅']+[''.join(s['to'][:j]) for j in range(1,cols)]
    neighbors={};formulas=[]
    if phase=='cell':
        i,j=c['current'];v=event['calculation']['values']
        formulas=[('对齐',(i-1,j-1),v['matchCost'],'diagonal',TEAL),('删除',(i-1,j),1,'deletion',RED),('插入',(i,j-1),1,'insertion',BLUE)]
        neighbors={coord:color for _,coord,_,_,color in formulas}
    for i,label in enumerate(rlabels):out.add(_label(label,-3.62,xy(i,0)[1],18,GOLD if c['current'] and i==c['current'][0] else MUTED,.65))
    for j,label in enumerate(clabels):out.add(_label(label,xy(0,j)[0],1.56,18,GOLD if c['current'] and j==c['current'][1] else MUTED,.85))
    for i in range(rows):
        for j in range(cols):
            p=xy(i,j);col=GOLD if (i,j)==c['current'] else neighbors.get((i,j),RULE);val=table[i][j] if (i,j) in c['computed'] else '·'
            out.add(_box(p[0],p[1],stepx-.07,stepy-.07,col,f'cell{i},{j}'),_label(val,p[0],p[1],24,INK if val!='·' else MUTED,stepx-.15))
    if phase=='cell':
        i,j=c['current'];out.add(_label(f'当前：{rlabels[i]} → {clabels[j]}',-1.55,-1.62,22,GOLD,4.2))
        for k,(name,(a,b),cost,key,col) in enumerate(formulas):
            y=1.12-k*.9;candidate=next(x for x in event['candidates'] if x['target']==name);selected=candidate['status']=='chosen'
            out.add(_box(2.15,y,2.82,.74,col,'candidate'+name),_label(f'{name} · 来源({a},{b})',2.15,y+.17,17,col,2.6),_label(f'{table[a][b]} + {cost} = {v[key]}'+(' ✓' if show_after and selected else ''),2.15,y-.16,23,INK,2.6))
        chosen=next(x for x in event['candidates'] if x['status']=='chosen')
        out.add(_label(f'选择{chosen["target"]}，写入 {event["calculation"]["result"]}' if show_after else '比较三个完整成本，再取最小',2.12,-1.63,18,GOLD,2.92))
    elif phase=='backtrack':
        p=xy(*c['old']);q=xy(*c['new']);out.add(Arrow(p,q,buff=.22,color=GOLD,stroke_width=3,tip_length=.09))
        out.add(_label('本步回溯动作',2.12,1.25,22,GOLD,2.8),_label(event['action'],2.12,.80,29,INK,2.8),_label(f'{c["old"]} → {c["new"]}',2.12,.32,20,TEAL,2.8))
        ops=s.get('reverseOperations',[]);out.add(_label('已记录的倒序动作',2.12,-.12,18,MUTED,2.8))
        for k,op in enumerate(ops):out.add(_label(f'{k+1}. {op}',2.12,-.56-k*.30,18,INK,2.8))
        out.add(_label('从末尾往前找，稍后还要反转动作',0,-1.63,21,GOLD))
    elif phase=='boundary':
        i,j=c['current'];out.add(_label(f'{rlabels[i]} → {clabels[j]}',2.12,.95,29,GOLD,2.8),_label('逐字删除' if i else '逐字插入' if j else '无需编辑',2.12,.3,23,TEAL,2.8),_label(f'{max(i,j)} 次 × 1 = {max(i,j)}' if i or j else '0 次 = 0',2.12,-.3,23,INK,2.8),_label('完成后写入边界格' if not show_after else '边界值已知，供内部格使用',0,-1.63,21,GOLD))
    else:
        out.add(_label('行：源串前缀',2.1,1.08,23,TEAL,2.8),_label('列：目标前缀',2.1,.5,23,BLUE,2.8),_label('每格：最少代价',2.1,-.08,22,INK,2.8),_label('插入 1 · 删除 1',2.1,-.67,21,MUTED,2.8),_label(f'替换 {s["substitution"]} · 匹配 0',2.1,-1.15,21,MUTED,2.8))
    out.add(_label('· 表示尚未计算；数值来自已完成的真实填表步骤',0,-2.03,17,MUTED));return out

def kmp_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after);before=recorded_state(event,run,False)
    events=run['trace']['events'];pos=next(i for i,e in enumerate(events) if e['id']==event['id']);prefix=events[:pos+int(show_after)]
    p=run['trace']['initialState']['pattern'];t=run['trace']['initialState']['text'];phase=event['phase'];known=set()
    for e in prefix:
        if e['phase']=='initialize':known.add(0)
        if e['phase']=='prefix-update':
            change=next(c for c in e['changes'] if c['target']=='prefixIndex');known.add(change['before'])
    c={'state':state,'before':before,'pattern':p,'text':t,'known':known,'phase':phase}
    if phase=='initialize' or phase.startswith('prefix-'):
        target=before.get('prefixIndex',1);length=before.get('prefixLength',0)
        if phase=='prefix-compare':
            m=re.search(r'pattern\[(\d+)\].+?pattern\[(\d+)\]',event['explanation']);target,length=map(int,m.groups())
        if phase=='initialize':target=0;length=0
        c.update(target=target,length=state.get('prefixLength',0) if show_after else length)
        for j in known:
            value=state['lps'][j];sub=p[:j+1]
            assert value<j+1 and (value==0 or sub[:value]==sub[-value:])
    else:
        fallback=event.get('calculation',{}).get('values',{})
        i=state.get('i',fallback.get('i',0));j=state.get('j',fallback.get('j',0))
        assert 0<=i<=len(t) and 0<=j<=len(p)
        assert t[i-j:i]==p[:j],('KMP recorded matched prefix mismatch',event['id'],show_after)
        for start in state.get('matches',[]):assert t[start:start+len(p)]==p
        c.update(i=i,j=j)
    return c

def _kmp(event,run,show_after):
    c=kmp_context(event,run,show_after);s=c['state'];p=c['pattern'];t=c['text'];phase=c['phase'];out=VGroup()
    if phase=='initialize' or phase.startswith('prefix-'):
        target=c['target'];length=c['length'];step=min(.85,6.3/len(p));x=lambda j:(j-(len(p)-1)/2)*step
        out.add(_label('模式内部：最长相同真前后缀',0,1.98,25,GOLD))
        for k,ch in enumerate(p):
            col=GOLD if k==target else TEAL if k<c['length'] else RULE
            out.add(_label(k,x(k),1.53,15,MUTED,step-.05),_box(x(k),1.1,step-.08,.53,col,f'prefix-char{k}'),_label(ch,x(k),1.1,26,INK,step-.12))
            out.add(_box(x(k),.42,step-.08,.48,GOLD if k==target else RULE,f'lps{k}'),_label(s['lps'][k] if k in c['known'] else '·',x(k),.42,23,INK if k in c['known'] else MUTED,step-.12))
        out.add(_label('LPS',x(0)-.8,.42,18,TEAL,.7))
        if phase=='initialize':
            out.add(_label('单个字符：没有更短的非空首尾片段',0,-.38,24,INK),_label('已完成首项 0；其他项仍未计算' if show_after else '先确定首项为 0',0,-1.12,23,GOLD))
        elif phase=='prefix-compare':
            old=c['before'].get('prefixLength',0);left=p[old];right=p[target];eq=left==right
            out.add(_label(f'新字符 [{target}] {right}    对比    候选 [{old}] {left}',0,-.3,25,INK),_label(('相同：下一步延长' if eq else '不同：下一步缩短候选或填零') if show_after else '先比较，再决定能否延长',0,-.94,24,TEAL if eq else RED))
        elif phase=='prefix-fallback':
            old=c['before']['prefixLength'];new=s['lps'][old-1]
            out.add(_label(f'候选长度 {old} → LPS[{old-1}] = {new}',0,-.28,27,GOLD),_label(f'新字符仍在 [{target}] {p[target]}，没有移动',0,-.94,23,INK))
        else:
            value=s['lps'][target] if show_after else (c['before'].get('prefixLength',0)+1 if '延长' in event['action'] else 0)
            word=''.join(p[:target+1]);pre=''.join(p[:value]) or '空';suf=''.join(p[target-value+1:target+1]) or '空'
            out.add(_label(f'当前片段 {word}   →   LPS[{target}] '+(f'= {value}' if show_after else '待写入'),0,-.28,25,GOLD),_label(f'开头 {pre}    =    结尾 {suf}   · 长度 {value}',0,-.94,24,TEAL))
        out.add(_label('真前后缀不能包含整个片段；· 是未计算，不是零',0,-1.79,19,MUTED));return out
    i=c['i'];j=c['j'];step=min(.47,6.8/max(len(t),1));x=lambda k:-3.23+k*step
    out.add(_label('文本不倒退；模式按已知相等关系重新对齐',0,1.99,23,GOLD))
    # Pattern can extend beyond the input after a complete match; show only the
    # actual upcoming alignment when it fits, otherwise use the last true match.
    offset=i-j;display_offset=offset
    if offset+len(p)>len(t):display_offset=max(0,len(t)-len(p))
    final=phase=='stop'
    for k,ch in enumerate(t):
        confirmed=(i-j<=k<i);match=any(start<=k<start+len(p) for start in s.get('matches',[]))
        col=GOLD if k==i and not final else TEAL if confirmed or match else RULE
        out.add(_label(k,x(k),1.53,12,MUTED,step-.03),_box(x(k),1.16,step-.045,.45,col,f'text{k}'),_label(ch,x(k),1.16,19,INK,step-.06))
    if not final and offset+len(p)<=len(t):
        for k,ch in enumerate(p):
            col=GOLD if k==j else TEAL if k<j else RULE
            out.add(_box(x(display_offset+k),.37,step-.045,.45,col,f'pattern{k}'),_label(ch,x(display_offset+k),.37,19,INK,step-.06))
        if i<len(t):out.add(Line([x(i),.61,0],[x(i),.91,0],color=GOLD,stroke_width=2))
        out.add(_label(f'i = {i}  文本位置    j = {j}  已匹配长度',0,-.18,22,INK))
    else:
        starts=s.get('matches',[])
        for idx,start in enumerate(starts):
            left=x(start)-step*.42;right=x(start+len(p)-1)+step*.42
            out.add(Line([left,.69,0],[right,.69,0],color=TEAL,stroke_width=4),_label(f'起点 {start}',(left+right)/2,.36,20,TEAL,2.5))
        out.add(_label(f'i = {i}：'+('文本已检查完' if i==len(t) else '等待继续检查'),0,-.18,23,INK))
    if phase=='fallback':
        old=c['before']['j'];new=s['lps'][old-1];fragment=''.join(p[:old]);overlap=''.join(p[:new]) or '空'
        out.add(_label(f'{fragment} 的首尾同为 {overlap}；查 LPS[{old-1}] = {new}',0,-.77,23,TEAL),_label(f'文本 i = {i} 不动；j 从 {old} 退到 {new}',0,-1.32,24,GOLD))
    elif phase=='match':
        start=i-len(p)
        out.add(_label(f'完整匹配：{i} − {len(p)} = {start}',0,-.79,28,GOLD),_label('已记录起点：'+('、'.join(map(str,s.get('matches',[]))) or '尚未写入'),0,-1.32,23,TEAL))
    elif final:
        out.add(_label(f'搜索比较 {s["comparisons"]} 次 · 完整出现 {len(s["matches"])} 处',0,-.79,26,GOLD),_label('本例两处不重叠；是否重叠取决于实际文本和模式',0,-1.32,20,MUTED))
    elif phase=='compare':
        vals=event['calculation']['values'];eq=vals['text']==vals['pattern']
        out.add(_label(f'文本[{vals["i"]}] {vals["text"]}    '+(('=' if eq else '≠') if show_after else '对比')+f'    模式[{vals["j"]}] {vals["pattern"]}',0,-.79,26,TEAL if eq else RED),_label('相同后才前进；失配先查表，不丢掉已知关系',0,-1.32,20,MUTED))
    elif phase=='advance':
        oldi=c['before']['i'];oldj=c['before']['j']
        out.add(_label(f'i: {oldi} → {oldi+1}    j: {oldj} → {oldj+1}',0,-.79,26,TEAL),_label('刚确认一对字符相同，两指针各推进一格',0,-1.32,21,MUTED))
    else:out.add(_label(event['action'],0,-.79,24,GOLD))
    out.add(_label('回退表：'+'  '.join(map(str,s['lps'])),0,-1.94,19,MUTED));return out

def rle_context(event,run,show_after=True):
    s=recorded_state(event,run,show_after);before=recorded_state(event,run,False);phase=event['phase'];source=run['trace']['initialState']['text'];tokens=s['tokens']
    expanded=''.join(t['char']*t['count'] for t in tokens)
    assert source.startswith(expanded)
    assert all(tokens[k]['char']!=tokens[k+1]['char'] for k in range(len(tokens)-1))
    c={'state':s,'before':before,'source':source,'phase':phase,'expanded':expanded}
    if phase=='encode':
        index=next(x['after'] for x in event['changes'] if x['target']=='index');c['index']=index
        assert expanded==source[:index+int(show_after)]
    elif phase=='decode':
        index=int(re.search(r'第(\d+)段',event['action']).group(1))-1;c['tokenIndex']=index
        restored=''.join(t['char']*t['count'] for t in tokens[:index+int(show_after)])
        assert s.get('restored','')==restored
        assert s.get('encodedBits',0)==sum((1+len(t['char'].encode('utf8'))+4)*8 for t in tokens[:index+int(show_after)])
    elif phase=='stop' and show_after:
        assert s['restored']==source and s['lossless']
        assert s['rawBits']==len(source.encode('utf8'))*8
    return c

def _rle(event,run,show_after):
    c=rle_context(event,run,show_after);s=c['state'];phase=c['phase'];source=c['source'];tokens=s['tokens'];out=VGroup()
    colors=[TEAL,BLUE,GOLD,TEAL];step=min(.44,6.7/max(len(source),1));x=lambda k:(k-(len(source)-1)/2)*step
    out.add(_label('连续相同才合并；每一条记录保留原序',0,1.97,24,GOLD))
    if phase=='stop':
        raw=len(source.encode('utf8'))*8;encoded=s.get('encodedBits',0)
        out.add(_label('完整格式对照 · 同一段真实输入',0,1.34,23,INK))
        for k,(name,bits,col) in enumerate([('原始 UTF-8',raw,TEAL),('RLE 记录',encoded,GOLD)]):
            y=.64-k*.87;w=5.1*bits/max(raw,encoded);bar=Rectangle(width=w,height=.43,stroke_width=0,fill_color=col,fill_opacity=.8).move_to([-2.6+w/2,y,0]);out.add(bar,_label(f'{name}：{bits} 位',0,y+.36,21,col))
        out.add(_label(f'{len(tokens)} 条 × (1 + 1 + 4) 字节 × 8 = {encoded} 位',0,-1.04,23,GOLD),_label('还原一致；本短例反而增大 '+str(encoded-raw)+' 位' if show_after else '大小比较后，还要核验完整还原一致',0,-1.64,23,INK),_label('这一格式的字段开销也必须计入',0,-1.95,17,MUTED));return out
    for k,ch in enumerate(source):
        current=c.get('index')==k;processed=k<len(c['expanded']) if phase=='encode' else False
        col=GOLD if current else TEAL if processed else RULE
        out.add(_box(x(k),1.29,step-.04,.45,col,f'rle-input{k}'),_label(ch,x(k),1.29,20,INK,step-.07))
    if phase=='initialize':
        out.add(_label('每条记录都有三个字段',0,.6,24,INK))
        fields=[('字符字节长度','1 字节',1.65,TEAL),('字符本身','按 UTF-8',1.65,BLUE),('连续次数','4 字节',2.6,GOLD)];left=-3.15
        for name,value,w,col in fields:
            center=left+w/2;out.add(_box(center,-.2,w,.95,col,'rle-format'+name),_label(name,center,.02,20,col,w-.12),_label(value,center,-.36,21,INK,w-.12));left+=w+.15
        out.add(_label('本例每个字母 1 字节：每条共 6 字节 = 48 位',0,-1.13,23,GOLD),_label('按码点识别字符；卡片数量不等于文件大小',0,-1.8,20,MUTED));return out
    current_token=len(tokens)-1 if phase=='encode' else c['tokenIndex']
    # Actual records; the current one grows only after the recorded change.
    cardstep=1.65
    for k,tok in enumerate(tokens):
        cx=(k-1.5)*cardstep;col=GOLD if k==current_token else colors[k%len(colors)]
        out.add(_box(cx,.35,1.42,.7,col,f'rle-token{k}'),_label(f'{tok["char"]} × {tok["count"]}',cx,.43,25,INK,1.3),_label(f'第 {k+1} 段',cx,.16,16,col,1.3))
    if phase=='encode':
        old=c['before']['tokens'];char=source[c['index']];last=old[-1] if old else None
        if not last:line='没有现成记录 → 新增第 1 段，次数 1'
        elif last['char']==char:line=f'当前 {char} = 末段 {last["char"]} → 次数 {last["count"]} + 1'
        else:line=f'当前 {char} ≠ 末段 {last["char"]} → 另开第 {len(old)+1} 段'
        out.add(_label(line,0,-.5,24,GOLD))
        if len(old)>1 and last['char']!=char and any(t['char']==char for t in old[:-1]):
            out.add(_label('前面虽有同字，中间已有其他段；不能合并回去',0,-1.12,22,RED))
        else:out.add(_label('只与当前末段比较；不同则保留旧段，追加新段',0,-1.12,21,MUTED))
        out.add(_label(f'已编码 {len(c["expanded"])} / {len(source)} 个字符',0,-1.78,21,TEAL))
    elif phase=='decode':
        restored=s.get('restored','');previous=c['before'].get('restored','');tok=tokens[c['tokenIndex']]
        out.add(_label(f'本条 {tok["char"]} 重复 {tok["count"]} 次，接在已有内容后',0,-.37,23,GOLD))
        for k in range(len(source)):
            ch=restored[k] if k<len(restored) else '·';col=GOLD if len(previous)<=k<len(restored) else TEAL if k<len(restored) else RULE
            out.add(_box(x(k),-.98,step-.04,.45,col,f'rle-output{k}'),_label(ch,x(k),-.98,20,INK if ch!='·' else MUTED,step-.07))
        out.add(_label(f'已还原 {len(restored)} / {len(source)} 字符；已读取记录 {s.get("encodedBits",0)} 位',0,-1.6,22,TEAL),_label('上行原文 · 中间记录 · 下行真实还原；空点尚未输出',0,-1.95,17,MUTED))
    return out


def huffman_context(event,run,show_after=True):
    s=recorded_state(event,run,show_after);before=recorded_state(event,run,False);events=run['trace']['events'];pos=events.index(event);prefix=events[:pos+int(show_after)];source=run['trace']['initialState']['text'];phase=event['phase']
    c=dict(state=s,before=before,source=source,phase=phase,prefix=prefix)
    freq=s.get('frequency',{});counted=sum(freq.values())
    assert freq=={ch:source[:counted].count(ch) for ch in dict.fromkeys(source[:counted])}
    if phase=='count':c['index']=sum(before.get('frequency',{}).values())
    # Use the last actually committed tree scene, never a future merge scene.
    graph=next((e['scene'] for e in reversed(prefix) if e['phase']=='merge'),None)
    if graph is None:
        graph={'nodes':[{'id':str(i),'label':f'{ch}:{n}','x':i*30,'y':8} for i,(ch,n) in enumerate(freq.items())],'edges':[]}
    c['graph']=graph
    if phase=='encode':
        i=next(x['after'] for x in event['changes'] if x['target']=='encodedThrough');c['index']=i
        assert s.get('encodedBits','')==''.join(s['codes'][ch] for ch in source[:i+int(show_after)])
    elif phase=='decode':
        i=next(x['after'] for x in event['changes'] if x['target']=='decodeBit');c['index']=i
        used=s.get('encodedBits','')[:i+int(show_after)];decoded=s.get('decoded','');pending=s.get('pendingCode','')
        assert ''.join(s['codes'][ch] for ch in decoded)+pending==used
        assert source.startswith(decoded)
        c['readPath']=before.get('pendingCode','')+s['encodedBits'][i]
    elif phase=='stop' and show_after:
        assert s['decoded']==source and s['lossless'] and s['rawBits']==len(source.encode('utf8'))*8
    codes=s.get('codes',{})
    assert all(not a.startswith(b) for ch,a in codes.items() for other,b in codes.items() if ch!=other)
    return c


def _huffman_tree(c,path='',wide=False):
    g=c['graph'];nodes=g['nodes'];edges=g['edges'];out=VGroup()
    if not nodes:return out
    # Screen positions are a projection of recorded graph coordinates only.
    xmin=min(n['x'] for n in nodes);xmax=max(n['x'] for n in nodes)
    left=-2.95;span=5.9 if wide else 3.65
    xy={n['id']:(left+(n['x']-xmin)/max(1,xmax-xmin)*span,1.11-(n['y']-8)/80*1.65) for n in nodes}
    if len(nodes)==1:xy[nodes[0]['id']]=(-1.1,1.11)
    incoming={e['to'] for e in edges};roots=[n['id'] for n in nodes if n['id'] not in incoming];selected=set();at=roots[0] if len(roots)==1 else None
    if at is not None:
        for bit in path:
            edge=next((e for e in edges if e['from']==at and e['label']==bit),None)
            if edge is None:break
            selected.add((edge['from'],edge['to']));at=edge['to']
    for e in edges:
        a=xy[e['from']];b=xy[e['to']];col=GOLD if (e['from'],e['to']) in selected else RULE
        out.add(Line([a[0],a[1]-.19,0],[b[0],b[1]+.19,0],color=col,stroke_width=3 if col==GOLD else 2))
        out.add(_label(e['label'],(a[0]+b[0])/2+.17,(a[1]+b[1])/2,20,TEAL if col==RULE else GOLD,.35))
    for n in nodes:
        x,y=xy[n['id']];col=GOLD if n['id']==at and path else TEAL if ':' in n['label'] else BLUE
        out.add(_box(x,y,1.03,.43,col,'huffman-node'+n['id']),_label(n['label'],x,y,23,INK,.94))
    return out


def _huffman(event,run,show_after):
    c=huffman_context(event,run,show_after);s=c['state'];before=c['before'];phase=c['phase'];source=c['source'];out=VGroup()
    if phase in ['initialize','count']:
        out.add(_label('先数频数：隔开的同字也累加',0,1.98,25,GOLD));step=.76
        for i,ch in enumerate(source):
            x=(i-(len(source)-1)/2)*step;col=GOLD if c.get('index')==i else TEAL if i<sum(s.get('frequency',{}).values()) else RULE
            out.add(_box(x,1.23,.62,.53,col,'huffman-input'+str(i)),_label(ch,x,1.23,27,INK,.54))
        for i,(ch,n) in enumerate(s.get('frequency',{}).items()):
            y=.37-i*.61;w=n*.95
            out.add(_label(ch,-2.54,y,25,INK,.4),Rectangle(width=w,height=.34,fill_color=TEAL,fill_opacity=.7,stroke_width=0).move_to([-1.9+w/2,y,0]),_label(str(n),-1.6+w,y,25,GOLD,.6))
        out.add(_label(f'已读 {sum(s.get("frequency",{}).values())} / {len(source)} 字符',0,-1.73,24,TEAL));return out
    if phase=='stop':
        values=event['calculation']['values'];payload=len(s['encodedBits']);book=values['codebookBytes'];total=(book+(payload+7)//8)*8;raw=len(source.encode('utf8'))*8
        out.add(_label('完整格式：码表、头部与补齐都要算',0,1.97,24,GOLD))
        for i,(name,bits,col) in enumerate([('原文',raw,TEAL),('Huffman 完整格式',total,GOLD)]):
            y=1.12-i*.91;w=5.65*bits/max(raw,total)
            out.add(Rectangle(width=w,height=.37,fill_color=col,fill_opacity=.7,stroke_width=0).move_to([-2.85+w/2,y,0]),_label(f'{name} {bits} 位',0,y+.31,22,col))
        out.add(_label(f'码表含头 {book} 字节 + 载荷 {payload} 位 → 补齐 {(payload+7)//8} 字节',0,-.63,23,INK),_label(f'({book} + {(payload+7)//8}) × 8 = {total} 位',0,-1.22,27,GOLD),_label('还原一致；最优前缀载荷不等于完整格式一定更小',0,-1.89,20,MUTED));return out
    if phase=='merge':
        out.add(_label('候选根中取最轻两棵，合并后放回',0,1.98,24,GOLD));out.add(_huffman_tree(c,wide=True))
        # Candidate set belongs to the before-state; label it explicitly after.
        byid={n['id']:n['label'] for n in huffman_context(event,run,False)['graph']['nodes']}
        for i,cand in enumerate(event['candidates']):
            x=(i-(len(event['candidates'])-1)/2)*2.2;col=TEAL if cand['status']=='chosen' else MUTED;lab=byid[str(cand['target'])];verb='入选' if cand['status']=='chosen' else '暂缓'
            out.add(_box(x,-1.27,2.05,.56,col,'huffman-cand'+str(cand['target'])),_label(f'{lab} · {verb}',x,-1.27,22,col,1.92))
        vals=event['calculation']['values'];out.add(_label(('本步入选：' if show_after else '待合并：')+f'{vals["f1"]} + {vals["f2"]} = {event["calculation"]["result"]}',0,-1.91,24,GOLD));return out
    path=s.get('prefix','') if phase in ['branch','code'] else ''
    if phase=='decode':path=c['readPath'] if show_after else before.get('pendingCode','')
    if phase=='encode':path=s['codes'][source[c['index']]]
    out.add(_label('左边 0 · 右边 1 · 到叶子才确定字符',0,1.98,24,GOLD),_huffman_tree(c,path))
    for i,ch in enumerate(dict.fromkeys(source)):
        code=s.get('codes',{}).get(ch);col=TEAL if code is not None else RULE
        out.add(_box(2.18,1.1-i*.65,1.75,.49,col,'huffman-code'+ch),_label(f'{ch} → {code if code is not None else "·"}',2.18,1.1-i*.65,24,INK if code else MUTED,1.55))
    if phase in ['branch','code']:
        out.add(_label('当前路径：'+(s.get('prefix','') or '根'),0,-1.17,27,GOLD),_label('码表只列已经抵达叶子并记录的码字',0,-1.85,21,MUTED))
    elif phase=='encode':
        i=c['index'];out.add(_label(f'原文[{i}] {source[i]} → {s["codes"][source[i]]}',0,-1.12,24,GOLD),_label('已追加位串：'+(s.get('encodedBits','') or '空'),0,-1.79,26,TEAL))
    elif phase=='decode':
        i=c['index'];bits=s['encodedBits'];step=.44
        for k,bit in enumerate(bits):
            col=GOLD if k==i else TEAL if k<=s.get('decodeBit',-1) else RULE;x=(k-(len(bits)-1)/2)*step
            out.add(_box(x,-1.06,.37,.39,col,'huffman-bit'+str(k)),_label(bit,x,-1.06,21,INK,.3))
        decoded=s.get('decoded','');pending=s.get('pendingCode','');produced=len(decoded)>len(before.get('decoded',''))
        note='到叶输出 '+decoded[-1]+' → 下次从根开始' if produced else '当前在根，准备读取' if not pending else '尚在内部节点，不能输出'
        out.add(_label(note,0,-1.54,21,GOLD),_label('已还原：'+(decoded or '空'),0,-1.94,24,TEAL))
    return out


def lz77_context(event,run,show_after=True):
    s=recorded_state(event,run,show_after);before=recorded_state(event,run,False);events=run['trace']['events'];pos=events.index(event);prefix=events[:pos+int(show_after)];source=run['trace']['initialState']['text'];phase=event['phase'];c=dict(state=s,before=before,source=source,phase=phase,prefix=prefix,window=run['trace']['initialState']['window'])
    consumed=sum(t['length']+bool(t['next']) for t in s.get('tokens',[]));c['consumed']=consumed
    assert source.startswith(s.get('decoded',''))
    if phase=='position':c['position']=int(re.search(r'位置(\d+)',event['action']).group(1))
    else:c['position']=s.get('position',0)
    if phase=='compare':
        distance,offset=map(int,re.fullmatch(r'回看(\d+)，比较偏移(\d+)',event['action']).groups());start=c['position'];target=start+offset;origin=target-distance;eq=source[target]==source[origin]
        assert (event['candidates'][0]['status']=='chosen')==eq
        c.update(distance=distance,offset=offset,target=target,origin=origin,equal=eq,matched=offset+int(show_after and eq))
    elif phase=='candidate':
        distance,length=map(int,re.search(r'距离(\d+)匹配(\d+)个',event['explanation']).groups());c.update(distance=distance,length=length)
        assert source[c['position']:c['position']+length]==source[c['position']-distance:c['position']-distance+length]
    elif phase=='token':
        token=next(x['after'][-1] for x in event['changes'] if x['target']=='tokens');c['token']=token
        assert token['length']==0 or token['distance']>0
    if event['ruleId']=='lz77.decode':
        c['decoding']=True
        update=next(x['after'] for x in event['changes'] if x['target']=='decoded');c['appended']=update[-1];c['target']=len(before.get('decoded',''))
        if phase=='copy':
            origin=next((x['after'] for x in event['changes'] if x['target']=='sourceIndex'),before.get('sourceIndex'));rec=next((x['after'] for x in event['changes'] if x['target']=='decodeRecord'),before.get('decodeRecord'));distance=s['tokens'][rec]['distance']
            assert origin==c['target']-distance and 0<=origin<c['target']
            assert before['decoded'][origin]==c['appended'];c.update(origin=origin,distance=distance,record=rec)
    if phase=='stop' and show_after:
        assert s['decoded']==source and s['lossless']
        vals=event['calculation']['values'];assert s['encodedBits']==vals['header']+sum(vals['distanceBits']+4+8+len(t['next'].encode('utf8'))*8 for t in s['tokens'])
    return c


def _lz_tokens(tokens,y=.12):
    out=VGroup()
    for j,t in enumerate(tokens):
        x=(j-1)*2.24
        out.add(_box(x,y,2.08,.68,TEAL,'lz-token'+str(j)),_label(f'回看 {t["distance"]} · 复制 {t["length"]}',x,y+.13,20,INK,1.95),_label('新字 '+(t['next'] or '空'),x,y-.16,19,TEAL,1.95))
    return out


def _lz77(event,run,show_after):
    c=lz77_context(event,run,show_after);s=c['state'];before=c['before'];source=c['source'];phase=c['phase'];out=VGroup();step=min(.49,6.5/max(1,len(source)));x=lambda k:(k-(len(source)-1)/2)*step
    out.add(_label('在窗口内找更长重复，按三元记录还原',0,1.98,24,GOLD))
    if phase=='stop':
        vals=event['calculation']['values'];sizes=[vals['distanceBits']+4+8+len(t['next'].encode('utf8'))*8 for t in s['tokens']];total=vals['header']+sum(sizes)
        out.add(_lz_tokens(s['tokens'],1.18))
        for k,bits in enumerate(sizes):out.add(_label(f'{bits} 位',(k-1)*2.24,.54,23,GOLD))
        out.add(_label('字段：距离 4 位 + 长度 4 位 + 字节数 8 位 + 新字',0,-.04,20,MUTED),_label('头 40 + '+' + '.join(map(str,sizes))+f' = {total} 位',0,-.63,26,GOLD),_label(f'原文 {len(source)} × 8 = {len(source)*8} 位：本例没有省空间',0,-1.22,24,TEAL),_label('已完整还原；这是教学格式，不等于 ZIP 文件大小',0,-1.89,20,MUTED));return out
    if c.get('decoding'):
        out.add(_lz_tokens(s['tokens'],1.17));decoded=s.get('decoded','');target=c['target'];origin=c.get('origin')
        for k in range(len(source)):
            col=GOLD if k==target else BLUE if k==origin else TEAL if k<len(decoded) else RULE
            out.add(_label(k,x(k),.49,13,MUTED,step-.05),_box(x(k),.09,step-.045,.45,col,'lz-output'+str(k)),_label(decoded[k] if k<len(decoded) else '·',x(k),.09,22,INK,step-.08))
        if origin is not None:
            out.add(Line([x(origin),-.16,0],[x(origin),-.48,0],color=BLUE),Arrow([x(origin),-.48,0],[x(target),-.48,0],color=BLUE,buff=0,stroke_width=2,max_tip_length_to_length_ratio=.15))
            out.add(_label(f'当前长度 {target} − 距离 {c["distance"]} = 来源 {origin}',0,-.99,24,GOLD),_label(f'取来源的 {c["appended"]}，追加到位置 {target}',0,-1.49,23,INK))
        else:out.add(_label(f'不复制：把新字 {c["appended"]} 追加到位置 {target}',0,-.83,25,GOLD),_label('字面字符也要记录；没有偷偷从原文补全',0,-1.42,21,MUTED))
        out.add(_label(f'实际还原 {len(decoded)} / {len(source)} 字符；每次复制后再算下次来源',0,-1.92,19,TEAL));return out
    position=c['position'];window_left=max(0,position-c['window'])
    for k,ch in enumerate(source):
        col=GOLD if k==c.get('target',position) else BLUE if k==c.get('origin') else TEAL if window_left<=k<position else RULE
        out.add(_label(k,x(k),1.53,13,MUTED,step-.05),_box(x(k),1.12,step-.045,.45,col,'lz-input'+str(k)),_label(ch,x(k),1.12,22,INK,step-.08))
    if position>window_left:
        out.add(Line([x(window_left)-step*.43,.77,0],[x(position-1)+step*.43,.77,0],color=TEAL,stroke_width=4),_label(f'可回看 {position-window_left} 字',0,.5,20,TEAL))
    else:out.add(_label('没有可回看的历史',0,.5,21,MUTED))
    if phase=='initialize':
        out.add(_label(f'窗口 {c["window"]} · 最长匹配 15 · 同长选近处',0,-.21,25,GOLD),_label('记录 = 回看距离 + 复制长度 + 下个新字',0,-.88,25,INK),_label('允许重叠复制；不足 2 字则直接记字',0,-1.66,22,TEAL));return out
    if phase=='compare':
        i=c['origin'];j=c['target'];eq=c['equal'];distance=c['distance'];offset=c['offset']
        out.add(_label(f'回看 {distance} · 偏移 {offset}：目标[{j}] {source[j]}  对比 来源[{i}] {source[i]}',0,-.15,23,GOLD),_label(('相同：长度 '+str(offset+1) if eq else f'不同：停在长度 {offset}') if show_after else '先核对这对字符',0,-.84,26,TEAL if eq else RED),_label('编码器可见完整输入；解码仍需从实际输出逐字复制',0,-1.77,20,MUTED))
    elif phase=='candidate':
        old=before['bestLength'];length=c['length'];distance=c['distance']
        out.add(_label(f'候选：距离 {distance}，长度 {length}',0,-.14,27,GOLD),_label(f'已有最好：距离 {before["bestDistance"]}，长度 {old}',0,-.77,24,INK),_label(('更长：更新最好' if length>old else '不更长：保留已有') if show_after else '先比较两种匹配长度',0,-1.39,25,TEAL),_label('已记录最好：'+str(s['bestLength'])+' 字，回看 '+str(s['bestDistance']),0,-1.93,19,MUTED))
    elif phase=='token':
        out.add(_lz_tokens(s.get('tokens',[]),-.19));t=c['token']
        out.add(_label(f'本条消费 {t["length"]} + {int(bool(t["next"]))} = {t["length"]+bool(t["next"])} 字',0,-1.1,25,GOLD),_label(f'已记录覆盖 {c["consumed"]} / {len(source)} 个源字符',0,-1.83,22,TEAL))
    elif phase=='position':out.add(_label(f'当前起点 {position}，重新检查所有可用距离',0,-.2,25,GOLD),_label('每个距离从偏移 0 开始；上一轮最好不能直接沿用',0,-.94,22,INK),_label('匹配到不同、长度 15 或输入末尾就停止延长',0,-1.76,21,MUTED))
    else:out.add(_label('没有长度至少 2 的匹配：直接记录当前字符',0,-.3,25,GOLD),_label('不会从不存在的历史里复制',0,-1.35,23,MUTED))
    return out

def hamming_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after);before=recorded_state(event,run,False)
    events=run['trace']['events'];prefix=events[:int(event['id'])+int(show_after)]
    placed={int(re.search(r'位置(\d+)',e['action']).group(1)) for e in prefix if e['phase']=='place'}
    completed={};check=0
    for e in prefix:
        if e['phase']=='check':check=e['calculation']['result']
        elif e['phase']=='syndrome':completed[int(re.search(r'校验组(\d+)',e['action']).group(1))]=check
    values=event.get('calculation',{}).get('values',{})
    if event['phase'] in ['parity','check']:
        assert values['old']^values['bit']==event['calculation']['result']
        assert values['position']&values['mask']
        if show_after:
            assert (state['encodingBits'][values['mask']-1] if event['phase']=='parity' else state['checkParity'])==event['calculation']['result']
    assert sum(k for k,v in completed.items() if v)==state.get('syndrome',0)
    flip=None
    if event['phase']=='channel':
        prev=before.get('received',before['encodingBits']);after=recorded_state(event,run,True).get('received',prev)
        changed=[i+1 for i,(a,b) in enumerate(zip(prev,after)) if a!=b]
        assert len(changed)<=1
        flip=changed[0] if changed else None
    return dict(state=state,before=before,placed=placed,completed=completed,values=values,flip=flip,phase=event['phase'])

def _hamming_bits(bits,y,label,active=None,data_only=False,placed=None,key='bits'):
    out=VGroup(_label(label,-2.87,y,18,MUTED,1.22))
    for i in range(1,8):
        x=-1.8+(i-1)*.74;col=GOLD if i==active else TEAL if not data_only or i in [3,5,6,7] else RULE
        value=str(bits[i-1]) if bits is not None and (placed is None or i in placed or i in [1,2,4]) else '·'
        out.add(_box(x,y,.61,.44,col,key+str(i)),_label(value,x,y,23,col,.5))
    return out

def _hamming(event,run,show_after):
    c=hamming_context(event,run,show_after);s=c['state'];phase=c['phase'];v=c['values'];out=VGroup()
    out.add(_label('七位交叉校验：位置编号决定分组',0,1.96,23,GOLD))
    for i in range(1,8):
        x=-1.8+(i-1)*.74
        out.add(_label(str(i),x,1.5,18,INK,.6),_label(format(i,'03b'),x,1.17,17,MUTED,.63))
    if phase in ['initialize','place','parity','check','syndrome']:
        mask=v.get('mask',int(re.search(r'校验组(\d+)',event['action']).group(1)) if phase=='syndrome' else None)
        for row,(group,col) in enumerate([(1,TEAL),(2,BLUE),(4,GOLD)]):
            y=.77-row*.37;out.add(_label('组'+str(group),-2.88,y,18,col,1.1))
            for i in range(1,8):
                x=-1.8+(i-1)*.74;inside=bool(i&group)
                out.add(_label('●' if inside else '—',x,y,18,col if inside else RULE,.5))
            if group==mask:out.add(_box(.42,y,5.25,.33,col,'groupfocus'))
        data=s.get('received') if phase in ['check','syndrome'] else s.get('encodingBits')
        active=v.get('position')
        if phase=='place':active=int(re.search(r'位置(\d+)',event['action']).group(1))
        out.add(_hamming_bits(data,-.57,'收到' if phase in ['check','syndrome'] else '构造中',active,placed=c['placed'] if phase=='place' else None))
        if phase=='initialize':
            out.add(_label('右起第 1 / 2 / 3 个二进制位 → 校验组 1 / 2 / 4',0,-1.19,19,INK),_label('位置 1、2、4 留作校验；3、5、6、7 放数据',0,-1.9,20,TEAL))
        elif phase=='place':
            out.add(_label('原数据：'+s['data']+'；依次写入 3、5、6、7',0,-1.19,23,TEAL),_label('校验位暂置 0；数据位中的空点表示尚未写入',0,-1.89,19,MUTED))
        elif phase in ['parity','check']:
            msg=f'{v["old"]} XOR {v["bit"]}' + (' = '+str(event['calculation']['result']) if show_after else ' = ?')
            out.add(_label('纳入位置 '+str(v['position'])+'：'+msg,0,-1.2,26,TEAL))
            if phase=='parity':note='校验位暂存累加值；覆盖组全部处理完才定稿'
            else:note='本组从 0 开始累加；检查完才把组号写入综合征'
            out.add(_label(note,0,-1.9,19,MUTED))
        else:
            terms=[str(k) for k,val in c['completed'].items() if val]
            out.add(_label('已记录的失败组：'+(' + '.join(terms) if terms else '无')+'；综合征 '+str(s.get('syndrome',0)),0,-1.18,23,TEAL))
            out.add(_label('检查结果 1 才记入组号；结果 0 不增加',0,-1.9,20,MUTED))
        return out
    if phase=='channel':
        out.add(_hamming_bits(s['encodingBits'],.53,'发送码',c['flip']),_hamming_bits(s.get('received',s['encodingBits']),-.24,'收到',c['flip']))
        out.add(_label(('本次翻位置 '+str(c['flip'])) if c['flip'] else '本次开关为 0：不额外翻转',0,-1.05,25,GOLD),_label('只有实际翻转的那一位改变，其余位保留',0,-1.88,21,MUTED));return out
    syndrome=s.get('syndrome',0)
    out.add(_hamming_bits(s['received'],.55,'收到',syndrome),_hamming_bits(s.get('correctedBits',s['received']),-.2,'改后' if 'correctedBits' in s else '待改',syndrome,True))
    if phase=='correct':
        out.add(_label(f'综合征 {syndrome}：'+('翻转该位置' if syndrome else '不翻转'),0,-1.0,25,GOLD),_label('这是单错假设；多位错误可能指向原本正确的位',0,-1.88,20,RED))
    else:
        data=''.join(str(s['correctedBits'][i-1]) for i in [3,5,6,7]);assert data==recorded_state(event,run,True)['decoded']
        restored=data==s['data']
        out.add(_label('取 3、5、6、7 → '+data+'；原文 '+s['data'],0,-1.01,24,TEAL if restored else RED),_label('与原文一致；最多一位错时保证恢复' if restored else '与原文不一致：普通 (7,4) 码不保证纠正双错',0,-1.87,20,TEAL if restored else RED))
    return out

def crc_context(event,run,show_after=True):
    s=recorded_state(event,run,show_after);events=run['trace']['events'];prefix=events[:int(event['id'])+int(show_after)]
    data=s['data'];poly=s['polynomial'];degree=len(poly)-1;phase=event['phase'];values=event.get('calculation',{}).get('values',{})
    checksum=None
    for e in prefix:
        if e['phase']=='encode-division' and e['action']=='读取低阶余数':checksum=re.search(r'余数([01]+)',e['explanation']).group(1)
    encoded=data+checksum if checksum is not None else None;received=s.get('receivedPrefix',[])
    stage=phase if phase in ['encode-division','verify-division'] else ('verify-division' if phase=='stop' else 'encode-division')
    source=list(map(int,data+'0'*degree)) if stage=='encode-division' else received
    work=list(source)
    # A new division reuses the shared divisionBits state slot. Only writes from
    # this stage are relevant; before its first XOR use its actual source operand.
    for e in prefix:
        if e['phase']==stage:
            for change in e['changes']:
                if change['target']=='divisionBits':work=change['after']
    position=values.get('offset',int(re.search(r'位置(\d+)',event['action']).group(1)) if event['action'].startswith('检查除法') else s.get('divisionPosition',0))
    if 'polynomialBit' in values:
        assert values['old']^values['polynomialBit']==event['calculation']['result']
        assert values['polynomialBit']==int(poly[values['j']])
        assert work[position+values['j']]==(event['calculation']['result'] if show_after else values['old'])
    if phase=='channel':assert values['encoded']^values['mask']==event['calculation']['result']
    return dict(state=s,data=data,poly=poly,degree=degree,phase=phase,values=values,source=source,work=work,position=position,checksum=checksum,encoded=encoded,received=received)

def _crc_row(bits,y,label,n,active=None,start=0,color=TEAL,key='crc'):
    out=VGroup(_label(label,-2.95,y,18,MUTED,1.3));unit=min(.71,5.05/n)
    for i in range(n):
        x=-1.9+i*unit;known=start<=i<start+len(bits);value=str(bits[i-start]) if known else '·';col=GOLD if i==active else color if known else RULE
        out.add(_box(x,y,unit*.82,.45,col,key+str(i)),_label(value,x,y,23,col,unit*.76))
    return out

def _crc(event,run,show_after):
    c=crc_context(event,run,show_after);s=c['state'];phase=c['phase'];v=c['values'];n=len(c['data'])+c['degree'];out=VGroup()
    title='发送前求余' if phase in ['initialize','encode-division'] else '传输：逐位应用错误掩码' if phase=='channel' else '接收后重新求余' if phase=='verify-division' else '判断校验结果，不自动修复'
    out.add(_label(title,0,1.96,25,GOLD))
    if phase=='initialize':
        out.add(_label('规则 '+c['poly']+f'：长度 {len(c["poly"])}，次数 {c["degree"]}',0,1.26,24,INK),_crc_row(list(c['data']),.53,'原数据',n),_crc_row(c['source'],-.27,'补零后',n))
        out.add(_label('空点表示尚未附加；末尾补 '+str(c['degree'])+' 个 0',0,-1.13,22,TEAL),_label('把 0、1 当作多项式系数；不是普通整数相除',0,-1.88,20,MUTED));return out
    if phase=='channel':
        current=int(re.search(r'第(\d+)位',event['action']).group(1));mask=s['error'][-n:].rjust(n,'0')
        out.add(_crc_row(c['encoded'],1.03,'发送',n,current),_crc_row(mask,.28,'掩码',n,current,color=BLUE,key='mask'),_crc_row(c['received'],-.48,'收到前缀',n,current,key='received'))
        msg=f'{v["encoded"]} XOR {v["mask"]}'+(' = '+str(event['calculation']['result']) if show_after else ' = ?')
        out.add(_label(f'位置 {current}：'+msg,0,-1.22,26,TEAL),_label('掩码 0 保持，1 翻转；未处理的位保持空点',0,-1.94,20,MUTED));return out
    if phase=='stop':
        encoded=s.get('encoded',c['encoded']);received=s.get('received',''.join(map(str,c['received'])));rem=s['remainder'];flips=sum(a!=b for a,b in zip(encoded,received));detected='1' in rem
        out.add(_crc_row(encoded,1.13,'发送',n),_crc_row(received,.43,'收到',n),_label('接收余数 '+rem+'：'+('检出错误' if detected else '未检出错误'),0,-.37,27,RED if detected else GOLD),_label(f'演示已知：有 {flips} 位变化；接收方没有原文可比',0,-1.14,21,INK),_label('检错不纠错；零余数也不能排除所有错误',0,-1.92,20,RED));return out
    position=c['position'];active=position+v['j'] if 'j' in v else position
    out.add(_crc_row(c['source'],1.16,'输入原串',n),_crc_row(c['work'],.46,'工作串',n,active,key='work'))
    if event['action']=='读取低阶余数':
        remainder=''.join(map(str,c['work'][-c['degree']:]))
        out.add(_label('全部可处理的高位已消去 → 低位 '+remainder,0,-.32,24,TEAL))
        note=('原数据 '+c['data']+' + 余数 '+remainder+' = '+c['data']+remainder) if phase=='encode-division' else '接收余数由这次工作串得到，不沿用发送余数'
        out.add(_label(note,0,-1.08,22,GOLD),_label('余数的位数由规则次数决定',0,-1.91,21,MUTED));return out
    out.add(_crc_row(c['poly'],-.28,'对齐规则',n,active,start=position,color=BLUE,key='poly'))
    if 'j' in v:
        msg=f'位置 {active}：{v["old"]} XOR {v["polynomialBit"]}'+(' = '+str(event['calculation']['result']) if show_after else ' = ?')
        out.add(_label(msg,0,-1.1,27,TEAL),_label('这一组全部位置处理完，才能移动对齐起点',0,-1.93,21,MUTED))
    else:
        lead=c['work'][position]
        assert ('首位1' in event['explanation'])==bool(lead)
        out.add(_label(f'起点 {position} 首位 {lead}：'+('对齐并逐位异或' if lead else '没有最高项，直接右移'),0,-1.11,24,TEAL if lead else GOLD),_label('首位 1 才消去；首位 0 跳过这一组',0,-1.93,21,MUTED))
    return out

def bloom_context(event,run,show_after=True):
    s=recorded_state(event,run,show_after);before=recorded_state(event,run,False);events=run['trace']['events'];pos=events.index(event);prefix=events[:pos+int(show_after)];phase=event['phase'];values=event.get('calculation',{}).get('values',{})
    starts=[(i,e,re.fullmatch(r'键(.+)的哈希(\d+)初始化',e['action'])) for i,e in enumerate(events[:pos+1]) if e['phase']=='hash' and e['action'].endswith('初始化')]
    latest=starts[-1] if starts else None
    key=latest[2].group(1) if latest else None;salt=int(latest[2].group(2))-1 if latest else None
    cycle=next((i for i,e,m in reversed(starts) if m.group(2)=='1'),0)
    addresses={};current_salt=None;checked={}
    for e in prefix[cycle:]:
        m=re.fullmatch(r'键(.+)的哈希(\d+)初始化',e['action'])
        if m:current_salt=int(m.group(2))-1
        elif e['phase']=='position':addresses[current_salt]=e['calculation']['result']
        elif e['phase']=='query':
            p=int(re.search(r'位置(\d+)',e['action']).group(1));checked[p]=bool(s['bits'][p])
    active=None
    if phase in ['insert','query']:active=int(re.search(r'位置(\d+)',event['action']).group(1))
    elif phase=='position' and show_after:active=event['calculation']['result']
    if 'xored' in values:
        assert values['old']^values['byte']==values['xored']
        assert (values['xored']*values['multiplier'])&0xffffffff==event['calculation']['result']
    if phase=='position':assert values['hash']%values['size']==event['calculation']['result']
    if phase=='insert':
        assert not any(a>b for a,b in zip(before['bits'],s['bits']))
        assert s['bits'][active]==(1 if show_after else before['bits'][active])
    if phase=='stop' and show_after:
        assert s['maybe']==all(checked.values()) and s['really']==(s['query'] in s['keys'])
        assert s['falsePositive']==(s['maybe'] and not s['really'])
    return dict(state=s,before=before,phase=phase,values=values,key=key,salt=salt,addresses=addresses,checked=checked,active=active,initializing=bool(latest and latest[0]==pos))


def _bloom(event,run,show_after):
    c=bloom_context(event,run,show_after);s=c['state'];v=c['values'];phase=c['phase'];out=VGroup();n=s['size'];cols=min(8,n);rows=(n+cols-1)//cols
    out.add(_label('只记灯位，不保存名字',0,1.98,25,GOLD))
    for i,bit in enumerate(s['bits']):
        x=(i%cols-(cols-1)/2)*.78;y=1.22-(i//cols)*.64;col=GOLD if i==c['active'] else TEAL if bit else RULE
        out.add(_label(i,x,y+.33,15,MUTED,.6),_box(x,y,.63,.43,col,'bloom-bit'+str(i)),_label(bit,x,y,22,TEAL if bit else MUTED,.55))
    slot_y=1.22-rows*.64-.15
    if phase=='initialize':
        out.add(_label('登记 '+', '.join(s['keys'])+'；查询 '+s['query'],0,slot_y,26,GOLD),_label(f'{n} 个位从 0 开始；每个名字算 {s["hashes"]} 个地址',0,slot_y-.6,24,INK),_label('同一地址可被不同名字共用，亮灯不会记录由谁点亮',0,-1.42,21,MUTED),_label('本例只插入：已登记的名字不会被误判为不存在',0,-1.95,20,TEAL));return out
    out.add(_label('当前名字 '+c['key'],-2.64,slot_y,22,GOLD,1.7))
    for salt in range(s['hashes']):
        x=-.9+salt*1.47;addr=c['addresses'].get(salt);col=GOLD if salt==c['salt'] and phase in ['hash','position'] else TEAL
        out.add(_box(x,slot_y,1.34,.45,col,'bloom-address'+str(salt)),_label(f'{salt+1} → '+(str(addr) if addr is not None else '未算'),x,slot_y,20,col,1.2))
    if phase=='hash':
        if c['initializing']:
            actual=recorded_state(event,run,True)['hash']
            out.add(_label(f'第 {c["salt"]+1} 个规则：初始化哈希',0,-.71,25,GOLD),_label(str(actual) if show_after else '准备写入本规则的固定起始值',0,-1.22,25,TEAL),_label('同名同规则重复计算，必须得到同样的地址',0,-1.93,21,MUTED))
        else:
            out.add(_label(f'{v["old"]} XOR 字节 {v["byte"]} = {v["xored"]}',0,-.69,23,INK),_label(f'× {v["multiplier"]}，只取低 32 位',0,-1.22,23,MUTED),_label('更新哈希 '+(str(event['calculation']['result']) if show_after else '待写入'),0,-1.9,25,TEAL))
    elif phase=='position':
        out.add(_label(f'{v["hash"]} 除以 {v["size"]}，取余数',0,-.72,26,GOLD),_label('地址 '+(str(event['calculation']['result']) if show_after else '待写入'),0,-1.26,27,TEAL),_label('计算地址不会点灯；登记时才把相应位置置 1',0,-1.94,20,MUTED))
    elif phase=='insert':
        old=c['before']['bits'][c['active']];new=s['bits'][c['active']]
        change=f'{old} → {new}' if show_after else f'原值 {old}，待置 1'
        out.add(_label(f'登记 {c["key"]}：位置 {c["active"]}，'+change,0,-.73,26,GOLD),_label(('已经是 1：保持亮灯，不增加计数' if old else '把这个地址置 1，其余位保持') if show_after else '只处理当前地址',0,-1.26,23,TEAL),_label(f'实际亮灯 {sum(s["bits"])} / {n}；亮灯数不等于已登记人数',0,-1.94,20,MUTED))
    elif phase=='query':
        p=c['active'];on=bool(s['bits'][p]);out.add(_label(f'查询 {c["key"]}：位置 {p} 是 {int(on)}',0,-.72,26,GOLD))
        checked=list(c['checked'].items());message='尚未记录检查结果' if not checked else '已检查：'+'，'.join(str(k)+'='+str(int(b)) for k,b in checked)
        out.add(_label(message,0,-1.25,23,TEAL),_label('出现 0 就能排除；全为 1 仍只表示可能存在',0,-1.94,21,MUTED))
    else:
        maybe=s['maybe'];really=s['query'] in s['keys']
        out.add(_label('灯板回答：'+('可能存在' if maybe else '确定未登记'),0,-.7,26,GOLD if maybe else TEAL),_label('另查真实名单 '+', '.join(s['keys'])+'：'+s['query']+(' 在其中' if really else ' 不在其中'),0,-1.28,23,INK),_label('本次是误报：名字不同，所需灯位却全部已亮' if maybe and not really else '只插入时没有假阴性；可能存在需要进一步核实',0,-1.94,20,RED if maybe and not really else MUTED))
    return out


def information_principle_visual(event,run,snapshot,show_after=True):
    algorithm=run.get('trace',{}).get('algorithmId')
    if algorithm=='apriori':return _apriori(event,run,show_after)
    if algorithm=='bm25':return _bm25(event,run,show_after)
    if algorithm=='edit-distance':return _edit(event,run,show_after)
    if algorithm=='kmp':return _kmp(event,run,show_after)
    if algorithm=='rle':return _rle(event,run,show_after)
    if algorithm=='huffman':return _huffman(event,run,show_after)
    if algorithm=='lz77':return _lz77(event,run,show_after)
    if algorithm=='hamming':return _hamming(event,run,show_after)
    if algorithm=='crc':return _crc(event,run,show_after)
    if algorithm=='bloom':return _bloom(event,run,show_after)
    return None
