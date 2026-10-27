"""Reproducible local source snapshot; never publishes or labels media accepted."""
import argparse
import hashlib
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOCKED_PARTS = {'node_modules', '.venv', '__pycache__', '.git', '.deploy', 'cache', 'partial_movie_files'}
SOURCE_SUFFIXES = {'.py', '.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.txt', '.toml', '.lock', '.ps1', '.cmd', '.css', '.html', '.yml', '.yaml', '.srt', '.vtt'}

def walk_files(folder):
    for directory, children, files in os.walk(folder):
        children[:] = [name for name in children if name not in BLOCKED_PARTS and not (Path(directory) / name).is_symlink()]
        for name in files:
            yield Path(directory) / name

def selected_files():
    """Use explicit project folders; downloaded third-party skill bodies are absent."""
    paths = set()
    for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'README.md', '.gitignore', '打开本地体验馆.cmd']:
        paths.add(ROOT / name)
    for name in ['src', 'tests', 'tools', 'docs', 'public', 'media/scripts', 'media/exports']:
        paths.update(walk_files(ROOT / name))
    for name in ['media/manim', 'media/audio-review', 'media/remotion']:
        paths.update(p for p in (ROOT / name).glob('*') if p.is_file() and p.suffix in SOURCE_SUFFIXES)
    paths.update(p for p in (ROOT / 'media/manim/smoke').glob('*') if p.is_file() and p.suffix in SOURCE_SUFFIXES)
    # QA reports and numerical audit programs, not millions of frame/cache files.
    paths.update(p for p in (ROOT / 'qa').glob('*') if p.is_file() and p.suffix in SOURCE_SUFFIXES)
    for folder in (ROOT / 'qa/film-final-review').iterdir():
        if folder.is_dir():
            paths.update(p for p in folder.glob('*') if p.is_file() and p.suffix in SOURCE_SUFFIXES)
    # Render provenance accompanies the exact frozen case; movie/audio assets are
    # separately included in the local experience and per-theme media packages.
    for folder in (ROOT / 'media/films').iterdir():
        if folder.is_dir():
            for name in ['report.json', 'transcript.txt', 'audio/aligned.json', 'audio/captions.srt', 'audio/captions.vtt']:
                p = folder / name
                if p.is_file(): paths.add(p)
    for folder in (ROOT / 'media/comics').iterdir():
        if folder.is_dir():
            paths.update(p for p in folder.glob('*') if p.is_file() and p.suffix in {'.json', '.md', '.txt'})
    for p in sorted(paths):
        relative = p.relative_to(ROOT)
        if any(part in BLOCKED_PARTS for part in relative.parts): continue
        if p.name.startswith('.env') or p.suffix in {'.pyc', '.tsbuildinfo'}: continue
        if p.is_symlink(): raise ValueError(f'Refusing linked source: {relative}')
        yield p, relative.as_posix()

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true')
    args = parser.parse_args()
    files = list(selected_files())
    if args.list:
        print(json.dumps({'files': len(files), 'bytes': sum(p.stat().st_size for p, _ in files), 'paths': [n for _, n in files]}, ensure_ascii=False, indent=2)); return
    output = ROOT / 'backups'
    output.mkdir(exist_ok=True)
    temp = output / 'algorithm-wonderland-v2-source.building.zip'
    records = []
    with zipfile.ZipFile(temp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=5, allowZip64=True) as archive:
        for p, name in files:
            before = digest(p)
            archive.write(p, name)
            if digest(p) != before: raise RuntimeError(f'Source changed during snapshot: {name}; rerun after the writer finishes.')
            records.append({'file': name, 'sha256': before, 'bytes': p.stat().st_size})
        archive.writestr('源码快照说明.txt', '算法奇境 2.0 本地源码快照\n包含平台、制作代码、冻结教学案例、漫画网页素材和审查证据。\n制作环境依赖与大体积视频/配音不在源码包中；另见本地体验馆和主题素材包。\n本快照不表示全量视听验收已通过。公开网站只发布成品，源码保留本地。\n按 README 及 media/manim/README.md 恢复环境。\n')
        archive.writestr('源码文件校验.json', json.dumps(records, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(temp) as archive:
        if archive.testzip() is not None: raise RuntimeError('ZIP CRC validation failed')
        for row in records:
            with archive.open(row['file']) as f:
                h = hashlib.file_digest(f, 'sha256').hexdigest()
            if h != row['sha256']: raise RuntimeError('Extracted source differs: ' + row['file'])
    sha = digest(temp)
    final = output / f'algorithm-wonderland-v2-source-{sha[:16]}.zip'
    temp.replace(final)
    result = {'createdAt': datetime.now(timezone.utc).isoformat(), 'status': 'source-snapshot-not-audiovisual-acceptance', 'file': str(final), 'bytes': final.stat().st_size, 'sha256': sha, 'verifiedFiles': len(records)}
    (output / 'v2-source-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__': main()
