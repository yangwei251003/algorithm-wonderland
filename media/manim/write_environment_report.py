from datetime import datetime, timedelta, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import subprocess
import imageio_ffmpeg
import manimpango

base = Path(__file__).resolve().parent
skills = json.loads((base / "skill-sources.json").read_text(encoding="utf-8"))
for skill in skills["skills"]:
    path = Path(skill["installed"]) / "SKILL.md"
    skill["exists"] = path.is_file()
    skill["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
render = json.loads((base / "smoke/final/report.json").read_text(encoding="utf-8"))
assert render["width"] == 1920 and render["height"] == 1080 and render["fps"] == 60
assert 10 <= render["duration"] <= 15 and render["completeDecode"] and render["audioRms"] > 0
assert {s["type"] for s in render["streams"]} == {"video", "audio", "subtitle"}
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
report = {
    "checkedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "gate": "passed",
    "scope": "Manim production capability smoke, not an algorithm lesson",
    "python": platform.python_version(),
    "pythonExecutable": str(base / ".venv/Scripts/python.exe"),
    "packages": {name: importlib.metadata.version(name) for name in ["manim", "av", "edge-tts", "imageio-ffmpeg", "manimpango", "pycairo", "pillow"]},
    "ffmpeg": {"path": ffmpeg, "version": subprocess.check_output([ffmpeg,"-version"], text=True).splitlines()[0]},
    "font": {"family":"Microsoft YaHei", "verifiedWithPango":"Microsoft YaHei" in manimpango.list_fonts()},
    "skillSources": skills["skills"],
    "sample": render,
    "visualReview": {"passed":True,"framesSeconds":[3.6,4.2,4.9,6.5,7.7,9.0,11.2],"checks":["Chinese glyphs readable", "no label overlap", "3 + 4 = 7 accurate", "numerals revealed after corresponding TTS word boundary", "subtitle band clear of diagram"]},
    "narration": {"provider":"edge-tts", "voice":"zh-CN-YunyangNeural", "actualSeconds":10.776, "timing":"decoded PCM durations and provider word boundaries", "decoded":True, "auditoryReview":"not performed; audio signal and decoding validated"},
    "compatibility": {"pillow":"Pinned <13, locked to 12.3.0 because Manim 0.22 Cairo ImageMobject uses Image.fromarray mode conversion removed in Pillow 13", "reference":"https://pillow.readthedocs.io/en/stable/deprecations.html#image-fromarray-mode-parameter"},
    "limitations":["LaTeX/MathTex not installed or claimed; this pipeline uses Text and vector formula layout", "Technical sample proves capability, not quality or completeness of 84 future lessons", "Cloud TTS availability depends on network; existing audio is cached locally"]
}
target = base.parents[1] / "qa/v2-env-manim.json"
target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"gate":report["gate"],"report":str(target)},ensure_ascii=False))
