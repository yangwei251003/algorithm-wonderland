"""Original Manim presentation of an exported lesson and its immutable trace."""
import json
import math
import os
import bisect
import copy
import numpy as np
import re
from pathlib import Path
from manim import *
from visuals import BG,PANEL,INK,MUTED,TEAL,GOLD,RED,RULE,text,paragraph,display,scene_visual
from film_contract import load_package,event_scene
from principle_visuals import sha_visual,pid_visual,moving_average_visual,search_visual,knn_visual,regression_visual,counting_visual,quicksort_visual,floyd_visual
from graph_principle_visuals import graph_principle_visual
from fast_dissolve import dissolve_pages
from decision_visuals import bandit_visual
from sorting_principle_visuals import sorting_principle_visual
from signal_principle_visuals import signal_principle_visual
from optimization_principle_visuals import optimization_principle_visual
from forecast_principle_visuals import forecast_principle_visual
from learning_principle_visuals import learning_principle_visual,knn_principle_visual,regression_principle_visual
from probability_principle_visuals import probability_principle_visual
from control_principle_visuals import control_principle_visual
from generative_principle_visuals import generative_principle_visual
from robotics_principle_visuals import robotics_principle_visual
from information_principle_visuals import information_principle_visual
from intelligence_principle_visuals import intelligence_principle_visual
from allocation_principle_visuals import allocation_principle_visual
from pid_principle_visuals import pid_principle_visual
from decision_game_principle_visuals import decision_game_principle_visual
from scheduling_principle_visuals import scheduling_principle_visual
from sha_pipeline_principle_visuals import sha_pipeline_principle_visual
from thompson_principle_visuals import thompson_principle_visual
from decision_matrix_principle_visuals import decision_matrix_principle_visual
WAITING_BLUE="#90B3FF"
FIELD_NAMES={"priority":"优先值 f","sequence":"登记序","distance":"已知代价","parent":"前驱","current":"当前","skip":"不带","take":"带上","capacity":"剩余容量","weight":"占用","value":"价值","round":"轮次","target":"目标","point":"样本","count":"数量","mean":"均值","sum":"合计","gain":"增益","error":"误差","time":"时间","index":"编号"}
SHARED_LABELS=json.loads((Path(__file__).resolve().parents[2]/'src/content/teaching-labels.json').read_text(encoding='utf-8'))
def result_name(event,default='得到'):
    if event['ruleId']=='hungarian.adjust' and event.get('calculation',{}).get('values',{}).get('column')==0:return '入口辅助账（非任务）'
    phase_label=SHARED_LABELS.get('phaseResults',{}).get(event['ruleId'],{}).get(event.get('phase'))
    if phase_label:return phase_label
    return SHARED_LABELS.get('results',{}).get(event['ruleId'],default)
def field_name(key,algorithm=None,phase=None):
    if algorithm=='bfs' and key=='g':return '已走步数'
    if algorithm=='bfs' and key=='cost':return '这一步增加'
    if algorithm=='bayes' and key=='falsePositive' and phase=='normalize':return '正常且亮灯的比例'
    if algorithm=='mcts' and key=='u' and phase=='随机模拟':return '随机抽样值'
    return SHARED_LABELS['algorithms'].get(algorithm,{}).get(key,SHARED_LABELS['common'].get(key,FIELD_NAMES.get(key,key)))

def same_visual(a,b):
    """Exact display equality: unchanged objects need no per-frame interpolation."""
    aa=a.get_family();bb=b.get_family()
    if len(aa)!=len(bb):return False
    for left,right in zip(aa,bb):
        if type(left) is not type(right) or not np.array_equal(left.points,right.points):return False
        if isinstance(left,VMobject):
            if not np.array_equal(left.get_fill_rgbas(),right.get_fill_rgbas()) or not np.array_equal(left.get_stroke_rgbas(),right.get_stroke_rgbas()) or not np.array_equal(left.get_stroke_width(),right.get_stroke_width()):return False
    return True

def operation_key(event):
    return (event['ruleId'],event.get('calculation',{}).get('formula',''))

def calculation_values(event,beat):
    values=event.get('calculation',{}).get('values',{})
    keys=beat.get('calculationKeys')
    if keys is None:return list(values.items())
    if any(k not in values for k in keys):raise ValueError(f"{beat['id']}: calculationKeys must name actual recorded operands")
    return [(k,values[k]) for k in keys]

def operands_per_page(beat):
    count=beat.get('operandsPerPage',3)
    if count not in [3,4]:raise ValueError('operandsPerPage supports 3 or 4 readable rows')
    return count

def event_modes(event,beat,seen,sample_count,candidate_count):
    allowed=beat.get('pageModes')
    if allowed==['compact']:return ['compact']
    detailed=operation_key(event) not in seen or sample_count==1 or event['id'] in beat.get('detailEventIds',[]) or bool(allowed)
    modes=['compact']
    if detailed:
        modes=['rule:'+str(i) for i in range(len(explanation_pages(event['explanation'])))]
        if event.get('calculation'):modes.extend('calculation:'+str(i) for i in range(max(1,math.ceil(len(calculation_values(event,beat))/operands_per_page(beat)))))
        modes.extend('comparison:'+str(i) for i in range(candidate_count))
    if allowed:modes=[m for m in modes if m.split(':')[0] in allowed]
    if not modes:raise ValueError(f"{beat['id']} pageModes does not select any available page for event {event['id']}")
    return modes

def replay_representatives(selected,maximum,seen_rules):
    if len(selected)<=maximum:return selected
    indices={round(i*(len(selected)-1)/(maximum-1)) for i in range(maximum)}
    rules=set(seen_rules)
    for i,event in enumerate(selected):
        key=operation_key(event)
        if key not in rules:indices.add(i);rules.add(key)
    return [selected[i] for i in sorted(indices)]

def explanation_pages(value,limit=60):
    pieces=re.findall(r'[^。；，]+[。；，]?',value)
    pages=[];current=''
    for piece in pieces:
        while len(piece)>limit:
            if current:pages.append(current);current=''
            pages.append(piece[:limit]);piece=piece[limit:]
        if len(current)+len(piece)>limit:pages.append(current);current=''
        current+=piece
    if current:pages.append(current)
    return pages or ['']


def allocate_readable_pages(pages,duration,fps):
    """Reserve reading time for every new rule; only thin explicitly repeated states."""
    frames=round(duration*fps)
    detail=[i for i,p in enumerate(pages) if p[1]!='compact']
    compact=[i for i,p in enumerate(pages) if p[1]=='compact']
    minimum=math.ceil(1.5*fps)
    if len(detail)*minimum>frames:
        raise ValueError(f'{len(detail)} first-operation pages require at least {len(detail)*1.5:.2f}s; author an explicit reading hold (available {duration:.2f}s)')
    capacity=max(0,math.floor((frames-len(detail)*minimum)/max(1,math.ceil(fps/8))))
    if len(compact)>capacity:
        retained=[] if capacity==0 else [compact[-1]] if capacity==1 else [compact[round(i*(len(compact)-1)/(capacity-1))] for i in range(capacity)]
        keep=set(detail+retained);pages=[p for i,p in enumerate(pages) if i in keep]
    lower=[minimum if p[1]!='compact' else 1 for p in pages]
    weights=[p[2] for p in pages]
    fixed={};free=set(range(len(pages)))
    while free:
        remaining=frames-sum(fixed.values());total=sum(weights[i] for i in free)
        small={i for i in free if remaining*weights[i]/total<lower[i]}
        if not small:break
        for i in small:fixed[i]=lower[i]
        free-=small
    remaining=frames-sum(fixed.values());total=sum(weights[i] for i in free)
    exact={i:remaining*weights[i]/total for i in free} if free else {}
    counts=[fixed.get(i,math.floor(exact.get(i,0))) for i in range(len(pages))]
    for i in sorted(free,key=lambda i:exact[i]-math.floor(exact[i]),reverse=True)[:frames-sum(counts)]:counts[i]+=1
    return pages,counts


class TraceFilm(Scene):
    def construct(self):
        manifest_path = Path(os.environ["ALGORITHM_FILM_PACKAGE"])
        package = load_package(manifest_path)
        self.package_dir=manifest_path.parent
        audio_dir = Path(os.environ["ALGORITHM_FILM_AUDIO"])
        timing = json.loads((audio_dir/"aligned.json").read_text(encoding="utf-8"))
        by_line = {line["id"]:line for line in timing["lines"]}
        events = {event["id"]:event for event in package["run"]["trace"]["events"]}
        rules = {rule["id"]:rule for rule in package["lesson"]["rules"]}
        self.camera.background_color = BG
        self.header = text(package["algorithm"]["name"],37,width=12.5).move_to([0,3.24,0])
        self.eyebrow = text("算法奇境  /  看懂每一次选择",17,MUTED).move_to([0,3.78,0])
        self.caption_bg = RoundedRectangle(width=13.4,height=.94,corner_radius=.13,fill_color=PANEL,fill_opacity=1,stroke_width=0).move_to([0,-3.35,0])
        self.add(self.header,self.eyebrow,self.caption_bg)
        self.current = None
        self.caption_layer=VGroup()
        self.add(self.caption_layer)
        cues=timing.get("cues",[{"text":line.get("caption",line["text"]),"start":line["start"],"end":line["end"]} for line in timing["lines"]])
        starts=[cue["start"] for cue in cues]
        caption_objects=[paragraph(cue["text"],12.5,24,max_lines=2).move_to([0,-3.35,0]) for cue in cues]
        self._caption_starts=starts;self._caption_objects=caption_objects;self._subtitle_enabled=True
        self.caption_index=-1
        def update_subtitle(layer,dt):
            index=max(0,min(len(cues)-1,bisect.bisect_right(starts,self.time)-1))
            if index!=self.caption_index:
                layer.become(caption_objects[index]);self.caption_index=index
        self.caption_layer.add_updater(update_subtitle)
        seen_rules=set()
        timeline=[]
        for beat in package["beats"]:
            line = by_line[beat["id"]]
            duration = line["end"]-line["start"]
            ids = beat.get('caseEventIds',beat.get("eventIds",[]))
            active_run=beat['_case']['run'] if beat.get('_case') else package['run']
            active_events={e['id']:e for e in active_run['trace']['events']} if beat.get('_case') else events
            active_rules={r['id']:r for r in beat['_case']['lesson']['rules']} if beat.get('_case') else rules
            if beat.get("_case") and not ids:
                case=beat["_case"]
                event=case["run"]["trace"]["events"][-1]
                case_rules={rule["id"]:rule for rule in case["lesson"]["rules"]}
                start=self.time
                self.change(self.event_page(event,case["run"],case_rules,beat,beat.get("caseLabel","另一组输入 · 独立真实计算"),"case",True),.6)
                self.wait_to(line["end"])
                timeline.append({'beat':beat['id'],'mode':'case','eventId':event['id'],'start':start,'end':self.time,'readAt':min(self.time-.03,start+.65)})
            elif ids:
                selected = [active_events[event_id] for event_id in ids]
                maximum=max(2,int(duration*8))
                sampled=replay_representatives(selected,maximum,seen_rules)
                count_label=None
                if len(selected)>1:
                    count_label=f"{'加速复盘' if beat['kind']=='recap' else '本章计算'} · {len(selected)} 步真实记录"
                    count_label+=f" · 回放 {len(sampled)} 个代表状态" if len(sampled)!=len(selected) else f" · {len(sampled)/duration:.1f} 步/秒"
                pages=[]
                for event in sampled:
                    modes=event_modes(event,beat,seen_rules,len(sampled),len(self.comparison_candidates(event,beat)))
                    seen_rules.add(operation_key(event))
                    for n,mode in enumerate(modes):pages.append((event,mode,3 if mode!="compact" else 1,n==len(modes)-1))
                pages,page_frames=allocate_readable_pages(pages,duration,config.frame_rate)
                visible=len({p[0]['id'] for p in pages})
                if len(selected)>1 and visible!=len(selected):count_label=f"{'加速复盘' if beat['kind']=='recap' else '本章计算'} · {len(selected)} 步真实记录 · 回放 {visible} 个代表状态"
                elapsed_frames=0
                for (event,mode,weight,is_last),page_duration in zip(pages,page_frames):
                    start=self.time
                    elapsed_frames+=page_duration
                    visual=self.event_page(event,active_run,active_rules,beat,count_label,mode,is_last)
                    end_frame=round(line["start"]*config.frame_rate)+elapsed_frames
                    available=max(1,end_frame-round(self.time*config.frame_rate))
                    transition_frames=min(max(1,round(min(.6,available/config.frame_rate*.35)*config.frame_rate)),available)
                    self.change(visual,transition_frames/config.frame_rate)
                    if available>transition_frames:self.wait((available-transition_frames)/config.frame_rate)
                    timeline.append({'beat':beat['id'],'mode':mode,'eventId':event['id'],'ruleId':event['ruleId'],'start':start,'end':self.time,'readAt':min(self.time-.01,start+transition_frames/config.frame_rate+(self.time-start-transition_frames/config.frame_rate)/2),**({'caseFile':beat['caseFile']} if beat.get('caseFile') else {})})
            else:
                role="analogy" if beat["kind"]=="analogy" else "summary" if beat["kind"]=="summary" else "rules" if beat["kind"]=="rule" else None
                artwork=beat.get("artwork") or package.get("artwork",{}).get(role)
                panels=[] if beat.get("artworkRegion") else package.get("artworkPanels",{}).get(role)
                if artwork and panels is None:
                    pixels=ImageMobject(str((self.package_dir/artwork).resolve())).get_pixel_array()
                    # Existing project comics use three vertically stacked panels, inspected before production.
                    if pixels.shape[0]/pixels.shape[1]>1.15:panels=[[0,.08,1,.348],[0,.355,1,.622],[0,.63,1,.885]]
                if artwork and panels:
                    for i,region in enumerate(panels):
                        start=self.time
                        visual=self.concept_page({**beat,"artworkRegion":region,"panelIndex":i},package,rules)
                        self.change(visual,.6)
                        self.wait_to(line["start"]+duration*(i+1)/len(panels))
                        timeline.append({'beat':beat['id'],'mode':'comic','panel':i,'start':start,'end':self.time,'readAt':(start+self.time)/2})
                else:
                    start=self.time
                    visual=self.concept_page(beat,package,rules)
                    self.change(visual,min(.65,duration*.2))
                    self.wait_to(line["end"])
                    timeline.append({'beat':beat['id'],'mode':'concept','start':start,'end':self.time,'readAt':(start+self.time)/2})
        self.caption_layer.clear_updaters()
        self._subtitle_enabled=False
        self.set_caption("改变条件，亲手验证。完整单步记录在互动实验中。")
        self.wait(1.2)
        (audio_dir.parent/'visual-timeline.json').write_text(json.dumps({'algorithmId':package['algorithm']['id'],'traceHash':package['traceHash'],'duration':self.time,'pages':timeline},ensure_ascii=False,indent=2),encoding='utf-8')

    def wait_to(self,time):
        frames=round(time*config.frame_rate)-round(self.time*config.frame_rate)
        if frames>0:self.wait(frames/config.frame_rate)

    def wait(self,duration=1.0,stop_condition=None,frozen_frame=None):
        # Hold diagrams while the narration continues; split exactly at caption boundaries.
        # Manim's frozen-frame path preserves 60fps output without redrawing a static page 60 times/sec.
        if stop_condition is not None or not getattr(self,'_subtitle_enabled',False):
            return super().wait(duration,stop_condition=stop_condition,frozen_frame=True if frozen_frame is None else frozen_frame)
        fps=config.frame_rate;current=round(self.time*fps);end=current+round(duration*fps)
        boundaries=sorted({round(start*fps) for start in self._caption_starts if current<round(start*fps)<end})+[end]
        for boundary in boundaries:
            index=max(0,min(len(self._caption_starts)-1,bisect.bisect_right(self._caption_starts,current/fps+.5/fps)-1))
            self.caption_layer.become(self._caption_objects[index]);self.caption_index=index
            if boundary>current:super().wait((boundary-current)/fps,frozen_frame=True)
            current=boundary

    def set_caption(self,value):
        self.caption_layer.become(paragraph(value,12.5,24,max_lines=2).move_to([0,-3.35,0]))

    def change(self,new,duration):
        # A new diagram/page needs a brief crossfade, not a long fade through
        # darkness. Preserve the allotted narration time as a readable hold.
        fade=min(duration,.18)
        if self.current is None:
            dissolve_pages(self,None,new,fade)
            if duration>fade:self.wait(duration-fade)
        else:
            old_parts={m._motion_key:m for m in self.current.get_family() if hasattr(m,"_motion_key")}
            new_parts={m._motion_key:m for m in new.get_family() if hasattr(m,"_motion_key")}
            shared=old_parts.keys()&new_parts.keys()
            self.remove(self.current)
            if shared:
                # Match only the same semantic object. Never morph axes, prose, or unrelated glyphs.
                moving=[];targets=[];animations=[]
                for key in sorted(shared):
                    if same_visual(old_parts[key],new_parts[key]):continue
                    source=old_parts[key].copy();target=new_parts[key].copy()
                    # A changed textual label gets a clean new value instead of glyph morphing.
                    if key.startswith("label:") and getattr(source,"text",None)!=getattr(target,"text",None):continue
                    moving.append(source);targets.append((new_parts[key],target));new_parts[key].set_opacity(0)
                    animations.append(Transform(source,target))
                self.add(new,*moving)
                if animations:self.play(*animations,run_time=duration)
                else:self.wait(duration)
                for original,target in targets:original.become(target)
                self.remove(*moving)
            else:
                previous=self.current
                dissolve_pages(self,previous,new,fade)
                if duration>fade:self.wait(duration-fade)
        self.current=new

    def event_page(self,event,run,rules,beat,replay_label,mode="rule",show_after=True):
        snapshot=event_scene(event,run)
        if run['trace']['algorithmId']=='ahp' and event.get('candidates'):show_after=True
        if beat.get('stateView') in {'before','after'}:show_after=beat['stateView']=='after'
        event_index=int(event["id"])
        if not show_after and event_index>0:
            current_snapshot=snapshot
            snapshot=event_scene(run["trace"]["events"][event_index-1],run)
            # Keep the recorded old values, but point at the operation being
            # explained now, not the previous cell's orange cursor.
            if snapshot['kind']=='matrix':snapshot={**snapshot,'active':current_snapshot.get('active',[])}
        path_mode=run["trace"]["algorithmId"] in {"bfs","dfs","astar","dijkstra"}
        if path_mode:snapshot={**snapshot,"showNodeIds":True}
        algorithm=run["trace"]["algorithmId"]
        if algorithm in {'minimax','mcts'} and snapshot['kind']=='grid':snapshot={**snapshot,'showNodeIds':True,'nodeIdOffset':1}
        if algorithm=='knapsack' and snapshot['kind']=='matrix':
            cols=len(snapshot['matrix'][0]);done=set(range(cols));limit=event_index+(1 if show_after else 0)
            for item in run['trace']['events'][:limit]:
                if item['ruleId']=='knapsack.compare':done.add(int(item['focus'][0]))
            focus=event.get('focus',[]);secondary=[int(i) for i in focus[1:]]
            if event['phase']=='backtrack' and focus and int(focus[0])>=cols:secondary=[int(focus[0])-cols]
            snapshot={**snapshot,'secondary':secondary,'matrixLabels':[[display(v) if r*cols+c in done else '—' for c,v in enumerate(row)] for r,row in enumerate(snapshot['matrix'])]}
        visual=sha_pipeline_principle_visual(event,run,snapshot,show_after,beat.get('visualFocus')) if algorithm=="sha256" else pid_visual(event,run,snapshot,show_after) if algorithm=="pid" else moving_average_visual(event,run,show_after) if algorithm=="moving-average" else search_visual(event,run,show_after) if algorithm in {'linear-search','binary-search'} else None
        if algorithm=='pid':visual=pid_principle_visual(event,run,snapshot,show_after) or visual
        elif algorithm=='knn':visual=knn_principle_visual(event,run,snapshot,show_after,mode,self.comparison_candidates(event,beat))
        elif algorithm=='linear-regression':visual=regression_principle_visual(event,run,snapshot,show_after)
        elif algorithm=='counting-sort':visual=counting_visual(event,run,show_after)
        elif algorithm=='quick-sort':visual=quicksort_visual(event,run,snapshot,show_after)
        elif algorithm=='floyd-warshall':visual=floyd_visual(event,run,snapshot,show_after)
        elif algorithm in {'kruskal','topological','hungarian'}:visual=graph_principle_visual(event,run,snapshot,show_after)
        elif algorithm=='ucb':visual=bandit_visual(event,run,show_after)
        elif algorithm=='thompson':visual=thompson_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'merge-sort','heap-sort','reservoir'}:visual=sorting_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'gaussian-filter','median-filter','sobel','otsu','ransac','fft','seam-carving'}:visual=signal_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'annealing','genetic','pso','ant-colony','simplex','branch-bound'}:visual=optimization_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'moving-average','exponential-smoothing'}:visual=forecast_principle_visual(event,run,snapshot,show_after) or visual
        elif algorithm=='logistic-regression':visual=learning_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'bayes','monte-carlo','bootstrap'}:visual=probability_principle_visual(event,run,snapshot,show_after)
        elif algorithm=='kalman' and event_index<6:visual=control_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'regret','boids','life','perlin','lsystem','voronoi','reaction-diffusion','wfc'}:visual=generative_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'particle-filter','rrt','potential-field','pure-pursuit','qlearning'}:visual=robotics_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'apriori','bm25','edit-distance','kmp','rle','huffman','lz77','hamming','crc','bloom'}:visual=information_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'decision-tree','naive-bayes','dbscan','pca','neural-network','pagerank','collaborative','content-recommendation'}:visual=intelligence_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'stable-matching','max-flow','graph-coloring','critical-path','hill-climbing'}:visual=allocation_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'minimax','mcts'}:visual=decision_game_principle_visual(event,run,snapshot,show_after)
        elif algorithm=='interval-scheduling':visual=scheduling_principle_visual(event,run,snapshot,show_after)
        elif algorithm in {'ahp','topsis'}:visual=decision_matrix_principle_visual(event,run,snapshot,show_after,beat.get('visualFocus'))
        if visual is None:visual=scene_visual(snapshot,7.6,3.35 if path_mode else 4.25,event.get("focus"))
        projection_phase=getattr(visual,'_projection_phase',None)
        if not path_mode and visual.height>4.25:visual.scale_to_fit_height(4.25)
        if visual.width>7.65:visual.scale_to_fit_width(7.65)
        visual.move_to([-2.8,.40 if path_mode else .15,0])
        if path_mode:visual=Group(visual,self.frontier_cards(run,event,show_after))
        if algorithm=='knapsack' and snapshot['kind']=='matrix':visual=Group(visual,text('橙框：当前格 · 蓝框：上一行答案 · — 尚未计算',17,MUTED,width=7.6).move_to([-2.8,-2.15,0]))
        title=text(beat.get("title",event["action"]),27,TEAL,width=7.7).move_to([-2.8,2.57,0])
        box=RoundedRectangle(width=4.75,height=5.35,corner_radius=.17,fill_color=PANEL,fill_opacity=1,stroke_color=RULE,stroke_width=1).move_to([4.25,.06,0])
        box._motion_key='layout:explanation-panel'
        items=[]
        calculation=event.get("calculation")
        if mode.startswith("rule"):
            pages=explanation_pages(event['explanation']);part=int(mode.split(':')[-1]) if ':' in mode else 0
            heading='① 这一步为什么'+(f' · {part+1}/{len(pages)}' if len(pages)>1 else '')
            items=[text(heading,23,TEAL),paragraph(rules[event["ruleId"]]["title"],4.15,25),paragraph(pages[part],4.15,22,max_lines=5)]
        if mode.startswith("calculation") and calculation:
            formula=SHARED_LABELS.get('formulaVariants',{}).get(event['ruleId'],{}).get(calculation['formula'],SHARED_LABELS.get('formulas',{}).get(event['ruleId'],calculation['formula']))
            items=[text("② 代入真实数值",23,TEAL),paragraph(formula,4.15,22,GOLD,max_lines=4)]
            if calculation.get("values"):
                values=calculation_values(event,beat);chunk=int(mode.split(":")[-1]) if ":" in mode else 0
                per_page=operands_per_page(beat);visible_values=values[chunk*per_page:chunk*per_page+per_page]
                if len(values)>per_page:items.append(text(f"代入值第 {chunk+1}/{math.ceil(len(values)/per_page)} 组",16,MUTED))
                items.append(paragraph("\n".join(f"{field_name(k,algorithm,event['phase'])} = {display(v)}" for k,v in visible_values),4.15,21,MUTED,max_lines=6))
            output=display(calculation["result"])
            if len(output)>75 and run["trace"]["algorithmId"]=="sha256":output="8个32位结果已列在左侧；完整记录见网页"
            result_label=result_name(event)+'：'
            if not beat.get('hideResult'):items.append(paragraph(result_label+output,4.15,22,GOLD,max_lines=5))
        candidates=self.comparison_candidates(event,beat)
        if mode.startswith("comparison") and candidates:
            items=[text("③ 为什么不选其他？",23,TEAL)]
            page=int(mode.split(':')[-1]) if ':' in mode else 0
            total=len(event.get('candidates',[]))
            label=f'对照 {page+1}/{len(candidates)}'
            if total>len(candidates):label+=f' · 从{total}项中选取代表'
            items.append(text(label,16,MUTED))
            for candidate in candidates[page:page+1]:
                status={"chosen":"选择","deferred":"待选","rejected":"舍弃"}[candidate["status"]]
                color={"chosen":TEAL,"deferred":WAITING_BLUE,"rejected":RED}[candidate["status"]]
                target=candidate['target']
                if algorithm=='rrt' and event['ruleId']=='rrt-extend':
                    status='碰撞检查通过' if candidate['status']=='chosen' else '碰撞检查未通过'
                    target+='；候选线段'+('可通过' if candidate['status']=='chosen' else '被拒绝')
                if algorithm=='potential-field' and event['ruleId']=='potential-force':
                    status='本步计入排斥' if candidate['status']=='chosen' else '本步不计入排斥'
                if algorithm=='critical-path' and event['ruleId']=='critical-path.backward':
                    status={'chosen':'较紧截止','deferred':'较宽截止','rejected':'不决定当前截止'}[candidate['status']]
                if algorithm=='dbscan' and re.fullmatch(r'\d+',target):target='点 '+str(int(target)+1)
                if algorithm=='huffman' and event['ruleId']=='huffman.merge':
                    node=next((n for n in event.get('scene',{}).get('nodes',[]) if n['id']==target),None)
                    if node:target=node['label'] if ':' in node['label'] else '子树（权重'+node['label']+'）'
                if algorithm in {'bfs','dfs','dijkstra','astar'} and event['phase']=='neighbor' and re.fullmatch(r'\d+',target):
                    target='本次到达 '+target+' 的路线'
                items.append(paragraph(f"{status} {target}",4.15,23,color,max_lines=2))
                if candidate.get("values"):items.append(paragraph(" · ".join(f"{field_name(k,algorithm,event['phase'])}={display(v)}" for k,v in candidate["values"].items()),4.15,20,color,max_lines=3))
                items.append(paragraph(candidate["reason"],4.15,19,MUTED,max_lines=3))
        if mode=="compact":
            items=[text("用同一规则继续",23,TEAL),paragraph(event["action"],4.15,25,max_lines=3)]
            if calculation:
                output=display(calculation["result"])
                if len(output)>75 and run["trace"]["algorithmId"]=="sha256":output="8个32位新值见左侧"
                result_label=result_name(event,'结果')+'：'
                if not beat.get('hideResult'):items.append(paragraph(result_label+output,4.15,22,GOLD,max_lines=5))
            if algorithm=='pure-pursuit' and event['ruleId']=='pursuit-target' and candidates:
                items.append(paragraph('最近路点候选（不是前视点）',4.15,19,MUTED,max_lines=2))
            for candidate in candidates[:3]:
                values=" / ".join(display(v) for v in candidate.get("values",{}).values())
                if algorithm=='bfs':values='入队序='+display(candidate['values']['sequence']) if 'sequence' in candidate.get('values',{}) else ''
                target=("点 "+str(int(candidate["target"])+1)) if algorithm=="dbscan" and re.fullmatch(r"\d+",candidate["target"]) else candidate["target"]
                items.append(paragraph(target+"  "+values+(" ✓" if candidate["status"]=="chosen" else ""),4.15,22,TEAL if candidate["status"]=="chosen" else MUTED,max_lines=2))
        if mode=="case":
            items=[text("同一规则 · 另一组输入",23,TEAL),paragraph(beat.get("caseExplanation",run["summary"]),4.15,23,max_lines=6)]
            for key,value in list(run["metrics"].items())[:3]:items.append(paragraph(key+"："+display(value),4.15,23,GOLD,max_lines=2))
        stack=VGroup(*items).arrange(DOWN,aligned_edge=LEFT,buff=.16)
        if stack.height>4.9:
            raise ValueError(f"Event {event['id']} ({mode}) explanation is too dense for one readable frame; split authored comparison/beat or shorten explanatory text")
        stack.move_to([4.25,2.48-stack.height/2,0])
        footer=replay_label or f"真实步骤 {int(event['id'])+1} · {rules[event['ruleId']]['title']}"
        note=text(footer,16,MUTED,width=7.8).move_to([-2.8,-2.53,0])
        if path_mode:visual.add(text('格内大字：'+('已走步数' if algorithm=='bfs' else '搜索树深度' if algorithm=='dfs' else '预计总值 f=g+h' if algorithm=='astar' else '已走代价 g')+' · 左上角 # 为编号',16,MUTED,width=7.6).move_to([-2.8,2.29,0]))
        stage=text(projection_phase or ('当前画面：本步完成' if show_after else '当前画面：执行前 · 先推导，再写入'),14,MUTED,width=7.6).move_to([-2.8,-2.76,0])
        return Group(title,visual,box,stack,note,stage)

    def comparison_candidates(self,event,beat):
        candidates=event.get('candidates',[])
        if event.get('ruleId','').startswith('graph-coloring.'):
            candidates=[{**c,'target':chr(65+int(c['target']))} if re.fullmatch(r'\d+',c['target']) else c for c in candidates]
        if event.get('ruleId','').startswith('topological.'):
            candidates=[{**c,'target':'任务 '+chr(65+int(c['target']))} if re.fullmatch(r'\d',c['target']) else c for c in candidates]
        requested=beat.get('candidateTargets')
        if requested is not None:return [c for c in candidates if c['target'] in requested]
        if len(candidates)<=3:return candidates
        # Include both acceptance and rejection/waiting whenever they exist.
        # Showing only the first three winners cannot explain the alternative.
        picked=[]
        for status in ['chosen','rejected','deferred']:
            match=next((c for c in candidates if c['status']==status),None)
            if match is not None:picked.append(match)
        for c in candidates:
            if len(picked)>=3:break
            if c not in picked:picked.append(c)
        return picked

    def frontier_cards(self,run,event,after):
        """Display a recorded waiting list; do not run or approximate search rules."""
        if not hasattr(self,"_frontier_states"):self._frontier_states={}
        cache=self._frontier_states
        state_key='stack' if run['trace']['algorithmId']=='dfs' else 'open'
        if id(run) not in cache:
            state=copy.deepcopy(run["trace"]["initialState"])
            states=[copy.deepcopy(state.get(state_key,[]))]
            for item in run["trace"]["events"]:
                for change in item["changes"]:state[change["target"]]=copy.deepcopy(change["after"])
                states.append(copy.deepcopy(state.get(state_key,[])))
            cache[id(run)]=states
        index=int(event["id"])+(1 if after else 0)
        waiting=cache[id(run)][index]
        bfs=run["trace"]["algorithmId"]=="bfs"
        label=("队列编号：左边先出，右边追加" if bfs else '调用栈：右端是当前路口，回溯时退出' if state_key=='stack' else "开放集合编号：当前记录顺序；选择依据见右侧")+(" · 本步之后" if after else " · 本步之前")
        group=Group(text(label,18,MUTED,width=7.6).move_to([-2.8,-1.63,0]))
        if not waiting:
            group.add(text("当前为空",24,WAITING_BLUE).move_to([-2.8,-2.08,0]));return group
        visible=waiting[:10]
        if len(waiting)>10:label_tail="另有"+str(len(waiting)-10)+"项，完整队列见网页"
        else:label_tail=None
        cards=VGroup()
        for position,node in enumerate(visible):
            card=RoundedRectangle(width=.52,height=.49,corner_radius=.08,stroke_color=WAITING_BLUE,fill_color=PANEL,fill_opacity=1)
            number=text(str(node),22,WAITING_BLUE).move_to(card)
            cards.add(VGroup(card,number))
        cards.arrange(RIGHT,buff=.10).move_to([-2.8,-2.08,0]);group.add(cards)
        if label_tail:group.add(text(label_tail,14,MUTED,width=7.5).move_to([-2.8,-2.43,0]))
        return group

    def concept_page(self,beat,package,rules):
        title=text(beat.get("title",package["algorithm"]["name"]),34,TEAL,width=12.5).move_to([0,2.36,0])
        items=[]
        role="analogy" if beat["kind"]=="analogy" else "summary" if beat["kind"]=="summary" else "rules" if beat["kind"]=="rule" else None
        artwork=beat.get("artwork") or package.get("artwork",{}).get(role)
        if artwork:
            artwork_path=(self.package_dir/artwork).resolve()
            if not artwork_path.is_file():raise FileNotFoundError(f"Missing authored artwork: {artwork_path}")
            art=ImageMobject(str(artwork_path))
            if beat.get("artworkRegion"):
                pixels=art.get_pixel_array();h,w=pixels.shape[:2];x0,y0,x1,y1=beat["artworkRegion"]
                art=ImageMobject(pixels[round(y0*h):round(y1*h),round(x0*w):round(x1*w)])
            art.width=7.5
            if art.height>4.4:art.height=4.4
            art.move_to([-2.75,-.1,0])
            analogy=package["lesson"]["analogy"]
            mapping=beat.get("mappingIndices",[min(beat.get("panelIndex",0),len(analogy["mappings"])-1)] if "panelIndex" in beat else list(range(min(2,len(analogy["mappings"])))))
            if beat.get('panelExplanations'):
                texts=beat['panelExplanations'];items.append(paragraph(texts[min(beat.get('panelIndex',0),len(texts)-1)],4.1,24,max_lines=9))
            elif beat.get("visualExplanation"):
                items.append(paragraph(beat["visualExplanation"],4.1,24,max_lines=9))
            elif role=="summary":
                items.append(paragraph(package["run"]["summary"],4.1,24,max_lines=5))
                items.append(paragraph(analogy["limit"],4.1,21,MUTED,max_lines=5))
            else:
                for index in mapping:
                    item=analogy["mappings"][index]
                    items.append(paragraph(item["everyday"]+"\n↓\n"+item["algorithm"],4.1,23,GOLD,max_lines=5))
            stack=VGroup(*items).arrange(DOWN,aligned_edge=LEFT,buff=.3)
            if stack.height>4.4:raise ValueError("Artwork mapping labels too tall; split beat")
            stack.move_to([4.25,-.1,0])
            return Group(title,art,stack)
        if beat["kind"]=="analogy":
            analogy=package["lesson"]["analogy"]
            items.append(paragraph(analogy["story"],11.5,27,max_lines=4))
            mapping=beat.get("mappingIndices",list(range(min(3,len(analogy["mappings"])))))
            for index in mapping:
                item=analogy["mappings"][index]
                items.append(paragraph(item["everyday"]+"  →  "+item["algorithm"],11.5,25,GOLD,max_lines=2))
        elif beat["kind"]=="summary":
            items.append(paragraph(package["run"]["summary"],11.5,28,max_lines=3))
            if package["lesson"].get("misconception"):
                items.append(paragraph("别误会："+package["lesson"]["misconception"],11.5,25,GOLD,max_lines=3))
            items.append(paragraph("类比边界："+package["lesson"]["analogy"]["limit"],11.5,22,MUTED,max_lines=2))
        else:
            for rule_id in beat.get("ruleIds",[]):
                rule=rules[rule_id]
                items.append(paragraph(rule["title"]+"："+rule["statement"],11.5,26,max_lines=3))
                if rule.get("formula"):items.append(paragraph(rule["formula"],11.5,32,GOLD,max_lines=2))
        if not items:items.append(paragraph(beat["text"],11.5,30,max_lines=5))
        stack=VGroup(*items).arrange(DOWN,aligned_edge=LEFT,buff=.35)
        if stack.height>4.25:
            raise ValueError(f"Beat {beat['id']} is too dense; split its authored contents")
        stack.move_to([0,.9-stack.height/2,0])
        return Group(title,stack)
