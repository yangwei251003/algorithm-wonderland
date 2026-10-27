"""Bounded sequential production with resumable, explicit per-exhibit outcomes."""
import argparse,json,time,traceback
from pathlib import Path
from film import produce
root=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('stage',choices=['narration','draft','final']);p.add_argument('ids',nargs='+');args=p.parse_args()
report={'startedAt':time.strftime('%Y-%m-%dT%H:%M:%S'),'stage':args.stage,'rows':[]}
report_path=root/'qa'/f'v2-production-{args.stage}-{int(time.time())}.json'
for algorithm in args.ids:
    output=root/'media/films'/algorithm
    row={'algorithmId':algorithm,'status':'running'};report['rows'].append(row)
    try:
        result=produce(root/'media/exports'/f'{algorithm}.film.json',output,'final' if args.stage=='final' else 'draft',False,'zh-CN-YunyangNeural',args.stage=='narration')
        if args.stage=='narration':(output/'narration-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        row.update({'status':'produced','seconds':result.get('duration',result.get('proposedFilmSeconds'))})
    except Exception as error:row.update({'status':'failed','reason':str(error)})
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(row,ensure_ascii=False),flush=True)
print(json.dumps({'report':str(report_path),'produced':sum(r['status']=='produced' for r in report['rows']),'failed':sum(r['status']=='failed' for r in report['rows'])},ensure_ascii=False))
raise SystemExit(1 if any(r['status']=='failed' for r in report['rows']) else 0)
