"""Game-tree projections from recorded states, never another game search.

The active decision board is the opening node identified by parentId, not the
last globally visited leaf. A root decision uses the recorded root board.
"""
import re
import math
from manim import *
from visuals import text,display,TEAL,GOLD,MUTED,RULE,INK

BLUE='#90B3FF'
RED='#F28E91'

def label(value,x,y,size=20,color=INK,width=7.35,key=None):
    out=text(str(value),size,color,width=width).move_to([x,y,0])
    if key:out._motion_key='label:decision-game:'+str(key)
    return out

def recorded_board(event):
    labels=event.get('scene',{}).get('cellLabels')
    if labels is None:raise ValueError('Game board must be recorded explicitly')
    board=''.join(v if v in {'X','O'} else '.' for v in labels)
    assert len(board)==9
    return board

def board_visual(board,x,y,size=1,active=None,key='board'):
    group=VGroup();unit=size/3
    for i,ch in enumerate(board):
        cx=x+(i%3-1)*unit;cy=y+(1-i//3)*unit
        box=Square(side_length=unit*.91,stroke_width=2 if i==active else 1,stroke_color=TEAL if i==active else RULE,fill_color=TEAL if i==active else '#102130',fill_opacity=.17 if i==active else 1).move_to([cx,cy,0]);box._motion_key=f'game:{key}:cell:{i}'
        char=ch if ch!='.' else str(i+1);col=GOLD if ch=='X' else BLUE if ch=='O' else MUTED
        group.add(box,label(char,cx,cy,max(12,27*size),col,unit*.72,key=f'{key}:{i}'))
    return group

def _difference(parent,child):
    positions=[i for i,(a,b) in enumerate(zip(parent,child)) if a!=b]
    assert len(positions)==1 and parent[positions[0]]=='.', (parent,child)
    return positions[0]

def minimax_context(event,run,show_after=True):
    events=run['trace']['events'];position=events.index(event);before=events[:position];phase=event['phase'];initial=run['trace']['initialState'];root=initial['rootBoard'];player=initial['player'];byid={e['id']:e for e in events};calc=event.get('calculation',{})
    context=dict(phase=phase,player=player,root=root,show_after=show_after,children=[],event=event)
    if phase=='复用同一局面':
        source=byid[str(calc['values']['已算事件'])];assert events.index(source)<position
        assert recorded_board(source)==recorded_board(event)
        assert source['calculation']['result']==calc['result']
        context.update(board=recorded_board(event),source=source,value=calc['result'],depth=calc['values']['剩余深度']);return context
    if phase in ['到达真实终局','达到深度上限']:
        opening=byid.get(event.get('parentId'));parent=recorded_board(opening) if opening else root;child=recorded_board(event);move=_difference(parent,child)
        turn=child[move];value=calc['result'];depth=calc['values']['剩余深度'];outcome=calc['values']['结果']
        if phase=='到达真实终局':assert value==(0 if outcome=='draw' else 100+depth if outcome==player else -100-depth)
        context.update(board=parent,turn=turn,value=value,depth=depth,outcome=outcome,children=[dict(move=move,board=child,value=value if show_after else None,provider=event['id'],terminal=True)]);return context
    if phase=='根节点决策':board=root;node_id=None;turn=player
    elif phase=='向上回传评价':
        opening=byid[event['parentId']];assert opening['phase']=='展开合法走法';board=recorded_board(opening);node_id=opening['id'];turn=calc['values']['轮到'];assert recorded_board(event)==board
    elif phase=='展开合法走法':board=recorded_board(event);node_id=event['id'];turn=re.search(r'轮到([XO])',event['action']).group(1)
    else:raise ValueError('Unknown Minimax phase '+phase)
    completed={e['parentId']:e for e in before if e['phase']=='向上回传评价'}
    children=[]
    for child in before:
        if child.get('parentId')!=node_id or child['phase'] in ['向上回传评价','根节点决策']:continue
        child_board=recorded_board(child);move=_difference(board,child_board)
        provider=completed.get(child['id']) if child['phase']=='展开合法走法' else child
        children.append(dict(move=move,board=child_board,value=provider['calculation']['result'] if provider else None,provider=provider['id'] if provider else None,terminal=child['phase']=='到达真实终局'))
    # Unknown descendants are legal move placeholders, not invented evaluated
    # boards or values. Opening events have no completed descendants yet.
    children_by_move={c['move']:c for c in children}
    for move,ch in enumerate(board):
        if ch=='.' and move not in children_by_move:children_by_move[move]=dict(move=move,board=None,value=None,provider=None,terminal=False)
    children=[children_by_move[i] for i in sorted(children_by_move)]
    if phase in ['向上回传评价','根节点决策']:
        assert all(c['value'] is not None for c in children)
        choices={int(re.search(r'第(\d+)格',c['target']).group(1))-1:c for c in event['candidates']}
        for c in children:assert c['value']==next(iter(choices[c['move']]['values'].values()))
        values=[c['value'] for c in children];expected=max(values) if turn==player else min(values)
        assert expected==calc['result'];chosen=next(c['move'] for c in children if c['value']==expected)
        assert choices[chosen]['status']=='chosen'
        context.update(value=expected,chosen=chosen)
    context.update(board=board,turn=turn,children=children,node_id=node_id)
    return context

def minimax_visual(event,run,show_after):
    c=minimax_context(event,run,show_after);phase=c['phase'];out=VGroup();player=c['player']
    if phase=='复用同一局面':
        out.add(label('同一个局面，复用已经算出的值',0,1.93,24,GOLD),board_visual(c['board'],-1.95,.5,1.42,key='cache-old'),board_visual(c['board'],1.95,.5,1.42,key='cache-now'))
        out.add(Arrow([-1,.5,0],[1,.5,0],buff=.08,color=TEAL),label('复用',0,.88,22,TEAL),label('已算事件 '+c['source']['id'],-1.95,1.43,21,MUTED,2.3),label('当前事件 '+event['id'],1.95,1.43,21,MUTED,2.3),label(c['value'],-1.95,-.63,28,TEAL),label(c['value'] if show_after else '待写入',1.95,-.63,28,TEAL))
        out.add(label('同棋盘 + 同执子方 + 同剩余深度 '+str(c['depth']),0,-1.32,23,INK),label('值有真实计算来源；没有跳过未知的未来',0,-1.90,20,MUTED));return out
    turn=c['turn'];extreme='max' if turn==player else 'min';chinese='最大' if turn==player else '最小';is_leaf=phase in ['到达真实终局','达到深度上限'];is_return=phase in ['向上回传评价','根节点决策']
    heading=('终局评分：始终从 '+player+' 的视角' if phase=='到达真实终局' else '深度截止：启发估分' if phase=='达到深度上限' else f'{turn} 取{chinese}：子分数向父节点汇合' if is_return else f'轮到 {turn}：先向下展开所有合法走法')
    out.add(label(heading,0,1.93,24,GOLD),board_visual(c['board'],0,.99,1.04,key='parent'))
    out.add(label('父局面',-2.28,1.19,23,INK,2.4),label('棋子尚未落下',-2.28,.72,19,MUTED,2.4))
    if is_return:out.add(label('回传值' if show_after else '准备取'+chinese,2.27,1.2,21,MUTED,2.4),label(c['value'] if show_after else '待写入',2.27,.7,27,TEAL,2.4))
    elif is_leaf:out.add(label('先评分叶子',2.27,1.16,22,TEAL,2.4),label('父节点稍后汇总',2.27,.7,19,MUTED,2.4))
    else:out.add(label('尚未得到子值',2.27,1.15,21,MUTED,2.4),label('不预填答案',2.27,.7,21,TEAL,2.4))
    n=len(c['children']);spacing=min(1.45,6.3/max(1,n-1));size=min(.83,spacing*.85)
    for j,child in enumerate(c['children']):
        x=(j-(n-1)/2)*spacing;move=child['move'];selected=is_return and show_after and move==c['chosen'];color=TEAL if selected else GOLD if is_leaf else MUTED
        if child['board'] is not None:out.add(board_visual(child['board'],x,-.85,size,move,key='child'+str(move)))
        else:out.add(label('待展开',x,-.85,19,MUTED,spacing*.95))
        out.add(label('第'+str(move+1)+'格',x,-.27,19,color,spacing*.95),label(child['value'] if child['value'] is not None else '未求值',x,-1.43,25,color,spacing*.95))
        start=[x,-.05,0];end=[0,.44,0]
        arrow=Arrow(start if is_return or is_leaf else end,end if is_return or is_leaf else start,buff=.04,color=color,stroke_width=3 if selected else 1.5,tip_length=.11,max_tip_length_to_length_ratio=.13);arrow._motion_key='game:branch:'+str(move);out.add(arrow)
    if is_return:
        expression=extreme+'('+', '.join(str(ch['value']) for ch in c['children'])+')'+(' = '+str(c['value']) if show_after else ' → 待回传')
        out.add(label(expression,0,-1.90,24,TEAL))
    elif is_leaf:
        if phase=='达到深度上限':formula='未终局：开放连线启发分，不是已知胜负'
        elif c['outcome']=='draw':formula='棋盘已满且无人连线：平局评分 0'
        else:formula=('100 + ' if c['outcome']==player else '−100 − ')+str(c['depth'])+' = '+str(c['value'])
        out.add(label(formula,0,-1.90,24,TEAL))
    else:out.add(label('子分支还没算完，不能先把最好结果填给父节点',0,-1.90,20,MUTED))
    return out

def decision_game_principle_visual(event,run,snapshot,show_after=True):
    if run.get('trace',{}).get('algorithmId')=='minimax':return minimax_visual(event,run,show_after)
    if run.get('trace',{}).get('algorithmId')=='mcts':return mcts_visual(event,run,show_after)
    return None


def mcts_context(event,run,show_after=True):
    events=run['trace']['events'];position=events.index(event);state=dict(run['trace']['initialState'])
    for e in events[:position]:
        for change in e.get('changes',[]):state[change['target']]=change['after']
    root=state['rootBoard'];player='X' if root.count('X')==root.count('O') else 'O'
    nodes={0:dict(board=root,parent=None,move=-1)}
    nodes.update({int(k[4:]):v for k,v in state.items() if re.fullmatch(r'node\d+',k)})
    phase=event['phase'];calc=event.get('calculation',{});values=calc.get('values',{})
    c=dict(phase=phase,state=state,nodes=nodes,player=player,root=root,event=event,after=show_after)
    if phase in ['模拟轮初始化','初始终局']:
        c.update(board=root,iteration=next((v['after'] for v in event['changes'] if v['target']=='iteration'),None),N=state.get('N0',0),W=state.get('W0',0));return c
    if phase=='扩展':
        change=next(v for v in event['changes'] if re.fullmatch(r'node\d+',v['target']));child=change['after'];parent=nodes[child['parent']];existing={n['move'] for n in nodes.values() if n['parent']==child['parent']}
        legal=[i for i,ch in enumerate(parent['board']) if ch=='.' and i not in existing];draw=values['随机数'];index=math.floor(draw*len(legal))
        assert len(legal)==values['未试动作数'] and index==calc['result'] and legal[index]==child['move']
        assert recorded_board(event)==child['board'] and _difference(parent['board'],child['board'])==child['move']
        c.update(board=parent['board'],child=child['board'],move=child['move'],legal=legal,draw=draw,index=index,node=int(change['target'][4:]));return c
    if phase=='随机模拟':
        after=recorded_board(event);move=calc['result']-1;before=after[:move]+'.'+after[move+1:];legal=[i for i,ch in enumerate(before) if ch=='.'];draw=values['u'];index=math.floor(draw*len(legal))
        previous=next(e for e in reversed(events[:position]) if e.get('parentId')==event.get('parentId') and e['phase'] in ['随机模拟','扩展','树内选择'])
        previous_board=nodes[state['selectedNode']]['board'] if previous['phase']=='树内选择' else recorded_board(previous)
        assert previous_board==before and legal[index]==move and len(legal)==values['合法动作数']
        c.update(board=before,child=after,move=move,legal=legal,draw=draw,index=index,turn=after[move]);return c
    if phase=='回传记账':
        path=[int(re.search(r'\d+',name).group()) for name in event['scene']['rowLabels']];reward=calc['result'];rows=[]
        assert path[-1]==0 and len(path)==values['回传节点数']
        for i,node in enumerate(path):
            info=nodes[node];oldn=state.get('N'+str(node),0);oldw=state.get('W'+str(node),0);newn,neww=event['scene']['matrix'][i]
            assert newn==oldn+1 and math.isclose(neww,oldw+reward)
            if i+1<len(path):assert info['parent']==path[i+1]
            rows.append(dict(node=node,board=info['board'],move=info['move'],oldn=oldn,oldw=oldw,newn=newn,neww=neww))
        assert reward==(0.5 if values['结果']=='draw' else 1 if values['结果']==player else 0)
        c.update(rows=rows,reward=reward,outcome=values['结果']);return c
    if phase in ['树内选择','预算结束']:
        board=recorded_board(event) if phase=='树内选择' else root;node=state.get('selectedNode',0) if phase=='树内选择' else 0
        assert nodes[node]['board']==board
        turn='X' if board.count('X')==board.count('O') else 'O';rows=[];parentn=state.get('N'+str(node),0)
        children=[(nid,n) for nid,n in nodes.items() if n['parent']==node]
        for candidate,(nid,info) in zip(event['candidates'],children):
            move=int(re.search(r'第(\d+)格',candidate['target']).group(1))-1;v=candidate['values'];N=state['N'+str(nid)];W=state.get('W'+str(nid),0);mean=W/N
            assert move==info['move'] and N==v['访问']
            row=dict(move=move,node=nid,board=info['board'],N=N,W=W,rootmean=mean,chosen=candidate['status']=='chosen')
            if phase=='树内选择':
                exploitation=mean if turn==player else 1-mean;bonus=values['探索系数']*math.sqrt(math.log(parentn+1)/N);score=exploitation+bonus
                assert math.isclose(exploitation,v['平均得分']) and math.isclose(score,v['选择分'])
                row.update(exploitation=exploitation,bonus=bonus,score=score)
            else:assert math.isclose(mean,v['平均得分'])
            rows.append(row)
        assert len(rows)==len(event['candidates'])
        key='score' if phase=='树内选择' else 'N';best=max(r[key] for r in rows);chosen=next(r for r in rows if r[key]==best);assert chosen['chosen']
        c.update(board=board,turn=turn,rows=rows,parentn=parentn,node=node,chosen=chosen)
        return c
    raise ValueError('Unrecognized MCTS phase '+phase)


def _game_number(value):
    return str(int(value)) if float(value).is_integer() else f'{value:.3f}'.rstrip('0').rstrip('.')


def mcts_visual(event,run,show_after):
    c=mcts_context(event,run,show_after);phase=c['phase'];out=VGroup()
    if phase in ['模拟轮初始化','初始终局']:
        out.add(label('从根开始第 '+str(c['iteration'])+' 次模拟' if c['iteration'] else '初始棋盘已经终局',0,1.93,24,GOLD),board_visual(c['board'],-2.15,.2,2.1,key='mcts-root'))
        out.add(label('根玩家 '+c['player'],1.45,1.1,25,TEAL,3.5),label('已完成访问 '+str(c['N']),1.45,.5,23,INK,3.5),label('累计得分 '+_game_number(c['W']),1.45,-.05,23,INK,3.5),label('选择 → 扩展 → 模拟 → 回传',0,-1.65,23,MUTED));return out
    if phase in ['扩展','随机模拟']:
        title='只扩展一个未试动作' if phase=='扩展' else '从合法动作随机走一手'
        out.add(label(title,0,1.93,24,GOLD),board_visual(c['board'],-2.15,.62,1.5,key='mcts-before'),board_visual(c['child'],2.15,.62,1.5,c['move'],key='mcts-child'))
        out.add(label('落子前',-2.15,1.58,20,MUTED),label('本步落子后',2.15,1.58,20,TEAL),Arrow([-.95,.62,0],[.95,.62,0],buff=.06,color=TEAL,tip_length=.12),label('第'+str(c['move']+1)+'格',0,.97,21,TEAL))
        n=len(c['legal']);spacing=min(.92,6.2/n)
        for i,move in enumerate(c['legal']):
            x=(i-(n-1)/2)*spacing;col=TEAL if i==c['index'] else MUTED
            out.add(Square(.62,stroke_color=col,stroke_width=2,fill_color=TEAL if i==c['index'] else RULE,fill_opacity=.12).move_to([x,-.75,0]),label(move+1,x,-.75,23,col,.55),label('索引'+str(i),x,-1.24,17,col,spacing*.95))
        out.add(label('floor('+_game_number(c['draw'])+' × '+str(n)+') = '+str(c['index'])+' → 第'+str(c['move']+1)+'格',0,-1.83,22,TEAL))
        out._projection_phase='左：落子前 · 右：本步落子后'
        return out
    if phase=='回传记账':
        outcome_name='和局' if c['outcome']=='draw' else c['outcome']+' 胜'
        out.add(label('样本 '+outcome_name+'：根玩家 '+c['player']+' 得 '+_game_number(c['reward']),0,1.93,23,GOLD))
        rows=c['rows'];gap=min(.89,2.9/max(1,len(rows)-1))
        out.add(label('访问 N',-.1,1.46,20,MUTED),label('累计 W',2.25,1.46,20,MUTED))
        for i,row in enumerate(rows):
            y=1-i*gap;out.add(board_visual(row['board'],-2.8,y,.66,key='backup'+str(row['node'])),label('根 0' if row['node']==0 else '节点 '+str(row['node']),-1.75,y,18,TEAL,1.2))
            ntext=f"{row['oldn']} + 1 = {row['newn']}" if show_after else str(row['oldn'])+' → 待加 1'
            wtext=f"{_game_number(row['oldw'])} + {_game_number(c['reward'])} = {_game_number(row['neww'])}" if show_after else _game_number(row['oldw'])+' → 待加 '+_game_number(c['reward'])
            out.add(label(ntext,-.1,y,22,TEAL,2.2),label(wtext,2.25,y,22,TEAL,2.45))
            if i+1<len(rows):out.add(Arrow([-2.8,y-.34,0],[-2.8,y-gap+.34,0],buff=.01,tip_length=.07,color=TEAL,stroke_width=2))
        out.add(label('只更新这一条真实祖先路径；根玩家视角不翻转',0,-1.92,20,MUTED));return out
    if phase=='树内选择':
        out.add(label('轮到 '+c['turn']+'：均值部分 + 探索奖励',0,1.93,24,GOLD))
        perspective='根玩家直接用根均值' if c['turn']==c['player'] else '对手用 1 − 根均值'
        out.add(label('父访问 '+str(c['parentn'])+' · '+perspective+' · 同分取较早插入',0,1.5,19,MUTED))
        out.add(label('格号',-3.15,1.04,17,MUTED,.7),label('根均值 / 次数',-1.96,1.04,17,MUTED,1.65),label('均值部分',-.38,1.04,17,TEAL,1.2),label('探索奖励',1.05,1.04,17,GOLD,1.3),label('总分',2.43,1.04,17,INK,.8))
        scale=2.85/max(r['score'] for r in c['rows'])
        for j,row in enumerate(c['rows']):
            y=.62-j*.52;sel=row['chosen'] and show_after;col=TEAL if sel else MUTED
            out.add(label(row['move']+1,-3.15,y,22,col,.7),label(_game_number(row['rootmean'])+' / '+str(row['N']),-1.96,y,19,INK,1.5),label(_game_number(row['score']),2.52,y,20,col,.96),label('选' if sel else '',3.24,y,18,TEAL,.45))
            x=-.85;a=row['exploitation']*scale;b=row['bonus']*scale
            if a>0:out.add(Rectangle(width=a,height=.19,fill_color=TEAL,fill_opacity=.8,stroke_width=0).move_to([x+a/2,y-.16,0]))
            out.add(Rectangle(width=b,height=.19,fill_color=GOLD,fill_opacity=.7,stroke_width=0).move_to([x+a+b/2,y-.16,0]),label(_game_number(row['exploitation'])+' + '+_game_number(row['bonus']),.57,y+.06,18,INK,2.9))
        out.add(label('绿色与橙色相加用于下一次试走；总分不是概率',0,-1.92,19,MUTED));return out
    if phase=='预算结束':
        out.add(label('预算用完：按访问次数推荐第一步',0,1.93,24,GOLD),label('根访问 '+str(c['parentn'])+' 次；这一页不使用探索奖励',0,1.48,20,MUTED))
        maximum=max(r['N'] for r in c['rows'])
        for j,row in enumerate(c['rows']):
            y=.86-j*.55;sel=row['chosen'] and show_after;col=TEAL if sel else MUTED;width=3.6*row['N']/maximum
            out.add(label('第'+str(row['move']+1)+'格',-2.85,y,21,col,1.2),Rectangle(width=width,height=.25,fill_color=col,fill_opacity=.7,stroke_width=0).move_to([-1.85+width/2,y,0]),label(str(row['N'])+' 次',2.3,y,22,col,1.1),label('推荐' if sel else '',3.22,y,18,TEAL,.7))
        out.add(label('样本均值 '+_game_number(c['chosen']['rootmean'])+' 是统计记录，不是必胜证明',0,-1.92,20,MUTED));return out
    return None

