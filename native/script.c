// SPDX-License-Identifier: GPL-3.0-or-later
#include <fontforge-config.h>
#include "fontforge.h"
#include "start.h"
#include "scripting.h"
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <emscripten.h>
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

// Never delegate script-triggered shell operations to the Node host.
static void unavailable(void) {
    EM_ASM({ Module['onCapabilityError']?.(); });
    errno = ENOSYS;
}
int system(const char *command) {
    if (!command) return 0;
    unavailable();
    return -1;
}
FILE *popen(const char *command, const char *mode) {
    (void)command; (void)mode;
    unavailable();
    return NULL;
}
