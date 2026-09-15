# SPDX-License-Identifier: GPL-3.0-or-later
"""Compare independently decoded font semantics, excluding build timestamps."""
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from pathlib import Path
root = Path('test/results/scripting')
native, wasm = [TTFont(root / name, checkChecksums=2) for name in ['native.otf', 'wasm.otf']]
assert set(native.keys()) == set(wasm.keys())
assert native.getBestCmap() == wasm.getBestCmap()
assert native.getGlyphOrder() == wasm.getGlyphOrder()
assert native['head'].unitsPerEm == wasm['head'].unitsPerEm
assert native['hmtx'].metrics == wasm['hmtx'].metrics
assert [(n.nameID, n.platformID, n.platEncID, n.langID, n.toUnicode()) for n in native['name'].names] == [(n.nameID, n.platformID, n.platEncID, n.langID, n.toUnicode()) for n in wasm['name'].names]
for tag in ['GSUB', 'GPOS', 'OS/2', 'hhea', 'maxp', 'post']:
    assert native[tag].compile(native) == wasm[tag].compile(wasm), tag
ng, wg = native.getGlyphSet(), wasm.getGlyphSet()
for name in native.getGlyphOrder():
    a, b = RecordingPen(), RecordingPen()
    ng[name].draw(a)
    wg[name].draw(b)
    assert a.value == b.value, name
print('Independent FontTools parity: cmap, names, metrics, layout tables and every glyph contour')
