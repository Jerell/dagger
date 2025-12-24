// Build script to link against the dim static library and generate bindings

use std::env;
use std::path::PathBuf;

fn main() {
    // Only build bindings and link library for native targets (not WASM)
    if env::var("TARGET").unwrap().contains("wasm32") {
        return;
    }

    // Path to dim library files (now in cli/src/dim)
    let dim_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("dim");

    let lib_path = dim_dir.join("libdim_c.a");
    let header_path = dim_dir.join("dim.h");

    // Check if library exists
    if !lib_path.exists() {
        panic!(
            "dim library not found at {}. Please build it with: cd dim && zig build -Dtarget=native -Doptimize=ReleaseFast",
            lib_path.display()
        );
    }

    // Tell cargo where to find the static library
    println!("cargo:rustc-link-search=native={}", dim_dir.display());
    println!("cargo:rustc-link-lib=static=dim_c");

    // Generate bindings using bindgen (as recommended in RUST_INTEGRATION.md)
    let bindings = bindgen::Builder::default()
        .header(header_path.to_str().unwrap())
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .layout_tests(false) // Disable layout tests to avoid segfaults in test code
        .generate()
        .expect("Unable to generate bindings");

    // Write bindings to OUT_DIR
    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("dim_bindings.rs"))
        .expect("Couldn't write bindings!");

    // Tell cargo to rerun if library or header changes
    println!("cargo:rerun-if-changed={}", lib_path.display());
    println!("cargo:rerun-if-changed={}", header_path.display());
}
