"""Rebuild checked-in WebAssembly engines with Emscripten 3.1.69+."""
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "vendor/knotscape/src"
OUT = ROOT / "web/wasm"
OUT.mkdir(parents=True, exist_ok=True)
CC = os.environ.get("EMCC", "emcc")
FLAGS = ["-O2", "-std=gnu89", "-fno-common", "-Wno-implicit-function-declaration",
         "-Wno-implicit-int", "-Wno-return-type", "-Wno-incompatible-pointer-types",
         "-Wno-int-conversion", "-Wno-deprecated-non-prototype", "-Wno-format",
         "-sMODULARIZE=1", "-sEXPORT_ES6=1", "-sENVIRONMENT=web,worker,node",
         "-sALLOW_MEMORY_GROWTH=1", "-sSTACK_SIZE=8388608", "-sINITIAL_MEMORY=33554432",
         "-sEXPORTED_RUNTIME_METHODS=FS,callMain", "-sINVOKE_RUN=0", "-sEXIT_RUNTIME=1", "-sFORCE_FILESYSTEM=1"]
ENGINES = ["checkknot", "mbt_ken", "poly1", "poly2", "glsig", "knotfind",
           "braid2dt", "decode_a", "decode_n", "locate_a", "locate_n", "dupsearch",
           "knot_group_reps", "draw2ps"]
for name in ENGINES + ["draw"]:
    sources = [SRC / (name + ".c")] if name != "draw" else [SRC / (f + ".c") for f in ["ken", "draw_main", "triang", "nodeseq"]]
    if (OUT / (name + ".mjs")).exists() and (OUT / (name + ".wasm")).stat().st_mtime > max(p.stat().st_mtime for p in sources + [Path(__file__)]):
        continue
    print("Building", name, flush=True)
    subprocess.run([CC, *FLAGS, *map(str, sources), "-I" + str(SRC), "-lm", "-o", str(OUT / (name + ".mjs"))], check=True)

kernel = ROOT / "vendor/snappy/kernel"
sources = sorted((kernel / "kernel_code").glob("*.c"))
sources += [kernel / "unix_kit" / f for f in ["unix_UI.c", "unix_file_io.c", "ostream.c"]]
sources += [kernel / "addl_code/dilog.c", SRC / "decode_new_DT.c", ROOT / "native/hyperbolic.c"]
includes = [kernel / "headers", kernel / "headers/precision/double", kernel / "unix_kit", kernel / "addl_code"]
print("Building SnapPea", flush=True)
subprocess.run([CC, *FLAGS, "-std=gnu11", *map(str, sources), *["-I" + str(p) for p in includes], "-lm", "-o", str(OUT / "hyperbolic.mjs")], check=True)
for directory in ["knotTable", "lib", "doc", "help"]:
    shutil.copytree(ROOT / "vendor/knotscape" / directory, ROOT / "web/data" / directory, dirs_exist_ok=True)
