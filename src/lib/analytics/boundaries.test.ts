import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("analytics boundaries", () => {
  it.each(["src/lib/image", "src/lib/validation"])(
    "%s (engine and worker) never imports analytics or makes network calls",
    (dir) => {
      for (const file of sourceFiles(dir)) {
        const text = readFileSync(file, "utf8");
        expect(text, file).not.toMatch(/@\/lib\/analytics|from "\.\.\/analytics/);
        expect(text, file).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|WebSocket\(/);
      }
    },
  );

  it("adds no analytics SDK dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
  });
});
