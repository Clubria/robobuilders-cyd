#!/usr/bin/env python3
"""Prepare only the public guide, catalogue and sanitized source ZIP for hosting."""
from pathlib import Path
import shutil
import zipfile
from package_bridge import package

ROOT = Path(__file__).resolve().parents[1]

def build():
    bundle = package()
    destination = ROOT / 'artifacts/site'
    (destination / 'downloads').mkdir(parents=True, exist_ok=True)
    for name in ['index.html', 'apps.json']:
        shutil.copyfile(ROOT / 'site' / name, destination / name)
    shutil.copyfile(ROOT / 'site/vercel-static.json', destination / 'vercel.json')
    shutil.copyfile(bundle, destination / 'downloads/cyd-bridge.zip')
    with zipfile.ZipFile(destination / 'downloads/ai-builders-app-starter.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ['index.html', 'app.json', 'README.md']:
            archive.write(ROOT / 'starter' / name, f'ai-builders-app-starter/{name}')
    return destination

if __name__ == '__main__':
    print(build().relative_to(ROOT))
