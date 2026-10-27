"""Local, verified theme archives. Publishing is a separate explicit final step."""
import argparse,json,time
from media_archive import read,asset,validate_movie,split_assets,archive
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--review',action='store_true');parser.add_argument('--category',type=int,choices=range(1,13));args=parser.parse_args()
ledger=json.loads((root/'qa/v2-production-ledger.json').read_text(encoding='utf-8'))
if not args.review and not ledger['complete']:raise SystemExit('全量验收尚未通过，不能制作正式发布素材包。')
research=json.loads((root/'docs/research-v2/research-index.json').read_text(encoding='utf-8'))
exports={r['id']:r for r in research['algorithms']}
output=root/('media/packages-review' if args.review else 'media/packages');output.mkdir(parents=True,exist_ok=True)
manifest={'builtAt':time.strftime('%Y-%m-%dT%H:%M:%S'),'status':'review-only' if args.review else 'accepted','archives':[]}
cases={r['id']:r for r in read(root/'qa/v2-teaching-contract.json')['rows']}
for category in ([args.category] if args.category else range(1,13)):
    rows=[r for r in ledger['rows'] if exports[r['id']]['category']==category]
    accepted=[r for r in rows if r['comics']==3 and r['technicalFilm'] and not r.get('held',False) and (args.review or r['filmPassed'])]
    if not accepted:continue
    if not args.review and len(accepted)!=7:raise ValueError(f'Theme {category} has incomplete media')
    all_files=[];bindings=[]
    for item in accepted:
        identifier=item['id'];report=validate_movie(root,identifier,cases[identifier],args.review)
        for role in ['analogy','rules','summary']:
            expected=report.get('artworkHashes',{}).get(role)
            if not expected:raise ValueError(identifier+': comic fingerprint missing')
            all_files.append(asset(root/f'media/comics/{identifier}/{role}.png',f'{identifier}/漫画/{role}.png',expected))
        for source,target in [('final.mp4','原理短片.mp4'),('audio/voice.wav','中文配音.wav'),('audio/captions.vtt','中文字幕.vtt'),('audio/captions.srt','中文字幕.srt'),('transcript.txt','讲解文字稿.txt')]:
            all_files.append(asset(root/f'media/films/{identifier}/{source}',f'{identifier}/{target}',report['sha256'] if source=='final.mp4' else None))
        bindings.append({'id':identifier,'movieSha256':report['sha256'],'inputSha256':report['inputSha256'],'traceHash':report['traceHash']})
    parts=split_assets(all_files)
    for index,files in enumerate(parts):
        stem=f'algorithm-wonderland-v2-theme-{category:02}'+(f'-part-{index+1:02}' if len(parts)>1 else '')
        notice='算法奇境2.0主题素材：漫画、原理短片、配音、字幕、文字稿和来源。\n'+('制作中审查包：尚未通过全量视听验收，不代表完整交付。\n' if args.review else '正式验收版本。\n')+f'本主题共{len(parts)}个普通ZIP，这是第{index+1}个。请下载全部分包，解压到同一目录。\n'
        record=archive(output,stem,files,{'bindings':bindings,'research':[exports[r['id']] for r in accepted]},notice)
        record.update({'category':category,'part':index+1,'parts':len(parts),'exhibits':[r['id'] for r in accepted]})
        manifest['archives'].append(record);print(json.dumps(record,ensure_ascii=False),flush=True)
name=f'manifest-theme-{args.category:02}.json' if args.category else 'manifest.json'
pending=output/(name+'.building');pending.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');pending.replace(output/name)
