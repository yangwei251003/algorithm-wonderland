"""Checks exported teaching records; intentionally contains no algorithm implementation."""
import json
import copy
import math
from pathlib import Path

KINDS = {"analogy","rule","event","comparison","recap","summary"}


def load_package(path: Path, require_beats: bool = True) -> dict:
    def number_tag(value):
        if set(value)=={"$number"}:
            names={"Infinity":float("inf"),"-Infinity":float("-inf"),"NaN":float("nan")}
            if value["$number"] not in names:raise ValueError("Invalid tagged number")
            return names[value["$number"]]
        return value
    package = json.loads(path.read_text(encoding="utf-8-sig"),object_hook=number_tag)
    if package.get("schemaVersion") != 1:
        raise ValueError("Unsupported film package schemaVersion")
    algorithm = package["algorithm"]
    lesson = package["lesson"]
    run = package["run"]
    trace = run["trace"]
    if algorithm["id"] != lesson["algorithmId"] or algorithm["id"] != trace["algorithmId"]:
        raise ValueError("Algorithm, lesson and trace IDs differ")
    if not trace.get("complete"):
        raise ValueError("An incomplete calculation trace cannot produce a final teaching film")
    events = {event["id"]:event for event in trace["events"]}
    if len(events) != len(trace["events"]):
        raise ValueError("Duplicate trace event IDs")
    rules = {rule["id"]:rule for rule in lesson["rules"]}
    for event in trace["events"]:
        if event["ruleId"] not in rules:
            raise ValueError(f"Unknown rule {event['ruleId']} in event {event['id']}")
        if not event.get("explanation"):
            raise ValueError(f"Missing explanation for event {event['id']}")
        event_scene(event,run)
    def equal(a,b):
        if isinstance(a,float) and isinstance(b,float) and math.isnan(a) and math.isnan(b):return True
        if isinstance(a,dict) and isinstance(b,dict):return a.keys()==b.keys() and all(equal(a[k],b[k]) for k in a)
        if isinstance(a,list) and isinstance(b,list):return len(a)==len(b) and all(equal(x,y) for x,y in zip(a,b))
        return a==b
    state=copy.deepcopy(trace["initialState"])
    for event in trace["events"]:
        for change in event["changes"]:
            if not equal(state.get(change["target"]),change["before"]):raise ValueError(f"Trace state mismatch at event {event['id']}: {change['target']}")
            state[change["target"]]=copy.deepcopy(change["after"])
    if not equal(state,trace["finalState"]):raise ValueError("Replayed state differs from exported finalState")
    if not require_beats:return package
    beats = package["beats"]
    if not beats or len({beat["id"] for beat in beats}) != len(beats):
        raise ValueError("Narration beats must be nonempty and have unique IDs")
    used_rules = set();used_events=set()
    for beat in beats:
        if beat.get("kind") not in KINDS or not beat.get("text", "").strip():
            raise ValueError(f"Invalid authored beat: {beat.get('id')}")
        if beat.get("caseFile"):
            if beat.get("eventIds"):raise ValueError("An independent case beat must not also reference primary eventIds")
            case_path=(path.parent/beat["caseFile"]).resolve()
            case=load_package(case_path,False)
            if case["algorithm"]["id"]!=algorithm["id"]:raise ValueError("Independent case uses a different algorithm")
            beat["_case"]=case
            beat["_casePath"]=str(case_path)
            case_ids={e['id'] for e in case['run']['trace']['events']}
            if any(i not in case_ids for i in beat.get('caseEventIds',[])):raise ValueError('Unknown independent-case event')
        if beat.get('pageModes') and not set(beat['pageModes'])<={'rule','calculation','comparison','compact'}:raise ValueError('Unknown page mode')
        if beat.get('stateView') is not None and beat['stateView'] not in {'before','after'}:raise ValueError('Unknown state view')
        if 'hideResult' in beat and not isinstance(beat['hideResult'],bool):raise ValueError('hideResult must be an explicit boolean')
        for rule_id in beat.get("ruleIds",[]):
            if rule_id not in rules:raise ValueError(f"Unknown beat rule: {rule_id}")
            used_rules.add(rule_id)
        for event_id in beat.get("eventIds",[]):
            if event_id not in events:raise ValueError(f"Unknown beat event: {event_id}")
            used_rules.add(events[event_id]["ruleId"])
            used_events.add(event_id)
        if any(i not in beat.get('caseEventIds',beat.get('eventIds',[])) for i in beat.get('detailEventIds',[])):raise ValueError('Detailed event must belong to its authored chapter')
    absent = set(rules)-used_rules
    if absent:
        raise ValueError(f"Rules missing from authored narration beats: {sorted(absent)}")
    missing_events=set(events)-used_events
    if missing_events:
        raise ValueError(f"Events missing from authored chapters: {sorted(missing_events,key=int)[:20]}")
    return package


def event_scene(event, run):
    index = event.get("frameIndex")
    frames = run["frames"]
    if not isinstance(index,int) or not 0 <= index < len(frames):
        raise ValueError(f"Event {event['id']} refers to a missing frame")
    if '_scene_cache' not in run:
        scenes={};previous_frame=-1;current=None
        for item in run['trace']['events']:
            if item.get('scene'):current=item['scene']
            elif item['frameIndex']!=previous_frame or current is None:current=frames[item['frameIndex']]['scene']
            scenes[item['id']]=current;previous_frame=item['frameIndex']
        run['_scene_cache']=scenes
    return run['_scene_cache'][event['id']]


def spoken_lines(package):
    pronunciations = package.get("pronunciations",{})
    lines = []
    for beat in package["beats"]:
        spoken = beat.get("speechText",beat["text"])
        if "speechText" not in beat:
            for term in sorted(pronunciations,key=len,reverse=True):
                spoken = spoken.replace(term,pronunciations[term])
        hold=beat.get('readingHoldSeconds',0)
        if not isinstance(hold,(int,float)) or not 0<=hold<=12:raise ValueError('Reading hold must be an explicit 0–12 seconds')
        lines.append({"id":beat["id"],"chapter":beat.get("title",beat["kind"]),"text":spoken,"caption":beat["text"],**({'readingHoldSeconds':hold} if hold else {})})
    return lines
