"""Full-resolution cache for static Manim pages during short transitions."""
from manim import Camera,ImageMobject,config,Animation

class FadePixels(Animation):
    """Fade alpha only; never interpolate millions of unchanged RGB samples."""
    def __init__(self,mobject,appearing=True,**kwargs):
        self.original_alpha=mobject.pixel_array[:,:,3].copy()
        self.appearing=appearing
        super().__init__(mobject,**kwargs)
    def interpolate_mobject(self,alpha):
        opacity=alpha if self.appearing else 1-alpha
        self.mobject.pixel_array[:,:,3]=(self.original_alpha*opacity).astype(self.mobject.pixel_array_dtype)

def raster_page(mobject):
    camera=Camera(background_opacity=0,pixel_width=config.pixel_width,pixel_height=config.pixel_height,frame_width=config.frame_width,frame_height=config.frame_height)
    camera.capture_mobjects([mobject])
    return ImageMobject(camera.pixel_array.copy()).set_height(config.frame_height).move_to(camera.frame_center)
