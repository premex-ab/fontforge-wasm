# SPDX-License-Identifier: GPL-3.0-or-later
"""Original synthetic CFF outlines whose expanded point graph exceeds 512 MiB.
Generated locally for regression testing; no user font data is used.
"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
fb = FontBuilder(1000, isTTF=False)
order = ['.notdef'] + ['g%d' % i for i in range(1000)]
fb.setupGlyphOrder(order)
fb.setupCharacterMap({0x1000+i: name for i, name in enumerate(order[1:])})
pen = T2CharStringPen(600, None)
for i in range(1000):
    x, y = (i % 25)*20, (i // 25)*20
    pen.moveTo((x,y)); pen.lineTo((x+10,y)); pen.lineTo((x+10,y+10)); pen.lineTo((x,y+10)); pen.closePath()
char = pen.getCharString(); char.compile()
from fontTools.misc.psCharStrings import T2CharString
fb.setupCFF('MemoryTest-Regular', {'FullName':'Memory Test Regular','FamilyName':'Memory Test','Weight':'Regular'}, {g:T2CharString(bytecode=char.bytecode) for g in order}, {})
fb.setupHorizontalMetrics({g:(600,0) for g in order})
fb.setupHorizontalHeader(ascent=800,descent=-200)
fb.setupNameTable({'familyName':'Memory Test','styleName':'Regular','psName':'MemoryTest-Regular','fullName':'Memory Test Regular'})
fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200)
fb.setupPost()
fb.font.recalcTimestamp=False
fb.font['head'].created=fb.font['head'].modified=3800000000
from io import BytesIO
import gzip
output = BytesIO()
fb.save(output)
(Path(__file__).parent/'fixtures'/'memory.otf.gz').write_bytes(gzip.compress(output.getvalue(), mtime=0))
