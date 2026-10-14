# KnotScape — browser workbench

A modern browser port of Jim Hoste and Morwen Thistlethwaite's KnotScape 1.01. Port by David Bachman with Codex. The responsive interface combines the original knot tables, editable diagrams, an invariant inspector, and a calculation notebook. Calculations run in browser workers on your device, using WebAssembly and JavaScript. There is no computation server, account, analytics, or upload service.

**[Open the browser app](https://davbachman.github.io/Knotscape/)** · [Download the portable offline app](https://davbachman.github.io/Knotscape/knotscape.html)

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) runs on pushes to `main` and can also be started from the Actions tab. It runs the mathematical tests, builds the static app and standalone HTML, checks browser workflows under `/Knotscape/`, and deploys `dist/` using GitHub's Pages actions. Pull requests run the build and tests without deploying. Repository **Settings → Pages → Source** must be **GitHub Actions**.

The checked-in WebAssembly binaries make deployment independent of an Emscripten installation. The deployment uses GitHub's built-in token and does not need a personal access token or a computation server. A final deployment check verifies that the published HTML and a WebAssembly engine are accessible.

## Run

The prebuilt WebAssembly engines are included. For the development workbench:

```sh
npm start
```

Open http://localhost:8000. Python serves static files only; it performs no calculations. Any static HTTP server works. For static deployment, use HTTPS so the optional offline cache can be installed.

To generate distributable files (Node 22+, Python 3):

```sh
npm ci
npm run build
```

- `dist/knotscape.html`: self-contained portable app, including all tables, engines, documentation dictionaries, and a downloadable corresponding-source archive. No network requests are needed for calculations after loading it. Open it in a modern browser that permits local module workers, or serve it from any static host.
- `dist/index.html` and accompanying assets: smaller initial download; engines and tables load on demand. Choose **Help → Make this app available offline** to cache the full app.
- `dist/source.zip`: corresponding C/JavaScript source, preserved notices, tests and build scripts. This is also embedded in the portable HTML.

The portable build was tested in Chromium with network access disabled after loading. The managed test browser blocks navigation to local `file:` URLs, so direct double-click launching has not been verified in this environment. Browser policies can require serving the file over HTTP. Firefox and Safari have not yet been tested.

## Use

Choose a crossing number, table and knot; or enter signed even DT labels, original `crossings ID DT...` records, or an alphabetic braid (`aBaB`, `aaa`; capitals invert generators). Table names use Hoste–Thistlethwaite ordering; the original Rolfsen conversion dictionaries are in Help.

Click **Identify knot** to simplify a projection, decompose a connected sum and search the original tables. Choose **Draw** to create polygonal knots or links, drag vertices, click crossings to change over/under information, reflect, or make the projection alternating. Double-click a vertex to remove it. **Use this knot** submits a single component for calculation. LinkSmith `.lsd` files can be imported and exported, including open arcs. Use **New curve** to finish an open arc; click endpoints to extend or join, select and cut edges to split, and adjust component color, width and orientation.

The inspector provides polynomial, geometry, symmetry and group calculations. Expand an individual symmetry to see its fixed sets and cusp action. Diagrams, horoballs, canonical cusp sections and Ford domains support zoom and SVG/PostScript export. For links, the drawing editor exports Ewing–Millett codes and SnapPea triangulations, as the original LinkSmith did; knot invariants require a single component.

Choose **Slopes** for the boundary slopes of a two-bridge knot. The app recognizes the current diagram when possible, or you can use the independent **From a two-bridge fraction** calculator. Enter the Hatcher–Thurston fraction `p/q` with `0 < |p| < q` and odd reduced denominator: `2/5` gives the figure-eight slopes `−4, 0, 4`; `1/3` gives `0, 6`. Negative `p` mirrors the knot and negates the slopes. Fractions are reduced automatically; two-component links (even reduced denominator) are rejected. Slope `r` represents `r·meridian + longitude`, with 0 the Seifert longitude. For the current DT diagram, signs agree with the orientation of this app's exported SnapPea complement (the positive DT trefoil `4 6 2` has slopes `−6, 0`).

Expand a slope result to inspect the continued fractions of the carrying branched surfaces, including the unique all-even Seifert expansion. Distinct branched surfaces may give the same slope. Download the full result as JSON or add it to the notebook. Manual fraction results are labeled separately from the current diagram and do not change it.

The slope computation uses exact `BigInt` arithmetic and the Hatcher–Thurston minimal Farey-path algorithm, adapted from Nathan Dunfield's public-domain program. Automatic hyperbolic recognition uses SnapPea's canonical triangulation; standard and simplified `(2,n)` torus-knot diagrams are also recognized. An unsuccessful recognition is inconclusive. Automatic hyperbolic recognition is limited to 30 diagram crossings to keep the kernel's 32-bit rational arithmetic within range; the direct fraction calculator accepts integers of up to 100 digits. Enumeration stops with an explicit error, without returning a partial slope set, at 10,000 branched surfaces, 100,000 total coefficients, or 200,000 path-search steps. The interface shows the first 100 continued-fraction rows; JSON downloads include them all. These calculations run in cancellable browser workers and are included in both offline distributions.

Jim Hoste suggested this addition following his work with Pat Shanahan on their CompuTop boundary-slope program. Their original program has not been located for this implementation; this is an independently sourced addition using Dunfield's implementation of the published algorithm.

A workspace automatically saves its codes and drawing in this browser's local storage. **Save workspace** downloads a JSON backup; **Import** restores it. Calculations are not included in automatic saves: download results or the calculation notebook to retain them. Large table ranges can be added to a workspace; workspace buttons are paginated. Batch polynomial calculations run sequentially and may be cancelled.

## Compatibility and implementation

| Original capability | Browser implementation |
| --- | --- |
| Prime-knot tables through 16 crossings | Original compressed alternating/nonalternating tables and decoders; range loading, page browsing and index search |
| DT entry, saved records and braids | Validation, original planar realizability checker and braid conversion |
| Simplification, prime decomposition, identification | Original `knotfind`, table locators and duplicate records |
| Planar diagrams | Original Stephenson circle-packing engine, rendered as SVG |
| Alexander, Jones, HOMFLY-PT, Kauffman | Original Ewing–Millett polynomial engines; conventions retained |
| Determinant and signature | Original Goeritz calculation; signature retains its sign rather than taking the absolute value |
| S₅ representations and branched-cover homology | Original meridional representation engine and its six conjugacy classes |
| Hyperbolic volume and maximal cusp | Modern SnapPea kernel, compiled to WebAssembly |
| Horoballs and canonical cell decomposition | Modern kernel data rendered as interactive SVG; canonical edge labels and nongenuine vertices included |
| Symmetry groups and individual fixed sets | Kernel isometries plus a new barycentric fixed-locus algorithm; ambient S³ classification for knot symmetries |
| SnapPea triangulation export | Original DT decoding and modern kernel serialization; link projections supported |
| LinkSmith | Open arcs and closed components; joining/cutting, colors, width, orientation, reflection, alternation, vertex editing, `.lsd`, Ewing–Millett and triangulation exports |
| Document/output windows | Workspace, notebook and local file exports; native browser text editing |

The feature matrix covers the original calculation and LinkSmith workflows, with modern browser interactions in place of the original Tcl/Tk windows. The fixed-set implementation is new and tested on synthetic maps and representative knots; exhaustive equivalence with the unavailable legacy fixed-set executable has not been established. Native desktop window management and every historical keyboard gesture are not reproduced.

Computational limits remain relevant: 49 crossings, bridge number at most 5 for representations, finite-precision integer coefficients in legacy engines, and numerical (not interval-certified) hyperbolic geometry. Some routines require a prime reduced projection. An unsuccessful hyperbolic solution does not prove nonhyperbolicity. Jobs run in disposable workers and can be cancelled; long jobs are not silently replaced by sample results. This app is not an arbitrary-link polynomial calculator, just as original KnotScape's calculation interface was for knots.

## Validate

```sh
npm test
# Optional real-browser integration tests:
pip install -r tests/requirements.txt
# Set CHROMIUM to a locally installed Chromium/Chrome executable if needed.
python3 tests/browser.py
```

Tests cover known trefoil/figure-eight invariants and mirrors, table endpoints through 16 crossings, identification and connected sums, braid conversion, realizability, numerical geometry, symmetry maps and fixed loci, group representations, original drawing-file round trips, and link triangulations. Browser checks cover desktop/mobile layouts, editor/import/export flows, the calculation inspector, standalone offline computation and offline cache installation. Screenshots are written to `test-results/`. Six additional knot complements, including 16n1008906, were cross-checked against Python SnapPy for volume and symmetry order; legacy trefoil and four-component drawing exports were also loaded in SnapPy.

Boundary-slope tests compare 791 cases with the preserved independent Python reference, check mirrors and exact continued-fraction identities, reject links and invalid input, exercise resource limits, and verify diagram recognition and standalone offline calculations. Run `python3 scripts/boundary_slope_fixtures.py` to regenerate the reference fixture from `vendor/two-bridge/`.

## Rebuild the mathematical engines

Install Emscripten (built here with **3.1.69**, LLVM 19), then:

```sh
npm run build:wasm
npm test
npm run build
```

`EMCC` can specify an alternative compiler path. The build script compiles 16 independent modules and copies the original data. Each calculation gets a fresh module instance and an in-memory filesystem, so legacy globals cannot leak between jobs. The portable bundle embeds those modules and data in a Blob worker; all calculations stay off the UI thread.

`web/` contains the interface and JS adapters; `native/` the modern kernel adapter; `vendor/` the retained upstream sources; `scripts/` reproducible engine and distribution builds. `web/fixed-sets.mjs` identifies invariant barycentric flag cells under exact canonical-tetrahedron isometries, truncates ideal vertices, and classifies connected fixed loci. Numeric canonicalization still inherits the kernel's floating-point limits.

## Credits and licensing

See [THIRD_PARTY.md](THIRD_PARTY.md) for pinned sources and modifications. The existing MIT license covers new original code; it does not relicense third-party sources. SnapPea/SnapPy is distributed under GPL-2.0-or-later, and the source archive accompanies the binary. KnotScape's historical source archive does not include a blanket open-source license; its authorship and original notices are preserved. This is an independent port, not an official release by the original authors.
