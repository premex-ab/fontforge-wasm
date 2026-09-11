# SPDX-License-Identifier: GPL-3.0-or-later
"""Preserve upstream notices alongside every binary distribution."""
from pathlib import Path
import re
import shutil

roots = [p for p in Path('/work').iterdir() if p.is_dir()]
roots += [Path('/emsdk/upstream/emscripten')]
for root in roots:
    for source in root.rglob('*'):
        if not source.is_file() or 'out' in source.relative_to(root).parts:
            continue
        if re.match(r'^(licen[sc]e|copying|copyright|authors|notice)([._-]|$)', source.name, re.I) or source.name in {'FTL.TXT', 'GPLv2.TXT'}:
            target = Path('/output/licenses') / root.name / source.relative_to(root)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
# zlib embeds its license in the public header.
target = Path('/output/licenses/zlib/zlib.h')
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile('/work/zlib/zlib.h', target)
