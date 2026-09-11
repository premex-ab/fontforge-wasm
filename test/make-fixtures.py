# SPDX-License-Identifier: GPL-3.0-or-later
"""Original synthetic fixtures: curves, composites, Unicode and GSUB/GPOS."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

root = Path(__file__).parent / 'fixtures'
root.mkdir(exist_ok=True)
order = ['.notdef', 'space', 'A', 'V', 'Aacute', 'acute', 'f', 'i', 'fi']
cmap = {32: 'space', 65: 'A', 86: 'V', 193: 'Aacute', 180: 'acute', 102: 'f', 105: 'i', 0xfb01: 'fi'}
for kind in ['ttf', 'otf']:
    fb = FontBuilder(1000, isTTF=kind == 'ttf')
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    glyphs = {}
    for glyph in order:
        pen = TTGlyphPen(None) if kind == 'ttf' else T2CharStringPen(600, None)
        if glyph != 'space':
            pen.moveTo((50, 0))
            pen.lineTo((300, 700))
            if kind == 'ttf': pen.qCurveTo((650, 350), (550, 0))
            else: pen.curveTo((450, 650), (700, 250), (550, 0))
            pen.closePath()
        glyphs[glyph] = pen.glyph() if kind == 'ttf' else pen.getCharString()
    if kind == 'ttf':
        composite = TTGlyphPen(glyphs)
        composite.addComponent('A', (1, 0, 0, 1, 0, 0))
        composite.addComponent('acute', (0.2, 0, 0, 0.2, 230, 730))
        glyphs['Aacute'] = composite.glyph()
        fb.setupGlyf(glyphs)
    else: fb.setupCFF('WasmTest-Regular', {'FullName': 'Wasm Test Regular', 'FamilyName': 'Wasm Test', 'Weight': 'Regular'}, glyphs, {})
    fb.setupHorizontalMetrics({g: (600, 50) for g in order})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'Wasm Test', 'styleName': 'Regular', 'uniqueFontIdentifier': 'FontForgeWasmTest', 'fullName': 'Wasm Test Regular', 'psName': 'WasmTest-Regular'})
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    fb.setupPost()
    addOpenTypeFeaturesFromString(fb.font, 'feature liga { sub f i by fi; } liga; feature kern { pos A V -80; } kern;')
    fb.font.recalcTimestamp = False
    fb.font['head'].created = fb.font['head'].modified = 3800000000
    fb.save(root / f'fixture.{kind}')

# Independently encoded webfonts exercise both TrueType and CFF flavours.
from fontTools.ttLib import TTFont, TTCollection, newTable
from fontTools.ttLib.tables.DefaultTable import DefaultTable
for kind in ['ttf', 'otf']:
    for flavor in ['woff', 'woff2']:
        font = TTFont(root / f'fixture.{kind}')
        font.flavor = flavor
        font.save(root / f'{kind}.{flavor}')
for flavor in ['woff', 'woff2']:
    font = TTFont(root / 'fixture.ttf')
    font['fvar'] = newTable('fvar')
    font['fvar'].axes = []
    font['fvar'].instances = []
    font.flavor = flavor
    font.save(root / f'variable.{flavor}')
collection = TTCollection()
collection.fonts = [TTFont(root / 'fixture.ttf'), TTFont(root / 'fixture.otf')]
for record in collection.fonts[1]['name'].names:
    if record.nameID in [1, 4]: record.string = 'Second Face'.encode(record.getEncoding())
collection.save(root / 'collection.ttc')

# A small original UFO fixture, compressed with Python's independent ZIP codec.
import plistlib, zipfile
meta = plistlib.dumps(dict(creator='fontforge-wasm-tests', formatVersion=3))
info = plistlib.dumps(dict(familyName='Wasm Test', styleName='Regular', unitsPerEm=1000, ascender=800, descender=-200))
with zipfile.ZipFile(root / 'compressed.ufo.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('fixture.ufo/metainfo.plist', meta)
    archive.writestr('fixture.ufo/fontinfo.plist', info)
    archive.writestr('fixture.ufo/layercontents.plist', plistlib.dumps([['public.default', 'glyphs']]))
    archive.writestr('fixture.ufo/glyphs/contents.plist', plistlib.dumps({'A': 'A.glif'}))
    archive.writestr('fixture.ufo/glyphs/A.glif', '<glyph name="A" format="2"><advance width="600"/><unicode hex="0041"/><outline><contour><point x="0" y="0" type="line"/><point x="300" y="700" type="line"/><point x="600" y="0" type="line"/></contour></outline></glyph>')
