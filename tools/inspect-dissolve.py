"""Decode a short technical transition and preserve review frames."""
import av,json,sys
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
caption='--caption' in sys.argv
source=root/('qa/fast-dissolve-caption/videos/qa_fast_dissolve/1080p60/FastDissolveCaptionCheck.mp4' if caption else 'qa/fast-dissolve/videos/qa_fast_dissolve/1080p60/FastDissolveCheck.mp4')
out=root/('qa/fast-dissolve-caption/review' if caption else 'qa/fast-dissolve/review');out.mkdir(exist_ok=True)
times=[.13,.4,.8] if caption else [.4,1.25,1.6];frames=[];selected={}
with av.open(str(source)) as container:
    stream=container.streams.video[0]
    fps=float(stream.average_rate)
    for index,frame in enumerate(container.decode(video=0)):
        for when in times:
            if when not in selected and index>=round(when*fps):
                img=frame.to_image();img.save(out/f'{when}.png');selected[when]=img
        frames.append(index)
canvas=Image.new('RGB',(960,3*580),(8,20,30));draw=ImageDraw.Draw(canvas)
for i,when in enumerate(times):
    img=selected[when].resize((960,540));canvas.paste(img,(0,i*580));draw.text((15,i*580+545),f'{when} seconds',fill='white')
canvas.save(out/'contact.jpg')
report={'technicalOnly':True,'duration':len(frames)/fps,'fps':fps,'frames':len(frames),'viewTimes':times,'visualReview':'pending'}
(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
