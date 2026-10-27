"""Short renderer regression sample; never included among the teaching films."""
from pathlib import Path
from manim import *
from film_runtime import TraceFilm
from visuals import BG,text
class CrossfadeCheck(TraceFilm):
    def construct(self):
        self.current=None;self.camera.background_color=BG
        root=Path(__file__).resolve().parents[2]
        a=ImageMobject(str(root/'media/comics/bfs/analogy.png')).scale_to_fit_height(5.6).shift(LEFT*2.5)
        b=ImageMobject(str(root/'media/comics/bfs/rules.png')).scale_to_fit_height(5.6).shift(LEFT*2.5)
        self.change(Group(a,text('生活类比',38).move_to([3,0,0])),.6)
        self.wait(.6)
        self.change(Group(b,text('同一案例 · 规则拆解',30).move_to([3,0,0])),.6)
        self.wait(.6)
