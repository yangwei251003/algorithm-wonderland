"""Original Manim render/mux/probe utility. Does not modify runtime installations."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

import av
import imageio_ffmpeg
import numpy as np


def probe(path: Path, decode: bool = True) -> dict:
    with av.open(str(path)) as container:
        streams = [{"type": s.type, "codec": s.codec_context.name, "duration": float(s.duration*s.time_base) if s.duration is not None else None} for s in container.streams]
        video = container.streams.video[0]
        report = {"file": str(path.resolve()), "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "width": video.width, "height": video.height, "fps": float(video.average_rate), "duration": container.duration/av.time_base, "streams": streams}
    if decode:
        with av.open(str(path)) as container:
            video_frames = sum(1 for _ in container.decode(video=0))
        with av.open(str(path)) as container:
            energy = 0.0
            samples = 0
            audio_frames = 0
            for frame in container.decode(audio=0):
                data = frame.to_ndarray().astype(np.float64)
                energy += np.square(data).sum()
                samples += data.size
                audio_frames += 1
        report.update({"decodedVideoFrames": video_frames, "decodedAudioFrames": audio_frames, "audioRms": float(np.sqrt(energy/max(samples,1))), "completeDecode": True})
    return report


def render(scene: Path, scene_class: str, audio_dir: Path, output: Path, quality: str) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    work = output / "manim"
    started = time.monotonic()
    flag, dimensions = ("-qh", "1080p60") if quality == "final" else ("-ql", "480p15")
    command = [sys.executable, "-m", "manim", flag, "--disable_caching", "--media_dir", str(work), "--verbosity", "WARNING", str(scene), scene_class]
    with (output / "render.log").open("w", encoding="utf-8") as log:
        subprocess.run(command, check=True, stdout=log, stderr=subprocess.STDOUT)
    video = work / "videos" / scene.stem / dimensions / f"{scene_class}.mp4"
    if not video.is_file():
        raise FileNotFoundError(f"Expected exact Manim output: {video}")
    final = output / "capability-smoke.mp4"
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(video), "-i", str(audio_dir / "voice.wav"), "-i", str(audio_dir / "captions.srt"), "-map", "0:v:0", "-map", "1:a:0", "-map", "2:s:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-c:s", "mov_text", "-metadata:s:s:0", "language=zho", "-movflags", "+faststart", str(final)], check=True)
    report = probe(final)
    report["renderWallSeconds"] = round(time.monotonic()-started, 2)
    report["source"] = str(scene.resolve())
    report["quality"] = quality
    (output / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    for seconds in [3.6, 4.2, 4.9, 6.5, 7.7, 9.0, 11.2]:
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(seconds), "-i", str(final), "-frames:v", "1", str(output / f"frame-{seconds:.1f}.png")], check=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("scene", type=Path)
    parser.add_argument("scene_class")
    parser.add_argument("audio", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--quality", choices=["draft","final"], default="draft")
    args = parser.parse_args()
    print(json.dumps(render(args.scene.resolve(), args.scene_class, args.audio.resolve(), args.output.resolve(), args.quality), ensure_ascii=False))
