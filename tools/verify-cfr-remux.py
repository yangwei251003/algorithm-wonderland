"""Verify lossless remux onto the authored 60 Hz timestamp grid."""
import subprocess,json,hashlib
from pathlib import Path
import av,imageio_ffmpeg
root=Path(__file__).resolve().parents[1]
source=root/'qa/fast-dissolve-caption/videos/qa_fast_dissolve/1080p60/FastDissolveCaptionCheck.mp4'
target=source.with_name('cfr-copy.mp4')
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(source),'-map','0:v:0','-c:v','copy','-video_track_timescale','60',str(target)],check=True)
def inspect(path):
    with av.open(str(path)) as container:
        stream=container.streams.video[0]
        frames=list(container.decode(video=0))
        return {'fps':float(stream.average_rate),'frames':len(frames),'times':[float(f.time) for f in frames],'decodedSha256':hashlib.sha256(b''.join(f.to_ndarray(format='rgb24').tobytes() for f in frames)).hexdigest()}
before,after=inspect(source),inspect(target)
assert before['frames']==after['frames'] and before['decodedSha256']==after['decodedSha256']
assert after['fps']==60 and all(abs(t-i/60)<1e-7 for i,t in enumerate(after['times']))
report={'source':str(source),'target':str(target),'before':before,'after':after,'passed':True,'documentation':'https://ffmpeg.org/ffmpeg.html','meaning':'Same decoded pixels and frame count; container timestamps snap to the originally authored 60 Hz grid. No interpolation, duplication or frame removal.'}
(root/'qa/v2-cfr-remux-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'originalFps':before['fps'],'outputFps':after['fps'],'identicalDecodedFrames':after['frames']}))
