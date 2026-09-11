// SPDX-License-Identifier: GPL-3.0-or-later
#include <fontforge-config.h>
#include "splinefont.h"
#include "encoding.h"
#include "splineorder2.h"
#include "splineutil.h"
#include "start.h"
#include "tottf.h"

// Each call is made in a fresh module instance with a private virtual filesystem.
// Numeric format IDs are our ABI, not FontForge's internal enum values.
int ff_convert(const char *input, const char *output, int format) {
    if (format != 1 && format != 2) return 1;
    doinitFontForgeMain();
    SplineFont *font = ReadSplineFont(input, 0);
    if (!font) return 2;
    if (font->subfontcnt || font->mm) {
        SplineFontFree(font);
        return 3;
    }
    if (format == 1) SFConvertToOrder2(font);
    else SFConvertToOrder3(font);
    EncMap *map = EncMapFromEncoding(font, FindOrMakeEncoding("UnicodeFull"));
    if (!map) { SplineFontFree(font); return 4; }
    int result = WriteTTFFont((char *)output, font, format == 1 ? ff_ttf : ff_otf,
                             NULL, bf_none, ttf_flag_otmode, map, ly_fore);
    EncMapFree(map);
    SplineFontFree(font);
    return result ? 0 : 5;
}
