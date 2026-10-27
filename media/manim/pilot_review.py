"""Authored K-means pilot review frames; uses the exact exported production trace."""
from pathlib import Path
from manim import *
from film_contract import load_package
from film_runtime import TraceFilm
from visuals import BG,text,MUTED

class Review(TraceFilm):
    event_index=1
    mode="calculation"
    def construct(self):
        package=load_package(Path(__file__).resolve().parent.parent/"exports/kmeans.film.json")
        event=package["run"]["trace"]["events"][self.event_index]
        rules={rule["id"]:rule for rule in package["lesson"]["rules"]}
        self.camera.background_color=BG
        self.add(text("K-means 聚类",37).move_to([0,3.24,0]))
        self.add(self.event_page(event,package["run"],rules,{"title":event["action"]},None,self.mode,True))
        self.add(text("正式轨迹静帧审查",17,MUTED).move_to([0,-3.35,0]))

class CalculationReview(Review):pass
class ComparisonReview(Review):mode="comparison"
class CenterReview(Review):event_index=7
