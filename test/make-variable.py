"""Build an original two-master variable fixture from the project's synthetic font."""
from pathlib import Path
from tempfile import TemporaryDirectory
from fontTools.ttLib import TTFont
from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor
from fontTools.varLib import build
root=Path(__file__).parent
with TemporaryDirectory() as directory:
    doc=DesignSpaceDocument();axis=AxisDescriptor();axis.name='Weight';axis.tag='wght';axis.minimum=400;axis.default=400;axis.maximum=700;doc.addAxis(axis)
    for weight in [400,700]:
        font=TTFont(root/'fixtures/fixture.ttf')
        if weight==700:
            for name in font.getGlyphOrder():
                g=font['glyf'][name]
                if not g.isComposite() and g.numberOfContours>0:
                    for i,(x,y) in enumerate(g.coordinates):g.coordinates[i]=(round(x*1.15),y)
                width,lsb=font['hmtx'][name];font['hmtx'][name]=(width+100,lsb)
        path=Path(directory)/f'{weight}.ttf';font.save(path)
        source=SourceDescriptor();source.path=str(path);source.name=f'master-{weight}';source.location={'Weight':weight};source.familyName='Wasm Variable Test';source.styleName='Regular' if weight==400 else 'Bold';doc.addSource(source)
    result,_,_=build(doc);result.save(root/'fixtures/variable.ttf')
