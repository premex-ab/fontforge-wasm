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

# head.flags bit 1 describes TrueType phantom points, not CFF coordinates.
# Applying hmtx LSB as a CFF translation shifts already-positioned charstrings.
# https://learn.microsoft.com/en-us/typography/opentype/spec/head
p = Path('/work/fontforge/fontforge/parsettf.c')
s = p.read_text()
old = 'if ( info->apply_lsb ) {'
assert s.count(old) == 2
p.write_text(s.replace(old, 'if ( info->apply_lsb && info->glyph_start!=0 ) {'))
