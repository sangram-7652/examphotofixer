/**
 * Source checksum check (developer-side, read-only). Hash an official source you downloaded
 * yourself and compare it with the recorded verification history.
 *
 *   npm run source:checksum -- <file.pdf> [--source <source-id>] [--expect <sha256>]
 *   npm run source:checksum -- --list          # recorded checksums per source
 *
 * UNCHANGED → record a re-verification event. CHANGED → open a review; never edit a preset
 * from this output. The file is read locally and never sent anywhere.
 * See docs/EXAM_REQUIREMENT_VERIFICATION.md ("Source change workflow").
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { compareSource, recordedChecksums } from "../src/lib/requirements/checksum.ts";

function main(argv: string[]): number {
  if (argv.includes("--list")) {
    for (const [source, list] of recordedChecksums()) {
      console.log(source);
      for (const entry of list) console.log(`  ${entry.date}  ${entry.sha256}`);
    }
    return 0;
  }
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sourceId = value("--source");
  const expected = value("--expect");
  const file = argv.find(
    (arg, i) => !arg.startsWith("--") && argv[i - 1] !== "--source" && argv[i - 1] !== "--expect",
  );
  if (!file) {
    console.error("Usage: npm run source:checksum -- <file> [--source <id>] [--expect <sha256>]");
    return 2;
  }
  const bytes = new Uint8Array(readFileSync(file));
  const result = compareSource(bytes, { sourceId, expected });
  // Only the file's base name is printed, so local paths don't end up in logs or docs.
  console.log(`file     ${basename(file)}`);
  console.log(`bytes    ${result.bytes}`);
  console.log(`sha256   ${result.sha256}`);
  switch (result.outcome) {
    case "UNCHANGED":
      console.log(
        `result   UNCHANGED vs ${result.sourceId}${result.verifiedOn ? ` (verified ${result.verifiedOn})` : ""}`,
      );
      console.log(
        "next     record a re-verification event (UNCHANGED) in src/lib/presets/history.ts",
      );
      return 0;
    case "CHANGED":
      console.log(`result   CHANGED vs ${result.sourceId} (recorded ${result.recorded})`);
      console.log(
        "next     open a review: set SOURCE_STATES, re-read the requirement pages, compare the text.\n" +
          "         Do not change any preset until a person has verified the new text.",
      );
      return 3;
    case "UNKNOWN_SOURCE":
      console.log(`result   no recorded checksum for "${sourceId}" (see --list)`);
      return 2;
    case "NOT_COMPARED":
      console.log("result   not compared (pass --source <id> or --expect <sha256>)");
      return 0;
  }
}

process.exitCode = main(process.argv.slice(2));
