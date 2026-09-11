# SPDX-License-Identifier: GPL-3.0-or-later
"""Generate independent X11 fixtures with bdftopcf (xfonts-utils).

PCF uses 16-bit character codes. Omit unencoded and non-BMP BDF glyphs rather
than allowing bdftopcf to assign them U+FFFE/U+FFFF and corrupt the Unicode map.
Run after generating fixture.bdf and Roboto-Regular.bdf with the WASM engine.
"""
from pathlib import Path
import re, subprocess
root = Path(__file__).resolve().parent.parent
for source, output in [(root/'test/results/formats/fixture.bdf',root/'test/fixtures/fixture.pcf'),
                       (root/'examples/fonts/Roboto-Regular.bdf',root/'examples/fonts/Roboto-Regular.pcf')]:
    text = source.read_text()
    blocks = re.findall(r'^STARTCHAR .*?^ENDCHAR\n', text, flags=re.M|re.S)
    keep = [block for block in blocks if 0 <= int(re.search(r'^ENCODING (-?\d+)',block,re.M)[1]) < 65534]
    header = text[:text.index('STARTCHAR ')]
    header = re.sub(r'^CHARS \d+$','CHARS '+str(len(keep)),header,flags=re.M)
    result = subprocess.run(['bdftopcf'],input=(header+''.join(keep)+'ENDFONT\n').encode(),stdout=subprocess.PIPE,check=True)
    output.write_bytes(result.stdout)
