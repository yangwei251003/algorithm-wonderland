"""Technical fixtures for every Scene kind; not lesson content."""
from manim import *
from visuals import BG,INK,MUTED,TEAL,GOLD,RULE,text,scene_visual,fraction

FIXTURES=[
 {"kind":"bars","values":[3,-2,5,1],"labels":["甲","乙","丙","丁"],"active":[2]},
 {"kind":"grid","rows":3,"cols":4,"cells":[4,2,1,0,0,2,1,0,0,3,3,5]},
 {"kind":"graph","nodes":[{"id":"a","x":15,"y":70,"label":"A"},{"id":"b","x":80,"y":20,"label":"B"}],"edges":[{"from":"a","to":"b","label":"3","directed":True}]},
 {"kind":"scatter","yUp":True,"nodes":[{"x":20,"y":20,"value":0},{"x":30,"y":40,"value":0},{"x":70,"y":80,"value":1}]},
 {"kind":"lines","series":[{"name":"观测","points":[{"x":0,"y":0},{"x":1,"y":3},{"x":2,"y":1}]}]},
 {"kind":"matrix","matrix":[[1,2,3],[4,5,6]],"active":[4],"rowLabels":["甲","乙"],"columnLabels":["一","二","三"]},
 {"kind":"text","tokens":[{"text":"A","sub":"00"},{"text":"B","sub":"01"},{"text":"C","sub":"1"}],"text":["每个符号对应一个编码"]},
 {"kind":"image","rows":2,"cols":2,"pixels":[0,0,0,255,255,255,255,255,100,100,100,255,200,200,200,255]},
 {"kind":"schedule","tasks":[{"label":"活动一","start":0,"duration":3,"row":0},{"label":"活动二","start":2,"duration":2,"row":1}]},
 {"kind":"world","nodes":[{"x":20,"y":35,"r":2},{"x":60,"y":60,"r":2}],"polygons":[{"points":[{"x":70,"y":10},{"x":90,"y":10},{"x":80,"y":30}],"color":GOLD}],"paths":[{"points":[{"x":20,"y":35},{"x":60,"y":60}]}]}
]


class AdapterSmoke(Scene):
    def construct(self):
        self.camera.background_color=BG
        self.add(text("Scene数据适配测试 · 十种视觉类型",30).move_to([0,3.65,0]))
        for i,fixture in enumerate(FIXTURES):
            center=np.array([(i%5-2)*2.75,(.5-i//5)*3.15-.2,0])
            frame=RoundedRectangle(width=2.6,height=2.85,corner_radius=.1,stroke_color=RULE).move_to(center)
            visual=scene_visual(fixture,width=5.2,height=4.2)
            visual.scale_to_fit_width(2.25)
            if visual.height>2.1:visual.scale_to_fit_height(2.1)
            visual.move_to(center+DOWN*.15)
            self.add(frame,visual,text(fixture["kind"],18,TEAL).move_to(center+UP*1.15))
        self.add(fraction("3 + 4","7",width=1.2,size=16).move_to([6.35,3.5,0]))
        self.wait(.2)
