"""Full-track speech recognition for assistive review, with a cached local model."""
import json,sys,time,hashlib
from pathlib import Path
from faster_whisper import WhisperModel
root=Path(__file__).resolve().parents[2]
model=WhisperModel('small',device='cpu',compute_type='int8',download_root=str(Path(__file__).parent/'models'),cpu_threads=2)
for algorithm in sys.argv[1:]:
    source=root/'media/films'/algorithm/'audio/voice.wav';target=root/'qa'/f'v2-{algorithm}-asr.json'
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    if target.exists() and json.loads(target.read_text(encoding='utf-8')).get('sourceSha256')==digest:
        print(json.dumps({'algorithm':algorithm,'cached':True}),flush=True);continue
    begin=time.monotonic()
    segments,info=model.transcribe(str(source),language='zh',beam_size=5,vad_filter=True,initial_prompt='算法奇境，K-means，BFS，A星，PID，SHA二五六，背包，距离平方和，质心。')
    rows=[{'start':s.start,'end':s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob} for s in segments]
    report={'source':str(source),'sourceSha256':digest,'method':'faster-whisper small CPU int8','limitation':'Full-track ASR is fallible. It assists checking spoken facts; it cannot verify subjective sound quality, naturalness, or viewer comprehension.','duration':info.duration,'segments':rows,'processingSeconds':round(time.monotonic()-begin,2)}
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'algorithm':algorithm,'segments':len(rows),'duration':info.duration,'seconds':report['processingSeconds']},ensure_ascii=False),flush=True)
