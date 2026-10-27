"""Technical comparison only: identical Manim page with cached static pixels."""
from manim import *
from qa_crossfade import CrossfadeCheck
from transition_review import TransitionReview
from film_runtime import same_visual
from raster_page import raster_page,FadePixels

class FastChange:
    def change(self,new,duration):
        fade=min(duration,.18)
        if self.current is None:
            bitmap=raster_page(new);self.add(bitmap);self.play(FadePixels(bitmap),run_time=fade)
            self.remove(bitmap);self.add(new)
            if duration>fade:self.wait(duration-fade)
        else:
            old_parts={m._motion_key:m for m in self.current.get_family() if hasattr(m,'_motion_key')}
            new_parts={m._motion_key:m for m in new.get_family() if hasattr(m,'_motion_key')}
            shared=old_parts.keys()&new_parts.keys();self.remove(self.current)
            if shared:
                moving=[];targets=[];animations=[]
                for key in sorted(shared):
                    if same_visual(old_parts[key],new_parts[key]):continue
                    source=old_parts[key].copy();target=new_parts[key].copy()
                    if key.startswith('label:') and getattr(source,'text',None)!=getattr(target,'text',None):continue
                    moving.append(source);targets.append((new_parts[key],target));new_parts[key].set_opacity(0);animations.append(Transform(source,target))
                if animations:
                    bitmap=raster_page(new);self.add(bitmap,*moving);self.play(*animations,run_time=duration);self.remove(bitmap,*moving)
                else:self.add(new);self.wait(duration)
                for original,target in targets:original.become(target)
                self.add(new)
            else:
                previous=raster_page(self.current);bitmap=raster_page(new);self.add(previous,bitmap)
                self.play(FadePixels(previous,False),FadePixels(bitmap),run_time=fade)
                self.remove(previous,bitmap);self.add(new)
                if duration>fade:self.wait(duration-fade)
        self.current=new

class FastCrossfade(FastChange,CrossfadeCheck):pass
class FastTransition(FastChange,TransitionReview):pass
