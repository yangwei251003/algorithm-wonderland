# 算法奇境 Manim 制作环境

使用项目内 Python 3.12 隔离环境，不改系统默认解释器。所有实现为本项目原创，第三方技能仅安装在用户技能目录并作为制作参考。

## 复现技术验证

在本目录运行：

```powershell
uv sync --python 'C:\Program Files\Python312\python.exe'
uv run python tts.py smoke/lines.json smoke/audio
uv run python render.py smoke/scene.py CapabilitySmoke smoke/audio smoke/draft
uv run python render.py smoke/scene.py CapabilitySmoke smoke/audio smoke/final --quality final
uv run python write_environment_report.py
```

`tts.py` 输入 `[{id,text,chapter?,caption?}]`，生成逐行音频、按解码样本测量的 `aligned.json`、逐词时标、整段 `voice.wav`、VTT/SRT。相同文本/音色/语速保留已合成音频。

`render.py` 接收场景脚本、场景类、配音目录、输出目录，渲染后混入音轨和字幕轨，检查完整解码并提取核对静帧。教学字幕同时在画面中显示，VTT/SRT可独立使用。

技术样片为 `smoke/final/capability-smoke.mp4`，1920×1080、60fps、约12秒。它只验证制作能力，不计入84项课程。环境证据位于项目 `qa/v2-env-manim.json`。

公式用中文Text和原创矢量排版；没有声称安装MathTex/LaTeX。后续分数和矩阵通过明确的行列、分子分母和分隔线呈现。真实课程由同源算法轨迹驱动，不在Python内另算算法。

本地 `.venv`、渲染缓存和技能安装目录不应打包进公开站点或源码压缩包。保留 `pyproject.toml` 和 `uv.lock` 即可复现依赖。云端TTS仅在制作时使用，已导出的片子离线观看不依赖它。

## 消费真实算法数据

`film.py` 接收主程序导出的 `film.json`，其 `lesson`、`run.frames`、`run.trace` 直接使用现有 TypeScript 协议；Python 不实现另一套算法。

```powershell
uv run python -X utf8 film.py ../exports/kmeans.film.json ../films/kmeans --narration-only
uv run python -X utf8 film.py ../exports/kmeans.film.json ../films/kmeans --quality draft
uv run python -X utf8 film.py ../exports/kmeans.film.json ../films/kmeans --quality final
```

正式输出必须90–150秒，超出时要求重写脚本，不会强制加速音频。`--technical`只用于能力样片，输出报告明确标记，不能把它当正式片。

最小导出结构：

```json
{
  "schemaVersion": 1,
  "algorithm": {"id":"bfs", "name":"广度优先搜索"},
  "lesson": {},
  "run": {},
  "traceHash": "主程序生成的轨迹哈希",
  "pronunciations": {"BFS":"广度优先搜索"},
  "beats": [{"id":"step-1", "kind":"event", "title":"先取队首", "text":"中文旁白原文", "eventIds":["0"]}]
}
```

`lesson/run`必须提供完整接口对象，上例空对象仅说明字段位置。`beats.kind`支持 analogy、rule、event、comparison、recap、summary。可选 `ruleIds`绑定规则；`speechText`覆盖该段的读音稿，字幕仍用`text`。`pronunciations`只作用于合成语音。

事件画面来自 `event.scene`，缺省则取 `run.frames[event.frameIndex].scene`。加载器会重放状态变化，拒绝前后状态不一致、未知规则、缺失帧和不完整轨迹。非有限数以 `{"$number":"Infinity"}` / `"-Infinity"` / `"NaN"`编码，避免JSON把无穷大转为null。

多个 `eventIds`表示明确的重复规则快进。屏幕标出真实记录数和回放步速；超过每秒8个状态时按均匀索引显示真实代表状态，并明确标出代表状态数，完整步骤保留网页。它不推算或虚构中间状态。候选超过3个时标明仅显示对照3项；`candidateTargets`可指定需要解释的候选。

类比段可选 `artwork`（相对导出JSON目录的本地图片路径）与 `mappingIndices`，将已生成漫画与一一对应的算法概念并排显示。素材路径缺失会报错，不用占位图替代。

顶层 `artwork:{analogy,rules,summary}` 同样接受绝对路径。竖向组图请提供 `artworkPanels:{analogy:[[x0,y0,x1,y1],...],summary:[...]}`，区域均为0–1归一化坐标；视频按分镜顺序显示，原图文件不被修改。每段默认在分镜间均分时间，若讲解需要更精确的分镜节奏，应拆成多个旁白 beat。原术语保留在字幕里，读音替换只作用于语音；字幕按照实际 TTS 单词边界分页。

第一次出现的规则分成“为什么 → 代入数值 → 候选比较”三页。重复规则显示真实状态连续变化并标明记录数/回放步速。数学散点使用固定、同尺度坐标轴，避免每帧重定中心；中心和点标签做显示层避让。相容矢量状态用 `Transform`，像素图和漫画用淡入，数值均来自原始 Scene。

独立反例用 `caseFile:'kmeans-counterexample.json'` 指向另一个完整导出（同样含schemaVersion、algorithm、lesson、run、traceHash，不要求beats）。这个 beat 必须移除主案例 `eventIds`，默认取独立 trace 的最终事件。可用 `caseLabel` 明确标识“另一组输入”，`caseExplanation` 写原因；不能把主案例状态当作反例。加载器检查独立案例的完整轨迹和状态重放；报告保留该文件 hash，主案例 coverage 不混入它的事件。

每个输出目录含 `audio`（可恢复的逐段配音缓存）、`final.mp4`、`poster.png`、`review` 静帧、`report.json`、`render.log`。草稿和正式渲染都写同名 `final.mp4`，以 `report.json` 实际分辨率为准；交付前必须为1920×1080、60fps。不要仅按文件名判断高清。每次正式完成都会完整解码视频/音轨、校验90–150秒及字幕轨。报告中的 `reviewStatus` 默认待审，自动解码不替代视觉和听感审查。

批量调度先逐片 `--narration-only` 检查时长；超150秒返回修改文案，不自动压缩语速。相同旁白缓存复用；音频与绘图独立，但同一输出目录只允许一个写入进程。建议同时最多一个1080p60渲染，避免本机CPU/内存竞争。K-means 141秒草稿首轮约162秒，高清耗时以实际 report 为准。复杂像素/粒子场景应先审查 draft；目前大的矢量网格仍较慢。边界案例、视频画面、来源和实际配音需逐片审查，不能把技术验证当84项内容全部验收。

`visuals.py`支持全部10种Scene、RGBA像素、CSS hsl/rgba、等比例数学散点、正负条形、矩阵与分数矢量排版。排版超过可读空间直接报错，要求拆分脚本；不静默删字。`adapter_smoke.py`提供十类技术样图，`test_pipeline.py`验证状态重放、错误拒绝、无穷大和读音与字幕分离。

Manim 0.22的图片层与Pillow13的已移除模式转换不兼容，依赖限制Pillow<13，锁定12.3.0。仅项目环境受影响。
