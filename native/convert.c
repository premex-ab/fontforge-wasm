// SPDX-License-Identifier: GPL-3.0-or-later
#include <fontforge-config.h>
#include "splinefont.h"
#include "fontforge.h"
#include "encoding.h"
#include "splineorder2.h"
#include "splineutil.h"
#include "start.h"
#include "tottf.h"
#include "woff.h"
#include "svg.h"
#include "dumppfa.h"
#include "macbinary.h"
#include "splinesaveafm.h"
#include "splinefill.h"
#include "winfonts.h"
#include "sfd.h"
#include "dumpbdf.h"
#include "palmfonts.h"

// Preserve a bitmap font's pixel appearance as rectangular outline runs.
// This is deliberately not smoothing/autotracing; the demo labels the loss.
static int bitmap_to_outlines(SplineFont *font) {
    BDFFont *bdf=font->bitmaps;
    if (!bdf) return 0;
    while (bdf->next) bdf=bdf->next;
    if (bdf->pixelsize<=0 || bdf->pixelsize>256) return 0;
    double scale=(font->ascent+font->descent)/(double)bdf->pixelsize;
    unsigned runs=0;
    for (int gid=0;gid<font->glyphcnt && gid<bdf->glyphcnt;gid++) {
        SplineChar *sc=font->glyphs[gid]; BDFChar *bc=bdf->glyphs[gid];
        if (!sc || !bc || !bc->bitmap) continue;
        if (bc->byte_data || bc->bytes_per_line<((bc->xmax-bc->xmin+8)/8) || bc->xmax-bc->xmin>512 || bc->ymax-bc->ymin>512) return 0;
        sc->width=bc->width*scale;
        for(int y=bc->ymin;y<=bc->ymax;y++) {
            int x=bc->xmin;
            while(x<=bc->xmax) {
                int start=x;
                while(x<=bc->xmax && !(bc->bitmap[(bc->ymax-y)*bc->bytes_per_line+((x-bc->xmin)>>3)] & (0x80>>((x-bc->xmin)&7)))) x++;
                start=x;
                while(x<=bc->xmax && (bc->bitmap[(bc->ymax-y)*bc->bytes_per_line+((x-bc->xmin)>>3)] & (0x80>>((x-bc->xmin)&7)))) x++;
                if(start==x)continue;
                if(++runs>100000)return 0;
                SplineSet *ss=chunkalloc(sizeof(SplineSet));
                SplinePoint *a=SplinePointCreate(start*scale,y*scale),*b=SplinePointCreate(start*scale,(y+1)*scale),*c=SplinePointCreate(x*scale,(y+1)*scale),*d=SplinePointCreate(x*scale,y*scale);
                SplineMake3(a,b);SplineMake3(b,c);SplineMake3(c,d);SplineMake3(d,a);
                ss->first=ss->last=a;ss->next=sc->layers[ly_fore].splines;sc->layers[ly_fore].splines=ss;
            }
        }
    }
    font->onlybitmaps=false;return 1;
}

// Numeric format IDs are our ABI, not FontForge's internal enum values.
int ff_convert(const char *input, const char *output, int format) {
    if (format < 1 || format > 25) return 1;
    doinitFontForgeMain();
    no_windowing_ui = true;
    SplineFont *font = ReadSplineFont(input, 0);
    if (!font) return 2;
    if (font->subfontcnt || font->mm) { SplineFontFree(font); return 3; }
    // Bitmap inputs need explicit tracing; do not silently emit empty outlines.
    if (font->onlybitmaps && format != 21 && !(format >= 22 && format <= 25) && format != 19 && !bitmap_to_outlines(font)) { SplineFontFree(font); return 6; }
    // An explicitly present blank glyph still carries an advance width.
    for (int i=0;i<font->glyphcnt;i++) if(font->glyphs[i]) {
        font->glyphs[i]->widthset=true;
        // A .notdef fallback glyph is not an encoded character. Bitmap readers
        // may assign it a spare slot; do not publish that slot as real Unicode.
        if (!strcmp(font->glyphs[i]->name,".notdef")) font->glyphs[i]->unicodeenc=-1;
    }
    int quadratic = format==1 || format==3 || format==4 || format==9 || format==12 || format==13 || format==20;
    if (format != 21) { if (quadratic) SFConvertToOrder2(font); else SFConvertToOrder3(font); }
    EncMap *map = EncMapFromEncoding(font, FindOrMakeEncoding((format==17 || format==18 || format==19 || format==23 || format==25)?"win":"UnicodeFull"));
    if (!map) { SplineFontFree(font); return 4; }
    int result=0;
    switch (format) {
    case 1: case 2: case 8:
        result=WriteTTFFont((char *)output,font,format==1?ff_ttf:format==2?ff_otf:ff_cff,NULL,bf_none,format==8?ps_flag_nocffsugar:ttf_flag_otmode,map,ly_fore); break;
    case 3: result=WriteWOFFFont((char *)output,font,ff_woff_ttf,NULL,bf_none,ttf_flag_otmode,map,ly_fore); break;
    case 4: result=WriteWOFF2Font((char *)output,font,ff_woff2_ttf,NULL,bf_none,ttf_flag_otmode,map,ly_fore); break;
    case 5: result=WriteSVGFont(output,font,ff_svg,0,map,ly_fore); break;
    case 6: case 7: case 9: case 10: case 11: case 20:
        result=WritePSFont((char *)output,font,format==7?ff_pfb:format==9?ff_type42:format==11?ff_ptype3:format==20?ff_type42cid:ff_pfa,0,map,NULL,ly_fore); break;
    case 12: case 13: result=WriteMacTTFFont((char *)output,font,format==12?ff_ttfdfont:ff_ttfmacbin,NULL,bf_none,ttf_flag_otmode,map,ly_fore); break;
    case 14: result=WriteMacPSFont((char *)output,font,ff_pfbmacbin,0,map,ly_fore); break;
    case 15: result=WriteUFOFont(output,font,ff_ufo3,0,map,ly_fore,3); break;
    case 16: case 17: case 18: {
        FILE *file=fopen(output,"wb");
        if (file) {
            result=format==16?AfmSplineFont(file,font,ff_pfa,map,0,NULL,ly_fore):format==17?PfmSplineFont(file,font,map,ly_fore):TfmSplineFont(file,font,map,ly_fore);
            fclose(file);
        }
        break;
    }
    case 21: result=SFDWrite((char *)output,font,map,NULL,0); break;
    case 19: case 22: case 23: case 24: case 25: {
        if (!font->bitmaps) font->bitmaps=SplineFontRasterize(font,ly_fore,16,false);
        int32_t sizes[]={16,0};
        if (font->bitmaps) { sizes[0]=font->bitmaps->pixelsize | (BDFDepth(font->bitmaps)<<16);
            if (format==19) result=FONFontDump((char *)output,font,sizes,96,map);
            else if (format==22) result=BDFFontDump((char *)output,font->bitmaps,map,96);
            else if (format==23) result=FNTFontDump((char *)output,font->bitmaps,map,96);
            else if (format==24) result=WriteTTFFont((char *)output,font,ff_none,sizes,bf_otb,0,map,ly_fore);
            else result=WritePalmBitmaps(output,font,sizes,map); }
        break;
    }
    }
    EncMapFree(map);
    SplineFontFree(font);
    return result?0:5;
}
