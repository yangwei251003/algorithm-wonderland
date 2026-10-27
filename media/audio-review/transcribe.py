"""Assistive speech-to-text inspection; never substitutes for human listening."""
import json,sys
from pathlib import Path
from faster_whisper import WhisperModel
root=Path(__file__).parent
model=WhisperModel('small',device='cpu',compute_type='int8',download_root=str(root/'models'),cpu_threads=4)
source=Path(sys.argv[1]);target=Path(sys.argv[2])
segments,info=model.transcribe(str(source),language='zh',beam_size=5,vad_filter=True,initial_prompt='算法奇境，K-means，BFS，A星，PID，SHA二五六，背包，距离平方和，质心。')
rows=[{'start':s.start,'end':s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob} for s in segments]
report={'source':str(source.resolve()),'method':'faster-whisper small CPU int8','limitation':'ASR output is fallible; does not verify subjective pronunciation, sound quality, or viewer understanding.','duration':info.duration,'segments':rows}
target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(target),'segments':len(rows),'duration':info.duration},ensure_ascii=False))
