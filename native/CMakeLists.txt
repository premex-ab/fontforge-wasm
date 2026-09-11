# SPDX-License-Identifier: GPL-3.0-or-later
add_executable(fontforge-wasm convert.c platform.c)
# FontForge's finder only lists GLib's shared-library dependencies. For a
# static WASM link include the private dependencies reported by pkg-config.
execute_process(COMMAND pkg-config --static --libs gio-2.0 gobject-2.0
  OUTPUT_VARIABLE GLIB_STATIC_FLAGS OUTPUT_STRIP_TRAILING_WHITESPACE
  COMMAND_ERROR_IS_FATAL ANY)
separate_arguments(GLIB_STATIC_FLAGS UNIX_COMMAND "${GLIB_STATIC_FLAGS}")
target_link_libraries(fontforge-wasm PRIVATE fontforge ${GLIB_STATIC_FLAGS})
set_target_properties(fontforge-wasm PROPERTIES OUTPUT_NAME fontforge-core SUFFIX .mjs
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}")
target_link_options(fontforge-wasm PRIVATE
  --no-entry -O2
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node
  -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sSTACK_SIZE=8388608
  -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1
  "-sEXPORTED_FUNCTIONS=['_ff_convert']"
  "-sEXPORTED_RUNTIME_METHODS=['FS','ccall']"
)
