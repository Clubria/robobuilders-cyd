#!/usr/bin/env python3
"""Export only explicitly listed public skill files; never traverse artifacts."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.opencode/skills'
FILES = {
    'cyd-setup': ['SKILL.md', 'references/specs.md', 'scripts/connect.py'],
    'cyd-wifi': ['SKILL.md'],
}


def public_file(source, relative):
    path = source / relative
    if not path.resolve(strict=True).is_relative_to(source.resolve(strict=True)):
        raise ValueError(f'Public export path escapes the skill directory: {relative}')
    for ancestor in [path, *path.parents]:
        if ancestor.is_symlink():
            raise ValueError(f'Symlinks are not allowed in skill exports: {relative}')
        if ancestor == source:
            break
    if not path.is_file():
        raise ValueError(f'Public export path is not a file: {relative}')
    return path


def package(destination=ROOT / 'artifacts/skill-bundles', source=SOURCE):
    # Validate everything before opening/replacing any archive.
    public = {'INSTALL.md': public_file(source, 'INSTALL.md')}
    for skill, files in FILES.items():
        for relative in files:
            name = f'{skill}/{relative}'
            public[name] = public_file(source, name)
    destination.mkdir(parents=True, exist_ok=True)
    archives = []
    bundle = destination / 'cyd-pixsim-skills.zip'
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as archive:
        for relative, path in public.items():
            archive.write(path, relative)
    archives.append(bundle)
    for skill, files in FILES.items():
        path = destination / f'{skill}.skill'
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for relative in files:
                name = f'{skill}/{relative}'
                archive.write(public[name], name)
        archives.append(path)
    manifest = {path.name: {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                for path in archives}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return archives


if __name__ == '__main__':
    for path in package():
        print(path.relative_to(ROOT))
