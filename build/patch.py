# SPDX-License-Identifier: GPL-3.0-or-later
"""Small, checked platform adaptations, applied only to locked sources."""
from pathlib import Path
import sys

def replace(path, before, after):
    path = Path(path)
    content = path.read_text()
    assert content.count(before) == 1, f'Unexpected upstream source: {path}'
    path.write_text(content.replace(before, after))

if sys.argv[1] == 'glib':
    # One conversion owns one worker/module. Use Emscripten's single-thread libc
    # rather than Meson's implicit shared-memory pthread pool.
    replace('/work/glib/meson.build', "thread_dep = dependency('threads')", "thread_dep = declare_dependency()")
    replace('/work/glib/gio/meson.build', "network_args = [ ]\nif host_system != 'windows'", "network_args = [ ]\nif host_system not in ['windows', 'emscripten']")
    replace('/work/glib/glib/glib-unix.c', '#error "g_unix_fd_query_path() not supported on this platform"', 'g_set_error_literal(error, G_FILE_ERROR, G_FILE_ERROR_NOSYS, "Not available in WebAssembly");\n  return NULL;')
else:
    replace('/work/fontforge/CMakeLists.txt', 'add_subdirectory(po)', '# Translations are not installed in the browser build.\nadd_subdirectory(/product/native wasm-wrapper)')
