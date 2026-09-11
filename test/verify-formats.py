# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent parsing and semantic checks of every exported font family."""
from pathlib import Path
from fontTools.ttLib import TTFont, TTCollection
from fontTools.pens.boundsPen import BoundsPen
from fontTools.afmLib import AFM
from fontTools.tfmLib import TFM
from fontTools.cffLib import CFFFontSet
from fontTools.ufoLib import UFOReader
import io, tempfile, zipfile, struct
root = Path(__file__).parent
results = root / 'results' / 'formats'
source = TTFont(root / 'fixtures' / 'fixture.ttf')
source_glyphs = source.getGlyphSet()
for path in sorted(results.glob('*-back.*')):
    font = TTFont(path)
    cmap = font.getBestCmap()
    is_bitmap = path.name.startswith('fon-')
    expected = {c: n for c,n in source.getBestCmap().items() if not is_bitmap or c < 256}
    if path.name.startswith('compressed-ufo-'):
        assert cmap.get(65) == 'A', path
        continue
    assert cmap == expected, (path.name, cmap, expected)
    assert font['name'].getDebugName(1) == 'Wasm Test', path
    glyphs = font.getGlyphSet()
    for code, name in expected.items():
        assert abs(font['hmtx'][name][0] - source['hmtx'][name][0]) <= (63 if is_bitmap else 2), (path.name, name)
        pen = BoundsPen(glyphs); glyphs[name].draw(pen)
        if name != 'space':
            assert pen.bounds is not None, (path.name, name)
            original = BoundsPen(source_glyphs); source_glyphs[name].draw(original)
            if not is_bitmap: assert all(abs(a-b) <= 3 for a,b in zip(pen.bounds,original.bounds)), (path.name,name,pen.bounds,original.bounds)
    if path.name.split('-')[0] in ['ttf','otf','woff','woff2','eot','dfont','suit','ttc','ufo']:
        assert 'GSUB' in font and 'GPOS' in font, path
    print('Validated',path.name,'Unicode, names, widths and actual outlines')
for path in results.glob('*-to-*'):
    font = TTFont(path)
    assert font.getBestCmap() == source.getBestCmap(), path
    assert 'GSUB' in font and 'GPOS' in font, path
assert TTFont(results / 'face-0.ttf')['name'].getDebugName(1) == 'Wasm Test'
assert TTFont(results / 'face-1.ttf')['name'].getDebugName(1) == 'Second Face'
assert len(TTCollection(results / 'fixture.ttc').fonts) == 1
raw = (results / 'fixture.eot').read_bytes()
assert struct.unpack_from('<I',raw)[0] == len(raw)
assert struct.unpack_from('<H',raw,34)[0] == 0x504c
font = TTFont(io.BytesIO(raw[-struct.unpack_from('<I',raw,4)[0]:]))
assert font.getBestCmap() == source.getBestCmap()
af = AFM(str(results / 'fixture.afm'))
assert af['A'][1] == 600
assert 65 in TFM(str(results / 'fixture.tfm')).chars
pfm = (results / 'fixture.pfm').read_bytes()
assert struct.unpack_from('<H',pfm)[0] == 0x100
assert struct.unpack_from('<I',pfm,2)[0] == len(pfm)
cff = CFFFontSet()
cff.decompile(io.BytesIO((results / 'fixture.cff').read_bytes()), TTFont())
assert 'A' in cff[0].CharStrings.charStrings
with tempfile.TemporaryDirectory() as directory:
    with zipfile.ZipFile(results / 'fixture.ufo.zip') as archive:
        assert archive.testzip() is None
        archive.extractall(directory)
    with UFOReader(Path(directory) / 'output.ufo') as reader:
        assert 'A' in reader.getGlyphSet().keys()
print('Validated EOT, TTC, AFM, PFM, TFM, raw CFF and UFO ZIP with independent parsers')
