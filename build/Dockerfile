FROM emscripten/emsdk:5.0.7@sha256:4e332f7343b6f66320bf72f7ecc01a3d9f3866721a13b0e5c7b96505d6ab148a AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gettext pkg-config ninja-build python3-pip autoconf automake libtool \
    xz-utils bzip2 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages meson==1.7.0
ENV PREFIX=/opt/wasm
ENV PKG_CONFIG_PATH=/opt/wasm/lib/pkgconfig
ENV EM_PKG_CONFIG_PATH=/opt/wasm/lib/pkgconfig
ENV CFLAGS="-O2 -I/opt/wasm/include"
ENV CXXFLAGS="-O2 -I/opt/wasm/include"
ENV LDFLAGS="-L/opt/wasm/lib"
COPY build/fetch.py build/sources.json /product/build/
RUN mkdir -p /work /opt/wasm
RUN python3 /product/build/fetch.py zlib && cd /work/zlib \
    && emconfigure ./configure --prefix=$PREFIX --static && emmake make -j4 install
RUN python3 /product/build/fetch.py libffi && cd /work/libffi \
    && emconfigure ./configure --host=wasm32-unknown-emscripten --prefix=$PREFIX \
    --disable-shared --disable-docs --disable-multi-os-directory --disable-exec-static-tramp \
    && emmake make -j4 install
RUN python3 /product/build/fetch.py pcre2 && cd /work/pcre2 \
    && emconfigure ./configure --host=wasm32-unknown-emscripten --prefix=$PREFIX \
    --disable-shared --disable-jit --disable-pcre2-16 --disable-pcre2-32 \
    --disable-pcre2grep-libz --disable-pcre2grep-libbz2 && emmake make -j4 install
COPY native/platform.c /product/native/platform.c
RUN emcc -c /product/native/platform.c -o /work/platform.o
COPY build/patch.py build/emscripten.ini /product/build/
RUN python3 /product/build/fetch.py glib && python3 /product/build/patch.py glib \
    && PKG_CONFIG_LIBDIR=$PKG_CONFIG_PATH meson setup /work/glib/out /work/glib \
    --cross-file=/product/build/emscripten.ini --prefix=$PREFIX --libdir=lib \
    --buildtype=release --default-library=static -Dtests=false -Ddocumentation=false \
    -Dman-pages=disabled -Dintrospection=disabled -Dnls=disabled -Dxattr=false \
    -Dselinux=disabled -Dlibmount=disabled -Ddtrace=disabled -Dsystemtap=disabled \
    -Dlibelf=disabled -Doss_fuzz=disabled -Dinstalled_tests=false \
    && (meson compile -C /work/glib/out -j4 > /work/glib-build.log 2>&1 || { grep -B3 -A8 -E 'error:|FAILED:' /work/glib-build.log; tail -10 /work/glib-build.log; exit 1; }) \
    && meson install -C /work/glib/out
RUN python3 /product/build/fetch.py freetype \
    && emcmake cmake -S /work/freetype -B /work/freetype/out -G Ninja \
    -DCMAKE_INSTALL_PREFIX=$PREFIX -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
    -DFT_DISABLE_HARFBUZZ=ON -DFT_DISABLE_BROTLI=ON -DFT_DISABLE_BZIP2=ON \
    -DFT_DISABLE_PNG=ON -DFT_REQUIRE_ZLIB=ON -DCMAKE_PREFIX_PATH=$PREFIX -DCMAKE_FIND_ROOT_PATH=$PREFIX \
    && cmake --build /work/freetype/out -j4 --target install
RUN python3 /product/build/fetch.py libxml2 && cd /work/libxml2 \
    && emconfigure ./configure --host=wasm32-unknown-emscripten --prefix=$PREFIX \
    --disable-shared --without-python --without-lzma --without-modules \
    --without-iconv --without-http --without-ftp --with-zlib=$PREFIX \
    && emmake make -j4 install
RUN python3 /product/build/fetch.py fontforge
FROM dependencies AS builder
COPY native /product/native
RUN python3 /product/build/patch.py fontforge \
    && emcmake cmake -S /work/fontforge -B /work/fontforge/out -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=$PREFIX -DCMAKE_FIND_ROOT_PATH=$PREFIX \
    -DBUILD_SHARED_LIBS=OFF -DENABLE_GUI=OFF -DENABLE_NATIVE_SCRIPTING=OFF \
    -DENABLE_PYTHON_SCRIPTING=OFF -DENABLE_PYTHON_EXTENSION=OFF -DENABLE_LIBSPIRO=OFF \
    -DENABLE_LIBGIF=OFF -DENABLE_LIBJPEG=OFF -DENABLE_LIBPNG=OFF -DENABLE_LIBREADLINE=OFF \
    -DENABLE_LIBTIFF=OFF -DENABLE_WOFF2=OFF -DENABLE_HARFBUZZ=OFF -DENABLE_DOCS=OFF \
    && cmake --build /work/fontforge/out --target fontforge-wasm -j4
RUN mkdir -p /output/dist /output/sources \
    && cp /work/fontforge/out/wasm-wrapper/fontforge-core.* /output/dist/ \
    && cp /sources/* /output/sources/ \
    && cp /product/build/sources.json /output/sources/
COPY build/licenses.py /product/build/licenses.py
RUN python3 /product/build/licenses.py \
    && tar czf /output/sources/emscripten-runtime.tar.gz -C /emsdk/upstream/emscripten system src LICENSE
FROM scratch AS export
COPY --from=builder /output/ /
