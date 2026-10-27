"""Manim Cairo page dissolve: rasterize the two authored pages once.

Only for page changes. Algorithm nodes and other semantic objects keep their
ordinary Manim Transform animations in the teaching renderer.
"""
import numpy as np
from manim import ValueTracker, smooth

def dissolve_pages(scene, previous, target, duration):
    renderer=scene.renderer
    original_update=renderer.update_frame
    scene.remove(*([previous] if previous is not None else []),target)
    base=list(scene.mobjects)
    def capture(page):
        renderer.static_image=None
        original_update(scene,mobjects=base+([page] if page is not None else []))
        return renderer.get_frame().astype(np.uint16)
    left,right=capture(previous),capture(target)
    caption_index=getattr(scene,'caption_index',None)
    tracker=ValueTracker(0)
    def blended_frame(*args,**kwargs):
        nonlocal left,right,caption_index
        if getattr(scene,'caption_index',None)!=caption_index:
            left,right=capture(previous),capture(target)
            caption_index=scene.caption_index
        weight=round(max(0,min(1,tracker.get_value()))*256)
        renderer.camera.pixel_array=((left*(256-weight)+right*weight)>>8).astype(np.uint8)
    renderer.update_frame=blended_frame
    try:
        scene.play(tracker.animate.set_value(1),run_time=duration,rate_func=smooth)
    finally:
        renderer.update_frame=original_update
        renderer.static_image=None
        scene.remove(tracker)
        scene.add(target)

