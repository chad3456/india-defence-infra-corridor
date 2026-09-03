/** Entry point for the statewise OSM census. See connectors/census.ts. */
import { run } from "./connectors/census";
run({ onProgress: (s) => console.log(s) })
  .then((r) => r.errors.forEach((e) => console.log("ERROR " + e)))
  .catch((err) => { console.error(err); process.exit(1); });
