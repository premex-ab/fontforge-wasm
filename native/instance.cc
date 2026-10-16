// SPDX-License-Identifier: GPL-3.0-or-later
#include <harfbuzz/hb.h>
#include <harfbuzz/hb-ot.h>
#include <harfbuzz/hb-subset.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <string>
#include <vector>
extern "C" int ff_instance(const char *input, const char *output, const char *coordinates) {
    FILE *f=fopen(input,"rb");if (!f) return 1;
    fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);
    if (n<12 || n>16*1024*1024) {fclose(f);return 1;}
    std::vector<char> bytes(n);bool read=fread(bytes.data(),1,n,f)==size_t(n);fclose(f);if(!read)return 1;
    hb_blob_t *blob=hb_blob_create(bytes.data(),n,HB_MEMORY_MODE_READONLY,nullptr,nullptr);
    hb_face_t *face=hb_face_create(blob,0);
    hb_subset_input_t *settings=hb_subset_input_create_or_fail();
    if(!settings){hb_face_destroy(face);hb_blob_destroy(blob);return 2;}
    hb_subset_input_keep_everything(settings);
    hb_subset_input_set_flags(settings, hb_subset_input_get_flags(settings) | HB_SUBSET_FLAGS_RETAIN_GIDS | HB_SUBSET_FLAGS_DOWNGRADE_CFF2);
    bool ok=hb_subset_input_pin_all_axes_to_default(settings,face);
    std::string text(coordinates);size_t start=0;unsigned count=0;
    while(ok && start<text.size()) {
        size_t end=text.find(',',start);if(end==std::string::npos)end=text.size();
        std::string entry=text.substr(start,end-start);char *stop=nullptr;
        if(entry.size()<6 || entry[4]!='=' || ++count>64){ok=false;break;}
        float value=strtof(entry.c_str()+5,&stop);hb_ot_var_axis_info_t axis;
        hb_tag_t tag=HB_TAG(entry[0],entry[1],entry[2],entry[3]);
        if(*stop || !std::isfinite(value) || !hb_ot_var_find_axis_info(face,tag,&axis) || value<axis.min_value || value>axis.max_value){ok=false;break;}
        ok=hb_subset_input_pin_axis_location(settings,face,tag,value);start=end+1;
    }
    hb_face_t *result=ok?hb_subset_or_fail(face,settings):nullptr;
    int status=3;
    if(result){
        hb_blob_t *out=hb_face_reference_blob(result);unsigned length=0;const char *data=hb_blob_get_data(out,&length);
        if(length && length<=32*1024*1024){f=fopen(output,"wb");if(f){status=fwrite(data,1,length,f)==length?0:4;fclose(f);}}
        hb_blob_destroy(out);hb_face_destroy(result);
    }
    hb_subset_input_destroy(settings);hb_face_destroy(face);hb_blob_destroy(blob);return status;
}
