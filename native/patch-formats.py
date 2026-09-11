# SPDX-License-Identifier: GPL-3.0-or-later
"""Checked adaptations to preserve font information in portable exports."""
from pathlib import Path
p = Path('/work/fontforge/fontforge/tottf.c')
s = p.read_text()
old = '    if ( format!=ff_type42 && format!=ff_type42cid ) {\n\tdumppost(at,sf,format);'
assert s.count(old) == 1
# Type 11's CIDMap alone does not retain Unicode when reimported by FontForge.
# An additional cmap and post in its embedded SFNT preserves this information.
s = s.replace(old, '    if ( format==ff_type42cid ) {\n\tdumppost(at,sf,ff_ttf);\n\tdumpcmap(at,sf,ff_ttf);\n    }\n' + old)
p.write_text(s)
