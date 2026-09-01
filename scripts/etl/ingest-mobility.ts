/** Entry point for the mobility ingest. See connectors/mobility.ts. */
import { run } from "./connectors/mobility";
run({ onProgress: (s) => console.log(s) })
  .then((r) => { r.errors.forEach((e) => console.log("ERROR " + e)); })
  .catch((err) => { console.error(err); process.exit(1); });
