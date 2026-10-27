"""Read-only visual projections of recorded image/signal teaching events.

No filtering, FFT, optimization or random sampling is rerun here. Numbers come
from trace operands, recorded changes or scene rows. Display arithmetic converts
recorded normalized weights, candidate differences and geometric projections;
it does not choose a new model, candidate, path or frequency result.
"""
import math
import numpy as np
from manim import Group, VGroup, Rectangle, RoundedRectangle, Line, Arrow, Dot, ImageMobject
from visuals import text, TEAL, GOLD, INK, MUTED, RED, RULE, PANEL, scene_visual
from film_contract import event_scene

BLUE = '#90B3FF'


def _change(event, key, default=None):
    return next((c['after'] for c in event.get('changes', []) if c['target'] == key), default)


def _recorded(event, run, key):
    # Read the most recent explicit value; never copy the whole growing state.
    for previous in reversed(run['trace']['events'][:int(event['id']) + 1]):
        found = next((c for c in previous.get('changes', []) if c['target'] == key), None)
        if found is not None:
            return found['after']
    return run['trace']['initialState'].get(key)


def _fmt(value, places=3):
    if abs(value) < 1e-9:
        return '≈0' if value else '0'
    return f'{value:.{places}f}'.rstrip('0').rstrip('.')


def _complex(pair):
    real, imag = pair
    if abs(imag) < 1e-9:
        return _fmt(real)
    if abs(real) < 1e-9:
        return _fmt(imag) + 'i'
    return _fmt(real) + ('+' if imag >= 0 else '') + _fmt(imag) + 'i'


def _matrix(values, title, x=0, y=0, chosen=None, key='matrix', width=2.15, places=3, ranks=False):
    n = round(math.sqrt(len(values)))
    cell = width / n
    g = Group(text(title, 19, MUTED, width=width + .15).move_to([x, y + width/2 + .3, 0]))
    for i, value in enumerate(values):
        center = [x + (i % n - (n-1)/2)*cell, y + ((n-1)/2 - i//n)*cell, 0]
        color = GOLD if i == chosen else TEAL if value >= 0 else RED
        box = Rectangle(width=cell-.035, height=cell-.035, stroke_color=color if i == chosen else RULE,
                        fill_color=PANEL, fill_opacity=1, stroke_width=2 if i == chosen else 1).move_to(center)
        box._motion_key = f'{key}:cell:{i}'
        label = text(_fmt(value, places), 18 if n <= 3 else 14, color, width=cell-.1).move_to(center)
        label._motion_key = f'label:{key}:{i}'
        g.add(box, label)
        if ranks:
            g.add(text(str(i+1), 11, MUTED).move_to(np.array(center)+[-cell*.34,cell*.34,0]))
    return g


def _card(title, value, position, color=TEAL, width=2.05):
    box=RoundedRectangle(width=width,height=.82,corner_radius=.09,stroke_color=color,fill_color=PANEL,fill_opacity=1).move_to(position)
    label=text(title,17,MUTED,width=width-.13).move_to(np.array(position)+[0,.22,0])
    number=text(value,24,color,width=width-.14).move_to(np.array(position)+[0,-.15,0])
    return Group(box,label,number)


def _filter(event, run):
    algorithm=run['trace']['algorithmId'];rule=event['ruleId'];v=event.get('calculation',{}).get('values',{})
    if algorithm=='gaussian-filter' and rule=='gaussian-filter-rule':
        kernel=_change(event,'kernel');size=round(math.sqrt(len(kernel)))
        normalized_total=event['calculation']['result']
        return Group(_matrix(kernel,f'归一化权重（{size}×{size}）',-1.7,.12,width=2.65,chosen=len(kernel)//2,places=4,key='normalized-kernel'),
                     _card(f'{len(kernel)}项归一化权重之和',_fmt(normalized_total),[1.95,.85,0],GOLD,width=2.8),
                     _card('归一化前的权重之和',_fmt(v['权重总和'],4),[1.95,-.35,0],TEAL,width=2.8),
                     text('单格是一个份额；相加才得到权重总和',21,MUTED,width=7.2).move_to([0,-1.75,0]))
    if algorithm=='sobel' and rule=='sobel-rule':
        kernels=_change(event,'kernel')
        return Group(_matrix(kernels[0],'横向核：右 − 左',-1.85,.1),_matrix(kernels[1],'纵向核：下 − 上',1.85,.1),
                     text('中间行 / 列权重为2；不是把模板拉成一条长数组',19,MUTED,width=7.2).move_to([0,-1.75,0]))
    window=_change(event,'window')
    if not window:
        return None
    if algorithm=='median-filter':
        ordered=_change(event,'sortedWindow')
        if not ordered:return None
        middle=len(ordered)//2
        return Group(_matrix(window,'原图窗口（空间位置）',-2.12,.25,chosen=middle,key='source'),
                     _matrix(ordered,f'升序，按行读第1—{len(ordered)}项',2.12,.25,chosen=middle,key='ordered',ranks=True),
                     Arrow([- .65,.25,0],[.65,.25,0],color=BLUE,buff=.05),
                     text(f'第{middle+1}项 = {_fmt(ordered[middle])}；两边各{middle}项，不做平均',23,GOLD,width=7.2).move_to([0,-1.4,0]),
                     text('橙框：待替换的中心 / 排序后的中间位置',17,MUTED,width=7.2).move_to([0,-1.9,0]))
    if algorithm=='gaussian-filter':
        terms=_change(event,'weightedTerms');kernel=_recorded(event,run,'kernel')
        total=v['权重和'];raw=[w*total for w in kernel]
        return Group(_matrix(window,'原图亮度',-2.55,.35,width=1.9,chosen=len(window)//2,places=2,key='source'),
                     _matrix(raw,'原始权重（未归一化）',0,.35,width=1.9,key='weights'),
                     _matrix(terms,'对应位置的乘积',2.55,.35,width=1.9,places=2,key='products'),
                     text('×',28,GOLD).move_to([-1.27,.35,0]),text('=',28,GOLD).move_to([1.27,.35,0]),
                     text(f'乘积和 {_fmt(v["加权和"])} ÷ 权重和 {_fmt(total,4)} = {_fmt(event["calculation"]["result"],4)}',22,GOLD,width=7.4).move_to([0,-1.35,0]),
                     text('格内为显示近似值；求和使用原记录完整精度',16,MUTED,width=7.2).move_to([0,-1.83,0]))
    if algorithm=='sobel':
        xp=_change(event,'xProducts');yp=_change(event,'yProducts')
        return Group(_matrix(window,'原图亮度',-2.55,.35,width=1.9,places=2,key='source'),
                     _matrix(xp,'乘横向核后的9项',0,.35,width=1.9,places=2,key='x-products'),
                     _matrix(yp,'乘纵向核后的9项',2.55,.35,width=1.9,places=2,key='y-products'),
                     text(f'Gx = {_fmt(v["Gx"])}       Gy = {_fmt(v["Gy"])}',23,TEAL,width=7.2).move_to([0,-1.27,0]),
                     text(f'合成幅值 {_fmt(v["幅值"])}  '+('≥' if v['幅值']>=v['阈值'] else '<')+f'  阈值 {v["阈值"]}',23,GOLD,width=7.2).move_to([0,-1.82,0]))
    return None


def _fft(event,run):
    rule=event['ruleId'];v=event.get('calculation',{}).get('values',{})
    if rule=='fft-split':
        n=v['当前长度'];sequence=_recorded(event,run,'subRe');g=Group()
        for y, parity, color, title in [(1,0,TEAL,'本子序列偶索引'),(-.6,1,GOLD,'本子序列奇索引')]:
            g.add(text(f'{title} · 共{n//2}个',22,color,width=7.2).move_to([0,y+.55,0]))
            indices=list(range(parity,n,2));shown=indices[:6]
            for j,index in enumerate(shown):
                x=(j-(len(shown)-1)/2)*1.15
                g.add(_card(f'索引 {index}',_fmt(sequence[index]),[x,y-.1,0],color,width=1.05))
            if len(indices)>len(shown):g.add(text('这里只列前6项；其余同奇偶规则分组',16,MUTED).move_to([0,y-.76,0]))
        return g
    if rule=='fft-butterfly':
        scene=event_scene(event,run)
        matrix=scene['matrix'];E,O,T,plus,minus=matrix[:5]
        g=Group(_card('偶分支 E',_complex(E),[-2.65,1.25,0]),_card('奇分支 O',_complex(O),[-2.65,-.15,0]),
                _card('旋转后 T',_complex(T),[0,-.15,0],GOLD),
                _card('E + T',_complex(plus),[2.65,1.25,0],TEAL),_card('E − T',_complex(minus),[2.65,-.15,0],BLUE))
        g.add(Arrow([-1.6,-.15,0],[-1.05,-.15,0],buff=.04,color=GOLD),
              text('乘旋转因子',16,GOLD).move_to([-1.33,-.75,0]),
              text('W = '+_complex([v['cosθ'],v['sinθ']]),22,GOLD).move_to([0,-1.15,0]),
              Line([-1.62,1.25,0],[1.60,1.25,0],color=TEAL),
              Arrow([1.03,-.15,0],[1.63,1.25,0],color=GOLD,buff=.04),
              Arrow([1.03,-.15,0],[1.63,-.15,0],color=BLUE,buff=.04),
              Line([-1.62,1.15,0],[1.63,-.05,0],color=TEAL,stroke_opacity=.5),
              text('同一份 T 被复用：一次相加、一次相减',21,MUTED,width=7.2).move_to([0,-1.85,0]))
        return g
    if rule=='fft-spectrum':
        amps=_change(event,'amplitudes');n=v['N'];rate=v['Fs'];count=len(amps);maxamp=max(amps) or 1
        g=Group(Line([-3.55,-1.45,0],[3.55,-1.45,0],color=RULE))
        peaks=sorted(range(1,count),key=lambda i:amps[i],reverse=True)[:2]
        for i,a in enumerate(amps):
            x=-3.5+7*i/(count-1);h=max(.008,2.5*a/maxamp)
            bar=Rectangle(width=.075,height=h,stroke_width=0,fill_opacity=1,fill_color=GOLD if i in peaks else TEAL).move_to([x,-1.45+h/2,0]);bar._motion_key=f'frequency:{i}'
            g.add(bar)
        for k in sorted({0,count-1,count//2,*peaks}):
            x=-3.5+7*k/(count-1);g.add(text(_fmt(k*rate/n)+'Hz',15,MUTED).move_to([x,-1.73,0]))
        for k in peaks:
            x=-3.5+7*k/(count-1);g.add(text(_fmt(amps[k]),21,GOLD).move_to([x,2.5*amps[k]/maxamp-1.15,0]))
        g.add(text('实算单边幅度；直流不翻倍',22,TEAL,width=7.2).move_to([0,1.8,0]))
        return g
    return None


def _seam(event,run,snapshot):
    if event['ruleId']=='seam-backtrack' and event.get('candidates'):
        candidates=event['candidates'];values=[c['values']['累计代价'] for c in candidates]
        selected=next(i for i,c in enumerate(candidates) if c['status']=='chosen')
        other=next((i for i in range(len(values)-1,-1,-1) if i!=selected and values[i]==values[selected]),len(values)-1)
        g=Group(text('底行全部候选 · 列号从0开始',22,TEAL,width=7.3).move_to([0,1.85,0]))
        spacing=7.1/len(values);scale=1.55/max(1,max(values))
        for i,value in enumerate(values):
            x=-3.55+(i+.5)*spacing;height=max(.025,value*scale)
            g.add(Rectangle(width=spacing*.72,height=height,stroke_width=0,fill_color=GOLD if i==selected else TEAL,fill_opacity=.9).move_to([x,-.25+height/2,0]))
            if i in {0,len(values)//2,len(values)-1}:
                g.add(text(str(i),17,MUTED).move_to([x,-.47,0]))
        g.add(_card(candidates[selected]['target'],_fmt(values[selected],5),[-1.9,-1.1,0],GOLD,width=3.35),
              _card(candidates[other]['target'],_fmt(values[other],5),[1.9,-1.1,0],BLUE,width=3.35))
        note='两者精确同分，按较小列号选回溯起点' if values[other]==values[selected] else '按真实累计代价选最小值；精确同分取较小列号'
        g.add(text(note,18,MUTED,width=7.3).move_to([0,-1.9,0]))
        return g
    if event['ruleId']=='seam-backtrack':
        # Show this recorded backtrack position while its predecessor is explained.
        return scene_visual(event_scene(event,run),7.6,4.25)
    if event['ruleId']=='seam-energy':
        pixels=_recorded(event,run,'pixels');width=_recorded(event,run,'width');height=_recorded(event,run,'height')
        window=[pixels[min(height-1,max(0,dy))*width+min(width-1,max(0,dx))] for dy in [-1,0,1] for dx in [-1,0,1]]
        g=Group(_matrix(window,'首像素的原图邻域：边界夹取',-1.9,.1,chosen=4,width=2.5,places=2,key='source'))
        g.add(text(f'左右差  |{_fmt(window[5])} − {_fmt(window[3])}|',24,TEAL,width=3.8).move_to([1.9,.8,0]),
              text(f'上下差  |{_fmt(window[7])} − {_fmt(window[1])}|',24,BLUE,width=3.8).move_to([1.9,.05,0]),
              text(f'两项相加 = {_fmt(event["calculation"]["result"])}',25,GOLD,width=3.8).move_to([1.9,-.75,0]),
              text('示例只讲首像素；其余位置使用同一梯度规则',17,MUTED,width=7.3).move_to([0,-1.85,0]))
        return g
    if event['ruleId']=='seam-remove':
        change=next(c for c in event['changes'] if c['target']=='pixels');v=event['calculation']['values'];oldw=v['旧宽度'];h=v['高度'];neww=event['calculation']['result']
        def picture(values,w):
            gray=np.clip(np.array(values).reshape(h,w),0,255).astype(np.uint8)
            rgba=np.stack([gray,gray,gray,np.full_like(gray,255)],axis=-1)
            image=ImageMobject(rgba);image.width=3.1*w/oldw;return image
        before=picture(change['before'],oldw).move_to([-2.15,.1,0]);after=picture(change['after'],neww).move_to([2.15,.1,0])
        return Group(before,after,Arrow([-.5,.1,0],[.5,.1,0],buff=.04,color=GOLD),
                     text(f'删除前 {oldw}×{h}',22,MUTED).move_to([-2.15,1.65,0]),text(f'删除后 {neww}×{h}',22,TEAL).move_to([2.15,1.65,0]),
                     text(f'同一像素比例 · 每行删1个 · 共删{h}个',20,GOLD,width=7.2).move_to([0,-1.6,0]))
    if event['ruleId']!='seam-dp':return None
    v=event['calculation']['values'];candidates=event.get('candidates',[])
    if not candidates:return None
    best=min(c['values']['累计代价'] for c in candidates);g=Group()
    for i,c in enumerate(candidates):
        x=(i-(len(candidates)-1)/2)*2.5;cost=c['values']['累计代价'];chosen=c['status']=='chosen';color=GOLD if chosen else BLUE
        g.add(_card(c['target'],_fmt(cost,5),[x,1.25,0],color,width=2.25))
        delta=cost-best
        note='选中：实际代价最小' if chosen else f'比最小值多 {delta:.2e}' if delta else '精确同分，顺序靠后'
        g.add(text(note,15,color,width=2.3).move_to([x,.55,0]),Arrow([x,.26,0],[0,-.45,0],color=color,buff=.08))
    g.add(_card(f'本格能量 {_fmt(v["本格能量"])} + 最小前驱',_fmt(event['calculation']['result'],5),[0,-.95,0],TEAL,width=4.6),
          text('上排为累计代价；显示值近似相等不代表精确同分',18,MUTED,width=7.4).move_to([0,-1.85,0]))
    return g


def _otsu(event,run):
    if event['ruleId']=='otsu-apply':
        # Explain this recorded application, including its actual before/after
        # image, rather than falling back to the previous threshold histogram.
        return scene_visual(event_scene(event,run),7.6,4.25)
    v=event.get('calculation',{}).get('values',{})
    if '暗组数' not in v:return None
    threshold=_recorded(event,run,'threshold');best=_recorded(event,run,'bestThreshold')
    hist=run['trace']['initialState']['histogram'];peak=max(hist) or 1;g=Group()
    for i,count in enumerate(hist):
        x=-3.5+7*i/255;h=max(.006,2*count/peak)
        bar=Rectangle(width=.025,height=h,stroke_width=0,fill_opacity=1,fill_color=TEAL if i<=threshold else GOLD).move_to([x,-1.48+h/2,0]);bar._motion_key=f'brightness:{i}';g.add(bar)
    x=-3.5+7*threshold/255
    boundary=Line([x,-1.5,0],[x,.65,0],color=BLUE,stroke_width=3);boundary._motion_key='threshold';g.add(boundary)
    for i in [0,64,128,192,255]:g.add(text(str(i),14,MUTED).move_to([-3.5+7*i/255,-1.73,0]))
    for x,key,color in [(-1.9,'暗',TEAL),(1.9,'亮',GOLD)]:
        count=v[f'{key}组数'];mean=_fmt(v[f'{key}组均值']) if count else '无均值（空组）'
        g.add(_card(f'{key}组 {count}个',f'均值 {mean}' if count else mean,[x,1.35,0],color,width=3.5))
    best_note='尚无有效候选' if _recorded(event,run,'bestScore')<0 else f'最好阈值 {best}'
    g.add(text(f'当前阈值 {threshold} · {best_note} · 每柱一种真实亮度',17,MUTED,width=7.3).move_to([0,-2.12,0]))
    return g


def _ransac(event,run):
    if event['ruleId'] not in {'ransac-sample','ransac-consensus'}:return None
    points=[{'x':p[0],'y':p[1]} if isinstance(p,list) else p for p in run['trace']['initialState']['points']];model=_recorded(event,run,'candidateModel')
    if not model:return None
    a,b=model;sample=set(_recorded(event,run,'sample') or []);inliers=set(_recorded(event,run,'inliers') or [])
    is_vote=event['ruleId']=='ransac-consensus'
    def pos(x,y):return np.array([-3.4+.035*x,-1.65+.035*y,0])
    g=Group(Line(pos(0,0),pos(100,0),color=RULE),Line(pos(0,0),pos(0,100),color=RULE))
    intersections=[]
    for x,y in [(0,b),(100,100*a+b)]+([] if abs(a)<1e-12 else [(-b/a,0),((100-b)/a,100)]):
        if 0<=x<=100 and 0<=y<=100 and (x,y) not in intersections:intersections.append((x,y))
    if len(intersections)>=2:
        line=Line(pos(*intersections[0]),pos(*intersections[1]),color=GOLD,stroke_width=2);line._motion_key='candidate-line';g.add(line)
    for i,p in enumerate(points):
        # Sampling precedes voting: do not reuse the previous candidate's support colors.
        color=(TEAL if i in inliers else RED) if is_vote else (GOLD if i in sample else BLUE)
        point=Dot(pos(p['x'],p['y']),radius=.04 if i in sample else .025,color=color);point._motion_key=f'point:{i}';g.add(point)
    if is_vote:
        distances=_change(event,'distances');tolerance=event['calculation']['values']['容差']
        for i in [0,1]:
            p=points[i];d=(a*p['x']-p['y']+b)/(a*a+1);foot=pos(p['x']-a*d,p['y']+d);color=TEAL if i in inliers else RED
            g.add(Line(pos(p['x'],p['y']),foot,color=color,stroke_width=2),text(str(i+1),16,color).move_to(pos(p['x'],p['y'])+[.13,.15,0]),
                  _card(f'点{i+1}到线的垂距',_fmt(distances[i])+(' ≤ ' if i in inliers else ' > ')+str(tolerance),[2.0,.9-i*1.25,0],color,width=3.0))
    else:
        chosen=list(_recorded(event,run,'sample'))
        for j,i in enumerate(chosen):
            p=points[i];g.add(text(str(i+1),17,GOLD).move_to(pos(p['x'],p['y'])+[.15,.15,0]),_card(f'抽中点 {i+1}',f'({_fmt(p["x"],2)}, {_fmt(p["y"],2)})',[2,.9-j*1.25,0],GOLD,width=3.0))
    legend='青：支持候选线 · 红：超出容差' if is_vote else '橙：本次抽中 · 蓝：其余点尚未投票'
    g.add(text('横纵同尺度 · '+legend,17,MUTED,width=7.2).move_to([0,2.08,0]),
          text(f'候选线 y = {_fmt(a,4)}x + {_fmt(b,4)}',19,MUTED,width=7.1).move_to([0,-1.97,0]))
    return g


def signal_principle_visual(event,run,snapshot,show_after):
    """Return a specialized left panel, or None to retain the general scene.

    These panels intentionally juxtapose this step's recorded operands and
    derivation. They are not a claim that the output existed in the previous
    algorithm state. Hosts should use ``_projection_phase`` for the state footer
    instead of labeling such a panel simply "execution before".
    """
    aid=run['trace']['algorithmId']
    if aid in {'gaussian-filter','median-filter','sobel'}:panel=_filter(event,run)
    elif aid=='fft':panel=_fft(event,run)
    elif aid=='seam-carving':panel=_seam(event,run,snapshot)
    elif aid=='otsu':panel=_otsu(event,run)
    elif aid=='ransac':panel=_ransac(event,run)
    else:panel=None
    if panel is not None:
        panel._projection_phase='本步计算依据与推导（并列展示）'
    return panel
