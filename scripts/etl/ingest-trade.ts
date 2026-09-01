/** Entry point for the HS6 trade ingest. See connectors/comtrade.ts. */
import { run } from "./connectors/comtrade";

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
