"""Readable AHP/TOPSIS projections of recorded states; no solver is run here.

Visual focus selects an explanation phase, never an alternative computation.
Rounded display values and proportional bars are presentation only.
"""
from __future__ import annotations
import copy
from manim import Group, Rectangle, RoundedRectangle, Line
from visuals import text, display, INK, MUTED, TEAL, GOLD, RED, PANEL, RULE

BLUE = '#90B3FF'


def _state(event, run, after):
    state = copy.deepcopy(run['trace']['initialState'])
    for item in run['trace']['events']:
        if item['id'] == event['id'] and not after:
            break
        for change in item['changes']:
            state[change['target']] = copy.deepcopy(change['after'])
        if item['id'] == event['id']:
            break
    return state


def _body(title):
    g = Group(Rectangle(width=7.6, height=4.25, stroke_width=0, fill_opacity=0))
    g.add(text(title, 23, TEAL, width=7.4).move_to([0, 1.84, 0]))
    return g


def _line(g, label, y, color=INK, size=20):
    g.add(text(label, size, color, width=7.3).move_to([0, y, 0]))


def _table(g, headers, rows, widths, top=1.27, height=.52, cell_colors=None):
    """Rows include their first-column label; colors keyed by (row, column)."""
    left = -sum(widths)/2
    for ri, row in enumerate([headers] + rows):
        x = left
        for ci, (value, width) in enumerate(zip(row, widths)):
            color = MUTED if ri == 0 else (cell_colors or {}).get((ri-1, ci), INK)
            y = top-ri*height
            fill = PANEL if ri == 0 else '#142B37'
            if color == GOLD: fill = '#3A3024'
            elif color == TEAL: fill = '#153B3D'
            elif color == RED: fill = '#352534'
            rect = Rectangle(width=width-.025, height=height-.025,
                             stroke_color=color if color in {GOLD,TEAL,RED} else RULE,
                             stroke_width=1.4 if color in {GOLD,TEAL,RED} else .7,
                             fill_color=fill, fill_opacity=1).move_to([x+width/2,y,0])
            g.add(rect, text(str(value) if isinstance(value,str) else display(value),
                             18 if ri == 0 else 21, color, width=width-.15).move_to(rect))
            x += width


def _ahp(event, run, after, focus):
    before = _state(event, run, False)
    state = _state(event, run, after)
    recorded_after = _state(event, run, True)
    criteria = state.get('criteria')
    if not criteria: return None
    short = [str(x) for x in criteria]
    matrix = state.get('matrix')
    rule = event['ruleId']
    if rule == 'ahp-matrix':
        if not matrix: return None
        g = _body('行指标相对列指标：重要几倍？')
        colors = {(i,j+1): TEAL for i in range(3) for j in range(3)
                  if (i>j if focus=='reciprocal' else i<j)}
        _table(g, ['行 / 列']+short, [[short[i]]+row for i,row in enumerate(matrix)],
               [1.65,1.85,1.85,1.85], top=1.15, height=.60, cell_colors=colors)
        _line(g, '对角线为 1：自己与自己同样重要', -1.30, MUTED)
        _line(g, '反向取倒数：'+display(matrix[0][1])+' ↔ '+display(matrix[1][0])+
              '；'+display(matrix[1][2])+' ↔ '+display(matrix[2][1]), -1.79, GOLD)
        return g
    if rule == 'ahp-power':
        old = before['weights']; current = state['weights']
        products = state.get('product') if after else None
        iteration = recorded_after['iteration']
        g = _body('第 '+str(iteration)+' 轮：旧权重 → 行乘积和 → 新权重')
        rows = [[short[i],old[i],products[i] if products else '待算',
                 current[i] if after and focus!='products' else '待归一化'] for i in range(3)]
        colors = {(i,2 if focus=='products' else 3 if after else 1):TEAL for i in range(3)}
        _table(g,['指标','旧权重','行乘积和 z','新权重'],rows,[1.65,1.65,1.95,1.95],
               top=1.18,height=.57,cell_colors=colors)
        row = before['matrix'][0]
        expr = ' + '.join(display(a)+' × '+display(w) for a,w in zip(row,old))
        _line(g, '第一行：'+expr+(' ≈ '+display(products[0]) if products else ''),-1.30,INK,18)
        total = event['calculation']['values']['总和']
        label = '各行与同一组旧权重相乘、相加' if not after else (
            '乘积总和 '+display(total)+'；下一步每项除以它' if focus=='products' else
            '新权重 = 行乘积和 ÷ '+display(total)+'；总和为 1')
        _line(g,label,-1.80,GOLD,20)
        if focus=='products':
            g._projection_phase='分步解释同一条记录：先展开乘积，下一段归一化'
        return g
    if rule == 'ahp-consistency':
        g = _body('检查偏好比例是否互相协调')
        _line(g,'经由性能比较：'+display(matrix[0][1])+' × '+display(matrix[1][2]),1.10,TEAL,27)
        _line(g,'直接比较价格 / 便携：'+display(matrix[0][2]),.53,BLUE,25)
        _line(g,'对照两条关系；一致性不检查偏好是否客观',-.06,MUTED,20)
        if after:
            v=event['calculation']['values']
            _table(g,['特征值 λ','维数 n','随机指标 RI','一致性 CR'],
                   [[v['λ'],v['维数'],v['随机一致性指标RI'],state['cr']]],
                   [1.8]*4,top=-.75,height=.50,cell_colors={(0,3):GOLD})
            _line(g,'CR = max(0, (λ − 3) ÷ 2 ÷ 0.58)',-1.84,INK,20)
        else:
            _line(g,'下一步用 CR 检查这种协调程度',-1.10,GOLD,25)
        return g
    if rule == 'ahp-score':
        raw=state.get('raw');options=state.get('options')
        if not raw or not options:return None
        normalized=after and focus=='normalized'
        target=focus.removeprefix('candidate:') if focus.startswith('candidate:') else None
        vals=state['normalized'] if normalized else raw
        score=state.get('scores') if after else None
        g=_body('按列和归一化，再乘偏好权重' if normalized else '候选属性：三项都已经设为越大越好')
        rows=[[label]+vals[i]+([score[i]] if score else ['待算']) for i,label in enumerate(options)]
        colors={}
        for i,label in enumerate(options):
            if label==target:
                colors.update({(i,j):TEAL for j in range(5)})
            elif score:
                candidate=next(c for c in event['candidates'] if c['target']==label)
                colors[(i,4)]=GOLD if candidate['status']=='chosen' else RED
        _table(g,['方案']+short+['综合分'],rows,[1.4,1.35,1.35,1.35,1.75],
               top=1.18,height=.57,cell_colors=colors)
        _line(g,'偏好权重：'+' / '.join(display(w) for w in state['weights']),-1.19,BLUE,21)
        if after:
            row_index=options.index(target) if target in options else 1
            if normalized:
                _line(g,'各列分别除以：'+' / '.join(display(v) for v in state['columnSum']),-1.70,GOLD,21)
            else:
                expr=' + '.join(display(v)+' × '+display(w) for v,w in zip(state['normalized'][row_index],state['weights']))
                _line(g,options[row_index]+'：'+expr+' ≈ '+display(score[row_index]),-1.70,GOLD,16)
        else:_line(g,'此处是候选属性；不是成对比较矩阵',-1.70,MUTED,22)
        return g
    return None


def _topsis(event,run,after,focus):
    state=_state(event,run,after);rule=event['ruleId']
    raw=state['data'];weights=state['weights']
    # Names originate from the recorded scenes, not from a guessed case.
    options=run['frames'][0]['scene']['rowLabels']
    columns=run['frames'][0]['scene']['columnLabels']
    directions=[columns[0]+' ↓',columns[1]+' ↑',columns[2]+' ↓']
    if rule in {'topsis-normalize','topsis-weight'}:
        raw_view=rule=='topsis-normalize' and not after
        weighted_view=rule=='topsis-weight'
        vals=raw if raw_view else state['weighted'] if weighted_view and after else state['normalized']
        title='原始教学属性：单位不同，不能直接相加' if raw_view else '加权属性：每列乘对应重要程度' if weighted_view else '归一化：原值 ÷ 所在列的长度'
        g=_body(title)
        _table(g,['方案']+columns,[[label]+vals[i] for i,label in enumerate(options)],
               [1.8,1.8,1.8,1.8],top=1.19,height=.46,
               cell_colors={(0,1):TEAL} if not weighted_view else None)
        if raw_view:_line(g,'下一步：每列平方求和，再开平方',-1.62,GOLD,23)
        elif weighted_view:
            v=event['calculation']['values']
            _line(g,'原权重 '+' / '.join(display(w) for w in weights)+' → '+' / '.join(display(w) for w in v.values()),-1.42,BLUE,20)
            _line(g,display(state['normalized'][0][0])+' × '+display(v['预算权重'])+' ≈ '+display(vals[0][0]),-1.88,GOLD,21)
        else:
            _line(g,'三列长度：'+' / '.join(display(n) for n in state['norms']),-1.42,BLUE,20)
            _line(g,'配送预算：'+display(raw[0][0])+' ÷ '+display(state['norms'][0])+' ≈ '+display(vals[0][0]),-1.88,GOLD,21)
        return g
    if rule=='topsis-ideal':
        g=_body('↓ 越小越好；↑ 越大越好')
        rows=[[label]+state['weighted'][i] for i,label in enumerate(options)]
        colors={}
        if after:
            for i,row in enumerate(state['weighted']):
                for j,value in enumerate(row):
                    if value==state['ideal'][j]:colors[(i,j+1)]=TEAL
                    elif value==state['worst'][j]:colors[(i,j+1)]=RED
            rows.extend([['理想']+state['ideal'],['最差']+state['worst']])
            colors.update({(4,j):TEAL for j in range(4)});colors.update({(5,j):RED for j in range(4)})
        _table(g,['方案']+directions,rows,[1.8]*4,top=1.30,height=.425,cell_colors=colors)
        _line(g,'按列拼成两个参照；不一定存在这样的候选',-1.80,GOLD,21)
        return g
    if rule=='topsis-distance':
        change=next(c for c in event['changes'] if c['target'].startswith('distance:'))
        i=int(change['target'].split(':')[1]);label=options[i]
        g=_body(label+'：分别与两个参照逐列比较')
        _table(g,['已加权值']+directions,[[label]+state['weighted'][i],['理想']+state['ideal'],['最差']+state['worst']],
               [1.8]*4,top=1.23,height=.45,
               cell_colors={(0,j):BLUE for j in range(4)}|{(1,j):TEAL for j in range(4)}|{(2,j):RED for j in range(4)})
        if not after:
            _line(g,'各列之差平方相加，再开方；得 D⁺ 与 D⁻',-1.25,GOLD,21)
            return g
        dp,dm=state[change['target']];score=state['score:'+str(i)]
        if focus=='distances':
            _line(g,'到理想：三个坐标差，各自平方',-.64,MUTED,19)
            for j,(value,reference) in enumerate(zip(state['weighted'][i],state['ideal'])):
                expr='('+display(value)+' − '+display(reference)+')²'
                g.add(text(expr,18,TEAL,width=2.30).move_to([-2.46+j*2.46,-1.06,0]))
            _line(g,'D⁺ = √(三项之和) ≈ '+display(dp),-1.48,GOLD,22)
            _line(g,'对最差参照同样计算：D⁻ ≈ '+display(dm),-1.91,RED,21)
            g._projection_phase='分步解释同一条记录：先算两段距离，下一段求贴近度'
            return g
        _line(g,'D⁺ 越小越靠近理想；D⁻ 越大越远离最差',-.49,MUTED,17)
        # One fixed axis for both actual distances; these are lengths, not scores.
        axis_max=max(.30,dp,dm)
        for label,value,color,y in [('离理想 D⁺',dp,TEAL,-.88),('离最差 D⁻',dm,RED,-1.35)]:
            g.add(text(label,18,color,width=1.72).move_to([-2.80,y,0]))
            g.add(Line([-1.77,y,0],[2.45,y,0],color=RULE,stroke_width=1))
            width=max(.015,value/axis_max*4.22)
            g.add(Rectangle(width=width,height=.24,stroke_width=0,fill_color=color,fill_opacity=.82).move_to([-1.77+width/2,y,0]),text(display(value),20,color,width=1.15).move_to([3.02,y,0]))
        if focus=='boundary':
            _line(g,'边界约定：D⁺ = D⁻ = 0 时取 0.5；本例不属于此情况',-1.88,GOLD,18)
        else:
            _line(g,'贴近度 '+display(dm)+' ÷ ('+display(dp)+' + '+display(dm)+') ≈ '+display(score),-1.88,GOLD,20)
        return g
    if rule=='topsis-rank':
        g=_body('先核对原属性，再看综合贴近度')
        target=focus.removeprefix('candidate:') if focus.startswith('candidate:') else None
        scores=state.get('scores',[state['score:'+str(i)] for i in range(len(options))])
        best=state.get('best')
        rows=[[label]+raw[i]+[scores[i]] for i,label in enumerate(options)]
        colors={}
        for i,label in enumerate(options):
            colors[(i,4)]=BLUE if not after else GOLD if i==best else RED
            if label==target:colors.update({(i,j):TEAL for j in range(4)})
        _table(g,['方案']+directions+['贴近度'],rows,[1.6,1.4,1.4,1.4,1.4],top=1.17,height=.51,cell_colors=colors)
        _line(g,('当前推荐：'+options[best]+'；分数越高越靠近理想') if after else '下一步比较四个贴近度，取最大者',-1.57,GOLD,22)
        _line(g,'相对比较分，不是成功概率',-1.97,MUTED,18)
        return g
    return None


def decision_matrix_principle_visual(event,run,snapshot,show_after,visual_focus=None):
    """A 7.6 × 4.25 left-column projection for AHP and TOPSIS only."""
    algorithm=run['trace']['algorithmId'];focus=visual_focus or ''
    if algorithm=='ahp':return _ahp(event,run,show_after,focus)
    if algorithm=='topsis':return _topsis(event,run,show_after,focus)
    return None
