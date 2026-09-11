// SPDX-License-Identifier: GPL-3.0-or-later
#include <woff2/decode.h>
#include <woff2/output.h>
#include <zlib.h>
#include <cstdio>
#include <vector>
#include <cstdint>
#include <cstring>
static const size_t LIMIT = 16 * 1024 * 1024;
static uint32_t u32(const uint8_t *p) { return (uint32_t(p[0])<<24)|(uint32_t(p[1])<<16)|(uint32_t(p[2])<<8)|p[3]; }
static void put32(uint8_t *p, uint32_t v) { p[0]=v>>24; p[1]=v>>16; p[2]=v>>8; p[3]=v; }
static void put16(uint8_t *p, unsigned v) { p[0]=v>>8; p[1]=v; }
// Decode into bounded SFNT bytes so JS can validate tables before FontForge
// parses them. This also rejects compressed variable/color fonts consistently.
extern "C" int ff_decode_webfont(const char *input, const char *output) {
    FILE *file=fopen(input,"rb");
    if (!file) return 1;
    fseek(file,0,SEEK_END); long size=ftell(file); rewind(file);
    if (size<44 || size>long(LIMIT)) { fclose(file); return 1; }
    std::vector<uint8_t> data(size);
    bool read=fread(data.data(),1,size,file)==size; fclose(file);
    if (!read) return 1;
    size_t expected=u32(data.data()+16);
    if (expected<12 || expected>LIMIT) return 2;
    std::vector<uint8_t> decoded(expected,0);
    if (u32(data.data())==0x774f4632) {
        woff2::WOFF2MemoryOut out(decoded.data(),decoded.size());
        if (!woff2::ConvertWOFF2ToTTF(data.data(),data.size(),&out)) return 3;
        decoded.resize(out.Size());
    } else if (u32(data.data())==0x774f4646) {
        unsigned count=(data[12]<<8)|data[13];
        if (!count || count>256 || 44+20*count>data.size() || 12+16*count>expected) return 3;
        put32(decoded.data(),u32(data.data()+4)); put16(decoded.data()+4,count);
        unsigned power=1,selector=0; while (power*2<=count) { power*=2; selector++; }
        put16(decoded.data()+6,power*16);put16(decoded.data()+8,selector);put16(decoded.data()+10,count*16-power*16);
        size_t cursor=12+16*count;
        for (unsigned i=0;i<count;i++) {
            const uint8_t *entry=data.data()+44+20*i;
            size_t offset=u32(entry+4), packed=u32(entry+8), length=u32(entry+12);
            if (offset>data.size() || packed>data.size()-offset || packed>length || cursor>expected || length>expected-cursor) return 3;
            uint8_t *table=decoded.data()+12+16*i;
            memcpy(table,entry,4);memcpy(table+4,entry+16,4);put32(table+8,cursor);put32(table+12,length);
            if (packed==length) memcpy(decoded.data()+cursor,data.data()+offset,length);
            else {
                uLongf capacity=length; uLong consumed=packed;
                if (uncompress2(decoded.data()+cursor,&capacity,data.data()+offset,&consumed)!=Z_OK || capacity!=length || consumed!=packed) return 3;
            }
            cursor+=(length+3)&~size_t(3);
        }
        if (cursor!=expected) return 3;
    } else return 3;
    file=fopen(output,"wb"); if (!file) return 4;
    bool written=fwrite(decoded.data(),1,decoded.size(),file)==decoded.size();fclose(file);
    return written?0:4;
}
extern "C" int ff_inflate_raw(const char *input, const char *output, int expected) {
    if (expected<0 || expected>int(LIMIT)) return 1;
    FILE *f=fopen(input,"rb"); if (!f) return 1;
    fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);
    if (n<0 || n>long(LIMIT)) { fclose(f); return 1; }
    std::vector<uint8_t> in(n),out(expected?expected:1);
    bool read=fread(in.data(),1,n,f)==size_t(n);fclose(f);if (!read) return 1;
    z_stream stream={};stream.next_in=in.data();stream.avail_in=n;stream.next_out=out.data();stream.avail_out=out.size();
    if (inflateInit2(&stream,-15)!=Z_OK) return 1;
    int result=inflate(&stream,Z_FINISH);
    bool ok=result==Z_STREAM_END && stream.total_out==size_t(expected) && stream.total_in==size_t(n);
    inflateEnd(&stream);if (!ok) return 1;
    f=fopen(output,"wb");if (!f) return 1;
    ok=fwrite(out.data(),1,expected,f)==size_t(expected);fclose(f);return ok?0:1;
}
