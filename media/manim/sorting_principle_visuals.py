"""Sorting/stream diagrams reconstructed exclusively from the exported trace.

No algorithm is rerun here. Merge interval bounds are parsed from recorded divide
events; temporary queues are copies of the recorded array at merge entry. Reads
advance only when a recorded write follows a recorded left/right choice. Equal
values have no fabricated identity labels. Heap boundaries come from recorded
range-shrink events. Unsupported trace shapes fail loudly instead of inventing a
plausible animation.
"""
import math
import re
from manim import *
from visuals import text, TEAL, GOLD, MUTED, RULE, INK, PANEL
from principle_visuals import recorded_state


def _label(value, xy, size=19, color=INK, width=None, key=None):
    obj = text(str(value), size, color, width=width).move_to([*xy, 0])
    if key is not None:
        obj._motion_key = 'label:' + key
    return obj


def _cell(value, xy, width=.7, color=TEAL, dim=False, key=''):
    box = RoundedRectangle(width=width, height=.48, corner_radius=.07,
                           stroke_color=color, stroke_width=1.4,
                           fill_color=PANEL if dim else color,
                           fill_opacity=1 if dim else .18).move_to([*xy, 0])
    box._motion_key = 'cell:' + key
    return VGroup(box, _label(value, xy, 21, MUTED if dim else INK,
                             width=width-.09, key=key))


def merge_context(event, run, show_after=True):
    """Return audited merge buffers/cursors, without sorting the input again."""
    array = list(run['trace']['initialState']['array'])
    pending, divisions = [], []
    current = None
    limit = int(event['id']) + 1
    for index, item in enumerate(run['trace']['events'][:limit]):
        include = index < limit-1 or show_after
        if item['phase'] == 'divide':
            match = re.search(r'半开区间\[(\d+),(\d+)\)', item['explanation'])
            if not match:
                raise ValueError('Merge interval not recorded: ' + item['id'])
            lo, hi = map(int, match.groups())
            divisions.append((lo, hi, list(array[lo:hi])))
            if hi-lo > 1:
                pending.append((lo, hi))
            current = None
        elif item['phase'] == 'compare':
            if current is None or len(current['output']) == current['hi']-current['lo']:
                if not pending:
                    raise ValueError('Merge has no recorded parent interval')
                lo, hi = pending.pop()
                mid = (lo+hi)//2
                current = dict(lo=lo, hi=hi, mid=mid, left=array[lo:mid],
                               right=array[mid:hi], li=0, ri=0, output=[])
            operands = item['calculation']['values']
            for name, pointer in [('left', 'li'), ('right', 'ri')]:
                head = current[name][current[pointer]] if current[pointer] < len(current[name]) else '空'
                if head != operands[name]:
                    raise ValueError(f'Merge recorded head mismatch at {item["id"]}: {head} != {operands[name]}')
            current['choice'] = item['calculation']['result']
        elif item['phase'] == 'move' and include:
            if current is None or current.get('choice') not in ('左', '右'):
                raise ValueError('Merge write lacks recorded choice')
            name, pointer = ('left', 'li') if current['choice'] == '左' else ('right', 'ri')
            selected = current[name][current[pointer]]
            current['output'].append(selected)
            current[pointer] += 1
        if include:
            for change in item['changes']:
                if change['target'] == 'array':
                    array = list(change['after'])
        if item['phase'] == 'move' and include:
            offset = current['lo'] + len(current['output']) - 1
            if array[offset] != current['output'][-1]:
                raise ValueError('Merge output differs from recorded write')
    return array, current, divisions


def _merge_visual(event, run, snapshot, show_after):
    array, ctx, divisions = merge_context(event, run, show_after)
    result = VGroup()
    if event['phase'] in ('initialize', 'divide'):
        result.add(_label('拆分区间；单项已经有序', (0, 1.9), 22, GOLD, 7.4))
        n = len(array)
        if not divisions:
            divisions = [(0, n, list(array))]
        positions = {}
        for lo, hi, values in divisions:
            parents = [(a,b) for a,b in positions if a <= lo and hi <= b and (a,b)!=(lo,hi)]
            parent = min(parents, key=lambda p:p[1]-p[0]) if parents else None
            depth = positions[parent][2]+1 if parent else 0
            x = ((lo+hi)/2/n-.5)*7
            y = 1.2-depth*.83
            positions[(lo,hi)] = (x,y,depth)
            if parent:
                px,py,_ = positions[parent]
                result.add(Line([px,py-.21,0],[x,y+.21,0],color=RULE,stroke_width=2))
            label = ', '.join(map(str,values))
            color = GOLD if (lo,hi) == divisions[-1][:2] else TEAL
            cell = _cell(label,(x,y), min(3.0,max(.62,(hi-lo)/n*6.3)),color,key=f'range-{lo}-{hi}')
            result.add(cell, _label(f'[{lo},{hi})',(x,y-.34),13,MUTED,key=f'range-index-{lo}-{hi}'))
        result.add(_label('连线表示拆分关系；尚未执行的分支不会提前画出',(0,-2.0),16,MUTED,7.4))
        return result
    if ctx is None:
        return None
    result.add(_label(f'合并 [{ctx["lo"]},{ctx["mid"]}) 与 [{ctx["mid"]},{ctx["hi"]})',
                      (0,1.95),22,GOLD,7.4))
    for name, pointer, y, label, color in [('left','li',1.13,'左缓存',TEAL),('right','ri',.22,'右缓存',GOLD)]:
        result.add(_label(label,(-3.14,y),19,color,1.05))
        values = ctx[name];step=min(.95,5.9/max(1,len(values)))
        for j,value in enumerate(values):
            x=-2.25+j*step
            result.add(_cell(value,(x,y),step*.86,color,j<ctx[pointer],key=f'{name}-{j}'))
            if j==ctx[pointer]:
                result.add(_label('队首',(x,y-.39),16,color,width=step*.95,key=name+'-head'))
        if ctx[pointer]>=len(values):
            result.add(_label('空',(-2.25+len(values)*step,y),20,color,width=.55,key=name+'-empty'))
    result.add(_label('已写回',(-3.14,-.8),19,TEAL,1.05))
    count=ctx['hi']-ctx['lo'];step=min(.95,5.9/count)
    for j in range(count):
        result.add(_cell(ctx['output'][j] if j<len(ctx['output']) else '·',(-2.25+j*step,-.8),
                         step*.86,TEAL,j>=len(ctx['output']),key=f'output-{j}'))
    result.add(_label('缓存保留尚未读取的值；灰格已取走',(0,-1.4),17,MUTED,7.4))
    result.add(_label('数组：'+', '.join(map(str,array)),(0,-1.86),20,INK,7.4))
    return result


def heap_context(event,run,show_after=True):
    state=recorded_state(event,run,show_after);size=len(state['array'])
    for item in run['trace']['events'][:int(event['id'])+(1 if show_after else 0)]:
        if item['action']=='缩小待排序范围':
            match=re.search(r'新堆只包含\[0,(\d+)\)',item['explanation'])
            if not match:raise ValueError('Heap boundary not recorded')
            size=int(match.group(1))
        if item['phase']=='stop':size=0
    return state['array'],size


def _heap_visual(event,run,snapshot,show_after):
    array,size=heap_context(event,run,show_after);n=len(array);group=VGroup()
    focus={int(i) for i in event.get('focus',[]) if str(i).isdigit()}
    levels=max(1,math.floor(math.log2(max(1,n)))+1);dy=min(.88,2.3/max(1,levels-1))
    positions={}
    for i in range(n):
        depth=int(math.log2(i+1));slot=i-(2**depth-1)
        positions[i]=(((slot+.5)/2**depth-.5)*6.6,1.25-depth*dy)
    for i in range(1,size):
        parent=(i-1)//2
        group.add(Line([*positions[parent],0],[*positions[i],0],color=RULE,stroke_width=2))
    for i,value in enumerate(array):
        x,y=positions[i];active=i<size;color=GOLD if i in focus and active else TEAL if active else MUTED
        circle=Circle(radius=.27,color=color,stroke_width=2,fill_color=PANEL,fill_opacity=1).move_to([x,y,0]);circle._motion_key=f'heap-node-{i}'
        group.add(circle,_label(value,(x,y),21,color,key=f'heap-value-{i}'),_label('#'+str(i),(x,y-.39),13,MUTED,key=f'heap-index-{i}'))
    group.add(_label('父 i → 孩子 2i+1、2i+2；只连当前堆内的边',(0,1.95),18,MUTED,7.4))
    step=min(.93,6.6/max(1,n));left=-(n-1)*step/2
    for i,value in enumerate(array):
        color=TEAL if i>=size else GOLD if i in focus else MUTED
        group.add(_cell(value,(left+i*step,-1.42),step*.86,color,key=f'heap-array-{i}'))
        group.add(_label('#'+str(i),(left+i*step,-1.8),13,MUTED,key=f'heap-array-index-{i}'))
    group.add(_label(f'堆范围 [0,{size})  ·  青色数组格：已归位',(0,-2.02),17,TEAL,7.4))
    return group


def _reservoir_visual(event,run,snapshot,show_after):
    state=recorded_state(event,run,show_after);calc=event.get('calculation',{}).get('values',{})
    k=run['trace']['events'][0]['calculation']['values']['k'];seen=calc.get('seen',state['seen']);draw=calc.get('j')
    group=VGroup(_label(f'固定 {k} 个槽 · 当前到达 {seen} 号',(0,1.85),23,GOLD,7.4))
    if isinstance(draw,int):
        group.add(_label(f'本次在 0…{seen-1} 中等概率抽签，抽到 j={draw}',(0,1.24),20,INK,7.4))
        step=min(.7,6.6/max(1,seen));left=-(seen-1)*step/2
        for j in range(seen):
            color=GOLD if j==draw else TEAL if j<k else MUTED
            group.add(_cell(j,(left+j*step,.62),step*.86,color,j>=k and j!=draw,key=f'ticket-{j}'))
        group.add(_label(f'签 0…{k-1} 替换同号槽；其余签保留原样',(0,.05),17,MUTED,7.4))
    elif event['phase']=='stop':
        group.add(_label('已读完当前数据流，保留槽内的样本',(0,.75),21,INK,7.4))
    else:group.add(_label('前 k 人先填空槽，不需要抽签',(0,.75),21,INK,7.4))
    for j in range(k):
        x=(j-(k-1)/2)*1.4
        group.add(_cell(state['sample'][j] if j<len(state['sample']) else '空',(x,-.8),1.0,TEAL,key=f'reservoir-{j}'))
        group.add(_label('槽 '+str(j),(x,-1.26),17,MUTED,key=f'reservoir-index-{j}'))
    group.add(_label('槽内数字是人的编号，不是人数或概率',(0,-1.9),18,MUTED,7.4))
    return group


def sorting_principle_visual(event,run,snapshot,show_after=True):
    adapter={'merge-sort':_merge_visual,'heap-sort':_heap_visual,'reservoir':_reservoir_visual}.get(run['trace']['algorithmId'])
    return adapter(event,run,snapshot,show_after) if adapter else None
