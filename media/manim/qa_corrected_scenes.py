"""Review-only stills for exact focus, inherited states and visual legends."""
from pathlib import Path
from manim import *
from film_contract import load_package
from film_runtime import TraceFilm
from visuals import BG,text
class CorrectedScene(TraceFilm):
    algorithm='astar';index=7;mode='comparison:0';after=True
    def construct(self):
        package=load_package(Path(__file__).resolve().parents[1]/'exports'/f'{self.algorithm}.film.json')
        event=package['run']['trace']['events'][self.index]
        self.camera.background_color=BG
        self.add(text(package['algorithm']['name'],37).move_to([0,3.24,0]))
        self.add(self.event_page(event,package['run'],{r['id']:r for r in package['lesson']['rules']},{'title':event['action']},None,self.mode,self.after))
class AStarCorrected(CorrectedScene):pass
class DFSCorrected(CorrectedScene):algorithm='dfs';index=6;mode='rule:0'
class KnapsackBefore(CorrectedScene):algorithm='knapsack';index=18;mode='calculation:0';after=False
class KnapsackAfter(KnapsackBefore):after=True
class QuickBoundary(CorrectedScene):algorithm='quick-sort';index=5;mode='rule:0'
class CountingBoxes(CorrectedScene):algorithm='counting-sort';index=5;mode='calculation:0'
class KMeansCorrected(CorrectedScene):algorithm='kmeans';index=7;mode='rule:0'
class FloydUnreachable(CorrectedScene):algorithm='floyd-warshall';index=0;mode='rule:0'
class UCBScore(CorrectedScene):algorithm='ucb';index=78;mode='calculation:0'
class ThompsonFeedback(CorrectedScene):algorithm='thompson';index=79;mode='calculation:0'
class AHPComparison(CorrectedScene):algorithm='ahp';index=20;mode='comparison:0';after=False
class MinimaxNumbered(CorrectedScene):algorithm='minimax';index=23;mode='comparison:0'
class KalmanPrediction(CorrectedScene):algorithm='kalman';index=0;mode='calculation:0'
class KalmanWeight(CorrectedScene):algorithm='kalman';index=1;mode='calculation:0'
class KalmanBeforeUpdate(CorrectedScene):algorithm='kalman';index=2;mode='calculation:0';after=False
class KalmanAfterUpdate(KalmanBeforeUpdate):after=True
