cmake_minimum_required(VERSION 3.22.1)

project(cod3highlights LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(COD3_HIGHLIGHTS_ROOT "${CMAKE_SOURCE_DIR}/..")

add_library(
  cod3highlights SHARED
  src/main/cpp/cpp-adapter.cpp
  "${COD3_HIGHLIGHTS_ROOT}/cpp/HybridCod3Highlights.cpp"
  "${COD3_HIGHLIGHTS_ROOT}/cpp/Utf16ToUtf8.cpp"
  "${COD3_HIGHLIGHTS_ROOT}/cpp/cod3_highlights.c"
  "${COD3_HIGHLIGHTS_ROOT}/Vendor/highlights/highlights.c"
  "${COD3_HIGHLIGHTS_ROOT}/Vendor/wasm2c/wasm-rt-impl.c"
  "${COD3_HIGHLIGHTS_ROOT}/Vendor/wasm2c/wasm-rt-mem-impl.c"
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/cod3highlights+autolinking.cmake)

target_include_directories(
  cod3highlights
  PRIVATE "${COD3_HIGHLIGHTS_ROOT}/cpp" "${COD3_HIGHLIGHTS_ROOT}/Vendor"
          "${COD3_HIGHLIGHTS_ROOT}/Vendor/highlights" "${COD3_HIGHLIGHTS_ROOT}/Vendor/wasm2c"
)

# Plain malloc memory with explicit bounds checks: no guard-page signal
# handlers competing with ART's.
target_compile_definitions(
  cod3highlights PRIVATE WASM_RT_USE_MMAP=0 WASM_RT_MEMCHECK_BOUNDS_CHECK=1
                       WASM_RT_SKIP_SIGNAL_RECOVERY=1
)

# The lexers are generated code; keep them fast in debug builds too.
target_compile_options(cod3highlights PRIVATE -O2)

target_link_options(
  cod3highlights PRIVATE "-Wl,-z,common-page-size=16384" "-Wl,-z,max-page-size=16384"
)
