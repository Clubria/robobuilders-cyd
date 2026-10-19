#!/usr/bin/env python3
"""Build a source-only download from a public file allowlist. No device data."""
from pathlib import Path
import hashlib
import json
import zipfile
from package_cyd_skills import public_file

ROOT = Path(__file__).resolve().parents[1]
FILES = ['package.json', 'pnpm-lock.yaml', 'README.md', 'AGENTS.md', '.gitignore', 'CONTRIBUTING.md', 'HOSTING.md', 'vercel.json', 'site/index.html', 'site/apps.json', 'scripts/check-apps.mjs', 'starter/index.html', 'starter/app.json', 'starter/README.md']
FILES += [f'server/{name}.mjs' for name in (
    'bridge', 'capture', 'clubria', 'compact', 'cyd-ui', 'guide', 'index', 'input',
    'latch', 'portrait', 'presence', 'preview', 'render', 'screencast', 'weather', 'world-view')]
FILES += [f'scripts/{name}' for name in (
    'usb_stream.py', 'usb_input.py', 'receiver_control.py', 'package_bridge.py', 'package_cyd_skills.py', 'build_site.py')]
FILES += [f'firmware/cyd_pixsim/{name}' for name in (
    'board_display.h', 'bridge_address.h', 'cyd_pixsim.ino', 'launcher.h', 'receiver_control.h', 'setup_page.h')]
FILES += ['firmware/README.md', '.opencode/skills/cyd-setup/scripts/connect.py']


def package(root=ROOT, destination=None):
    root = Path(root)
    sources = {name: public_file(root, name) for name in FILES}
    destination = Path(destination or root / 'artifacts/downloads/cyd-bridge.zip')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, path in sources.items():
            archive.write(path, f'cyd-bridge/{name}')
    manifest = {'bytes': destination.stat().st_size,
                'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'files': FILES}
    destination.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return destination


if __name__ == '__main__':
    print(package().relative_to(ROOT))
