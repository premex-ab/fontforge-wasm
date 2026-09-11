# SPDX-License-Identifier: GPL-3.0-or-later
"""Download and verify locked upstream archives; retain them for source releases."""
import hashlib
import json
import pathlib
import subprocess
import sys

name = sys.argv[1]
spec = next(s for s in json.loads(pathlib.Path('/product/build/sources.json').read_text()) if s['name'] == name)
archives = pathlib.Path('/sources')
archives.mkdir(exist_ok=True)
archive = archives / (name + '.tar')
subprocess.run(['curl', '--fail', '--location', '--retry', '3', spec['url'], '-o', str(archive)], check=True)
if hashlib.sha256(archive.read_bytes()).hexdigest() != spec['sha256']:
    raise SystemExit(f'Checksum mismatch: {name}')
destination = pathlib.Path('/work') / name
destination.mkdir(parents=True, exist_ok=True)
subprocess.run(['tar', 'xf', str(archive), '-C', str(destination), '--strip-components=1'], check=True)
