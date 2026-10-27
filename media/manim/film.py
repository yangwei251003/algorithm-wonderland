"""Prepare authored narration, render immutable trace data, and verify final media."""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import imageio_ffmpeg
from film_contract import load_package,spoken_lines
from render import probe
from tts import synthesize


def produce(input_path:Path, output:Path, quality:str, technical:bool, voice:str, narration_only:bool):
    package=load_package(input_path)
    if not narration_only:
        review_path=input_path.parent.parent/'comics'/package['algorithm']['id']/'review.json'
        review=json.loads(review_path.read_text(encoding='utf-8'))
        approved={c['role'] for c in review.get('comics',[]) if c.get('status')=='passed'}
        if approved!={'analogy','rules','summary'} or set(package.get('artwork',{}))!={'analogy','rules','summary'}:
            raise ValueError('Final artwork must contain all 3 individually reviewed roles before rendering')
        if review.get('traceHash')!=package.get('traceHash') or review.get('lessonVersion')!=package['lesson']['version']:
            raise ValueError('Artwork review refers to a different teaching case/version')
    output.mkdir(parents=True,exist_ok=True)
    lines_file=output/"lines.json"
    lines_file.write_text(json.dumps(spoken_lines(package),ensure_ascii=False,indent=2),encoding="utf-8")
    audio=output/"audio"
    alignment=asyncio.run(synthesize(lines_file,audio,voice,"+0%"))
    duration=alignment["duration"]+1.2
    transcript=[package['algorithm']['name']+'｜算法奇境原理短片','教学版本：'+str(package['lesson']['version']),'计算记录指纹：'+package.get('traceHash',''),'']
    for beat,line in zip(package['beats'],alignment['lines']):
        transcript.extend([f"{int(line['start']//60):02}:{int(line['start']%60):02}  {beat.get('title',beat['id'])}",beat['text'],''])
    transcript.extend(['精确变体：'+package['lesson']['variant'],'类比边界：'+package['lesson']['analogy']['limit'],'','原理与视觉参考：'])
    transcript.extend(r['title']+' — '+r['url'] for r in package['lesson'].get('references',[]))
    (output/'transcript.txt').write_text('\n'.join(transcript),encoding='utf-8')
    if not technical and not 90<=duration<=150:
        raise ValueError(f"Authored narration gives {duration:.2f}s. Rewrite beats to fit 90–150s; this pipeline never silently speeds up speech.")
    if narration_only:return {"narrationSeconds":alignment["duration"],"proposedFilmSeconds":duration}
    env=os.environ.copy()
    env["ALGORITHM_FILM_PACKAGE"]=str(input_path)
    env["ALGORITHM_FILM_AUDIO"]=str(audio)
    work=output/"manim"
    flag,dimensions=("-qh","1080p60") if quality=="final" else ("-ql","480p15")
    begin=time.monotonic()
    source_names=['film_runtime.py','visuals.py','principle_visuals.py','film_contract.py','decision_visuals.py']
    source_names.extend(p.name for p in Path(__file__).parent.glob('*_principle_visuals.py'))
    if Path(__file__).with_name('fast_dissolve.py').exists():source_names.append('fast_dissolve.py')
    render_sources={name:hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest() for name in source_names}
    render_sources['teaching-labels.json']=hashlib.sha256((Path(__file__).resolve().parents[2]/'src/content/teaching-labels.json').read_bytes()).hexdigest()
    source_snapshot=output/'render-source';source_snapshot.mkdir(exist_ok=True)
    for name in render_sources:
        source=(Path(__file__).resolve().parents[2]/'src/content'/name) if name=='teaching-labels.json' else Path(__file__).with_name(name)
        (source_snapshot/name).write_bytes(source.read_bytes())
    artwork_files={role:hashlib.sha256((input_path.parent/file).resolve().read_bytes()).hexdigest() for role,file in package.get('artwork',{}).items()}
    with (output/"render.log").open("w",encoding="utf-8") as log:
        subprocess.run([sys.executable,"-X","utf8","-m","manim",flag,"--disable_caching","--media_dir",str(work),"--verbosity","WARNING",str(Path(__file__).with_name("film_runtime.py")),"TraceFilm"],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    silent=work/"videos/film_runtime"/dimensions/"TraceFilm.mp4"
    final=output/"final.mp4"
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg,"-hide_banner","-loglevel","error","-y","-i",str(silent),"-i",str(audio/"voice.wav"),"-i",str(audio/"captions.srt"),"-map","0:v:0","-map","1:a:0","-map","2:s:0","-c:v","copy","-video_track_timescale","60" if quality=='final' else "15","-c:a","aac","-b:a","128k","-c:s","mov_text","-metadata:s:s:0","language=zho","-movflags","+faststart",str(final)],check=True)
    report=probe(final)
    if not technical and not 90<=report["duration"]<=150:raise ValueError("Rendered duration outside 90–150s")
    if abs(report["duration"]-duration)>.5:raise ValueError("Animation duration drift exceeds 0.5s")
    report.update({"algorithmId":package["algorithm"]["id"],"lessonVersion":package["lesson"]["version"],"traceHash":package.get("traceHash"),"inputSha256":hashlib.sha256(input_path.read_bytes()).hexdigest(),"additionalCases":[{"file":b["caseFile"],"traceHash":b["_case"].get("traceHash"),"sha256":hashlib.sha256(Path(b["_casePath"]).read_bytes()).hexdigest()} for b in package["beats"] if b.get("_case")],"renderSeconds":round(time.monotonic()-begin,2),"technicalSample":technical,"chapters":[{"id":b["id"],"title":b.get("title",b["kind"]),"start":a["start"],"eventIds":b.get("eventIds",[]),**({"caseFile":b["caseFile"]} if b.get("caseFile") else {})} for b,a in zip(package["beats"],alignment["lines"])],"reviewStatus":"awaiting visual and listening review"})
    report.update({'quality':quality,'renderSources':render_sources,'artworkHashes':artwork_files})
    timeline_path=output/'visual-timeline.json'
    if timeline_path.exists():report['visualTimelineSha256']=hashlib.sha256(timeline_path.read_bytes()).hexdigest()
    stills=output/"review";stills.mkdir(exist_ok=True)
    for index,line in enumerate(alignment["lines"]):
        when=max(line["start"],line["end"]-.3)
        subprocess.run([ffmpeg,"-hide_banner","-loglevel","error","-y","-ss",str(when),"-i",str(final),"-frames:v","1",str(stills/f"{index+1:02}-{line['id']}.png")],check=True)
    subprocess.run([ffmpeg,"-hide_banner","-loglevel","error","-y","-ss",str(min(2,report["duration"]/4)),"-i",str(final),"-frames:v","1",str(output/"poster.png")],check=True)
    # Publish readiness only after every linked viewing asset actually exists.
    report_pending=output/'report.building.json'
    report_pending.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    report_pending.replace(output/'report.json')
    return report


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("input",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--quality",choices=["draft","final"],default="draft")
    parser.add_argument("--technical",action="store_true",help="Explicitly marks a pipeline sample; never use for a published lesson")
    parser.add_argument("--narration-only",action="store_true")
    parser.add_argument("--voice",default="zh-CN-YunyangNeural")
    args=parser.parse_args()
    print(json.dumps(produce(args.input.resolve(),args.output.resolve(),args.quality,args.technical,args.voice,args.narration_only),ensure_ascii=False))
