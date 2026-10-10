/**
 * The parts of satellite.js the browser needs — SGP4 and the coordinate
 * transforms — imported from the library's plain JavaScript files, never from
 * its package root.
 *
 * satellite.js 7's root re-exports a WebAssembly bulk propagator that loads
 * its builds through package-internal imports (`#wasm-single-thread`,
 * `#wasm-multi-thread`) pointing at a `wasm-build/` folder the published
 * package does not contain. Bundling the root for the browser therefore asks
 * Turbopack to resolve modules that do not exist, and the production build
 * stalled until Vercel's 45-minute limit killed it — every deployment from
 * the commit that first put satellite.js in a client component. Importing the
 * files directly keeps the WebAssembly half out of the bundle entirely.
 *
 * Node code (the tests) may keep importing "satellite.js"; only the bundle
 * needs this.
 */
export { twoline2satrec } from "../node_modules/satellite.js/dist/io.js";
export { propagate, gstime } from "../node_modules/satellite.js/dist/propagation.js";
export { eciToGeodetic, degreesLat, degreesLong } from "../node_modules/satellite.js/dist/transforms.js";
export type { SatRec } from "satellite.js";
