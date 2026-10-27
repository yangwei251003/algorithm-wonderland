from manim import *
from film_runtime import TraceFilm
from visuals import text,BG,TEAL
class CaptionWaitCheck(TraceFilm):
    def construct(self):
        self.camera.background_color=BG
        self._caption_starts=[0,2,4,6]
        self._caption_objects=[text(s,48,TEAL).move_to([0,-1.8,0]) for s in ['第一句：保持图像','第二句：字幕必须改变','第三句：不改变真实时长','第四句：继续60帧输出']]
        self.caption_layer=VGroup();self.caption_index=-1;self._subtitle_enabled=True
        self.add(Circle(radius=1,color=TEAL),self.caption_layer)
        self.wait(8)
