/**
 * `npm run test:museum`
 *
 * The walls hold only what may hang on them: every work's licence is one
 * Commons records as free, its image is served by Wikimedia, and the
 * copyright arithmetic for the artists who cannot hang yet is the Act's.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOMS, FREE_LICENSE, WIKIMEDIA_IMAGE, freeYear, type Museum } from "../lib/museum-shared";
import { cleanTitle, cleanYear, cleanArtist, cleanCredit } from "./etl/connectors/museum";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `  (${detail})`}`);
}

console.log("\nCopyright arithmetic (Copyright Act, 1957, s. 22: sixty years from the year after death)");
check("died 1966 → free from 2027", freeYear(1966) === 2027);
check("died 1941 → free from 2002", freeYear(1941) === 2002);
check("still living → no year", freeYear(null) === null);

console.log("\nLicences the walls accept");
for (const l of ["Public domain", "CC BY-SA 4.0", "CC BY 2.0", "CC0"]) check(`accepts "${l}"`, FREE_LICENSE.test(l));
for (const l of ["Fair use", "All rights reserved", "Copyrighted free use? no", ""]) check(`refuses "${l}"`, !FREE_LICENSE.test(l));

console.log("\nCleaning Commons descriptions");
check("template residue leaves a title", cleanTitle('Prince Aurangzeblabel QS:Len,"Prince Aurangzeb"') === "Prince Aurangzeb");
check("an upload timestamp leaves a date", cleanYear("1720, 2012-09-07 13:48") === "1720");
check("a place is not an artist", cleanArtist("(Rajasthan, Kishangarh)") === null && cleanArtist("Made in Kota, Rajasthan, India") === null);
check("'Indian painter c. 1640' is not a name", cleanArtist("Indischer Maler um 1640") === null);
check("a named painter stays", cleanArtist("Basawan") === "Basawan");
check("a URL is not a collection", cleanCredit("http://www.mfa.org/collections/object/x") === null && cleanCredit("Self-scanned") === null);
check("a museum stays", cleanCredit("National Gallery of Victoria") === "National Gallery of Victoria");

console.log("\nThe rooms");
check("every room hangs an artist or a school", ROOMS.every((r) => (r.artists?.length ?? 0) + (r.movements?.length ?? 0) > 0));
check("room ids are unique", new Set(ROOMS.map((r) => r.id)).size === ROOMS.length);

const FILE = join(process.cwd(), "data", "art", "museum.json");
console.log("\nThe committed collection");
if (!existsSync(FILE)) {
  console.log("  (no data/art/museum.json yet — the ingest workflow writes it)");
} else {
  const d = JSON.parse(readFileSync(FILE, "utf8")) as Museum;
  const works = d.rooms.flatMap((r) => r.works);
  check("every work's licence is free", works.every((w) => FREE_LICENSE.test(w.image.license)),
    works.filter((w) => !FREE_LICENSE.test(w.image.license)).map((w) => w.title).slice(0, 3).join(", "));
  const offHost = works.filter((w) => !WIKIMEDIA_IMAGE.test(w.image.thumb));
  check("every image is served by Wikimedia over https", offHost.length === 0, offHost.slice(0, 3).map((w) => `${w.title}: ${w.image.thumb.slice(0, 50)}`).join("; "));
  check("every work links to its Commons file page", works.every((w) => /^https:\/\/commons\.wikimedia\.org\//.test(w.image.page)));
  const junk = works.filter((w) => /^https?:|date QS|^user:/i.test(`${w.artist ?? ""} ${w.year ?? ""}`.trim()) || /date QS/i.test(w.year ?? "") || /(label|title)\s*QS:/i.test(w.title) || /https?:/i.test(w.collection ?? ""));
  check("no machine residue in a label", junk.length === 0, junk.slice(0, 3).map((w) => `${w.title}: ${w.artist} / ${w.year}`).join("; "));
  const files = works.map((w) => w.image.file);
  check("no picture hangs twice in the museum", new Set(files).size === files.length);
  check("no work hangs twice in one room", d.rooms.every((r) => new Set(r.works.map((w) => w.qid)).size === r.works.length));
  check("every room in the file is a room on the page", d.rooms.every((r) => ROOMS.some((x) => x.id === r.id)));
  const stillLocked = d.notYet.filter((a) => a.freeIn !== null && a.freeIn <= new Date().getUTCFullYear());
  check("no 'not yet' artist is already free", stillLocked.length === 0, stillLocked.map((a) => a.name).join(", "));
  console.log(`  (${works.length} works in ${d.rooms.length} rooms)`);
}

console.log(failed ? `\n${failed} failed\n` : "\nall passed\n");
process.exit(failed ? 1 : 0);
