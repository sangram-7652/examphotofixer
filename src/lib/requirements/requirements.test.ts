import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPreset, listPresets } from "@/lib/presets";
import { latestEvent, requirementVersions, VERIFICATION_HISTORY } from "@/lib/presets/history";
import { compareSource, recordedChecksums, sha256Hex } from "./checksum";
import {
  addDays,
  auditPreset,
  changeImpact,
  monitoringReport,
  monitoringRow,
  REVIEW_INTERVAL_DAYS,
  snapshotOf,
} from "./monitoring";
import { formatMonitoringTable, readGenerated, replaceGenerated } from "./report";

describe("verification history", () => {
  it("covers every preset, and each preset equals its latest verified snapshot", () => {
    for (const preset of listPresets()) {
      const versions = requirementVersions(preset.id);
      expect(versions.length, preset.id).toBeGreaterThan(0);
      const current = versions[versions.length - 1];
      expect(current.status, preset.id).toBe("CURRENT");
      // A preset value can't change without a new verification event.
      expect(current.snapshot, preset.id).toEqual(snapshotOf(preset));
    }
  });

  it("matches each source's current metadata (checksum, date, version)", () => {
    for (const preset of listPresets()) {
      const event = latestEvent(preset.source.id)!;
      expect(event.sha256, preset.id).toBe(preset.source.sha256);
      expect(event.date, preset.id).toBe(preset.source.verifiedOn);
      expect(event.version, preset.id).toBe(preset.source.version);
      expect(event.published, preset.id).toBe(preset.source.published);
    }
  });

  it("is append-only in time order, with valid outcomes and checksums", () => {
    const dates = VERIFICATION_HISTORY.map((event) => event.date);
    expect([...dates].sort()).toEqual(dates);
    for (const event of VERIFICATION_HISTORY) {
      expect(event.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(["INITIAL", "UNCHANGED", "CHANGED", "UNCERTAIN"]).toContain(event.outcome);
      expect(event.notes.length).toBeGreaterThan(0);
    }
  });

  it("records the P12 re-verification of CCC and IBPS as UNCHANGED (same checksum)", () => {
    const byKey = (sourceId: string) =>
      VERIFICATION_HISTORY.filter((event) => event.sourceId === sourceId).map(
        (event) => `${event.date}:${event.outcome}:${event.sha256.slice(0, 8)}`,
      );
    expect(byKey(getPreset("ccc-photo").source.id)).toEqual([
      "2026-09-24:INITIAL:853cbfca",
      "2026-09-25:UNCHANGED:853cbfca",
    ]);
    expect(byKey(getPreset("ibps-photo").source.id)).toEqual([
      "2026-09-24:INITIAL:105b0652",
      "2026-09-25:UNCHANGED:105b0652",
    ]);
  });

  it("keeps older values as SUPERSEDED versions instead of overwriting them", () => {
    // Simulated: the same preset verified with different values later.
    const original = VERIFICATION_HISTORY.find((e) => e.presets["ibps-photo"])!;
    const changed = {
      ...original,
      date: "2099-01-01",
      outcome: "CHANGED" as const,
      presets: { "ibps-photo": { ...original.presets["ibps-photo"], width: 1 } },
    };
    (VERIFICATION_HISTORY as unknown as unknown[]).push(changed);
    try {
      const versions = requirementVersions("ibps-photo");
      expect(versions.map((v) => v.status)).toEqual(["SUPERSEDED", "CURRENT"]);
      expect(versions[0].snapshot.width).toBe(getPreset("ibps-photo").width);
      expect(auditPreset(getPreset("ibps-photo"))).toContain(
        "preset values differ from the latest verified snapshot",
      );
    } finally {
      (VERIFICATION_HISTORY as unknown as unknown[]).pop();
    }
  });
});

describe("monitoring status", () => {
  const preset = getPreset("ibps-signature");
  const verified = latestEvent(preset.source.id)!.date;

  it("is VERIFIED until the review date, then REVIEW_DUE (a signal, not invalidation)", () => {
    const due = addDays(verified, REVIEW_INTERVAL_DAYS);
    expect(monitoringRow(preset, verified).status).toBe("VERIFIED");
    expect(monitoringRow(preset, due).status).toBe("VERIFIED");
    expect(monitoringRow(preset, addDays(due, 1)).status).toBe("REVIEW_DUE");
    // The preset itself is untouched: values still served.
    expect(getPreset("ibps-signature").width).toBe(preset.width);
  });

  it("reports every preset with no audit findings", () => {
    const rows = monitoringReport(verified);
    expect(rows.map((row) => row.presetId)).toEqual(listPresets().map((p) => p.id));
    for (const p of listPresets()) expect(auditPreset(p), p.id).toEqual([]);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-25", 90)).toBe("2026-12-24");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("change impact", () => {
  it("lists the tools, pack and guides derived from a preset", () => {
    const impact = changeImpact("ibps-signature");
    expect(impact.tools.map((t) => t.id).sort()).toEqual(["ibps-pack", "ibps-signature"]);
    expect(impact.guides.map((g) => g.slug)).toEqual(["ibps-signature-thumb-declaration-size"]);
    expect(impact.checklist.join("\n")).toMatch(/history\.ts/);
    expect(impact.checklist.join("\n")).toMatch(/Social posts/);
  });
});

describe("source checksum", () => {
  const bytes = new TextEncoder().encode("not the real notification");

  it("hashes with SHA-256", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("reports CHANGED against a recorded source and never touches presets", () => {
    const before = JSON.stringify(listPresets());
    const result = compareSource(bytes, { sourceId: "ibps-crp-rrbs-xv-notification" });
    expect(result).toMatchObject({
      outcome: "CHANGED",
      recorded: getPreset("ibps-photo").source.sha256,
    });
    expect(JSON.stringify(listPresets())).toBe(before);
  });

  it("reports UNCHANGED when the checksum matches, and handles unknown sources", () => {
    expect(compareSource(bytes, { expected: sha256Hex(bytes) }).outcome).toBe("UNCHANGED");
    expect(compareSource(bytes, { sourceId: "no-such-source" }).outcome).toBe("UNKNOWN_SOURCE");
    expect(compareSource(bytes).outcome).toBe("NOT_COMPARED");
    expect([...recordedChecksums().keys()].sort()).toEqual([
      "ibps-crp-rrbs-xv-notification",
      "nielit-ccc-guidelines-v1.11",
    ]);
  });
});

describe("docs/REQUIREMENT_MONITORING.md", () => {
  it("contains the generated table for its 'as of' date (regenerate with --write)", () => {
    const doc = readFileSync("docs/REQUIREMENT_MONITORING.md", "utf8");
    const generated = readGenerated(doc);
    expect(generated).not.toBeNull();
    const expected = formatMonitoringTable(monitoringReport(generated!.today), generated!.today);
    expect(generated!.table).toBe(expected);
  });

  it("replaces only the generated block", () => {
    const doc =
      "a\n<!-- BEGIN GENERATED: npm run requirements:report -- --write -->\nold\n<!-- END GENERATED -->\nb";
    expect(replaceGenerated(doc, "new")).toBe(
      "a\n<!-- BEGIN GENERATED: npm run requirements:report -- --write -->\n\nnew\n\n<!-- END GENERATED -->\nb",
    );
  });
});
