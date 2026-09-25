/**
 * Launch / post-deploy smoke check (GET requests only; never uploads or processes images).
 *
 *   npm run smoke -- <base-url> [--origin https://examphotofixer.com] [--prelaunch]
 *     [--allow-harness] [--host-checks]
 *
 * Defaults: launch mode (crawling must be allowed), canonical origin = base URL, the engine
 * test harness must be a 404. Use --host-checks only against the real domain.
 * Exit code 0 = every check passed. See docs/DEPLOYMENT.md.
 */

import { formatSmokeReport, runSmokeCheck, type SmokeFetcher } from "../src/lib/launch/smoke.ts";

const fetcher: SmokeFetcher = async (url) => {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "ExamPhotoFixer-smoke-check" },
    signal: AbortSignal.timeout(15_000),
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, text: await response.text() };
};

async function main(argv: string[]): Promise<number> {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--") && arg !== "--origin"));
  const originIndex = argv.indexOf("--origin");
  const origin = originIndex >= 0 ? argv[originIndex + 1] : undefined;
  const positional = argv.filter(
    (arg, index) => !arg.startsWith("--") && (originIndex < 0 || index !== originIndex + 1),
  );
  const baseUrl = positional[0];
  const known = ["--prelaunch", "--allow-harness", "--host-checks"];
  const unknown = [...flags].filter((flag) => !known.includes(flag));
  if (!baseUrl || unknown.length > 0 || (originIndex >= 0 && !origin)) {
    console.error(
      "Usage: npm run smoke -- <base-url> [--origin <canonical-origin>] [--prelaunch] [--allow-harness] [--host-checks]",
    );
    return 2;
  }
  const checks = await runSmokeCheck(fetcher, {
    baseUrl,
    canonicalOrigin: (origin ?? baseUrl).replace(/\/+$/, ""),
    indexable: !flags.has("--prelaunch"),
    allowHarness: flags.has("--allow-harness"),
    hostChecks: flags.has("--host-checks"),
  });
  console.log(formatSmokeReport(checks));
  return checks.every((check) => check.ok) ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
