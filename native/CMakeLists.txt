# SPDX-License-Identifier: GPL-3.0-or-later
add_executable(fontforge-wasm convert.c platform.c codecs.cc)
# FontForge's finder only lists GLib's shared-library dependencies. For a
# static WASM link include the private dependencies reported by pkg-config.
execute_process(COMMAND pkg-config --static --libs gio-2.0 gobject-2.0 libwoff2enc libwoff2dec
  OUTPUT_VARIABLE GLIB_STATIC_FLAGS OUTPUT_STRIP_TRAILING_WHITESPACE
  COMMAND_ERROR_IS_FATAL ANY)
separate_arguments(GLIB_STATIC_FLAGS UNIX_COMMAND "${GLIB_STATIC_FLAGS}")
target_link_libraries(fontforge-wasm PRIVATE fontforge ${GLIB_STATIC_FLAGS})
set_target_properties(fontforge-wasm PROPERTIES OUTPUT_NAME fontforge-core SUFFIX .mjs
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")
target_link_options(fontforge-wasm PRIVATE
  --no-entry -O2 -sEMULATE_FUNCTION_POINTER_CASTS=1
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node
  -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sSTACK_SIZE=8388608
  -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1
  "-sEXPORTED_FUNCTIONS=['_ff_convert','_ff_decode_webfont','_ff_inflate_raw']"
  "-sEXPORTED_RUNTIME_METHODS=['FS','ccall']"
)

# Experimental native-script executable. Only built in the scripting target.
if(ENABLE_NATIVE_SCRIPTING)
  add_executable(fontforge-script script.c platform.c)
  target_link_libraries(fontforge-script PRIVATE fontforge ${GLIB_STATIC_FLAGS})
  set_target_properties(fontforge-script PROPERTIES OUTPUT_NAME fontforge-script SUFFIX .mjs
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")
  target_link_options(fontforge-script PRIVATE
    -O2 -sEMULATE_FUNCTION_POINTER_CASTS=1 -fwasm-exceptions -sSUPPORT_LONGJMP=wasm
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node
    -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sSTACK_SIZE=8388608
    -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1 -sEXIT_RUNTIME=1
    "-sEXPORTED_RUNTIME_METHODS=['FS','callMain']")
endif()
