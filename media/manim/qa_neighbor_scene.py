"""Static visual checks of recorded-neighbor and recorded-mean adapters."""
from pathlib import Path
from manim import *
from film_contract import load_package
from film_runtime import TraceFilm
from visuals import BG,text

class NeighborCheck(TraceFilm):
    algorithm='knn';event_index=9;mode='comparison:1'
    def construct(self):
        package=load_package(Path(__file__).resolve().parents[1]/'exports'/f'{self.algorithm}.film.json')
        event=package['run']['trace']['events'][self.event_index]
        self.camera.background_color=BG
        self.add(text(package['algorithm']['name'],37).move_to([0,3.24,0]))
        self.add(self.event_page(event,package['run'],{r['id']:r for r in package['lesson']['rules']},{'title':event['action']},None,self.mode,True))

class DistanceCheck(NeighborCheck):event_index=1;mode='calculation:0'
class RegressionCheck(NeighborCheck):algorithm='linear-regression';event_index=3;mode='calculation:0'
