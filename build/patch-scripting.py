# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
p = Path('/work/fontforge/fontforge/scripting.c')
s = p.read_text()
needle = 'if ( found!=NULL ) {'
assert s.count(needle) == 1, 'Upstream dispatch changed; review capability guard'
guard = """if ( found!=NULL ) {
            if (!strcmp(name, "AutoTrace") || !strcmp(name, "Autotrace") ||
                !strcmp(name, "AskUser")) {
                EM_ASM({ Module['onCapabilityError']?.(); });
                ScriptError(&sub, "Command requires unavailable external programs or interactive UI");
                goto docall_skipfunc;
            }
"""
p.write_text('#include <emscripten.h>\n' + s.replace(needle, guard))
