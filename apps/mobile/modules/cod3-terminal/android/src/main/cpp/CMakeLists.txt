cmake_minimum_required(VERSION 3.22.1)

project(cod3terminal LANGUAGES CXX)

add_library(ghostty-vt SHARED IMPORTED)
set_target_properties(
  ghostty-vt
  PROPERTIES IMPORTED_LOCATION
             "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libghostty-vt.so"
)

add_library(cod3terminal SHARED cod3_terminal_jni.cpp)

target_include_directories(
  cod3terminal
  PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../../../../native/libghostty-vt/include"
)

target_link_options(
  cod3terminal PRIVATE "-Wl,-z,common-page-size=16384" "-Wl,-z,max-page-size=16384"
)

target_link_libraries(cod3terminal PRIVATE ghostty-vt log)
