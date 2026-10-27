"""Technical review of a single real center movement, not a standalone lesson."""
from pathlib import Path
from manim import *
from film_contract import load_package
from film_runtime import TraceFilm
from visuals import BG,text

class TransitionReview(TraceFilm):
    def construct(self):
        package=load_package(Path(__file__).resolve().parent.parent/"exports/kmeans.film.json")
        event=package["run"]["trace"]["events"][7]
        rules={r["id"]:r for r in package["lesson"]["rules"]}
        self.camera.background_color=BG
        self.add(text("K-means · 真实中心移动审查",36).move_to([0,3.25,0]))
        self.current=self.event_page(event,package["run"],rules,{"title":"中心1由(72,68)移到(76,72)"},None,"rule",False)
        self.add(self.current);self.wait(.8)
        self.change(self.event_page(event,package["run"],rules,{"title":"中心1由(72,68)移到(76,72)"},None,"calculation",True),.6)
        self.wait(.8)
