"""Technical timing/sample validation, not a lesson or accepted deliverable."""
from qa_crossfade import CrossfadeCheck
from fast_dissolve import dissolve_pages
from manim import *
from visuals import text,BG,TEAL,GOLD
import bisect

class FastDissolveCheck(CrossfadeCheck):
    def change(self,new,duration):
        fade=min(duration,.18)
        dissolve_pages(self,self.current,new,fade)
        if duration>fade:self.wait(duration-fade)
        self.current=new

class FastDissolveCaptionCheck(FastDissolveCheck):
    def construct(self):
        self.camera.background_color=BG;self.current=None
        self._caption_starts=[0,.08,.65]
        self._caption_objects=[text(s,28).move_to([0,-2.9,0]) for s in ['第一句','转场中换成第二句','保持页继续第三句']]
        self.caption_layer=VGroup();self.caption_index=-1;self._subtitle_enabled=True
        def update(layer,dt):
            index=max(0,bisect.bisect_right(self._caption_starts,self.time)-1)
            if index!=self.caption_index:
                self.caption_layer.become(self._caption_objects[index]);self.caption_index=index
        self.caption_layer.add_updater(update);self.add(self.caption_layer)
        self.change(Group(Circle(radius=1,color=TEAL),text('页面甲',30).shift(UP*2)),.6)
        self.change(Group(Square(side_length=2,color=GOLD),text('页面乙',30).shift(UP*2)),.6)
