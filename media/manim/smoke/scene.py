"""Original technical smoke scene; timing transcribed from decoded TTS and word boundaries."""
from manim import *

BG = "#08131F"
INK = "#F4F7FB"
MUTED = "#A9BBCB"
TEAL = "#49D6BE"
GOLD = "#F6BA6F"
RULE = "#284353"
FONT = "Microsoft YaHei"


def label(text, size=28, color=INK):
    return Text(text, font=FONT, font_size=size, color=color)


class CapabilitySmoke(Scene):
    def construct(self):
        self.camera.background_color = BG
        # aligned.json: intro 0–3.792; formula 3.792–8.160; summary 8.160–10.776.
        # Word times: move=2.8875; 3=4.542; 4=6.142; 7=7.292.
        def until(t):
            remaining = t - self.time
            if remaining > 0:
                self.wait(remaining)

        def caption(text):
            if hasattr(self, "caption_label"):
                self.remove(self.caption_label)
            self.caption_label = label(text, 27).move_to([0, -3.12, 0])
            if self.caption_label.width > 12.3:
                self.caption_label.scale_to_fit_width(12.3)
            self.add(self.caption_label)

        title = label("让变化有依据", 44).move_to([0, 2.72, 0])
        eyebrow = label("算法奇境  /  制作链技术验证", 18, MUTED).move_to([0, 3.42, 0])
        bottom = RoundedRectangle(width=13.1, height=.78, corner_radius=.13, stroke_width=0, fill_color="#122434", fill_opacity=1).move_to([0, -3.12, 0])
        self.add(title, eyebrow, bottom)
        caption("制作能力测试：青色节点沿连线移动。")

        a = np.array([-5.1, .35, 0])
        b = np.array([-2.4, .35, 0])
        c = np.array([-.8, 1.25, 0])
        route = Line(a, b, color=RULE, stroke_width=7)
        guess = DashedLine(b, c, color=RULE, dash_length=.13, stroke_width=4)
        nodes = VGroup(*[Circle(radius=.25, stroke_color=MUTED, stroke_width=3, fill_color=BG, fill_opacity=1).move_to(point) for point in [a,b,c]])
        self.add(route, guess, nodes)
        self.add(label("起点", 21, MUTED).move_to(a + DOWN*.65), label("当前", 21, MUTED).move_to(b + DOWN*.65), label("目标", 21, MUTED).move_to(c + UP*.55))
        self.add(label("实线：已经走过", 19, MUTED).move_to([-3.9,-1.1,0]), label("虚线：距离预估", 19, MUTED).move_to([-3.9,-1.5,0]))
        panel = RoundedRectangle(width=5.8, height=2.7, corner_radius=.23, stroke_color=RULE, stroke_width=2, fill_color="#102332", fill_opacity=1).move_to([3.2,.35,0])
        self.add(panel, label("评分 = 已走距离 + 预估距离", 24).move_to([3.2,1.25,0]))
        placeholders = VGroup(*[Line([x-.3,.05,0], [x+.3,.05,0], color=RULE, stroke_width=3) for x in [1.65,3.2,4.75]])
        self.add(placeholders)

        until(1.2625)
        marker = Dot(a, radius=.18, color=TEAL)
        self.play(FadeIn(marker), run_time=.3)
        until(2.8875)
        self.play(marker.animate.move_to(b), route.animate.set_color(TEAL), run_time=.6, rate_func=smooth)
        until(3.792)
        caption("已走距离三，加上预估距离四，得到评分七。")
        until(4.542)
        three = label("3", 53, TEAL).move_to([1.65,.38,0])
        self.play(FadeIn(three), run_time=.23)
        until(4.9795)
        self.play(FadeIn(label("+", 38, MUTED).move_to([2.4,.38,0])), run_time=.2)
        until(6.142)
        four = label("4", 53, GOLD).move_to([3.2,.38,0])
        self.play(FadeIn(four), guess.animate.set_color(GOLD), run_time=.23)
        until(6.917)
        self.play(FadeIn(label("=", 38, MUTED).move_to([3.95,.38,0])), run_time=.2)
        until(7.292)
        seven = label("7", 53, INK).move_to([4.75,.38,0])
        self.play(FadeIn(seven), run_time=.23)
        until(8.16)
        caption("动作与字幕，保持同步。")
        self.play(FadeIn(label("中文  ·  数值  ·  动作  ·  语音", 25, TEAL).move_to([1.2,-1.85,0])), run_time=.6)
        until(10.776)
        caption("技术样片 · 非完整算法课程")
        self.wait(1.2)
