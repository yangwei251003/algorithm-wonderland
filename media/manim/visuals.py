"""Original visual adapters for the TypeScript Scene contract; no algorithm computations."""
from __future__ import annotations
import math
import textwrap
import unicodedata
import re
import colorsys
from functools import lru_cache
import numpy as np
from manim import *

BG = "#08131F"
PANEL = "#102332"
INK = "#F4F7FB"
MUTED = "#A9BBCB"
TEAL = "#49D6BE"
GOLD = "#F6BA6F"
RED = "#F28E91"
RULE = "#284353"
FONT = "Microsoft YaHei"
PALETTE = [TEAL, GOLD, "#90B3FF", "#BBA2E4", "#F28E91", "#83C998"]
GRID = ["#122331", "#334450", "#338B82", "#78EDD0", "#F6C37B", "#90B3FF", "#526285"]


def css_color(value):
    if not isinstance(value,str):return value
    if value.startswith("hsl"):
        parts=[float(v) for v in re.findall(r"[-\d.]+",value)]
        rgb=colorsys.hls_to_rgb((parts[0]%360)/360,parts[2]/100,parts[1]/100)
        return "#"+"".join(f"{round(c*255):02X}" for c in rgb)
    if value.startswith("rgb"):
        parts=[float(v) for v in re.findall(r"[-\d.]+",value)]
        alpha=parts[3] if len(parts)>3 else 1
        background=(8,19,31)
        return "#"+"".join(f"{round(min(255,max(0,parts[i]))*alpha+background[i]*(1-alpha)):02X}" for i in range(3))
    return value


def normalize_colors(scene):
    def walk(value,key=""):
        if isinstance(value,dict):return {k:walk(v,k) for k,v in value.items()}
        if isinstance(value,list):return [walk(v,key) for v in value]
        return css_color(value) if key in {"color","colors","palette","cells"} else value
    return walk(scene)


def display(value):
    if value is None:
        return "空"
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            return "∞" if value > 0 else "−∞"
        if isinstance(value,int):return str(value)
        return f"{value:.4f}".rstrip("0").rstrip(".") if value==0 or .0001<=abs(value)<1e9 else f"{value:.4g}"
    if isinstance(value,list):
        return "[" + ", ".join(display(v) for v in value) + "]"
    if isinstance(value,dict):
        return "; ".join(f"{k}: {display(v)}" for k,v in value.items())
    return str(value)


@lru_cache(maxsize=2048)
def _text_template(value,size,color):return Text(value,font=FONT,font_size=size,color=color)

def text(value, size=25, color=INK, width=None):
    obj = _text_template(str(value),size,str(color)).copy()
    if width and obj.width > width:
        obj.scale_to_fit_width(width)
    return obj


def paragraph(value, width=4.4, size=23, color=INK, max_lines=None):
    # Estimate a line, then verify actual Pango geometry; avoids rendering every prefix.
    lines = []
    for explicit in str(value).split("\n"):
        remaining=explicit
        if not remaining:lines.append("")
        while remaining:
            estimate=0.0;count=0
            for char in remaining:
                estimate += size*(.0128 if unicodedata.east_asian_width(char) in {"W","F"} else .0075)
                if estimate>width and count:break
                count+=1
            count=max(1,count)
            while count>1 and text(remaining[:count],size,color).width>width:count-=1
            # Keep a number / Latin term intact instead of wrapping 68 into “6” then “8”.
            if count<len(remaining) and re.match(r"[A-Za-z0-9_.+−-]",remaining[count-1]) and re.match(r"[A-Za-z0-9_.+−-]",remaining[count]):
                boundary=count
                while boundary>0 and re.match(r"[A-Za-z0-9_.+−-]",remaining[boundary-1]):boundary-=1
                if boundary:count=boundary
            lines.append(remaining[:count]);remaining=remaining[count:]
    if max_lines is not None and len(lines) > max_lines:
        raise ValueError(f"Text needs {len(lines)} lines (maximum {max_lines}); split the authored beat: {value}")
    objects = [text(line,size,color) if line else Rectangle(width=.001,height=.15,stroke_width=0,fill_opacity=0) for line in lines]
    return VGroup(*objects).arrange(DOWN, aligned_edge=LEFT, buff=.13)


def fraction(numerator, denominator, width=1.8, size=28):
    top = text(display(numerator),size,width=width)
    bottom = text(display(denominator),size,width=width)
    rule = Line(LEFT*max(top.width,bottom.width,.6)/2,RIGHT*max(top.width,bottom.width,.6)/2,color=INK,stroke_width=2)
    top.next_to(rule, UP, buff=.12)
    bottom.next_to(rule, DOWN, buff=.12)
    return VGroup(top,rule,bottom)


def numeric_matrix(values, width=7, height=4.3, row_labels=None, column_labels=None, active=None,secondary=None,matrix_labels=None):
    rows = len(values)
    cols = max([len(row) for row in values] or [1])
    if rows == 0:
        return text("矩阵为空",25,MUTED)
    cell_w = (width-.5)/cols
    cell_h = (height-.5)/rows
    group = VGroup()
    max_value = max([abs(v) for row in values for v in row if isinstance(v,(float,int)) and math.isfinite(v)] or [1]) or 1
    for r,row in enumerate(values):
        for c,value in enumerate(row):
            x = -width/2+.5+(c+.5)*cell_w
            y = height/2-.5-(r+.5)*cell_h
            rect = Rectangle(width=max(.01,cell_w-.04),height=max(.01,cell_h-.04),stroke_color=GOLD if r*cols+c in (active or []) else '#90b3ff' if r*cols+c in (secondary or []) else RULE,stroke_width=2,fill_color=TEAL,fill_opacity=.12+.42*(abs(value)/max_value if isinstance(value,(float,int)) and math.isfinite(value) else 0)).move_to([x,y,0])
            label = text(matrix_labels[r][c] if matrix_labels else display(value),20,width=cell_w*.8).move_to(rect)
            if label.height > cell_h*.6:
                label.scale_to_fit_height(cell_h*.6)
            group.add(rect,label)
        if row_labels and r < len(row_labels):
            group.add(text(row_labels[r],15,MUTED,width=.45).move_to([-width/2+.15,height/2-.5-(r+.5)*cell_h,0]))
    if column_labels:
        for c,name in enumerate(column_labels[:cols]):
            group.add(text(name,16,MUTED,width=cell_w*.8).move_to([-width/2+.5+(c+.5)*cell_w,height/2-.15,0]))
    return group


def _color(scene, value):
    palette = scene.get("palette") or GRID
    return value if isinstance(value,str) else palette[abs(round(value))%len(palette)]


def scene_visual(scene, width=7.65, height=4.1, focus=None):
    """Build a visual snapshot from published Scene fields without deriving missing states."""
    scene=normalize_colors(scene)
    kind = scene["kind"]
    # Keep the viewport fixed: centering only visible nodes would shift every frame.
    group = Group(Rectangle(width=width,height=height,stroke_width=0,fill_opacity=0))
    focus = {str(i) for i in focus or []}
    if kind == "matrix":
        return numeric_matrix(scene.get("matrix",[]),width,height,scene.get("rowLabels"),scene.get("columnLabels"),scene.get("active"),scene.get('secondary'),scene.get('matrixLabels'))
    if kind == "image":
        rows,cols = scene["rows"],scene["cols"]
        pictures = [scene["pixels"]]
        if scene.get("originalPixels"):
            pictures.insert(0,scene["originalPixels"])
        for i,pixels in enumerate(pictures):
            expected = rows*cols*4
            if len(pixels) != expected:
                raise ValueError(f"RGBA pixel count is {len(pixels)}; expected {expected}")
            image = ImageMobject(np.array(pixels,dtype=np.uint8).reshape(rows,cols,4))
            image.set_resampling_algorithm(RESAMPLING_ALGORITHMS["nearest"])
            image.width = width/len(pictures)-.2
            if image.height > height-.45:
                image.height = height-.45
            image.move_to([(i-(len(pictures)-1)/2)*width/len(pictures),.15,0])
            group.add(image)
            if len(pictures)>1:
                group.add(text(scene.get("originalLabel","原始输入") if i==0 else "处理结果",19,MUTED).next_to(image,DOWN,buff=.12))
        return group
    if kind == "grid":
        rows,cols = scene["rows"],scene["cols"]
        unit = min(width/cols,height/rows)
        for i,value in enumerate(scene.get("cells",[])):
            point = [(i%cols-(cols-1)/2)*unit,((rows-1)/2-i//cols)*unit,0]
            box = Square(side_length=unit*.94,fill_color=_color(scene,value),fill_opacity=1,stroke_color=GOLD if str(i) in focus else BG,stroke_width=3 if str(i) in focus else 1).move_to(point)
            box._motion_key=f"cell:{i}"
            group.add(box)
            if scene.get("showNodeIds"):
                group.add(text("#"+str(i+scene.get('nodeIdOffset',0)),12,MUTED,width=unit*.65).move_to(np.array(point)+np.array([-.18*unit,.30*unit,0])))
            labels = scene.get("cellLabels") or []
            item = labels[i] if i<len(labels) else ("S" if value==4 else "E" if value==5 else "")
            if item:
                label=text(item,19,width=unit*.8).move_to(np.array(point)+np.array([0,-.08*unit if scene.get("showNodeIds") else 0,0]))
                if label.height>unit*.65:label.scale_to_fit_height(unit*.65)
                group.add(label)
        return group
    if kind == "bars":
        values = scene.get("values",[])
        high=max([1]+values);low=min([0]+values)
        dx=width/max(1,len(values));plot_h=height-.7
        def yy(v):return -plot_h/2+(v-low)/(high-low)*plot_h
        zero=yy(0)
        group.add(Line([-width/2,zero,0],[width/2,zero,0],color=RULE))
        for i,value in enumerate(values):
            active=i in scene.get("active",[]) or str(i) in focus
            colors=scene.get("colors",[])
            color=colors[i] if i<len(colors) else GOLD if active else TEAL
            x=-width/2+(i+.5)*dx
            rect=Rectangle(width=max(.01,dx*.78),height=max(.02,abs(yy(value)-zero)),fill_color=color,fill_opacity=.9,stroke_width=0).move_to([x,(yy(value)+zero)/2,0])
            rect._motion_key=f"bar:{i}"
            group.add(rect)
            label=text(display(value),20,color if value>=0 else BG,width=dx*.9).move_to([x,yy(value)+.22 if value>=0 else (yy(value)+zero)/2,0])
            group.add(label)
            labels=scene.get("labels",[])
            group.add(text(labels[i] if i<len(labels) else i+1,16,MUTED,width=dx*.9).move_to([x,-height/2,0]))
        return group
    if kind == "text":
        rows=[]
        tokens=scene.get("tokens",[])
        if tokens:
            token_objects=[]
            for token in tokens:
                label=text(token["text"],25,token.get("color",TEAL))
                if token.get("sub"):
                    sub=text(token["sub"],15,MUTED,width=2.3).next_to(label,DOWN,buff=.1)
                    label=VGroup(label,sub)
                box=RoundedRectangle(width=label.width+.25,height=label.height+.24,corner_radius=.08,stroke_color=token.get("color",TEAL),stroke_width=1.5).move_to(label)
                token_objects.append(VGroup(box,label))
            current=VGroup()
            for token in token_objects:
                if current.width+token.width+.14>width and len(current):
                    rows.append(current.arrange(RIGHT,buff=.14));current=VGroup()
                current.add(token)
            if len(current):rows.append(current.arrange(RIGHT,buff=.14))
        for line in scene.get("text",[]):
            rows.append(paragraph(line,width,24))
        result=VGroup(*rows).arrange(DOWN,aligned_edge=LEFT,buff=.22)
        if result.height>height:
            raise ValueError("Text scene exceeds readable height; split the exported teaching case")
        return result
    if kind == "schedule":
        tasks=scene.get("tasks",[])
        end=max([1]+[t["start"]+t["duration"] for t in tasks]);rows=max([1]+[t["row"]+1 for t in tasks]);rh=height/(rows+1)
        for tick in range(6):
            x=-width/2+width*tick/5
            group.add(Line([x,-height/2+.4,0],[x,height/2,0],color=RULE),text(display(end*tick/5),16,MUTED).move_to([x,-height/2+.1,0]))
        for i,t in enumerate(tasks):
            w=max(.03,t["duration"]/end*width)
            rect=RoundedRectangle(width=w,height=rh*.7,corner_radius=min(.08,w*.2),fill_color=t.get("color",PALETTE[i%len(PALETTE)]),fill_opacity=.85,stroke_width=0).move_to([-width/2+(t["start"]+t["duration"]/2)/end*width,height/2-(t["row"]+.5)*rh,0])
            group.add(rect,text(t["label"],18,BG,width=max(.03,w-.08)).move_to(rect))
        return group
    if kind == "lines":
        points=[p for s in scene.get("series",[]) for p in s["points"]]
        xmin=min([0]+[p["x"] for p in points]);xmax=max([1]+[p["x"] for p in points]);ymin=min([0]+[p["y"] for p in points]);ymax=max([1]+[p["y"] for p in points])
        if scene.get("xDomain"):xmin,xmax=scene['xDomain']
        if scene.get("yDomain"):ymin,ymax=scene['yDomain']
        def xy(p):return np.array([-width/2+(p["x"]-xmin)/(xmax-xmin)*width,-height/2+.3+(p["y"]-ymin)/(ymax-ymin)*(height-.6),0])
        for f in [0,.25,.5,.75,1]:
            y=-height/2+.3+f*(height-.6)
            group.add(Line([-width/2,y,0],[width/2,y,0],color=RULE,stroke_width=1),text(display(ymin+f*(ymax-ymin)),14,MUTED).move_to([-width/2+.2,y+.13,0]))
        legends=[]
        for i,series in enumerate(scene.get("series",[])):
            color=series.get("color",PALETTE[i%len(PALETTE)])
            coords=[xy(p) for p in series["points"]]
            if len(coords)>1:group.add(VMobject(stroke_color=color,stroke_width=3).set_points_as_corners(coords))
            if coords:group.add(Dot(coords[-1],radius=.045,color=color))
            legends.append(text(series["name"],16,color))
        if legends:group.add(VGroup(*legends).arrange(RIGHT,buff=.3).move_to([0,height/2+.07,0]))
        group.add(text(display(xmin),14,MUTED).move_to([-width/2,-height/2,0]),text(display(xmax),14,MUTED).move_to([width/2,-height/2,0]))
        return group
    if kind not in {"graph","scatter","world"}:
        raise ValueError(f"Unsupported Scene kind: {kind}")
    # Normalized Scene coordinates. Mathematical scatter retains equal x/y scale.
    draw_w,draw_h=(min(width,height),min(width,height)) if scene.get("yUp") and kind=="scatter" else (width,height)
    def xy(point):return np.array([(point["x"]/100-.5)*draw_w,((point["y"]/100-.5) if scene.get("yUp") else (.5-point["y"]/100))*draw_h,0])
    if kind=="scatter" and scene.get("yUp"):
        for tick in [0,50,100]:
            p=-draw_w/2+tick/100*draw_w
            group.add(Line([p,-draw_h/2,0],[p,draw_h/2,0],color=RULE,stroke_width=.8))
            group.add(Line([-draw_w/2,p,0],[draw_w/2,p,0],color=RULE,stroke_width=.8))
            group.add(text(tick,13,MUTED).move_to([p,-draw_h/2-.18,0]))
            if tick:group.add(text(tick,13,MUTED).move_to([-draw_w/2-.25,p,0]))
        group.add(text("x",15,MUTED).move_to([draw_w/2+.25,-draw_h/2,0]),text("y",15,MUTED).move_to([-draw_w/2-.23,draw_h/2-.15,0]))
    if scene.get("cells") and scene.get("rows") and scene.get("cols"):
        rows,cols=scene["rows"],scene["cols"]
        for i,value in enumerate(scene["cells"]):
            point={"x":(i%cols+.5)/cols*100,"y":(i//cols+.5)/rows*100}
            group.add(Rectangle(width=draw_w/cols+.005,height=draw_h/rows+.005,fill_color=_color(scene,value),fill_opacity=.45,stroke_width=0).move_to(xy(point)))
    for index,poly in enumerate(scene.get("polygons",[])):
        if len(poly["points"])>=3:
            polygon=Polygon(*[xy(p) for p in poly["points"]],fill_color=poly["color"],fill_opacity=.55,stroke_width=0)
            polygon._motion_key=f"polygon:{index}"
            group.add(polygon)
    nodes=scene.get("nodes",[]);by_id={str(n.get("id",i)):n for i,n in enumerate(nodes)}
    for edge in scene.get("edges",[]):
        if edge["from"] not in by_id or edge["to"] not in by_id:raise ValueError("Edge refers to a missing Scene node")
        a,b=xy(by_id[edge["from"]]),xy(by_id[edge["to"]]);color=edge.get("color",RULE)
        if np.linalg.norm(a-b)<.001:continue
        segment=Arrow(a,b,buff=.12,color=color,stroke_width=edge.get("width",2),max_tip_length_to_length_ratio=.08) if edge.get("directed") else Line(a,b,color=color,stroke_width=edge.get("width",2))
        group.add(segment)
        if edge.get("label"):group.add(text(edge["label"],16,GOLD).move_to((a+b)/2+UP*.17))
    for index,path in enumerate(scene.get("paths",[])):
        pts=[xy(p) for p in path["points"]]
        if kind=='scatter' and scene.get('yUp') and any(abs(p[0])>draw_w/2 or abs(p[1])>draw_h/2 for p in pts):
            clipped=VGroup()
            for a,b in zip(pts,pts[1:]):
                delta=b-a;start,end=0.,1.;valid=True
                for denominator,numerator in [(-delta[0],a[0]+draw_w/2),(delta[0],draw_w/2-a[0]),(-delta[1],a[1]+draw_h/2),(delta[1],draw_h/2-a[1])]:
                    if abs(denominator)<1e-12:
                        if numerator<0:valid=False;break
                    elif denominator<0:start=max(start,numerator/denominator)
                    else:end=min(end,numerator/denominator)
                if valid and start<=end:clipped.add(Line(a+delta*start,a+delta*end,color=path.get('color',TEAL),stroke_width=3))
            group.add(clipped)
            continue
        if len(pts)>1:
            line=VMobject(stroke_color=path.get("color",TEAL),stroke_width=3).set_points_as_corners(pts)
            segment=DashedVMobject(line,num_dashes=max(2,len(pts)*2)) if path.get("dashed") else line
            if kind=='world':segment._motion_key=f'world-path:{index}'
            group.add(segment)
    scatter_labels=[]
    for i,node in enumerate(nodes):
        p=xy(node);key=str(node.get("id",i));r=node.get("r",2.8 if kind=="graph" else 1.1)*.045
        color=node.get("color",PALETTE[int(node.get("value",0))%len(PALETTE)])
        is_center=kind=="scatter" and str(node.get("label","")).startswith("✚")
        dot=VGroup(Circle(radius=r,stroke_color=color,stroke_width=2.5),Line(LEFT*r,RIGHT*r,color=color,stroke_width=3),Line(DOWN*r,UP*r,color=color,stroke_width=3)).move_to(p) if is_center else Dot(p,radius=max(.025,r),color=color)
        dot._motion_key=f"node:{key}"
        group.add(dot)
        if key in focus:
            ring=Circle(radius=r+.08,stroke_color=GOLD,stroke_width=3).move_to(p);ring._motion_key=f"focus:{key}";group.add(ring)
        if node.get("label"):
            if kind=="scatter":scatter_labels.append((node,p,r,is_center))
            else:
                label=text(node["label"],17,BG if kind=="graph" else INK,width=.7 if kind=="graph" else 1.6).move_to(p if kind=="graph" else p+UP*.22)
                label._motion_key=f"label:{key}";group.add(label)
    # Presentation-only label placement: preserve numerical coordinates and avoid label collisions.
    occupied=[]
    positions=[xy(node) for node in nodes]
    for node,p,r,is_center in sorted(scatter_labels,key=lambda row:not row[3]):
        value=("中心 "+node["label"][1:]) if is_center else node["label"]
        label=text(value,17,node.get("color",INK) if is_center else INK,width=1.6)
        choices=[]
        for radius in [.26,.45,.65,.85]:
            for direction in [UP,RIGHT,LEFT,DOWN,UR,UL,DR,DL]:
                position=p+direction/np.linalg.norm(direction)*(radius+(label.width*.4 if abs(direction[0]) else 0))
                w,h=label.width/2+.04,label.height/2+.04
                box=(position[0]-w,position[0]+w,position[1]-h,position[1]+h)
                overlap=sum(max(0,min(box[1],other[1])-max(box[0],other[0]))*max(0,min(box[3],other[3])-max(box[2],other[2])) for other in occupied)
                covered=sum(box[0]-.22<point[0]<box[1]+.22 and box[2]-.22<point[1]<box[3]+.22 for point in positions)
                outside=max(0,abs(position[0])+w-width/2)+max(0,abs(position[1])+h-height/2-.2)
                choices.append((overlap*200+covered*10+outside*20+radius,position,box))
        _,position,box=min(choices,key=lambda choice:choice[0]);occupied.append(box)
        if np.linalg.norm(position-p)>.4:group.add(Line(p,position,color=node.get("color",MUTED),stroke_width=.8).set_opacity(.65))
        label._motion_key=f"label:{node.get('id',nodes.index(node))}"
        group.add(label.move_to(position))
    return group
