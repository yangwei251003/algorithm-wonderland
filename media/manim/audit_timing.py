"""Audit authored chapter timing without rendering or declaring perceptual quality."""
import json,math,sys
from pathlib import Path
from film_runtime import TraceFilm,replay_representatives,operation_key,explanation_pages,allocate_readable_pages,calculation_values,operands_per_page,event_modes
root=Path(__file__).resolve().parents[2]
scene=TraceFilm();rows=[]
ids=sys.argv[1:] or [r['id'] for r in json.loads((root/'qa/v2-teaching-contract.json').read_text(encoding='utf-8'))['rows']]
for algorithm in ids:
    p=root/'media/exports'/f'{algorithm}.film.json'
    package=json.loads(p.read_text(encoding='utf-8'))
    timing=json.loads((root/'media/films'/algorithm/'audio/aligned.json').read_text(encoding='utf-8'))
    byline={l['id']:l for l in timing['lines']};events={e['id']:e for e in package['run']['trace']['events']}
    seen=set();chapters=[];errors=[]
    for beat in package['beats']:
        ids=beat.get('caseEventIds',beat.get('eventIds',[]))
        if not ids:continue
        line=byline[beat['id']];duration=line['end']-line['start']
        active_events={e['id']:e for e in json.loads((p.parent/beat['caseFile']).read_text(encoding='utf-8'))['run']['trace']['events']} if beat.get('caseEventIds') else events
        selected=[active_events[i] for i in ids]
        sampled=replay_representatives(selected,max(2,int(duration*8)),seen);pages=[]
        for event in sampled:
            try:modes=event_modes(event,beat,seen,len(sampled),len(scene.comparison_candidates(event,beat)))
            except ValueError as error:errors.append({'beat':beat['id'],'error':str(error)});modes=[]
            seen.add(operation_key(event))
            pages.extend((event,mode,3 if mode!='compact' else 1,i==len(modes)-1) for i,mode in enumerate(modes))
        try:
            shown,frames=allocate_readable_pages(pages,duration,60)
            details=[n/60 for p,n in zip(shown,frames) if p[1]!='compact']
            chapters.append({'beat':beat['id'],'duration':round(duration,3),'primaryEvents':len(selected),'displayedEvents':len({p[0]['id'] for p in shown}),'detailPages':len(details),'minimumDetailSeconds':min(details) if details else None,'frameCount':sum(frames)})
        except ValueError as error:errors.append({'beat':beat['id'],'error':str(error)})
    rows.append({'id':algorithm,'chapters':chapters,'errors':errors})
report={'scope':'Checks actual renderer timing and explicit repeated-state sampling. 1.5 seconds is a minimum safety floor, not a claim of viewer comprehension or complete visual review.','rows':rows,'passed':not any(r['errors'] for r in rows)}
(root/'qa/v2-reading-time-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'count':len(rows),'passed':report['passed'],'errors':[{'id':r['id'],**e} for r in rows for e in r['errors']]},ensure_ascii=False))
sys.exit(0 if report['passed'] else 1)
