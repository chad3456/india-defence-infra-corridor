/** Entry point for the Vande Bharat service ingest. See connectors/vande.ts. */
import { run } from "./connectors/vande";
run({ onProgress: (s) => console.log(s) })
  .then((r) => r.errors.forEach((e) => console.log("ERROR " + e)))
  .catch((err) => { console.error(err); process.exit(1); });
