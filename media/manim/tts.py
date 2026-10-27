"""Original, resumable line-based TTS utility. Audio timings come from decoded samples."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
from pathlib import Path
import subprocess
import wave

import edge_tts
import imageio_ffmpeg


def timestamp(seconds: float, separator: str = ".") -> str:
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}{separator}{milliseconds:03}"


def caption_cues(line):
    spoken_end=line.get('speechEnd',line['end'])
    caption=line.get("caption",line["text"])
    clauses=re.findall(r"[^，,。.!！？?；;]+[，,。.!！？?；;]?",caption)
    chunks=[]
    for clause in clauses:
        while len(clause)>28:
            chunks.append(clause[:28]);clause=clause[28:]
        if clause.strip():chunks.append(clause.strip())
    if not chunks:return []
    length=lambda value:len(re.sub(r"\W","",value,flags=re.UNICODE))
    total=max(1,sum(length(chunk) for chunk in chunks))
    words=line.get("words",[])
    word_total=max(1,sum(length(word["text"]) for word in words))
    starts=[];count=0
    for i,chunk in enumerate(chunks):
        target=count/total*word_total
        consumed=0;start=line["start"]
        for word in words:
            start=word["start"]
            if consumed+length(word["text"])>target:break
            consumed+=length(word["text"])
        if not words:start=line["start"]+count/total*(spoken_end-line["start"])
        starts.append(line["start"] if i==0 else max(starts[-1],min(start,spoken_end)))
        count+=length(chunk)
    cues=[]
    for i,chunk in enumerate(chunks):
        if cues and starts[i]==cues[-1]["start"]:cues[-1]["text"]+=chunk
        else:cues.append({"text":chunk,"start":starts[i]})
    for i,cue in enumerate(cues):cue["end"]=cues[i+1]["start"] if i+1<len(cues) else spoken_end
    if spoken_end<line['end']:cues.append({'text':'停一停，核对画面里的这组计算。','start':spoken_end,'end':line['end']})
    return cues


async def synthesize(lines_file: Path, output: Path, voice: str, rate: str) -> dict:
    lines = json.loads(lines_file.read_text(encoding="utf-8-sig"))
    if not isinstance(lines, list) or not lines:
        raise ValueError("Expected a nonempty list of narration lines")
    ids = [line["id"] for line in lines]
    if len(set(ids)) != len(ids) or any(not i.replace("-", "").replace("_", "").isalnum() for i in ids):
        raise ValueError("Line IDs must be unique safe names")
    output.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    chunks = []
    aligned = []
    cursor = 0.0
    sample_rate = 24000
    for line in lines:
        signature = hashlib.sha256(json.dumps([line["text"], voice, rate], ensure_ascii=False).encode()).hexdigest()
        mp3 = output / f"{line['id']}.mp3"
        wav = output / f"{line['id']}.wav"
        stamp = output / f"{line['id']}.sha256"
        word_file = output / f"{line['id']}.words.json"
        if not (mp3.exists() and stamp.exists() and word_file.exists() and stamp.read_text() == signature):
            async def download_line():
                words = []
                with mp3.open("wb") as audio:
                    async for event in edge_tts.Communicate(line["text"], voice, rate=rate, boundary="WordBoundary").stream():
                        if event["type"] == "audio":
                            audio.write(event["data"])
                        elif event["type"] == "WordBoundary":
                            words.append({"text": event["text"], "start": event["offset"] / 10000000, "duration": event["duration"] / 10000000})
                word_file.write_text(json.dumps(words, ensure_ascii=False, indent=2), encoding="utf-8")
            await asyncio.wait_for(download_line(), timeout=45)
            stamp.write_text(signature)
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp3), "-ar", str(sample_rate), "-ac", "1", "-c:a", "pcm_s16le", str(wav)], check=True)
        with wave.open(str(wav), "rb") as source:
            data = source.readframes(source.getnframes())
            duration = source.getnframes() / source.getframerate()
        speech_duration=duration
        hold=line.get('readingHoldSeconds',0)
        if not isinstance(hold,(int,float)) or not 0<=hold<=12:raise ValueError('Invalid explicit reading hold')
        if hold:
            data+=b'\x00\x00'*round(hold*sample_rate)
            duration+=round(hold*sample_rate)/sample_rate
        chunks.append(data)
        words = json.loads(word_file.read_text(encoding="utf-8"))
        aligned.append({**line, "start": round(cursor, 6), "end": round(cursor + duration, 6), "duration": round(duration, 6),**({'speechEnd':round(cursor+speech_duration,6)} if hold else {}), "words": [{**word, "start": round(cursor + word["start"], 6)} for word in words]})
        cursor += duration
    temporary_voice=output/'voice.building.wav'
    with wave.open(str(temporary_voice), "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        for chunk in chunks:
            destination.writeframes(chunk)
    temporary_voice.replace(output/'voice.wav')
    subtitle_cues=[cue for line in aligned for cue in caption_cues(line)]
    result = {"version": 1, "engine": "edge-tts", "voice": voice, "rate": rate, "duration": round(cursor, 6), "sampleRate": sample_rate, "lines": aligned, "cues":subtitle_cues}
    (output / "aligned.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    cues = [f"{timestamp(line['start'])} --> {timestamp(line['end'])}\n{line['text']}" for line in subtitle_cues]
    (output / "captions.vtt").write_text("WEBVTT\n\n" + "\n\n".join(cues) + "\n", encoding="utf-8")
    srt = [f"{i+1}\n{timestamp(line['start'], ',')} --> {timestamp(line['end'], ',')}\n{line['text']}" for i, line in enumerate(subtitle_cues)]
    (output / "captions.srt").write_text("\n\n".join(srt) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("lines", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--voice", default="zh-CN-YunyangNeural")
    parser.add_argument("--rate", default="+0%")
    args = parser.parse_args()
    report = asyncio.run(synthesize(args.lines.resolve(), args.output.resolve(), args.voice, args.rate))
    print(json.dumps({"duration": report["duration"], "lines": len(report["lines"]), "voice": report["voice"]}))
