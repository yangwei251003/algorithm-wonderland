"""Prepare a separate public-source checkout and a verified necessary-assets ZIP.

This does not publish, change the existing private archive, or release 2.0 media.
Downloaded reference works and private production state are excluded by allowlist.
"""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.public-source'
SKIP = {'node_modules', '.venv', '__pycache__', '.git', 'output', 'cache'}

def sha(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def copy(p, dest=None):
    dest = dest or OUT / p.relative_to(ROOT)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)

def tree(name):
    for p in (ROOT / name).rglob('*'):
        if p.is_file() and not any(part in SKIP for part in p.relative_to(ROOT / name).parts):
            copy(p)

def main():
    if OUT.exists():
        raise RuntimeError('Public staging already exists; inspect it instead of overwriting.')
    OUT.mkdir()
    for name in ['src', 'tests', 'tools', 'media/scripts']:
        tree(name)
    for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'LICENSE', 'OPEN_SOURCE_NOTICES.md', '打开本地体验馆.cmd', 'public/THIRD_PARTY_NOTICES.txt', 'public/media/catalog.json', 'docs/v2/开源恢复说明.md', 'docs/research-v2/research-index.json']:
        copy(ROOT / name)
    for folder in ['media/manim', 'media/audio-review', 'media/remotion', 'media/manim/smoke']:
        for p in (ROOT / folder).glob('*'):
            if p.is_file() and p.suffix in {'.py', '.ts', '.tsx', '.mjs', '.css', '.html', '.toml', '.lock', '.md'}:
                copy(p)
    for name in ['media/manim/smoke/lines.json', 'media/remotion/tsconfig.json']:
        copy(ROOT / name)
    copy(ROOT / 'node_modules/remotion/LICENSE.md', OUT / 'licenses/Remotion-4.0.538.md')
    for source, target in [('qa/v2-delivery-home.png', 'docs/images/home.png'), ('qa/v2-delivery-media.png', 'docs/images/media.png'), ('qa/v2-delivery-hamming-counterexample.png', 'docs/images/hamming.png')]:
        copy(ROOT / source, OUT / target)
    # Beat artwork resolves relative to media/exports/*.film.json. Preserve the
    # teaching content; remove the original author's machine-specific location.
    rewritten = []
    for p in (OUT / 'media/scripts').glob('*.json'):
        data = json.loads(p.read_text('utf-8'))
        changed = False
        for beat in data.get('beats', []):
            value = beat.get('artwork')
            if isinstance(value, str) and ':/' in value.replace('\\', '/'):
                normalized = value.replace('\\', '/')
                marker = '/media/comics/'
                if marker not in normalized:
                    raise RuntimeError('Unexpected absolute artwork path: ' + p.name)
                beat['artwork'] = '../comics/' + normalized.split(marker, 1)[1]
                changed = True
        if changed:
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', 'utf-8')
            rewritten.append(p.relative_to(OUT).as_posix())
    # Original full image/trace assets are delivered once, outside Git history.
    assets = sorted((ROOT / 'public/media').glob('*/comic-*.png'))
    assets += sorted(p for p in (ROOT / 'media/exports').glob('*.json') if not p.name.endswith('.film.json'))
    if len([p for p in assets if p.suffix == '.png']) != 252:
        raise RuntimeError('Expected all 252 comics')
    target = ROOT / 'backups/algorithm-wonderland-v2-open-assets.building.zip'
    records = []
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=5) as archive:
        for p in assets:
            name = p.relative_to(ROOT).as_posix()
            fingerprint = sha(p)
            archive.write(p, name)
            if fingerprint != sha(p):
                raise RuntimeError('Asset changed during packaging: ' + name)
            records.append({'file': name, 'bytes': p.stat().st_size, 'sha256': fingerprint})
        archive.writestr('OPEN-ASSETS.json', json.dumps({'status':'review-source-assets-not-full-av-acceptance', 'files':records}, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(target) as archive:
        if archive.testzip():
            raise RuntimeError('ZIP CRC error')
        for record in records:
            with archive.open(record['file']) as f:
                if hashlib.file_digest(f, 'sha256').hexdigest() != record['sha256']:
                    raise RuntimeError('ZIP hash mismatch')
    fingerprint = sha(target)
    final = target.with_name(f'algorithm-wonderland-v2-open-assets-{fingerprint[:16]}.zip')
    target.replace(final)
    result = {'file':final.name, 'bytes':final.stat().st_size, 'sha256':fingerprint, 'files':len(records), 'comics':252, 'frozenCases':len(records)-252, 'rewrittenPortableScripts':rewritten, 'excluded':['downloaded reference PDF/image/page/DOM files', 'private configuration and production state', 'third-party skill bodies', 'dependency environments', 'unaccepted full MP4/WAV review media']}
    (OUT / 'OPEN-ASSETS-MANIFEST.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
