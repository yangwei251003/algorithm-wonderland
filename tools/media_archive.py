"""Small streaming archive helpers; public manifests only reference verified files."""
import hashlib,json,zipfile
LIMIT=2*1024**3
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024**2),b''):h.update(chunk)
    return h.hexdigest()
def asset(path,name,expected=None):
    actual=digest(path)
    if expected and actual!=expected:raise ValueError(name+': verified fingerprint differs')
    return {'source':path,'file':name,'bytes':path.stat().st_size,'sha256':actual}
def validate_movie(root,identifier,case,review_only):
    folder=root/'media/films'/identifier;report=read(folder/'report.json');source=root/'media/exports'/f'{identifier}.film.json';package=read(source)
    holds=read(root/'qa/v2-media-holds.json')
    if holds.get('version')!=1 or not isinstance(holds.get('holds'),list):raise ValueError('Invalid media hold manifest')
    if any(h.get('algorithmId')==identifier and h.get('sha256')==report.get('sha256') for h in holds['holds']):raise ValueError(identifier+': known movie defect pending rerender')
    if report.get('traceHash')!=case['traceHash'] or package['traceHash']!=case['traceHash']:raise ValueError(identifier+': stale teaching trace')
    if digest(source)!=report.get('inputSha256'):raise ValueError(identifier+': stale movie input')
    if report.get('width')!=1920 or report.get('height')!=1080 or abs(report.get('fps',0)-60)>.001 or not 90<=report.get('duration',0)<=150 or not report.get('completeDecode'):raise ValueError(identifier+': technical verification missing')
    aligned=read(folder/'audio/aligned.json')
    if [l['caption'] for l in aligned['lines']]!=[b['text'] for b in package['beats']]:raise ValueError(identifier+': narration version differs')
    if not review_only:
        review=read(folder/'review.json')
        if review.get('sha256')!=report['sha256'] or review.get('visual')!='passed' or review.get('audio')!='passed':raise ValueError(identifier+': current movie has not passed audiovisual review')
    comics=read(root/'media/comics'/identifier/'review.json')
    if comics.get('traceHash')!=case['traceHash'] or comics.get('lessonVersion')!=package['lesson']['version'] or {c['role'] for c in comics['comics'] if c.get('status')=='passed'}!={'analogy','rules','summary'}:raise ValueError(identifier+': comic version/review differs')
    return report
def split_assets(entries,limit=LIMIT,reserve=1024**2):
    if reserve>=limit:raise ValueError('Invalid archive metadata reserve')
    parts=[];part=[];size=reserve
    for entry in entries:
        cost=entry['bytes']+2048+len(entry['file'].encode('utf-8'))*2
        if cost+reserve>=limit:raise ValueError(entry['file']+': single media exceeds limit')
        if part and size+cost>=limit:parts.append(part);part=[];size=reserve
        part.append(entry);size+=cost
    if part:parts.append(part)
    return parts
def archive(output,stem,entries,metadata,notice,limit=LIMIT):
    pending=output/(stem+'.building.zip');checks=[]
    try:
        with zipfile.ZipFile(pending,'w',allowZip64=True) as z:
            for entry in entries:
                h=hashlib.sha256();size=0;info=zipfile.ZipInfo(entry['file'])
                with entry['source'].open('rb') as source,z.open(info,'w',force_zip64=True) as dest:
                    for chunk in iter(lambda:source.read(1024**2),b''):dest.write(chunk);h.update(chunk);size+=len(chunk)
                if h.hexdigest()!=entry['sha256'] or size!=entry['bytes']:raise ValueError(entry['file']+': changed during packaging')
                checks.append({k:entry[k] for k in ['file','bytes','sha256']})
            z.writestr('文件校验.json',json.dumps(checks,ensure_ascii=False,indent=2))
            z.writestr('来源与核查.json',json.dumps(metadata,ensure_ascii=False,indent=2))
            z.writestr('使用说明.txt',notice)
        if pending.stat().st_size>=limit:raise ValueError('Archive exceeds individual download limit')
        with zipfile.ZipFile(pending) as z:
            if z.testzip() is not None:raise ValueError('ZIP CRC verification failed')
            for entry in checks:
                h=hashlib.sha256()
                with z.open(entry['file']) as f:
                    for chunk in iter(lambda:f.read(1024**2),b''):h.update(chunk)
                if h.hexdigest()!=entry['sha256']:raise ValueError('Extracted content differs')
        value=digest(pending);final=output/(stem+'-'+value[:16]+'.zip');size=pending.stat().st_size;pending.replace(final)
        return {'file':final.name,'bytes':size,'sha256':value,'verifiedExtractedFiles':len(checks)}
    except BaseException:
        pending.unlink(missing_ok=True)
        raise
