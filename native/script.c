// SPDX-License-Identifier: GPL-3.0-or-later
#include <fontforge-config.h>
#include "fontforge.h"
#include "start.h"
#include "scripting.h"
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
    // Constrain the proof to documented native-script invocations. In particular,
    // do not enter stdin or claim support for the desktop CLI or Python.
    if (argc < 4 || strcmp(argv[1], "-lang=ff") ||
        (strcmp(argv[2], "-script") && strcmp(argv[2], "-c"))) {
        fprintf(stderr, "Usage: fontforge-script -lang=ff {-script file|-c script} [args...]\n");
        return 2;
    }
    doinitFontForgeMain();
    no_windowing_ui = true;
    ProcessNativeScript(argc, argv, NULL);
    return 0;
}
