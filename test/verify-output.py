# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent semantic validation using fontTools, not the converting engine."""
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).parent
results = list((root / 'results').glob('*.*tf'))
assert len(results) >= 4, 'Run npm test first'
for path in results:
    original = path.name.split('-')[0]
    source = TTFont(root / 'fixtures' / f'fixture.{original}')
    output = TTFont(path, checkChecksums=2)
    assert output.getBestCmap() == source.getBestCmap(), path
    assert output['head'].unitsPerEm == source['head'].unitsPerEm, path
    assert output['name'].getDebugName(1) == source['name'].getDebugName(1), path
    for glyph in source.getGlyphOrder():
        assert output['hmtx'][glyph][0] == source['hmtx'][glyph][0], (path, glyph)
    for tag in ['GSUB', 'GPOS']:
        assert tag in output, (path, tag)
        assert [r.FeatureTag for r in output[tag].table.FeatureList.FeatureRecord] == [r.FeatureTag for r in source[tag].table.FeatureList.FeatureRecord], (path, tag)
    ligatures = [ligature for lookup in output['GSUB'].table.LookupList.Lookup
                 for sub in lookup.SubTable for ligature in getattr(sub, 'ligatures', {}).get('f', [])]
    assert any(lig.Component == ['i'] and lig.LigGlyph == 'fi' for lig in ligatures), path
    adjustments = []
    for lookup in output['GPOS'].table.LookupList.Lookup:
        if lookup.LookupType != 2: continue
        for sub in lookup.SubTable:
            if 'A' not in sub.Coverage.glyphs: continue
            if sub.Format == 1:
                pairs = sub.PairSet[sub.Coverage.glyphs.index('A')].PairValueRecord
                adjustments += [getattr(pair.Value1, 'XAdvance', 0) for pair in pairs if pair.SecondGlyph == 'V']
            elif sub.Format == 2:
                pair = sub.Class1Record[sub.ClassDef1.classDefs.get('A', 0)].Class2Record[sub.ClassDef2.classDefs.get('V', 0)]
                adjustments.append(getattr(pair.Value1, 'XAdvance', 0))
    assert -80 in adjustments, (path, adjustments)
    assert ('CFF ' in output) == (path.suffix == '.otf'), path
    assert ('glyf' in output) == (path.suffix == '.ttf'), path
    # Draw every mapped glyph, forcing actual outline decompilation.
    from fontTools.pens.boundsPen import BoundsPen
    glyphs = output.getGlyphSet()
    original_glyphs = source.getGlyphSet()
    for name in output.getBestCmap().values():
        pen = BoundsPen(glyphs)
        glyphs[name].draw(pen)
        if name != 'space':
            assert pen.bounds is not None, (path, name)
            original_pen = BoundsPen(original_glyphs)
            original_glyphs[name].draw(original_pen)
            assert all(abs(a - b) <= 2 for a, b in zip(pen.bounds, original_pen.bounds)), (path, name, pen.bounds, original_pen.bounds)
    print(f'Validated {path.name}: outlines, cmap, metrics, names, GSUB and GPOS')
