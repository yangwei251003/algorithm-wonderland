"""Reject dense or unsupported chapter layouts before expensive final rendering."""
import sys,json,math,time
from pathlib import Path
from film_contract import load_package
from film_runtime import TraceFilm,explanation_pages,calculation_values,operands_per_page
root=Path(__file__).resolve().parents[2]
results=[]
for algorithm in sys.argv[1:]:
    row={'algorithmId':algorithm,'checks':0,'errors':[]}
    try:
        file=root/'media/exports'/f'{algorithm}.film.json';package=load_package(file)
        if set(package.get('artwork',{}))!={'analogy','rules','summary'}:raise ValueError('All three final artworks must be available for a visual preflight')
        scene=TraceFilm();scene.package_dir=file.parent
        events={e['id']:e for e in package['run']['trace']['events']};rules={r['id']:r for r in package['lesson']['rules']}
        for beat in package['beats']:
            try:
                if beat.get('_case') and not beat.get('caseEventIds'):
                    case=beat['_case'];e=case['run']['trace']['events'][-1]
                    scene.event_page(e,case['run'],{r['id']:r for r in case['lesson']['rules']},beat,None,'case',True);row['checks']+=1
                elif beat.get('eventIds') or beat.get('caseEventIds'):
                    active_run=beat['_case']['run'] if beat.get('_case') else package['run']
                    active_rules={r['id']:r for r in beat['_case']['lesson']['rules']} if beat.get('_case') else rules
                    active_events={e['id']:e for e in active_run['trace']['events']}
                    selected=[active_events[i] for i in beat.get('caseEventIds',beat.get('eventIds',[]))];by_rule={}
                    for e in selected:by_rule.setdefault(e['ruleId'],[]).append(e)
                    chosen={e['id']:e for group in by_rule.values() for e in [group[0],group[-1],max(group,key=lambda x:len(json.dumps(x.get('calculation',{}))))]}
                    for e in chosen.values():
                        modes=['rule:'+str(i) for i in range(len(explanation_pages(e['explanation'])))]+['compact']
                        if e.get('calculation'):modes.extend('calculation:'+str(i) for i in range(max(1,math.ceil(len(calculation_values(e,beat))/operands_per_page(beat)))))
                        if e.get('candidates'):modes.extend('comparison:'+str(i) for i in range(len(scene.comparison_candidates(e,beat))))
                        if beat.get('pageModes'):modes=[m for m in modes if m.split(':')[0] in beat['pageModes']]
                        for mode in modes:
                            scene.event_page(e,active_run,active_rules,beat,None,mode,True);row['checks']+=1
                else:
                    role='analogy' if beat['kind']=='analogy' else 'summary' if beat['kind']=='summary' else 'rules'
                    panels=package.get('artworkPanels',{}).get(role,[[0,.08,1,.348],[0,.355,1,.622],[0,.63,1,.885]])
                    for i,panel in enumerate([beat['artworkRegion']] if beat.get('artworkRegion') else panels):
                        scene.concept_page({**beat,'artworkRegion':panel,'panelIndex':i},package,rules);row['checks']+=1
            except Exception as error:row['errors'].append({'beat':beat['id'],'error':str(error)})
    except Exception as error:row['errors'].append({'error':str(error)})
    results.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
(root/'qa/v2-film-preflight-latest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'qa'/f'v2-film-preflight-{time.time_ns()}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
sys.exit(1 if any(r['errors'] for r in results) else 0)
