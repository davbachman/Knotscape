# Third-party materials

## KnotScape 1.01

- Authors: Jim Hoste and Morwen Thistlethwaite; contributions by Bruce Ewing, Kenneth Millett, Kenneth Stephenson and Jeff Weeks.
- Original: https://web.math.utk.edu/~mthistle/knotscape.html
- Mirror: https://github.com/dimpase/knotscap
- Pinned commit: `782ff2d6cefdc2aed810cac0ceb2d740c793ea10`.
- Retained source, tables, data, documentation and credits: `vendor/knotscape/`.
- Original LinkSmith examples in `tests/fixtures/` are from the same revision.

The archive does not contain an overall open-source license. Its historical notices, `README`, and `Credits.ps` are preserved. The repository's MIT license does not apply to this imported material.

Portability changes: add missing declarations and system headers for modern C compilers; rename the representation engine's `conj` global to avoid a compiler builtin; use zero-initialized polynomial scratch buffers; preserve signed signature instead of applying `abs`; adapt DT decoding to the modern two-argument `triangulate_link_complement` API. Legacy routines run in separate Emscripten instances with `-fno-common`; process exit flushes output files before they are read. No Tcl code is evaluated in the browser.

## SnapPea kernel from SnapPy

- Authors: Jeff Weeks; Marc Culler, Nathan Dunfield, Matthias Goerner and contributors.
- Upstream: https://github.com/3-manifolds/SnapPy
- Pinned commit: `c3da53c2b3105489b4d71531c4f781c92b237753`.
- Copied from `src/snappy/extensions/SnapPy/kernel` into `vendor/snappy/kernel`.
- SnapPy distribution license: **GNU GPL version 2 or later**, as stated in the preserved `vendor/snappy/README.rst`. Full GPL v2 text: `vendor/snappy/COPYING`. Historical per-file notices are retained.

The kernel is compiled at double precision. The new `native/hyperbolic.c` adapts geometry, cusps, groups, triangulation serialization and isometry data to browser jobs. A small hook in `kernel_code/isometry_cusped.c` captures the exact numbered canonical triangulation used by the returned isometry maps, before the kernel frees its copy. The browser's fixed-locus algorithm is newly implemented in JavaScript; it does not use the unavailable original binary.

The build embeds the full corresponding source archive in the standalone app and ships it as `source.zip` alongside the static app. Keep that source and the notices with any binary redistribution. MIT-licensed original adapter/interface files do not remove GPL obligations on combined kernel binaries.

## Emscripten and build tools

The prebuilt runtime wrappers and WebAssembly binaries were generated using Emscripten 3.1.69 (LLVM 19). Emscripten runtime code is dual MIT/NCSA licensed; the distribution's complete copyright and runtime-library notices are preserved in `vendor/emscripten/NOTICE`. Emscripten is a build tool; no hosted compiler or runtime service is required.

esbuild is an MIT-licensed build dependency, recorded in `package-lock.json`. No third-party JavaScript package, hosted font or CDN script is fetched at runtime.
