"""Restore the SHA-pinned original comic and synthetic-case assets for Pages."""
import argparse
import hashlib
import json
import re
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def restore(archive_path, manifest):
    if archive_path.stat().st_size != manifest['bytes'] or sha(archive_path) != manifest['sha256']:
        raise ValueError('Asset archive size/SHA-256 mismatch')
    with zipfile.ZipFile(archive_path) as archive:
        records = json.loads(archive.read('OPEN-ASSETS.json'))['files']
        if len(records) != 347 or len({r['file'] for r in records}) != 347:
            raise ValueError('Unexpected or duplicated asset list')
        for row in records:
            name = row['file']
            if not re.fullmatch(r'(public/media/[a-z0-9-]+/comic-(analogy|rules|summary)\.png|media/exports/[a-z0-9-]+\.json)', name):
                raise ValueError('Unexpected asset path')
            destination = (ROOT / name).resolve()
            destination.relative_to(ROOT)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(name) as source, destination.open('wb') as target:
                shutil.copyfileobj(source, target)
            if destination.stat().st_size != row['bytes'] or sha(destination) != row['sha256']:
                raise ValueError('Extracted asset mismatch: ' + name)
    print('Verified and restored 252 original comics and 95 frozen teaching cases.')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'OPEN-ASSETS-MANIFEST.json').read_text('utf-8'))
    if not re.fullmatch(r'algorithm-wonderland-v2-open-assets-[a-f0-9]{16}\.zip', manifest['file']):
        raise ValueError('Unexpected archive name')
    if args.archive:
        restore(args.archive, manifest)
        return
    url = 'https://github.com/yangwei251003/algorithm-wonderland/releases/download/v2-source-review-2026-10-26/' + manifest['file']
    with tempfile.TemporaryDirectory(prefix='algorithm-wonderland-assets-') as folder:
        target = Path(folder) / manifest['file']
        request = urllib.request.Request(url, headers={'User-Agent':'Algorithm-Wonderland-Pages'})
        with urllib.request.urlopen(request, timeout=120) as response, target.open('wb') as stream:
            shutil.copyfileobj(response, stream)
        restore(target, manifest)

if __name__ == '__main__':
    main()
